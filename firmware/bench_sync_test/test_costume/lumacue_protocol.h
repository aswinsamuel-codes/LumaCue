// LumaCue radio protocol, bench version 1.
// This file is duplicated in base_station/ and test_costume/ (Arduino sketches
// cannot share headers across folders). Keep both copies identical.
#pragma once
#include <stdint.h>

#define LUMACUE_MAGIC         'L'
#define LUMACUE_PROTO_VERSION 1

// Radio settings shared by base and costumes.
#define LUMACUE_CHANNEL 108  // 2.508 GHz, above most Wi-Fi channels
static const uint8_t LUMACUE_ADDRESS[5] = {'L', 'U', 'M', 'A', '1'};

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
