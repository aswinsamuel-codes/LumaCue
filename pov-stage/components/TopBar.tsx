'use client'
import { useState, useEffect } from 'react'
import { useDashboardStore } from '@/store/useDashboardStore'

function Clock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('en-US', { hour12: false }))

  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString('en-US', { hour12: false })), 1000)
    return () => clearInterval(id)
  }, [])

  return <span className="text-white/20 font-mono text-xs tabular-nums">{time}</span>
}

export default function TopBar() {
  const { connected, setConnected } = useDashboardStore()

  return (
    <header className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-black/40 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
            <span className="text-white font-black text-xs">P</span>
          </div>
          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 blur-md opacity-40 -z-10" />
        </div>
        <div>
          <span className="text-white font-bold text-sm tracking-widest">POV</span>
          <span className="text-white/40 font-light text-sm">.STAGE</span>
        </div>
        <div className="h-4 w-px bg-white/10 mx-1" />
        <span className="text-white/20 text-xs font-mono tracking-wider">LIGHTING CONTROL v1.0</span>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={() => setConnected(!connected)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-all"
        >
          <div className="relative flex items-center justify-center">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
            {connected && <div className="absolute w-2 h-2 rounded-full bg-green-400 animate-ping" />}
          </div>
          <span className={`text-xs font-mono ${connected ? 'text-green-400' : 'text-red-400'}`}>
            {connected ? 'CONNECTED' : 'OFFLINE'}
          </span>
        </button>
        <Clock />
      </div>
    </header>
  )
}
