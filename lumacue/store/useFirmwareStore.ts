import { create } from 'zustand'

/**
 * Remembers which show each dancer's costume firmware was built from, so Show
 * Mode can warn when the show was edited after a costume was flashed.
 * Kept in the browser (localStorage); it records downloads, not uploads.
 */
export interface FirmwareRecord {
  fingerprint: string
  output: '5mm' | 'strip'
  board?: 'nano' | 'esp32'   // missing on records from before the ESP32 option = nano
  downloadedAt: number
}

const STORAGE_KEY = 'lumacue.firmware.v1'

function load(): Record<number, FirmwareRecord> {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

interface FirmwareState {
  byDancer: Record<number, FirmwareRecord>
  recordDownload: (dancer: number, rec: FirmwareRecord) => void
  forget: () => void
}

export const useFirmwareStore = create<FirmwareState>((set, get) => ({
  byDancer: load(),
  recordDownload: (dancer, rec) => {
    const byDancer = { ...get().byDancer, [dancer]: rec }
    set({ byDancer })
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(byDancer)) } catch { /* storage blocked */ }
  },
  forget: () => {
    set({ byDancer: {} })
    try { window.localStorage.removeItem(STORAGE_KEY) } catch { /* storage blocked */ }
  },
}))
