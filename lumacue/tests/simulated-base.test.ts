import { afterEach, describe, expect, it, vi } from 'vitest'
import { SimulatedBase } from '@/lib/sync/simulated-base'

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('SimulatedBase', () => {
  afterEach(() => { vi.useRealTimers() })

  it('answers like the base station firmware and reports its drift on music sync', async () => {
    let now = 0
    const lines: string[] = []
    const base = new SimulatedBase({ clockPpm: 2000, showLengthMs: () => 180000, now: () => now })
    await base.connect((l) => lines.push(l), () => {})
    await base.send('ARM')
    await base.send('START')
    now = 60000                     // one minute of music later
    await base.send('T60000')
    await base.send('STATUS')
    await flush()
    expect(lines).toContain('ARM sent for show 1')
    expect(lines).toContain('START run 1')
    expect(lines).toContain('sync err_ms=120')               // 0.2 % of 60 s
    expect(lines.at(-1)).toMatch(/^show=1 len=180000 run=1 running=yes t=60000 beacons=on$/)
    await base.disconnect()
  })

  it('ends the show on its own clock', async () => {
    vi.useFakeTimers()
    let now = 0
    const lines: string[] = []
    const base = new SimulatedBase({ clockPpm: 0, showLengthMs: () => 1000, now: () => now })
    await base.connect((l) => lines.push(l), () => {})
    await base.send('START')
    now = 1100
    await vi.advanceTimersByTimeAsync(100)
    expect(lines).toContain('show ended')
    await base.disconnect()
  })

  it('ignores music sync when not running, like the firmware', async () => {
    const lines: string[] = []
    const base = new SimulatedBase({ showLengthMs: () => 1000, now: () => 0 })
    await base.connect((l) => lines.push(l), () => {})
    await base.send('T500')
    await flush()
    expect(lines.some((l) => l.startsWith('sync'))).toBe(false)
    await base.disconnect()
  })
})

describe('SimulatedBase start from', () => {
  it('starts its clock at the given point, like S<ms> on the base', async () => {
    let now = 0
    const lines: string[] = []
    const base = new SimulatedBase({ clockPpm: 0, showLengthMs: () => 180000, now: () => now })
    await base.connect((l) => lines.push(l), () => {})
    await base.send('S45000')
    now = 1000
    await base.send('STATUS')
    await base.send('S999999')
    await flush()
    expect(lines).toContain('START run 1 from 45000')
    expect(lines.find((l) => l.startsWith('show=1'))).toMatch(/t=46000/)
    expect(lines.at(-1)).toBe('start point is past the end of the show')
    await base.disconnect()
  })
})
