# LumaCue on ESP32 (ESP-NOW) — the planned costume controller

**Status (1 Nov 2026): written, NOT yet compiled, never run on an ESP32.** The ESP32 toolchain (arduino-esp32 core 3.3.12) is installed in `tools/arduino-esp32/`, but on the development laptop **Windows Smart App Control blocks the compiler's programs** (Code Integrity events 3033/3077 for the unsigned `xtensa-esp-elf` tools), so it can't run there. Compile on a machine without that block (or in the cloud) before flashing; the same block will likely stop uploads from that laptop too. The code is checked against the bench sketches by LumaCue's tests, and the shared render and canvas code compiles for the Nano, but the ESP32-only parts (ESP-NOW, FreeRTOS tasks) still need their first compile.

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

## How the costume firmware is organised (1 Nov 2026)

Built on the open-source patterns of WLED, xLights and NTUEE LightDance, adapted to LumaCue's cue tables:

| Part | What it does |
|---|---|
| **Core 0: `commsTask`** | Applies radio packets (queued by the ESP-NOW callback, which runs in the Wi-Fi task on core 0), the START / beacon / BLACKOUT state machine, show-end and link-loss checks. Waits ~1 ms between passes |
| **Core 1: `renderTask`** | Draws a frame every `FRAME_MS` (10 ms = 100 fps) on a fixed beat (`vTaskDelayUntil`), then `FastLED.show()`. Radio work can't make the lights stutter |
| `stateLock` (mutex) | Stops the two tasks touching the show state at the same moment; `FastLED.show()` runs outside it |
| **Local playback** | The show (cue table) is stored in flash; the radio only starts it and sends time beacons. Clock error above **20 ms** (`SNAP_MS`) jumps; below it eases in |
| **Canvas effects** | RISE (up the body), SWEEP (left → right), RIPPLE (out from the chest) move by each LED's **position on the body** (`PIX_POS`, 0–255), not its place on the strip. LumaCue's download fills `PIX_POS` from Costume Setup (zone sizes + body positions), so the same show works on any LED layout. Same maths as `lumacue/lib/show/canvas.ts` and the bench costume |
| Level shifting | 3.3 V data → 5 V strip through a 74AHCT125 (see Wiring) |

## Get the firmware

Show Studio → **→ Costume firmware** → Board **ESP32 (ESP-NOW)** → download one dancer or **All dancers**. The zip contains `base/base.ino` and `costume/costume.ino` (or `dancer_NN/costume/costume.ino`), with the show, its length, the zone sizes and brightness already filled in.

## Build in the cloud and flash from the browser (no compiler on the laptop)

Windows Smart App Control on the development laptop blocks the ESP32 compiler (and probably the
Arduino IDE's ESP32 uploader), so firmware is compiled on GitHub and flashed from Chrome/Edge:

1. **Build.** Pushing anything under `firmware/` runs the **Firmware build** workflow
   (`.github/workflows/firmware.yml`) on GitHub. For a show, put LumaCue's firmware download in
   `firmware/shows/<show>/` first (see `../shows/README.md`). You can also start it by hand:
   GitHub → **Actions** → **Firmware build** → **Run workflow**.
2. **Download.** Open the finished run and download the **lumacue-firmware** artifact (a zip).
   Inside, each sketch has a folder (`/` written as `__`), e.g. `esp32__costume/costume.ino.merged.bin`.
   The job summary lists flash and RAM use per sketch.
3. **Flash** (Chrome or Edge, ESP32 on USB):
   - Open Espressif's web flasher: <https://espressif.github.io/esptool-js/>
   - **Connect**, pick the ESP32's COM port (if it won't connect: hold **BOOT**, press **EN/RST**, release BOOT).
   - Flash address **0x0**, file = the **`.merged.bin`** (bootloader + partitions + app in one) → **Program**.
   - Press **EN/RST**. In LumaCue Show Mode (or any serial monitor at 115200) you should see
     `LumaCue costume (ESP32, ESP-NOW)` and `Radio OK`.
4. Label each board (base / dancer number) as you flash it.

The browser flasher talks to the board through Chrome's Web Serial, so nothing new is installed or run on the laptop.

## Arduino IDE setup

1. *File → Preferences → Additional boards manager URLs:* `https://espressif.github.io/arduino-esp32/package_esp32_index.json`
2. *Boards Manager:* install **esp32 by Espressif Systems**.
3. *Library Manager:* install **FastLED**.
4. Board: **ESP32 Dev Module**. Upload `base.ino` to the base ESP32 and `costume.ino` to each costume.

## Wiring (costume)

| From | To |
|---|---|
| ESP32 GPIO 5 → ~330 Ω resistor | Strip DIN |
| 2S LiPo T-plug → 2S protection board (B+, B−; middle wire from the 3-pin balance lead to BM) | Battery in. Charge the pack **off the costume** on the balance charger |
| Protection board P+ → rocker switch → buck IN+ ; P− → buck IN− | Costume power switch (emergency cut-off) |
| Buck (5 V BEC) **5 V** out | Strip 5 V **and** ESP32 5V/VIN pin (check 5.0–5.2 V with a meter first) |
| Buck GND out | Strip GND **and** ESP32 GND (common ground) |
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
