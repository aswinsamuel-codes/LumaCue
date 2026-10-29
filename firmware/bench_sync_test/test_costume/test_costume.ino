// LumaCue bench sync test: TEST COSTUME (Arduino Nano + NRF24L01+PA+LNA).
// Powered by Aswin Samuel.
//
// Plays a stored 30 s show with 3 zones. The base station only starts it and
// sends time beacons; if the radio link drops, the show keeps playing on the
// local clock. A costume that powers up mid-show joins from the next beacon.
//
// Pick the LED output below:
//   MODE_5MM   - the XL-A524 red/yellow-green bi-colour 5 mm LEDs, one per zone
//                (colours: red, green, yellow = both dies on)
//   MODE_STRIP - a WS2812B strip (needs the FastLED library)
//
// Serial Monitor at 115200 shows START / late join, the clock error at every
// beacon (this is the drift measurement), dropped packets and link loss.

#include <SPI.h>
#include <RF24.h>
#include "lumacue_protocol.h"

#define MODE_5MM   1
#define MODE_STRIP 2
#define OUTPUT_MODE MODE_5MM  // <-- change to MODE_STRIP for WS2812B

// ---- Settings (SHOW_ID and SHOW_LENGTH_MS must match base_station) ----
const uint8_t  SHOW_ID           = 1;
const uint32_t SHOW_LENGTH_MS    = 30000;
const uint8_t  RADIO_LATENCY_MS  = 1;     // air time + processing, estimate
const uint16_t SNAP_MS           = 40;    // clock error above this: jump; below: ease in
const uint16_t LINK_LOST_MS      = 2000;  // no packets for this long while running = link lost

// ---- Pins ----
const uint8_t PIN_RADIO_CE  = 9;
const uint8_t PIN_RADIO_CSN = 10;  // SPI: D11 MOSI, D12 MISO, D13 SCK (so no LED_BUILTIN)

#if OUTPUT_MODE == MODE_STRIP
  #include <FastLED.h>
  const uint8_t  PIN_STRIP_DATA = 6;    // via 220 ohm to DIN
  const uint8_t  NUM_PIXELS     = 60;   // 1 m of 60 LED/m
  const uint8_t  LEDS_PER_ZONE  = 20;   // zone A = 0-19, B = 20-39, C = 40-59
  const uint8_t  BRIGHTNESS     = 64;   // ~25 %
  const uint16_t MAX_MILLIAMPS  = 500;  // FastLED scales brightness down to stay under this
#else
  const uint8_t NUM_PIXELS = 3;         // one bi-colour LED per zone
  const uint8_t RED_PINS[3]   = {3, 5, 7};  // each via 220 ohm to the LED's red anode
  const uint8_t GREEN_PINS[3] = {4, 6, 8};  // each via 220 ohm to the green anode
#endif

// ---- Show data ----
enum Effect : uint8_t { FX_OFF, FX_SOLID, FX_FLASH, FX_CHASE };
const uint8_t ZA = 1, ZB = 2, ZC = 4, ZALL = 7;

struct Cue {
  uint32_t startMs;
  uint16_t durationMs;
  uint8_t  zoneMask;
  uint8_t  effect;
  uint8_t  r, g, b;
  uint16_t param;  // FLASH: period ms (50 % duty, phased on show time). CHASE: ms per lap.
};

// Demo show 1. Later cues win where they overlap.
const Cue SHOW[] PROGMEM = {
  {     0,  2000, ZALL, FX_OFF,     0,   0, 0,    0 },
  {  2000,  4000, ZALL, FX_SOLID, 255,   0, 0,    0 },  // all red
  {  6000,  4000, ZA,   FX_SOLID, 255,   0, 0,    0 },  // A red
  {  6000,  4000, ZB,   FX_SOLID,   0, 255, 0,    0 },  // B green
  {  6000,  4000, ZC,   FX_SOLID, 255, 160, 0,    0 },  // C yellow
  { 10000, 10000, ZALL, FX_FLASH, 255, 160, 0, 1000 },  // SYNC SECTION: 1 Hz, same phase as base ref LED
  { 20000,  6000, ZALL, FX_CHASE,   0, 255, 0,  900 },  // green chase
  { 26000,  2000, ZALL, FX_FLASH, 255,   0, 0,  250 },  // fast red flash
  // 28000-30000 dark, then the show ends
};
const uint16_t NUM_CUES = sizeof(SHOW) / sizeof(SHOW[0]);  // uint16: LumaCue exports can exceed 255 cues

