'use client'
import { useState } from 'react'
import { useDashboardStore } from '@/store/useDashboardStore'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const { setAuthenticated, addLog } = useDashboardStore()

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === 'admin.pov.stage') {
      setAuthenticated(true)
      addLog('INFO', 'User authenticated successfully')
    } else {
      setError(true)
      setTimeout(() => setError(false), 2000)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0A0A0A] relative overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-pink-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 w-full max-w-md p-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
              <span className="text-white font-black text-3xl">L</span>
            </div>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 blur-xl opacity-50 -z-10" />
          </div>
          <h1 className="text-white text-3xl font-bold tracking-widest mb-1">
            Luma<span className="text-white/40">Cue</span>
          </h1>
          <p className="text-white/30 text-sm font-mono tracking-wider">LED DANCE SHOW CONTROL</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
            <label className="block text-white/50 text-xs font-mono mb-2 tracking-wider">ACCESS CODE</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password..."
              className={`w-full bg-black/40 border ${error ? 'border-red-500/50' : 'border-white/10'} rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-purple-500/50 transition-all`}
              autoFocus
            />
            {error && (
              <p className="text-red-400 text-xs font-mono mt-2 animate-fade-in">⚠ Invalid access code</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white font-semibold text-sm tracking-wider hover:opacity-90 transition-all active:scale-95"
          >
            AUTHENTICATE
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-white/30 text-xs font-mono tracking-wider">Powered by Aswin Samuel</p>
          <p className="text-white/10 text-xs font-mono mt-1">v1.0.0 • Secure Access</p>
        </div>
      </div>
    </div>
  )
}
