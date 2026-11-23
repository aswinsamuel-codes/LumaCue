# LumaCue prototype purchase list (ESP32 + WS2812B + 2S LiPo)

**Updated:** 4 Nov 2026 · Powered by Aswin Samuel
**Builds:** **1 base station + 2 test costumes** (+ 1 spare ESP32 and 1 spare battery set). Enough to run the full LumaCue system (Show Studio → firmware → Show Mode → ESP-NOW radio → LEDs) and measure sync, power and battery life before ordering the other 8 costumes.
**Owner's decisions (4 Nov):** power from a **2S 7.4 V 850 mAh LiPo + 5 V buck converter** (not power banks, not 1S + boost); **5 × 7 cm double-sided universal PCB**, soldered (no breadboards); **22 AWG silicone wire**, soldered (no jumper wires: they work loose while dancing).

**Prices:** read from robu.in in a browser on **4 Nov 2026** (items 1–6 and 16 on 1 Nov), **including GST**, **shipping not included**. Prices and stock change; check the cart and the pack size on each product page.

## Power for each costume

```
2S LiPo 7.4 V ─T-plug─► 2S protection board ─► rocker switch ─► 5 V BEC buck ─► strip 5V + ESP32 VIN
   └─ 3-pin balance lead: middle wire to the protection board;                └──── common GND ────┘
      charging is OFF the costume with a 2S balance charger (not in this list)
```

