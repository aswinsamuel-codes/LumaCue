import { describe, expect, it } from 'vitest'
import { benchFidelity, benchVisibleColor, compileBenchCues, CUE_BUDGET, parseCueTable, renderBench } from '@/lib/show/bench'
import type { BenchCue } from '@/lib/show/bench'
import { exportArduinoShow } from '@/lib/show/arduino-export'
import { clip, editorZones, project, readFirmware, tableOf, ZONE_IDS } from './helpers/fixtures'

const ino = readFirmware('test_costume/test_costume.ino')
const zonesOf = (px: Uint8Array) => [0, 1, 2].map((z) => [px[z * 3], px[z * 3 + 1], px[z * 3 + 2]])
const cue = (over: Partial<BenchCue>): BenchCue => ({ startMs: 0, durationMs: 1000, zoneMask: 7, fx: 'FX_SOLID', r: 255, g: 0, b: 0, param: 0, source: 'all', effect: 'solid', ...over })

describe('firmware contract (TS port must match test_costume.ino)', () => {
  it('has the same effect enum, zone masks and strip layout', () => {
    expect(ino).toMatch(/enum Effect : uint8_t \{ FX_OFF, FX_SOLID, FX_FLASH, FX_CHASE \};/)
    expect(ino).toMatch(/const uint8_t ZA = 1, ZB = 2, ZC = 4, ZALL = 7;/)
    expect(ino).toMatch(/NUM_PIXELS\s+= 60;/)
    expect(ino).toMatch(/LEDS_PER_ZONE\s+= 20;/)
    expect(ino).toMatch(/const uint8_t NUM_PIXELS = 3;/)
  })
  it('keeps the cue counter wide enough for long shows', () => {
    expect(ino).toMatch(/const uint16_t NUM_CUES/)
    expect(ino).toMatch(/for \(uint16_t n = 0; n < NUM_CUES; n\+\+\)/)
  })
  it('uses the same flash and chase rules', () => {
    expect(ino).toContain('(t % c.param) < c.param / 2')
    expect(ino).toContain('uint8_t head = (uint32_t)(t % c.param) * count / c.param;')
    expect(ino).toContain('uint8_t tail = count >= 10 ? count / 10 : 1;')
  })
})

describe('renderBench', () => {
  it('plays the demo show in the sketch: A red, B green, C yellow at 7 s', () => {
    const cues = parseCueTable(ino).map((c) => ({ ...c, source: 'all' as const, effect: 'solid' as const }))
    expect(cues).toHaveLength(8)
    const px = new Uint8Array(9)
    renderBench(cues, 7000, '5mm', px)
    expect(zonesOf(px)).toEqual([[255, 0, 0], [0, 255, 0], [255, 160, 0]])
    renderBench(cues, 1000, '5mm', px)
    expect([...px].every((v) => v === 0)).toBe(true)
  })
  it('phases FLASH on show time, 50 % duty', () => {
    const cues = [cue({ startMs: 300, durationMs: 5000, fx: 'FX_FLASH', param: 1000 })]
    const px = new Uint8Array(9)
    renderBench(cues, 1200, '5mm', px)
    expect(px[0]).toBe(255)
    renderBench(cues, 1700, '5mm', px)
    expect(px[0]).toBe(0)
  })
  it('lets later cues win, including OFF', () => {
    const cues = [cue({}), cue({ zoneMask: 2, fx: 'FX_OFF', r: 0 })]
    const px = new Uint8Array(9)
    renderBench(cues, 10, '5mm', px)
    expect(zonesOf(px)).toEqual([[255, 0, 0], [0, 0, 0], [255, 0, 0]])
  })
  it('runs a 6-LED chase head along the strip once per lap', () => {
    const cues = [cue({ fx: 'FX_CHASE', param: 600, durationMs: 10000 })]
    const px = new Uint8Array(180)
    const lit = (t: number) => {
      renderBench(cues, t, 'strip', px)
      return [...Array(60).keys()].filter((i) => px[i * 3])
    }
    expect(lit(0)).toEqual([0, 55, 56, 57, 58, 59])
    expect(lit(300)).toEqual([25, 26, 27, 28, 29, 30])
    expect(lit(600)).toEqual(lit(0))
  })
})

describe('benchVisibleColor', () => {
  it('shows what a red/green 5 mm LED can do', () => {
    expect(benchVisibleColor(255, 160, 0, '5mm')).toEqual([255, 190, 0])
    expect(benchVisibleColor(0, 229, 255, '5mm')).toEqual([0, 255, 0])
    expect(benchVisibleColor(124, 58, 237, '5mm')).toEqual([0, 0, 0]) // purple is lost
    expect(benchVisibleColor(1, 2, 3, 'strip')).toEqual([1, 2, 3])
  })
})

