'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import StageCanvas from '@/components/timeline/StageCanvas'
import { buildLayout } from '@/lib/show/body'
import { formatShowTime } from '@/lib/show/model'
import { useShowPlayback } from '@/lib/show/playback'
import { isWebSerialSupported } from '@/lib/base-station-serial'
import { FIRMWARE_SHOW_ID, useCostumeStore } from '@/store/useCostumeStore'
import { useShowStore } from '@/store/useShowStore'
import { useFirmwareStore } from '@/store/useFirmwareStore'
import { benchFingerprint } from '@/lib/show/bench'

/**
 * Show Mode: runs the show on the night. Nothing here edits the show, so a
 * stray click can't change it mid-performance. START starts the costumes (via
 * the base station), the music and the digital twin together.
 */
export default function ShowModeView() {
  const project = useShowStore((s) => s.project)
  const {
    zones, brightness, baseConnected, baseKind, armed, running, beaconsOn, musicSync, baseDriftMs, baseShowLengthMs, speakerDelayMs,
    connectBase, connectSimulator, disconnectBase, arm, start, blackout, toggleBeacons, showEnded, setMusicSync, syncToMusic, setSpeakerDelay,
  } = useCostumeStore()
  const pb = useShowPlayback()
  const layout = useMemo(() => buildLayout(zones), [zones])
  const flashed = useFirmwareStore((s) => s.byDancer)
  // Which costumes carry the show as it is now (by the last firmware download for each dancer).
  const firmware = useMemo(() => {
    const ids = zones.map((z) => z.id)
    return Array.from({ length: project.dancers }, (_, d) => {
      const rec = flashed[d]
      const hw = rec && { output: rec.output, zoneLeds: zones.map((z) => z.leds), brightnessPct: brightness }
      return { dancer: d, state: !rec || !hw ? 'never' : rec.fingerprint === benchFingerprint(project, ids, d, hw) ? 'ok' : 'stale' } as const
    })
  }, [project, zones, flashed, brightness])
  const staleCount = firmware.filter((f) => f.state !== 'ok').length

  // With a speaker delay, the music starts now and the costumes when the audience hears it.
  const delayedStart = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelDelayedStart = () => {
    if (delayedStart.current) clearTimeout(delayedStart.current)
    delayedStart.current = null
  }
  // Rehearsal: start from a section instead of the top (the base sends S<ms>; costumes join there).
  const [startFrom, setStartFrom] = useState(0)
  const startPoints = useMemo(
    () => [{ ms: 0, label: 'the top (0:00)' }, ...(project.sections ?? []).map((s) => ({ ms: s.startMs, label: `§ ${s.name} (${formatShowTime(s.startMs)})` }))],
    [project.sections],
  )
  const from = startFrom < project.lengthMs ? startFrom : 0
  const handleStart = () => {
    cancelDelayedStart()
    pb.seek(from)
    pb.play()
    if (speakerDelayMs > 0) delayedStart.current = setTimeout(() => { delayedStart.current = null; start(from) }, speakerDelayMs)
    else start(from)
  }

  const handleBlackout = () => {
    cancelDelayedStart()
    blackout()
    pb.pause()
  }
  useEffect(() => cancelDelayedStart, [])

  // Keep the base station's clock on the music: it runs on its own resonator,
  // which can be off by ~0.1–0.5 % (up to ~1 s over a 3-minute song).
  // Read the music clock at the moment of sending, not the last rendered frame (up to ~16 ms old).
  const musicNow = pb.now
  useEffect(() => {
    if (!running || !musicSync || !baseConnected) return
    const id = setInterval(() => syncToMusic(musicNow()), 2000)
    return () => clearInterval(id)
  }, [running, musicSync, baseConnected, syncToMusic, musicNow])

  // RESTART during a show needs a 1 s hold, so a stray click can't restart every costume.
  const [holding, setHolding] = useState(false)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pressStart = () => {
    if (!running) return handleStart()
    setHolding(true)
    holdTimer.current = setTimeout(() => { setHolding(false); handleStart() }, 1000)
  }
  const releaseStart = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current)
    holdTimer.current = null
    setHolding(false)
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
                  {baseKind === 'simulator' ? 'Simulator · no hardware' : baseConnected ? 'USB connected' : isWebSerialSupported() ? 'Not connected · preview only' : 'Needs Chrome or Edge · preview only'}
                </p>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              {!baseConnected && (
                <button
                  onClick={() => void connectSimulator()}
                  title="Rehearse Show Mode with a pretend base station (no hardware)"
                  className="text-[10px] px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 transition-all font-mono"
                >
                  SIMULATE
                </button>
              )}
              <button
                onClick={() => (baseConnected ? disconnectBase() : connectBase())}
                disabled={!baseConnected && !isWebSerialSupported()}
                className="text-[10px] px-3 py-1.5 rounded bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 transition-all font-mono disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {baseConnected ? 'DISCONNECT' : 'CONNECT USB'}
              </button>
            </div>
          </div>
          {baseConnected && baseShowLengthMs !== null && Math.abs(baseShowLengthMs - project.lengthMs) > 100 && (
            <p className="mt-3 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-2 py-1.5 text-yellow-200 text-[11px] font-mono">
              ⚠ The base station&apos;s firmware is for a {formatShowTime(baseShowLengthMs)} show, this one is {formatShowTime(project.lengthMs)}.
              It will {baseShowLengthMs < project.lengthMs ? 'stop the show early' : 'keep beaconing after the end'}. Download the firmware again and upload base_station.ino.
            </p>
          )}
          <div className="mt-3 flex items-center justify-between gap-2 text-[11px] font-mono">
            <label className="flex items-center gap-2 text-white/50 cursor-pointer" title="Every 2 s, tell the base station where the music is, so the costumes follow the song and not the base's own clock">
              <input type="checkbox" checked={musicSync} onChange={(e) => setMusicSync(e.target.checked)} className="accent-purple-500" />
              Music sync
            </label>
            <label className="flex items-center gap-1 text-white/50" title="How late the venue's speakers play the music (mixer, wireless, Bluetooth). Film a flash cue on a beat in slow motion and raise this until light and sound line up">
              Speaker delay
              <input
                type="number" min={0} max={1000} step={10} value={speakerDelayMs}
                disabled={running}
                onChange={(e) => setSpeakerDelay(Number(e.target.value))}
                className="w-14 bg-black/40 border border-white/10 rounded px-1 py-0.5 text-white text-right disabled:opacity-40"
                aria-label="Speaker delay in milliseconds"
              />
              ms
            </label>
          </div>
          <div className="mt-2 flex items-center justify-end text-[11px] font-mono">
            <span className={baseDriftMs === null ? 'text-white/25' : Math.abs(baseDriftMs) >= 20 ? 'text-yellow-300' : 'text-green-300/80'} title="How far the base station's clock had drifted from the music at the last sync">
              {baseDriftMs === null ? 'base vs music: –' : `base vs music: ${baseDriftMs > 0 ? '+' : ''}${baseDriftMs} ms`}
            </span>
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
          {startPoints.length > 1 && (
            <label className="flex items-center justify-between gap-2 text-[11px] font-mono text-white/50">
              Start from
              <select
                value={from}
                disabled={running}
                onChange={(e) => setStartFrom(Number(e.target.value))}
                className={`min-w-0 flex-1 bg-black/40 border rounded px-1 py-1 text-xs disabled:opacity-40 ${from ? 'border-amber-400/50 text-amber-200' : 'border-white/10 text-white'}`}
                aria-label="Start the show from"
              >
                {startPoints.map((p) => <option key={p.ms} value={p.ms}>{p.label}</option>)}
              </select>
            </label>
          )}
          <button
            onClick={arm}
            disabled={running}
            className="py-2 rounded-lg bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 text-sm font-medium hover:bg-yellow-500/25 transition-all active:scale-95 disabled:opacity-30"
          >
            ARM
          </button>
          <button
            onPointerDown={pressStart}
            onPointerUp={releaseStart}
            onPointerLeave={releaseStart}
            onKeyDown={(e) => { if (!running && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleStart() } }}
            title={running ? 'Hold for 1 second to restart the show from the top' : 'Start the costumes, the music and the preview together'}
            className="relative overflow-hidden py-5 rounded-lg bg-green-500/25 border border-green-500/50 text-green-200 text-xl font-bold hover:bg-green-500/35 transition-all active:scale-95 select-none"
          >
            {running && (
              <span
                className="absolute inset-y-0 left-0 bg-green-400/30"
                style={{ width: holding ? '100%' : '0%', transition: holding ? 'width 1s linear' : 'none' }}
              />
            )}
            <span className="relative">{running ? (holding ? 'KEEP HOLDING…' : '↻ HOLD TO RESTART') : from ? `▶ START AT ${formatShowTime(from)}` : '▶ START'}</span>
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

        {/* Preflight: is each costume's firmware built from this show? */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-white text-sm font-semibold">Costume firmware</p>
            <span className={`text-[10px] font-mono ${staleCount ? 'text-yellow-300' : 'text-green-300'}`}>
              {staleCount ? `${staleCount} to update` : 'all match this show'}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1">
            {firmware.map((f) => (
              <div
                key={f.dancer}
                title={f.state === 'ok' ? 'Firmware downloaded for this exact show' : f.state === 'stale' ? 'The show changed after this firmware was downloaded: export and upload again' : 'No firmware downloaded for this dancer yet'}
                className={`rounded px-1 py-1 text-center text-[10px] font-mono border ${
                  f.state === 'ok' ? 'border-green-500/30 bg-green-500/10 text-green-300' : f.state === 'stale' ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300' : 'border-white/10 text-white/30'
                }`}
              >
                D{f.dancer + 1} {f.state === 'ok' ? '✓' : f.state === 'stale' ? '!' : '–'}
              </div>
            ))}
          </div>
          <p className="text-white/25 text-[10px] font-mono mt-2">Based on downloads from Show Studio in this browser; it can&apos;t see what is actually on the boards.</p>
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
