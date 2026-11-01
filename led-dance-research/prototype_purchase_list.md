# LumaCue prototype purchase list (ESP32 + WS2812B)

**Date:** 1 Nov 2026 · Powered by Aswin Samuel
**Goal:** 1 base station + **2 working test costumes**, enough to run the full LumaCue system (Show Studio → firmware → Show Mode → ESP-NOW radio → LEDs) and measure sync, power and battery life before ordering the other 8 costumes.
**Why ESP32 now:** both Nanos were damaged on 30 Oct (powered while seated wrongly in a breadboard, 5 V shorted to GND). The final costumes use ESP32 anyway; its radio (ESP-NOW) is built in, so the NRF24 modules become a backup.

**Prices:** read from robu.in search results in a browser on **1 Nov 2026**, shown **including GST**, **shipping not included**. Prices and stock change; check the cart. Where a listing may be a pack, it says so — check the pack size on the product page.

## A. Must buy (all from robu.in)

| # | Item (as listed) | Qty | Unit price | Line total | Link | Notes |
|---|---|---|---|---|---|---|
| 1 | 30Pin CH9102X ESP-32 WiFi+Bluetooth Development Board, Type-C USB | 4 | ₹448 | ₹1,792 | [robu.in](https://robu.in/product/30pin-ch9102x-esp-32-wifibluetooth-development-board-with-type-c-usb-interface/) | 1 base + 2 costumes + 1 spare. USB chip CH9102X: Windows may need the WCH CH9102/CH343 driver |
| 2 | 1M WS2812B 5V Addressable RGB Non-Waterproof LED Strip, 60 LED/m | 3 | ₹489 | ₹1,467 | [robu.in](https://robu.in/product/1m-ws2812b-5v-addressable-rgb-non-waterproof-led-strip-light-60leds-m/) | 1 m per costume + 1 m bench. Non-waterproof is fine for the prototype |
| 3 | ACEBOTT USB Type-C Cable 1m Fast Charging/Data Transfer | 3 | ₹87 | ₹261 | [robu.in](https://robu.in/product/type-c-usb-cable/) | Data cable for uploading (check it's USB-A to C for your laptop) |
| 4 | SN74AHCT125N (Texas Instruments), DIP-14 | 3 | ₹93 | ₹279 | [robu.in](https://robu.in/product/sn74ahct125n-texas-instruments-8ma-1-4-5v5-5v-8ma-4-dip-14-buffers-drivers-receivers-transceivers-rohs/) | 3.3 V → 5 V data level shifter. **DIP** (fits a breadboard); the cheaper 74AHCT125 listings are SMD |
| 5 | 1000uF 25V Electrolytic Capacitor DIP | 1 listing | ₹12 | ₹12 | [robu.in](https://robu.in/product/1000uf-25v-electrolytic-capacitor-dip-pack-of-5/) | URL says pack of 5 — need 4. Check the pack size |
| 6 | 3 Pin JST XH 2.54mm Pitch Plug and Socket with Cable (pack of 1) | 10 | ₹13 | ₹130 | [robu.in](https://robu.in/product/3-pin-jst-xh-2-54mm-pitch-plug-and-socket-with-cable-10-pcs/) | Plug-in strips. (JST **XH**; the usual LED-strip **SM** type wasn't found on Robu — XH works for the prototype) |
| 7 | USB Type A Breakout Board - Male | 3 | ₹9 | ₹27 | [robu.in](https://robu.in/product/usb-type-breakout-board-male/) | Power bank → bare wires to strip + ESP32 (solder wires on) |
| 8 | KCD11 2 Pin SPST Mini Boat Rocker Switch, 3A (Pack of 10) | 1 pack | ₹69 | ₹69 | [robu.in](https://robu.in/product/kcd11-ac-250v-3a-2-pin-spst-snap-in-mini-boat-rocker-switch/) | Power switch per costume (= emergency cut-off) |
| 9 | 22AWG High Voltage Silicone Wire — Red | 2 | ₹26 | ₹52 | [robu.in](https://robu.in/product/22awg-high-voltage-silicone-wire-3000v-red/) | Strip power runs. Check the length per unit on the page |
| 10 | 22AWG High Voltage Silicone Wire — Black | 2 | ₹26 | ₹52 | [robu.in](https://robu.in/product/22awg-high-voltage-silicone-wire-3000v-black/) | |
| 11 | 530PCS Boxed Color Heat Shrink Tube Combo | 1 | ₹319 | ₹319 | [robu.in](https://robu.in/product/heat-shrink-tube-kit-combo-heat-shrink-tubes/) | Insulate every solder joint |
| 12 | MB102 830 Points Solderless Prototype Breadboard | 2 | ₹69 | ₹138 | [robu.in](https://robu.in/product/mb102-830-points-solderless-prototype-pcb-breadboard-high-quality/) | Full-size; an ESP32 doesn't fit the mini boards safely |
| 13 | Male to Male Jumper Wires 40Pcs 20cm | 1 | ₹49 | ₹49 | [robu.in](https://robu.in/product/male-to-male-jumper-wires-40pcs-20cm/) | Breadboard links |
| 14 | USB Voltage and Current Tester | 1 | ₹229 | ₹229 | [robu.in](https://robu.in/product/real-tracking-number-lcd-usb-mini-voltage-and-current-detector-mobile-power-usb-charger-tester-meter/) | Measures real costume current → battery planning |
| | **Subtotal without power banks** | | | **₹4,876** | | + shipping |
| 15 | Nextech Slender Lite 10000mAh Power Bank | 2 | ₹1,129 | ₹2,258 | [robu.in](https://robu.in/product/slender-lite-10000mah-charging-power-bank/) | **Optional if you already have 2 power banks.** Many banks switch off when LEDs are dark; we test this (E4) |
| | **Total with power banks** | | | **₹7,134** | | + shipping |

## B. Tools (only if you don't have them — not price-checked)

| Item | Why | Search |
|---|---|---|
| Digital multimeter with continuity beep | 5 V ↔ GND beep test before every first power-up | [robu.in search](https://robu.in/?s=digital+multimeter&post_type=product) |
| Soldering iron kit (adjustable, ~60 W) + solder + flux | Strip and connector joints must be soldered | [robu.in search](https://robu.in/?s=soldering+iron+kit&post_type=product) |
| Wire stripper / cutter | Clean wire ends | [robu.in search](https://robu.in/?s=wire+stripper&post_type=product) |

## C. Nice to have (not price-checked)

| Item | Why | Search |
|---|---|---|
| WS2812B 8-LED stick / small ring ×4 | Hand-band prototype on the costume controller | [robu.in search](https://robu.in/?s=ws2812b+8+bit&post_type=product) |
| Silicone LED diffuser sleeve / channel | Smooth lines instead of dots | [robu.in search](https://robu.in/?s=led+strip+diffuser&post_type=product) |

## Don't buy

- More **Arduino Nanos** or **NRF24** modules: ESP32 replaces both (the NRF24s you have stay as a backup radio).
- **CR2032 coin cells**, **TSOP / IR** parts, **5 mm LEDs**: not used in costumes.
- Raw **LiPo cells**: use protected USB power banks only.

## Before the first power-up (lesson from 30 Oct)

1. Don't push the ESP32 into a breadboard unless it **straddles the centre gap**; easier: connect female jumpers straight to its pins and keep the board on a non-metal surface.
2. **Beep test**: multimeter on continuity between **5V/VIN and GND**. A beep = short → don't plug in.
3. Plug in the **bare** board first: power LED on, nothing warm after 30 s → then add wiring.
4. Strip power comes from the **power bank**, not through the ESP32's 5 V pin; common ground between them.

## After it arrives

Firmware: `firmware/esp32/` (base + costume, ESP-NOW). It has **not been compiled yet**: the ESP32 toolchain needs ~4–6 GB on drive C (8.1 GB free on 1 Nov 2026), so free some space first. Test plan: E1–E5 in `firmware/esp32/README.md`.
