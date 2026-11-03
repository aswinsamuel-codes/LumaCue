# firmware/shows — build a show's firmware in the cloud

The ESP32 (and Nano) costume firmware has the show compiled in, so every show needs its own build.
On the development laptop Windows blocks the ESP32 compiler, so builds run on GitHub instead:

1. In LumaCue **Show Studio → Costume firmware**, choose the board and download the zip (one dancer or all dancers).
2. Unzip it into this folder, e.g. `firmware/shows/opening_act/` (keep the folders as they are: `base/`, `costume/` or `dancer_01/costume/` …).
3. Commit and push. GitHub Actions (**Firmware build**) compiles every sketch and attaches **lumacue-firmware** to the run.
4. Download that artifact and flash each board from the browser (see `../esp32/README.md` → *Flash from the browser*).

Each folder ends up in the artifact with `/` written as `__`, e.g. `shows__opening_act__dancer_01__costume/costume.ino.merged.bin`.
