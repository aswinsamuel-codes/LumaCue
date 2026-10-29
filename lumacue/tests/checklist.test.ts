import { describe, expect, it } from 'vitest'
import { showChecklist } from '@/lib/show/checklist'
import type { ChecklistInput } from '@/lib/show/checklist'

const ready: ChecklistInput = {
  baseKind: 'usb', baseShowLengthMs: 180000, showLengthMs: 180000, firmware: ['ok', 'ok', 'ok'],
  showAudioName: 'song.mp3', loadedAudioName: 'song.mp3', musicSync: true, speakerDelayMs: 120,
  worstCaseMa: 900, currentLimitMa: 1000,
}
const levels = (i: ChecklistInput) => Object.fromEntries(showChecklist(i).map((c) => [c.id, c.level]))

describe('showChecklist', () => {
  it('is all green when everything is ready', () => {
    expect(showChecklist(ready).every((c) => c.level === 'ok')).toBe(true)
  })
  it('fails on the things that break a show', () => {
    expect(levels({ ...ready, baseKind: null })).toMatchObject({ base: 'fail' })
    expect(levels({ ...ready, baseShowLengthMs: 30000 })).toMatchObject({ 'base-length': 'fail' })
    expect(levels({ ...ready, firmware: ['ok', 'stale', 'never'] })).toMatchObject({ firmware: 'fail' })
    expect(levels({ ...ready, loadedAudioName: null })).toMatchObject({ music: 'fail' })
  })
  it('warns on the things worth a second look', () => {
    expect(levels({ ...ready, baseKind: 'simulator' })).toMatchObject({ base: 'warn' })
    expect(levels({ ...ready, musicSync: false })).toMatchObject({ sync: 'warn' })
    expect(levels({ ...ready, speakerDelayMs: 0 })).toMatchObject({ speaker: 'warn' })
    expect(levels({ ...ready, worstCaseMa: 2900 })).toMatchObject({ power: 'warn' })
    expect(levels({ ...ready, loadedAudioName: 'other.mp3' })).toMatchObject({ music: 'warn' })
  })
  it('says how many costumes need firmware', () => {
    const fw = showChecklist({ ...ready, firmware: ['ok', 'stale', 'never'] }).find((c) => c.id === 'firmware')!
    expect(fw.text).toMatch(/^2 of 3 costumes/)
  })
})

describe('showChecklist power from the real show', () => {
  it('uses the busiest costume when known', () => {
    const items = showChecklist({ ...ready, worstCaseMa: 2900, showPeak: { dancer: 2, peakMa: 640, peakAtMs: 83000, avgMa: 310 } })
    const p = items.find((c) => c.id === 'power')!
    expect(p.level).toBe('ok')
    expect(p.text).toMatch(/Dancer 3/)
    const hot = showChecklist({ ...ready, showPeak: { dancer: 0, peakMa: 1400, peakAtMs: 83000, avgMa: 700 } }).find((c) => c.id === 'power')!
    expect(hot.level).toBe('warn')
    expect(hot.text).toMatch(/1:23.0/)
  })
})
