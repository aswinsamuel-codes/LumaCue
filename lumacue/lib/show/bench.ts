/**
 * The bench costume (firmware/bench_sync_test/test_costume) in TypeScript.
 *
 * compileBenchCues() turns one dancer's clips into the firmware's cue table
 * (3 zones, effects OFF/SOLID/FLASH/CHASE and the canvas effects RISE/SWEEP/RIPPLE,
 * which use each LED's position on the body: benchPositions()/PIX_POS). renderBench() is a line-by-line
 * port of the sketch's render(), so the Show Studio can show exactly what the
 * Nano will light, and tests can compare it with the editor's own preview.
 * If you change applyCue()/render() in test_costume.ino, change this too.
 */
import { ALL_DANCERS } from '@/lib/show/model'
import type { Clip, EffectId, ShowProject } from '@/lib/show/model'
import { activeClips, hexToRgb, lapMs, speedHz } from '@/lib/show/render'
import { buildLayout } from '@/lib/show/body'
import { sampleZone } from '@/lib/show/body'
import type { ZoneShape } from '@/lib/show/body'
import { bandLevel, blend, canvasCoord, toCanvas } from '@/lib/show/canvas'
import type { CanvasEffect } from '@/lib/show/canvas'

export type BenchFx = 'FX_OFF' | 'FX_SOLID' | 'FX_FLASH' | 'FX_CHASE' | 'FX_RISE' | 'FX_SWEEP' | 'FX_RIPPLE'

const CANVAS_FX: Record<CanvasEffect, BenchFx> = { rise: 'FX_RISE', sweep: 'FX_SWEEP', ripple: 'FX_RIPPLE' }
const FX_CANVAS: Partial<Record<BenchFx, CanvasEffect>> = { FX_RISE: 'rise', FX_SWEEP: 'sweep', FX_RIPPLE: 'ripple' }
export type BenchOutput = '5mm' | 'strip'

export interface BenchCue {
  startMs: number
  durationMs: number   // ≤ 65535 (uint16 in the firmware)
  zoneMask: number     // bit 0 = ZA, 1 = ZB, 2 = ZC
  fx: BenchFx
  r: number
  g: number
  b: number
  param: number        // FLASH: period ms. CHASE: ms per lap. ≤ 65535
  source: 'all' | 'own'
  effect: EffectId     // the editor effect this cue came from
  section?: string     // set on the OFF cues that keep a section's zones dark
}

export interface BenchCompileResult {
  cues: BenchCue[]
  notes: string[]
}

export const MAX_DURATION = 65535
/**
 * Cues that fit in the Nano's 30 KB of flash. Measured 30 Oct 2026 with
 * arduino-cli (AVR core 1.8.7): each cue costs ~13 bytes; the WS2812B build
 * without cues is ~12.7 KB, so ~1,250 cues fill 95 %. Kept below that.
 */
export const CUE_BUDGET = 1100
/** Time steps tried for effects built from a series of solid colours, finest first. */
const STEPS_MS = [250, 500, 1000]

const ZONE_BITS = [1, 2, 4]
export const ZALL = 7

