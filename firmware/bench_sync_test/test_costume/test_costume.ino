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
const uint16_t SNAP_MS           = 20;    // clock error above this: jump; below: ease in
const uint16_t LINK_LOST_MS      = 2000;  // no packets for this long while running = link lost

// ---- Pins ----
const uint8_t PIN_RADIO_CE  = 9;
const uint8_t PIN_RADIO_CSN = 10;  // SPI: D11 MOSI, D12 MISO, D13 SCK (so no LED_BUILTIN)

#if OUTPUT_MODE == MODE_STRIP
  #include <FastLED.h>
  const uint8_t  PIN_STRIP_DATA = 6;    // via 220 ohm to DIN
  // LEDs in zones A, B, C, in strip order. LumaCue's firmware download fills
  // these in from Costume Setup (first 3 zones). Total at most 250.
  constexpr uint8_t ZONE_A_LEDS = 20, ZONE_B_LEDS = 20, ZONE_C_LEDS = 20;
  constexpr uint8_t NUM_PIXELS  = ZONE_A_LEDS + ZONE_B_LEDS + ZONE_C_LEDS;  // 1 m of 60 LED/m
  const uint8_t  BRIGHTNESS     = 64;   // 0-255 (64 = 25 %); LumaCue sets it from the brightness cap
  const uint16_t MAX_MILLIAMPS  = 500;  // FastLED scales brightness down to stay under this
  // LED positions on the body (x, y 0-255) for the canvas effects, in strip
  // order. LumaCue's firmware download fills these in from Costume Setup.
  // PIX_POS strip begin
  const uint8_t PIX_POS[NUM_PIXELS][2] PROGMEM = {
    {84, 61}, {78, 69}, {73, 77}, {67, 84}, {62, 92}, {56, 100}, {51, 108}, {47, 115},
    {42, 123}, {38, 131}, {171, 61}, {177, 69}, {182, 77}, {188, 84}, {193, 92}, {199, 100},
    {204, 108}, {208, 115}, {213, 123}, {217, 131}, {96, 61}, {99, 66}, {103, 70}, {106, 75},
    {109, 79}, {113, 84}, {116, 88}, {119, 93}, {123, 98}, {126, 102}, {129, 102}, {132, 98},
    {136, 93}, {139, 88}, {142, 84}, {146, 79}, {149, 75}, {152, 70}, {156, 66}, {159, 61},
    {111, 148}, {110, 158}, {108, 168}, {107, 178}, {105, 188}, {104, 197}, {103, 207}, {102, 217},
    {101, 227}, {100, 237}, {144, 148}, {145, 158}, {147, 168}, {148, 178}, {150, 188}, {151, 197},
    {152, 207}, {153, 217}, {154, 227}, {155, 237},
  };
  // PIX_POS strip end
#else
  const uint8_t NUM_PIXELS = 3;         // one bi-colour LED per zone
  const uint8_t RED_PINS[3]   = {3, 5, 7};  // each via 220 ohm to the LED's red anode
  const uint8_t GREEN_PINS[3] = {4, 6, 8};  // each via 220 ohm to the green anode
  // Position on the body (x, y 0-255) of each zone's LED, for the canvas effects.
  // PIX_POS 5mm begin
  const uint8_t PIX_POS[NUM_PIXELS][2] PROGMEM = {
    {120, 96}, {128, 82}, {125, 193},
  };
  // PIX_POS 5mm end
#endif

// ---- Show data ----
enum Effect : uint8_t { FX_OFF, FX_SOLID, FX_FLASH, FX_CHASE, FX_RISE, FX_SWEEP, FX_RIPPLE };
const uint8_t ZA = 1, ZB = 2, ZC = 4, ZALL = 7;

struct Cue {
  uint32_t startMs;
  uint16_t durationMs;
  uint8_t  zoneMask;
  uint8_t  effect;
  uint8_t  r, g, b;
  uint16_t param;  // FLASH: period ms (50 % duty, from the cue's start). CHASE, RISE, SWEEP, RIPPLE: ms per lap.
};