describe('compileBenchCues', () => {
  it('round-trips through the exported C table', () => {
    const p = project([
      clip({ effect: 'fade', durationMs: 2000, color: '#000000', color2: '#00E5FF' }),
      clip({ startMs: 2000, effect: 'chase', zones: ['b', 'c'] }),
      clip({ startMs: 3000, effect: 'rainbow', durationMs: 1000 }),
      clip({ track: 1, startMs: 4000, effect: 'wipe', durationMs: 3000 }),
    ])
    for (const d of [0, 1]) {
      const { cues } = compileBenchCues(p, ZONE_IDS, d)
      const parsed = parseCueTable(exportArduinoShow(p, ZONE_IDS, d))
      expect(parsed).toEqual(tableOf(cues))
    }
  })
  it('splits long clips into uint16 pieces and stops at the show end', () => {
    const { cues } = compileBenchCues(project([clip({ durationMs: 200000 })], { lengthMs: 150000 }), ZONE_IDS, 0)
    expect(cues.map((c) => [c.startMs, c.durationMs])).toEqual([[0, 65535], [65535, 65535], [131070, 18930]])
  })
  it('skips clips aimed only at zones the bench does not have', () => {
    const r = compileBenchCues(project([clip({ zones: ['d'] })]), [...ZONE_IDS, 'd'], 0)
    expect(r.cues).toHaveLength(0)
    expect(r.notes.join(' ')).toMatch(/skipped/)
  })
  it('lights the whole bench costume when no zones are set up', () => {
    const r = compileBenchCues(project([clip({ effect: 'wipe' }), clip({ effect: 'rainbow', startMs: 1000 })]), [], 0)
    expect(r.cues.length).toBeGreaterThan(3)
  })
  it('widens colour steps to stay inside the flash budget', () => {
    const long = project([clip({ effect: 'rainbow', durationMs: 180000 })], { lengthMs: 180000 })
    const r = compileBenchCues(long, ZONE_IDS, 0)
    expect(r.cues.length).toBeLessThanOrEqual(CUE_BUDGET)
    expect(r.notes.join(' ')).toMatch(/changing every (500|1000) ms/)
  })
  it('wipe fills zone by zone over the clip', () => {
    const { cues } = compileBenchCues(project([clip({ effect: 'wipe', durationMs: 3000 })]), ZONE_IDS, 0)
    const px = new Uint8Array(9)
    const litZones = (t: number) => {
      renderBench(cues, t, '5mm', px)
      return [0, 1, 2].filter((z) => px[z * 3])
    }
    expect(litZones(500)).toEqual([0])
    expect(litZones(1500)).toEqual([0, 1])
    expect(litZones(2500)).toEqual([0, 1, 2])
  })
})

describe('benchFidelity', () => {
  it('reports a perfect match for solid colours and blackouts', () => {
    const p = project([clip({ durationMs: 4000 }), clip({ startMs: 4000, effect: 'blackout', durationMs: 2000 }), clip({ startMs: 6000, color: '#00FF00', zones: ['b'] })])
    const r = benchFidelity(p, ZONE_IDS, 0, editorZones(p, 0))
    expect(r.matchPct).toBe(100)
    expect(r.issues).toEqual([])
  })
  it('stays close for fades', () => {
    const p = project([clip({ effect: 'fade', durationMs: 4000, color: '#000000', color2: '#FFFFFF' })])
    expect(benchFidelity(p, ZONE_IDS, 0, editorZones(p, 0)).matchPct).toBeGreaterThan(90)
  })
  it('flags effects the bench can only approximate', () => {
    const p = project([clip({ effect: 'twinkle', durationMs: 5000 })])
    const r = benchFidelity(p, ZONE_IDS, 0, editorZones(p, 0))
    expect(r.issues[0]?.effect).toBe('twinkle')
  })
})

describe('benchFingerprint', () => {
  const p = project([clip({ durationMs: 2000 }), clip({ track: 1, startMs: 3000, effect: 'chase' })])
  it('is stable for the same show and changes when what the costume plays changes', async () => {
    const { benchFingerprint } = await import('@/lib/show/bench')
    const fp = benchFingerprint(p, ZONE_IDS, 0)
    expect(benchFingerprint({ ...p, clips: [...p.clips] }, ZONE_IDS, 0)).toBe(fp)
    expect(benchFingerprint({ ...p, lengthMs: 9000 }, ZONE_IDS, 0)).not.toBe(fp)
    expect(benchFingerprint({ ...p, clips: [{ ...p.clips[0], color: '#00FF00' }, p.clips[1]] }, ZONE_IDS, 0)).not.toBe(fp)
  })
  it("ignores edits to other dancers' tracks", async () => {
    const { benchFingerprint } = await import('@/lib/show/bench')
    const fp = benchFingerprint(p, ZONE_IDS, 0)
    expect(benchFingerprint({ ...p, clips: [p.clips[0], { ...p.clips[1], color: '#0000FF' }] }, ZONE_IDS, 0)).toBe(fp)
  })
})
