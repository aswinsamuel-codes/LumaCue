# Changelog

All notable changes to LumaCue. Versions follow [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-11-23 (first public release, alpha)

The first open-source release of LumaCue.

### Show Studio
- Music timeline with waveform, beat grid and energy sections; **✨ Auto cues** drafts a show from the music (calm / balanced / energetic).
- Clips on an *All costumes* track and on each dancer's track: undo, duplicate, and **Spread across dancers** for staggered hand-sweep looks.
- Costume setup with templates (Bench test, Hand bands + jacket, Full suit), body zones, LED counts and brightness cap.
- **Sections:** parts of the show where some zones stay dark.
- Canvas effects (rise, sweep, ripple), drawn LED lines and a **3D digital twin** of every dancer.
- Rehearsal video playback in step with the show; YouTube as a music source through the official IFrame player.
- `.lumacue.json` save and open, with repair of damaged files.

### Firmware
- **Bench prototype** (Arduino Nano + NRF24L01+): base station and test costume, 5 mm bi-colour or WS2812B output, bench test plan T1–T12.
- **ESP32 + ESP-NOW** base and costume: dual-core (radio on core 0, rendering at 100 fps on core 1), 1 A current limit. Written, not yet compiled on hardware.
- Firmware generator: one dancer or all dancers as a zip, with preflight (cue budget, fidelity, power and battery runtime) and a printable cue sheet.
- GitHub Actions **Firmware build** compiles any show dropped into `firmware/shows/`; flash ESP32 boards from the browser.

### Show Mode
- CONNECT USB (Web Serial) or **SIMULATE** with a virtual base station and costumes.
- ARM, START, RESTART (1 s hold), instant BLACKOUT, start from any section.
- **Music sync** re-anchors the show clock every 2 s, with a speaker-delay setting for the venue's sound system.
- Pre-show checklist and bench-test logger, including clock-drift measurement in ppm.

### Quality
- 170+ Vitest tests, including a TypeScript port of the costume firmware checked against the `.ino` sketches and a virtual bench simulating drift, packet loss and late joins.

### Known limitations
- **Not yet run on real hardware.** The bench sketches compile, but bench tests T1–T12 are still to be done.
- The ESP32 firmware has not been compiled on a device yet (the CI build is ready).
- The radio link between base station and costumes is not authenticated.
- The login screen uses a fixed access code checked in the browser. It is replaced by a hashed, user-chosen code in the upcoming desktop release.

[0.1.0]: https://github.com/aswinsamuel-codes/LumaCue/releases/tag/v0.1.0
