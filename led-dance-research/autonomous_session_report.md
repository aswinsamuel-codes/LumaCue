# Autonomous session report — software before hardware

**Date:** 30 Oct 2026, from 02:40 IST · **Branch:** `lumacue/autonomous-session` (local only, **not pushed**) · **Rollback tag:** `pre-autonomous-session` (= `905b7d1`)
**Brief from owner:** ~3 h of autonomous build → test → refine on the software side; keep a report; commit to local git; don't push until told.
**Status:** in progress. This file is updated as work lands.

## 0. How the work was checked

Every change went through the same loop: **build → `npm run check` (types + lint + tests) → browser smoke tests → commit**.
- **Tests:** 0 at the start, **89 now** (+1 that needs FastLED), all passing.
- **Firmware:** both sketches were compiled with the Arduino IDE's own `arduino-cli` after every firmware change, plus an end-to-end test that exports a 3-min show and compiles it.
- **UI:** checked in real Edge (headless Playwright) with 5 scripted walkthroughs and screenshots, including at 1366 × 768.
- **Not tested on hardware:** nothing has been run on a real Nano/radio. Simulations are labelled as such.

## 1. What changed, by area

### Firmware export: the costume now does what the preview shows
| Change | Why it mattered |
|---|---|
| `lib/show/bench.ts`: one compiler for the cue table, plus a line-by-line TypeScript port of the costume firmware's `render()` | The editor can show exactly what the Nano will light. Contract tests fail if the C and the port drift apart |
| Fade and rainbow play as colour steps. Wipe fills zone by zone. Chase runs per zone. FLASH/CHASE timing counts from the cue start | Before: fade was held as one colour, rainbow was **dropped**, wipe became a chase, and flash/chase were out of phase with the preview |
| Cues past the show end are trimmed. A clip aimed only at a zone the bench lacks is skipped | Before: such a clip lit the **whole** costume |
| **Firmware bug:** `NUM_CUES` was `uint8_t` | A show with more than 255 cues silently lost cues, and auto-cue makes 500+ for a 3-min song |
| Strip firmware takes **zone sizes** and **brightness** from Costume Setup | Before: it assumed 3 × 20 LEDs and a fixed 25 % brightness, so a 30/15/30 costume lit the wrong pixels and the app's brightness cap never reached the costume |
| Cue budget measured, not guessed | 13 bytes/cue. A 3-min auto-cued show: 5 mm build 43 % flash, WS2812B build 65 %. Colour steps widen automatically to fit |
| **All dancers** download: one zip with the base sketch + `dancer_01…NN` costume sketches | Was 10 separate downloads. The zip from the browser was unzipped and dancer 4's sketch was compiled |

### Sync: a risk found and fixed before hardware
| Finding | Detail |
|---|---|
| **Costumes followed the base station's clock, not the music** | The music plays on the laptop's clock. Simulated: a 0.3 % base clock error puts lights **~0.5 s off the music** over 3 min |
| Fix: base command `T<ms>` (music sync) | Show Mode sends the music position every 2 s and shows "base vs music ±X ms". Simulated: 536 ms → 5 ms error with 20 % packet loss |
| **Speaker delay** setting | Venue sound systems lag. START and sync are held back by this many ms so lights land on what the audience hears |
| `lib/sync/virtual-bench.ts` | Base + N costumes with the firmware's exact sync logic, clock drift, packet loss, late join and blackout. 9 protocol tests |

| Scenario (3 costumes at ±300 ppm, 3-min show, simulated) | Spread between costumes | Error vs music |
|---|---|---|
| Clean radio | 4 ms | 2 ms |
| 50 % packet loss | 5 ms | 3 ms |
| Radio dies at 1:00 | 74 ms | 37 ms |
| Beacons off | 108 ms | 54 ms |
| Base clock 0.3 % off, **no** music sync | 2 ms | **536 ms** |
| Base clock 0.3 % off, music sync, 20 % loss | 4 ms | 5 ms |

### Show Mode: safer on the night
- **Checklist:** base connected (USB / simulator / none), base firmware length = show length, every costume flashed with *this* show, music loaded, music sync, speaker delay, power.
- **START / BLACKOUT are pinned on screen.** On a 1366 × 768 laptop BLACKOUT was almost scrolled away.
- **RESTART needs a 1 s hold** during a show, because one stray click used to restart every costume. BLACKOUT stays instant.
- **Firmware check per dancer** (D1 ✓ / ! changed since download / – never), including LED type, zone sizes and brightness.
- **Base show-length check:** the base reports `len=` in STATUS. A mismatch is flagged, because the base would end the show early.
- **SIMULATE:** rehearse ARM / START / sync / BLACKOUT with no hardware.
- **Start from a section** (base `S<ms>`): rehearse from the drop. The costume sketch needs no change.