- **Buck converter** steps 7.4 V down to a **fixed 5 V** (no adjustment knob to mis-set), efficiently and cool.
- **Protection board** cuts the power if a cell drops to 2.5–3.0 V or the wiring shorts (the drone pack itself has no protection).
- **Low battery:** the buck stops at about **7.0 V in (3.5 V per cell)**, so the costume goes dark before the cells are deeply discharged. **Switch the costume off straight after each run**; the protection board is the backstop.
- **Charging:** unplug the pack and charge it on a **2S LiPo balance charger**, which keeps both cells equal. The charger is **not in this list** (owner's decision, 4 Nov): use one you already have or arrange one before the packs arrive, because the packs can't be charged without it. In-costume USB-C 2S chargers don't balance the cells, so they aren't used.

## A. Must buy (all from robu.in)

| # | Item (as listed) | Qty | Unit | Line total | Link | Notes |
|---|---|---|---|---|---|---|
| 1 | 30Pin CH9102X ESP-32 WiFi+Bluetooth Development Board, Type-C USB | 4 | ₹448 | ₹1,792 | [robu.in](https://robu.in/product/30pin-ch9102x-esp-32-wifibluetooth-development-board-with-type-c-usb-interface/) | Base + 2 costumes + 1 spare. Windows may need the WCH CH9102/CH343 driver |
| 2 | 1M WS2812B 5V Addressable RGB Non-Waterproof LED Strip, 60 LED/m | 3 | ₹489 | ₹1,467 | [robu.in](https://robu.in/product/1m-ws2812b-5v-addressable-rgb-non-waterproof-led-strip-light-60leds-m/) | 1 m per costume + 1 m bench |
| 3 | ACEBOTT USB Type-C Cable 1m Fast Charging/Data Transfer | 3 | ₹87 | ₹261 | [robu.in](https://robu.in/product/type-c-usb-cable/) | Flashing the ESP32s; the base station runs on it |
| 4 | SN74AHCT125N (Texas Instruments), DIP-14 | 3 | ₹93 | ₹279 | [robu.in](https://robu.in/product/sn74ahct125n-texas-instruments-8ma-1-4-5v5-5v-8ma-4-dip-14-buffers-drivers-receivers-transceivers-rohs/) | 3.3 V → 5 V data level shifter, through-hole |
| 5 | 1000uF 25V Electrolytic Capacitor DIP | 1 listing | ₹12 | ₹12 | [robu.in](https://robu.in/product/1000uf-25v-electrolytic-capacitor-dip-pack-of-5/) | URL says pack of 5 — need 4. Check the pack size |
| 6 | 3 Pin JST XH 2.54mm Pitch Plug and Socket with Cable (pack of 1) | 10 | ₹13 | ₹130 | [robu.in](https://robu.in/product/3-pin-jst-xh-2-54mm-pitch-plug-and-socket-with-cable-10-pcs/) | Strip ↔ PCB plugs (2 per costume) and the battery's balance plug → protection board (1 per costume) |
| 7 | **Pro-Range 7.4V 850mAh 30C 2S Lithium Polymer Battery Pack** | 3 | ₹999 | ₹2,997 | [robu.in](https://robu.in/product/orange-850mah-2s-30c-60c-lithium-polymer-battery-pack-lipo/) | 2 costumes + 1 spare. 50 g, T-connector + 3-pin balance lead |
| 8 | **Ultra-Small DC-DC 5V 3A BEC Buck Step Down Module** | 3 | ₹106 | ₹318 | [robu.in](https://robu.in/product/ultra-small-size-dc-dc-5v-3a-bec-power-supply-buck-step-down-module/) | Fixed 5 V, input 7–26 V, 3 A max / **1.6 A continuous**, over-current + over-temperature protection |
| 9 | Amass Nylon T Style Gold Plated Battery Connector **Pair** (male + female) with Housing Cap | 3 | ₹37 | ₹111 | [robu.in](https://robu.in/product/amass-nylon-t-style-gold-plated-battery-connector-pair-with-housing-cap-am-1015e-fgr-and-am-1015e-mgr/) | Male on the costume (mates with the pack's T plug); female for a spare/extension lead |
| 10 | 2S 10A 18650 7.4V-8.4V Lithium Battery Protection Board | 3 | ₹79 | ₹237 | [robu.in](https://robu.in/product/2s-8a-18650-7-4v-8-4v-lithium-battery-protection-board/) | Over-discharge (2.5–3.0 V/cell) and short-circuit cut-off |
| 11 | KCD11 2 Pin SPST Mini Boat Rocker Switch, 3A (Pack of 10) | 1 pack | ₹69 | ₹69 | [robu.in](https://robu.in/product/kcd11-ac-250v-3a-2-pin-spst-snap-in-mini-boat-rocker-switch/) | Costume power switch (= emergency cut-off), between protection board and buck |
| 12 | 22AWG High Voltage Silicone Wire — **Red** (1 qty = 1 m) | 5 | ₹26 | ₹130 | [robu.in](https://robu.in/product/22awg-high-voltage-silicone-wire-3000v-red/) | 5 V and battery + runs |
| 13 | 22AWG High Voltage Silicone Wire — **Black** (1 qty = 1 m) | 5 | ₹26 | ₹130 | [robu.in](https://robu.in/product/22awg-high-voltage-silicone-wire-3000v-black/) | GND runs |
| 14 | 22AWG High Quality Ultra Flexible Silicone Wire — **Yellow** | 5 | ₹25 | ₹125 | [robu.in](https://robu.in/product/high-quality-ultra-flexible-22awg-silicone-wire-1000m-yellow/) | Data line. Check the length per unit |
| 15 | 530PCS Boxed Color Heat Shrink Tube Combo | 1 | ₹319 | ₹319 | [robu.in](https://robu.in/product/heat-shrink-tube-kit-combo-heat-shrink-tubes/) | Every solder joint |
| 16 | 5 x 7 cm Universal PCB Prototype Board Double-Side – 2pcs | 2 packs | ₹66 | ₹132 | [robu.in](https://robu.in/product/57-cm-universal-pcb-prototype-board-double-sided/) | 4 boards: base + 2 costumes + 1 spare. The ESP32 is soldered straight onto the board (no header) |
| | **Total** | | | **₹8,509** | | + shipping |

**Removed (owner's requests):** power banks, breadboards, jumper wires, USB-A breakouts, the 1S parts (1S LiPo, TP4056, XL3608 boost) and the IMAX B3 balance charger (₹349). The USB current tester moved to *nice to have*: the costumes no longer run from USB.

## Per-costume kit (one dancer)

| Part | Qty | Unit | Cost | Job |
|---|---|---|---|---|
| ESP32 30-pin dev board, USB-C | 1 | ₹448 | ₹448 | Brain + ESP-NOW radio |
| WS2812B strip, 60 LED/m | 1 m | ₹489 | ₹489 | The lights (cut into zones) |
| SN74AHCT125N level shifter (DIP-14) | 1 | ₹93 | ₹93 | 3.3 V → 5 V data |
| 1000 µF 25 V capacitor | 1 | ~₹2 | ~₹2 | Across the strip's 5 V input |
| 3-pin JST XH plug + socket | 3 | ₹13 | ₹39 | 2 strip plugs + 1 balance plug |
| **2S 7.4 V 850 mAh 30C LiPo** | 1 | ₹999 | ₹999 | Battery |
| **5 V 3A BEC buck** | 1 | ₹106 | ₹106 | 7.4 V → 5 V |
| T-plug pair (male + female) | 1 | ₹37 | ₹37 | Battery plug: male on the costume, female spare |
| 2S protection board | 1 | ₹79 | ₹79 | Over-discharge + short-circuit cut-off |
| KCD11 rocker switch | 1 | ~₹7 | ~₹7 | Power switch / emergency cut-off |
| 22 AWG silicone wire (red, black, yellow) | 1 m each | ₹25–26 | ₹77 | Power and data runs |
| 5 × 7 cm double-sided PCB | 1 | ~₹33 | ~₹33 | Mounts the electronics |
| Heat shrink (from the kit) | a few | — | ~₹15 | Insulate joints |
| **Per costume** | | | **≈ ₹2,424** | |

Shared, not per costume: a **2S balance charger (not in this list)**, USB-C cable, heat-shrink kit, tools, and the **base station** (ESP32 + PCB, ≈ ₹481; it runs from the laptop's USB, no battery or strip).

## Runtime and the 10-costume budget (estimates)

- **Runtime:** 850 mAh × 7.4 V ≈ 6.3 Wh. Through a ~90 % buck that's ≈ 1.1 A·h at 5 V, so **≈ 2 h at ~0.45 A** average (ESP32 + 60 LEDs at the 25 % cap), a little less because the buck stops at 3.5 V per cell. Measure it (test E4) before relying on it.
- **Ten costumes:** 10 × ₹2,424 + base ₹481 ≈ **₹24,700 + shipping**, about **₹4,700 over** the ₹20,000 show budget. Ways to close the gap, to decide after the prototypes: a bigger budget, fewer LEDs per costume, or the cheaper 1S setup for some costumes. A single-port balance charger takes roughly an hour per 850 mAh pack, so 10 packs need charging time planned.

## B. Tools — required (soldered PCB and wiring)

| Item | Why | Search |
|---|---|---|
| **Soldering iron kit** (adjustable, ~60 W) + solder + flux | PCB, connectors, wires, battery plugs | [robu.in search](https://robu.in/?s=soldering+iron+kit&post_type=product) |
| **Digital multimeter** with continuity beep | 5 V ↔ GND beep test, check the buck reads 5 V, battery voltage | [robu.in search](https://robu.in/?s=digital+multimeter&post_type=product) |
| Wire stripper / cutter | Clean silicone-wire ends | [robu.in search](https://robu.in/?s=wire+stripper&post_type=product) |
| LiPo-safe charging bag | Charge the packs inside it | [robu.in search](https://robu.in/?s=lipo+safe+bag&post_type=product) |

## C. Nice to have (not price-checked unless shown)

| Item | Why | Link |
|---|---|---|
| USB Voltage and Current Tester, ₹229 | Measure a costume board's current on the bench from USB | [robu.in](https://robu.in/product/real-tracking-number-lcd-usb-mini-voltage-and-current-detector-mobile-power-usb-charger-tester-meter/) |
| LiPo voltage checker (plugs into the balance lead) | Quick pre-show battery check | [robu.in search](https://robu.in/?s=lipo+voltage+checker&post_type=product) |
| WS2812B 8-LED stick / small ring ×4 | Hand-band prototype on the costume controller | [robu.in search](https://robu.in/?s=ws2812b+8+bit&post_type=product) |
| 14-pin DIP IC socket ×3 | So the 74AHCT125 isn't soldered directly | [robu.in search](https://robu.in/?s=14+pin+ic+socket&post_type=product) |
| Silicone LED diffuser sleeve / channel | Smooth lines instead of dots | [robu.in search](https://robu.in/?s=led+strip+diffuser&post_type=product) |

## LiPo safety (it's worn on a dancer)

The project rule so far was "protected USB power banks only". A 2S LiPo is the owner's choice for weight, runtime and current; these rules keep it as safe as possible:

1. **Always through the 2S protection board** — never wire the pack straight to the buck or strip.
2. **Pocket on the costume** away from skin and joints, padded, so the pack can't be bent, crushed or punctured. A damaged or **puffy** pack goes out of use at once.
3. **Charge off the body** on a 2S balance charger, inside a LiPo-safe bag, on a non-flammable surface, never unattended, never overnight.
4. **Switch off after every run**, and store packs at storage charge (~3.8 V per cell); don't leave them full for weeks.
5. Insulate every solder joint (heat shrink): a short on a LiPo can start a fire.
6. Have a **qualified electronics person check one finished costume** before the show (as the project brief recommends).

## Before the first power-up (lesson from 30 Oct)

1. The ESP32 is soldered straight onto the PCB (no header): test each ESP32 on USB **before** soldering it in, because swapping a soldered board later is hard.
2. **Beep test** each finished PCB: continuity between **5 V and GND** must **not** beep, and nor must battery + and −.
3. Check the **buck output with the multimeter (5.0–5.2 V) before** connecting the strip or ESP32.
4. First power-up: pack charged, strip unplugged, power LED on, nothing warm after 30 s → then plug in the strip.

## After it arrives

Firmware: `firmware/esp32/`. It's compiled in the cloud (GitHub Actions, *Firmware build*) and flashed from Chrome; see `firmware/esp32/README.md`. Test plan: E1–E5 in that README.
