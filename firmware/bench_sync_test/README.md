# LumaCue bench sync test (Nano + NRF24)

Powered by Aswin Samuel · bench v1 · 29 Oct 2026

**Goal:** prove the LumaCue sync model on the bench with parts already in hand. One Nano is the **base**: it owns the show clock and sends ARM, START, time beacons and BLACKOUT. The other Nano is a **test costume**: it plays a stored 30 s show and keeps playing if the base is unplugged.

**Status:** both sketches compile for the Arduino Nano (arduino-cli, AVR core 1.8.7, RF24 1.6.0, FastLED 3.10.6). **They have not been run on hardware yet.** Everything below about timing is what the test is meant to measure, not a result.

| Sketch | Flash | RAM |
|---|---|---|
| `base_station` | 5.4 KB (17 %) | 323 B (15 %) |
| `test_costume`, 5 mm mode | 6.1 KB (19 %) | 278 B (13 %) |
| `test_costume`, WS2812B mode | 12.8 KB (41 %) | 718 B (35 %) |

## 1. Software setup

1. Arduino IDE 2 → **Library Manager**: install **RF24** (by TMRh20, 1.6.x) and, for the strip, **FastLED**.
2. Board: **Arduino Nano**. Processor: **ATmega328P (Old Bootloader)** for most CH340 clones. If the upload fails with `not in sync`, try plain **ATmega328P**.
3. CH340 driver: Windows 11 usually installs it automatically. If no COM port appears, install the CH340 driver from the board seller's page.
4. **Possible build problem on this PC:** your sketchbook is under `OneDrive\文档\Arduino`. When compiling from the command line, the compiler couldn't open `RF24.h` from that path (`fatal error: RF24.h: No such file or directory`), most likely because of the non-ASCII folder name. If the IDE shows the same error, set **File → Preferences → Sketchbook location** to an ASCII path such as `C:\Arduino`, then reinstall the libraries.
5. Upload `base_station/` to Nano #1 and `test_costume/` to Nano #2. Label the boards.
6. To use a WS2812B strip, change one line at the top of `test_costume.ino`:
   ```cpp
   #define OUTPUT_MODE MODE_STRIP
   ```

## 2. Wiring

### NRF24L01+PA+LNA (same on both Nanos)

Plug the radio into its adapter board. Wire the adapter to the Nano:

| Adapter pin | Nano pin |
|---|---|
| VCC | **5V** (the adapter regulates down to 3.3 V) |
| GND | GND |
| CE | D9 |
| CSN | D10 |
| SCK | D13 |
| MOSI | D11 |
| MISO | D12 |
| IRQ | not connected |