// ---- State ----
enum State : uint8_t { ST_IDLE, ST_ARMED, ST_RUNNING, ST_DONE };
State    state            = ST_IDLE;
uint8_t  runId            = 0;
uint32_t showStartMillis  = 0;
uint32_t lastPacketMillis = 0;
uint32_t armBlinkUntil    = 0;
bool     linkLost         = false;
bool     haveSeq          = false;
uint8_t  lastSeq          = 0;
uint32_t packetsRx        = 0;
uint32_t packetsDropped   = 0;

struct Px { uint8_t r, g, b; };  // same layout as FastLED's CRGB
Px pixels[NUM_PIXELS];
uint16_t lastFrameHash = 0xFFFF;

RF24 radio(PIN_RADIO_CE, PIN_RADIO_CSN);

// ---- Rendering ----
uint8_t zoneOf(uint8_t i) {
#if OUTPUT_MODE == MODE_STRIP
  uint8_t z = i / LEDS_PER_ZONE;
  return z > 2 ? 2 : z;
#else
  return i;
#endif
}

bool inMask(uint8_t i, uint8_t mask) { return mask & (1 << zoneOf(i)); }

void applyCue(const Cue& c, uint32_t t) {
  Px col = { c.r, c.g, c.b };
  Px off = { 0, 0, 0 };

  if (c.effect == FX_OFF || c.effect == FX_SOLID || c.effect == FX_FLASH) {
    bool lit = c.effect == FX_SOLID ||
               (c.effect == FX_FLASH && c.param && (t % c.param) < c.param / 2);
    for (uint8_t i = 0; i < NUM_PIXELS; i++)
      if (inMask(i, c.zoneMask)) pixels[i] = lit ? col : off;
    return;
  }

  // FX_CHASE: a short lit segment runs over the cue's pixels once per lap.
  uint8_t count = 0;
  for (uint8_t i = 0; i < NUM_PIXELS; i++) if (inMask(i, c.zoneMask)) count++;
  if (!count || !c.param) return;
  uint8_t head = (uint32_t)(t % c.param) * count / c.param;
  uint8_t tail = count >= 10 ? count / 10 : 1;
  uint8_t k = 0;
  for (uint8_t i = 0; i < NUM_PIXELS; i++) {
    if (!inMask(i, c.zoneMask)) continue;
    pixels[i] = ((head + count - k) % count) < tail ? col : off;
    k++;
  }
}

void render() {
  memset(pixels, 0, sizeof(pixels));

  if (state == ST_RUNNING) {
    uint32_t t = millis() - showStartMillis;
    Cue c;
    for (uint16_t n = 0; n < NUM_CUES; n++) {
      memcpy_P(&c, &SHOW[n], sizeof(Cue));
      if (t >= c.startMs && t < c.startMs + c.durationMs) applyCue(c, t);
    }
  } else if (state == ST_ARMED && millis() < armBlinkUntil && (millis() / 100) % 2) {
    for (uint8_t i = 0; i < NUM_PIXELS; i++)
      if (zoneOf(i) == 0) pixels[i] = { 255, 160, 0 };  // zone A blinks yellow = armed
  }
}

void output() {
  // Only push to the LEDs when the frame changed (keeps the strip's
  // interrupt-off time, and its effect on millis(), to a minimum).
  uint16_t h = 7;
  const uint8_t* p = (const uint8_t*)pixels;
  for (uint16_t i = 0; i < sizeof(pixels); i++) h = h * 31 + p[i];
  if (h == lastFrameHash) return;
  lastFrameHash = h;

#if OUTPUT_MODE == MODE_STRIP
  FastLED.show();
#else
  for (uint8_t i = 0; i < NUM_PIXELS; i++) {
    digitalWrite(RED_PINS[i],   pixels[i].r >= 128 ? HIGH : LOW);
    digitalWrite(GREEN_PINS[i], pixels[i].g >= 128 ? HIGH : LOW);
  }
#endif
}

// ---- Radio ----
void beginRun(const Packet& p, bool late) {
  runId           = p.runId;
  showStartMillis = millis() - p.showMs - RADIO_LATENCY_MS;
  state           = ST_RUNNING;
  linkLost        = false;
  Serial.print(late ? F("LATE JOIN run ") : F("START run "));
  Serial.print(runId);
  Serial.print(F(" at t="));
  Serial.println(p.showMs);
}

