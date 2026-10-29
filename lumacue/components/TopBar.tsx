'use client'
import { useState, useEffect } from 'react'
import { useDashboardStore } from '@/store/useDashboardStore'
import { useCostumeStore } from '@/store/useCostumeStore'

function Clock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('en-US', { hour12: false }))

  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString('en-US', { hour12: false })), 1000)
    return () => clearInterval(id)
  }, [])

  return <span className="text-white/20 font-mono text-xs tabular-nums">{time}</span>
}

type Tone = 'ok' | 'wait' | 'off'

const TONES: Record<Tone, { dot: string; text: string }> = {
  ok: { dot: 'bg-green-400', text: 'text-green-400' },
  wait: { dot: 'bg-yellow-400', text: 'text-yellow-300' },
  off: { dot: 'bg-red-400', text: 'text-red-400' },
}

// Real link state, not a toggle. Clicking an offline link retries it now.
function LinkStatus({ label, state, tone, title, onClick }: {
  label: string; state: string; tone: Tone; title: string; onClick?: () => void
}) {
  const t = TONES[tone]
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      title={title}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 enabled:hover:bg-white/10 transition-all disabled:cursor-default"
    >
      <div className="relative flex items-center justify-center">
        <div className={`w-2 h-2 rounded-full ${t.dot}`} />
        {tone !== 'off' && <div className={`absolute w-2 h-2 rounded-full ${t.dot} animate-ping`} />}
      </div>
      <span className="text-white/40 text-[10px] font-mono tracking-wider">{label}</span>
      <span className={`text-xs font-mono ${t.text}`}>{state}</span>
    </button>
  )
}

export default function TopBar() {
  const { bandLink, reconnectHardware } = useDashboardStore()
  const baseConnected = useCostumeStore((s) => s.baseConnected)

  return (
    <header className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-black/40 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
            <span className="text-white font-black text-xs">L</span>
          </div>
          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 blur-md opacity-40 -z-10" />
        </div>
        <div>
          <span className="text-white font-bold text-sm tracking-widest">Luma</span>
          <span className="text-white/40 font-light text-sm">Cue</span>
        </div>
        <div className="h-4 w-px bg-white/10 mx-1" />
        <span className="text-white/20 text-xs font-mono tracking-wider">LED SHOW CONTROL v1.0</span>
        <span className="text-white/30 text-xs font-mono tracking-wider">· Powered by Aswin Samuel</span>
      </div>
      <div className="flex items-center gap-4">
        <LinkStatus
          label="HAND BAND"
          state={bandLink === 'connected' ? 'CONNECTED' : bandLink === 'connecting' ? 'CONNECTING…' : 'OFFLINE'}
          tone={bandLink === 'connected' ? 'ok' : bandLink === 'connecting' ? 'wait' : 'off'}
          title={bandLink === 'connected' ? 'Hand band controller online' : 'Retrying automatically. Click to retry now'}
          onClick={bandLink === 'connected' ? undefined : reconnectHardware}
        />
        <LinkStatus
          label="COSTUME BASE"
          state={baseConnected ? 'USB' : 'OFFLINE'}
          tone={baseConnected ? 'ok' : 'off'}
          title={baseConnected ? 'Base station connected over USB' : 'Connect it from the Show Mode tab; reconnects automatically after that'}
        />
        <Clock />
      </div>
    </header>
  )
}
