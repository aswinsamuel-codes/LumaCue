/**
 * GPIO Controller for Raspberry Pi
 * Manages IR transmitter control via GPIO pins
 */

const Gpio = require('pigpio').Gpio;
require('dotenv').config();

class GPIOController {
  constructor() {
    this.zones = new Map();
    this.intervals = new Map();
    this.config = {
      A: parseInt(process.env.GPIO_ZONE_A) || 17,
      B: parseInt(process.env.GPIO_ZONE_B) || 27,
      C: parseInt(process.env.GPIO_ZONE_C) || 22
    };
    this.irFrequency = parseInt(process.env.IR_FREQUENCY) || 38000;
  }

  async initialize() {
    try {
      // Initialize GPIO pins for each zone
      for (const [zoneName, pin] of Object.entries(this.config)) {
        const gpio = new Gpio(pin, { mode: Gpio.OUTPUT });
        
        this.zones.set(zoneName, {
          gpio,
          pin,
          enabled: false,
          mode: 'Static',
          speed: 50,
          color: '#000000',
          dutyCycle: 0
        });

        // Initialize to OFF
        gpio.digitalWrite(0);
      }

      console.log('✓ GPIO pins initialized:', this.config);
      return true;
    } catch (error) {
      console.error('✗ GPIO initialization failed:', error.message);
      throw error;
    }
  }

  async setZoneMode(zoneName, mode, speed = 50) {
    const zone = this.zones.get(zoneName);
    if (!zone) throw new Error(`Invalid zone: ${zoneName}`);

    zone.mode = mode;
    zone.speed = speed;

    if (zone.enabled) {
      await this.applyZonePattern(zoneName);
    }

    return { zone: zoneName, mode, speed };
  }

  async setZoneColor(zoneName, color) {
    const zone = this.zones.get(zoneName);
    if (!zone) throw new Error(`Invalid zone: ${zoneName}`);

    zone.color = color;
    
    // Convert color to brightness (0-255)
    const brightness = this.colorToBrightness(color);
    zone.dutyCycle = Math.round((brightness / 255) * 255);

    if (zone.enabled) {
      await this.applyZonePattern(zoneName);
    }

    return { zone: zoneName, color, brightness };
  }

  async toggleZone(zoneName, enabled) {
    const zone = this.zones.get(zoneName);
    if (!zone) throw new Error(`Invalid zone: ${zoneName}`);

    zone.enabled = enabled;

    if (enabled) {
      await this.applyZonePattern(zoneName);
    } else {
      this.stopZonePattern(zoneName);
      zone.gpio.digitalWrite(0);
    }

    return { zone: zoneName, enabled };
  }

  async setZoneSpeed(zoneName, speed) {
    const zone = this.zones.get(zoneName);
    if (!zone) throw new Error(`Invalid zone: ${zoneName}`);

    zone.speed = speed;

    if (zone.enabled) {
      await this.applyZonePattern(zoneName);
    }

    return { zone: zoneName, speed };
  }

  async applyZonePattern(zoneName) {
    const zone = this.zones.get(zoneName);
    if (!zone) return;

    // Clear existing pattern
    this.stopZonePattern(zoneName);

    switch (zone.mode) {
      case 'Static':
        this.applyStaticPattern(zoneName);
        break;
      case 'Pulse':
        this.applyPulsePattern(zoneName);
        break;
      case 'Flash':
        this.applyFlashPattern(zoneName);
        break;
    }
  }

  applyStaticPattern(zoneName) {
    const zone = this.zones.get(zoneName);
    
    // Constant PWM signal for IR transmission
    zone.gpio.pwmWrite(zone.dutyCycle);
  }

  applyPulsePattern(zoneName) {
    const zone = this.zones.get(zoneName);
    
    // Calculate pulse interval based on speed (slower = longer interval)
    const interval = 2000 - (zone.speed * 15); // 2000ms to 500ms
    
    let state = false;
    const pulseInterval = setInterval(() => {
      state = !state;
      if (state) {
        zone.gpio.pwmWrite(zone.dutyCycle);
      } else {
        zone.gpio.digitalWrite(0);
      }
    }, interval);

    this.intervals.set(zoneName, pulseInterval);
  }

  applyFlashPattern(zoneName) {
    const zone = this.zones.get(zoneName);
    
    // Calculate flash interval based on speed (faster = shorter interval)
    const interval = 500 - (zone.speed * 4); // 500ms to 100ms
    
    let state = false;
    const flashInterval = setInterval(() => {
      state = !state;
      if (state) {
        zone.gpio.pwmWrite(zone.dutyCycle);
      } else {
        zone.gpio.digitalWrite(0);
      }
    }, interval);

    this.intervals.set(zoneName, flashInterval);
  }

  stopZonePattern(zoneName) {
    const interval = this.intervals.get(zoneName);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(zoneName);
    }
  }

  async emergencyShutdown() {
    console.log('⚠ EMERGENCY SHUTDOWN INITIATED');
    
    for (const [zoneName, zone] of this.zones) {
      zone.enabled = false;
      this.stopZonePattern(zoneName);
      zone.gpio.digitalWrite(0);
    }

    return { success: true, message: 'All zones disabled' };
  }

  async syncAllZones() {
    // Synchronize all enabled zones to restart patterns simultaneously
    const enabledZones = Array.from(this.zones.entries())
      .filter(([_, zone]) => zone.enabled);

    for (const [zoneName] of enabledZones) {
      this.stopZonePattern(zoneName);
    }

    // Small delay to ensure all patterns stopped
    await new Promise(resolve => setTimeout(resolve, 50));

    for (const [zoneName] of enabledZones) {
      await this.applyZonePattern(zoneName);
    }

    return { success: true, syncedZones: enabledZones.length };
  }

  colorToBrightness(hexColor) {
    // Convert hex color to perceived brightness (0-255)
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Perceived brightness formula
    return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  getStatus() {
    const status = {};
    
    for (const [zoneName, zone] of this.zones) {
      status[zoneName] = {
        pin: zone.pin,
        enabled: zone.enabled,
        mode: zone.mode,
        speed: zone.speed,
        color: zone.color,
        dutyCycle: zone.dutyCycle
      };
    }

    return status;
  }

  async cleanup() {
    console.log('Cleaning up GPIO...');
    
    // Stop all patterns
    for (const zoneName of this.zones.keys()) {
      this.stopZonePattern(zoneName);
    }

    // Turn off all pins
    for (const [_, zone] of this.zones) {
      zone.gpio.digitalWrite(0);
    }

    console.log('✓ GPIO cleanup complete');
  }
}

module.exports = GPIOController;