// Demo show 1. Later cues win where they overlap.
const Cue SHOW[] PROGMEM = {
  {     0,  2000, ZALL, FX_OFF,     0,   0, 0,    0 },
  {  2000,  4000, ZALL, FX_SOLID, 255,   0, 0,    0 },  // all red
  {  6000,  4000, ZA,   FX_SOLID, 255,   0, 0,    0 },  // A red
  {  6000,  4000, ZB,   FX_SOLID,   0, 255, 0,    0 },  // B green
  {  6000,  4000, ZC,   FX_SOLID, 255, 160, 0,    0 },  // C yellow
  { 10000, 10000, ZALL, FX_FLASH, 255, 160, 0, 1000 },  // SYNC SECTION: 1 Hz, starts on a whole second so it's in phase with the base ref LED
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
  if (i < ZONE_A_LEDS) return 0;
  if (i < ZONE_A_LEDS + ZONE_B_LEDS) return 1;
  return 2;
#else
  return i;
#endif
}

bool inMask(uint8_t i, uint8_t mask) { return mask & (1 << zoneOf(i)); }

// Canvas effects (RISE / SWEEP / RIPPLE): where the band is, by each LED's
// position on the body (PIX_POS, 0-255: x left -> right, y top -> bottom).
// Same maths as LumaCue's lib/show/canvas.ts.
const int16_t BAND_W = 48;

uint8_t canvasCoord(uint8_t fx, uint8_t i) {
  uint8_t x = pgm_read_byte(&PIX_POS[i][0]);
  uint8_t y = pgm_read_byte(&PIX_POS[i][1]);
  if (fx == FX_RISE) return 255 - y;
  if (fx == FX_SWEEP) return x;
  uint16_t d = (x > 128 ? x - 128 : 128 - x) + (y > 90 ? y - 90 : 90 - y);  // RIPPLE: distance from the chest
  return d > 255 ? 255 : d;
}

void applyCue(const Cue& c, uint32_t t) {
  Px col = { c.r, c.g, c.b };
  Px off = { 0, 0, 0 };

  if (c.effect == FX_OFF || c.effect == FX_SOLID || c.effect == FX_FLASH) {
    // FLASH phase counts from the cue's start, like the LumaCue preview.
    bool lit = c.effect == FX_SOLID ||
               (c.effect == FX_FLASH && c.param && ((t - c.startMs) % c.param) < c.param / 2);
    for (uint8_t i = 0; i < NUM_PIXELS; i++)
      if (inMask(i, c.zoneMask)) pixels[i] = lit ? col : off;
    return;
  }

  if (c.effect == FX_RISE || c.effect == FX_SWEEP || c.effect == FX_RIPPLE) {
    // A soft band crosses the costume once per lap (param ms) and blends over the pixel.
    if (!c.param) return;
    int16_t centre = -BAND_W + (int16_t)((uint32_t)((t - c.startMs) % c.param) * (255 + 2 * BAND_W) / c.param);
    for (uint8_t i = 0; i < NUM_PIXELS; i++) {
      if (!inMask(i, c.zoneMask)) continue;
      int16_t d = (int16_t)canvasCoord(c.effect, i) - centre;
      if (d < 0) d = -d;
      if (d >= BAND_W) continue;
      int32_t k = 255 - (int32_t)d * 255 / BAND_W;
      pixels[i].r += (int32_t)((int16_t)c.r - pixels[i].r) * k / 255;
      pixels[i].g += (int32_t)((int16_t)c.g - pixels[i].g) * k / 255;
      pixels[i].b += (int32_t)((int16_t)c.b - pixels[i].b) * k / 255;
    }
    return;
  }

  // FX_CHASE: a short lit segment runs over the cue's pixels once per lap.
  uint8_t count = 0;
  for (uint8_t i = 0; i < NUM_PIXELS; i++) if (inMask(i, c.zoneMask)) count++;
  if (!count || !c.param) return;
  uint8_t head = (uint32_t)((t - c.startMs) % c.param) * count / c.param;
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
