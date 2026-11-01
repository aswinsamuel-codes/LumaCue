# Decision Log

Labels: **[Owner]** owner-provided · **[Agent-rec]** agent recommendation awaiting approval · **[Fact]** verified · **[Assumption]**

| # | Date | Decision / proposal | Status | Evidence | Alternatives | What would change it |
|---|---|---|---|---|---|---|
| 1 | 2026-10-29 | Build on the existing POV.STAGE React/TS code; no full rewrite | [Agent-rec] | `existing_software_assessment.md` — UI clean, `tsc` passes | Fresh rewrite | Owner prefers a different stack |
| 2 | 2026-10-29 | Do not extend the Raspberry Pi GPIO/IR path for costumes | [Agent-rec] | Defects D1–D4, D9 | Fix the IR encoding | Owner confirms the IR path targets a real use case |
| 3 | 2026-10-29 | Product name **LumaCue**, credit "Powered by Aswin Samuel"; UI renamed | [Owner] | Owner instruction | Nritya Light, Glowline, POV.STAGE | Trademark/domain conflict found |
| 4 | 2026-10-29 | Platform (desktop vs web) | **OPEN — owner decides after architecture review.** Agent leans to a local web app + Web Serial for December | `software_architecture.md` §5 | Web + Node bridge; desktop (Tauri/Electron) | Web Serial test result; need for client installers |
| 5 | 2026-10-29 | Leading costume architecture: ESP32 + addressable LEDs + locally stored timeline + common start trigger | [Assumption — to research] | Handoff §3B guidance | Central wireless streaming; EL wire | Bench timing/drift tests |
| 6 | 2026-10-29 | Constraints: ~10 dancers, event first week of Dec 2026, budget ₹20,000 for the show (owner's separate ₹2,300 of parts is personal and not counted); outfits paid separately by the team | [Owner] | Owner messages | — | — |
| 7 | 2026-10-29 | Don't buy more IR/TSOP/coin-cell parts; costumes need an MCU + LED strip + power bank | [Agent-rec] | `hardware_components_review.md` H1–H6 | Fix the IR design | Bench test showing IR is reliable and bright enough |
| 8 | 2026-10-29 | Costumes play stored shows; the laptop only uploads, arms and starts | [Agent-rec] | `software_architecture.md` §1 | Live streaming from the laptop | Sync tests |
| 9 | 2026-10-29 | Use the parts in hand for a sync bench prototype (2 Nanos + NRF24), not for the stage costumes | [Agent-rec] | `hardware_components_review.md` §3, §4 | Build costumes from IR parts | Owner decision |
| 10 | 2026-10-29 | Bench sync test: base owns the clock; one-way broadcast (no ACKs) of ARM, START ×3, 500 ms beacons, BLACKOUT; costume plays a stored show, eases its clock toward each beacon (jumps if off by >40 ms), keeps playing on link loss, joins late from a beacon | [Agent-rec] — firmware written, untested | `firmware/bench_sync_test/` | Base streams frames; two-way ACK protocol | T4–T8 results |
| 11 | 2026-10-30 | The laptop keeps the base's show clock on the music: base command `T<ms>` every 2 s ("Music sync", on by default); STATUS also reports `len=` | [Agent-rec] — simulated, base compiles; not run on hardware | Virtual bench (`lumacue/lib/sync/virtual-bench.ts`): 0.3 % base clock error → 536 ms off the music in 3 min without it, 5 ms with it | Trust the base clock; sync costumes to audio directly | Bench test T12 shows the base clock is within ~50 ppm (then sync is optional) |
| 12 | 2026-10-30 | Rehearsal start points: base command `S<ms>`; costumes join from the START packet, so the costume sketch is unchanged | [Agent-rec] — simulated, base compiles | Virtual bench: costumes join at 90 s within 5 ms | Separate rehearsal firmware | — |
| 13 | 2026-10-30 | Show sections = time ranges where chosen zones stay dark, exported as OFF cues last in the table | [Agent-rec] — owner's two-section idea (`handband_and_costume_layers.md`) | 100 % preview/costume match in tests | Separate shows per layer | Owner wants per-section effects, not just masks |
| 14 | 2026-10-30 | ESP32 + ESP-NOW sketches with the same show format, render code, sync logic and serial commands as the bench | [Agent-rec] — written, **not compiled** (toolchain didn't fit on the laptop's disk) | Contract tests hold the C functions identical to the bench ones | Write ESP32 code after the bench test | First compile / bench run on ESP32 |

## Change log
- 2026-10-29: Created the `led-dance-research/` folder and the first five documents. No source code was modified.
- 2026-10-29: UI renamed POV.STAGE → LumaCue with "Powered by Aswin Samuel" (TopBar, LoginPage, page title, logs, docs). Login code unchanged.
- 2026-10-29: Added `software_architecture.md` and `hardware_components_review.md`.
- 2026-10-29 (session 2): Added `firmware/bench_sync_test/` (base_station + test_costume sketches, shared 10-byte packet header, wiring/test README). Both compile for Nano (5 mm and WS2812B modes); not run on hardware.
- 2026-10-29 (session 2): App folder renamed `pov-stage/` → `lumacue/`. Package names and the Pi systemd service name (`pov-stage-hardware`) unchanged. Hand band and costume links now show real status and reconnect automatically; UI sends hardware zones as A/B/C (fixes D1, D6, D7).
- 2026-10-30 (autonomous session, branch `lumacue/autonomous-session`): decisions 11–14, plus the work listed in `autonomous_session_report.md`. Not pushed.
- 2026-11-01: Owner's open-source architecture brief (xLights / WLED / NTUEE LightDance) applied. **Kept cue tables** (owner's choice; no .fseq frame files). Added canvas effects RISE / SWEEP / RIPPLE using per-LED body positions (`PIX_POS`, filled from Costume Setup) in Studio, bench Nano and ESP32 firmware with identical integer maths; ESP32 costume split into a radio/state task on core 0 and a fixed-rate (10 ms) render task on core 1; clock snap threshold 40 → 20 ms in both costumes. ESP32 compile-check toolchain installed in `tools/arduino-esp32/` (out of git).
- 2026-11-01: Both Nanos damaged (seated wrongly in a breadboard, 5 V shorted to GND). Prototype moves to ESP32; purchase list in `prototype_purchase_list.md` (Robu prices checked 1 Nov 2026, not ordered).
