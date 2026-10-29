# Owner Suggestions and Requirements

**Status:** PENDING INPUT — the owner's suggestions and refinements have not been supplied yet.
**Working product name:** **LumaCue** — confirmed by owner 29 Oct 2026, with the credit line "Powered by Aswin Samuel".

Nothing below is invented on the owner's behalf. Section 1 records only what exists in writing in the repo (`lumacue/FEATURES.md`), which may be older ideas rather than current intent.

## 1. Ideas already written in the repo (owner to confirm still wanted)

| ID | Idea (from FEATURES.md) | Fit with LED dance brief | Agent note |
|---|---|---|---|
| F-01 | Timeline / sequencer, keyframes, multi-zone choreography, export/import | **Core MVP** | Becomes the centre of the product |
| F-02 | Scene management | Partial | Useful as reusable "looks" placed on the timeline |
| F-03 | Advanced effects: strobe, rainbow, chase, fades, custom builder | **MVP subset** | Chase, fade, flash, gradient, custom sequence in v1 |
| F-04 | Keyboard shortcuts (Space = emergency off) | **MVP** (show mode) | Space for blackout is risky — accidental press; propose a guarded key |
| F-05 | Export/import presets as JSON, backup/restore | **MVP** | Becomes the versioned show-file format |
| F-06 | Audio-reactive mode / beat detection | Later | Beat *markers* help authoring; live audio-reactive is not reliable sync |
| F-07 | DMX / Art-Net | Later | Stage lights, not costumes |
| F-08 | Power-consumption estimates | **MVP** (preflight) | Battery check per cue sheet |
| F-09 | Cloud, multi-venue, voice, VR/AR, Hue/LIFX, AI colour | Out of scope v1 | Offline-first is a requirement |
| F-10 | Undo/redo | **MVP** | Needed for any timeline editor |

## 2. Owner suggestions (to be filled in)

Template for each suggestion supplied by the owner:

| Field | Value |
|---|---|
| ID | O-xx |
| Suggestion (owner's words) | |
| Intended user benefit | |
| Priority (Must / Should / Could / Won't-v1) | |
| Implementation implications | |
| Dependencies | |
| Acceptance criteria | |
| Trade-offs / concerns | |
| Status | Proposed / Approved / Deferred |

### O-01 — Costume made of separate garments (2026-10-29)

| Field | Value |
|---|---|
| Suggestion (owner's words, paraphrased) | Future costumes will be built from separate pieces: pants, shirt, hat, shoes, even specs (glasses), so the lighting in the digital twin will differ per piece |
| Intended user benefit | Program and preview each garment separately (e.g. only shoes on a footwork beat, only specs in a dark section) |
| Priority | Should (after the December show) |
| Implementation implications | Digital twin needs garment-based placements and silhouettes (`lumacue/lib/show/body.ts`); zones grouped by garment; clips target garments as well as zones; each garment may need its own small controller/battery or a connector to a shared one; firmware export per garment/controller |
| Dependencies | Final costume hardware design (one controller per dancer vs per garment) |
| Acceptance criteria | Owner can define a dancer's garments, see each one lit separately in the twin, and target cues at a garment |
| Trade-offs / concerns | More controllers per dancer raises cost, weight and sync points; wired garments need detachable connectors |
| Status | Noted for future — design to stay compatible |

## 3. Questions to the owner

1. Please list your suggestions and refinements — anything you'd change in the current dashboard or want in the new app.
2. Are the FEATURES.md ideas still current, or were they brainstorming?
3. Who operates the show on the day — you, a choreographer, or the client's own team?
