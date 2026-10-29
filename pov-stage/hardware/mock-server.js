#!/usr/bin/env node

/**
 * Mock Hardware Server for Windows/Mac Development
 * Simulates Raspberry Pi GPIO without actual hardware
 */

const WebSocket = require('ws');

const PORT = process.env.WS_PORT || 8080;
const HOST = '0.0.0.0';

class MockHardwareServer {
  constructor() {
    this.wss = null;
    this.clients = new Set();
    this.zones = {
      'Zone A': { enabled: false, mode: 'Static', speed: 50, color: '#3B82F6' },
      'Zone B': { enabled: false, mode: 'Static', speed: 50, color: '#A855F7' },
      'Zone C': { enabled: false, mode: 'Static', speed: 50, color: '#EC4899' }
    };
  }

  start() {
    this.wss = new WebSocket.Server({ host: HOST, port: PORT });

    this.wss.on('connection', (ws, req) => {
      const clientIp = req.socket.remoteAddress;
      console.log(`\x1b[32m✓ Client connected: ${clientIp}\x1b[0m`);
      
      this.clients.add(ws);
      ws.isAlive = true;

      // Send connection confirmation
      this.send(ws, {
        type: 'connection',
        status: 'connected',
        message: 'Connected to LumaCue mock hardware (Windows)',
        timestamp: new Date().toISOString()
      });

      // Handle messages
      ws.on('message', (data) => {
        try {
          const command = JSON.parse(data.toString());
          this.handleCommand(ws, command);
        } catch (error) {
          console.error('Invalid message:', error.message);
        }
      });

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`\x1b[33m✗ Client disconnected: ${clientIp}\x1b[0m`);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error.message);
      });
    });

    // Heartbeat
    setInterval(() => {
      this.wss.clients.forEach(ws => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    console.log(`\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`);
    console.log(`\x1b[32m✓ Mock Hardware Server Running\x1b[0m`);
    console.log(`\x1b[36m  WebSocket: ws://${HOST}:${PORT}\x1b[0m`);
    console.log(`\x1b[33m  Mode: SIMULATION (No GPIO)\x1b[0m`);
    console.log(`\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`);
    console.log('');
  }

  handleCommand(ws, command) {
    const { zone, action, mode, color, speed, enabled } = command;

    try {
      switch (action) {
        case 'setMode':
          this.zones[zone].mode = mode;
          this.zones[zone].speed = speed;
          this.log('ACTION', `${zone} mode set to ${mode.toUpperCase()}`);
          this.send(ws, { type: 'response', action, zone, success: true });
          break;

        case 'setColor':
          this.zones[zone].color = color;
          this.log('INFO', `${zone} color set to ${color}`);
          this.send(ws, { type: 'response', action, zone, success: true });
          break;

        case 'toggle':
          this.zones[zone].enabled = enabled;
          this.log('ACTION', `${zone} turned ${enabled ? 'ON' : 'OFF'}`);
          this.send(ws, { type: 'response', action, zone, success: true });
          break;

        case 'setSpeed':
          this.zones[zone].speed = speed;
          this.log('INFO', `${zone} speed set to ${speed}%`);
          this.send(ws, { type: 'response', action, zone, success: true });
          break;

        case 'emergencyOff':
          Object.keys(this.zones).forEach(z => this.zones[z].enabled = false);
          this.log('ERROR', 'EMERGENCY OFF - All zones disabled');
          this.send(ws, { type: 'response', action, success: true });
          break;

        case 'syncAll':
          this.log('SYNC', 'All zones synchronized');
          this.send(ws, { type: 'response', action, success: true });
          break;

        case 'ping':
          this.send(ws, { type: 'pong', timestamp: Date.now() });
          break;

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      console.error(`\x1b[31mError: ${error.message}\x1b[0m`);
      this.send(ws, { type: 'error', message: error.message, action, zone });
    }
  }

  send(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  broadcast(data) {
    const message = JSON.stringify(data);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  log(type, message) {
    const colors = {
      INFO: '\x1b[34m',
      WARN: '\x1b[33m',
      ERROR: '\x1b[31m',
      ACTION: '\x1b[35m',
      SYNC: '\x1b[32m'
    };

    const color = colors[type] || '\x1b[37m';
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    
    console.log(`${color}[${time}] [${type}]\x1b[0m ${message}`);

    // Broadcast to clients
    this.broadcast({
      type: 'log',
      logType: type,
      message,
      timestamp: time
    });
  }
}

// Start server
const server = new MockHardwareServer();
server.start();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\x1b[33m⚠ Shutting down...\x1b[0m');
  process.exit(0);
});
