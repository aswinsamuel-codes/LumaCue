/**
 * Local access code for the LumaCue screen lock.
 *
 * Replaces the old hard-coded access code, which anyone could read in the
 * public source. On first start the operator chooses a code. Only a salted
 * PBKDF2-SHA256 hash is stored, never the code itself.
 *
 * This is a lock against accidental or casual use of the show laptop (a
 * dancer tapping BLACKOUT). It is not encryption: someone with full access to
 * the computer can clear the app's storage.
 */

export const PASSCODE_KEY = 'lumacue.passcode.v1'
export const PASSCODE_MIN_LENGTH = 6
export const PBKDF2_ITERATIONS = 210_000

export interface StoredPasscode {
  v: 1
  salt: string        // base64, 16 random bytes
  hash: string        // base64, 32 bytes
  iterations: number
}

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b))
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function derive(code: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  )
  return new Uint8Array(bits)
}

/** Why a new code is not acceptable, or null if it is fine. */
export function validateNewPasscode(code: string, confirm?: string): string | null {
  if (code.length < PASSCODE_MIN_LENGTH) return `Use at least ${PASSCODE_MIN_LENGTH} characters`
  if (code.length > 128) return 'Use at most 128 characters'
  if (/^(.)\1+$/.test(code)) return 'Don’t repeat one character'
  if (confirm !== undefined && confirm !== code) return 'The two codes don’t match'
  return null
}

export async function createPasscode(code: string, iterations = PBKDF2_ITERATIONS): Promise<StoredPasscode> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return { v: 1, salt: toB64(salt), hash: toB64(await derive(code, salt, iterations)), iterations }
}

/** Constant-time comparison, so timing doesn't reveal how much of the hash matched. */
function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export async function verifyPasscode(code: string, stored: StoredPasscode): Promise<boolean> {
  if (code.length === 0 || code.length > 128) return false
  return equal(await derive(code, fromB64(stored.salt), stored.iterations), fromB64(stored.hash))
}

function isStored(x: unknown): x is StoredPasscode {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return o.v === 1 && typeof o.salt === 'string' && typeof o.hash === 'string'
    && typeof o.iterations === 'number' && Number.isInteger(o.iterations)
    && o.iterations >= 100_000 && o.iterations <= 5_000_000
    && /^[A-Za-z0-9+/=]{16,64}$/.test(o.salt) && /^[A-Za-z0-9+/=]{40,64}$/.test(o.hash)
}

export function loadPasscode(store: KeyValueStore): StoredPasscode | null {
  try {
    const raw = store.getItem(PASSCODE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isStored(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function savePasscode(store: KeyValueStore, p: StoredPasscode): void {
  store.setItem(PASSCODE_KEY, JSON.stringify(p))
}

/** Locks the form for a while after repeated wrong codes. */
export class AttemptLimiter {
  private failures = 0
  private lockedUntil = 0

  constructor(
    private readonly maxFailures = 5,
    private readonly lockMs = 30_000,
    private readonly now: () => number = Date.now,
  ) {}

  /** Milliseconds until another attempt is allowed (0 = allowed now). */
  remainingMs(): number {
    return Math.max(0, this.lockedUntil - this.now())
  }

  fail(): void {
    this.failures += 1
    if (this.failures >= this.maxFailures) {
      // Each further lock doubles, capped at 10 minutes.
      const rounds = this.failures - this.maxFailures
      this.lockedUntil = this.now() + Math.min(this.lockMs * 2 ** rounds, 600_000)
    }
  }

  succeed(): void {
    this.failures = 0
    this.lockedUntil = 0
  }
}
