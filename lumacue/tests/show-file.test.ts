import { describe, expect, it } from 'vitest'
import { parseShowProject, starterProject } from '@/lib/show/model'
import { renderDancer } from '@/lib/show/render'
import { buildLayout } from '@/lib/show/body'
import { exportArduinoShow } from '@/lib/show/arduino-export'
import { compileBenchCues } from '@/lib/show/bench'

const layout = buildLayout([{ id: 'a', leds: 20, placement: 'arms' }, { id: 'b', leds: 10, placement: 'legs' }])

/** Everything the editor does with a show, every 250 ms of it. Throws if anything crashes. */
function exercise(p: ReturnType<typeof starterProject>) {
  const f = new Float32Array(layout.total * 3)
  for (let d = 0; d < p.dancers; d++) {
    for (let t = 0; t < p.lengthMs; t += 250) renderDancer(p, layout, d, t, f)
    exportArduinoShow(p, ['a', 'b'], d)
    compileBenchCues(p, ['a', 'b'], d)
  }
}

describe('parseShowProject', () => {
  it('accepts a saved show unchanged', () => {
    const p = starterProject()
    const r = parseShowProject(JSON.parse(JSON.stringify(p)))
    expect(r).toEqual({ ok: true, project: p, warnings: [] })
  })

  it('refuses things that are not shows, with a clear reason', () => {
    expect(parseShowProject(null)).toMatchObject({ ok: false, error: expect.stringMatching(/no data/) })
    expect(parseShowProject({ clips: [] })).toMatchObject({ ok: false, error: expect.stringMatching(/no version/) })
    expect(parseShowProject({ version: 2, clips: [] })).toMatchObject({ ok: false, error: expect.stringMatching(/version 2/) })
    expect(parseShowProject({ version: 1 })).toMatchObject({ ok: false, error: expect.stringMatching(/no clips/) })
  })

  it('repairs or drops broken clips so nothing crashes later', () => {
    const r = parseShowProject({
      ...starterProject(),
      clips: [
        { startMs: 0, durationMs: 1000, effect: 'solid' },                                   // missing colour etc → repaired
        { startMs: 0, durationMs: 1000, effect: 'solid', color: '#fff', zones: null, track: -1, speed: 500 }, // bad colour, zones, speed → repaired
        null,                                                                                 // dropped
        { startMs: '0', durationMs: 'x', effect: 'laser', color: 5, zones: [], track: -1 },   // dropped
        { startMs: 100, durationMs: 100, effect: 'chase', color: '#FF0000', track: 99 },      // no such dancer → dropped
        { id: 'same', startMs: 0, durationMs: 100, effect: 'solid', color: '#FF0000', track: 0 },
        { id: 'same', startMs: 100, durationMs: 100, effect: 'solid', color: '#FF0000', track: 0 }, // duplicate id → new id
      ],
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.project.clips).toHaveLength(4)
    expect(new Set(r.project.clips.map((c) => c.id)).size).toBe(4)
    expect(r.project.clips[1]).toMatchObject({ color: '#FFFFFF', zones: [], speed: 100 })
    expect(r.warnings.join(' ')).toMatch(/3 clips couldn't be read/)
    expect(r.warnings.join(' ')).toMatch(/3 clips had missing or invalid settings/)
    expect(() => exercise(r.project)).not.toThrow()
  })

  it('survives random garbage (fuzz)', () => {
    let seed = 42
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
    const junk = (): unknown => {
      const pick = Math.floor(rnd() * 9)
      return [null, undefined, -1, 1e12, NaN, 'x', '#12', [], { a: 1 }][pick]
    }
    const fields = ['id', 'track', 'startMs', 'durationMs', 'effect', 'color', 'color2', 'zones', 'speed']
    for (let n = 0; n < 200; n++) {
      const clips = Array.from({ length: 6 }, () => {
        const c: Record<string, unknown> = { ...starterProject().clips[0] }
        for (const f of fields) if (rnd() < 0.3) c[f] = junk()
        return c
      })
      const input = { version: 1, name: junk(), dancers: rnd() < 0.2 ? junk() : 3, lengthMs: rnd() < 0.2 ? junk() : 5000, audioName: junk(), clips }
      const r = parseShowProject(input)
      expect(r.ok).toBe(true)
      if (r.ok) expect(() => exercise(r.project)).not.toThrow()
    }
  })
})

describe('show file with its costume setup', () => {
  const costume = { zones: [{ id: 'a', name: 'Hand bands', leds: 24, placement: 'hands' as const }, { id: 'b', name: 'Arms', leds: 40, placement: 'arms' as const }], brightness: 40 }

  it('round-trips the costume next to the show, without putting it in the show', async () => {
    const { showFileJson } = await import('@/lib/show/model')
    const p = starterProject()
    const r = parseShowProject(JSON.parse(showFileJson(p, costume)))
    expect(r.ok && r.costume).toEqual(costume)
    expect(r.ok && r.project).toEqual(p)
  })

  it('keeps the browser setup when the saved costume is damaged', () => {
    const r = parseShowProject({ ...starterProject(), costume: { zones: [{ id: 'a', leds: -1 }] } })
    expect(r.ok && r.costume).toBeUndefined()
    expect(r.ok && r.warnings.join(' ')).toMatch(/costume setup saved in the file couldn't be read/)
  })

  it('older files without a costume open as before', () => {
    const r = parseShowProject(JSON.parse(JSON.stringify(starterProject())))
    expect(r).toMatchObject({ ok: true, warnings: [] })
    expect(r.ok && r.costume).toBeUndefined()
  })
})
