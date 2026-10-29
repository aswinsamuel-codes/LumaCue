/**
 * LED current over the whole show, from the same frames the preview draws,
 * so battery planning uses the real show, not "everything full white".
 * Planning figures (~20 mA per colour channel at full): measure on the bench.
 *
 * Computed at 100 % brightness; current scales linearly with the brightness
 * cap, so use scalePower() instead of re-rendering when the cap changes.
 */
import type { CostumeLayout } from '@/lib/show/body'
import { ALL_DANCERS } from '@/lib/show/model'
import type { ShowProject } from '@/lib/show/model'
import { frameMilliamps, renderDancer } from '@/lib/show/render'

export interface ShowPower {
  avgMa: number
  peakMa: number
  peakAtMs: number
  mAh: number          // charge used by the LEDs over one run of the show
}

/** Deterministic 0..1 per sample index, so the grid never locks onto a strobe's period. */
function jitter(k: number) {
  let h = Math.imul(k ^ 0x9e3779b9, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export function showPower(project: ShowProject, layout: CostumeLayout, dancer: number, brightnessPct = 100, stepMs = 100): ShowPower {
  const frame = new Float32Array(layout.total * 3)
  const at = (t: number) => {
    renderDancer(project, layout, dancer, t, frame)
    return frameMilliamps(frame, 100)
  }
  let sum = 0, n = 0, peakMa = 0, peakAtMs = 0
  const peak = (ma: number, t: number) => { if (ma > peakMa) { peakMa = ma; peakAtMs = t } }

  // Average: one sample at a random point in each step (unbiased, no aliasing with flashing effects).
  for (let k = 0; k * stepMs < project.lengthMs; k++) {
    const t = Math.min(project.lengthMs - 1, (k + jitter(k)) * stepMs)
    const ma = at(t)
    sum += ma
    n++
    peak(ma, t)
  }
  // Peak: strobes, flashes and pulses are fully lit at their first instant, which a grid can step over.
  for (const c of project.clips) {
    if (c.track !== ALL_DANCERS && c.track !== dancer) continue
    if (c.startMs >= project.lengthMs) continue
    const t = c.startMs + 1
    peak(at(t), t)
  }

  const avgMa = n ? sum / n : 0
  return scalePower({ avgMa, peakMa, peakAtMs, mAh: (avgMa * project.lengthMs) / 3_600_000 }, brightnessPct)
}

/** A 100 % result at another brightness cap. */
export function scalePower(p: ShowPower, brightnessPct: number): ShowPower {
  const k = brightnessPct / 100
  return { avgMa: p.avgMa * k, peakMa: p.peakMa * k, peakAtMs: p.peakAtMs, mAh: p.mAh * k }
}

export interface PowerSummary {
  /** The costume that empties its battery fastest. */
  busiest: { dancer: number; power: ShowPower }
  /** The costume with the highest momentary draw (what trips a power bank). */
  highestPeak: { dancer: number; power: ShowPower }
}

/** Every dancer at 100 % brightness; scale with scaleSummary(). */
export function powerSummary(project: ShowProject, layout: CostumeLayout, stepMs = 100): PowerSummary {
  const all = Array.from({ length: project.dancers }, (_, d) => ({ dancer: d, power: showPower(project, layout, d, 100, stepMs) }))
  const pick = (better: (a: ShowPower, b: ShowPower) => boolean) => all.reduce((best, x) => (better(x.power, best.power) ? x : best))
  return { busiest: pick((a, b) => a.avgMa > b.avgMa), highestPeak: pick((a, b) => a.peakMa > b.peakMa) }
}

export function scaleSummary(s: PowerSummary, brightnessPct: number): PowerSummary {
  return {
    busiest: { dancer: s.busiest.dancer, power: scalePower(s.busiest.power, brightnessPct) },
    highestPeak: { dancer: s.highestPeak.dancer, power: scalePower(s.highestPeak.power, brightnessPct) },
  }
}

/**
 * Hours of this show back-to-back from a power bank. usableFraction covers
 * conversion losses and the bank's cut-off (assumed 0.6 of the label at 5 V).
 * The ESP32 / Nano itself (~50–150 mA) is added as a constant.
 */
export function runtimeHours(avgLedMa: number, bankMah: number, controllerMa = 100, usableFraction = 0.6) {
  return (bankMah * usableFraction) / Math.max(1, avgLedMa + controllerMa)
}
