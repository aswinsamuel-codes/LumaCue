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

/** Records saved in this browser; anything damaged is ignored rather than crashing the page. */
function load(): Record<number, FirmwareRecord> {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<number, FirmwareRecord> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const r = v as Partial<FirmwareRecord> | null
      if (!/^\d+$/.test(k) || !r || typeof r.fingerprint !== 'string' || (r.output !== '5mm' && r.output !== 'strip')) continue
      out[Number(k)] = { fingerprint: r.fingerprint, output: r.output, downloadedAt: Number(r.downloadedAt) || 0, ...(r.board === 'esp32' || r.board === 'nano' ? { board: r.board } : {}) }
    }
    return out
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
