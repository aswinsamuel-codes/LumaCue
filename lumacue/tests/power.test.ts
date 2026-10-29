import { describe, expect, it } from 'vitest'
import { busiestDancer, runtimeHours, showPower } from '@/lib/show/power'
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
    expect(r.peakAtMs).toBe(0)
    expect(r.mAh).toBeCloseTo((150 * 10000) / 3_600_000, 6)
  })

  it('finds the dancer who draws the most', () => {
    const p = project([clip({ track: 1, durationMs: 10000, color: '#FFFFFF' })], { dancers: 3 })
    expect(busiestDancer(p, layout, 25).dancer).toBe(1)
  })

  it('estimates power-bank runtime with the controller included', () => {
    expect(runtimeHours(400, 5000)).toBeCloseTo(3000 / 500, 6)
  })
})
