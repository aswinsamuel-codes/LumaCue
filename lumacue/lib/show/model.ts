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

export function formatShowTime(ms: number) {
  const s = Math.max(0, ms) / 1000
  const m = Math.floor(s / 60)
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`
}

export type ParseResult =
  | { ok: true; project: ShowProject; warnings: string[] }
  | { ok: false; error: string }

const EFFECT_IDS = new Set<string>(EFFECTS.map((e) => e.id))
const HEX = /^#[0-9a-fA-F]{6}$/
const MAX_LENGTH_MS = 60 * 60 * 1000
const MAX_DANCERS = 50

/**
 * Checks a show read from a file or browser storage and repairs what it safely
 * can (missing colours, out-of-range numbers), dropping clips that can't be
 * repaired. Anything that isn't a LumaCue show at all is refused, so a bad
 * file gives a clear message instead of crashing the editor on every frame.
 */
export function parseShowProject(x: unknown): ParseResult {
  if (!x || typeof x !== 'object') return { ok: false, error: 'not a LumaCue show (no data)' }
  const raw = x as Record<string, unknown>
  if (raw.version !== 1) return { ok: false, error: raw.version === undefined ? 'not a LumaCue show (no version)' : `show file version ${String(raw.version)} is not supported by this LumaCue` }
  if (!Array.isArray(raw.clips)) return { ok: false, error: 'not a LumaCue show (no clips list)' }

  const warnings: string[] = []
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : NaN)
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

  let lengthMs = num(raw.lengthMs)
  if (!(lengthMs > 0)) { warnings.push('Show length was missing; set to 30 s'); lengthMs = 30000 }
  if (lengthMs > MAX_LENGTH_MS) { warnings.push('Show length was over 60 min; cut to 60 min'); lengthMs = MAX_LENGTH_MS }
  let dancers = Math.round(num(raw.dancers))
  if (!(dancers >= 1)) { warnings.push('Dancer count was missing; set to 1'); dancers = 1 }
  if (dancers > MAX_DANCERS) { warnings.push(`Dancer count was over ${MAX_DANCERS}; cut to ${MAX_DANCERS}`); dancers = MAX_DANCERS }

  const clips: Clip[] = []
  const ids = new Set<string>()
  let dropped = 0, repaired = 0
  for (const c of raw.clips as unknown[]) {
    if (!c || typeof c !== 'object') { dropped++; continue }
    const r = c as Record<string, unknown>
    const startMs = num(r.startMs), durationMs = num(r.durationMs)
    const effect = typeof r.effect === 'string' && EFFECT_IDS.has(r.effect) ? (r.effect as EffectId) : null
    const track = Math.round(num(r.track ?? ALL_DANCERS))
    if (!effect || !(startMs >= 0) || !(durationMs > 0) || !(track >= ALL_DANCERS) || track >= dancers || startMs >= lengthMs) { dropped++; continue }
    let fixed = false
    const validHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v)
    if (!validHex(r.color) || (r.color2 !== undefined && !validHex(r.color2))) fixed = true
    const color = validHex(r.color) ? r.color : '#FFFFFF'
    const color2 = validHex(r.color2) ? r.color2 : '#000000'
    if (r.zones !== undefined && !Array.isArray(r.zones)) fixed = true
    const zones = Array.isArray(r.zones) ? r.zones.filter((z): z is string => typeof z === 'string') : []
    const speedRaw = num(r.speed)
    const speed = Number.isFinite(speedRaw) ? clamp(speedRaw, 0, 100) : 50
    if (Number.isFinite(speedRaw) && speed !== speedRaw) fixed = true
    let id = typeof r.id === 'string' && r.id ? r.id : makeId()
    if (ids.has(id)) { id = makeId(); fixed = true }
    ids.add(id)
    if (fixed) repaired++
    clips.push({ id, track, startMs, durationMs, effect, color, color2, zones, speed })
  }
  if (dropped) warnings.push(`${dropped} clip${dropped > 1 ? 's' : ''} couldn't be read and ${dropped > 1 ? 'were' : 'was'} left out`)
  if (repaired) warnings.push(`${repaired} clip${repaired > 1 ? 's' : ''} had missing or invalid settings and ${repaired > 1 ? 'were' : 'was'} repaired`)

  return {
    ok: true,
    warnings,
    project: {
      version: 1,
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'Untitled show',
      dancers,
      lengthMs,
      audioName: typeof raw.audioName === 'string' ? raw.audioName : null,
      clips,
    },
  }
}
