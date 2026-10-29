'use client'
import { isWebSerialSupported } from '@/lib/base-station-serial'
import { DEMO_SHOW, formatShowTime } from '@/lib/costume-show'
import { useCostumeStore } from '@/store/useCostumeStore'

export default function ShowControl({ showMs }: { showMs: number }) {
  const {
    baseConnected, armed, running, beaconsOn,
    connectBase, disconnectBase, arm, start, blackout, toggleBeacons,
  } = useCostumeStore()

  const state = running ? 'RUNNING' : armed ? 'ARMED' : 'IDLE'
  const stateColor = running ? 'text-green-400' : armed ? 'text-yellow-300' : 'text-white/40'
  const progress = Math.min(100, (showMs / DEMO_SHOW.lengthMs) * 100)

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
      {/* Base station link */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2 h-2 rounded-full shrink-0 ${baseConnected ? 'bg-green-400' : 'bg-white/20'}`} />
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold">Base station</p>
            <p className="text-white/30 text-[11px] font-mono truncate">
              {baseConnected
                ? 'Nano + NRF24 on USB · 115200 baud'
                : isWebSerialSupported()
                  ? 'Not connected · buttons run a preview only'
                  : 'USB needs Chrome or Edge on desktop · preview only'}
            </p>
          </div>
        </div>
        <button
          onClick={baseConnected ? disconnectBase : connectBase}
          disabled={!baseConnected && !isWebSerialSupported()}
          className="shrink-0 text-[10px] px-3 py-1.5 rounded bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 transition-all font-mono disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {baseConnected ? 'DISCONNECT' : 'CONNECT USB'}
        </button>
      </div>

      {/* Show clock */}
      <div className="flex items-end justify-between mb-2">
        <div>
          <p className="text-white/30 text-[10px] font-mono tracking-widest">SHOW {DEMO_SHOW.id} · {DEMO_SHOW.name.toUpperCase()}</p>
          <p className="text-white font-mono text-3xl tabular-nums leading-tight">{formatShowTime(showMs)}</p>
        </div>
        <div className="text-right">
          <p className={`font-mono text-xs tracking-widest ${stateColor}`}>{state}</p>
          <p className="text-white/30 font-mono text-[11px]">of {formatShowTime(DEMO_SHOW.lengthMs)}</p>
        </div>
      </div>
      <div className="h-1 rounded-full bg-white/10 mb-4 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" style={{ width: `${progress}%` }} />
      </div>

      {/* Cue buttons */}
      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={arm}
          disabled={running}
          className="py-2 rounded-lg bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 text-xs font-medium hover:bg-yellow-500/25 transition-all active:scale-95 disabled:opacity-30"
        >
          ARM
        </button>
        <button
          onClick={start}
          className="py-2 rounded-lg bg-green-500/20 border border-green-500/40 text-green-300 text-xs font-bold hover:bg-green-500/30 transition-all active:scale-95"
        >
          {running ? 'RESTART' : '▶ START'}
        </button>
        <button
          onClick={toggleBeacons}
          title="Turn time beacons off to measure how far costume clocks drift on their own"
          className={`py-2 rounded-lg border text-xs font-medium transition-all active:scale-95 ${
            beaconsOn
              ? 'bg-purple-500/20 border-purple-500/30 text-purple-300 hover:bg-purple-500/30'
              : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
          }`}
        >
          BEACONS {beaconsOn ? 'ON' : 'OFF'}
        </button>
        <button
          onClick={blackout}
          className="py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-bold hover:bg-red-500/30 transition-all tracking-wider active:scale-95"
        >
          ⚡ BLACKOUT
        </button>
      </div>
      <p className="text-white/20 text-[10px] font-mono mt-3">
        Costumes play the show stored on them. If the radio drops they keep going; the costume&apos;s own power switch is the real emergency cut-off.
      </p>
    </div>
  )
}
