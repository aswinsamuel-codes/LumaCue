# Hand bands + costumes: two show layers in LumaCue

**Status:** idea for owner review · **Date:** 29 Oct 2026 · Powered by Aswin Samuel
**Trigger:** the owner's friend shared Light Dance Pro (LDP). The owner wants a show with **two sections: one for hand bands, one for costumes**.

## 1. What Light Dance Pro is (read 29 Oct 2026)

Sources: lightdancepro.com/studio/ and lightdancepro.com/blog/how-to-light-dance/. Facts below come from those pages; their own marketing claims are marked.

| Item | What the pages say |
|---|---|
| LDP Studio | Free during public beta, runs in the browser (Mac/Windows/Chromebook), no install. Drag-and-drop timeline, 3D preview of costumes and props, AI "co-pilot" that generates sequences from text, community gallery. Has a sign-in and cloud projects |
| Fixture library | Ready pixel maps for LDP's own products ("Use this costume"), so no manual addressing |
| Hardware | LDP sells its own suits, props, controllers. Suits use WS2812 5 V strips, a 12 V battery with a 5 V converter, and an LDP wireless controller. A front-of-house operator fires a master start cue and can adjust brightness/speed live |
| Programming (blog) | The blog's workflow uses **Vixen Lights** (free, open source) against the audio waveform |
| Prices (blog, USD) | Suit $750+ (controller included), wireless transmitter $580, battery box $69, 4-dancer kit ~$3,500–4,500 |
| **Not stated** | Export formats, API, whether shows are stored on the suit or streamed, radio type, offline use, price after beta. **Hand bands are not mentioned** |

**What this means for us**

- **We can't plug LumaCue into LDP Studio.** No export, import or API is documented, and Studio is tied to LDP hardware. We shouldn't claim compatibility.
- **LDP hardware doesn't fit the budget.** One LDP suit (~$750) costs about 3× our whole ₹20,000 budget. Currency conversion is approximate and the price is unverified.
- **Their workflow confirms our plan.** LDP's description matches what we're already building: WS2812 strips, a wireless master start, shows programmed on a music timeline, and rehearsals filmed as a timing reference.
- **Worth borrowing as ideas (not copying):**
  - Ready-made device templates ("Hand band", "Costume") instead of manual LED mapping.
  - A preview of all dancers together.
  - The rehearsal-video track.
  - Possibly text-to-effect assistance later.

## 2. The idea: one show, two layers, any number of sections

In LumaCue, every dancer can carry **two kinds of device**:

| Layer | Device | LEDs (proposal) | Zones |
|---|---|---|---|
| **Hand bands** | Left + right wrist band | ~10–15 WS2812B each | `L-hand`, `R-hand` |
| **Costume** | Body suit / jacket | ~60–90 WS2812B | 2–4 (e.g. arms, chest, legs) |

The timeline gets **one lane group per layer**, so you can program hands and costume separately. **Sections** are named time ranges, each saying which layers are live:

```
0:00 ─────── 1:30 ─────────────── 3:00 ─── 3:30
│ Section 1 "Hands"│ Section 2 "Costume"   │ Finale │
│ hands: ON        │ hands: off / accent   │ both   │
│ costume: dark    │ costume: ON           │        │
```

This gives the classic effect: a dark stage with only hands glowing, then the full costumes light up.

### Hardware options for the hand bands

| Option | How | Cost per dancer (estimate, **unverified**) | Pros | Cons |
|---|---|---|---|---|
| **A. Wired to the costume controller** (recommended if the same dancers wear both) | Hand bands are extra zones on the costume's ESP32: a thin 3-wire cable runs down each sleeve to a small plug at the wrist | ~₹100–250 (LEDs, cable, connectors) | Cheapest. One controller, one battery. Hands and body are automatically in sync | Cable down each sleeve. Bands can't be used without the costume |
| **B. Standalone wireless bands** | Each band has its own tiny ESP32-C3 + LEDs + small power bank | ~₹700–1,000 per band → ×2 per dancer | Can be worn without the costume, or by different performers | 20 extra radios and batteries for 10 dancers; **likely breaks the ₹20,000 budget** together with the costumes |
| **C. Hand bands only** (no costumes) | Same as B, but no costume kits at all | As B | Simple show | Loses the costume section |

**Recommendation:** use **Option A** if the same dancers wear the hand bands and the costumes. Both sections then run on the same kit, and Section 1 just keeps the costume zones dark. This adds roughly ₹1,000–2,500 for 10 dancers. That's an estimate: prices need to be checked on Robu/Quartz.

## 3. What changes in LumaCue

| Part | Change |
|---|---|
| Show file (`ShowProject`) | `deviceTemplates` (`handBand`, `costume`: LED count, zones). Each dancer lists their devices. New `sections[]`: `{name, startMs, endMs, layers: {hands, costume}}` |
| Timeline UI | Lane groups "Hand bands" and "Costumes" (collapsible). A section bar above the timeline. Filter: "show only hand-band lanes" |
| Effects | Same effect set (solid, flash, chase, …). Add a **"hand sweep"** (chase from L-hand to R-hand across dancers), which is cheap and looks good |
| Upload | Each device gets **only its own compiled cues**, so hand-band data isn't sent to costumes and vice versa (needed for Option B, harmless for A) |
| Show mode | Per-layer **BLACKOUT** buttons ("hands off", "costumes off") as well as the full blackout |
| Radio protocol | v2: add a `groupMask` byte so ARM/BLACKOUT can target hands or costumes. START/beacons stay global so everything shares one clock |
| Extra import option (later) | Import sequences from **Vixen Lights / xLights** (the tools LDP's blog uses) as an alternative to programming in LumaCue. Their export formats still need checking; this is **not** an LDP Studio import |

### Bench test link

The current bench firmware (`firmware/bench_sync_test/`) already has 3 zones. For a quick demo, **zone A = hand band** and **B + C = costume**. Section 1 lights only zone A; Section 2 lights B + C. Two cue lines in the demo show can prove this without new hardware.

## 4. Questions for the owner

1. **Same dancers for both sections?** If yes, use Option A (wired, cheap). If not, we need B and the budget changes.
2. Does your friend **own LDP hardware**, or did they only share the website?
3. How long is each section, roughly (e.g. 1:30 hands + 2:00 costume)?
4. Hand bands on **both wrists**, or one?
