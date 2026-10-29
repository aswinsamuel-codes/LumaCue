# Review of the Owner's Component List (PR.docx)

**Source:** owner's `PR.docx` (29 Oct 2026). 20 line items from robu.in and quartzcomponents.com, total **₹2,300** (prices as listed by the owner; the listings themselves have not been re-checked).
**Status:** no components tested. The analysis below is engineering reasoning plus typical datasheet values. Each claim is marked with how sure it is.

## 1. What the list implies

The parts describe an **IR-broadcast design**: a transmitter (Pi or Nano + 2N2222 + 5 mm IR LEDs) floods the stage with 38 kHz IR; each costume has a **TSOP1838 IR receiver** switching **5 mm red/green LEDs** through a **2N2222**, powered by a **CR2032 coin cell** with a slide switch. A second option is **NRF24L01+PA+LNA radios** (5) driven by **Arduino Nanos** (2).

## 2. Problems for a 10-dancer stage show

| # | Issue | Why | Confidence |
|---|---|---|---|
| H1 | **Too dim for stage outlines** | 5 mm indicator LEDs (20 mA, 50 mW) look like small dots, not glowing body lines. A few per costume won't read from the audience | High |
| H2 | **CR2032 can't supply the current** | A coin cell (~220 mAh) is rated for very low current. 10 LEDs × 20 mA = 200 mA is far beyond what it can deliver; voltage collapses and the cell heats | High (typical CR2032 datasheets) |
| H3 | **TSOP1838 won't hold an LED on** | IR receivers are designed for short coded bursts; their automatic gain control suppresses a continuous 38 kHz signal, so "IR on = LED on" flickers or drops out. A microcontroller must decode a protocol | High |
| H4 | **IR is line-of-sight** | When a dancer turns away or is blocked by another dancer, the cue is missed; stage lights also emit IR noise | High |
| H5 | **No microcontroller per costume** | 2 Nanos for 10 dancers → no stored timeline, no individual addressing, no zones | Certain (from the list) |
| H6 | **Colours limited to red / yellow-green** | Bi-colour LED, not RGB | Certain |

**Conclusion:** the IR + coin-cell approach can't deliver a reliable, visible 10-dancer show. **Don't buy more** IR LEDs, TSOP receivers, coin cells or coin-cell holders.

## 3. What is still useful

| Parts | Use |
|---|---|
| Arduino Nanos, breadboards, jumper wires | Bench experiments, learning, test jigs |
| NRF24L01+PA+LNA + adapters | Backup radio link if ESP-NOW fails in testing |
| 100 µF / 10 µF capacitors | Smoothing on LED-strip power input and the base station |
| 1 kΩ / 220 Ω resistors | ~300–470 Ω is the usual series resistor on the LED-strip data line; 220 Ω is usable on the bench |
| 2N2222 | Small loads only (≤ ~500 mA); a logic-level MOSFET is better for LED strips |
| 24 AWG silicone wire | Costume wiring (flexible). Check the current rating for each run |
| Slide switches | Only for signal or low current. **Not** for switching LED-strip power (they're rated for small currents) |

## 4. Recommended direction (to confirm after the architecture review)

**Per costume:** small ESP32 board (built-in radio → ESP-NOW; enough memory for a stored show) + addressable LED strip (WS2812B-type, ~1–1.5 m in 2–4 zones) + a 5 V USB power bank (it already has charge protection, so no raw lithium cells to handle) + diffusion (silicone channel or fabric) + an inline power switch.
**Shared:** 1 ESP32 base station on USB to the laptop + 1–2 spare costume kits.

### Budget check (owner-confirmed 29 Oct 2026)

The show budget is the full **₹20,000**. The owner's ₹2,300 of parts is a personal purchase and is not counted. Outfits are paid separately by the team.

| Use | ₹ (estimate) |
|---|---|
| Base station (ESP32 + cable) | ~400 |
| Contingency, ~10% (breakages, shipping, a failed part) | ~2,000 |
| Left for 11 costume kits (10 + 1 spare) | ~17,600 → **≈ ₹1,600 per kit** |

Workable with a lean kit (about 1–1.5 m of LEDs, small ESP32, 5,000 mAh power bank). It needs a price check before ordering.

Rough per-costume ranges below are **engineering estimates and have not been checked against current listings**. Verifying them on Robu/Quartz is the next step.

| Item | Est. ₹ per costume |
|---|---|
| ESP32 board | 250–450 |
| LED strip 1–1.5 m | 400–900 |
| Power bank 5,000 mAh | 450–800 |
| Diffusion, wire, connectors, switch, mounting | 200–450 |
| **Per costume** | **~1,300–2,600** |

10 costumes ≈ ₹13,000–26,000, plus base station and spares. **₹20,000 only works at the lower end**: about 1 m of LEDs per dancer, 30–60 LEDs/m, and black garments supplied by the dancers. If ₹2,300 has already been spent and counts against the ₹20,000, the room is tighter still.

**Power sanity check (estimate):** 60 LEDs at full white can draw ~3.6 A, which is more than a typical 2 A power bank output. The firmware therefore caps brightness so the draw stays ≤ ~1 A. At ~1 A, a 5,000 mAh bank (≈ 3,000 mAh usable at 5 V) gives roughly 2.5–3 h, which covers rehearsal plus show. Known risk: some power banks switch themselves off at very low draw (during long blackouts). Test the chosen model on the bench.

## 5. Schedule reality (first week of December)

That's ~4.5 weeks away, and Robu/Quartz shipping is typically several days.
- **By ~5 Nov:** order **1–2 costume kits only** + the base station. Start the software timeline.
- **By ~12 Nov:** one working costume playing a stored show, started from LumaCue. **Go / no-go** on ordering the other 8–9 kits.
- **By ~22 Nov:** all 10 built; two-costume sync measured.
- **Last week of Nov:** full rehearsals with dancers; spare kit ready.

If the go/no-go on 12 Nov fails, the fallback is a simpler show: preset effects stored on each costume, started together, without the full editor.
