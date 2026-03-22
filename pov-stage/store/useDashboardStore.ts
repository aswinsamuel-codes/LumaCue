import { create } from 'zustand'
import { getWebSocketClient } from '@/lib/websocket-client'
import type { WSMessage } from '@/lib/websocket-client'

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
  hardwareConnected: boolean
  zones: Zone[]
  activeColor: string
  favoriteColors: string[]
  presets: Preset[]
  logs: LogEntry[]
  authenticated: boolean
  setConnected: (v: boolean) => void
  setHardwareConnected: (v: boolean) => void
  setAuthenticated: (v: boolean) => void
  addZone: (name: string) => void
  deleteZone: (id: string) => void
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
  initializeWebSocket: () => void
}

function timestamp() {
  return new Date().toLocaleTimeString('en-US', { hour12: false })
}

function makeId() {
  return Math.random().toString(36).slice(2, 9)
}

// WebSocket client instance
let wsClient: ReturnType<typeof getWebSocketClient> | null = null

function sendToHardware(command: any) {
  if (wsClient && wsClient.isConnected()) {
    wsClient.send(command)
  }
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  connected: true,
  hardwareConnected: false,
  authenticated: false,
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
  setHardwareConnected: (v) => set({ hardwareConnected: v }),
  setAuthenticated: (v) => set({ authenticated: v }),

  initializeWebSocket: () => {
    if (typeof window === 'undefined') return

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080'
    wsClient = getWebSocketClient(wsUrl)

    wsClient.onMessage((message: WSMessage) => {
      switch (message.type) {
        case 'connection':
          get().setHardwareConnected(true)
          get().addLog('INFO', 'Connected to hardware controller')
          break
        
        case 'log':
          get().addLog(message.logType, message.message)
          break
        
        case 'error':
          get().addLog('ERROR', message.message)
          break
        
        case 'gpio_status':
          // Update zones with hardware status if needed
          break
      }
    })

    wsClient.connect().catch(error => {
      // Hardware not available - continue without it
      get().setHardwareConnected(false)
    })
  },

  addZone: (name) => {
    const id = makeId()
    const newZone: Zone = { id, name, enabled: false, mode: 'Static', speed: 50, color: '#3B82F6' }
    set((s) => ({ zones: [...s.zones, newZone] }))
    get().addLog('ACTION', `${name} created`)
  },

  deleteZone: (id) => {
    const zone = get().zones.find((z) => z.id === id)
    set((s) => ({ zones: s.zones.filter((z) => z.id !== id) }))
    if (zone) get().addLog('WARN', `${zone.name} deleted`)
  },

  toggleZone: (id) => {
    const zone = get().zones.find((z) => z.id === id)
    if (!zone) return
    const enabled = !zone.enabled
    set((s) => ({ zones: s.zones.map((z) => z.id === id ? { ...z, enabled } : z) }))
    get().addLog('ACTION', `${zone.name} turned ${enabled ? 'ON' : 'OFF'}`)
    
    // Send to hardware
    sendToHardware({ zone: zone.name, action: 'toggle', enabled })
  },

  setZoneMode: (id, mode) => {
    const zone = get().zones.find((z) => z.id === id)
    set((s) => ({ zones: s.zones.map((z) => z.id === id ? { ...z, mode } : z) }))
    if (zone) {
      get().addLog('INFO', `${zone.name} → Mode: ${mode}`)
      sendToHardware({ zone: zone.name, action: 'setMode', mode, speed: zone.speed })
    }
  },

  setZoneSpeed: (id, speed) => {
    const zone = get().zones.find((z) => z.id === id)
    set((s) => ({ zones: s.zones.map((z) => z.id === id ? { ...z, speed } : z) }))
    if (zone) {
      sendToHardware({ zone: zone.name, action: 'setSpeed', speed })
    }
  },

  setZoneColor: (id, color) => {
    const zone = get().zones.find((z) => z.id === id)
    set((s) => ({ zones: s.zones.map((z) => z.id === id ? { ...z, color } : z) }))
    if (zone) {
      get().addLog('INFO', `${zone.name} → Color ${color.toUpperCase()}`)
      sendToHardware({ zone: zone.name, action: 'setColor', color })
    }
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
    
    // Send to all zones
    get().zones.forEach(zone => {
      sendToHardware({ zone: zone.name, action: 'setColor', color })
    })
  },

  syncAll: () => {
    get().addLog('SYNC', 'All zones synchronized')
    sendToHardware({ zone: '', action: 'syncAll' })
  },

  emergencyOff: () => {
    set((s) => ({ zones: s.zones.map((z) => ({ ...z, enabled: false })) }))
    get().addLog('ERROR', 'EMERGENCY OFF — All zones disabled')
    sendToHardware({ zone: '', action: 'emergencyOff' })
  },

  addLog: (type, message) => {
    const entry: LogEntry = { id: makeId(), time: timestamp(), type, message }
    set((s) => ({ logs: [...s.logs.slice(-199), entry] }))
  },
}))
