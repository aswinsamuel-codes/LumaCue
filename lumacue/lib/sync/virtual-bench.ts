/**
 * Virtual bench: the base station and N costumes from firmware/bench_sync_test,
 * simulated together with imperfect clocks and a lossy radio. The costume and
 * base logic mirror the sketches line by line (state machine, START ×3, 500 ms
 * beacons, clock easing/snap, late join, link loss, blackout), so the sync
 * protocol can be tested before any hardware exists.
 *
 * Time unit: ms of "true" time. Each board's millis() runs fast or slow by its
 * clock error in ppm. The laptop's music clock is the true time.
 */

export interface CostumeSpec {
  clockPpm: number       // + = this board's millis() runs fast
  bootAtMs?: number      // powered on at this true time (for late-join tests)
  lossPct?: number       // overrides the radio loss for this costume
}

export interface BenchSimOptions {
  showLengthMs: number
  baseClockPpm: number           // base station's clock error vs the laptop's music
  costumes: CostumeSpec[]
  lossPct: number                // chance each packet is missed, per costume
  latencyMs?: number             // air time + processing (firmware assumes 1)
  beacons?: boolean
  /** Laptop sends its music position to the base every N ms (0 = never). Needs the base T command. */
  musicSyncEveryMs?: number
  seed?: number
}

// Firmware constants (test_costume.ino / base_station.ino)
const RADIO_LATENCY_MS = 1
const SNAP_MS = 40
const LINK_LOST_MS = 2000
const BEACON_INTERVAL_MS = 500
const START_REPEATS = 3
const START_REPEAT_GAP = 20

type PacketType = 'ARM' | 'START' | 'BEACON' | 'BLACKOUT'
interface Packet { type: PacketType; runId: number; seq: number; showMs: number }

type CostumeState = 'IDLE' | 'ARMED' | 'RUNNING' | 'DONE'

function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >>> 17
    s ^= s << 5; s >>>= 0
    return s / 4294967296
  }
}

/** A board's millis() at true time T (uint32 arithmetic is not needed for shows < 49 days). */
const millisOf = (T: number, bootAt: number, ppm: number) => Math.floor((T - bootAt) * (1 + ppm * 1e-6))

class VirtualCostume {
  state: CostumeState = 'IDLE'
  runId = 0
  showStartMillis = 0
  lastPacketMillis = 0
  linkLost = false
  rx = 0
  log: string[] = []
  constructor(readonly spec: Required<CostumeSpec>, private readonly showLengthMs: number) {}

  millis(T: number) { return millisOf(T, this.spec.bootAtMs, this.spec.clockPpm) }
  powered(T: number) { return T >= this.spec.bootAtMs }

  /** Show time on this costume at true time T, or null if it isn't playing. */
  showTime(T: number) { return this.state === 'RUNNING' ? this.millis(T) - this.showStartMillis : null }

  private beginRun(p: Packet, T: number, late: boolean) {
    this.runId = p.runId
    this.showStartMillis = this.millis(T) - p.showMs - RADIO_LATENCY_MS
    this.state = 'RUNNING'
    this.linkLost = false
    this.log.push(`${late ? 'LATE JOIN' : 'START'} run ${p.runId} at t=${p.showMs}`)
  }

  private correctClock(p: Packet, T: number) {
    const expected = p.showMs + RADIO_LATENCY_MS
    const local = this.millis(T) - this.showStartMillis
    const err = local - expected
    // C integer division truncates toward zero
    if (err > SNAP_MS || err < -SNAP_MS) this.showStartMillis += err
    else this.showStartMillis += Math.trunc(err / 2)
  }

  onPacket(p: Packet, T: number) {
    this.rx++
    this.lastPacketMillis = this.millis(T)
    if (this.linkLost) { this.linkLost = false; this.log.push('link back') }
    switch (p.type) {
      case 'ARM':
        if (this.state !== 'RUNNING') this.state = 'ARMED'
        break
      case 'START':
      case 'BEACON':
        if (this.state === 'RUNNING' && p.runId === this.runId) this.correctClock(p, T)
        else if (this.state === 'DONE' && p.runId === this.runId && p.type === 'BEACON') { /* blacked out: stay dark */ }
        else if (p.showMs < this.showLengthMs) this.beginRun(p, T, p.type === 'BEACON')
        break
      case 'BLACKOUT':
        this.state = 'DONE'
        break
    }
  }

  loop(T: number) {
    if (this.state !== 'RUNNING') return
    const m = this.millis(T)
    if (m - this.showStartMillis >= this.showLengthMs) { this.state = 'DONE'; this.log.push('show ended') }
    else if (!this.linkLost && m - this.lastPacketMillis > LINK_LOST_MS) { this.linkLost = true; this.log.push('link lost') }
  }
}

export interface SimSample {
  t: number                      // true time = music position (ms since START)
  baseShowMs: number | null
  costumeShowMs: (number | null)[]
}

export interface SimResult {
  samples: SimSample[]
  /** Worst |costume − music| while playing, per costume (ms). */
  maxErrorVsMusic: number[]
  /** Worst spread between any two playing costumes (ms). */
  maxSpread: number
  costumeLogs: string[][]
  packetsSent: number
}

export type SimEvent =
  | { atMs: number; do: 'ARM' | 'START' | 'BLACKOUT' | 'BEACONS_OFF' | 'BEACONS_ON' }
  | { atMs: number; do: 'RADIO'; lossPct: number }

