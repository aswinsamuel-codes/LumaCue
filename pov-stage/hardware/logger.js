/**
 * Logger utility for hardware server
 */

class Logger {
  constructor() {
    this.colors = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m'
    };
  }

  timestamp() {
    return new Date().toLocaleTimeString('en-US', { hour12: false });
  }

  info(message, ...args) {
    console.log(
      `${this.colors.cyan}[${this.timestamp()}] INFO:${this.colors.reset}`,
      message,
      ...args
    );
  }

  success(message, ...args) {
    console.log(
      `${this.colors.green}[${this.timestamp()}] ✓${this.colors.reset}`,
      message,
      ...args
    );
  }

  warn(message, ...args) {
    console.log(
      `${this.colors.yellow}[${this.timestamp()}] WARN:${this.colors.reset}`,
      message,
      ...args
    );
  }

  error(message, ...args) {
    console.error(
      `${this.colors.red}[${this.timestamp()}] ERROR:${this.colors.reset}`,
      message,
      ...args
    );
  }

  log(type, message) {
    const colorMap = {
      INFO: this.colors.blue,
      WARN: this.colors.yellow,
      ERROR: this.colors.red,
      ACTION: this.colors.magenta,
      SYNC: this.colors.green
    };

    const color = colorMap[type] || this.colors.white;
    console.log(
      `${color}[${this.timestamp()}] [${type}]${this.colors.reset}`,
      message
    );
  }
}

module.exports = Logger;
