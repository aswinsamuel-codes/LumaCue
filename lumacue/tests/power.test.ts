import { describe, expect, it } from 'vitest'
import { powerSummary, runtimeHours, scalePower, showPower } from '@/lib/show/power'
import { buildLayout } from '@/lib/show/body'
import { clip, project } from './helpers/fixtures'

const layout = buildLayout([{ id: 'a', leds: 30, placement: 'arms' }])

describe('show power', () => {
  it('integrates the real show: average, peak, when, and mAh', () => {
    // 5 s of full red on 30 LEDs at 50 % brightness, then 5 s dark
    const p = project([clip({ durationMs: 5000, color: '#FF0000' })], { lengthMs: 10000 })
    const r = showPower(p, layout, 0, 50)
    expect(r.peakMa).toBeCloseTo(30 * 20 * 0.5, 5)        // 300 mA while lit
    expect(r.avgMa).toBeCloseTo(150, 5)                    // lit half the time
    expect(r.peakAtMs).toBeLessThan(5000)
    expect(r.mAh).toBeCloseTo((150 * 10000) / 3_600_000, 6)
    // computing at 100 % and scaling is the same as computing at 50 %
    expect(scalePower(showPower(p, layout, 0), 50).avgMa).toBeCloseTo(r.avgMa, 6)
  })

  it('sees a strobe that a fixed 250 ms grid would step over', () => {
    // speed 60 = 2 Hz: flashes every 250 ms, lit for 62.5 ms, starting at an odd offset
    const p = project([clip({ startMs: 130, durationMs: 9000, effect: 'strobe', speed: 60, color: '#FFFFFF' })], { lengthMs: 10000 })
    const r = showPower(p, layout, 0, 100, 250)
    expect(r.peakMa).toBeCloseTo(30 * 60, 0)           // full white on 30 LEDs
    expect(r.avgMa).toBeGreaterThan(30 * 60 * 0.25 * 0.9 * 0.6) // about a quarter of the time, not 0 or 4x
    expect(r.avgMa).toBeLessThan(30 * 60 * 0.25 * 0.9 * 1.6)
  })

  it('reports the busiest costume and, separately, the highest peak', () => {
    const p = project([
      clip({ track: 0, durationMs: 10000, color: '#808080' }),            // steady medium all show
      clip({ track: 1, startMs: 4000, durationMs: 300, color: '#FFFFFF' }), // one short full-white hit
    ], { dancers: 2 })
    const s = powerSummary(p, layout, 100)!
    expect(s.busiest.dancer).toBe(0)
    expect(s.highestPeak.dancer).toBe(1)
    // a 5 mm dancer is left out of the strip figures
    expect(powerSummary(p, layout, 100, new Set([1]))!.highestPeak.dancer).toBe(0)
    expect(powerSummary(p, layout, 100, new Set([0, 1]))).toBeNull()
  })

  it('probes every pulse crest and very short flashes', () => {
    // 0.25 Hz pulse starting 6 s before the end: its first crest (4 s in) is inside the show
    const late = project([clip({ effect: 'pulse', speed: 0, startMs: 4000, durationMs: 6000, color: '#FFFFFF' })], { lengthMs: 10000 })
    expect(showPower(late, layout, 0, 100, 5000).peakMa).toBeCloseTo(30 * 60, 0)
    const blip = project([clip({ startMs: 3333, durationMs: 2, color: '#FFFFFF' })], { lengthMs: 10000 })
    expect(showPower(blip, layout, 0, 100, 1000).peakMa).toBeCloseTo(30 * 60, 0)
  })

  it('finds the peak of a slow pulse and the end of a wipe, between grid points', () => {
    const pulse = project([clip({ effect: 'pulse', speed: 0, durationMs: 9000, color: '#FFFFFF' })], { lengthMs: 10000 }) // 0.25 Hz: brightest 4 s in
    expect(showPower(pulse, layout, 0, 100, 2500).peakMa).toBeCloseTo(30 * 60, 0)
    const wipe = project([clip({ effect: 'wipe', durationMs: 3000, color: '#FFFFFF' })], { lengthMs: 10000 })
    expect(showPower(wipe, layout, 0, 100, 5000).peakMa).toBeCloseTo(30 * 60, 0)
  })

  it('weights a short last step by its length, and copes with no dancers', () => {
    // all dark except a full-white blip in the final 50 ms
    const p = project([clip({ startMs: 10000, durationMs: 50, color: '#FFFFFF' })], { lengthMs: 10050 })
    expect(showPower(p, layout, 0, 100, 250).avgMa).toBeLessThan(30 * 60 * 0.01)
    expect(powerSummary(project([], { dancers: 0 }), layout)).toBeNull()
  })

  it('estimates power-bank runtime with the controller included', () => {
    expect(runtimeHours(400, 5000)).toBeCloseTo(3000 / 500, 6)
  })
})
