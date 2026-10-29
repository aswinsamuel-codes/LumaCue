import { create } from 'zustand'
import { BaseStationSerial, findKnownPort, isWebSerialSupported, onKnownPortPlugged } from '@/lib/base-station-serial'
import type { BaseCommand, SerialPortLike } from '@/lib/base-station-serial'
import { DEMO_SHOW } from '@/lib/costume-show'
import { useDashboardStore } from '@/store/useDashboardStore'
import type { LogType } from '@/store/useDashboardStore'

export interface CostumeZone {
  id: string
  name: string
  leds: number
}

interface CostumeState {
  zones: CostumeZone[]
  brightness: number          // % of full, applied in costume firmware
  baseConnected: boolean
  armed: boolean
  running: boolean
  showStartedAt: number | null  // performance.now() when START was sent
  beaconsOn: boolean
  addZone: (name: string, leds: number) => void
  updateZone: (id: string, patch: Partial<Omit<CostumeZone, 'id'>>) => void
  deleteZone: (id: string) => void
  setBrightness: (v: number) => void
  connectBase: (port?: SerialPortLike) => Promise<void>
  watchBaseStation: () => void
  disconnectBase: () => Promise<void>
  arm: () => void
  start: () => void
  blackout: () => void
  toggleBeacons: () => void
  showEnded: () => void
}

function makeId() {
  return Math.random().toString(36).slice(2, 9)
}

function log(type: LogType, message: string) {
  useDashboardStore.getState().addLog(type, `Costume · ${message}`)
}

const base = new BaseStationSerial()
let watching = false

async function sendToBase(command: BaseCommand) {
  if (!base.isConnected()) return
  try {
    await base.send(command)
  } catch (e) {
    log('ERROR', `Failed to send ${command}: ${(e as Error).message}`)
  }
}

export const useCostumeStore = create<CostumeState>((set, get) => ({
  // Matches the bench firmware: 3 zones × 20 LEDs (1 m of 60 LED/m)
  zones: [
    { id: 'a', name: 'Zone A — arms', leds: 20 },
    { id: 'b', name: 'Zone B — chest', leds: 20 },
    { id: 'c', name: 'Zone C — legs', leds: 20 },
  ],
  brightness: 25,
  baseConnected: false,
  armed: false,
  running: false,
  showStartedAt: null,
  beaconsOn: true,

  addZone: (name, leds) => {
    set((s) => ({ zones: [...s.zones, { id: makeId(), name, leds }] }))
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

  setBrightness: (v) => set({ brightness: v }),

  connectBase: async (port) => {
    if (!isWebSerialSupported()) {
      log('ERROR', 'USB serial needs Chrome or Edge on a desktop')
      return
    }
    if (base.isConnected()) return
    try {
      await base.connect(
        (line) => {
          log('INFO', `Base: ${line}`)
          if (line === 'show ended') get().showEnded()
        },
        (unexpected) => {
          set({ baseConnected: false })
          log(
            unexpected ? 'ERROR' : 'INFO',
            unexpected
              ? 'Base station USB lost. Costumes keep playing their stored show; plug it back in to reconnect automatically'
              : 'Base station disconnected',
          )
        },
        port,
      )
      // Opening the port resets the Nano, so the base starts fresh: idle, beacons on.
      if (get().running) log('WARN', 'Base station restarted: its show clock was reset. Costumes keep their own clock')
      set({ baseConnected: true, beaconsOn: true, armed: false, running: false, showStartedAt: null })
      log('SYNC', `Base station connected (USB${port ? ', automatic' : ''})`)
    } catch (e) {
      const msg = (e as Error).message
      // Closing the port picker without choosing is not an error worth shouting about.
      if (msg.includes('No port selected')) log('INFO', 'Base station not connected: no port chosen')
      else log('ERROR', `Base station not connected: ${msg}. Is the Arduino Serial Monitor still open on that port?`)
    }
  },

  watchBaseStation: () => {
    if (watching || !isWebSerialSupported()) return
    watching = true
    // Reconnect to a base station picked earlier: now, and whenever it is plugged back in.
    void findKnownPort().then((port) => { if (port) void get().connectBase(port) })
    onKnownPortPlugged((port) => {
      log('INFO', 'Base station plugged in')
      void get().connectBase(port)
    })
  },

  disconnectBase: async () => {
    await base.disconnect()
  },

  arm: () => {
    set({ armed: true })
    log('ACTION', `ARM show ${DEMO_SHOW.id}${get().baseConnected ? '' : ' (preview only, no base station)'}`)
    void sendToBase('ARM')
  },

  start: () => {
    set({ running: true, showStartedAt: performance.now() })
    log('SYNC', `START show ${DEMO_SHOW.id}${get().baseConnected ? '' : ' (preview only, no base station)'}`)
    void sendToBase('START')
  },

  blackout: () => {
    set({ running: false, armed: false, showStartedAt: null })
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
