/**
 * A pretend base station for rehearsing Show Mode with no hardware. It answers
 * the same commands as firmware/bench_sync_test/base_station and prints the
 * same lines, and its clock runs deliberately off (like a real Nano's
 * resonator) so the music-sync readout has something to correct.
 */
import type { BaseCommand, BaseLink } from '@/lib/base-station-serial'

export interface SimulatedBaseOptions {
  clockPpm?: number                 // + = runs fast. Default +2000 (0.2 %)
  showLengthMs: () => number
  now?: () => number                // true time, ms (performance.now in the browser)
}

export class SimulatedBase implements BaseLink {
  private onLine: ((line: string) => void) | null = null
  private onClosed: ((unexpected: boolean) => void) | null = null
  private running = false
  private beacons = true
  private runId = 0
  private runStart = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private readonly ppm: number
  private readonly now: () => number

  constructor(private readonly o: SimulatedBaseOptions) {
    this.ppm = o.clockPpm ?? 2000
    this.now = o.now ?? (() => performance.now())
  }

  /** This board's millis(). */
  private millis() { return Math.floor(this.now() * (1 + this.ppm * 1e-6)) }
  private showMs() { return this.millis() - this.runStart }
  private say(line: string) { queueMicrotask(() => this.onLine?.(line)) }

  isConnected() { return this.onLine !== null }

  async connect(onLine: (line: string) => void, onClosed: (unexpected: boolean) => void) {
    this.onLine = onLine
    this.onClosed = onClosed
    this.say('LumaCue base station (SIMULATOR) - Powered by Aswin Samuel')
    this.say('Radio OK. Commands: a=ARM s=START b=BLACKOUT n=beacons ?=status')
    this.timer = setInterval(() => this.loop(), 50)
  }

  async disconnect() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.running = false
    const closed = this.onClosed
    this.onLine = null
    this.onClosed = null
    closed?.(false)
  }

  async send(command: BaseCommand) {
    if (!this.onLine) throw new Error('Base station not connected')
    if (command === 'ARM') this.say('ARM sent for show 1')
    else if (command === 'START') {
      this.runId = (this.runId + 1) & 255
      this.runStart = this.millis()
      this.running = true
      this.say(`START run ${this.runId}`)
    } else if (command === 'BLACKOUT') {
      this.running = false
      this.say('BLACKOUT sent')
    } else if (command === 'BEACONS') {
      this.beacons = !this.beacons
      this.say(`beacons ${this.beacons ? 'on' : 'off'}`)
    } else if (command === 'STATUS') {
      this.say(`show=1 run=${this.runId} running=${this.running ? 'yes' : 'no'}${this.running ? ` t=${this.showMs()}` : ''} beacons=${this.beacons ? 'on' : 'off'}`)
    } else if (/^T\d+$/.test(command)) {
      if (!this.running) return
      const music = Number(command.slice(1))
      const err = this.showMs() - music
      this.runStart = this.millis() - music
      this.say(`sync err_ms=${err}`)
    }
  }

  private loop() {
    if (this.running && this.showMs() >= this.o.showLengthMs()) {
      this.running = false
      this.say('show ended')
    }
  }
}
