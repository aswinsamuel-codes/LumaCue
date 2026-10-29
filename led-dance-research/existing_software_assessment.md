# Existing Software Assessment — POV.STAGE

**Assessed:** 29 Oct 2026 · **Commit:** `c6bd069` (branch `main`, clean tree)
**Scope:** everything tracked under `pov-stage/` except `node_modules`. All statements below come from reading the source; anything not verified on hardware is labelled.

## 1. Summary

POV.STAGE is a **live, manual lighting-control dashboard** (web UI) plus a **Raspberry Pi WebSocket server** intended to drive three IR-LED transmitters from GPIO pins. It is well-styled and the UI code is clean, but it is architecturally a *remote control panel*, not a *time-based show editor*, and its hardware layer targets a tethered Pi rather than wearable costumes. Roughly 25–35 % of the code (UI shell, color tooling, log panel, WebSocket client patterns, emergency-off concept) is reusable for the LED dance show editor; the data model and hardware layer need replacing.

## 2. Stack and structure

| Area | Detail |
|---|---|
| Frontend | Next.js 16.2.1 (App Router), React 19.2.4, TypeScript 5, Tailwind CSS 4, Zustand 5 (state), react-colorful (picker), framer-motion (listed, not seen in use) |
| Hardware server | Node.js (CommonJS), `ws` 8, `dotenv`, optional `pigpio` 3 (Raspberry Pi only), `nodemon` dev |
| Licence | Hardware `package.json` declares MIT; no `LICENSE` file at repo root. Frontend is `private: true` with no licence. **Owner should decide and add a licence file.** |
| Size | ~1,100 lines of app/hardware code; ~1,000 lines of docs |

```
pov-stage/
  app/page.tsx, layout.tsx, globals.css      single-page dashboard
  components/  TopBar, ZoneCard, ColorPanel, PresetPanel,
               GlobalControlBar, LogPanel, LoginPage
  store/useDashboardStore.ts                 all state + actions (Zustand)
  lib/websocket-client.ts                    reconnecting WS client singleton
  hardware/server.js                         WS server → GPIOController
  hardware/gpio-controller.js                pigpio, zones A/B/C on BCM 17/27/22
  hardware/mock-server.js                    GPIO-free simulator for Windows/Mac
  hardware/logger.js                         coloured console logger
  hardware/test-server.js                    EMPTY (0 bytes)
  FEATURES.md, PROJECT_REPORT.md, hardware/README.md, INSTALLATION.md
```

## 3. How to run (verified commands from package.json)

```bash
# frontend (http://localhost:3000)
cd pov-stage && npm install && npm run dev
# simulator (ws://localhost:8080) — any OS
cd pov-stage/hardware && npm install && npm test
# real server — Raspberry Pi with pigpiod running
cd pov-stage/hardware && npm start
```

Frontend URL to hardware is `NEXT_PUBLIC_WS_URL` (default `ws://localhost:8080`). Login access code is hard-coded in `components/LoginPage.tsx`.

**Checks run on 29 Oct 2026:** `npx tsc --noEmit` → passes. `npx eslint .` → 9 errors, 7 warnings (`require()` in `hardware/*.js` linted by the frontend config; two `any` types; unused `error` vars). **No automated tests exist.** Not run on a Raspberry Pi; hardware behaviour is unverified.

## 4. Implemented capabilities

| Feature | State |
|---|---|
| Zones: add, delete, on/off, mode (Static/Pulse/Flash), speed 0–100, apply colour | Works in UI; sent to hardware over WS |
| Colour picker, hex input, quick colours, favourites | Works (UI only) |
| Presets: named colour steps with ms durations + loop flag | Create/edit/delete work; **▶ Run only writes a log line — nothing plays** |
| Global: Apply to all, Sync all, Emergency OFF | Work in UI; sent to hardware |
| System log (200 entries, colour-coded) | Works; also receives server log broadcasts |
| Login screen | Client-side check only; not real security |
| WebSocket client | Auto-reconnect (5 tries, 3 s), 30 s ping, silent failure |
| Mock server | Simulates commands and broadcasts logs |