/**
 * Runs the bench in 1 ms steps. `events` are laptop/operator actions at true
 * times; true time 0 is when the simulation starts (boards boot at 0 unless
 * bootAtMs says otherwise).
 */
export function simulateBench(o: BenchSimOptions, events: SimEvent[], untilMs: number, sampleEveryMs = 100): SimResult {
  const rand = rng(o.seed ?? 1)
  const latency = o.latencyMs ?? 1
  let loss = o.lossPct
  const costumes = o.costumes.map((c) => new VirtualCostume({ clockPpm: c.clockPpm, bootAtMs: c.bootAtMs ?? 0, lossPct: c.lossPct ?? -1 }, o.showLengthMs))

  // Base station state (base_station.ino)
  const baseMillis = (T: number) => millisOf(T, 0, o.baseClockPpm)
  let running = false
  let beacons = o.beacons ?? true
  let runId = 0, seq = 0, runStartMillis = 0, lastBeaconMs = 0
  let musicStartT = 0   // true time the laptop started the music
  let nextMusicSync = Infinity
  let sent = 0
  const inFlight: { at: number; to: VirtualCostume; p: Packet }[] = []
  const pending: { at: number; fn: () => void }[] = []

  const send = (type: PacketType, showMs: number, T: number) => {
    const p: Packet = { type, runId, seq: seq++ & 255, showMs }
    sent++
    for (const c of costumes) {
      const l = c.spec.lossPct >= 0 ? c.spec.lossPct : loss
      if (!c.powered(T + latency) || rand() * 100 < l) continue
      inFlight.push({ at: T + latency, to: c, p })
    }
  }

  const sortedEvents = [...events].sort((a, b) => a.atMs - b.atMs)
  let ev = 0
  const samples: SimSample[] = []
  const maxErr = costumes.map(() => 0)
  let maxSpread = 0

  for (let T = 0; T <= untilMs; T++) {
    // Operator / laptop actions
    while (ev < sortedEvents.length && sortedEvents[ev].atMs <= T) {
      const e = sortedEvents[ev++]
      if (e.do === 'RADIO') { loss = e.lossPct; continue }
      if (e.do === 'ARM') for (let i = 0; i < 3; i++) pending.push({ at: T + i * START_REPEAT_GAP, fn: () => send('ARM', 0, T + i * START_REPEAT_GAP) })
      if (e.do === 'START') {
        // The laptop starts the music and sends START over USB at the same moment.
        runId = (runId + 1) & 255
        runStartMillis = baseMillis(T)
        running = true
        musicStartT = T
        for (let i = 0; i < START_REPEATS; i++) {
          const at = T + i * START_REPEAT_GAP
          pending.push({ at, fn: () => send('START', baseMillis(at) - runStartMillis, at) })
        }
        lastBeaconMs = 2 * START_REPEAT_GAP
        nextMusicSync = o.musicSyncEveryMs ? T + o.musicSyncEveryMs : Infinity
      }
      if (e.do === 'BLACKOUT') { running = false; for (let i = 0; i < 5; i++) pending.push({ at: T + i * 5, fn: () => send('BLACKOUT', 0, T + i * 5) }) }
      if (e.do === 'BEACONS_OFF') beacons = false
      if (e.do === 'BEACONS_ON') beacons = true
    }
    for (let i = pending.length - 1; i >= 0; i--) if (pending[i].at <= T) { pending[i].fn(); pending.splice(i, 1) }

    // Laptop → base: "T <music ms>" re-anchors the base show clock to the music.
    if (running && T >= nextMusicSync) {
      runStartMillis = baseMillis(T) - (T - musicStartT)
      lastBeaconMs = Math.min(lastBeaconMs, baseMillis(T) - runStartMillis) // clock went back: keep beaconing
      nextMusicSync += o.musicSyncEveryMs!
    }

    // Base loop()
    if (running) {
      const t = baseMillis(T) - runStartMillis
      if (t >= o.showLengthMs) running = false
      else if (beacons && t - lastBeaconMs >= BEACON_INTERVAL_MS) { send('BEACON', t, T); lastBeaconMs = t }
    }

    // Radio delivery, then each costume's loop()
    for (let i = 0; i < inFlight.length; i++) {
      if (inFlight[i].at <= T) { inFlight[i].to.onPacket(inFlight[i].p, T); inFlight.splice(i--, 1) }
    }
    for (const c of costumes) if (c.powered(T)) c.loop(T)

    // Measure against the music
    const music = T - musicStartT
    const shows = costumes.map((c) => c.showTime(T))
    if (runId > 0) {
      const playing = shows.filter((s): s is number => s !== null)
      if (playing.length > 1) maxSpread = Math.max(maxSpread, Math.max(...playing) - Math.min(...playing))
      shows.forEach((s, i) => { if (s !== null) maxErr[i] = Math.max(maxErr[i], Math.abs(s - music)) })
    }
    if (T % sampleEveryMs === 0) samples.push({ t: music, baseShowMs: running ? baseMillis(T) - runStartMillis : null, costumeShowMs: shows })
  }

  return { samples, maxErrorVsMusic: maxErr, maxSpread, costumeLogs: costumes.map((c) => c.log), packetsSent: sent }
}
