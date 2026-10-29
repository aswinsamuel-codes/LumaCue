/**
 * Turns a show into LED colours at a moment in time. The digital twin draws
 * exactly what this returns, and the costume firmware will run the same rules.
 */
import type { CostumeLayout } from '@/lib/show/body'
import { ALL_DANCERS } from '@/lib/show/model'
import type { Clip, ShowProject } from '@/lib/show/model'

type RGB = [number, number, number]

const rgbCache = new Map<string, RGB>()
export function hexToRgb(hex: string): RGB {
  let c = rgbCache.get(hex)
  if (!c) {
    const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16) || 0
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    rgbCache.set(hex, c)
  }
  return c
}

/** Speed 0–100 → 0.25–8 Hz, on a log scale so the slider feels even. */
export function speedHz(speed: number) {
  return 0.25 * 2 ** ((speed / 100) * 5)
}

function hsv(h: number, s: number, v: number): RGB {
  const i = Math.floor(h * 6), f = h * 6 - i
  const P = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s)
  const [r, g, b] = [[v, t, P], [q, v, P], [P, v, t], [P, q, v], [t, P, v], [v, P, q]][((i % 6) + 6) % 6]
  return [r * 255, g * 255, b * 255]
}

function rand(a: number, b: number) {
  let h = (a * 374761393 + b * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * Colour and opacity of LED `i` (of `n` in the zone) for one clip.
 * tl = ms since the clip started. Writes into out[0..3] (r, g, b, alpha).
 */
function evalEffect(c: Clip, tl: number, i: number, n: number, out: Float32Array) {
  const [r, g, b] = hexToRgb(c.color)
  const hz = speedHz(c.speed)
  const t = tl / 1000
  let k = 1   // brightness 0..1
  let a = 1   // opacity 0..1
  let col: RGB = [r, g, b]

  switch (c.effect) {
    case 'solid':
      break
    case 'fade': {
      const u = Math.min(1, tl / Math.max(1, c.durationMs))
      const [r2, g2, b2] = hexToRgb(c.color2)
      col = [r + (r2 - r) * u, g + (g2 - g) * u, b + (b2 - b) * u]
      break
    }
    case 'pulse':
      k = 0.5 - 0.5 * Math.cos(2 * Math.PI * (hz / 2) * t)
      break
    case 'strobe':
      a = (t * hz * 2) % 1 < 0.25 ? 1 : 0
      break
    case 'chase': {
      const head = ((t * hz) / 2 % 1) * n
      const tail = Math.max(1, n / 6)
      const d = (head - i + n) % n
      k = d < tail ? 1 - d / tail : 0
      a = k
      break
    }
    case 'wipe': {
      const u = Math.min(1, tl / Math.max(1, c.durationMs))
      a = (i + 0.5) / n <= u ? 1 : 0
      break
    }
    case 'rainbow':
      col = hsv((i / n + t * hz / 4) % 1, 1, 1)
      break
    case 'twinkle': {
      const step = Math.floor(t * hz * 4)
      const v = rand(i, step)
      k = v > 0.7 ? (v - 0.7) / 0.3 : 0
      a = k
      break
    }
    case 'blackout':
      col = [0, 0, 0]
      break
  }
  out[0] = col[0] * k
  out[1] = col[1] * k
  out[2] = col[2] * k
  out[3] = a
}

/** Clips that light `dancer` at time t, bottom layer first. */
export function activeClips(project: ShowProject, dancer: number, t: number): Clip[] {
  const hit = (c: Clip) => t >= c.startMs && t < c.startMs + c.durationMs
  const all = project.clips.filter((c) => c.track === ALL_DANCERS && hit(c))
  const own = project.clips.filter((c) => c.track === dancer && hit(c))
  const byStart = (x: Clip, y: Clip) => x.startMs - y.startMs
  return [...all.sort(byStart), ...own.sort(byStart)]
}

const px = new Float32Array(4)

/** Fills `frame` (layout.total × 3, 0–255) with dancer's LED colours at time t. */
export function renderDancer(project: ShowProject, layout: CostumeLayout, dancer: number, t: number, frame: Float32Array) {
  frame.fill(0)
  for (const clip of activeClips(project, dancer, t)) {
    const tl = t - clip.startMs
    for (const zone of layout.zones) {
      if (clip.zones.length && !clip.zones.includes(zone.id)) continue
      for (let i = 0; i < zone.count; i++) {
        evalEffect(clip, tl, i, zone.count, px)
        const a = px[3]
        if (a <= 0) continue
        const o = (zone.start + i) * 3
        frame[o] += (px[0] - frame[o]) * a
        frame[o + 1] += (px[1] - frame[o + 1]) * a
        frame[o + 2] += (px[2] - frame[o + 2]) * a
      }
    }
  }
}

/** Rough current for one frame: ~20 mA per colour channel at full, scaled by the brightness cap. */
export function frameMilliamps(frame: Float32Array, brightnessPct: number) {
  let sum = 0
  for (let i = 0; i < frame.length; i++) sum += frame[i]
  return (sum / 255) * 20 * (brightnessPct / 100)
}
