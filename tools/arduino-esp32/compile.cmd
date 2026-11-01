@echo off
rem Compile-check LumaCue firmware with the local ESP32 toolchain in this folder.
rem Usage (from the repo root):  tools\arduino-esp32\compile.cmd firmware\esp32\costume
rem The ESP32 compiler cannot run its tools from a path with spaces, so this maps
rem this folder to drive L: (subst). The mapping ends at restart; this script re-makes it.
setlocal
set "TOOLS=%~dp0"
if not exist "L:\data\packages" subst L: "%TOOLS:~0,-1%"
set "CLI=%LOCALAPPDATA%\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe"
"%CLI%" --config-file "%TOOLS%arduino-cli.yaml" compile --fqbn esp32:esp32:esp32 %*
