/**
 * USB serial link to the LumaCue base station (firmware/bench_sync_test/base_station)
 * using Web Serial. Works in Chrome / Edge on desktop only.
 * The base takes line commands: ARM, START, BLACKOUT, BEACONS, STATUS,
 * S<ms> (start from <ms>) and T<ms> (music sync: where the laptop's music is now).
 */

// Minimal Web Serial typings (not in the default TS DOM lib).
interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>
  close(): Promise<void>
  readable: ReadableStream<Uint8Array> | null
  writable: WritableStream<Uint8Array> | null
}
interface SerialLike extends EventTarget {
  requestPort(): Promise<SerialPortLike>
  getPorts(): Promise<SerialPortLike[]>
}

function serial() {
  return (navigator as Navigator & { serial: SerialLike }).serial
}

export type BaseCommand = 'ARM' | 'START' | 'BLACKOUT' | 'BEACONS' | 'STATUS' | `T${number}` | `S${number}`

/** What the store needs from a base station: the real one over USB, or the simulator. */
export interface BaseLink {
  isConnected(): boolean
  connect(onLine: (line: string) => void, onClosed: (unexpected: boolean) => void, port?: SerialPortLike): Promise<void>
  send(command: BaseCommand): Promise<void>
  disconnect(): Promise<void>
}

export function isWebSerialSupported() {
  return typeof navigator !== 'undefined' && 'serial' in navigator
}

export class BaseStationSerial implements BaseLink {
  private port: SerialPortLike | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private closing = false
  private opening = false

  isConnected() {
    return this.port !== null
  }

  /**
   * Opens the base station's COM port, then reads lines until closed.
   * Without a port, asks the user to pick one (needs a click).
   */
  async connect(onLine: (line: string) => void, onClosed: (unexpected: boolean) => void, port?: SerialPortLike) {
    if (this.port || this.opening) return
    this.opening = true
    try {
      port ??= await serial().requestPort()
      await port.open({ baudRate: 115200 })
    } finally {
      this.opening = false
    }
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

/** A port the user already picked before (Chrome remembers it), if one is plugged in now. */
export async function findKnownPort(): Promise<SerialPortLike | null> {
  if (!isWebSerialSupported()) return null
  const ports = await serial().getPorts()
  return ports[0] ?? null
}

/** Calls back when a previously picked port is plugged in again. Returns an unsubscribe function. */
export function onKnownPortPlugged(callback: (port: SerialPortLike) => void) {
  if (!isWebSerialSupported()) return () => {}
  const handler = (e: Event) => callback(e.target as unknown as SerialPortLike)
  serial().addEventListener('connect', handler)
  return () => serial().removeEventListener('connect', handler)
}

export type { SerialPortLike }
