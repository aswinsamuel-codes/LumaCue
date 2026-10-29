/**
 * USB serial link to the LumaCue base station (firmware/bench_sync_test/base_station)
 * using Web Serial. Works in Chrome / Edge on desktop only.
 * The base takes line commands: ARM, START, BLACKOUT, BEACONS, STATUS.
 */

// Minimal Web Serial typings (not in the default TS DOM lib).
interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>
  close(): Promise<void>
  readable: ReadableStream<Uint8Array> | null
  writable: WritableStream<Uint8Array> | null
}
interface SerialLike {
  requestPort(): Promise<SerialPortLike>
}

export type BaseCommand = 'ARM' | 'START' | 'BLACKOUT' | 'BEACONS' | 'STATUS'

export function isWebSerialSupported() {
  return typeof navigator !== 'undefined' && 'serial' in navigator
}

export class BaseStationSerial {
  private port: SerialPortLike | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private closing = false

  isConnected() {
    return this.port !== null
  }

  /** Asks the user to pick the base station's COM port, then reads lines until closed. */
  async connect(onLine: (line: string) => void, onClosed: (unexpected: boolean) => void) {
    const serial = (navigator as Navigator & { serial: SerialLike }).serial
    const port = await serial.requestPort()
    await port.open({ baudRate: 115200 })
    this.port = port
    this.closing = false
    void this.readLoop(onLine, onClosed)
  }

  async send(command: BaseCommand) {
    if (!this.port?.writable) throw new Error('Base station not connected')
    const writer = this.port.writable.getWriter()
    try {
      await writer.write(new TextEncoder().encode(command + '\n'))
    } finally {
      writer.releaseLock()
    }
  }

  async disconnect() {
    this.closing = true
    await this.reader?.cancel().catch(() => {})
  }

  private async readLoop(onLine: (line: string) => void, onClosed: (unexpected: boolean) => void) {
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      while (this.port?.readable) {
        this.reader = this.port.readable.getReader()
        try {
          while (true) {
            const { value, done } = await this.reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            let nl: number
            while ((nl = buffer.indexOf('\n')) >= 0) {
              const line = buffer.slice(0, nl).replace(/\r$/, '')
              buffer = buffer.slice(nl + 1)
              if (line) onLine(line)
            }
          }
        } finally {
          this.reader.releaseLock()
          this.reader = null
        }
        if (this.closing) break
      }
    } catch {
      // Port lost (USB unplugged) — handled below.
    }
    const unexpected = !this.closing
    await this.port?.close().catch(() => {})
    this.port = null
    onClosed(unexpected)
  }
}
