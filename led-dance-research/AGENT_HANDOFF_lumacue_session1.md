# Agent Handoff — LumaCue (LED Dance Show System) · Session 1 Summary

**Prepared:** 29 Oct 2026 · **For:** a new Claude session continuing this project
**Owner:** Aswin Samuel (git user "Aswin Samuel"). Casual, short messages; prefers clear, direct answers with tables. Uses Windows 11, works in VS Code / Claude desktop app.
**Original brief:** `led_dance_system_agent_handoff (1).md` (owner's Downloads folder). Please ask the owner to attach it too. It defines the full mission: research, prototype and cost an original LED-costume dance system inspired by the *visual approach* of Light Balance (**do not claim to copy their system**), plus build our own show-control software. It also sets rules: cite sources, never fabricate prices, label estimates, no purchases or vendor contact without approval, no breaking code changes without a git checkpoint.

---

## 1. Project in one paragraph

**LumaCue** (owner-confirmed name, always shown with **"Powered by Aswin Samuel"**) is software + hardware for ~10 dancers wearing LED costumes, synced to music, for an event in the **first week of December 2026**. The software lets you create cues on a timeline, sync the costumes and run the show. Budget: **₹20,000** for the show. Outfits are paid separately by the team. The owner's earlier ₹2,300 of parts is a **personal purchase and NOT counted** against the ₹20,000.

## 2. Where everything is

- Repo: `D:\MY works\Hello World\pov.stage` (git, branch `main`, last commit `c6bd069`). Remote referenced in docs: `github.com/aswinsamuel-codes/pov.stage`.
- App code: `pov-stage/` (Next.js 16.2.1, React 19, TypeScript, Tailwind 4, Zustand 5, react-colorful).
- Hardware server: `pov-stage/hardware/` (Node.js `ws`, `pigpio` for Raspberry Pi GPIO → IR LEDs; `mock-server.js` simulator).
- Research docs created this session: `led-dance-research/`
  - `README.md` — index and status
  - `existing_software_assessment.md` — full code review, defects D1–D10
  - `owner_suggestions_and_requirements.md` — **pending owner input**
  - `software_gap_analysis.md` — current code vs MVP; Vixen/xLights/WLED comparison (**from memory, unverified**)
  - `software_change_plan.md` — staged plan (Stage 0 hygiene → Stage 6 sync/show mode)
  - `software_architecture.md` — module design, sync protocol, **desktop vs web comparison (decision OPEN)**
  - `hardware_components_review.md` — review of the owner's parts + budget check
  - `decision_log.md` — decisions 1–9 + change log

**⚠ Nothing has been committed.** The working tree has uncommitted changes (rename + the new `led-dance-research/` folder). Ask the owner before committing. If the new session runs on another machine or account, the owner must push or copy the repo, including uncommitted files.

## 3. Run / check commands

```bash
cd pov-stage && npm install && npm run dev        # UI on http://localhost:3000
cd pov-stage/hardware && npm install && npm test  # mock hardware ws://localhost:8080
npx tsc --noEmit    # passes
npx eslint .        # 9 errors, 7 warnings (pre-existing: require() in hardware/*.js, 2× any, unused vars)
```
The login access code is hard-coded in `pov-stage/components/LoginPage.tsx` (client-side only). There are no automated tests.

## 4. Existing code — key findings (verified by reading the source)

It's a live manual control dashboard, **not** a timeline show editor. Reusable: UI theme, LogPanel, ColorPanel, Zustand store, WS client pattern, emergency-off concept, mock server.
Defects:
- **D1** UI sends `zone: "Zone A"`, but `gpio-controller.js` keys zones `A/B/C`, so the real hardware would reject every command (the mock server hides this).
- **D2** The IR output isn't a real IR protocol: the 38 kHz `irFrequency` is never applied and nothing is encoded.
- **D3** Colour is reduced to one brightness value.
- **D4** Patterns are `setInterval` over Wi-Fi; there's no timeline.
- **D5** Added zones have no hardware mapping.
- **D6** The "CONNECTED" badge is a manual toggle, not the real status.
- **D7** WS send failures are silent.
- **D8** No persistence.
- **D9** Emergency-off depends on Wi-Fi.
- **D10** `hardware/node_modules` is committed; `test-server.js` is empty; there's no LICENSE.

## 5. Changes made this session

- Renamed the UI **POV.STAGE → LumaCue**: `app/layout.tsx` (title + description "LED dance show control — powered by Aswin Samuel"), `components/TopBar.tsx` (logo "L", "LumaCue", "LED SHOW CONTROL v1.0 · Powered by Aswin Samuel"), `components/LoginPage.tsx` (logo, "LED DANCE SHOW CONTROL", footer "Powered by Aswin Samuel"), `components/LogPanel.tsx`, log strings in the store, server and mock server, the WS client comment, `hardware/package.json` (author "Aswin Samuel"), and doc titles. Not changed: package names, repo URLs/paths, login code.
- Created all files in `led-dance-research/`.
- `tsc` passes after the rename. **The renamed UI hasn't been viewed in a browser.**

## 6. Owner answers so far

| Topic | Answer |
|---|---|
| Name | LumaCue, "Powered by Aswin Samuel" |
| Dancers | ~10 |
| Event | First week of December 2026 |
| Budget | ₹20,000 for the show; ₹2,300 of parts is personal and separate |
| Outfits | Not brought by dancers; extra cost managed by the team (outside the ₹20k) |
| Hardware tested? | No, the IR/Pi hardware was never tested |
| Platform | Owner wants to **review the architecture first, then decide desktop vs web** |
| Order of work | Asked whether software or hardware comes first. Agent answered: **hardware bench first** (1–2 days, parts in hand), then software |
| WS2812B | Owner expects to use WS2812B in the final costumes and asked about using it in testing. Agent said yes: buy 1 m (60 LED/m) now; start with the existing LEDs meanwhile |

Still unanswered: the owner's own suggestions/refinements; what "POV" originally meant; whether a Chrome/Edge laptop will be at the venue; whether clients will install LumaCue themselves later.

## 7. Owner's parts in hand (from `PR.docx`, ₹2,300, Robu + Quartz)

1 kΩ resistors ×10 · 220 Ω resistors ×10 packs · 100 µF 35 V caps ×10 · 10 µF caps ×10 · XL-A524 5 mm **red/yellow-green bi-colour** LEDs (common cathode, 20 mA — **not RGB**) ×10 · 2N2222A ×10 · CR2032 cells (2 packs of 5) + holders with switch + sockets · slide switches ×10 · 24 AWG silicone wire · M-F jumpers · TSOP1838 IR receivers ×10 · 5 mm IR LEDs ×10 · 170-pt mini breadboards ×5 · **NRF24L01+PA+LNA ×5 + 3.3 V adapters ×5** · **Arduino Nano (CH340) ×2 + cables**.

Agent assessment:
- **Not usable for stage costumes.** The 5 mm LEDs are too dim, a CR2032 can't supply the current, a TSOP1838 can't hold an LED on (AGC suppresses a continuous carrier), IR needs line of sight, and there's no MCU per costume. Don't buy more IR/TSOP/coin-cell parts.
- **Good for the bench sync prototype:** Nano + NRF24 as base (sends START) and Nano + NRF24 as test costume (plays a timed 3-zone LED sequence; keeps playing if the base is unplugged). Power from USB / power bank, never the coin cells. Capacitors go on the NRF24 power and strip input.

## 8. Recommended architecture (agent recommendation, not yet tested)

- **Costumes play stored shows locally.** The laptop only uploads, ARMs and STARTs, plus time beacons. If the radio or laptop fails, costumes keep playing. Each costume also has a physical power switch as the real emergency cutoff.
- **Final per-costume kit:** small ESP32 board + WS2812B strip (~1–1.5 m, 2–4 zones) + 5,000 mAh USB power bank + diffusion + inline switch. **Base:** 1 ESP32 on USB to the laptop, using ESP-NOW broadcast. NRF24 is the backup radio.
- **Sync protocol draft:** upload with CRC → ARM (show ID/version/battery) → START ×3 → beacons every 500 ms → continue on link loss → join late from a beacon → broadcast BLACKOUT. Provisional target ±20 ms between costumes, to be validated with slow-motion phone video.
- **Platform options** (owner to decide):
  - **A.** Local web app in Chrome/Edge + Web Serial. Agent's lean for December: fastest, reuses all the Next.js code.
  - **B.** Web app + local Node serial bridge.
  - **C.** Desktop app (Tauri/Electron). +1–2 weeks.
- **Show file:** versioned JSON `ShowProject` (audio ref, markers, dancers → zones → LED ranges, cues `{target,startMs,durationMs,effect,params}`).

## 9. Budget model (estimates, **prices NOT verified**)

₹20,000 − base station ~₹400 − contingency ~₹2,000 → ~₹17,600 for 11 kits (10 + 1 spare) ≈ **₹1,600 per kit**.
Per-kit estimate ranges:
- ESP32: ₹250–450
- 1–1.5 m LED strip: ₹400–900
- Power bank: ₹450–800
- Diffusion, wire, switch, mounting: ₹200–450

Power: 60 LEDs at full white is ~3.6 A, so cap brightness in firmware to ≤ ~1 A. A 5,000 mAh bank gives ~2.5–3 h. Risk: some power banks auto-shut-off at low draw during blackouts.

**Next research task:** verify current prices on robu.in / quartzcomponents.com, recording URL, date and price for each item, as the brief requires.

## 10. Schedule (~4.5 weeks to the event)

| By | Milestone |
|---|---|
| ~5 Nov | Bench sync test with the parts in hand; order **1–2 kits only** (+ 1 m WS2812B for testing) |
| ~12 Nov | One costume playing a stored show started from LumaCue → **go/no-go** on ordering 8–9 more kits |
| ~22 Nov | All 10 built; two-costume sync measured |
| Last week of Nov | Full rehearsals; spare kit ready |

Fallback if the 12 Nov go/no-go fails: preset effects stored on each costume, started together, without the full editor.

## 11. Immediate next steps (in order)

1. **Write the Nano + NRF24 sync test firmware and wiring notes.** The agent offered this last; the owner hasn't answered yet. Make it work with both the existing 5 mm LEDs and a WS2812B strip (compile-time switch), 3 zones, effects blackout/solid/flash/chase. Use the RF24 and FastLED (or Adafruit NeoPixel) libraries.
   - WS2812B wiring: Nano D6 → 220 Ω → DIN; strip powered from a power bank, not the Nano's 5V pin; common ground; 100 µF across the strip input; brightness 20–30 %.
   - Note: the Nano has 2 KB RAM. ESP32 is 3.3 V logic, so a level shifter may be needed later.
2. Owner decides desktop vs web after reviewing `software_architecture.md` §5.
3. Verify parts prices and build `bom_and_cost_estimate.csv`.
4. Software Stage 0–2 from `software_change_plan.md` (hygiene, fix D1/D6/D7, versioned project file), then the timeline editor.
5. Collect the owner's suggestions into `owner_suggestions_and_requirements.md`.

Not yet created (from the original brief): research_report, technical_design, prototype_build_plan, show_programming_workflow, market_validation_and_business_model, risk_register, software_product_requirements, software_landscape_and_competitor_review, software_mvp_roadmap, software_test_plan, wireframe, final decision memo.

## 12. Rules to keep following

- Separate verified facts from estimates; never invent prices, links or test results.
- No purchases, vendor contact or publishing without the owner's explicit OK.
- Tag a git checkpoint before larger code changes (`software_change_plan.md` suggests `git tag pre-lumacue-baseline c6bd069`); ask before committing.
- Safety: bench-test power before anything goes on a dancer; no raw LiPo handling (use protected power banks); recommend a qualified electronics review before a public show.
