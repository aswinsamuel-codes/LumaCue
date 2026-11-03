#!/usr/bin/env bash
# Compiles every Arduino sketch under firmware/ (a folder whose .ino has the folder's name).
# ESP32 sketches (they include esp_now.h) build for "ESP32 Dev Module"; the rest for the
# Arduino Nano (old bootloader). The bench costume also builds in WS2812B strip mode.
# Ready-to-flash files go to build/out/<path with / as __>/; a size table goes to the job summary.
set -uo pipefail

OUT=build/out
mkdir -p "$OUT" build/tmp
SUMMARY="${GITHUB_STEP_SUMMARY:-build/summary.md}"
echo "| Sketch | Board | Result | Flash | RAM |" >> "$SUMMARY"
echo "|---|---|---|---|---|" >> "$SUMMARY"
failed=0

compile() { # compile <sketch dir> <label>
  local dir="$1" label="$2" fqbn board
  local ino="$dir/$(basename "$dir").ino"
  if grep -q 'esp_now.h' "$ino"; then fqbn="esp32:esp32:esp32"; board="ESP32"; else fqbn="arduino:avr:nano:cpu=atmega328old"; board="Nano"; fi
  local dest="$OUT/${label//\//__}"
  local log="build/tmp/${label//\//__}.log"
  echo "::group::$label ($board)"
  if arduino-cli compile --fqbn "$fqbn" --warnings default --output-dir "$dest" "$dir" > "$log" 2>&1; then
    local flash ram
    flash=$(grep -o 'Sketch uses [0-9]* bytes ([0-9]*%)' "$log" | sed 's/Sketch uses //')
    ram=$(grep -o 'Global variables use [0-9]* bytes ([0-9]*%)' "$log" | sed 's/Global variables use //')
    echo "| \`$label\` | $board | ✅ | $flash | $ram |" >> "$SUMMARY"
    # Keep only what's needed to flash: ESP32 merged image (+ app image), Nano hex.
    find "$dest" -type f ! -name '*.merged.bin' ! -name '*.ino.bin' ! -name '*.ino.hex' -delete
    cat "$log"
  else
    failed=1
    echo "| \`$label\` | $board | ❌ | | |" >> "$SUMMARY"
    cat "$log"
    echo "::error title=Compile failed::$label ($board)"
    rm -rf "$dest"
  fi
  echo "::endgroup::"
}

while IFS= read -r ino; do
  dir=$(dirname "$ino")
  [ "$(basename "$dir")" = "$(basename "$ino" .ino)" ] || continue
  label="${dir#firmware/}"
  compile "$dir" "$label"
  # The bench costume template is in 5 mm mode; build its WS2812B strip mode as well.
  if grep -q '^#define OUTPUT_MODE MODE_5MM' "$ino"; then
    strip="build/tmp/strip/$(basename "$dir")"
    rm -rf "$strip"; mkdir -p "$(dirname "$strip")"; cp -r "$dir" "$strip"
    sed -i 's/^#define OUTPUT_MODE MODE_5MM/#define OUTPUT_MODE MODE_STRIP/' "$strip/$(basename "$ino")"
    compile "$strip" "$label (strip)"
  fi
done < <(find firmware -name '*.ino' | sort)

exit $failed
