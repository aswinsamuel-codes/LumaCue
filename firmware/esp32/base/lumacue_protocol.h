// LumaCue radio protocol, version 1 — ESP32 / ESP-NOW build.
// Same 10-byte packet as firmware/bench_sync_test (NRF24), so the sync logic,
// LumaCue Show Mode and the simulator are shared. This file is duplicated in
// esp32/base/ and esp32/costume/ (Arduino sketches cannot share headers
// across folders). Keep both copies identical.
#pragma once
#include <stdint.h>

#define LUMACUE_MAGIC         'L'
#define LUMACUE_PROTO_VERSION 1

// ESP-NOW: base and costumes must be on the same Wi-Fi channel (no router needed).
#define LUMACUE_WIFI_CHANNEL 1

enum PacketType : uint8_t {
  PKT_ARM      = 1,  // "get ready for show <showId>"
  PKT_START    = 2,  // show clock started; showMs = base clock at send time
  PKT_BEACON   = 3,  // periodic time beacon while running
  PKT_BLACKOUT = 4,  // all LEDs off, stop the show
};

// 10 bytes, little-endian on both AVR and ESP32.
struct __attribute__((packed)) Packet {
  uint8_t  magic;    // LUMACUE_MAGIC
  uint8_t  version;  // LUMACUE_PROTO_VERSION
  uint8_t  type;     // PacketType
  uint8_t  showId;   // which stored show this is about
  uint8_t  runId;    // increments on every START, so repeats/beacons are matched to one run
  uint8_t  seq;      // increments on every packet sent (lets costumes count drops)
  uint32_t showMs;   // milliseconds since show start, at the moment of sending
};
