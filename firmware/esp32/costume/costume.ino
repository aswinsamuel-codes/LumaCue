// LumaCue costume — ESP32 + WS2812B strip, ESP-NOW radio.
// Powered by Aswin Samuel.
//
// UNTESTED: written before the ESP32 boards arrived and NOT yet compiled
// (see ../README.md). Same show format, effects and sync rules as the bench costume
// (firmware/bench_sync_test/test_costume), so LumaCue's preview, exporter and
// simulator apply as they are. Only the radio (ESP-NOW instead of NRF24) and
// the board differ.
//
// The base station only starts the show and sends time beacons; if the radio
// drops, the show keeps playing on the local clock. A costume that powers up
// mid-show joins from the next beacon.
//
// Serial Monitor at 115200 shows START / late join, the clock error at every
// beacon (drift measurement), dropped packets and link loss.
//
// Board: "ESP32 Dev Module" (arduino-esp32 core 2.x or 3.x). Library: FastLED.

#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <FastLED.h>
#include "lumacue_protocol.h"

#define MODE_5MM   1
#define MODE_STRIP 2
#define OUTPUT_MODE MODE_STRIP  // the ESP32 costume drives a WS2812B strip
#if OUTPUT_MODE != MODE_STRIP
  #error "The ESP32 costume supports the WS2812B strip only (MODE_STRIP)"
#endif

// ---- Settings (SHOW_ID and SHOW_LENGTH_MS must match the base station) ----
const uint8_t  SHOW_ID           = 1;
const uint32_t SHOW_LENGTH_MS    = 30000;
const uint8_t  RADIO_LATENCY_MS  = 1;     // air time + processing, estimate
const uint16_t SNAP_MS           = 40;    // clock error above this: jump; below: ease in
const uint16_t LINK_LOST_MS      = 2000;  // no packets for this long while running = link lost

// ---- Strip ----
const uint8_t  PIN_STRIP_DATA = 5;    // via ~330 ohm to DIN (3.3 V logic: see README about level shifting)
// LEDs in zones A, B, C, in strip order. LumaCue's firmware download fills
// these in from Costume Setup (first 3 zones). Total at most 250.
constexpr uint8_t ZONE_A_LEDS = 20, ZONE_B_LEDS = 20, ZONE_C_LEDS = 20;
constexpr uint8_t NUM_PIXELS  = ZONE_A_LEDS + ZONE_B_LEDS + ZONE_C_LEDS;  // 1 m of 60 LED/m
const uint8_t  BRIGHTNESS     = 64;   // 0-255 (64 = 25 %); LumaCue sets it from the brightness cap
const uint16_t MAX_MILLIAMPS  = 1000; // FastLED scales brightness down to stay under this (power bank limit)

// ---- Show data (same format as the bench costume) ----
enum Effect : uint8_t { FX_OFF, FX_SOLID, FX_FLASH, FX_CHASE };
const uint8_t ZA = 1, ZB = 2, ZC = 4, ZALL = 7;

struct Cue {
  uint32_t startMs;
  uint16_t durationMs;
  uint8_t  zoneMask;
  uint8_t  effect;
  uint8_t  r, g, b;
  uint16_t param;  // FLASH: period ms (50 % duty, from the cue's start). CHASE: ms per lap.
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

// ---- Rendering (same rules as test_costume.ino; LumaCue's lib/show/bench.ts ports them) ----
uint8_t zoneOf(uint8_t i) {
  if (i < ZONE_A_LEDS) return 0;
  if (i < ZONE_A_LEDS + ZONE_B_LEDS) return 1;
  return 2;
}

bool inMask(uint8_t i, uint8_t mask) { return mask & (1 << zoneOf(i)); }

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
  // Only push to the LEDs when the frame changed.
  uint16_t h = 7;
  const uint8_t* p = (const uint8_t*)pixels;
  for (uint16_t i = 0; i < sizeof(pixels); i++) h = h * 31 + p[i];
  if (h == lastFrameHash) return;
  lastFrameHash = h;
  FastLED.show();
}

// ---- Radio: ESP-NOW callback runs on the Wi-Fi task, so it only queues packets ----
const uint8_t QUEUE_LEN = 16;
Packet queue[QUEUE_LEN];
volatile uint8_t qHead = 0, qTail = 0;
portMUX_TYPE qMux = portMUX_INITIALIZER_UNLOCKED;

void enqueue(const uint8_t* data, int len) {
  if (len != (int)sizeof(Packet)) return;
  portENTER_CRITICAL(&qMux);
  uint8_t next = (qHead + 1) % QUEUE_LEN;
  if (next != qTail) { memcpy(&queue[qHead], data, sizeof(Packet)); qHead = next; }
  portEXIT_CRITICAL(&qMux);
}

bool dequeue(Packet& p) {
  bool got = false;
  portENTER_CRITICAL(&qMux);
  if (qTail != qHead) { p = queue[qTail]; qTail = (qTail + 1) % QUEUE_LEN; got = true; }
  portEXIT_CRITICAL(&qMux);
  return got;
}

#if ESP_ARDUINO_VERSION_MAJOR >= 3
void onRecv(const esp_now_recv_info_t* info, const uint8_t* data, int len) { (void)info; enqueue(data, len); }
#else
void onRecv(const uint8_t* mac, const uint8_t* data, int len) { (void)mac; enqueue(data, len); }
#endif

// ---- Show logic (same as test_costume.ino) ----
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
  Serial.println(F("LumaCue costume (ESP32, ESP-NOW) - Powered by Aswin Samuel"));

  FastLED.addLeds<WS2812B, PIN_STRIP_DATA, GRB>(reinterpret_cast<CRGB*>(pixels), NUM_PIXELS);
  FastLED.setBrightness(BRIGHTNESS);
  FastLED.setMaxPowerInVoltsAndMilliamps(5, MAX_MILLIAMPS);
  memset(pixels, 0, sizeof(pixels));
  output();

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  esp_wifi_set_channel(LUMACUE_WIFI_CHANNEL, WIFI_SECOND_CHAN_NONE);
  if (esp_now_init() != ESP_OK) {
    Serial.println(F("ERROR: ESP-NOW failed to start"));
    while (true) {  // zone A blinks red fast
      memset(pixels, 0, sizeof(pixels));
      if ((millis() / 100) % 2) for (uint8_t i = 0; i < NUM_PIXELS; i++) if (zoneOf(i) == 0) pixels[i] = { 255, 0, 0 };
      output();
      delay(10);
    }
  }
  esp_now_register_recv_cb(onRecv);
  Serial.print(F("Radio OK (ESP-NOW, channel ")); Serial.print(LUMACUE_WIFI_CHANNEL);
  Serial.print(F("). MAC ")); Serial.println(WiFi.macAddress());
}

void loop() {
  Packet p;
  while (dequeue(p)) onPacket(p);

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
