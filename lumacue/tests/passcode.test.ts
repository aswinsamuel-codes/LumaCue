import { describe, expect, it } from 'vitest'
import {
  AttemptLimiter, PASSCODE_KEY, createPasscode, loadPasscode, savePasscode, validateNewPasscode, verifyPasscode,
} from '@/lib/auth/passcode'

const FAST = 100_000 // minimum accepted iteration count, keeps the tests quick

function memoryStore() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    raw: m,
  }
}

describe('access code', () => {
  it('verifies the right code and rejects others', async () => {
    const p = await createPasscode('stage-left-42', FAST)
    expect(await verifyPasscode('stage-left-42', p)).toBe(true)
    expect(await verifyPasscode('stage-left-43', p)).toBe(false)
    expect(await verifyPasscode('', p)).toBe(false)
  })

  it('never stores the code itself, and salts every hash', async () => {
    const a = await createPasscode('stage-left-42', FAST)
    const b = await createPasscode('stage-left-42', FAST)
    expect(JSON.stringify(a)).not.toContain('stage-left-42')
    expect(a.salt).not.toBe(b.salt)
    expect(a.hash).not.toBe(b.hash)
  })

  it('the old hard-coded code no longer unlocks anything', async () => {
    const p = await createPasscode('my-own-code', FAST)
    expect(await verifyPasscode('admin.lumacue', p)).toBe(false)
  })

  it('round-trips through storage and refuses tampered records', async () => {
    const s = memoryStore()
    const p = await createPasscode('stage-left-42', FAST)
    savePasscode(s, p)
    expect(loadPasscode(s)).toEqual(p)

    s.setItem(PASSCODE_KEY, JSON.stringify({ ...p, iterations: 1 }))       // downgrade attack
    expect(loadPasscode(s)).toBeNull()
    s.setItem(PASSCODE_KEY, '{not json')
    expect(loadPasscode(s)).toBeNull()
    s.setItem(PASSCODE_KEY, JSON.stringify({ v: 1, salt: '<script>', hash: 'x', iterations: FAST }))
    expect(loadPasscode(s)).toBeNull()
  })

  it('validates new codes', () => {
    expect(validateNewPasscode('abc')).toMatch(/at least 6/)
    expect(validateNewPasscode('aaaaaaaa')).toMatch(/repeat/)
    expect(validateNewPasscode('goodcode', 'goodcodf')).toMatch(/match/)
    expect(validateNewPasscode('x'.repeat(129))).toMatch(/at most/)
    expect(validateNewPasscode('goodcode', 'goodcode')).toBeNull()
  })
})

describe('attempt limiter', () => {
  it('locks after 5 failures and doubles each further lock', () => {
    let now = 0
    const l = new AttemptLimiter(5, 30_000, () => now)
    for (let i = 0; i < 4; i++) l.fail()
    expect(l.remainingMs()).toBe(0)
    l.fail()
    expect(l.remainingMs()).toBe(30_000)
    now += 30_000
    expect(l.remainingMs()).toBe(0)
    l.fail()
    expect(l.remainingMs()).toBe(60_000)
    l.succeed()
    expect(l.remainingMs()).toBe(0)
  })

  it('caps the lock at 10 minutes', () => {
    const now = 0
    const l = new AttemptLimiter(1, 30_000, () => now)
    for (let i = 0; i < 20; i++) l.fail()
    expect(l.remainingMs()).toBe(600_000)
  })
})
