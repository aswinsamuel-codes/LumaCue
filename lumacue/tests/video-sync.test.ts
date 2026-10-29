import { describe, expect, it } from 'vitest'
import { shouldSeek, videoTargetSec } from '@/lib/show/video-sync'

describe('rehearsal video sync', () => {
  it('maps show time to video time with the offset, and knows when it is outside the video', () => {
    expect(videoTargetSec(10000, 2500, 60)).toBe(12.5)   // video started recording 2.5 s before the music
    expect(videoTargetSec(1000, -3000, 60)).toBeNull()    // music started before the recording
    expect(videoTargetSec(59000, 2500, 60)).toBeNull()    // after the end of the video
  })
  it('lets small drift ride while playing but follows closely when paused', () => {
    expect(shouldSeek(10.05, 10, true)).toBe(false)
    expect(shouldSeek(10.2, 10, true)).toBe(true)
    expect(shouldSeek(10.05, 10, false)).toBe(true)
  })
})
