'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import StageCanvas from '@/components/timeline/StageCanvas'
import BenchTestLog from '@/components/showmode/BenchTestLog'
import { buildLayout } from '@/lib/show/body'
import { formatShowTime } from '@/lib/show/model'
import { useShowPlayback } from '@/lib/show/playback'
import { isWebSerialSupported } from '@/lib/base-station-serial'
import { FIRMWARE_SHOW_ID, useCostumeStore } from '@/store/useCostumeStore'
import { useShowStore } from '@/store/useShowStore'
import { useFirmwareStatus } from '@/lib/show/use-firmware-status'
import { CURRENT_LIMIT_MA, showChecklist, worstCaseMilliamps } from '@/lib/show/checklist'
import { powerSummary, scaleSummary } from '@/lib/show/power'
import { useFirmwareStore } from '@/store/useFirmwareStore'

/**
 * Show Mode: runs the show on the night. Nothing here edits the show, so a
 * stray click can't change it mid-performance. START starts the costumes (via
 * the base station), the music and the digital twin together.
 */
export default function ShowModeView({ active = true }: { active?: boolean }) {
  const project = useShowStore((s) => s.project)
  const {
    zones, brightness, baseConnected, baseKind, armed, running, beaconsOn, musicSync, baseDriftMs, baseDriftPpm, baseShowLengthMs, speakerDelayMs,
    connectBase, connectSimulator, disconnectBase, arm, start, blackout, toggleBeacons, showEnded, setMusicSync, syncToMusic, setSpeakerDelay, measureDrift,
  } = useCostumeStore()
  const pb = useShowPlayback()
  const layout = useMemo(() => buildLayout(zones), [zones])
  // Which costumes carry the show as it is now (by the last firmware download for each dancer).
  const { perDancer: firmware, toUpdate: staleCount } = useFirmwareStatus()

  // Real-show power for the checklist, only while this tab is showing (it renders every dancer's whole
  // show). Worked out at 100 % and scaled, so moving the brightness cap doesn't re-render anything.
  // Costumes flashed with the 5 mm build don't use the strip's power figures.
  // Dancers whose up-to-date firmware is the 5 mm build don't follow the strip power model.
  const records = useFirmwareStore((s) => s.byDancer)
  const fiveMm = useMemo(
    () => new Set(firmware.filter((f) => f.state === 'ok' && records[f.dancer]?.output === '5mm').map((f) => f.dancer)),
    [firmware, records],
  )
  // Keyed on which dancers, not on the Set object, so playback re-renders don't redo the power pass.
  const fiveMmKey = [...fiveMm].join(',')
  const power100 = useMemo(
    () => (active ? powerSummary(project, layout, 250, new Set(fiveMmKey ? fiveMmKey.split(',').map(Number) : [])) : null),
    [active, project, layout, fiveMmKey],
  )
  const showPower = useMemo(() => {
    if (!power100) return null
    const s = scaleSummary(power100, brightness)
    return { peakDancer: s.highestPeak.dancer, peakMa: s.highestPeak.power.peakMa, peakAtMs: s.highestPeak.power.peakAtMs, busiestDancer: s.busiest.dancer, busiestAvgMa: s.busiest.power.avgMa }
  }, [power100, brightness])

  const checklist = showChecklist({
    baseKind, baseShowLengthMs, showLengthMs: project.lengthMs,
    firmware: firmware.map((f) => f.state),
    showAudioName: project.audioName, loadedAudioName: pb.audio?.name ?? (pb.youtube ? `YouTube: ${pb.youtube.name}` : null),
    musicSync, speakerDelayMs,
    worstCaseMa: worstCaseMilliamps(layout.total, brightness), showPower, currentLimitMa: CURRENT_LIMIT_MA, fiveMmCount: fiveMm.size, dancers: project.dancers,
  })
  const toFix = checklist.filter((c) => c.level === 'fail').length

  // With a speaker delay, the music starts now and the costumes when the audience hears it.
  const delayedStart = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelDelayedStart = () => {
    if (delayedStart.current) clearTimeout(delayedStart.current)
    delayedStart.current = null
  }
  const [benchLogOpen, setBenchLogOpen] = useState(false)

  // Rehearsal: start from a section instead of the top (the base sends S<ms>; costumes join there).
  const [startFrom, setStartFrom] = useState(0)
  const startPoints = useMemo(
    () => {
      // One entry per start time: a section at 0:00 is the top of the show.
      const points = [{ ms: 0, label: 'the top (0:00)' }]
      for (const s of project.sections ?? []) {
        const at = points.find((p) => p.ms === s.startMs)
        if (at) at.label = `${at.label.replace(/ \(.*\)$/, '')} / § ${s.name} (${formatShowTime(s.startMs)})`
        else points.push({ ms: s.startMs, label: `§ ${s.name} (${formatShowTime(s.startMs)})` })
      }
      return points
    },
    [project.sections],
  )
  // Only a start point that is still offered counts (its section may have been deleted since).
  const from = startPoints.some((p) => p.ms === startFrom) && startFrom < project.lengthMs ? startFrom : 0
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

  // Music sync off (bench test T12): measure how far the base's own clock drifts from the music.
  useEffect(() => {
    if (!running || musicSync || !baseConnected) return
    const id = setInterval(() => measureDrift(musicNow), 5000)
    return () => clearInterval(id)
  }, [running, musicSync, baseConnected, measureDrift, musicNow])

  // RESTART during a show needs a 1 s hold, so a stray click can't restart every costume.
  const [holding, setHolding] = useState(false)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pressStart = (e: React.PointerEvent) => {
    if (e.button !== 0) return // primary button / touch / pen only: a right-click must not start the show
    if (!running) return handleStart()
    setHolding(true)
    holdTimer.current = setTimeout(() => { holdTimer.current = null; setHolding(false); handleStart() }, 1000)
  }
  const releaseStart = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current)
    holdTimer.current = null
    setHolding(false)
  }
  // Leaving Show Mode mid-hold must not restart the show behind the operator's back.
  useEffect(() => () => { if (holdTimer.current) clearTimeout(holdTimer.current) }, [])

  // The show clock ran to the end: the costumes have finished too.
  // With a speaker delay the costumes finish that much after the music clock does.
  const wasPlaying = useRef(false)
  useEffect(() => {
    let id: ReturnType<typeof setTimeout> | undefined
    if (wasPlaying.current && !pb.playing && pb.timeMs >= project.lengthMs - 1) id = setTimeout(showEnded, speakerDelayMs)
    wasPlaying.current = pb.playing
    return () => clearTimeout(id)
  }, [pb.playing, pb.timeMs, project.lengthMs, showEnded, speakerDelayMs])

  // The show stopped without the operator (base refused the start, old firmware…): stop the music too.
  const wasRunning = useRef(running)
  useEffect(() => {
    if (wasRunning.current && !running && pb.playing && pb.timeMs < project.lengthMs - 1) {
      cancelDelayedStart()
      pb.pause()
    }
    wasRunning.current = running
  })

  const state = running ? 'RUNNING' : armed ? 'ARMED' : 'IDLE'
  const stateColor = running ? 'text-green-400' : armed ? 'text-yellow-300' : 'text-white/40'
  const progress = Math.min(100, (pb.timeMs / project.lengthMs) * 100)
  const musicMissing = !!project.audioName && !pb.audio && !pb.youtube

  return (
    <div className="flex gap-3 h-full min-h-0">
      {/* View-only digital twin */}
      <div className="relative flex-1 min-w-0 rounded-xl border border-white/10 overflow-hidden">
        {/* The costumes run speakerDelayMs behind the laptop's music, so the twin does too. */}
        <StageCanvas project={project} layout={layout} timeMs={Math.max(0, pb.timeMs - speakerDelayMs)} view="all" focusDancer={-1} brightness={brightness} xray={false} dark={!running} />
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
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-mono">
            <button onClick={() => setBenchLogOpen(true)} className="text-white/40 hover:text-white underline-offset-2 hover:underline" title="Record bench test results (T1–T12) and copy them into the README">
              Bench tests
            </button>
            <span className={baseDriftMs === null ? 'text-white/25' : Math.abs(baseDriftMs) >= 20 ? 'text-yellow-300' : 'text-green-300/80'} title="How far the base station's clock had drifted from the music at the last sync">
              {baseDriftMs === null
                ? 'base vs music: –'
                : `base vs music: ${baseDriftMs > 0 ? '+' : ''}${baseDriftMs} ms${!musicSync && baseDriftPpm !== null ? ` (${baseDriftPpm > 0 ? '+' : ''}${baseDriftPpm} ppm, measuring)` : ''}`}
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
            ♪ {pb.audio ? pb.audio.name : pb.youtube ? `YouTube: ${pb.youtube.name} (ads or buffering pause the show)` : musicMissing ? `${project.audioName}: load it in Show Studio` : 'No music'}
          </p>
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
        {/* Show-night checklist */}
        <div className={`rounded-xl border p-4 ${toFix ? 'border-red-500/30 bg-red-500/[0.04]' : 'border-white/10 bg-white/5'}`}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-white text-sm font-semibold">Checklist</p>
            <span className={`text-[10px] font-mono ${toFix ? 'text-red-300' : 'text-green-300'}`}>{toFix ? `${toFix} to fix before the show` : 'ready'}</span>
          </div>
          <ul className="space-y-1">
            {/* During the show only the problems are worth the space */}
            {checklist.filter((c) => !running || c.level !== 'ok').map((c) => (
              <li key={c.id} className={`flex gap-2 text-[11px] leading-snug ${c.level === 'ok' ? 'text-white/45' : c.level === 'warn' ? 'text-yellow-200/80' : 'text-red-300'}`}>
                <span className="shrink-0 w-3 text-center">{c.level === 'ok' ? '✓' : c.level === 'warn' ? '!' : '✕'}</span>
                <span>{c.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Cues: pinned to the bottom of the column so START and BLACKOUT never scroll out of view */}
        <div className="sticky bottom-0 z-10 rounded-xl border border-white/10 bg-[#141416] p-4 flex flex-col gap-2 shadow-[0_-12px_24px_rgba(0,0,0,0.6)]">
          {toFix > 0 && !running && (
            <p className="text-red-300 text-[11px] font-mono -mt-1">✕ Checklist: {toFix} to fix before the show (above)</p>
          )}
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
            title={running ? `Hold for 1 second to restart from ${from ? formatShowTime(from) : 'the top'}` : 'Start the costumes, the music and the preview together'}
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

      </div>
      {benchLogOpen && <BenchTestLog onClose={() => setBenchLogOpen(false)} />}
    </div>
  )
}
