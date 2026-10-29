// LumaCue base station — ESP32 on USB, ESP-NOW broadcast.
// Powered by Aswin Samuel.
//
// UNTESTED: written before the ESP32 boards arrived and NOT yet compiled
// (see ../README.md). Same serial commands and output lines as the bench base
// (firmware/bench_sync_test/base_station), so LumaCue Show Mode drives it
// unchanged. Only the radio differs (ESP-NOW broadcast instead of NRF24).
//
// The base owns the show clock. It broadcasts ARM, START (x3), time BEACONs
// every 500 ms and BLACKOUT. Costumes play their stored show locally, so they
// keep going if this board is unplugged.
//
// Serial (115200 baud, "Newline"):
//   a / ARM        arm the costumes for SHOW_ID
//   s / START      start the show (sends START three times)
//   S<ms>          start the show from <ms> (rehearse from the middle)
//   b / BLACKOUT   all costumes off, stop the show
//   n / BEACONS    toggle time beacons on/off (drift test)
//   ? / STATUS     print state (includes len=<show length>)
//   T<ms>          music sync: re-anchor the show clock to the laptop's music
// The BOOT button (GPIO 0) toggles START / BLACKOUT.
// The on-board LED (GPIO 2 on most dev boards) blinks on the show clock
// (on for the first 500 ms of every second): film it next to a costume.
//
// Board: "ESP32 Dev Module" (arduino-esp32 core 2.x or 3.x).

#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include "lumacue_protocol.h"

// ---- Settings (SHOW_ID and SHOW_LENGTH_MS must match the costumes) ----
const uint8_t  SHOW_ID            = 1;
const uint32_t SHOW_LENGTH_MS     = 30000;
const uint16_t BEACON_INTERVAL_MS = 500;
const uint8_t  START_REPEATS      = 3;
const uint8_t  START_REPEAT_GAP   = 20;  // ms between START repeats

const uint8_t PIN_BUTTON  = 0;  // BOOT button, to GND, internal pull-up
const uint8_t PIN_REF_LED = 2;  // on-board LED on most ESP32 dev boards

const uint8_t BROADCAST[6] = { 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF };

bool     running        = false;
bool     beaconsEnabled = true;
uint8_t  runId          = 0;
uint8_t  seq            = 0;
uint32_t runStartMillis = 0;
uint32_t lastBeaconMs   = 0;

char    lineBuf[24];
uint8_t lineLen = 0;

uint32_t showMs() { return millis() - runStartMillis; }

void send(PacketType type, uint32_t ms) {
  Packet p;
  p.magic   = LUMACUE_MAGIC;
  p.version = LUMACUE_PROTO_VERSION;
  p.type    = type;
  p.showId  = SHOW_ID;
  p.runId   = runId;
  p.seq     = seq++;
  p.showMs  = ms;
  esp_now_send(BROADCAST, (const uint8_t*)&p, sizeof(p));  // broadcast: no ACK, any number of costumes
}

void cmdArm() {
  for (uint8_t i = 0; i < 3; i++) { send(PKT_ARM, 0); delay(START_REPEAT_GAP); }
  Serial.print(F("ARM sent for show ")); Serial.println(SHOW_ID);
}

void cmdStart(uint32_t fromMs = 0) {
  if (fromMs >= SHOW_LENGTH_MS) { Serial.println(F("start point is past the end of the show")); return; }
  runId++;
  runStartMillis = millis() - fromMs;
  running = true;
  // Each repeat carries the real elapsed show time, so a costume that only
  // hears the 2nd or 3rd copy still lands on the same clock.
  for (uint8_t i = 0; i < START_REPEATS; i++) {
    send(PKT_START, showMs());
    if (i + 1 < START_REPEATS) delay(START_REPEAT_GAP);
  }
  lastBeaconMs = showMs();
  Serial.print(F("START run ")); Serial.print(runId);
  if (fromMs) { Serial.print(F(" from ")); Serial.print(fromMs); }
  Serial.println();
}

void cmdBlackout() {
  running = false;
  for (uint8_t i = 0; i < 5; i++) { send(PKT_BLACKOUT, 0); delay(5); }
  digitalWrite(PIN_REF_LED, LOW);
  Serial.println(F("BLACKOUT sent"));
}