function hsv(h: number): [number, number, number] {
  const i = Math.floor(h * 6), f = h * 6 - i
  const q = 1 - f, t = f
  const [r, g, b] = [[1, t, 0], [q, 1, 0], [0, 1, t], [0, q, 1], [t, 0, 1], [1, 0, q]][((i % 6) + 6) % 6]
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

const lerp = (a: number, b: number, u: number) => Math.round(a + (b - a) * u)

/**
 * One dancer's part of the show as bench cues, in play order (later cues win).
 * Effects the firmware lacks are rebuilt from the ones it has where that looks
 * close (fade, wipe, rainbow as steps of solid colour), otherwise approximated.
 */
export function compileBenchCues(project: ShowProject, zoneIds: string[], dancer: number, output: BenchOutput = 'strip'): BenchCompileResult {
  // Use the finest colour steps that still fit in flash.
  let result = compileWithStep(project, zoneIds, dancer, STEPS_MS[0], output)
  for (const step of STEPS_MS.slice(1)) {
    if (result.cues.length <= CUE_BUDGET) break
    result = compileWithStep(project, zoneIds, dancer, step, output)
  }
  if (result.cues.length > CUE_BUDGET) result.notes.push(`${result.cues.length} cues may not fit in the Nano's flash (about ${CUE_BUDGET} do). Shorten fades/rainbows or split the show.`)
  return result
}

function compileWithStep(project: ShowProject, zoneIds: string[], dancer: number, stepMs: number, output: BenchOutput): BenchCompileResult {
  const notes = new Set<string>()
  const cues: BenchCue[] = []

  const clips = project.clips
    .filter((c) => c.track === ALL_DANCERS || c.track === dancer)
    // Same layering as the simulation: all-costume clips first, the dancer's own on top.
    .sort((a, b) => (a.track === ALL_DANCERS ? 0 : 1) - (b.track === ALL_DANCERS ? 0 : 1) || a.startMs - b.startMs)

  if (zoneIds.length > 3) notes.add(`Only the first 3 costume zones exist on the bench; ${zoneIds.slice(3).join(', ')} are not exported.`)

  for (const c of clips) {
    // Zones this clip lights, as bench zone indexes (0–2).
    const targets = c.zones.length ? c.zones : zoneIds
    let idx = [...new Set(targets.map((id) => zoneIds.indexOf(id)).filter((i) => i >= 0 && i < 3))].sort()
    if (!idx.length && zoneIds.length) {
      notes.add(`A ${c.effect} clip at ${(c.startMs / 1000).toFixed(1)} s only targets zones the bench doesn't have, so it was skipped.`)
      continue
    }
    if (!idx.length) idx = [0, 1, 2] // no zones set up yet: the whole bench costume
    const mask = idx.reduce((m, i) => m | ZONE_BITS[i], 0)

    // Nothing plays after the show ends, so don't spend flash on it.
    const start = Math.round(c.startMs)
    const end = Math.min(Math.round(c.startMs + c.durationMs), Math.round(project.lengthMs))
    if (end <= start) continue

    const source = c.track === ALL_DANCERS ? 'all' : 'own'
    const push = (s: number, e: number, zoneMask: number, fx: BenchFx, rgb: [number, number, number], param = 0) => {
      const p = Math.max(0, Math.min(MAX_DURATION, Math.round(param)))
      // Long clips are split (durationMs is uint16). Split on whole flash/chase
      // periods so the pattern carries on without a jump at the seam.
      const piece = p > 0 ? Math.floor(MAX_DURATION / p) * p : MAX_DURATION
      for (let t = s; t < e; t += piece) {
        cues.push({ startMs: t, durationMs: Math.min(e - t, piece), zoneMask, fx, r: rgb[0], g: rgb[1], b: rgb[2], param: p, source, effect: c.effect })
      }
    }
    const rgb = hexToRgb(c.color)
    const steps = (from: number, to: number, fn: (t0: number, t1: number) => void) => {
      for (let t = from; t < to; t += stepMs) fn(t, Math.min(to, t + stepMs))
    }

    switch (c.effect) {
      case 'solid': push(start, end, mask, 'FX_SOLID', rgb); break
      case 'blackout': push(start, end, mask, 'FX_OFF', [0, 0, 0]); break
      case 'strobe':
        push(start, end, mask, 'FX_FLASH', rgb, 1000 / (speedHz(c.speed) * 2))
        notes.add('Strobe flashes are 50 % on (25 % in the preview).')
        break
      case 'pulse':
        push(start, end, mask, 'FX_FLASH', rgb, 2000 / speedHz(c.speed))
        notes.add('Pulse is played as a slow flash (no dimming in bench firmware).')
        break
      case 'twinkle':
        push(start, end, mask, 'FX_FLASH', rgb, Math.max(60, 1000 / (speedHz(c.speed) * 4)))
        notes.add('Twinkle is played as a fast flash (no random sparkles in bench firmware).')
        break
      case 'chase':
        // Strip: one cue per zone, so each zone runs its own head like the preview.
        // 5 mm: one LED per zone, so the light runs across the zones instead.
        if (output === 'strip') idx.forEach((z) => push(start, end, ZONE_BITS[z], 'FX_CHASE', rgb, 2000 / speedHz(c.speed)))
        else {
          push(start, end, mask, 'FX_CHASE', rgb, 2000 / speedHz(c.speed))
          notes.add('Chase runs across the 5 mm LEDs (one per zone).')
        }
        break
      case 'wipe': {
        // Light the clip's zones one after another, so the costume fills up zone by zone.
        const full = c.durationMs
        idx.forEach((z, k) => {
          const s = Math.round(c.startMs + (full * k) / idx.length)
          if (s < end) push(s, end, ZONE_BITS[z], 'FX_SOLID', rgb)
        })
        notes.add('Wipe fills the costume zone by zone (not LED by LED).')
        break
      }
      case 'fade': {
        const c2 = hexToRgb(c.color2)
        steps(start, end, (t0, t1) => {
          const u = Math.min(1, (t0 + stepMs / 2 - c.startMs) / Math.max(1, c.durationMs))
          push(t0, t1, mask, 'FX_SOLID', [lerp(rgb[0], c2[0], u), lerp(rgb[1], c2[1], u), lerp(rgb[2], c2[2], u)])
        })
        notes.add(`Fade is played in ${stepMs} ms colour steps.`)
        break
      }
      case 'rise':
      case 'sweep':
      case 'ripple':
        // The firmware moves the band by each LED's position (PIX_POS), like the preview.
        push(start, end, mask, CANVAS_FX[c.effect], rgb, lapMs(c.speed))
        break
      case 'rainbow': {
        const hz = speedHz(c.speed)
        steps(start, end, (t0, t1) => {
          const t = (t0 + stepMs / 2 - c.startMs) / 1000
          idx.forEach((z, k) => push(t0, t1, ZONE_BITS[z], 'FX_SOLID', hsv(((k + 0.5) / idx.length + (t * hz) / 4) % 1)))
        })
        notes.add(`Rainbow is played as one colour per zone, changing every ${stepMs} ms.`)
        break
      }
    }
  }

  // Sections: OFF cues on their dark zones, last in the table so they win over every clip.
  for (const s of project.sections ?? []) {
    const end = Math.min(Math.round(s.endMs), Math.round(project.lengthMs))
    const start = Math.round(s.startMs)
    const mask = s.darkZones.map((id) => zoneIds.indexOf(id)).filter((i) => i >= 0 && i < 3).reduce((m, i) => m | ZONE_BITS[i], 0)
    if (!mask || end <= start) continue
    for (let t = start; t < end; t += MAX_DURATION) {
      cues.push({ startMs: t, durationMs: Math.min(end - t, MAX_DURATION), zoneMask: mask, fx: 'FX_OFF', r: 0, g: 0, b: 0, param: 0, source: 'all', effect: 'blackout', section: s.name })
    }
  }

  return { cues, notes: [...notes] }
}

export const DEFAULT_ZONE_LEDS = [20, 20, 20]
export const MAX_STRIP_PIXELS = 250

/**
 * LEDs in the strip build's zones A–C from Costume Setup's zone sizes: the
 * first 3 zones, missing ones 0, scaled down if the total is over 250
 * (the firmware counts pixels in a byte).
 */
export function benchZoneLeds(zoneLeds: number[]): [number, number, number] {
  const z = [0, 1, 2].map((i) => Math.max(0, Math.round(zoneLeds[i] ?? 0)))
  if (z[0] + z[1] + z[2] === 0) return [20, 20, 20]
  const total = z[0] + z[1] + z[2]
  if (total <= MAX_STRIP_PIXELS) return z as [number, number, number]
  const k = MAX_STRIP_PIXELS / total
  return z.map((v) => Math.floor(v * k)) as [number, number, number]
}

export function benchPixelCount(output: BenchOutput, zoneLeds = DEFAULT_ZONE_LEDS) {
  if (output === '5mm') return 3
  const [a, b, c] = benchZoneLeds(zoneLeds)
  return a + b + c
}

export function benchZoneOf(i: number, output: BenchOutput, zoneLeds = DEFAULT_ZONE_LEDS) {
  if (output === '5mm') return i
  const [a, b] = benchZoneLeds(zoneLeds)
  return i < a ? 0 : i < a + b ? 1 : 2
}

const zoneMapCache = new Map<string, Uint8Array>()
const ZONE_MAP_CACHE_MAX = 32
/** Zone of every pixel for one strip layout, computed once (renderBench runs thousands of times in a preflight). */
function zoneMap(output: BenchOutput, zoneLeds: number[]) {
  const key = output === '5mm' ? '5mm' : benchZoneLeds(zoneLeds).join(',')
  let m = zoneMapCache.get(key)
  if (!m) {
    m = Uint8Array.from({ length: benchPixelCount(output, zoneLeds) }, (_, i) => benchZoneOf(i, output, zoneLeds))
    if (zoneMapCache.size >= ZONE_MAP_CACHE_MAX) zoneMapCache.clear() // layouts edited over a long session
    zoneMapCache.set(key, m)
  }
  return m
}

/** A costume zone as the firmware needs it: LED count and where it sits on the body (preset or drawn lines). */
export type BenchZone = ZoneShape

const DEFAULT_SHAPES: ZoneShape[] = [{ leds: 20, placement: 'arms' }, { leds: 20, placement: 'chest' }, { leds: 20, placement: 'legs' }]

/**
 * Position on the body (0–255 x, y) of every firmware pixel: the PIX_POS table
 * LumaCue writes into the sketch. Strip: each LED along its zone's path, as in
 * the digital twin. 5 mm: one LED per zone, at the middle of that zone's path.
 */
export function benchPositions(output: BenchOutput, zones: BenchZone[] = []): Uint8Array {
  const shapes = [0, 1, 2].map((i) => zones[i] ?? DEFAULT_SHAPES[i])
  if (output === '5mm') {
    const out = new Uint8Array(6)
    shapes.forEach((shape, i) => {
      const pts = sampleZone(shape, 9)
      const [x, y] = toCanvas({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length })
      out[i * 2] = x
      out[i * 2 + 1] = y
    })
    return out
  }
  const sizes = benchZoneLeds(zones.length ? zones.map((z) => z.leds) : DEFAULT_ZONE_LEDS)
  const layout = buildLayout(shapes.map((shape, i) => ({ id: String(i), ...shape, leds: sizes[i] })))
  const out = new Uint8Array((sizes[0] + sizes[1] + sizes[2]) * 2)
  let i = 0
  for (const z of layout.zones) for (const p of z.points) { const [x, y] = toCanvas(p); out[i * 2] = x; out[i * 2 + 1] = y; i++ }
  return out
}

/**
 * Port of render()/applyCue() in test_costume.ino. Writes RGB per pixel into
 * `out` (pixels × 3). zoneLeds = the strip's zone sizes, as in the firmware;
 * pos = benchPositions() (PIX_POS), needed for the canvas effects.
 */
export function renderBench(cues: BenchCue[], t: number, output: BenchOutput, out: Uint8Array, zoneLeds = DEFAULT_ZONE_LEDS, pos?: Uint8Array) {
  const zoneOf = zoneMap(output, zoneLeds)
  const n = zoneOf.length
  out.fill(0)
  const inMask = (i: number, mask: number) => (mask & (1 << zoneOf[i])) !== 0
  const set = (i: number, r: number, g: number, b: number) => { out[i * 3] = r; out[i * 3 + 1] = g; out[i * 3 + 2] = b }

  for (const c of cues) {
    if (!(t >= c.startMs && t < c.startMs + c.durationMs)) continue
    if (c.fx === 'FX_OFF' || c.fx === 'FX_SOLID' || c.fx === 'FX_FLASH') {
      const lit = c.fx === 'FX_SOLID' || (c.fx === 'FX_FLASH' && c.param > 0 && (t - c.startMs) % c.param < Math.floor(c.param / 2))
      for (let i = 0; i < n; i++) if (inMask(i, c.zoneMask)) { if (lit) set(i, c.r, c.g, c.b); else set(i, 0, 0, 0) }
      continue
    }
    const canvas = FX_CANVAS[c.fx]
    if (canvas) {
      // Canvas effects: a soft band moves by LED position and blends over the pixel.
      if (!c.param || !pos) continue
      for (let i = 0; i < n; i++) {
        if (!inMask(i, c.zoneMask)) continue
        const k = bandLevel(t - c.startMs, c.param, canvasCoord(canvas, pos[i * 2], pos[i * 2 + 1]))
        set(i, blend(out[i * 3], c.r, k), blend(out[i * 3 + 1], c.g, k), blend(out[i * 3 + 2], c.b, k))
      }
      continue
    }
    // FX_CHASE
    let count = 0
    for (let i = 0; i < n; i++) if (inMask(i, c.zoneMask)) count++
    if (!count || !c.param) continue
    const head = Math.floor((((t - c.startMs) % c.param) * count) / c.param)
    const tail = count >= 10 ? Math.floor(count / 10) : 1
    let k = 0
    for (let i = 0; i < n; i++) {
      if (!inMask(i, c.zoneMask)) continue
      if ((head + count - k) % count < tail) set(i, c.r, c.g, c.b)
      else set(i, 0, 0, 0)
      k++
    }
  }
}

/**
 * What the eye sees from one bench pixel. The 5 mm bi-colour LED has a red and
 * a green die switched on at ≥ 128, so blue is lost and purple may go dark.
 */
export function benchVisibleColor(r: number, g: number, b: number, output: BenchOutput): [number, number, number] {
  if (output === 'strip') return [r, g, b]
  const red = r >= 128, green = g >= 128
  return red && green ? [255, 190, 0] : red ? [255, 0, 0] : green ? [0, 255, 0] : [0, 0, 0]
}

/** Parses a SHOW[] cue table (as exported, or as written in the sketch) back into cues. */
export function parseCueTable(text: string): Omit<BenchCue, 'source' | 'effect'>[] {
  const body = /const Cue SHOW\[\] PROGMEM = \{([\s\S]*?)\n\};/.exec(text)?.[1] ?? ''
  const masks: Record<string, number> = { ZA: 1, ZB: 2, ZC: 4, ZALL: 7 }
  const out: Omit<BenchCue, 'source' | 'effect'>[] = []
  const row = /\{\s*(\d+),\s*(\d+),\s*([A-Z| ]+),\s*(FX_\w+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\s*\}/g
  for (const line of body.split('\n')) {
    const code = line.replace(/\/\/.*$/, '')
    for (const m of code.matchAll(row)) {
      out.push({
        startMs: +m[1], durationMs: +m[2],
        zoneMask: m[3].split('|').reduce((a, z) => a | (masks[z.trim()] ?? 0), 0),
        fx: m[4] as BenchFx, r: +m[5], g: +m[6], b: +m[7], param: +m[8],
      })
    }
  }
  return out
}

export interface FidelityIssue {
  clipStartMs: number
  effect: EffectId
  track: number
  mismatchPct: number
}

export interface FidelityReport {
  matchPct: number          // share of (time × zone) samples where costume and preview agree
  /** 5 mm only: share of lit samples a red/green on/off LED can't show (blue, purple, white…, or too dim to switch on). */
  colourLossPct: number
  issues: FidelityIssue[]   // clips where they disagree most, worst first
}

/**
 * Compares the editor's preview with what the bench costume will show, zone by
 * zone every `stepMs`. A zone "agrees" when its average colour is within a
 * visible distance of the costume's (the strip zone's LEDs averaged).
 * On 5 mm LEDs both sides are first reduced to what a red/green LED can show,
 * so matchPct measures the export; colours the LED can't make at all are
 * counted separately in colourLossPct.
 */
export function benchFidelity(
  project: ShowProject,
  zoneIds: string[],
  dancer: number,
  renderZones: (t: number) => [number, number, number][],
  stepMs = 50,
  output: BenchOutput = 'strip',
  zoneLeds = DEFAULT_ZONE_LEDS,
  pos?: Uint8Array,
): FidelityReport {
  const { cues } = compileBenchCues(project, zoneIds, dancer, output)
  const sizes = benchZoneLeds(zoneLeds)
  const px = new Uint8Array(benchPixelCount(output, zoneLeds) * 3)
  const zones = Math.min(3, Math.max(1, zoneIds.length))
  let good = 0, total = 0, lit = 0, lost = 0
  const perClip = new Map<Clip, { bad: number; n: number }>()

  for (let t = stepMs / 2; t < project.lengthMs; t += stepMs) {
    renderBench(cues, t, output, px, zoneLeds, pos)
    const editor = renderZones(t)
    let badHere = 0
    for (let z = 0; z < zones; z++) {
      let r = 0, g = 0, b = 0
      if (output === 'strip') {
        const first = sizes.slice(0, z).reduce((x, y) => x + y, 0), count = sizes[z]
        if (!count) continue
        for (let i = first; i < first + count; i++) { r += px[i * 3] / count; g += px[i * 3 + 1] / count; b += px[i * 3 + 2] / count }
      } else {
        [r, g, b] = benchVisibleColor(px[z * 3], px[z * 3 + 1], px[z * 3 + 2], '5mm')
      }
      let [er, eg, eb] = editor[z] ?? [0, 0, 0]
      if (output === '5mm') {
        const v = benchVisibleColor(er, eg, eb, '5mm')
        if (er + eg + eb > 60) {
          lit++
          // Lost: the LED shows nothing, or something far from the intended colour.
          if (Math.hypot(v[0] - er, v[1] - eg, v[2] - eb) > 180 || v[0] + v[1] + v[2] === 0) lost++
        }
        ;[er, eg, eb] = v
      }
      const d = Math.hypot(r - er, g - eg, b - eb)
      total++
      if (d < 60) good++
      else badHere++
    }
    // Blame the topmost clip playing now (the one the operator would look at).
    const top = activeClips(project, dancer, t).at(-1)
    if (top) {
      const s = perClip.get(top) ?? { bad: 0, n: 0 }
      s.n += zones
      s.bad += badHere
      perClip.set(top, s)
    }
  }

  const issues = [...perClip.entries()]
    .map(([c, s]) => ({ clipStartMs: c.startMs, effect: c.effect, track: c.track, mismatchPct: (100 * s.bad) / Math.max(1, s.n) }))
    .filter((i) => i.mismatchPct >= 25)
    .sort((a, b) => b.mismatchPct - a.mismatchPct)
  return { matchPct: total ? (100 * good) / total : 100, colourLossPct: lit ? (100 * lost) / lit : 0, issues }
}

/** The hardware settings written into a costume sketch besides its cues. */
export interface BenchHardware {
  output: BenchOutput
  board?: string          // 'nano' (default) or 'esp32'
  zoneLeds: number[]
  brightnessPct: number
  shapes?: ZoneShape[]     // where each zone sits on the body: preset or drawn lines (PIX_POS for the canvas effects)
}

/**
 * Identifies exactly what a costume's firmware will do: its cue table, the
 * show length and, for the strip build, zone sizes and brightness. If this
 * changes after a download, the costume needs a re-flash.
 */
export function benchFingerprint(project: ShowProject, zoneIds: string[], dancer: number, hw?: BenchHardware) {
  const { cues } = compileBenchCues(project, zoneIds, dancer, hw?.output)
  const board = hw?.board && hw.board !== 'nano' ? `${hw.board}:` : ''
  const settings = !hw ? '' : board + (hw.output === '5mm' ? '5mm|' : `strip:${benchZoneLeds(hw.zoneLeds).join(',')}:${Math.round(hw.brightnessPct)}|`)
    // Body positions only matter to the costume when it plays a canvas effect.
    + (hw.shapes?.length && cues.some((c) => FX_CANVAS[c.fx]) ? `pos:${Array.from(benchPositions(hw.output, hw.shapes)).join(',')}|` : '')
  const text = `${settings}${Math.round(project.lengthMs)}|` + cues.map((c) => `${c.startMs},${c.durationMs},${c.zoneMask},${c.fx},${c.r},${c.g},${c.b},${c.param}`).join(';')
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(16).padStart(8, '0')
}
