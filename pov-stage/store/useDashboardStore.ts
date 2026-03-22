import { create } from 'zustand'

export type ZoneMode = 'Static' | 'Pulse' | 'Flash'

export interface Zone {
  id: string
  name: string
  enabled: boolean
  mode: ZoneMode
  speed: number
  color: string
}

export interface PresetColor {
  color: string
  duration: number
}

export interface Preset {
  id: string
  name: string
  colors: PresetColor[]
  loop: boolean
}

export type LogType = 'INFO' | 'WARN' | 'ERROR' | 'ACTION' | 'SYNC'

export interface LogEntry {
  id: string
  time: string
  type: LogType
  message: string
}

interface DashboardState {
  connected: boolean
  zones: Zone[]
  activeColor: string
  favoriteColors: string[]
  presets: Preset[]
  logs: LogEntry[]
  setConnected: (v: boolean) => void
  toggleZone: (id: string) => void
  setZoneMode: (id: string, mode: ZoneMode) => void
  setZoneSpeed: (id: string, speed: number) => void
  setZoneColor: (id: string, color: string) => void
  setActiveColor: (color: string) => void
  saveFavoriteColor: (color: string) => void
  removeFavoriteColor: (color: string) => void
  addPreset: (preset: Preset) => void
  updatePreset: (preset: Preset) => void
  deletePreset: (id: string) => void
  applyToAllZones: () => void
  syncAll: () => void
  emergencyOff: () => void
  addLog: (type: LogType, message: string) => void
}

function timestamp() {
  return new Date().toLocaleTimeString('en-US', { hour12: false })
}

function makeId() {
  return Math.random().toString(36).slice(2, 9)
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  connected: true,
  zones: [
    { id: 'a', name: 'Zone A', enabled: true, mode: 'Static', speed: 50, color: '#3B82F6' },
    { id: 'b', name: 'Zone B', enabled: true, mode: 'Pulse', speed: 60, color: '#A855F7' },
    { id: 'c', name: 'Zone C', enabled: false, mode: 'Flash', speed: 40, color: '#EC4899' },
  ],
  activeColor: '#3B82F6',
  favoriteColors: ['#FF0000', '#00FF88'],
  presets: [
    {
      id: makeId(),
      name: 'Wave',
      loop: true,
      colors: [
        { color: '#FF0000', duration: 1000 },
        { color: '#3B82F6', duration: 1000 },
        { color: '#00FF88', duration: 1000 },
      ],
    },
    {
      id: makeId(),
      name: 'Sunset',
      loop: false,
      colors: [
        { color: '#FF6B00', duration: 800 },
        { color: '#FF0080', duration: 800 },
        { color: '#7C00FF', duration: 800 },
      ],
    },
  ],
  logs: [
    { id: makeId(), time: timestamp(), type: 'INFO', message: 'System initialized' },
    { id: makeId(), time: timestamp(), type: 'INFO', message: 'Connected to POV.STAGE controller' },
  ],

  setConnected: (v) => set({ connected: v }),

  toggleZone: (id) => {
    const zone = get().zones.find((z) => z.id === id)
    if (!zone) return
    const enabled = !zone.enabled
    set((s) => ({ zones: s.zones.map((z) => z.id === id ? { ...z, enabled } : z) }))
    get().addLog('ACTION', `${zone.name} turned ${enabled ? 'ON' : 'OFF'}`)
  },

  setZoneMode: (id, mode) => {
    const zone = get().zones.find((z) => z.id === id)
    set((s) => ({ zones: s.zones.map((z) => z.id === id ? { ...z, mode } : z) }))
    if (zone) get().addLog('INFO', `${zone.name} → Mode: ${mode}`)
  },

  setZoneSpeed: (id, speed) => {
    set((s) => ({ zones: s.zones.map((z) => z.id === id ? { ...z, speed } : z) }))
  },

  setZoneColor: (id, color) => {
    const zone = get().zones.find((z) => z.id === id)
    set((s) => ({ zones: s.zones.map((z) => z.id === id ? { ...z, color } : z) }))
    if (zone) get().addLog('INFO', `${zone.name} → Color ${color.toUpperCase()}`)
  },

  setActiveColor: (color) => set({ activeColor: color }),

  saveFavoriteColor: (color) => {
    if (get().favoriteColors.includes(color)) return
    set((s) => ({ favoriteColors: [...s.favoriteColors, color] }))
    get().addLog('ACTION', `Color ${color.toUpperCase()} saved to favorites`)
  },

  removeFavoriteColor: (color) => {
    set((s) => ({ favoriteColors: s.favoriteColors.filter((c) => c !== color) }))
  },

  addPreset: (preset) => {
    set((s) => ({ presets: [...s.presets, preset] }))
    get().addLog('ACTION', `Preset "${preset.name}" created`)
  },

  updatePreset: (preset) => {
    set((s) => ({ presets: s.presets.map((p) => p.id === preset.id ? preset : p) }))
    get().addLog('ACTION', `Preset "${preset.name}" updated`)
  },

  deletePreset: (id) => {
    const preset = get().presets.find((p) => p.id === id)
    set((s) => ({ presets: s.presets.filter((p) => p.id !== id) }))
    if (preset) get().addLog('WARN', `Preset "${preset.name}" deleted`)
  },

  applyToAllZones: () => {
    const color = get().activeColor
    set((s) => ({ zones: s.zones.map((z) => ({ ...z, color })) }))
    get().addLog('SYNC', `Active color ${color.toUpperCase()} applied to all zones`)
  },

  syncAll: () => {
    get().addLog('SYNC', 'All zones synchronized')
  },

  emergencyOff: () => {
    set((s) => ({ zones: s.zones.map((z) => ({ ...z, enabled: false })) }))
    get().addLog('ERROR', 'EMERGENCY OFF — All zones disabled')
  },

  addLog: (type, message) => {
    const entry: LogEntry = { id: makeId(), time: timestamp(), type, message }
    set((s) => ({ logs: [...s.logs.slice(-199), entry] }))
  },
}))