### Show Studio
- **Costume view:** the digital twin shows Preview → what the 5 mm LEDs will show → what the strip will show.
- **Preflight** in the firmware dialog: how closely the costume matches the preview, cue count vs budget, clips that will look different (click to jump). On 5 mm, the share of the show the LEDs can't colour.
- **Sections** (your *hand bands, then costume* idea): named time ranges where chosen zones stay dark. Quick add: Hands only / Costume only / Everything. Exported exactly; covered by undo.
- **Costume templates:** Bench test, Hand bands + jacket, Hand bands only, Full suit.
- **Bench 5 mm** auto-cue palette: red, green and yellow only, no rainbow.

### ESP32 costume + base (the planned final controller), ahead of the hardware
- `firmware/esp32/costume` and `firmware/esp32/base`: ESP-NOW broadcast instead of NRF24, WS2812B strip, 1 A current cap, BOOT button = START/BLACKOUT on the base.
- **Same show format, render code, sync state machine, serial commands and 10-byte packet as the bench.** Tests compare the C functions and fail if they drift, so the preview, preflight, simulator and Show Mode all apply unchanged.
- Show Studio's firmware dialog has a **Board** choice (Nano bench / ESP32). The download fills in the show, length, zone sizes and brightness. The firmware check records which board.
- **Not compiled and not run.** I started installing the ESP32 toolchain into the session scratch folder, but at ~6 GB it **filled the C: drive** (it was already ~98 % full). I deleted the download straight away (C: back to 5.9 GB free) and did not retry. The code is held to the bench sketches by tests; the first real compile may need small fixes. Setup, wiring, the 3.3 V → 5 V data caveat and tests E1–E5 are in `firmware/esp32/README.md`.

### Robustness
- **Show files are validated and repaired.** Before: a file with one bad clip was accepted and crashed the preview on every frame, and auto-save made it crash again on every reload. Tested with 200 rounds of random garbage.
- **Show files carry their costume setup**, so a show made on one laptop opens correctly on the venue laptop.
- **Costume setup is saved in the browser** (it reset to 3 × 20 on every reload).
- Lint is clean across the whole app. The README now has real run, workflow and test instructions.

### Performance (10 dancers × 154 LEDs, 178 clips)
Preview frame 0.27 ms · costume-view recompile ×10 3.9 ms · preflight 76 ms · song analysis 85 ms. No work needed.

## 2. What you need to do (owner)

1. **Upload both new sketches** before the bench test: the base needs them for music sync, start-from and the length report, and the costume needs them for the >255-cue fix and the timing match. The easiest route is Show Studio → *→ Costume firmware* → *All dancers*.
2. **On the 5 mm bench LEDs**, use the *Bench 5 mm* palette. 94 % of the starter show's lit time uses colours red/green LEDs can't make (cyan, purple, white).
3. **Run bench test T12** (new in `firmware/bench_sync_test/README.md`) to measure the real base clock against the music.
4. **At the venue**, measure the speaker delay: film a flash cue on a beat in slow motion.
5. Review this branch, then tell me when to push.

## 3. Problems I caused and fixed during the session
- **A failing test was committed once** (`91dcc76`), because my shell chain treated "grep found the failure line" as success. Fixed in `19ebda8`. All later commits ran through `npm run check` first.
- A regex was written with literal backspace characters by a shell escape and never matched. Caught by its test; edits now go through a helper that refuses control characters.
- **Duplicate React keys** in the new Show Mode "Start from" list. Caught by the browser tests and fixed in `c3f42a8`.

## 4. Still open / ideas for next
- **Compile the ESP32 sketches** once there is disk space for the esp32 core (or on another PC), then bench-test E1–E5.
- Desktop vs web decision (`software_architecture.md`). Everything built today works as a local web app in Chrome/Edge.
- Undo doesn't cover the show name, dancer count or length (it covers clips and sections).
- The costume can't report back to the laptop. The firmware check tracks *downloads*, not what is actually on the boards.

## 5. Commits
`git log --oneline pre-autonomous-session..lumacue/autonomous-session`
