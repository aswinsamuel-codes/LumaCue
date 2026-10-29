import { describe, expect, it } from 'vitest'
import { analyzeAudio } from '@/lib/show/analyze'
import { generateCues, PALETTES } from '@/lib/show/autocue'
import { ALL_DANCERS, EFFECTS } from '@/lib/show/model'
import { clickTrack, fakeAudioBuffer } from './helpers/fixtures'

const SR = 22050

describe('analyzeAudio', () => {
  for (const bpm of [96, 120, 140]) {
    it(`finds ${bpm} BPM on a click track`, () => {
      const a = analyzeAudio(fakeAudioBuffer(clickTrack(bpm, 40, SR), SR))
      expect(Math.abs(a.bpm - bpm)).toBeLessThan(2)
      // beats land on the clicks (first click at 100 ms)
      const beat = 60000 / bpm
      const offsets = a.beats.slice(4, -4).map((t) => (((t - 100) % beat) + beat) % beat).map((o) => Math.min(o, beat - o))
      expect(Math.max(...offsets)).toBeLessThan(30)
    })
  }

  it('sees the quiet first half and the loud second half', () => {
    const a = analyzeAudio(fakeAudioBuffer(clickTrack(120, 64, SR), SR))
    const levelAt = (ms: number) => a.sections.find((s) => ms >= s.startMs && ms < s.endMs)?.level
    expect(levelAt(10000)).not.toBe('high')
    expect(levelAt(50000)).toBe('high')
    expect(a.sections[0].startMs).toBe(0)
    expect(a.sections.at(-1)!.endMs).toBeCloseTo(64000, -1)
  })

  it('does not crash on silence', () => {
    const a = analyzeAudio(fakeAudioBuffer(new Float32Array(SR * 5), SR))
    expect(Number.isFinite(a.bpm)).toBe(true)
  })
})

describe('generateCues', () => {
  const a = analyzeAudio(fakeAudioBuffer(clickTrack(128, 64, SR), SR))
  const known = new Set(EFFECTS.map((e) => e.id))

  for (const style of ['calm', 'balanced', 'energetic'] as const) {
    it(`makes valid clips (${style})`, () => {
      const clips = generateCues(a, 5, 64000, { style, palette: PALETTES[1].id, stagger: true, accents: true })
      expect(clips.length).toBeGreaterThan(10)
      for (const c of clips) {
        expect(known.has(c.effect)).toBe(true)
        expect(c.startMs).toBeGreaterThanOrEqual(0)
        expect(c.durationMs).toBeGreaterThanOrEqual(50)
        expect(c.startMs + c.durationMs).toBeLessThanOrEqual(64000)
        expect(c.track === ALL_DANCERS || (c.track >= 0 && c.track < 5)).toBe(true)
        expect(c.speed).toBeGreaterThanOrEqual(0)
        expect(c.speed).toBeLessThanOrEqual(100)
      }
      expect(new Set(clips.map((c) => c.id)).size).toBe(clips.length)
    })
  }

  it('ends with a fade to black', () => {
    const clips = generateCues(a, 5, 64000, { style: 'balanced', palette: 'neon', stagger: false, accents: false })
    const last = clips.reduce((x, y) => (y.startMs + y.durationMs >= x.startMs + x.durationMs && y.effect === 'fade' ? y : x))
    expect(last.effect).toBe('fade')
    expect(last.color2).toBe('#000000')
  })
})
