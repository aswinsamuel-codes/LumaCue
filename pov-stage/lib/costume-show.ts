/**
 * Costume show data for the LumaCue Costume tab.
 * DEMO_SHOW mirrors the show compiled into firmware/bench_sync_test/test_costume
 * (SHOW_ID 1). Keep the two in step until shows are uploaded instead of compiled in.
 */

export type CostumeEffect = 'off' | 'solid' | 'flash' | 'chase'

export interface CostumeCue {
  startMs: number
  durationMs: number
  zones: number[]   // 0 = A, 1 = B, 2 = C
  effect: CostumeEffect
  color: string
  param?: number    // flash: period ms (50 % duty) · chase: ms per lap
  label: string
}

export interface CostumeShow {
  id: number
  name: string
  lengthMs: number
  cues: CostumeCue[]
}

export const COSTUME_ZONE_LABELS = ['Zone A', 'Zone B', 'Zone C']

const RED = '#FF0000'
const GREEN = '#00FF00'
const YELLOW = '#FFA000'
const ALL = [0, 1, 2]

export const DEMO_SHOW: CostumeShow = {
  id: 1,
  name: 'Bench demo',
  lengthMs: 30000,
  cues: [
    { startMs: 0, durationMs: 2000, zones: ALL, effect: 'off', color: '#000000', label: 'Dark' },
    { startMs: 2000, durationMs: 4000, zones: ALL, effect: 'solid', color: RED, label: 'All red' },
    { startMs: 6000, durationMs: 4000, zones: [0], effect: 'solid', color: RED, label: 'A red' },
    { startMs: 6000, durationMs: 4000, zones: [1], effect: 'solid', color: GREEN, label: 'B green' },
    { startMs: 6000, durationMs: 4000, zones: [2], effect: 'solid', color: YELLOW, label: 'C yellow' },
    { startMs: 10000, durationMs: 10000, zones: ALL, effect: 'flash', color: YELLOW, param: 1000, label: 'Sync flash 1 Hz' },
    { startMs: 20000, durationMs: 6000, zones: ALL, effect: 'chase', color: GREEN, param: 900, label: 'Green chase' },
    { startMs: 26000, durationMs: 2000, zones: ALL, effect: 'flash', color: RED, param: 250, label: 'Fast red flash' },
  ],
}

/** Colour of each zone at show time t (null = dark), same rules as the firmware. */
export function zoneColorsAt(show: CostumeShow, t: number, zoneCount = 3): (string | null)[] {
  const out: (string | null)[] = Array(zoneCount).fill(null)
  if (t < 0 || t >= show.lengthMs) return out

  for (const cue of show.cues) {
    if (t < cue.startMs || t >= cue.startMs + cue.durationMs) continue
    const zones = cue.zones.filter((z) => z < zoneCount)
    const p = cue.param ?? 0

    if (cue.effect === 'chase') {
      if (!zones.length || !p) continue
      const head = Math.floor(((t % p) * zones.length) / p)
      zones.forEach((z, k) => { out[z] = k === head ? cue.color : null })
      continue
    }

    const lit = cue.effect === 'solid' || (cue.effect === 'flash' && p > 0 && t % p < p / 2)
    zones.forEach((z) => { out[z] = lit ? cue.color : null })
  }
  return out
}

export function activeCueIndexes(show: CostumeShow, t: number): number[] {
  return show.cues.flatMap((c, i) => (t >= c.startMs && t < c.startMs + c.durationMs ? [i] : []))
}

export function formatShowTime(ms: number) {
  const s = Math.max(0, ms) / 1000
  const m = Math.floor(s / 60)
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`
}
