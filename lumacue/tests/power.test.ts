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
    const s = powerSummary(p, layout, 100)
    expect(s.busiest.dancer).toBe(0)
    expect(s.highestPeak.dancer).toBe(1)
  })

  it('estimates power-bank runtime with the controller included', () => {
    expect(runtimeHours(400, 5000)).toBeCloseTo(3000 / 500, 6)
  })
})
