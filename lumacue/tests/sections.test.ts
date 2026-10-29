import { describe, expect, it } from 'vitest'
import { benchFidelity, compileBenchCues, parseCueTable, renderBench } from '@/lib/show/bench'
import { exportArduinoShow } from '@/lib/show/arduino-export'
import { darkZonesAt, parseShowProject } from '@/lib/show/model'
import type { ShowSection } from '@/lib/show/model'
import { clip, editorZones, project, ZONE_IDS } from './helpers/fixtures'

// Zone a = hand bands, b + c = costume (as in the bench demo idea)
const sections: ShowSection[] = [
  { id: 's1', name: 'Hands only', startMs: 0, endMs: 4000, darkZones: ['b', 'c'] },
  { id: 's2', name: 'Full costume', startMs: 4000, endMs: 10000, darkZones: [] },
]
const show = project([clip({ durationMs: 10000, color: '#00FF00' })], { sections })

describe('sections', () => {
  it('keep zones dark in the preview', () => {
    const zones = editorZones(show, 0)
    expect(zones(1000).map((z) => z[1] > 0)).toEqual([true, false, false])
    expect(zones(5000).map((z) => z[1] > 0)).toEqual([true, true, true])
  })

  it('are exported as OFF cues that win over clips, so the costume matches exactly', () => {
    const { cues } = compileBenchCues(show, ZONE_IDS, 0)
    const px = new Uint8Array(9)
    renderBench(cues, 1000, '5mm', px)
    expect([px[1], px[4], px[7]]).toEqual([255, 0, 0])
    renderBench(cues, 5000, '5mm', px)
    expect([px[1], px[4], px[7]]).toEqual([255, 255, 255])
    expect(benchFidelity(show, ZONE_IDS, 0, editorZones(show, 0)).matchPct).toBe(100)
    // named in the C table, and still parse back to the same cues
    const text = exportArduinoShow(show, ZONE_IDS, 0)
    expect(text).toContain('// section Hands only')
    expect(parseCueTable(text)).toHaveLength(cues.length)
  })

  it('combine when they overlap', () => {
    const p = project([], { sections: [...sections, { id: 's3', name: 'Accent', startMs: 3000, endMs: 6000, darkZones: ['a'] }] })
    expect([...(darkZonesAt(p, 3500) ?? [])].sort()).toEqual(['a', 'b', 'c'])
    expect([...(darkZonesAt(p, 5000) ?? [])]).toEqual(['a'])
    expect(darkZonesAt(p, 7000)).toBeNull()
  })

  it('survive save and open, and bad ones are dropped with a warning', () => {
    const r = parseShowProject(JSON.parse(JSON.stringify({ ...show, sections: [...sections, { name: 'broken', startMs: 5, endMs: 1 }, null] })))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.project.sections).toEqual(sections)
    expect(r.warnings.join(' ')).toMatch(/2 sections couldn't be read/)
  })

  it('a section after the end of the show is dropped, not turned inside out', () => {
    const r = parseShowProject({ ...show, lengthMs: 10000, sections: [{ id: 'late', name: 'Encore', startMs: 12000, endMs: 15000, darkZones: [] }] })
    expect(r.ok && r.project.sections).toBeUndefined()
    expect(r.ok && r.warnings.join(' ')).toMatch(/1 section couldn't be read/)
  })

  it('older show files without sections still open unchanged', () => {
    const { sections: _omit, ...old } = show
    void _omit
    const r = parseShowProject(JSON.parse(JSON.stringify(old)))
    expect(r.ok && r.project.sections).toBeUndefined()
  })
})
