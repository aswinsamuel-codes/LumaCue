import { describe, expect, it } from 'vitest'
import { exportArduinoShow } from '@/lib/show/arduino-export'
import { ALL_DANCERS } from '@/lib/show/model'
import type { Clip, ShowProject } from '@/lib/show/model'

const clip = (over: Partial<Clip>): Clip => ({
  id: 'x', track: ALL_DANCERS, startMs: 0, durationMs: 1000, effect: 'solid', color: '#FF0000', color2: '#000000', zones: [], speed: 50, ...over,
})

export const sample: ShowProject = {
  version: 1, name: 'Test', dancers: 2, lengthMs: 30000, audioName: null,
  clips: [
    clip({ startMs: 0, durationMs: 2000, effect: 'blackout' }),
    clip({ startMs: 2000, durationMs: 4000, effect: 'solid', zones: ['a'] }),
    clip({ startMs: 6000, durationMs: 4000, effect: 'strobe', speed: 50 }),
    clip({ startMs: 10000, durationMs: 4000, effect: 'chase', color: '#00FF00', zones: ['b', 'c'] }),
    clip({ track: 1, startMs: 14000, durationMs: 2000, effect: 'wipe' }),
    clip({ track: 0, startMs: 14000, durationMs: 2000, effect: 'fade', color: '#000000', color2: '#00E5FF' }),
    clip({ startMs: 16000, durationMs: 4000, effect: 'rainbow' }),
    clip({ startMs: 20000, durationMs: 70000, effect: 'pulse' }),
  ],
}

describe('exportArduinoShow (characterization)', () => {
  it('matches the snapshot for dancer 1', () => {
    expect(exportArduinoShow(sample, ['a', 'b', 'c'], 0)).toMatchSnapshot()
  })
  it('matches the snapshot for dancer 2', () => {
    expect(exportArduinoShow(sample, ['a', 'b', 'c'], 1)).toMatchSnapshot()
  })
})
