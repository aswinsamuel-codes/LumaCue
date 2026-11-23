#!/bin/sh
# Runs after the .deb is installed. Opening the base station's USB serial port
# (/dev/ttyUSB*, /dev/ttyACM*) needs membership of the "dialout" group.
echo "LumaCue: to connect the base station over USB, add your user to the dialout group:"
echo "  sudo usermod -aG dialout \$USER   (then log out and back in)"
exit 0
