/**
 * "Spread across dancers": turns one clip into a copy on each dancer's track,
 * each starting a little later, so the effect travels down the line (the
 * hand-sweep look). Copies that would start after the show ends are dropped.
 */
import { makeId } from '@/lib/show/model'
import type { Clip } from '@/lib/show/model'

export type SpreadOrder = 'forward' | 'reverse' | 'center-out' | 'edges-in'

export const SPREAD_ORDERS: { id: SpreadOrder; label: string }[] = [
  { id: 'forward', label: 'D1 → last' },
  { id: 'reverse', label: 'Last → D1' },
  { id: 'center-out', label: 'Centre out' },
  { id: 'edges-in', label: 'Edges in' },
]

/** How many steps after the clip's start dancer d begins. */
export function spreadSlot(d: number, dancers: number, order: SpreadOrder) {
  const mid = (dancers - 1) / 2
  switch (order) {
    case 'forward': return d
    case 'reverse': return dancers - 1 - d
    case 'center-out': return Math.round(Math.abs(d - mid) * 2) / 2
    case 'edges-in': return Math.round((mid - Math.abs(d - mid)) * 2) / 2
  }
}

export function spreadAcrossDancers(clip: Clip, dancers: number, stepMs: number, order: SpreadOrder, lengthMs: number): Clip[] {
  const out: Clip[] = []
  for (let d = 0; d < dancers; d++) {
    const startMs = Math.round(clip.startMs + spreadSlot(d, dancers, order) * stepMs)
    if (startMs >= lengthMs) continue
    out.push({ ...clip, id: makeId(), track: d, startMs, durationMs: Math.min(clip.durationMs, lengthMs - startMs) })
  }
  return out
}
