# Software Gap Analysis — POV.STAGE vs. LED Dance Show-Control MVP

**Date:** 29 Oct 2026 · **Status:** Draft. The competitor columns are based on the agent's general knowledge and are **not yet verified** against current documentation. They will be re-checked during the software landscape research (`software_landscape_and_competitor_review.md`, not started).

Legend: ✅ present · ◐ partial · ❌ missing

## 1. Current code vs. MVP features (handoff §2A)

| # | MVP feature | POV.STAGE today | Gap |
|---|---|---|---|
| 1 | Show/project management (save, reopen, duplicate, versioned file) | ❌ no persistence | New project model + file format |
| 2 | Audio timeline, waveform, scrub, markers | ❌ | New audio/timeline engine |
| 3 | Dancers → zones → LED ranges | ◐ flat zone list, no dancers, no LED counts | Extend model |
| 4 | Timeline editor (tracks, cues, drag/resize, snap to markers, zoom) | ❌ | New, largest piece of work |
| 5 | Effect library with brightness limits | ◐ Static/Pulse/Flash; colour→brightness only | Real RGB effects; shared engine for preview and firmware |
| 6 | Costume preview | ◐ glow dot per zone | Body-outline preview per dancer |
| 7 | Device setup (IDs, firmware version, assignment) | ◐ one WS endpoint, fixed 3 pins | Device manager |
| 8 | Export / transfer / verify to wearable | ❌ | Show compiler + upload + checksum |
| 9 | Sync start, armed/ready state, blackout, recovery | ◐ "Sync all" restarts intervals; emergency off over Wi-Fi | Sync protocol + local failsafe on costume |
| 10 | Preflight checks | ❌ | New |
| 11 | Logs and diagnostics | ✅ in-memory log, server log broadcast | Persist logs; timing diagnostics |
| 12 | Show mode vs. edit mode, guarded controls, shortcuts | ❌ single mode | New |

## 2. Benchmarks (to be verified)

| Capability | Vixen Lights | xLights | WLED | Opportunity for LumaCue |
|---|---|---|---|---|
| Music timeline + cues | Yes | Yes | No (live presets/playlists) | Dance-specific: tracks per dancer/body zone, choreography markers |
| Pixel/zone mapping | Yes | Yes, strong | Segments | Body-zone templates instead of generic pixel props |
| Preview | Yes | Yes (2D/3D) | Live only | Costume-silhouette preview |
| Wearable, battery, untethered playback | Not the focus | Not the focus (xLights FSEQ can play from SD on some controllers) | Runs on ESP32 but live/network-driven | **Main gap:** compile show to each costume, start together, battery preflight |
| Ease for non-experts | Steep | Steep | Easy, but no timeline | Simple workflow for choreographers |

**Takeaway:** existing tools are built for houses and fixed stage props. The gap is wearable-specific: per-dancer upload, a synchronized start, battery and fail-safe handling, and a body-zone editing model.

## 3. Platform decision input

The current app is a Next.js web app. The MVP needs local audio files, USB/serial access to controllers, offline use and project files on disk. Options to compare in `software_architecture.md`:
- **Keep React/TypeScript UI, wrap in Tauri or Electron** — reuses existing components and gives file/serial access. *(Agent's leading option, not yet decided.)*
- Web-only (Web Serial / File System Access APIs) — works only in Chromium-based browsers; weaker offline packaging.
- Native rewrite — throws away the existing UI; not justified at this stage.
