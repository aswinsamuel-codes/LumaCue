import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { benchFidelity, benchPositions, compileBenchCues, renderBench } from '@/lib/show/bench'
import { BAND_W, bandLevel, canvasCoord, toCanvas } from '@/lib/show/canvas'
import { buildFirmware, fillPixPos } from '@/lib/show/firmware-bundle'
import { buildLayout } from '@/lib/show/body'
import { renderDancer, lapMs } from '@/lib/show/render'
import { clip, FIRMWARE_DIR, project, readFirmware, templates, ZONE_IDS } from './helpers/fixtures'

const benchIno = readFirmware('test_costume/test_costume.ino').replace(/\r\n/g, '\n')
const espIno = readFileSync(path.resolve(FIRMWARE_DIR, '..', 'esp32', 'costume', 'costume.ino'), 'utf8').replace(/\r\n/g, '\n')

/** PIX_POS pairs from a sketch's table between the given markers. */
function pixPos(src: string, which: 'strip' | '5mm') {
  const block = src.slice(src.indexOf(`// PIX_POS ${which} begin`), src.indexOf(`// PIX_POS ${which} end`))
  return [...block.matchAll(/\{(\d+), (\d+)\}/g)].flatMap((m) => [+m[1], +m[2]])
}

const ARMS_CHEST_LEGS = [{ leds: 20, placement: 'arms' as const }, { leds: 20, placement: 'chest' as const }, { leds: 20, placement: 'legs' as const }]

describe('canvas effects: firmware contract', () => {
  it('both costume sketches have the effects, band width and centre of lib/show/canvas.ts', () => {
    for (const ino of [benchIno, espIno]) {
      expect(ino).toContain('enum Effect : uint8_t { FX_OFF, FX_SOLID, FX_FLASH, FX_CHASE, FX_RISE, FX_SWEEP, FX_RIPPLE };')
      expect(ino).toContain(`const int16_t BAND_W = ${BAND_W};`)
      expect(ino).toContain('if (fx == FX_RISE) return 255 - y;')
      expect(ino).toContain('if (fx == FX_SWEEP) return x;')
      expect(ino).toContain('(x > 128 ? x - 128 : 128 - x) + (y > 90 ? y - 90 : 90 - y)')
      expect(ino).toContain('int16_t centre = -BAND_W + (int16_t)((uint32_t)((t - c.startMs) % c.param) * (255 + 2 * BAND_W) / c.param);')
      expect(ino).toContain('int32_t k = 255 - (int32_t)d * 255 / BAND_W;')
      expect(ino).toContain('pixels[i].r += (int32_t)((int16_t)c.r - pixels[i].r) * k / 255;')
    }
  })

  it('the sketches ship the LED positions LumaCue generates for the default costume', () => {
    expect(pixPos(benchIno, 'strip')).toEqual([...benchPositions('strip', ARMS_CHEST_LEGS)])
    expect(pixPos(benchIno, '5mm')).toEqual([...benchPositions('5mm', ARMS_CHEST_LEGS)])
    expect(pixPos(espIno, 'strip')).toEqual([...benchPositions('strip', ARMS_CHEST_LEGS)])
  })

  it('the clock snaps at 20 ms in both costumes', () => {
    for (const ino of [benchIno, espIno]) expect(ino).toMatch(/const uint16_t SNAP_MS\s+= 20;/)
  })
})

describe('canvas maths', () => {
  it('maps the twin figure to 0–255', () => {
    expect(toCanvas({ x: 0, y: 0 })).toEqual([0, 0])
    expect(toCanvas({ x: 100, y: 200 })).toEqual([255, 255])
    expect(toCanvas({ x: 50, y: 100 })).toEqual([128, 128])
  })
  it('rise counts from the feet, sweep from the left, ripple from the chest', () => {
    expect(canvasCoord('rise', 0, 255)).toBe(0)
    expect(canvasCoord('sweep', 10, 0)).toBe(10)
    expect(canvasCoord('ripple', 128, 90)).toBe(0)
    expect(canvasCoord('ripple', 0, 255)).toBe(255)
  })
  it('the band enters, crosses and leaves once per lap', () => {
    const lap = 1000
    expect(bandLevel(0, lap, 0)).toBe(0)                 // starts just off the edge
    const mid = Math.round(((128 + BAND_W) * lap) / (255 + 2 * BAND_W))
    expect(bandLevel(mid, lap, 128)).toBeGreaterThan(240) // centred on the middle
    expect(bandLevel(lap - 1, lap, 255)).toBeLessThan(10) // gone at the end
    expect(bandLevel(lap, lap, 0)).toBe(0)                // next lap starts again
  })
})

