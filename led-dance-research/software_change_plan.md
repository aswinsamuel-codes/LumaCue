# Software Change Plan

**Status:** Proposed — nothing in `pov-stage/` has been changed. Each stage needs owner approval before it starts.
**Principle:** keep what works, change in small verifiable steps, add tests as you go, and connect hardware only after the software path works with the simulator.

## Checkpoint before any change
- Tag the current state: `git tag pre-lumacue-baseline c6bd069` (rollback = check out the tag).
- Do all work on a feature branch (`lumacue/…`) and merge only after review.

## Stage 0 — Hygiene (low risk, ~0.5 day)
1. Remove `hardware/node_modules` from git; add it to `.gitignore`.
2. Give `hardware/` its own ESLint config (CommonJS) so `npm run lint` passes; fix the two `any` types.
3. Replace the default README with real run instructions; add a LICENSE once the owner chooses one.
4. Delete the empty `test-server.js`, or fill it in.
**Test:** `tsc` and `eslint` both report 0 errors.

## Stage 1 — Fix live-control correctness (~1 day)
1. D1: send a stable `zoneId` instead of the display name; make the mock server and the real server use the same keys.
2. D6/D7: drive the status badge from the real heartbeat; show a visible warning when a command is dropped.
3. Add Vitest; unit-test the store actions and the WS message handling against the mock server.
**Test:** contract test proving the mock server and the GPIO controller accept the same command set.

## Stage 2 — Project model and file format (~3–4 days)
- `ShowProject v1` JSON: `{schemaVersion, meta, audio:{path,hash,durationMs}, markers[], dancers[{id,name,controllerId,zones[{id,name,ledStart,ledCount,order}]}], cues[{id,target,startMs,durationMs,effect,params}]}`.
- Validation with a schema (e.g. zod) plus migration hooks.
- Save / open / duplicate.
**Test:** round-trip save→load is identical; corrupted or old files give a clear error, not a crash.

## Stage 3 — Desktop shell + audio timeline (~1–2 weeks)
- Wrap the existing UI in a desktop shell (Tauri or Electron — decision recorded in `decision_log.md`).
- Audio load, waveform, play/scrub, markers; tracks per dancer/zone; add/move/resize/delete cues; snap; zoom; undo/redo.
**Test:** cue time accuracy against the audio clock; keyboard-shortcut tests.

## Stage 4 — Shared effect engine + preview (~1 week)
- One pure function `render(project, tMs) → frame` used by both the preview and the exporter, with golden-frame tests.
- Effects: blackout, solid, fade, flash, chase, gradient, alternating zones, custom sequence; global brightness cap.

## Stage 5 — Export + first real controller (after bench hardware exists)
- Compile cues to a compact binary or JSON per controller; transfer over USB serial first; verify with a checksum.
- ESP32 firmware plays the timeline from local storage; on loss of link it keeps playing or blacks out (configurable).
**Test:** vertical slice — 2 dancers × 3 zones in the editor, one real controller, a 2–3 min sequence without tether, safe stop.

## Stage 6 — Two-controller sync, show mode, preflight
- Armed → countdown → start trigger; measure drift with photodiodes or high-speed video; show-mode UI with guarded stop.

## Not touched until approved
- The Raspberry Pi GPIO/IR layer is kept as-is (still used by the current dashboard) and is not extended.
- No hardware purchases, vendor contact or publishing.
