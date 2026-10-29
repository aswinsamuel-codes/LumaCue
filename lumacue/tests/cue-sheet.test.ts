import { describe, expect, it } from 'vitest'
import { cueSheetCsv } from '@/lib/show/cue-sheet'
import { clip, project } from './helpers/fixtures'

describe('cue sheet', () => {
  it('lists clips in show order with section, who, effect, colour and zones', () => {
    const p = project(
      [
        clip({ startMs: 4000, durationMs: 2000, track: 1, effect: 'chase', color: '#00FF00', zones: ['a'] }),
        clip({ startMs: 0, durationMs: 3000, effect: 'fade', color: '#000000', color2: '#00E5FF' }),
        clip({ startMs: 5000, durationMs: 9000, effect: 'blackout' }),
      ],
      { name: 'Opening, "act" 1', sections: [{ id: 's', name: 'Hands only', startMs: 0, endMs: 4500, darkZones: ['b'] }] },
    )
    const lines = cueSheetCsv(p, [{ id: 'a', name: 'Hand bands' }]).trimEnd().split('\r\n')
    expect(lines).toEqual([
      '"# Opening, ""act"" 1 · 0:10.0 · 2 dancers"',
      'From,To,Section,Who,Effect,Colour,Zones',
      '0:00.0,0:03.0,Hands only,All dancers,Fade,#000000 → #00E5FF,Whole costume',
      '0:04.0,0:06.0,Hands only,Dancer 2,Chase,#00FF00,Hand bands',
      '0:05.0,0:10.0,,All dancers,Blackout,,Whole costume',
    ])
  })

  it('keeps names that look like formulas as text', () => {
    const p = project([clip({ zones: ['z'] })], { sections: [{ id: 's', name: '=HYPERLINK("x")', startMs: 0, endMs: 5000, darkZones: [] }] })
    const row = cueSheetCsv(p, [{ id: 'z', name: '+Arms' }]).split('\r\n')[2]
    expect(row).toContain(`"'=HYPERLINK(""x"")"`)
    expect(row).toContain(`'+Arms`)
    const plain = cueSheetCsv(project([clip({})], { sections: [{ id: 's', name: '-- Finale --', startMs: 0, endMs: 5000, darkZones: [] }] }), []).split('\r\n')[2]
    expect(plain).toContain(',-- Finale --,')
  })

  it('leaves out clips on hidden dancer tracks and after the end', () => {
    const p = project([clip({ track: 5 }), clip({ startMs: 20000 })], { dancers: 2, lengthMs: 10000 })
    expect(cueSheetCsv(p, []).trimEnd().split('\r\n')).toHaveLength(2)
  })
})
