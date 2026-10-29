'use client'
import { useEffect, useMemo, useRef } from 'react'
import StageCanvas from '@/components/timeline/StageCanvas'
import { buildLayout } from '@/lib/show/body'
import { formatShowTime } from '@/lib/show/model'
import { useShowPlayback } from '@/lib/show/playback'
import { isWebSerialSupported } from '@/lib/base-station-serial'
import { FIRMWARE_SHOW_ID, useCostumeStore } from '@/store/useCostumeStore'
import { useShowStore } from '@/store/useShowStore'

/**
 * Show Mode: runs the show on the night. Nothing here edits the show, so a
 * stray click can't change it mid-performance. START starts the costumes (via
 * the base station), the music and the digital twin together.
 */
export default function ShowModeView() {
  const project = useShowStore((s) => s.project)
  const {
    zones, brightness, baseConnected, armed, running, beaconsOn,
    connectBase, disconnectBase, arm, start, blackout, toggleBeacons, showEnded,
  } = useCostumeStore()
  const pb = useShowPlayback()
  const layout = useMemo(() => buildLayout(zones), [zones])

  const handleStart = () => {
    start()
    pb.seek(0)
    pb.play()
  }

  const handleBlackout = () => {
    blackout()
    pb.pause()
  }

  // The show clock ran to the end: the costumes have finished too.
  const wasPlaying = useRef(false)
  useEffect(() => {
    if (wasPlaying.current && !pb.playing && pb.timeMs >= project.lengthMs - 1) showEnded()
    wasPlaying.current = pb.playing
  }, [pb.playing, pb.timeMs, project.lengthMs, showEnded])

  const state = running ? 'RUNNING' : armed ? 'ARMED' : 'IDLE'
  const stateColor = running ? 'text-green-400' : armed ? 'text-yellow-300' : 'text-white/40'
  const progress = Math.min(100, (pb.timeMs / project.lengthMs) * 100)
  const musicMissing = !!project.audioName && !pb.audio

  return (
    <div className="flex gap-3 h-full min-h-0">
      {/* View-only digital twin */}
      <div className="relative flex-1 min-w-0 rounded-xl border border-white/10 overflow-hidden">
        <StageCanvas project={project} layout={layout} timeMs={pb.timeMs} view="all" focusDancer={-1} brightness={brightness} xray={false} dark={!running} />
        <p className="absolute bottom-2 left-3 text-white/25 text-[10px] font-mono">
          Simulation of &quot;{project.name}&quot; · dark until START
        </p>
      </div>

      <div className="w-80 shrink-0 flex flex-col gap-3 overflow-y-auto">
        {/* Base station link */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-2 h-2 rounded-full shrink-0 ${baseConnected ? 'bg-green-400' : 'bg-red-400'}`} />
              <div className="min-w-0">
                <p className="text-white text-sm font-semibold">Base station</p>
                <p className="text-white/30 text-[11px] font-mono truncate">
                  {baseConnected ? 'USB connected' : isWebSerialSupported() ? 'Not connected · simulation only' : 'Needs Chrome or Edge · simulation only'}
                </p>
              </div>
            </div>
            <button
              onClick={() => (baseConnected ? disconnectBase() : connectBase())}
              disabled={!baseConnected && !isWebSerialSupported()}
              className="shrink-0 text-[10px] px-3 py-1.5 rounded bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 transition-all font-mono disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {baseConnected ? 'DISCONNECT' : 'CONNECT USB'}
            </button>
          </div>
        </div>

        {/* Show clock */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start justify-between">
            <p className="text-white/40 text-[10px] font-mono tracking-widest truncate pr-2">{project.name.toUpperCase()}</p>
            <p className={`font-mono text-xs tracking-widest ${stateColor}`}>{state}</p>
          </div>
          <p className="text-white font-mono text-5xl tabular-nums leading-tight my-1">{formatShowTime(pb.timeMs)}</p>
          <p className="text-white/30 font-mono text-[11px] mb-2">of {formatShowTime(project.lengthMs)}</p>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" style={{ width: `${progress}%` }} />
          </div>
          <p className={`mt-2 text-[11px] font-mono truncate ${musicMissing ? 'text-yellow-300/80' : 'text-cyan-300/60'}`}>
            ♪ {pb.audio ? pb.audio.name : musicMissing ? `${project.audioName}: load it in Show Studio` : 'No music'}
          </p>
        </div>

        {/* Cues */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col gap-2">
          <button
            onClick={arm}
            disabled={running}
            className="py-2 rounded-lg bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 text-sm font-medium hover:bg-yellow-500/25 transition-all active:scale-95 disabled:opacity-30"
          >
            ARM
          </button>
          <button
            onClick={handleStart}
            className="py-5 rounded-lg bg-green-500/25 border border-green-500/50 text-green-200 text-xl font-bold hover:bg-green-500/35 transition-all active:scale-95"
          >
            {running ? '↻ RESTART' : '▶ START'}
          </button>
          <button
            onClick={handleBlackout}
            className="py-5 rounded-lg bg-red-500/25 border border-red-500/50 text-red-300 text-xl font-bold tracking-wider hover:bg-red-500/35 transition-all active:scale-95"
          >
            ⚡ BLACKOUT
          </button>
          <button
            onClick={toggleBeacons}
            title="Turn time beacons off only to measure clock drift on the bench"
            className={`py-1.5 rounded-lg border text-[11px] font-mono transition-all ${
              beaconsOn ? 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10' : 'bg-orange-500/15 border-orange-500/30 text-orange-300'
            }`}
          >
            Time beacons {beaconsOn ? 'on' : 'OFF (drift test)'}
          </button>
        </div>

        <p className="text-white/25 text-[10px] font-mono leading-relaxed px-1">
          Costumes play the show stored in their firmware (show {FIRMWARE_SHOW_ID}). After editing in Show Studio, export it with
          &quot;→ Costume firmware&quot; and upload it, or the costumes won&apos;t match this preview. If the radio drops, costumes keep
          playing; each costume&apos;s power switch is the real emergency cut-off.
        </p>
      </div>
    </div>
  )
}
