<p align="center">
  <img src="lumacue/public/lumacue-logo.svg" width="120" alt="LumaCue logo">
</p>

<h1 align="center">LumaCue</h1>

<p align="center">
  <strong>Open-source light shows for LED dance costumes.</strong><br>
  Design the show on a music timeline, preview it on a digital twin of every dancer,<br>
  generate the costume firmware, and run it live in sync with the music.
</p>

<p align="center">
  <a href="https://github.com/aswinsamuel-codes/LumaCue/actions/workflows/firmware.yml"><img alt="Firmware build" src="https://github.com/aswinsamuel-codes/LumaCue/actions/workflows/firmware.yml/badge.svg"></a>
  <img alt="Status" src="https://img.shields.io/badge/status-alpha-orange">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green">
  <img alt="Made with" src="https://img.shields.io/badge/Next.js-Arduino%20%7C%20ESP32-6E40C9">
</p>

---

## What it is

LumaCue is a complete toolchain for **synchronised LED costume shows**: a crew of dancers whose suits, hand bands and jackets light up exactly on the beat.

- **Show Studio** (web app): load a song, see its waveform, beat grid and energy sections, and draw light clips on a timeline for all dancers or one dancer at a time. **✨ Auto cues** writes a first draft from the music.
- **Digital twin:** previews every costume as the firmware will actually light it, before anything is flashed.
- **Firmware generator:** turns the show into Arduino sketches for every dancer, with a preflight report (cue budget, power draw, battery runtime, clips that will look different on the hardware).
- **Show Mode:** arms and starts the costumes over radio, keeps them locked to the music, and has instant BLACKOUT and rehearse-from-any-section.

**Costumes play the show from their own memory.** The laptop only starts them and nudges their clocks, so a radio drop or a laptop crash doesn't stop the show.

## How it works

```
 Song ──► Show Studio ──────────────► Costume firmware (.ino per dancer)
          timeline · auto cues            │  show compiled into flash
          digital twin · preflight        ▼
                                     Dancer costumes (Nano + NRF24  or  ESP32 + ESP-NOW)
 Show Mode ──USB──► Base station ──radio──►  ARM · START · time beacons · BLACKOUT
   music sync (every 2 s)                     each costume renders its own cues at 100 fps
```

| Piece | Hardware | Status |
|---|---|---|
| Bench prototype | Arduino Nano + NRF24L01+, 5 mm bi-colour LEDs or WS2812B | Compiles (5–13 KB flash). **Not yet run on real hardware** |
| Show costume | ESP32 + ESP-NOW, WS2812B strips, dual-core (radio on core 0, rendering on core 1) | Written and checked against the bench logic by tests. **Not yet compiled on hardware** |
| Show Studio | Any laptop, Chrome or Edge (Web Serial for USB) | Working, 170+ automated tests |

## Repository layout

| Folder | What's inside |
|---|---|
| [`lumacue/`](lumacue/README.md) | **Show Studio** (Next.js + TypeScript): timeline, twin, firmware export, Show Mode, tests |
| [`firmware/bench_sync_test/`](firmware/bench_sync_test/README.md) | Nano + NRF24 base station and test costume, wiring and bench test plan T1–T12 |
| [`firmware/esp32/`](firmware/esp32/README.md) | ESP32 + ESP-NOW base and costume firmware, and flashing from the browser |
| [`firmware/shows/`](firmware/shows/README.md) | Drop a downloaded show here and GitHub Actions compiles every costume's firmware |
| [`led-dance-research/`](led-dance-research/README.md) | Research, hardware review, decision log and session reports |

## Download

Get the desktop app from **[Releases](https://github.com/aswinsamuel-codes/LumaCue/releases)**: Windows `.exe`, Linux `.deb` / AppImage, or macOS `.dmg` (Intel and Apple Silicon). The installers are not code-signed yet. On Windows choose *More info → Run anyway*; on macOS right-click the app and choose *Open*.

Prefer Docker? `docker build -f lumacue/Dockerfile -t lumacue .` then `docker run -p 127.0.0.1:3000:3000 lumacue`, and open http://localhost:3000 in Chrome or Edge.

## Quick start (from source)

Requirements: Node.js 20+, Chrome or Edge (for USB to the base station).

```bash
git clone https://github.com/aswinsamuel-codes/LumaCue.git
cd LumaCue/lumacue
npm install
npm run dev            # open http://localhost:3000
```

1. **Costume setup:** pick a template (Bench test, Hand bands + jacket, Full suit…).
2. **Load music**, then press **✨ Auto cues**, and edit the clips on the timeline.
3. **Preview** on the digital twin, then **Costume firmware** downloads one dancer or all dancers.
4. Flash the sketches (Arduino IDE, or GitHub Actions plus browser flashing for ESP32).
5. **Show Mode:** CONNECT USB (or SIMULATE without hardware), then ARM, then START.

Full workflow: [`lumacue/README.md`](lumacue/README.md).

No hardware yet? **SIMULATE** in Show Mode runs a virtual base station and costumes, with realistic clock drift and packet loss.

## Testing

```bash
cd lumacue
npm test               # unit + integration tests (Vitest)
npm run check          # types + lint + tests
```

The tests keep the TypeScript twin and the C++ firmware in step: the costume renderer, sync state machine, serial commands and packet layout are checked against the `.ino` sketches, and a virtual bench simulates drift, packet loss and late joins.

## Roadmap

- [ ] First run on real hardware: bench test T1–T12, then a full costume
- [ ] First ESP32 compile and flash (CI build is ready)
- [ ] Live show with about 10 dancers (December 2026), then a demo video
- [x] Desktop app for Windows, Linux and macOS (v0.2.0)
- [ ] [PoseCue](https://github.com/aswinsamuel-codes/PoseCue): film a dancer and generate cues from their moves
- [ ] Signed radio packets, so other transmitters can't inject commands
- [ ] DMX / Art-Net output for stage lights

## Contributing

Issues and pull requests are welcome. Run `npm run check` before opening a pull request. If you change the costume firmware, change its TypeScript port in `lumacue/lib/show/bench.ts` too: the tests will tell you if they drift apart.

Security problems: please report them privately, as described in [SECURITY.md](lumacue/SECURITY.md).

## License

[MIT](LICENSE) © 2026 Aswin Samuel

Built on ideas from WLED, xLights and NTUEE LightDance.
