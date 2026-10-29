import { describe, expect, it } from 'vitest'
import { simulateBench } from '@/lib/sync/virtual-bench'
import type { BenchSimOptions } from '@/lib/sync/virtual-bench'

const SHOW = 180000
const base = (over: Partial<BenchSimOptions> = {}): BenchSimOptions => ({
  showLengthMs: SHOW,
  baseClockPpm: 0,
  costumes: [{ clockPpm: 300 }, { clockPpm: -300 }, { clockPpm: 50 }],
  lossPct: 0,
  ...over,
})
const START_AT = 1000
const run = (o: BenchSimOptions, extra: Parameters<typeof simulateBench>[1] = [], until = START_AT + SHOW - 100) =>
  simulateBench(o, [{ atMs: 500, do: 'ARM' }, { atMs: START_AT, do: 'START' }, ...extra], until)

describe('virtual bench: sync protocol', () => {
  it('keeps costumes within a few ms of each other with a clean radio', () => {
    const r = run(base())
    expect(r.maxSpread).toBeLessThanOrEqual(5)
    expect(Math.max(...r.maxErrorVsMusic)).toBeLessThanOrEqual(5)
  })

  it('survives 50 % packet loss', () => {
    const r = run(base({ lossPct: 50, seed: 7 }))
    expect(r.maxSpread).toBeLessThanOrEqual(10)
  })

  it('keeps playing on its own clock when the radio dies mid-show', () => {
    const r = run(base(), [{ atMs: START_AT + 60000, do: 'RADIO', lossPct: 100 }])
    // 300 ppm over the remaining 2 minutes ≈ 36 ms; costumes are still running
    const last = r.samples.at(-1)!
    expect(last.costumeShowMs.every((s) => s !== null)).toBe(true)
    expect(r.maxErrorVsMusic[0]).toBeGreaterThan(20)
    expect(r.maxErrorVsMusic[0]).toBeLessThan(60)
    expect(r.costumeLogs[0]).toContain('link lost')
  })

  it('lets a costume that powers up late join on the next beacon', () => {
    const r = run(base({ costumes: [{ clockPpm: 0 }, { clockPpm: 100, bootAtMs: START_AT + 30000 }] }))
    expect(r.costumeLogs[1][0]).toMatch(/^LATE JOIN/)
    // once joined, it is on time
    const after = r.samples.filter((s) => s.t > 31000)
    expect(after.every((s) => s.costumeShowMs[1] !== null && Math.abs(s.costumeShowMs[1]! - s.t) < 10)).toBe(true)
  })

  it('blacks out every costume and keeps them dark despite later beacons', () => {
    const r = run(base(), [{ atMs: START_AT + 20000, do: 'BLACKOUT' }], START_AT + 30000)
    const after = r.samples.filter((s) => s.t > 20100)
    expect(after.every((s) => s.costumeShowMs.every((c) => c === null))).toBe(true)
  })

  it('a restart puts everyone back at 0', () => {
    const r = run(base(), [{ atMs: START_AT + 10000, do: 'START' }], START_AT + 15000)
    const s = r.samples.at(-1)!
    expect(s.costumeShowMs.every((c) => c !== null && Math.abs(c - s.t) < 5)).toBe(true)
    expect(s.t).toBeLessThan(6000)
  })
})

describe('virtual bench: base clock vs the music (risk R-SYNC-1)', () => {
  it('WITHOUT music sync, a 0.3 % base clock drifts ~0.5 s from the music over 3 minutes', () => {
    const r = run(base({ baseClockPpm: 3000 }))
    // costumes still agree with each other…
    expect(r.maxSpread).toBeLessThanOrEqual(5)
    // …but all of them are off the music
    expect(Math.min(...r.maxErrorVsMusic)).toBeGreaterThan(400)
  })

  it('WITH the laptop sending its music position every 2 s, lights stay on the music', () => {
    const r = run(base({ baseClockPpm: 3000, musicSyncEveryMs: 2000, lossPct: 20, seed: 3 }))
    expect(Math.max(...r.maxErrorVsMusic)).toBeLessThanOrEqual(15)
    expect(r.maxSpread).toBeLessThanOrEqual(10)
  })
})
