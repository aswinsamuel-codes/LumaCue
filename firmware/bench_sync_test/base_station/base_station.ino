// LumaCue bench sync test: BASE STATION (Arduino Nano + NRF24L01+PA+LNA).
// Powered by Aswin Samuel.
//
// The base owns the show clock. It broadcasts ARM, START (x3), time BEACONs
// every 500 ms and BLACKOUT. Costumes play their stored show locally, so they
// keep going if this board is unplugged.
//
// Control it from the Serial Monitor (115200 baud, "Newline" line ending):
//   a / ARM        arm the costumes for SHOW_ID
//   s / START      start the show (sends START three times)
//   b / BLACKOUT   all costumes off, stop the show
//   n / BEACONS    toggle time beacons on/off (drift test)
//   ? / STATUS     print state
// Optional: a push button from D2 to GND toggles START / BLACKOUT.
//
// A reference LED on D3 blinks on the show clock (on for the first 500 ms of
// every second). Film it next to the costume in slow motion to measure sync.

#include <SPI.h>
#include <RF24.h>
#include "lumacue_protocol.h"

// ---- Settings (SHOW_ID and SHOW_LENGTH_MS must match test_costume) ----
const uint8_t  SHOW_ID            = 1;
const uint32_t SHOW_LENGTH_MS     = 30000;
const uint16_t BEACON_INTERVAL_MS = 500;
const uint8_t  START_REPEATS      = 3;
const uint8_t  START_REPEAT_GAP   = 20;  // ms between START repeats

// ---- Pins ----
const uint8_t PIN_RADIO_CE  = 9;
const uint8_t PIN_RADIO_CSN = 10;  // SPI: D11 MOSI, D12 MISO, D13 SCK
const uint8_t PIN_BUTTON    = 2;   // to GND, internal pull-up
const uint8_t PIN_REF_LED   = 3;   // via 220 ohm to GND

RF24 radio(PIN_RADIO_CE, PIN_RADIO_CSN);

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
  radio.write(&p, sizeof(p), true);  // multicast: no ACK, any number of costumes
}

void cmdArm() {
  for (uint8_t i = 0; i < 3; i++) { send(PKT_ARM, 0); delay(START_REPEAT_GAP); }
  Serial.print(F("ARM sent for show ")); Serial.println(SHOW_ID);
}

void cmdStart() {
  runId++;
  runStartMillis = millis();
  running = true;
  // Each repeat carries the real elapsed show time, so a costume that only
  // hears the 2nd or 3rd copy still lands on the same clock.
  for (uint8_t i = 0; i < START_REPEATS; i++) {
    send(PKT_START, showMs());
    if (i + 1 < START_REPEATS) delay(START_REPEAT_GAP);
  }
  lastBeaconMs = showMs();
  Serial.print(F("START run ")); Serial.println(runId);
}

void cmdBlackout() {
  running = false;
  for (uint8_t i = 0; i < 5; i++) { send(PKT_BLACKOUT, 0); delay(5); }
  digitalWrite(PIN_REF_LED, LOW);
  Serial.println(F("BLACKOUT sent"));
}

void cmdStatus() {
  Serial.print(F("show=")); Serial.print(SHOW_ID);
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
  Serial.println(F("LumaCue base station (bench v1) - Powered by Aswin Samuel"));

  if (!radio.begin() || !radio.isChipConnected()) {
    Serial.println(F("ERROR: NRF24 not found. Check wiring and 5V to the adapter."));
    while (true) { digitalWrite(PIN_REF_LED, !digitalRead(PIN_REF_LED)); delay(100); }
  }
  radio.setChannel(LUMACUE_CHANNEL);
  radio.setDataRate(RF24_250KBPS);
  radio.setPALevel(RF24_PA_LOW);  // PA+LNA at close range: LOW avoids saturating the receiver
  radio.setAutoAck(false);
  radio.setCRCLength(RF24_CRC_16);
  radio.setPayloadSize(sizeof(Packet));
  radio.stopListening(LUMACUE_ADDRESS);

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
