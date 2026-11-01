/**
 * Canvas effects: a soft band of light crosses the costume using each LED's
 * position on the body, not its place along the strip. So "rise" goes up the
 * body even when a strip runs down one arm and up the other, and the same show
 * works on any LED layout.
 *
 * Positions are 0–255 (x left → right as the audience sees, y top → bottom).
 * The integer maths here is exactly canvasCoord()/applyCue() in the costume
 * firmware (test_costume.ino, esp32 costume.ino): keep them identical.
 */
import type { Pt } from '@/lib/show/body'

export type CanvasEffect = 'rise' | 'sweep' | 'ripple'
export const CANVAS_EFFECTS: readonly CanvasEffect[] = ['rise', 'sweep', 'ripple']

export function isCanvasEffect(effect: string): effect is CanvasEffect {
  return (CANVAS_EFFECTS as readonly string[]).includes(effect)
}

/** Half-width of the band, in canvas units (0–255). */
export const BAND_W = 48
/** Where ripples start: the chest, in canvas units. */
const CENTRE_X = 128, CENTRE_Y = 90

/** A twin position (100 × 200 figure box) in canvas units. */
export function toCanvas(p: Pt): [number, number] {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return [c((p.x / 100) * 255), c((p.y / 200) * 255)]
}

/** The coordinate the band travels along, 0–255. */
export function canvasCoord(effect: CanvasEffect, x: number, y: number): number {
  if (effect === 'rise') return 255 - y
  if (effect === 'sweep') return x
  const d = Math.abs(x - CENTRE_X) + Math.abs(y - CENTRE_Y) // ripple: distance from the chest
  return d > 255 ? 255 : d
}

/**
 * Brightness 0–255 of the band at coordinate v, `elapsedMs` into a clip whose
 * band crosses the whole costume once every `lapMs`.
 */
export function bandLevel(elapsedMs: number, lapMs: number, v: number): number {
  if (lapMs <= 0) return 0
  const centre = -BAND_W + Math.floor(((elapsedMs % lapMs) * (255 + 2 * BAND_W)) / lapMs)
  const d = Math.abs(v - centre)
  return d < BAND_W ? 255 - Math.floor((d * 255) / BAND_W) : 0
}

/** The firmware's blend: bg + (col − bg) · k / 255, in integers (C truncates towards zero). */
export function blend(bg: number, col: number, k: number): number {
  return bg + Math.trunc(((col - bg) * k) / 255)
}
