# LumaCue Hardware Integration

WebSocket server for Raspberry Pi GPIO control of IR transmitters.

## Hardware Requirements

- **Raspberry Pi** (3B+, 4, or 5 recommended)
- **IR LED Transmitters** (one per zone)
- **Transistors** (2N2222 or similar, for signal amplification)
- **Resistors** (220Ω for LED, 1kΩ for transistor base)
- **Power Supply** (5V for Pi, separate 12V for high-power LEDs if needed)

## Circuit Diagram

```
GPIO Pin → 1kΩ Resistor → Transistor Base
                          Transistor Collector → IR LED Anode → 220Ω → VCC
                          Transistor Emitter → GND
```

### Pin Mapping (BCM Numbering)
- Zone A: GPIO 17
- Zone B: GPIO 27
- Zone C: GPIO 22

## Software Installation

### 1. Install Node.js on Raspberry Pi
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Install pigpio Library
```bash
sudo apt-get update
sudo apt-get install -y pigpio
sudo systemctl enable pigpiod
sudo systemctl start pigpiod
```

### 3. Clone and Setup
```bash
cd /home/pi
git clone https://github.com/aswinsamuel-codes/pov.stage.git
cd pov.stage/pov-stage/hardware
npm install
```

### 4. Configure Environment
```bash
cp .env.example .env
nano .env
```

Edit the GPIO pins and WebSocket settings as needed.

### 5. Test the Server
```bash
npm run test
```

### 6. Start the Server
```bash
npm start
```

## Running as a Service

Create systemd service for auto-start:

```bash
sudo nano /etc/systemd/system/pov-stage-hardware.service
```

Add:
```ini
[Unit]
Description=LumaCue Hardware Controller
After=network.target pigpiod.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/pov.stage/pov-stage/hardware
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable pov-stage-hardware
sudo systemctl start pov-stage-hardware
sudo systemctl status pov-stage-hardware
```

## WebSocket API

### Connection
```
ws://RASPBERRY_PI_IP:8080
```

### Command Format
```json
{
  "zone": "A",
  "action": "setMode",
  "mode": "Flash",
  "speed": 75
}
```

### Actions

#### Toggle Zone
```json
{
  "zone": "A",
  "action": "toggle",
  "enabled": true
}
```

#### Set Mode
```json
{
  "zone": "B",
  "action": "setMode",
  "mode": "Pulse",
  "speed": 60
}
```

Modes: `Static`, `Pulse`, `Flash`

#### Set Color
```json
{
  "zone": "C",
  "action": "setColor",
  "color": "#FF00FF"
}
```

#### Set Speed
```json
{
  "zone": "A",
  "action": "setSpeed",
  "speed": 80
}
```

#### Emergency Off
```json
{
  "zone": "",
  "action": "emergencyOff"
}
```

#### Sync All
```json
{
  "zone": "",
  "action": "syncAll"
}
```

### Response Format

#### Success
```json
{
  "type": "response",
  "action": "setMode",
  "zone": "A",
  "success": true,
  "result": { "zone": "A", "mode": "Flash", "speed": 75 }
}
```

#### Error
```json
{
  "type": "error",
  "message": "Invalid zone: D",
  "action": "toggle",
  "zone": "D"
}
```

#### Log
```json
{
  "type": "log",
  "logType": "ACTION",
  "message": "Zone A mode set to FLASH",
  "timestamp": "14:32:15"
}
```

## Frontend Configuration

Add to `pov-stage/.env.local`:
```env
NEXT_PUBLIC_WS_URL=ws://192.168.1.100:8080
```

Replace `192.168.1.100` with your Raspberry Pi's IP address.

## Troubleshooting

### GPIO Permission Denied
```bash
sudo usermod -a -G gpio pi
sudo reboot
```

### pigpio Not Running
```bash
sudo systemctl status pigpiod
sudo systemctl restart pigpiod
```

### WebSocket Connection Failed
- Check firewall: `sudo ufw allow 8080`
- Verify Pi IP address: `hostname -I`
- Test connectivity: `ping RASPBERRY_PI_IP`

### Check Logs
```bash
# Service logs
sudo journalctl -u pov-stage-hardware -f

# Manual run with debug
DEBUG=* node server.js
```

## IR Signal Patterns

### Static Mode
- Constant PWM signal
- Duty cycle based on color brightness

### Pulse Mode
- Alternating ON/OFF
- Interval: 2000ms - (speed × 15)
- Speed 0 = 2000ms, Speed 100 = 500ms

### Flash Mode
- Rapid ON/OFF
- Interval: 500ms - (speed × 4)
- Speed 0 = 500ms, Speed 100 = 100ms

## Performance

- **Latency**: <50ms command to GPIO
- **Max Zones**: 26 (limited by available GPIO pins)
- **PWM Frequency**: 38kHz (standard IR)
- **Concurrent Clients**: Unlimited (WebSocket broadcast)

## Security

- Change default WebSocket port
- Use firewall rules to restrict access
- Implement authentication in production
- Use HTTPS/WSS for remote access
- Consider VPN for external control

## License

MIT
