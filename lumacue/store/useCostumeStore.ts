import { create } from 'zustand'
import { BaseStationSerial, findKnownPort, isWebSerialSupported, onKnownPortPlugged } from '@/lib/base-station-serial'
import type { BaseCommand, BaseLink, SerialPortLike } from '@/lib/base-station-serial'
import { SimulatedBase } from '@/lib/sync/simulated-base'
import { useShowStore } from '@/store/useShowStore'
import { useDashboardStore } from '@/store/useDashboardStore'
import type { LogType } from '@/store/useDashboardStore'
import { PLACEMENTS } from '@/lib/show/body'
import { parseCostume } from '@/lib/show/model'
import { COSTUME_TEMPLATES } from '@/lib/show/templates'
import type { Placement } from '@/lib/show/body'

export interface CostumeZone {
  id: string
  name: string
  leds: number
  placement: Placement   // where the strip sits on the body (digital twin)
}

interface CostumeState {
  zones: CostumeZone[]
  brightness: number          // % of full, applied in costume firmware
  baseConnected: boolean
  baseKind: 'usb' | 'simulator' | null
  /** Keep the base station's show clock on the music (T command every 2 s). */
  musicSync: boolean
  /** Base clock minus music at the last sync, ms (+ = base was ahead). */
  baseDriftMs: number | null
  /**
   * How long the venue's speakers lag the laptop (mixer, wireless, Bluetooth), ms.
   * START and music sync are held back by this much so lights land on what the audience hears.
   */
  speakerDelayMs: number
  setSpeakerDelay: (ms: number) => void
  /** SHOW_LENGTH_MS compiled into the base station (from STATUS), if known. */
  baseShowLengthMs: number | null
  armed: boolean
  running: boolean
  beaconsOn: boolean
  addZone: (name: string, leds: number) => void
  updateZone: (id: string, patch: Partial<Omit<CostumeZone, 'id'>>) => void
  deleteZone: (id: string) => void
  /** Replace every zone, e.g. from a costume template. */
  setZones: (zones: CostumeZone[], label?: string) => void
  setBrightness: (v: number) => void
  connectBase: (port?: SerialPortLike) => Promise<void>
  connectSimulator: () => Promise<void>
  setMusicSync: (on: boolean) => void
  /** Tell the base where the music is now. Called by Show Mode while running. */
  syncToMusic: (musicMs: number) => void
  /** Base clock error in parts per million, measured with music sync off (bench test T12). */
  baseDriftPpm: number | null
  /** With music sync off: ask the base for its show time to measure its drift against the music. */
  measureDrift: (musicMs: number) => void
  watchBaseStation: () => void
  disconnectBase: () => Promise<void>
  arm: () => void
  /** Start the costumes, optionally from the middle of the show (rehearsal). */
  start: (fromMs?: number) => void
  blackout: () => void
  toggleBeacons: () => void
  showEnded: () => void
}

// The bench base station and costume firmware both use show id 1 (SHOW_ID).
export const FIRMWARE_SHOW_ID = 1

function makeId() {
  return Math.random().toString(36).slice(2, 9)
}

function log(type: LogType, message: string) {
  useDashboardStore.getState().addLog(type, `Costume · ${message}`)
}

const SPEAKER_DELAY_KEY = 'lumacue.speakerDelayMs'
export const MAX_SPEAKER_DELAY_MS = 1000

function loadSpeakerDelay() {
  try {
    const v = Number(typeof window !== 'undefined' ? window.localStorage.getItem(SPEAKER_DELAY_KEY) : 0)
    return Number.isFinite(v) ? Math.max(0, Math.min(MAX_SPEAKER_DELAY_MS, v)) : 0
  } catch {
    return 0
  }
}

/** The music time when measureDrift() asked the base for STATUS. */
let pendingDrift: { musicMs: number } | null = null
/** Where the current run started (Start from), for the drift rate. */
let startedFromMs = 0

const usbBase = new BaseStationSerial()
let base: BaseLink = usbBase
let watching = false

