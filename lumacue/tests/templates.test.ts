import { describe, expect, it } from 'vitest'
import { COSTUME_TEMPLATES } from '@/lib/show/templates'
import { PLACEMENTS } from '@/lib/show/body'
import { benchZoneLeds } from '@/lib/show/bench'

describe('costume templates', () => {
  const placements = new Set(PLACEMENTS.map((p) => p.id))
  for (const t of COSTUME_TEMPLATES) {
    it(`${t.label}: valid zones with stable ids a, b, c…`, () => {
      expect(t.zones.map((z) => z.id)).toEqual('abcdefgh'.slice(0, t.zones.length).split(''))
      for (const z of t.zones) {
        expect(placements.has(z.placement)).toBe(true)
        expect(z.leds).toBeGreaterThan(0)
      }
      // the bench strip build takes the first 3 zones as they are (no scaling)
      expect(benchZoneLeds(t.zones.map((z) => z.leds))).toEqual([0, 1, 2].map((i) => t.zones[i]?.leds ?? 0))
    })
  }
  it('the bench template matches the bench firmware', () => {
    expect(COSTUME_TEMPLATES[0].zones.map((z) => z.leds)).toEqual([20, 20, 20])
  })
})
