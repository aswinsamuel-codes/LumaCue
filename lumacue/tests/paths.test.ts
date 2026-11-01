import { describe, expect, it } from 'vitest'
import { buildLayout, sampleZone, zonePaths } from '@/lib/show/body'
import { parseCostume } from '@/lib/show/model'
import { benchPositions } from '@/lib/show/bench'

const vNeck = { side: 'front' as const, points: [{ x: 37, y: 46 }, { x: 50, y: 82 }, { x: 63, y: 46 }] }
const backLine = { side: 'back' as const, points: [{ x: 40, y: 50 }, { x: 40, y: 100 }] }

describe('drawn LED lines', () => {
  it('spreads the zone LEDs along the drawn lines, front and back', () => {
    const pts = sampleZone({ leds: 20, placement: 'custom', paths: [vNeck, backLine] })
    expect(pts).toHaveLength(20)
    const back = pts.filter((p) => p.back)
    expect(back.length).toBeGreaterThan(0)
    for (const p of back) expect(p.x).toBeCloseTo(40)
    // shared by length: the V (~79 long) gets more LEDs than the 50-long back line
    expect(pts.length - back.length).toBeGreaterThan(back.length)
  })
  it('keeps the drawing order (= wiring order)', () => {
    const pts = sampleZone({ leds: 10, placement: 'custom', paths: [{ side: 'front', points: [{ x: 10, y: 50 }, { x: 90, y: 50 }] }] })
    for (let i = 1; i < pts.length; i++) expect(pts[i].x).toBeGreaterThan(pts[i - 1].x)
  })
  it('a single clicked point puts the LEDs on that spot', () => {
    const pts = sampleZone({ leds: 3, placement: 'custom', paths: [{ side: 'front', points: [{ x: 20, y: 30 }] }] })
    expect(pts.every((p) => p.x === 20 && p.y === 30)).toBe(true)
  })
  it('falls back to a belt line until something is drawn', () => {
    expect(zonePaths({ leds: 5, placement: 'custom', paths: [] })).toEqual(zonePaths({ leds: 5, placement: 'belt' }))
  })
  it('presets ignore any stored drawing', () => {
    expect(zonePaths({ leds: 5, placement: 'arms', paths: [vNeck] })).toEqual(zonePaths({ leds: 5, placement: 'arms' }))
  })
  it('the firmware positions follow the drawing', () => {
    const drawn = benchPositions('strip', [{ leds: 20, placement: 'custom', paths: [backLine] }, { leds: 20, placement: 'chest' }, { leds: 20, placement: 'legs' }])
    const preset = benchPositions('strip')
    expect([...drawn]).not.toEqual([...preset])
    // back LEDs keep their x as seen from the front, so Sweep still runs left → right for the audience
    expect(drawn[0]).toBe(Math.round((40 / 100) * 255))
  })
  it('buildLayout numbers drawn zones like any other', () => {
    const l = buildLayout([{ id: 'a', leds: 7, placement: 'custom', paths: [vNeck] }, { id: 'b', leds: 5, placement: 'legs' }])
    expect(l.total).toBe(12)
    expect(l.zones[1].start).toBe(7)
  })
})

describe('saved drawings are checked when loaded', () => {
  it('keeps good lines, clamps points to the figure and drops junk', () => {
    const c = parseCostume({
      brightness: 30,
      zones: [{
        id: 'a', name: 'Dress', leds: 40, placement: 'custom',
        paths: [vNeck, { side: 'back', points: [{ x: -5, y: 300 }, { x: 'x', y: 2 }] }, { side: 'up', points: [{ x: 1, y: 1 }] }, 'junk'],
      }],
    })!
    const z = c.zones[0]
    expect(z.placement).toBe('custom')
    expect(z.paths).toHaveLength(2)
    expect(z.paths![1]).toEqual({ side: 'back', points: [{ x: 0, y: 200 }] })
  })
  it('drops drawings on preset zones', () => {
    const c = parseCostume({ zones: [{ id: 'a', name: 'Arms', leds: 20, placement: 'arms', paths: [vNeck] }] })!
    expect(c.zones[0].paths).toBeUndefined()
  })
})