## 5. Defects and risks found

| # | Finding | Evidence | Impact |
|---|---|---|---|
| D1 | **Zone-ID mismatch with real hardware.** UI sends `zone: "Zone A"`; `GPIOController` keys zones `A`/`B`/`C`, so every command would fail with `Invalid zone: Zone A`. The mock server keys by `"Zone A"`, hiding the bug. | `useDashboardStore.ts` `sendToHardware({ zone: zone.name … })`; `gpio-controller.js` `config = { A, B, C }` | Real hardware path cannot work as written |
| D2 | **IR output is not a real IR protocol.** `pwmWrite(dutyCycle)` sets PWM duty from colour brightness; the 38 kHz carrier (`irFrequency`) is read but never applied, and no remote-control encoding (e.g. NEC) is sent. IR receivers on RGB lights would not respond. | `gpio-controller.js` lines 18, 133–176 | Hardware layer would not control IR-receiver lights |
| D3 | Colour reduced to one brightness value; no RGB per channel. | `colorToBrightness()` | Cannot drive coloured LEDs |
| D4 | Patterns use `setInterval` on a Pi over Wi-Fi WebSocket — live streaming of state, no timeline, no clock sync. | `applyPulsePattern`, `applyFlashPattern` | Unsuitable for choreography-accurate timing |
| D5 | Dynamically added zones have no hardware mapping. | `addZone` vs fixed GPIO config | Silent mismatch |
| D6 | "CONNECTED" badge is a manual toggle unrelated to the real `hardwareConnected` state. | `TopBar.tsx` | Operator could believe hardware is live when it is not — show-safety issue |
| D7 | WS failures are swallowed silently; commands sent while disconnected are dropped with no warning. | `websocket-client.ts` `send()` returns false, ignored | Operator gets no feedback |
| D8 | No persistence: zones, presets, favourites are lost on reload. | Store has no storage | No "show project" exists |
| D9 | Emergency OFF depends on the UI → Wi-Fi → Pi chain. | `emergencyOff` | Not a valid sole emergency cutoff for wearables |
| D10 | `hardware/node_modules` committed to git; `test-server.js` empty; no LICENSE; README is the create-next-app default. | git tree | Hygiene |

## 6. What to keep, refactor, drop

**Keep (reuse in the show editor)**
- Visual language / Tailwind theme, `LogPanel`, `ColorPanel` (picker, favourites).
- Zustand as the state layer; the reconnecting WS client pattern (needs error surfacing).
- Concepts: zones, emergency-off, mock hardware server for development, structured log messages.
- The preset step model (`{color, duration}`) as a seed for the "custom colour sequence" effect.

**Refactor**
- Data model → versioned show project: dancers → zones → LED ranges; cues on a timeline; audio reference and markers.
- Hardware protocol → device-oriented (controller ID, firmware version, upload show, arm, start-at-time, blackout), not per-zone live commands.
- Connection status → driven by real heartbeat; visible failure states.
- Lint config → separate config for `hardware/` (CommonJS) or convert to ESM.

**Drop / do not build further**
- Raspberry Pi GPIO / IR transmitter path for costumes (D2–D4, D9). A Pi might survive as an optional "show base station", but not as the per-dancer controller.
- Client-side password screen (replace with nothing for an offline desktop tool, or real auth only if a networked mode needs it).
- FEATURES.md items that conflict with the brief for v1: cloud features, voice control, VR/AR, Hue/LIFX, audio-reactive as the sync mechanism.

## 7. Open questions for the owner

1. Was the IR-transmitter hardware ever tested? What lights were the IR LEDs meant to control?
2. Why the name "POV" — persistence-of-vision (spinning LED) effects, or "point of view"? This changes hardware scope.
3. Is the GitHub repo `aswinsamuel-codes/pov.stage` (referenced in `hardware/README.md`) the canonical copy, and is it public?
4. Is a web UI (Next.js) a requirement, or is a desktop app acceptable? (See `software_gap_analysis.md`.)
