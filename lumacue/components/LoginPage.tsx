'use client'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useDashboardStore } from '@/store/useDashboardStore'
import LogoMark from '@/components/LogoMark'
import {
  AttemptLimiter, createPasscode, loadPasscode, savePasscode, validateNewPasscode, verifyPasscode,
  type StoredPasscode,
} from '@/lib/auth/passcode'

type Mode = 'loading' | 'setup' | 'unlock'

export default function LoginPage() {
  const { setAuthenticated, addLog } = useDashboardStore()
  const [mode, setMode] = useState<Mode>('loading')
  const [stored, setStored] = useState<StoredPasscode | null>(null)
  const [code, setCode] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [lockMs, setLockMs] = useState(0)
  const limiter = useMemo(() => new AttemptLimiter(), [])
  const [shakeKey, setShakeKey] = useState(0)

  // localStorage exists only in the browser, so read it after mount (the server render shows 'loading').
  useEffect(() => {
    const s = loadPasscode(window.localStorage)
    /* eslint-disable react-hooks/set-state-in-effect -- one-time read of browser-only storage */
    setStored(s)
    setMode(s ? 'unlock' : 'setup')
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  // Count down a lockout.
  useEffect(() => {
    if (lockMs <= 0) return
    const id = setInterval(() => setLockMs(limiter.remainingMs()), 250)
    return () => clearInterval(id)
  }, [lockMs, limiter])

  const fail = (msg: string) => {
    setShakeKey((k) => k + 1)
    setError(msg)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError(null)
    if (mode === 'setup') {
      const problem = validateNewPasscode(code, confirm)
      if (problem) return fail(problem)
      setBusy(true)
      const p = await createPasscode(code)
      savePasscode(window.localStorage, p)
      addLog('INFO', 'Access code created')
      setAuthenticated(true)
      return
    }
    if (!stored) return
    if (limiter.remainingMs() > 0) return
    setBusy(true)
    const ok = await verifyPasscode(code, stored)
    setBusy(false)
    if (ok) {
      limiter.succeed()
      addLog('INFO', 'Unlocked')
      setAuthenticated(true)
    } else {
      limiter.fail()
      setCode('')
      const wait = limiter.remainingMs()
      setLockMs(wait)
      fail(wait > 0 ? 'Too many wrong codes' : 'Wrong access code')
    }
  }

  const locked = lockMs > 0

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0A0A0A] relative overflow-hidden">
      {/* Background: slow LED-coloured light sweeps */}
      <div className="fixed inset-0 pointer-events-none">
        <motion.div className="absolute -top-1/4 -left-1/4 w-[70vw] h-[70vw] rounded-full blur-3xl bg-cyan-500/10"
          animate={{ x: ['0%', '25%', '0%'], y: ['0%', '15%', '0%'] }} transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }} />
        <motion.div className="absolute -bottom-1/4 -right-1/4 w-[70vw] h-[70vw] rounded-full blur-3xl bg-fuchsia-500/10"
          animate={{ x: ['0%', '-20%', '0%'], y: ['0%', '-10%', '0%'] }} transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }} />
        <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40vw] h-[40vw] rounded-full blur-3xl bg-violet-500/10"
          animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} />
      </div>

      <motion.div className="relative z-10 w-full max-w-md p-8"
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }}>
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-5">
            <LogoMark size={104} />
            <div className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-cyan-400 via-purple-500 to-pink-500 blur-2xl opacity-30 -z-10" />
          </div>
          <motion.h1 className="text-white text-3xl font-bold tracking-widest mb-1"
            initial={{ opacity: 0, letterSpacing: '0.5em' }} animate={{ opacity: 1, letterSpacing: '0.1em' }}
            transition={{ delay: 0.9, duration: 0.8 }}>
            Luma<span className="text-white/40">Cue</span>
          </motion.h1>
          <motion.p className="text-white/30 text-sm font-mono tracking-wider"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4, duration: 0.6 }}>
            LED DANCE SHOW CONTROL
          </motion.p>
        </div>

        {mode !== 'loading' && (
          <motion.form onSubmit={handleSubmit} className="space-y-4"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.6, duration: 0.5 }}>
            <motion.div key={shakeKey}
              animate={error ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: 0.4 }}
              className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 space-y-3">
              {mode === 'setup' && (
                <p className="text-white/60 text-sm">
                  First start: choose an access code for this show laptop. Only a salted hash is saved on this computer.
                </p>
              )}
              <label className="block text-white/50 text-xs font-mono tracking-wider" htmlFor="lc-code">
                {mode === 'setup' ? 'NEW ACCESS CODE' : 'ACCESS CODE'}
              </label>
              <input id="lc-code" type="password" value={code} onChange={(e) => setCode(e.target.value)}
                autoComplete={mode === 'setup' ? 'new-password' : 'current-password'} maxLength={128}
                placeholder={mode === 'setup' ? 'At least 6 characters' : 'Enter access code'}
                disabled={locked || busy} autoFocus
                className={`w-full bg-black/40 border ${error ? 'border-red-500/50' : 'border-white/10'} rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-purple-500/50 transition-all disabled:opacity-50`} />
              {mode === 'setup' && (
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password" maxLength={128} placeholder="Type it again" aria-label="Confirm access code"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-purple-500/50 transition-all" />
              )}
              {error && (
                <p className="text-red-400 text-xs font-mono" role="alert">
                  ⚠ {error}{locked ? ` — try again in ${Math.ceil(lockMs / 1000)} s` : ''}
                </p>
              )}
            </motion.div>

            <button type="submit" disabled={locked || busy}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 text-white font-semibold text-sm tracking-wider hover:opacity-90 transition-all active:scale-95 disabled:opacity-40 disabled:active:scale-100">
              {busy ? 'CHECKING…' : mode === 'setup' ? 'CREATE ACCESS CODE' : 'UNLOCK'}
            </button>
          </motion.form>
        )}

        <div className="mt-8 text-center">
          <p className="text-white/30 text-xs font-mono tracking-wider">Powered by Aswin Samuel</p>
          <p className="text-white/10 text-xs font-mono mt-1">Open source · local only</p>
        </div>
      </motion.div>
    </div>
  )
}
