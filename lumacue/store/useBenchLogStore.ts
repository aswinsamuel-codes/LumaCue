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
      if (v && (v.status === 'pass' || v.status === 'fail' || v.status === 'partial')) {
        out[id] = { status: v.status, date: String(v.date ?? ''), mode: String(v.mode ?? ''), notes: String(v.notes ?? '') }
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
  clearResult: (id: string) => void
}

const today = () => new Date().toISOString().slice(0, 10)

export const useBenchLogStore = create<BenchLogState>((set, get) => ({
  results: load(),
  setResult: (id, patch) => {
    const prev = get().results[id] ?? { status: 'pass' as const, date: today(), mode: '', notes: '' }
    const results = { ...get().results, [id]: { ...prev, ...patch } }
    set({ results })
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(results)) } catch { /* storage blocked */ }
  },
  clearResult: (id) => {
    const { [id]: _gone, ...results } = get().results
    void _gone
    set({ results })
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(results)) } catch { /* storage blocked */ }
  },
}))
