# LumaCue on ESP32 (ESP-NOW) — the planned costume controller

**Status (30 Oct 2026): written, NOT yet compiled, never run on an ESP32.** The ESP32 toolchain (~4–6 GB) didn't fit on the development laptop's disk. The code is checked against the bench sketches by LumaCue's tests, but the first ESP32 compile may still need small fixes (ESP-NOW API details differ between core 2.x and 3.x). Run the bench test (`../bench_sync_test/`) first; this is the next step once ESP32 boards arrive.

To compile-check it from LumaCue's tests once the esp32 core is installed: `ARDUINO_ESP32_DATA=<Arduino data folder> ARDUINO_LIBRARIES=<folder with FastLED> npm test` (see `lumacue/tests/firmware-compile.test.ts`).

The show format, effects, sync rules and serial commands are the **same as the bench sketches**. LumaCue's tests (`lumacue/tests/esp32.test.ts`) fail if the render code, sync state machine, serial commands or packet layout drift from the bench versions. So the Show Studio preview, *Costume view*, preflight and the sync simulator all apply to the ESP32 build as they are.

| | Bench (Nano) | ESP32 |
|---|---|---|
| Radio | NRF24L01+PA+LNA | ESP-NOW broadcast (built in, Wi-Fi channel 1, no router) |
| LEDs | 5 mm bi-colour or WS2812B | WS2812B only |
| Flash for the show | ~1,100 cues | far more (a few MB) |
| Current limit in firmware | 500 mA | 1,000 mA (FastLED scales brightness down) |
| Base station button | D2 to GND | BOOT button (GPIO 0) |
| Base reference LED | D3 + resistor | on-board LED (GPIO 2 on most dev boards) |

## Get the firmware

Show Studio → **→ Costume firmware** → Board **ESP32 (ESP-NOW)** → download one dancer or **All dancers**. The zip contains `base/base.ino` and `costume/costume.ino` (or `dancer_NN/costume/costume.ino`), with the show, its length, the zone sizes and brightness already filled in.

## Arduino IDE setup

1. *File → Preferences → Additional boards manager URLs:* `https://espressif.github.io/arduino-esp32/package_esp32_index.json`
2. *Boards Manager:* install **esp32 by Espressif Systems**.
3. *Library Manager:* install **FastLED**.
4. Board: **ESP32 Dev Module**. Upload `base.ino` to the base ESP32 and `costume.ino` to each costume.

## Wiring (costume)

| From | To |
|---|---|
| ESP32 GPIO 5 → ~330 Ω resistor | Strip DIN |
| Power bank 5 V | Strip 5 V **and** ESP32 5V/VIN pin |
| Power bank GND | Strip GND **and** ESP32 GND (common ground) |
| 1000 µF (or 100 µF from the kit) | Across strip 5 V / GND, at the strip input |

**3.3 V data → 5 V strip:** the ESP32's 3.3 V data signal is below the WS2812B's specified input-high level at 5 V. It usually works with a short data wire, but that isn't guaranteed. If the first LED flickers or shows wrong colours, add a 74AHCT125 level shifter, or run the first LED from a slightly lower supply. **Test this on the bench before building 10 costumes.**

## Test plan additions (on top of the bench T1–T12)

| # | Test | Pass |
|---|---|---|
| E1 | Base + 1 costume on the desk: ARM, START, BLACKOUT from Show Mode | Same behaviour as the bench sketches |
| E2 | 3 costumes, 10 m, people between them; filmed in slow motion | Costumes within ±20 ms of each other |
| E3 | Base clock vs music (T12 with music sync off/on) | Readout within ±20 ms with sync on |
| E4 | 3 min at the chosen brightness from a 5,000 mAh bank, then 30 min idle | No brown-outs; bank doesn't switch off during blackouts |
| E5 | Wi-Fi-heavy room (phones, venue Wi-Fi): repeat E2 | Beacons still arrive (`dropped~` low in Serial Monitor) |
