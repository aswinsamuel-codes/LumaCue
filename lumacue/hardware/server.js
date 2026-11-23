#!/usr/bin/env node

/**
 * LumaCue Hardware Integration Server
 * WebSocket server for Raspberry Pi GPIO control
 * Controls IR transmitters for lighting zones
 */

const WebSocket = require('ws');
const GPIOController = require('./gpio-controller');
const Logger = require('./logger');
require('dotenv').config();

const crypto = require('crypto');

const PORT = process.env.WS_PORT || 8080;
const HOST = process.env.WS_HOST || '0.0.0.0';
// Security (see SECURITY.md). Anyone on the same network can reach this port, so:
//  - WS_TOKEN: shared secret clients must send as ?token=... (strongly recommended)
//  - WS_ALLOWED_ORIGINS: comma-separated browser origins allowed to connect
const TOKEN = process.env.WS_TOKEN || '';
const ALLOWED_ORIGINS = (process.env.WS_ALLOWED_ORIGINS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
const MAX_PAYLOAD = 16 * 1024;

function tokenMatches(given) {
  if (!TOKEN) return true;
  const a = Buffer.from(String(given || ''));
  const b = Buffer.from(TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verifyClient(info) {
  const origin = info.origin || info.req.headers.origin;
  if (ALLOWED_ORIGINS.length && origin && !ALLOWED_ORIGINS.includes(origin)) return false;
  const url = new URL(info.req.url || '/', 'ws://localhost');
  return tokenMatches(url.searchParams.get('token'));
}

class HardwareServer {
  constructor() {
    this.wss = null;
    this.gpio = null;
    this.logger = new Logger();
    this.clients = new Set();
    this.heartbeatInterval = null;
  }

  async initialize() {
    try {
      // Initialize GPIO controller
      this.logger.info('Initializing GPIO controller...');
      this.gpio = new GPIOController();
      await this.gpio.initialize();
      this.logger.success('GPIO controller initialized');

      // Create WebSocket server
      this.wss = new WebSocket.Server({ 
        host: HOST,
        port: PORT,
        clientTracking: true,
        maxPayload: MAX_PAYLOAD,
        verifyClient
      });
      if (!TOKEN && HOST !== '127.0.0.1') {
        this.logger.warn('WS_TOKEN is not set: any device on this network can control the lights. Set WS_TOKEN in .env.');
      }

      this.setupWebSocketHandlers();
      this.startHeartbeat();

      this.logger.success(`WebSocket server running on ws://${HOST}:${PORT}`);
      this.logger.info('Waiting for client connections...');
    } catch (error) {
      this.logger.error('Failed to initialize server:', error);
      process.exit(1);
    }
  }

  setupWebSocketHandlers() {
    this.wss.on('connection', (ws, req) => {
      const clientIp = req.socket.remoteAddress;
      this.logger.info(`Client connected: ${clientIp}`);
      
      this.clients.add(ws);
      ws.isAlive = true;

      // Send connection confirmation
      this.sendToClient(ws, {
        type: 'connection',
        status: 'connected',
        message: 'Connected to LumaCue hardware controller',
        timestamp: new Date().toISOString()
      });

      // Send current GPIO status
      this.sendGPIOStatus(ws);

      // Handle incoming messages
      ws.on('message', async (data) => {
        try {
          const command = JSON.parse(data.toString());
          await this.handleCommand(ws, command);
        } catch (error) {
          this.logger.error('Invalid message format:', error);
          this.sendError(ws, 'Invalid JSON format');
        }
      });

      // Handle pong (heartbeat response)
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Handle disconnection
      ws.on('close', () => {
        this.clients.delete(ws);
        this.logger.info(`Client disconnected: ${clientIp}`);
      });

      // Handle errors
      ws.on('error', (error) => {
        this.logger.error(`WebSocket error for ${clientIp}:`, error);
      });
    });

    this.wss.on('error', (error) => {
      this.logger.error('WebSocket server error:', error);
    });
  }

  async handleCommand(ws, command) {
    const { zone, action, mode, color, speed, enabled } = command;

    this.logger.info(`Command received: ${action} for Zone ${zone}`);

    try {
      let result;

      switch (action) {
        case 'setMode':
          result = await this.gpio.setZoneMode(zone, mode, speed);
          this.broadcastLog('ACTION', `Zone ${zone} mode set to ${mode.toUpperCase()}`);
          break;

        case 'setColor':
          result = await this.gpio.setZoneColor(zone, color);
          this.broadcastLog('INFO', `Zone ${zone} color set to ${color}`);
          break;

        case 'toggle':
          result = await this.gpio.toggleZone(zone, enabled);
          this.broadcastLog('ACTION', `Zone ${zone} turned ${enabled ? 'ON' : 'OFF'}`);
          break;

        case 'setSpeed':
          result = await this.gpio.setZoneSpeed(zone, speed);
          this.broadcastLog('INFO', `Zone ${zone} speed set to ${speed}%`);
          break;

        case 'emergencyOff':
          result = await this.gpio.emergencyShutdown();
          this.broadcastLog('ERROR', 'EMERGENCY OFF - All zones disabled');
          break;

        case 'syncAll':
          result = await this.gpio.syncAllZones();
          this.broadcastLog('SYNC', 'All zones synchronized');
          break;

        case 'getStatus':
          result = this.gpio.getStatus();
          this.sendToClient(ws, { type: 'status', data: result });
          return;

        case 'ping':
          this.sendToClient(ws, { type: 'pong', timestamp: Date.now() });
          return;

        default:
          throw new Error(`Unknown action: ${action}`);
      }

      // Send success response
      this.sendToClient(ws, {
        type: 'response',
        action,
        zone,
        success: true,
        result
      });

    } catch (error) {
      this.logger.error(`Command failed: ${action}`, error);
      this.sendError(ws, error.message, { action, zone });
      this.broadcastLog('ERROR', `Failed to execute ${action} on Zone ${zone}: ${error.message}`);
    }
  }

  sendToClient(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  sendError(ws, message, details = {}) {
    this.sendToClient(ws, {
      type: 'error',
      message,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  broadcastLog(type, message) {
    const logData = {
      type: 'log',
      logType: type,
      message,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
    };

    this.broadcast(logData);
    this.logger.log(type, message);
  }

  broadcast(data) {
    const message = JSON.stringify(data);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  sendGPIOStatus(ws) {
    const status = this.gpio.getStatus();
    this.sendToClient(ws, {
      type: 'gpio_status',
      data: status
    });
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach(ws => {
        if (ws.isAlive === false) {
          this.logger.warn('Client failed heartbeat, terminating connection');
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 seconds
  }

  async shutdown() {
    this.logger.info('Shutting down server...');

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.gpio) {
      await this.gpio.cleanup();
    }

    if (this.wss) {
      this.wss.close(() => {
        this.logger.success('WebSocket server closed');
      });
    }

    this.logger.success('Server shutdown complete');
    process.exit(0);
  }
}

// Initialize and start server
const server = new HardwareServer();

// Handle graceful shutdown
process.on('SIGINT', () => server.shutdown());
process.on('SIGTERM', () => server.shutdown());

// Start server
server.initialize().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

module.exports = HardwareServer;