describe('canvas effects on the costume', () => {
  const pos = benchPositions('strip', ARMS_CHEST_LEGS)
  const lit = (px: Uint8Array, from: number, to: number) => { let n = 0; for (let i = from; i < to; i++) if (px[i * 3] > 0) n++; return n }

  it('rise lights the legs first and the arms later', () => {
    const p = project([clip({ effect: 'rise', durationMs: 5000, speed: 0 })]) // speed 0: one lap per 8 s
    const { cues } = compileBenchCues(p, ZONE_IDS, 0)
    expect(cues.map((c) => c.fx)).toEqual(['FX_RISE'])
    expect(cues[0].param).toBe(Math.round(lapMs(0)))
    const px = new Uint8Array(60 * 3)
    renderBench(cues, Math.round(lapMs(0) * 0.25), 'strip', px, [20, 20, 20], pos)
    expect(lit(px, 40, 60)).toBeGreaterThan(0)  // legs
    expect(lit(px, 0, 20)).toBe(0)              // arms
    renderBench(cues, Math.round(lapMs(0) * 0.6), 'strip', px, [20, 20, 20], pos)
    expect(lit(px, 0, 20)).toBeGreaterThan(0)
    expect(lit(px, 40, 60)).toBe(0)
  })

  it('blends over the clip underneath instead of blanking it', () => {
    const p = project([clip({ durationMs: 5000, color: '#0000FF' }), clip({ effect: 'sweep', durationMs: 5000, speed: 0 })])
    const px = new Uint8Array(60 * 3)
    renderBench(compileBenchCues(p, ZONE_IDS, 0).cues, 100, 'strip', px, [20, 20, 20], pos)
    for (let i = 0; i < 60; i++) expect(px[i * 3 + 2]).toBeGreaterThan(0) // blue stays wherever the band isn't
  })

  it('the costume matches the Studio preview', () => {
    const p = project([
      clip({ effect: 'rise', durationMs: 3000, speed: 30 }),
      clip({ effect: 'sweep', startMs: 3000, durationMs: 3000, speed: 50, color: '#00FF00' }),
      clip({ effect: 'ripple', startMs: 6000, durationMs: 3000, speed: 70, color: '#FFFFFF' }),
    ])
    const layout = buildLayout(ZONE_IDS.map((id, i) => ({ id, ...ARMS_CHEST_LEGS[i] })))
    const frame = new Float32Array(layout.total * 3)
    const editor = (t: number) => {
      renderDancer(p, layout, 0, t, frame)
      return layout.zones.map((z) => {
        let r = 0, g = 0, b = 0
        for (let i = z.start; i < z.start + z.count; i++) { r += frame[i * 3]; g += frame[i * 3 + 1]; b += frame[i * 3 + 2] }
        return [r / z.count, g / z.count, b / z.count] as [number, number, number]
      })
    }
    expect(benchFidelity(p, ZONE_IDS, 0, editor, 50, 'strip', [20, 20, 20], pos).matchPct).toBeGreaterThan(98)
  })
})

describe('firmware download writes the LED positions', () => {
  it('uses the zone sizes and body positions from Costume Setup', () => {
    const p = project([clip({ effect: 'rise' })])
    const files = buildFirmware(templates(), p, ZONE_IDS, 0, 'strip', new Date(), { zoneLeds: [10, 30, 5], brightnessPct: 30, shapes: [{ leds: 10, placement: 'head' }, { leds: 30, placement: 'legs' }, { leds: 5, placement: 'hands' }] })
    const costume = files.find((f) => f.path === 'test_costume/test_costume.ino')!.text.replace(/\r\n/g, '\n')
    const want = benchPositions('strip', [{ leds: 10, placement: 'head' }, { leds: 30, placement: 'legs' }, { leds: 5, placement: 'hands' }])
    expect(pixPos(costume, 'strip')).toEqual([...want])
    expect(want.length).toBe(45 * 2)
    expect(costume.match(/const uint8_t PIX_POS\[NUM_PIXELS\]\[2\] PROGMEM/g)).toHaveLength(2) // strip + 5 mm
  })
  it('can fill a sketch again (markers are kept)', () => {
    const once = fillPixPos(benchIno, ARMS_CHEST_LEGS)
    expect(fillPixPos(once, ARMS_CHEST_LEGS)).toBe(once)
  })
})

describe('ESP32 costume runs on both cores', () => {
  it('pins the radio side to core 0 and rendering to core 1 at a fixed frame time', () => {
    expect(espIno).toContain('xTaskCreatePinnedToCore(commsTask, "lumacue-comms", 4096, nullptr, 2, nullptr, 0);')
    expect(espIno).toContain('xTaskCreatePinnedToCore(renderTask, "lumacue-render", 4096, nullptr, 3, nullptr, 1);')
    expect(espIno).toContain('vTaskDelayUntil(&lastWake, pdMS_TO_TICKS(FRAME_MS));')
    expect(espIno).toMatch(/startTasks\(\);\n\}/)
  })
})
