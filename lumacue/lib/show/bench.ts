/**
 * The bench costume (firmware/bench_sync_test/test_costume) in TypeScript.
 *
 * compileBenchCues() turns one dancer's clips into the firmware's cue table
 * (3 zones, effects OFF/SOLID/FLASH/CHASE). renderBench() is a line-by-line
 * port of the sketch's render(), so the Show Studio can show exactly what the
 * Nano will light, and tests can compare it with the editor's own preview.
 * If you change applyCue()/render() in test_costume.ino, change this too.
 */
import { ALL_DANCERS } from '@/lib/show/model'
import type { Clip, EffectId, ShowProject } from '@/lib/show/model'
import { hexToRgb, speedHz } from '@/lib/show/render'

export type BenchFx = 'FX_OFF' | 'FX_SOLID' | 'FX_FLASH' | 'FX_CHASE'
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
}

export interface BenchCompileResult {
  cues: BenchCue[]
  notes: string[]
}

export const MAX_DURATION = 65535
/** The Nano has ~30 KB of flash; the radio code and FastLED take roughly half. 14 bytes per cue. */
export const CUE_BUDGET = 800
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
export function compileBenchCues(project: ShowProject, zoneIds: string[], dancer: number): BenchCompileResult {
  // Use the finest colour steps that still fit in flash.
  let result = compileWithStep(project, zoneIds, dancer, STEPS_MS[0])
  for (const step of STEPS_MS.slice(1)) {
    if (result.cues.length <= CUE_BUDGET) break
    result = compileWithStep(project, zoneIds, dancer, step)
  }
  if (result.cues.length > CUE_BUDGET) result.notes.push(`${result.cues.length} cues may not fit in the Nano's flash (about ${CUE_BUDGET} do). Shorten fades/rainbows or split the show.`)
  return result
}

function compileWithStep(project: ShowProject, zoneIds: string[], dancer: number, STEP_MS: number): BenchCompileResult {
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
      for (let t = s; t < e; t += MAX_DURATION) {
        cues.push({ startMs: t, durationMs: Math.min(e - t, MAX_DURATION), zoneMask, fx, r: rgb[0], g: rgb[1], b: rgb[2], param: Math.max(0, Math.min(MAX_DURATION, Math.round(param))), source, effect: c.effect })
      }
    }
    const rgb = hexToRgb(c.color)
    const steps = (from: number, to: number, fn: (t0: number, t1: number) => void) => {
      for (let t = from; t < to; t += STEP_MS) fn(t, Math.min(to, t + STEP_MS))
    }

    switch (c.effect) {
      case 'solid': push(start, end, mask, 'FX_SOLID', rgb); break
      case 'blackout': push(start, end, mask, 'FX_OFF', [0, 0, 0]); break
      case 'strobe':
        push(start, end, mask, 'FX_FLASH', rgb, 1000 / (speedHz(c.speed) * 2))
        notes.add('Strobe flashes are 50 % on (25 % in the preview) and keep time with the show clock.')
        break
      case 'pulse':
        push(start, end, mask, 'FX_FLASH', rgb, 2000 / speedHz(c.speed))
        notes.add('Pulse is played as a slow flash (no dimming in bench firmware).')
        break
      case 'twinkle':
        push(start, end, mask, 'FX_FLASH', rgb, Math.max(60, 1000 / (speedHz(c.speed) * 4)))
        notes.add('Twinkle is played as a fast flash (no random sparkles in bench firmware).')
        break
      case 'chase': push(start, end, mask, 'FX_CHASE', rgb, 2000 / speedHz(c.speed)); break
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
          const u = Math.min(1, (t0 + STEP_MS / 2 - c.startMs) / Math.max(1, c.durationMs))
          push(t0, t1, mask, 'FX_SOLID', [lerp(rgb[0], c2[0], u), lerp(rgb[1], c2[1], u), lerp(rgb[2], c2[2], u)])
        })
        notes.add(`Fade is played in ${STEP_MS} ms colour steps.`)
        break
      }
      case 'rainbow': {
        const hz = speedHz(c.speed)
        steps(start, end, (t0, t1) => {
          const t = (t0 + STEP_MS / 2 - c.startMs) / 1000
          idx.forEach((z, k) => push(t0, t1, ZONE_BITS[z], 'FX_SOLID', hsv(((k + 0.5) / idx.length + (t * hz) / 4) % 1)))
        })
        notes.add(`Rainbow is played as one colour per zone, changing every ${STEP_MS} ms.`)
        break
      }
    }
  }

  return { cues, notes: [...notes] }
}

const BENCH_PIXELS = { '5mm': 3, strip: 60 } as const
const LEDS_PER_ZONE = 20

export function benchPixelCount(output: BenchOutput) {
  return BENCH_PIXELS[output]
}

export function benchZoneOf(i: number, output: BenchOutput) {
  return output === 'strip' ? Math.min(2, Math.floor(i / LEDS_PER_ZONE)) : i
}

/** Port of render()/applyCue() in test_costume.ino. Writes RGB per pixel into `out` (pixels × 3). */
export function renderBench(cues: BenchCue[], t: number, output: BenchOutput, out: Uint8Array) {
  const n = BENCH_PIXELS[output]
  out.fill(0)
  const inMask = (i: number, mask: number) => (mask & (1 << benchZoneOf(i, output))) !== 0
  const set = (i: number, r: number, g: number, b: number) => { out[i * 3] = r; out[i * 3 + 1] = g; out[i * 3 + 2] = b }

  for (const c of cues) {
    if (!(t >= c.startMs && t < c.startMs + c.durationMs)) continue
    if (c.fx === 'FX_OFF' || c.fx === 'FX_SOLID' || c.fx === 'FX_FLASH') {
      const lit = c.fx === 'FX_SOLID' || (c.fx === 'FX_FLASH' && c.param > 0 && t % c.param < Math.floor(c.param / 2))
      for (let i = 0; i < n; i++) if (inMask(i, c.zoneMask)) { if (lit) set(i, c.r, c.g, c.b); else set(i, 0, 0, 0) }
      continue
    }
    // FX_CHASE
    let count = 0
    for (let i = 0; i < n; i++) if (inMask(i, c.zoneMask)) count++
    if (!count || !c.param) continue
    const head = Math.floor(((t % c.param) * count) / c.param)
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
