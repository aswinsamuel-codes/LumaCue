/**
 * LED current over the whole show, from the same frames the preview draws,
 * so battery planning uses the real show, not "everything full white".
 * Planning figures (~20 mA per colour channel at full): measure on the bench.
 */
import type { CostumeLayout } from '@/lib/show/body'
import type { ShowProject } from '@/lib/show/model'
import { frameMilliamps, renderDancer } from '@/lib/show/render'

export interface ShowPower {
  avgMa: number
  peakMa: number
  peakAtMs: number
  mAh: number          // charge used by the LEDs over one run of the show
}

export function showPower(project: ShowProject, layout: CostumeLayout, dancer: number, brightnessPct: number, stepMs = 100): ShowPower {
  const frame = new Float32Array(layout.total * 3)
  let sum = 0, n = 0, peakMa = 0, peakAtMs = 0
  for (let t = 0; t < project.lengthMs; t += stepMs) {
    renderDancer(project, layout, dancer, t, frame)
    const ma = frameMilliamps(frame, brightnessPct)
    sum += ma
    n++
    if (ma > peakMa) { peakMa = ma; peakAtMs = t }
  }
  const avgMa = n ? sum / n : 0
  return { avgMa, peakMa, peakAtMs, mAh: (avgMa * project.lengthMs) / 3_600_000 }
}

/** The dancer whose costume draws the most, by average current. */
export function busiestDancer(project: ShowProject, layout: CostumeLayout, brightnessPct: number, stepMs = 100) {
  let best = { dancer: 0, power: showPower(project, layout, 0, brightnessPct, stepMs) }
  for (let d = 1; d < project.dancers; d++) {
    const power = showPower(project, layout, d, brightnessPct, stepMs)
    if (power.avgMa > best.power.avgMa) best = { dancer: d, power }
  }
  return best
}

/**
 * Hours of this show back-to-back from a power bank. usableFraction covers
 * conversion losses and the bank's cut-off (assumed 0.6 of the label at 5 V).
 * The ESP32 / Nano itself (~50–150 mA) is added as a constant.
 */
export function runtimeHours(avgLedMa: number, bankMah: number, controllerMa = 100, usableFraction = 0.6) {
  return (bankMah * usableFraction) / Math.max(1, avgLedMa + controllerMa)
}
