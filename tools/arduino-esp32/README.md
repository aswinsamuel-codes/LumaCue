# tools/arduino-esp32

Local Arduino toolchain used to **compile-check** LumaCue's ESP32 firmware (`firmware/esp32/`).
It lives here so it doesn't change the Arduino IDE's own setup. Everything except this README
and `arduino-cli.yaml` is downloaded and ignored by git.

| Folder | Contents |
|---|---|
| `data/` | ESP32 board package (Espressif arduino-esp32 core + compilers) |
| `downloads/` | Download cache (safe to delete) |
| `user/libraries/` | Libraries for compiling (FastLED) |

Compile from the repo root with the script (it uses the Arduino IDE's bundled `arduino-cli`):

    toolsrduino-esp32\compile.cmd firmware\esp32\costume
    toolsrduino-esp32\compile.cmd firmware\esp32ase

**Paths with spaces:** the ESP32 compiler can't run its own tools from a folder path containing
spaces (this repo is under `D:\MY works\Hello World\`). `compile.cmd` therefore maps this folder to
drive **L:** with `subst` (the mapping ends at restart; the script re-makes it), and
`arduino-cli.yaml` points at `L:/data`, `L:/downloads`, `L:/user`. The files stay here.
To unmap by hand: `subst L: /d`.

To remove the toolchain, delete `data/`, `downloads/` and `user/`.
