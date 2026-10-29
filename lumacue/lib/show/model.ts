/**
 * LumaCue show file. A show is a list of clips on tracks: one track drives
 * every costume, and each dancer has their own track layered on top.
 */

export type EffectId = 'solid' | 'fade' | 'pulse' | 'strobe' | 'chase' | 'wipe' | 'rainbow' | 'twinkle' | 'blackout'

/** Track number for clips that play on every costume. Dancer tracks are 0, 1, 2… */
export const ALL_DANCERS = -1

export interface Clip {
  id: string
  track: number
  startMs: number
  durationMs: number
  effect: EffectId
  color: string
  color2: string
  zones: string[]   // costume zone ids; empty = whole costume
  speed: number     // 0–100
}

export interface ShowProject {
  version: 1
  name: string
  dancers: number
  lengthMs: number
  audioName: string | null
  clips: Clip[]
}

export interface EffectInfo {
  id: EffectId
  label: string
  short: string
  hint: string
  usesColor2?: boolean
  usesSpeed?: boolean
}

export const EFFECTS: EffectInfo[] = [
  { id: 'solid', label: 'Solid', short: 'SOL', hint: 'One steady colour' },
  { id: 'fade', label: 'Fade', short: 'FAD', hint: 'Blend from colour 1 to colour 2 over the clip', usesColor2: true },
  { id: 'pulse', label: 'Pulse', short: 'PLS', hint: 'Smooth breathing', usesSpeed: true },
  { id: 'strobe', label: 'Strobe', short: 'STR', hint: 'Hard on/off flashes', usesSpeed: true },
  { id: 'chase', label: 'Chase', short: 'CHS', hint: 'A light segment runs along the strip', usesSpeed: true },
  { id: 'wipe', label: 'Wipe', short: 'WIP', hint: 'Fills the strip from start to end over the clip' },
  { id: 'rainbow', label: 'Rainbow', short: 'RBW', hint: 'Moving colour wheel', usesSpeed: true },
  { id: 'twinkle', label: 'Twinkle', short: 'TWK', hint: 'Random sparkles', usesSpeed: true },
  { id: 'blackout', label: 'Blackout', short: 'OFF', hint: 'Forces LEDs dark (masks clips below)' },
]

export const EFFECT_BY_ID = Object.fromEntries(EFFECTS.map((e) => [e.id, e])) as Record<EffectId, EffectInfo>

export function trackLabel(track: number) {
  return track === ALL_DANCERS ? 'All costumes' : `Dancer ${track + 1}`
}

export function makeId() {
  return Math.random().toString(36).slice(2, 9)
}

/** A short starter show so the editor isn't empty on first open. */
export function starterProject(): ShowProject {
  const clip = (track: number, startMs: number, durationMs: number, effect: EffectId, color: string, extra: Partial<Clip> = {}): Clip => ({
    id: makeId(), track, startMs, durationMs, effect, color, color2: '#000000', zones: [], speed: 50, ...extra,
  })
  return {
    version: 1,
    name: 'New show',
    dancers: 5,
    lengthMs: 30000,
    audioName: null,
    clips: [
      clip(ALL_DANCERS, 0, 3000, 'fade', '#000000', { color2: '#00E5FF' }),
      clip(ALL_DANCERS, 3000, 4000, 'chase', '#00E5FF', { speed: 60 }),
      clip(ALL_DANCERS, 7000, 3000, 'strobe', '#FFFFFF', { speed: 70 }),
      clip(0, 10000, 2000, 'wipe', '#FF0055'),
      clip(1, 10500, 2000, 'wipe', '#FF0055'),
      clip(2, 11000, 2000, 'wipe', '#FF0055'),
      clip(3, 11500, 2000, 'wipe', '#FF0055'),
      clip(4, 12000, 2000, 'wipe', '#FF0055'),
      clip(ALL_DANCERS, 14000, 6000, 'rainbow', '#FFFFFF', { speed: 40 }),
      clip(ALL_DANCERS, 20000, 5000, 'twinkle', '#FFD000', { speed: 55 }),
      clip(ALL_DANCERS, 25000, 5000, 'pulse', '#7C3AED', { speed: 45 }),
    ],
  }
}

export function isShowProject(x: unknown): x is ShowProject {
  const p = x as ShowProject
  return !!p && p.version === 1 && Array.isArray(p.clips) && typeof p.lengthMs === 'number' && typeof p.dancers === 'number'
}

export function formatShowTime(ms: number) {
  const s = Math.max(0, ms) / 1000
  const m = Math.floor(s / 60)
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`
}