void correctClock(const Packet& p) {
  long expected = (long)p.showMs + RADIO_LATENCY_MS;
  long local    = (long)(millis() - showStartMillis);
  long err      = local - expected;  // + means this costume is ahead of the base
  if (err > (long)SNAP_MS || err < -(long)SNAP_MS) showStartMillis += err;
  else showStartMillis += err / 2;
  if (p.type == PKT_BEACON) {
    Serial.print(F("beacon t=")); Serial.print(p.showMs);
    Serial.print(F(" err_ms=")); Serial.print(err);
    Serial.print(F(" rx=")); Serial.print(packetsRx);
    Serial.print(F(" dropped~")); Serial.println(packetsDropped);
  }
}

void onPacket(const Packet& p) {
  if (p.magic != LUMACUE_MAGIC || p.version != LUMACUE_PROTO_VERSION) return;

  packetsRx++;
  if (haveSeq) packetsDropped += (uint8_t)(p.seq - lastSeq - 1);  // approximate; resets if the base reboots
  lastSeq = p.seq;
  haveSeq = true;
  lastPacketMillis = millis();
  if (linkLost) { linkLost = false; Serial.println(F("link back")); }

  if (p.showId != SHOW_ID) {
    Serial.print(F("ignored: base wants show ")); Serial.print(p.showId);
    Serial.print(F(", this costume has show ")); Serial.println(SHOW_ID);
    return;
  }

  switch (p.type) {
    case PKT_ARM:
      if (state != ST_RUNNING) {
        state = ST_ARMED;
        armBlinkUntil = millis() + 600;
        Serial.println(F("ARMED"));
      }
      break;

    case PKT_START:
    case PKT_BEACON:
      if (state == ST_RUNNING && p.runId == runId) correctClock(p);
      else if (state == ST_DONE && p.runId == runId && p.type == PKT_BEACON) { /* blacked out: stay dark */ }
      else if (p.showMs < SHOW_LENGTH_MS) beginRun(p, p.type == PKT_BEACON);  // START always (re)starts
      break;

    case PKT_BLACKOUT:
      if (state != ST_DONE && state != ST_IDLE) Serial.println(F("BLACKOUT"));
      state = ST_DONE;
      break;
  }
}

void setup() {
  Serial.begin(115200);
  Serial.println(F("LumaCue test costume (bench v1) - Powered by Aswin Samuel"));

#if OUTPUT_MODE == MODE_STRIP
  FastLED.addLeds<WS2812B, PIN_STRIP_DATA, GRB>(reinterpret_cast<CRGB*>(pixels), NUM_PIXELS);
  FastLED.setBrightness(BRIGHTNESS);
  FastLED.setMaxPowerInVoltsAndMilliamps(5, MAX_MILLIAMPS);
  Serial.println(F("output: WS2812B strip"));
#else
  for (uint8_t i = 0; i < 3; i++) { pinMode(RED_PINS[i], OUTPUT); pinMode(GREEN_PINS[i], OUTPUT); }
  Serial.println(F("output: 5 mm bi-colour LEDs"));
#endif
  memset(pixels, 0, sizeof(pixels));
  output();

  if (!radio.begin() || !radio.isChipConnected()) {
    Serial.println(F("ERROR: NRF24 not found. Check wiring and 5V to the adapter."));
    while (true) {  // zone A blinks red fast
      memset(pixels, 0, sizeof(pixels));
      if ((millis() / 100) % 2) for (uint8_t i = 0; i < NUM_PIXELS; i++) if (zoneOf(i) == 0) pixels[i] = { 255, 0, 0 };
      output();
    }
  }
  radio.setChannel(LUMACUE_CHANNEL);
  radio.setDataRate(RF24_250KBPS);
  radio.setPALevel(RF24_PA_LOW);
  radio.setAutoAck(false);
  radio.setCRCLength(RF24_CRC_16);
  radio.setPayloadSize(sizeof(Packet));
  radio.openReadingPipe(1, LUMACUE_ADDRESS);
  radio.startListening();
  Serial.println(F("Radio OK, listening."));
}

void loop() {
  while (radio.available()) {
    Packet p;
    radio.read(&p, sizeof(p));
    onPacket(p);
  }

  if (state == ST_RUNNING) {
    if (millis() - showStartMillis >= SHOW_LENGTH_MS) {
      state = ST_DONE;
      Serial.println(F("show ended"));
    } else if (!linkLost && millis() - lastPacketMillis > LINK_LOST_MS) {
      linkLost = true;
      Serial.println(F("link lost - continuing on local clock"));
    }
  }

  render();
  output();
}