/** Handles a line printed by the base station (real or simulated). */
function onBaseLine(line: string) {
  const store = useCostumeStore.getState()
  const sync = /^sync err_ms=(-?\d+)$/.exec(line)
  if (sync) {
    const err = Number(sync[1])
    useCostumeStore.setState({ baseDriftMs: err })
    // Only big corrections are worth a log line; small ones are routine.
    if (Math.abs(err) >= 20) log('WARN', `Base clock was ${err > 0 ? '+' : ''}${err} ms off the music; corrected`)
    return
  }
  if (line === 'start point is past the end of the show') {
    // The base's firmware is for a shorter show: nothing started.
    useCostumeStore.setState({ running: false, armed: false })
    log('ERROR', 'Base station refused the start point (past the end of the show its firmware has), so the costumes did NOT start. Upload base_station.ino for this show')
    return
  }
  if (/^unknown command: S\d+/.test(line)) {
    // Older base firmware: the costumes did not start.
    useCostumeStore.setState({ running: false, armed: false })
    log('ERROR', 'This base station firmware cannot start from the middle, so the costumes did NOT start. Upload the latest base_station.ino, or start from 0:00')
    return
  }
  if (/^unknown command: T\d+/.test(line)) {
    if (store.musicSync) log('WARN', 'This base station firmware has no music sync (T command). Upload the latest base_station.ino; sync turned off')
    useCostumeStore.setState({ musicSync: false })
    return
  }
  const len = /\blen=(\d+)\b/.exec(line)
  if (len) useCostumeStore.setState({ baseShowLengthMs: Number(len[1]) })
  // A STATUS asked for by measureDrift(): compare the base's show time with the music.
  const t = /\brunning=yes t=(\d+)\b/.exec(line)
  if (t && pendingDrift) {
    const drift = Math.round(Number(t[1]) - pendingDrift.musicMs)
    const elapsed = pendingDrift.musicMs - startedFromMs // drift builds up from START, not from 0:00
    const ppm = elapsed > 5000 ? Math.round((drift / elapsed) * 1e6) : null
    pendingDrift = null
    useCostumeStore.setState({ baseDriftMs: drift, baseDriftPpm: ppm })
    return // routine: not worth a log line every 5 s
  }
  log('INFO', `Base: ${line}`)
  if (line === 'show ended') store.showEnded()
}

function onBaseClosed(unexpected: boolean) {
  useCostumeStore.setState({ baseConnected: false, baseKind: null, baseDriftMs: null, baseDriftPpm: null, baseShowLengthMs: null })
  log(
    unexpected ? 'ERROR' : 'INFO',
    unexpected
      ? 'Base station USB lost. Costumes keep playing their stored show; plug it back in to reconnect automatically'
      : 'Base station disconnected',
  )
}

async function sendToBase(command: BaseCommand) {
  if (!base.isConnected()) return
  try {
    await base.send(command)
  } catch (e) {
    log('ERROR', `Failed to send ${command}: ${(e as Error).message}`)
  }
}

// The "Bench test" template: matches the bench firmware, 3 zones × 20 LEDs (1 m of 60 LED/m)
const DEFAULT_ZONES: CostumeZone[] = COSTUME_TEMPLATES.find((t) => t.id === 'bench')!.zones.map((z) => ({ ...z }))
const COSTUME_KEY = 'lumacue.costume.v1'

/** Costume setup saved in this browser (same checks as a show file's); defaults if missing or damaged. */
function loadCostume(): { zones: CostumeZone[]; brightness: number } {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(COSTUME_KEY) : null
    const saved = raw ? parseCostume(JSON.parse(raw)) : null
    return saved ?? { zones: DEFAULT_ZONES, brightness: 25 }
  } catch {
    return { zones: DEFAULT_ZONES, brightness: 25 }
  }
}