// The laptop plays the music on its own clock; this board's clock drifts a
// little from it, so LumaCue tells the base where the music is.
void cmdMusicSync(uint32_t musicMs) {
  if (!running) return;
  long err = (long)showMs() - (long)musicMs;  // + means the base was ahead of the music
  runStartMillis = millis() - musicMs;
  if (lastBeaconMs > musicMs) lastBeaconMs = musicMs;  // clock went back: keep beaconing
  Serial.print(F("sync err_ms=")); Serial.println(err);
}

void cmdStatus() {
  Serial.print(F("show=")); Serial.print(SHOW_ID);
  Serial.print(F(" len=")); Serial.print(SHOW_LENGTH_MS);
  Serial.print(F(" run=")); Serial.print(runId);
  Serial.print(F(" running=")); Serial.print(running ? F("yes") : F("no"));
  if (running) { Serial.print(F(" t=")); Serial.print(showMs()); }
  Serial.print(F(" beacons=")); Serial.println(beaconsEnabled ? F("on") : F("off"));
}

void handleLine(const char* s) {
  if (!strcmp(s, "a") || !strcasecmp(s, "ARM")) cmdArm();
  else if (!strcmp(s, "s") || !strcasecmp(s, "START")) cmdStart();
  else if (!strcmp(s, "b") || !strcasecmp(s, "BLACKOUT") || !strcasecmp(s, "STOP")) cmdBlackout();
  else if (!strcmp(s, "n") || !strcasecmp(s, "BEACONS")) {
    beaconsEnabled = !beaconsEnabled;
    Serial.print(F("beacons ")); Serial.println(beaconsEnabled ? F("on") : F("off"));
  }
  else if (!strcmp(s, "?") || !strcasecmp(s, "STATUS")) cmdStatus();
  else if ((s[0] == 'T' || s[0] == 't') && isdigit(s[1])) cmdMusicSync(strtoul(s + 1, NULL, 10));
  else if ((s[0] == 'S' || s[0] == 's') && isdigit(s[1])) cmdStart(strtoul(s + 1, NULL, 10));
  else if (s[0]) { Serial.print(F("unknown command: ")); Serial.println(s); }
}

void readSerial() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\r') continue;
    if (c == '\n') { lineBuf[lineLen] = 0; handleLine(lineBuf); lineLen = 0; }
    else if (lineLen < sizeof(lineBuf) - 1) lineBuf[lineLen++] = c;
  }
}

void readButton() {
  static bool     lastPressed = false;
  static uint32_t lastChange  = 0;
  bool pressed = digitalRead(PIN_BUTTON) == LOW;
  if (pressed != lastPressed && millis() - lastChange > 50) {
    lastChange  = millis();
    lastPressed = pressed;
    if (pressed) { if (running) cmdBlackout(); else cmdStart(); }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_BUTTON, INPUT_PULLUP);
  pinMode(PIN_REF_LED, OUTPUT);
  Serial.println(F("LumaCue base station (ESP32, ESP-NOW) - Powered by Aswin Samuel"));

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  esp_wifi_set_channel(LUMACUE_WIFI_CHANNEL, WIFI_SECOND_CHAN_NONE);
  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, BROADCAST, 6);
  peer.channel = LUMACUE_WIFI_CHANNEL;
  peer.encrypt = false;
  if (esp_now_init() != ESP_OK || esp_now_add_peer(&peer) != ESP_OK) {
    Serial.println(F("ERROR: ESP-NOW failed to start"));
    while (true) { digitalWrite(PIN_REF_LED, !digitalRead(PIN_REF_LED)); delay(100); }
  }

  Serial.println(F("Radio OK. Commands: a=ARM s=START b=BLACKOUT n=beacons ?=status"));
}

void loop() {
  readSerial();
  readButton();
  if (!running) return;

  uint32_t t = showMs();
  if (t >= SHOW_LENGTH_MS) {
    running = false;
    digitalWrite(PIN_REF_LED, LOW);
    Serial.println(F("show ended"));
    return;
  }

  digitalWrite(PIN_REF_LED, (t % 1000) < 500 ? HIGH : LOW);

  if (beaconsEnabled && t - lastBeaconMs >= BEACON_INTERVAL_MS) {
    send(PKT_BEACON, t);
    lastBeaconMs = t;
  }
}
