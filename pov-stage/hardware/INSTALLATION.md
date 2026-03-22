# Hardware Installation Guide

## Quick Start

### On Raspberry Pi

1. **Install Dependencies**
```bash
cd pov-stage/hardware
npm install
```

2. **Configure**
```bash
cp .env.example .env
```

3. **Run**
```bash
sudo node server.js
```

### On Development Machine (Mock Mode)

For testing without GPIO hardware:

```bash
npm run test
```

## Frontend Setup

Add WebSocket URL to `pov-stage/.env.local`:

```env
NEXT_PUBLIC_WS_URL=ws://localhost:8080
```

For Raspberry Pi connection:
```env
NEXT_PUBLIC_WS_URL=ws://192.168.1.100:8080
```

## Verify Connection

1. Start hardware server
2. Start Next.js app: `npm run dev`
3. Login to dashboard
4. Check TopBar for "CONNECTED" status
5. Check System Log for "Connected to hardware controller"

## Testing Commands

Use browser console:
```javascript
// Get WebSocket client
const ws = new WebSocket('ws://localhost:8080')

// Send test command
ws.send(JSON.stringify({
  zone: 'A',
  action: 'toggle',
  enabled: true
}))
```

## Common Issues

**"Cannot find module 'pigpio'"**
- Only needed on Raspberry Pi
- Install: `sudo apt-get install pigpio`

**"Permission denied" on GPIO**
- Run with sudo: `sudo node server.js`
- Or add user to gpio group

**WebSocket connection refused**
- Check server is running
- Verify port 8080 is open
- Check firewall settings