- **Check your adapter first.** If it's marked 3.3 V input only, don't feed it 5 V, and don't power a PA+LNA module from the Nano's 3V3 pin either (on CH340 Nanos that pin can't supply enough current). Ask before improvising.
- Put a **10 µF or 100 µF** capacitor across the adapter's VCC and GND, close to the adapter. Mind the polarity: the stripe is −.
- Keep the two radios **at least 1 m apart**. The sketches use `RF24_PA_LOW`; at full power, PA+LNA modules can overload each other at short range.
- D13 is the SPI clock, so the Nano's built-in LED flickers. That's normal; the sketches don't use it.

### Base station extras

| Part | Wiring |
|---|---|
| Reference LED (any 5 mm LED, e.g. the red die of one XL-A524) | D3 → 220 Ω → LED anode, cathode → GND |
| Optional START/BLACKOUT button | D2 → button → GND (internal pull-up, no resistor needed) |

### Test costume, 5 mm mode (`MODE_5MM`)

Three XL-A524 bi-colour LEDs, one per zone. They're **common cathode**: the middle (longest) leg is usually the cathode. **Confirm with a multimeter's diode test before wiring.**

| Zone | Red anode | Green anode | Cathode |
|---|---|---|---|
| A | D3 → 220 Ω | D4 → 220 Ω | GND |
| B | D5 → 220 Ω | D6 → 220 Ω | GND |
| C | D7 → 220 Ω | D8 → 220 Ω | GND |

Each die gets its own 220 Ω resistor. At 5 V that's roughly 13 mA per die. This is an estimate: the LED's forward voltage isn't on the parts list. That's within the Nano's 20 mA per-pin rating, so no 2N2222 is needed. Colours: red, green, and yellow (both dies on).

### Test costume, WS2812B mode (`MODE_STRIP`)

Default settings: 1 m of 60 LED/m, three zones of 20 LEDs (A = 0–19, B = 20–39, C = 40–59), brightness 25 %, and FastLED limits the strip to 500 mA.

| Connection | Wiring |
|---|---|
| Data | Nano **D6 → 220 Ω → strip DIN**, resistor close to the strip |
| Strip power | Strip **5V and GND from the power bank** (cut USB cable or USB breakout), **not** from the Nano's 5V pin |
| Ground | Strip GND **must also connect to Nano GND** (common ground) |
| Capacitor | **100 µF** across the strip's 5V/GND at the input |
| Nano power | USB from the laptop (for the serial log) or a second USB port on the power bank |

Note the arrow on the strip: data must go **into** DIN, not DOUT. The Nano is 5 V logic, so no level shifter is needed here. The later ESP32 is 3.3 V and may need one.

### Power rules

- Power everything from **USB or a power bank**. **Don't use the CR2032 cells.** They can't supply the radio or the LEDs.
- Don't leave the strip at full white. 60 LEDs can draw about 3.6 A at full white, which is beyond what a Nano or a thin jumper wire can handle.
- Unplug the power before rewiring.

## 3. Using it

Open the Serial Monitor for **each** Nano at **115200 baud**, line ending **Newline**. Two IDE windows or two serial monitors work; each Nano has its own COM port.

Base commands:

| Type | Does |
|---|---|
| `a` or `ARM` | Arms costumes for show 1. The costume's zone A blinks yellow for 0.6 s and logs `ARMED` |
| `s` or `START` | Starts the show. START is sent 3 times, 20 ms apart |
| `b` or `BLACKOUT` | All off, show stopped |
| `n` or `BEACONS` | Turns time beacons on/off (drift test) |
| `?` or `STATUS` | Prints state |
| `T<ms>` (e.g. `T60000`) | Music sync: "the laptop's music is at <ms>". Re-anchors the show clock to the music and prints `sync err_ms=<how far off the base was>`. LumaCue Show Mode sends it every 2 s while running ("Music sync" checkbox) |

The demo show (30 s, stored on the costume):

| Time | What you see |
|---|---|
| 0–2 s | Dark |
| 2–6 s | All zones red |
| 6–10 s | A red, B green, C yellow |
| **10–20 s** | **Sync section:** all zones flash yellow at 1 Hz, in phase with the base's reference LED |
| 20–26 s | Green chase (over 3 LEDs, or along the strip) |
| 26–28 s | Fast red flash (4 Hz) |
| 28–30 s | Dark, then the show ends |

The costume prints a line at every beacon:

```
beacon t=10500 err_ms=2 rx=24 dropped~0
```

`err_ms` is how far the costume's clock was from the base clock when the beacon arrived. Positive means the costume is ahead. The costume corrects itself after every beacon.

## 4. Test procedure

Record results in the table in section 5. Don't skip a failed test; write down what happened.

| # | Test | How | Pass if |
|---|---|---|---|
| T1 | Radio check | Power both. Read the serial logs | Both print `Radio OK` |
| T2 | Arm | Type `a` | Costume logs `ARMED`, zone A blinks |
| T3 | Start + play | Type `s` | Costume logs `START run 1 at t=0..40`, plays the show as in the table, then `show ended` |
| T4 | Beacon error | Note `err_ms` during T3 | Settles within ±5 ms |
| T5 | **Sync on video** | During the 10–20 s section, film the base reference LED and the costume LEDs together with phone slow motion (240 fps if available). Count the frames between the base LED and the costume turning on | Offset ≤ 20 ms (≤ 5 frames at 240 fps) |
| T6 | Free-running drift | Start, then type `n` straight away (beacons off). At ~25 s, type `n` again | The first `err_ms` after turning beacons back on is the drift over that time. Record it. Above ~50 ms over 25 s, the clocks need regular beacons. Very large values point to a ceramic-resonator clone or FastLED losing time (strip mode) |
| T7 | Link loss | Start, then unplug the base's USB at ~8 s | Costume logs `link lost - continuing on local clock` and finishes the show alone |
| T8 | Late join | Unplug the costume's power. Start the show. Plug the costume back in at ~5 s | Costume logs `LATE JOIN` within ~0.5 s and joins at the right point in the show |
| T9 | Blackout | Start, type `b` at ~12 s | Costume goes dark immediately and stays dark |
| T10 | Range | Repeat T3 at 5 m, 10 m and 20 m, with bodies between the radios | `dropped~` stays low and the show still starts. Note the distance where it fails |
| T11 | Strip mode | Repeat T3–T6 with `MODE_STRIP` and 1 m of WS2812B | Same pass criteria. Check the strip and wires aren't hot |
| T12 | Base clock vs music | Load a 3-min song in LumaCue, START from Show Mode with **Music sync off**, then STATUS (`?`) at the end and compare `t=` with the music time; repeat with Music sync **on** and read "base vs music" in Show Mode | Off: note the drift (this is the base resonator error, expected up to ~0.5 %). On: readout stays within ±20 ms |

## 5. Results

| # | Date | Mode | Result | Numbers / notes |
|---|---|---|---|---|
| T1 | | | | |
| T2 | | | | |
| T3 | | | | |
| T4 | | | | |
| T5 | | | | |
| T6 | | | | |
| T7 | | | | |
| T8 | | | | |
| T9 | | | | |
| T10 | | | | |
| T11 | | | | |
| T12 | | | | |

## 6. Troubleshooting

| Symptom | Likely cause |
|---|---|
| `ERROR: NRF24 not found` (base ref LED / costume zone A blinks fast) | Wiring (CE/CSN swapped), no 5 V at the adapter, loose jumper. Check the capacitor |
| Radio OK but the costume never hears anything | Radios too close (move ≥1 m apart), different `LUMACUE_CHANNEL`, or the two `lumacue_protocol.h` copies differ |
| Works close, fails farther away | PA+LNA modules are sensitive to supply noise: add the 100 µF cap and try a USB power bank instead of the laptop port |
| `ignored: base wants show X` | `SHOW_ID` differs between the sketches |
| Strip shows random colours | No common ground, missing 220 Ω data resistor, or data going into DOUT instead of DIN |
| Strip shows the wrong colours | Change `GRB` in `FastLED.addLeds` to `RGB` |

## 7. How this maps to the real system

| Bench | Final costume (planned, not yet tested) |
|---|---|
| Nano | ESP32 (more RAM; shows uploaded instead of compiled in) |
| NRF24, one-way broadcast | ESP-NOW broadcast; NRF24 stays as the backup radio |
| Show in `PROGMEM` | Show file uploaded from LumaCue with a CRC check |
| Serial Monitor commands | LumaCue sends the same `ARM` / `START` / `BLACKOUT` lines over USB serial (Web Serial or a bridge) |
| 3 zones | 2–4 zones per costume |

The radio packet format (`lumacue_protocol.h`, 10 bytes) is packed and little-endian so the ESP32 version can use it unchanged. Both sketch folders hold a copy of the header and **they must stay identical**.
