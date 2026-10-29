import { create } from 'zustand'
import type { BenchResult } from '@/lib/show/bench-tests'

/** Bench test results, kept in this browser until copied into the README. */
const STORAGE_KEY = 'lumacue.benchlog.v1'

function load(): Record<string, BenchResult> {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, BenchResult> = {}
    for (const [id, v] of Object.entries(parsed as Record<string, Partial<BenchResult>>)) {
      if (v && typeof v === 'object') {
        const status = v.status === 'pass' || v.status === 'fail' || v.status === 'partial' ? v.status : null
        out[id] = { status, date: String(v.date ?? ''), mode: String(v.mode ?? ''), notes: String(v.notes ?? '') }
      }
    }
    return out
  } catch {
    return {}
  }
}

interface BenchLogState {
  results: Record<string, BenchResult>
  setResult: (id: string, patch: Partial<BenchResult>) => void
  /** Un-choose the result but keep the mode and notes. */
  clearStatus: (id: string) => void
}

const today = () => new Date().toISOString().slice(0, 10)

function save(set: (s: Partial<BenchLogState>) => void, results: Record<string, BenchResult>) {
  set({ results })
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(results)) } catch { /* storage blocked */ }
}

export const useBenchLogStore = create<BenchLogState>((set, get) => ({
  results: load(),
  setResult: (id, patch) => {
    // Typing notes doesn't choose a result; choosing one stamps today's date (also on a retest).
    const prev = get().results[id] ?? { status: null, date: '', mode: '', notes: '' }
    const next = { ...prev, ...patch, ...(patch.status ? { date: today() } : {}) }
    save(set, { ...get().results, [id]: next })
  },
  clearStatus: (id) => {
    const prev = get().results[id]
    if (prev) save(set, { ...get().results, [id]: { ...prev, status: null } })
  },
}))
