# LumaCue — LED dance show control

*Powered by Aswin Samuel*

LumaCue designs light shows for LED costumes on a music timeline, previews them on a digital twin of every dancer, writes the costume firmware, and runs the show. Costumes **play the show from their own memory**. The laptop only starts them and keeps them on the music, so a radio drop or a laptop crash doesn't stop the show.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000  (Chrome or Edge for USB to the base station)
```

On first start LumaCue asks you to **choose an access code** for the show laptop. Only a salted hash is stored, and there is no built-in default code. See [SECURITY.md](SECURITY.md).

### Desktop app (Windows)

LumaCue also runs as a native desktop app (Electron) with its own window, an animated splash screen, and a native USB-port picker for the base station.

```bash
npm run desktop          # build Show Studio, then open it as a desktop app
npm run desktop:dist     # build the Windows installer into dist-desktop/
```

The app starts Show Studio inside itself on `127.0.0.1` (never reachable from the network) and bundles the costume firmware, so **Costume firmware** downloads work offline. For live UI development, run `npm run dev` and then `npm run desktop:dev` in a second terminal.

## Workflow

| Step | Where | What |
|---|---|---|
| 1. Costume | Show Studio → **⚙ Costume setup** | Pick a **template** (Bench test, Hand bands + jacket, Full suit…) or set zones, LED counts and body positions. Set the brightness cap. It's saved in the browser and inside saved show files |
| 2. Music | **♪ Load music** | Waveform, beat grid and energy sections. **✨ Auto cues** writes a first draft from the beat. Palette **Bench 5 mm** uses only colours the red/green bench LEDs can show |
| 3. Edit | Timeline + Inspector | Clips on the *All costumes* track and on each dancer's track. Space plays, Ctrl+Z undoes, Ctrl+D duplicates. **Spread across dancers** turns a clip into a staggered copy per dancer (the hand-sweep look). **🎥 Video** plays a filmed rehearsal in step with the show |
| 4. Sections | **§ Sections** | Parts of the show where some zones stay dark, e.g. *Hands only*, then *Full costume* |
| 5. Check | Twin: **Preview → Costume: 5 mm → Costume: strip** | Shows what the bench firmware will really light |
| 6. Firmware | **→ Costume firmware** | Board: **Nano bench** (NRF24) or **ESP32** (ESP-NOW, not yet compiled). Preflight shows how closely costume and preview match, cue budget, clips that will look different, and power (avg/peak/mAh/bank runtime). Then download **one dancer** or **all dancers** as a zip of Arduino sketches. **Cue sheet** exports a printable CSV of every cue |
| 7. Upload | Arduino IDE | `base_station.ino` to the base Nano, `dancer_NN/test_costume/test_costume.ino` to each costume. See `../firmware/bench_sync_test/README.md` |
| 8. Run | **Show Mode** | **CONNECT USB** (or **SIMULATE** with no hardware) → ARM → START. The **Checklist** must be green. *Start from* a section for rehearsals. **Music sync** keeps the base on the song; set **Speaker delay** for the venue's sound system. RESTART needs a 1 s hold; BLACKOUT is instant. The *Costume firmware* panel shows which costumes need re-flashing |
| Bench | Show Mode → **Bench tests** | Log T1–T12 (and ESP32 E1–E5). With music sync off, Show Mode measures the base clock's drift in ppm for T12. *Copy results table* fills in the bench README |

**Save file / Open** writes and reads a `.lumacue.json` file: the show, its sections and the costume setup. Damaged files are repaired where possible and refused with a clear message otherwise.

## Tests

```bash
npm test             # unit + integration tests (Vitest)
npm run check        # types + lint + tests: run before every commit
```

- `tests/bench.test.ts` checks that the TypeScript port of the costume firmware (`lib/show/bench.ts`) still matches `test_costume.ino`. Change both together.
- `tests/virtual-bench.test.ts` simulates the base station and costumes (clock drift, packet loss, late join) with the firmware's sync logic (`lib/sync/virtual-bench.ts`).
- `tests/firmware-compile.test.ts` exports a 3-minute auto-cued show and compiles it for the Nano with `arduino-cli`. It runs only when the Arduino IDE 2 and the RF24 library are installed. The WS2812B build also needs FastLED (`ARDUINO_LIBRARIES=<folder with RF24 + FastLED>`).

## Layout

```
app/                 Next.js page + /api/firmware (serves the sketches in ../firmware)
components/          UI: timeline/ (Show Studio), showmode/, Hand Band dashboard
lib/show/            model + show-file parsing, render (preview), bench (firmware port,
                     export, preflight), analyze + autocue (music), templates
lib/sync/            virtual-bench (protocol simulator), simulated-base (SIMULATE button)
lib/base-station-serial.ts   Web Serial link to the base station
store/               Zustand stores: show, costume/base station, firmware downloads, dashboard
hardware/            older Raspberry Pi GPIO server for the Hand Band tab (legacy)
```

Research, decisions and session reports: `../led-dance-research/`.