export const useCostumeStore = create<CostumeState>((set, get) => ({
  ...loadCostume(),
  baseConnected: false,
  baseKind: null,
  musicSync: true,
  baseDriftMs: null,
  baseShowLengthMs: null,
  baseDriftPpm: null,
  speakerDelayMs: loadSpeakerDelay(),
  setSpeakerDelay: (ms) => {
    const v = Math.max(0, Math.min(MAX_SPEAKER_DELAY_MS, Math.round(ms) || 0))
    set({ speakerDelayMs: v })
    try { window.localStorage.setItem(SPEAKER_DELAY_KEY, String(v)) } catch { /* storage blocked */ }
  },
  armed: false,
  running: false,
  beaconsOn: true,

  addZone: (name, leds) => {
    const used = new Set(get().zones.map((z) => z.placement))
    const placement = PLACEMENTS.find((pl) => !used.has(pl.id))?.id ?? 'belt'
    set((s) => ({ zones: [...s.zones, { id: makeId(), name, leds, placement }] }))
    log('ACTION', `${name} added (${leds} LEDs)`)
  },

  updateZone: (id, patch) => {
    set((s) => ({ zones: s.zones.map((z) => (z.id === id ? { ...z, ...patch } : z)) }))
  },

  deleteZone: (id) => {
    const zone = get().zones.find((z) => z.id === id)
    set((s) => ({ zones: s.zones.filter((z) => z.id !== id) }))
    if (zone) log('WARN', `${zone.name} removed`)
  },

  setZones: (zones, label) => {
    set({ zones })
    log('ACTION', `Costume set up${label ? ` (${label})` : ''}: ${zones.length} zones, ${zones.reduce((n, z) => n + z.leds, 0)} LEDs`)
  },

  setBrightness: (v) => set({ brightness: v }),

  connectBase: async (port) => {
    if (!isWebSerialSupported()) {
      log('ERROR', 'USB serial needs Chrome or Edge on a desktop')
      return
    }
    if (base.isConnected()) return
    try {
      base = usbBase
      await base.connect(onBaseLine, onBaseClosed, port)
      // Opening the port resets the Nano, so the base starts fresh: idle, beacons on.
      if (get().running) log('WARN', 'Base station restarted: its show clock was reset. Costumes keep their own clock')
      set({ baseConnected: true, baseKind: 'usb', beaconsOn: true, armed: false, running: false, baseDriftMs: null, baseShowLengthMs: null })
      // Opening the port resets the Nano; ask for its show length once it has booted.
      setTimeout(() => void sendToBase('STATUS'), 2500)
      log('SYNC', `Base station connected (USB${port ? ', automatic' : ''})`)
    } catch (e) {
      const msg = (e as Error).message
      // Closing the port picker without choosing is not an error worth shouting about.
      if (msg.includes('No port selected')) log('INFO', 'Base station not connected: no port chosen')
      else log('ERROR', `Base station not connected: ${msg}. Is the Arduino Serial Monitor still open on that port?`)
    }
  },

  connectSimulator: async () => {
    if (base.isConnected()) return
    base = new SimulatedBase({ showLengthMs: () => useShowStore.getState().project.lengthMs })
    await base.connect(onBaseLine, onBaseClosed)
    set({ baseConnected: true, baseKind: 'simulator', beaconsOn: true, armed: false, running: false, baseDriftMs: null, baseShowLengthMs: null })
    void sendToBase('STATUS')
    log('SYNC', 'Simulated base station connected (no hardware). Its clock runs 0.2 % fast on purpose')
  },

  setMusicSync: (on) => {
    // The readout means something different in each mode, so start it afresh.
    set({ musicSync: on, baseDriftMs: null, baseDriftPpm: null })
    log('INFO', `Music sync ${on ? 'on' : 'off: the base station keeps its own clock'}`)
  },

  measureDrift: (musicMs) => {
    const { running, baseConnected, musicSync, speakerDelayMs } = get()
    if (!running || !baseConnected || musicSync) return
    pendingDrift = { musicMs: musicMs - speakerDelayMs }
    void sendToBase('STATUS')
  },

  syncToMusic: (musicMs) => {
    const { running, baseConnected, musicSync } = get()
    if (!running || !baseConnected || !musicSync) return
    // The audience hears the music speakerDelayMs late, so the lights run that much behind the laptop.
    const heard = musicMs - get().speakerDelayMs
    if (heard < 0) return
    void sendToBase(`T${Math.round(heard)}`)
  },

  watchBaseStation: () => {
    if (watching || !isWebSerialSupported()) return
    watching = true
    // Reconnect to a base station picked earlier: now, and whenever it is plugged back in.
    void findKnownPort().then((port) => { if (port) void get().connectBase(port) })
    onKnownPortPlugged((port) => {
      log('INFO', 'Base station plugged in')
      if (!base.isConnected()) void get().connectBase(port)
    })
  },

  disconnectBase: async () => {
    await base.disconnect()
  },

  arm: () => {
    set({ armed: true })
    log('ACTION', `ARM show ${FIRMWARE_SHOW_ID}${get().baseConnected ? '' : ' (preview only, no base station)'}`)
    void sendToBase('ARM')
  },

  start: (fromMs = 0) => {
    const from = Math.max(0, Math.round(fromMs))
    startedFromMs = from
    set({ running: true, baseDriftMs: null, baseDriftPpm: null })
    log('SYNC', `START show ${FIRMWARE_SHOW_ID}${from ? ` from ${(from / 1000).toFixed(1)} s` : ''}${get().baseConnected ? '' : ' (preview only, no base station)'}`)
    void sendToBase(from ? `S${from}` : 'START')
  },

  blackout: () => {
    set({ running: false, armed: false })
    log('ERROR', 'BLACKOUT — all costumes off')
    void sendToBase('BLACKOUT')
  },

  toggleBeacons: () => {
    const beaconsOn = !get().beaconsOn
    set({ beaconsOn })
    log('INFO', `Time beacons ${beaconsOn ? 'on' : 'off (drift test)'}`)
    void sendToBase('BEACONS')
  },

  showEnded: () => {
    if (!get().running) return
    set({ running: false, armed: false })
    log('INFO', 'Show ended')
  },
}))

// Keep Costume setup across reloads (sections and firmware downloads refer to these zone ids).
useCostumeStore.subscribe((s, prev) => {
  if (s.zones === prev.zones && s.brightness === prev.brightness) return
  try { window.localStorage.setItem(COSTUME_KEY, JSON.stringify({ zones: s.zones, brightness: s.brightness })) } catch { /* storage blocked */ }
})
