'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import StageCanvas from '@/components/timeline/StageCanvas'
import Timeline from '@/components/timeline/Timeline'
import type { SnapMode } from '@/components/timeline/Timeline'
import Inspector from '@/components/timeline/Inspector'
import CostumeSetup from '@/components/timeline/CostumeSetup'
import AutoCueDialog from '@/components/timeline/AutoCueDialog'
import { buildLayout } from '@/lib/show/body'
import { ALL_DANCERS, formatShowTime, isShowProject } from '@/lib/show/model'
import { useShowPlayback } from '@/lib/show/playback'
import { exportArduinoShow } from '@/lib/show/arduino-export'
import { buildFirmware } from '@/lib/show/firmware-bundle'
import type { FirmwareTemplates, LedOutput } from '@/lib/show/firmware-bundle'
import { makeZip } from '@/lib/zip'
import { benchFidelity, benchFingerprint, compileBenchCues, CUE_BUDGET } from '@/lib/show/bench'
import type { BenchOutput } from '@/lib/show/bench'
import { renderDancer } from '@/lib/show/render'
import { useFirmwareStore } from '@/store/useFirmwareStore'
import { useShowStore } from '@/store/useShowStore'
import { useCostumeStore } from '@/store/useCostumeStore'
import { useDashboardStore } from '@/store/useDashboardStore'

const btn = 'px-2.5 py-1.5 rounded-md border text-[11px] font-mono transition-all disabled:opacity-30'
const btnIdle = `${btn} bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white`
const btnOn = `${btn} bg-purple-500/25 border-purple-500/50 text-purple-100`

export default function TimelineView({ active }: { active: boolean }) {
  const { project, selectedClipId, selectedTrack, selectTrack, deleteClip, duplicateClip, undo, redo, past, future, setProject, replaceProject } = useShowStore()
  const { zones, brightness } = useCostumeStore()
  const addLog = useDashboardStore((s) => s.addLog)
  const pb = useShowPlayback()

  const layout = useMemo(() => buildLayout(zones), [zones])
  const [pxPerSec, setPxPerSec] = useState(60)
  const [snap, setSnap] = useState<SnapMode>('grid')
  const [view, setView] = useState<'all' | 'single'>('all')
  const [xray, setXray] = useState(false)
  const [costumeView, setCostumeView] = useState<BenchOutput | null>(null)
  const recordDownload = useFirmwareStore((s) => s.recordDownload)
  const [arduino, setArduino] = useState<{ dancer: number; output: LedOutput; error?: string; busy?: boolean } | null>(null)
  const [setupOpen, setSetupOpen] = useState(false)
  const [autoOpen, setAutoOpen] = useState(false)
  const peaks = pb.audio
  const audioInput = useRef<HTMLInputElement>(null)
  const importInput = useRef<HTMLInputElement>(null)
  const focusDancer = selectedTrack === ALL_DANCERS ? 0 : selectedTrack

  // Keyboard shortcuts, only while this tab is showing and not typing in a field.
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select')) return
      const mod = e.ctrlKey || e.metaKey
      if (e.code === 'Space') { e.preventDefault(); if (pb.playing) pb.pause(); else pb.play() }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClipId) { e.preventDefault(); deleteClip(selectedClipId) }
      else if (mod && e.key.toLowerCase() === 'd' && selectedClipId) { e.preventDefault(); duplicateClip(selectedClipId) }
      else if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo() }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo() }
      else if (e.key === 'Home') { e.preventDefault(); pb.seek(0) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, pb, selectedClipId, deleteClip, duplicateClip, undo, redo])

  const loadAudio = async (file: File) => {
    try {
      const durationMs = await pb.loadAudio(file)
      setProject({ audioName: file.name, lengthMs: Math.ceil(durationMs) })
      pb.seek(0)
      addLog('INFO', `Show · music loaded: ${file.name} (${formatShowTime(durationMs)})`)
    } catch {
      addLog('ERROR', `Show · could not read ${file.name} as audio`)
    }
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${project.name.replace(/[^\w-]+/g, '_') || 'show'}.lumacue.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text())
      if (!isShowProject(parsed)) throw new Error('not a LumaCue show')
      replaceProject(parsed)
      pb.seek(0)
      addLog('INFO', `Show · opened ${file.name}`)
    } catch (e) {
      addLog('ERROR', `Show · could not open ${file.name}: ${(e as Error).message}`)
    }
  }

  const zoneIds = useMemo(() => zones.map((z) => z.id), [zones])
  const arduinoCode = arduino ? exportArduinoShow(project, zoneIds, arduino.dancer) : ''

  // Preflight for the export dialog: will this dancer's costume look like the preview, and does it fit?
  const preflight = useMemo(() => {
    if (!arduino) return null
    const { cues, notes } = compileBenchCues(project, zoneIds, arduino.dancer)
    const frame = new Float32Array(layout.total * 3)
    const fidelity = benchFidelity(project, zoneIds, arduino.dancer, (t) => {
      renderDancer(project, layout, arduino.dancer, t, frame)
      return layout.zones.slice(0, 3).map((z) => {
        let r = 0, g = 0, b = 0
        for (let i = z.start; i < z.start + z.count; i++) { r += frame[i * 3]; g += frame[i * 3 + 1]; b += frame[i * 3 + 2] }
        return [r / z.count, g / z.count, b / z.count] as [number, number, number]
      })
    }, 100)
    return { cues: cues.length, notes, fidelity }
  }, [arduino, project, zoneIds, layout])

  // Ready-to-upload sketches: the repo templates with this show, its length and the LED type filled in.
  const downloadFirmware = async () => {
    if (!arduino) return
    setArduino({ ...arduino, busy: true, error: undefined })
    try {
      const res = await fetch('/api/firmware')
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      const files = buildFirmware(body as FirmwareTemplates, project, zoneIds, arduino.dancer, arduino.output)
      const folder = `lumacue_${project.name.replace(/[^\w-]+/g, '_') || 'show'}_dancer${arduino.dancer + 1}`
      const a = document.createElement('a')
      a.href = URL.createObjectURL(makeZip(files.map((f) => ({ path: `${folder}/${f.path}`, text: f.text }))))
      a.download = `${folder}.zip`
      a.click()
      URL.revokeObjectURL(a.href)
      recordDownload(arduino.dancer, { fingerprint: benchFingerprint(project, zoneIds, arduino.dancer), output: arduino.output, downloadedAt: Date.now() })
      addLog('SYNC', `Show · firmware for Dancer ${arduino.dancer + 1} downloaded (${folder}.zip, ${formatShowTime(project.lengthMs)})`)
      setArduino({ ...arduino, busy: false })
    } catch (e) {
      setArduino({ ...arduino, busy: false, error: (e as Error).message })
    }
  }

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* Digital twin + inspector */}
      <div className="flex gap-3 h-[46%] min-h-[240px] shrink-0">
        <div className="relative flex-1 min-w-0 rounded-xl border border-white/10 overflow-hidden">
          <StageCanvas
            project={project}
            layout={layout}
            timeMs={pb.timeMs}
            view={view}
            focusDancer={focusDancer}
            brightness={brightness}
            xray={xray}
            bench={costumeView}
            onPickDancer={(d) => selectTrack(d)}
          />
          <div className="absolute top-2 right-2 flex gap-1">
            <button className={view === 'all' ? btnOn : btnIdle} onClick={() => setView('all')}>All dancers</button>
            <button className={view === 'single' ? btnOn : btnIdle} onClick={() => setView('single')}>Dancer {focusDancer + 1}</button>
            <button className={xray ? btnOn : btnIdle} onClick={() => setXray(!xray)} title="Hide the body and show only the LED layout">X-ray</button>
            <button
              className={costumeView ? `${btn} bg-yellow-500/20 border-yellow-500/40 text-yellow-200` : btnIdle}
              onClick={() => setCostumeView(costumeView === null ? '5mm' : costumeView === '5mm' ? 'strip' : null)}
              title="Preview → what the bench costume firmware will light (5 mm LEDs) → (WS2812B strip) → back to the preview"
            >
              {costumeView === null ? 'Preview' : costumeView === '5mm' ? 'Costume: 5 mm' : 'Costume: strip'}
            </button>
            <button className={btnIdle} onClick={() => setSetupOpen(true)} title="Zones, LED counts, body positions, brightness and battery">⚙ Costume setup</button>
          </div>
        </div>
        <Inspector timeMs={pb.timeMs} audioLoaded={!!peaks} />
      </div>

      {/* Transport */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 shrink-0">
        <button className={btnIdle} onClick={() => pb.seek(0)} title="Go to start (Home)">⏮</button>
        <button className={`${btn} bg-green-500/20 border-green-500/40 text-green-300 hover:bg-green-500/30 w-16`} onClick={() => (pb.playing ? pb.pause() : pb.play())} title="Play / pause (Space)">
          {pb.playing ? '❚❚ Pause' : '▶ Play'}
        </button>
        <button className={pb.loop ? btnOn : btnIdle} onClick={() => pb.setLoop(!pb.loop)} title="Loop">⟲ Loop</button>
        <span className="font-mono text-white text-sm tabular-nums px-2">{formatShowTime(pb.timeMs)}<span className="text-white/30"> / {formatShowTime(project.lengthMs)}</span></span>

        <div className="h-5 w-px bg-white/10 mx-1" />
        <span className="text-white/30 text-[10px] font-mono">ZOOM</span>
        <input type="range" min={15} max={400} value={pxPerSec} onChange={(e) => setPxPerSec(Number(e.target.value))} className="w-24 accent-purple-500" aria-label="Timeline zoom" />
        <button
          className={snap === 'off' ? btnIdle : btnOn}
          onClick={() => setSnap(snap === 'off' ? 'grid' : snap === 'grid' && peaks ? 'beat' : 'off')}
          title="Snap clips: off → 0.1 s → to the beat (needs music)"
        >
          Snap: {snap === 'off' ? 'off' : snap === 'grid' ? '0.1 s' : 'beat'}
        </button>
        <button className={btnIdle} onClick={undo} disabled={!past.length} title="Undo (Ctrl+Z)">↶</button>
        <button className={btnIdle} onClick={redo} disabled={!future.length} title="Redo (Ctrl+Shift+Z)">↷</button>

        <div className="h-5 w-px bg-white/10 mx-1" />
        <button className={`${btn} bg-cyan-500/15 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25`} onClick={() => audioInput.current?.click()}>♪ {peaks ? 'Change music' : 'Load music'}</button>
        <button
          className={`${btn} bg-purple-500/20 border-purple-500/40 text-purple-200 hover:bg-purple-500/30`}
          onClick={() => setAutoOpen(true)}
          disabled={!peaks}
          title={peaks ? 'Create cues automatically from the song’s beat and energy' : 'Load music first'}
        >
          ✨ Auto cues
        </button>
        <input ref={audioInput} type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadAudio(f); e.target.value = '' }} />

        <div className="ml-auto flex gap-1.5">
          <button className={btnIdle} onClick={() => importInput.current?.click()}>Open</button>
          <input ref={importInput} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importJson(f); e.target.value = '' }} />
          <button className={btnIdle} onClick={exportJson}>Save file</button>
          <button className={`${btn} bg-yellow-500/15 border-yellow-500/30 text-yellow-200 hover:bg-yellow-500/25`} onClick={() => setArduino({ dancer: focusDancer, output: '5mm' })}>→ Costume firmware</button>
        </div>
      </div>

      {project.audioName && !peaks && (
        <p className="text-yellow-300/70 text-[11px] font-mono px-1 -mt-1">Music &quot;{project.audioName}&quot; isn&apos;t loaded in this session. Load it again to hear it and see the waveform.</p>
      )}

      <Timeline
        timeMs={pb.timeMs}
        pxPerSec={pxPerSec}
        snap={snap === 'beat' && !peaks ? 'grid' : snap}
        analysis={peaks?.analysis ?? null}
        following={pb.playing}
        peaks={peaks?.peaks ?? null}
        peaksMs={peaks?.durationMs ?? 0}
        audioName={project.audioName}
        onSeek={pb.seek}
      />

      {autoOpen && peaks && (
        <AutoCueDialog
          analysis={peaks.analysis}
          lengthMs={project.lengthMs}
          onDone={() => { setAutoOpen(false); pb.seek(0) }}
          onClose={() => setAutoOpen(false)}
        />
      )}

      {/* Costume setup: edits update the digital twin behind the dialog live */}
      {setupOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 p-4 pt-24" onClick={() => setSetupOpen(false)}>
          <div className="w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-white/60 text-[10px] font-mono tracking-widest">COSTUME SETUP · applies to every dancer</p>
              <button className={btnIdle} onClick={() => setSetupOpen(false)}>Done</button>
            </div>
            <div className="bg-[#0f0f0f] rounded-xl">
              <CostumeSetup />
            </div>
          </div>
        </div>
      )}

      {/* Firmware export */}
      {arduino && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setArduino(null)}>
          <div className="w-full max-w-3xl rounded-xl border border-white/10 bg-[#0f0f0f] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3 gap-3">
              <h4 className="text-white font-semibold">Export to bench costume firmware</h4>
              <div className="flex gap-2">
                <select value={arduino.dancer} onChange={(e) => setArduino({ ...arduino, dancer: Number(e.target.value) })} className="bg-black/40 border border-white/10 rounded-md px-2 py-1 text-white text-xs" aria-label="Dancer">
                  {Array.from({ length: project.dancers }, (_, i) => <option key={i} value={i}>Dancer {i + 1}</option>)}
                </select>
                <select value={arduino.output} onChange={(e) => setArduino({ ...arduino, output: e.target.value as LedOutput })} className="bg-black/40 border border-white/10 rounded-md px-2 py-1 text-white text-xs" aria-label="LEDs on the costume">
                  <option value="5mm">5 mm bi-colour LEDs</option>
                  <option value="strip">WS2812B strip</option>
                </select>
              </div>
            </div>

            <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-3 mb-3 flex items-center gap-3">
              <button className={`${btn} bg-purple-500/30 border-purple-500/60 text-purple-100 hover:bg-purple-500/40 text-xs px-4 py-2`} onClick={() => void downloadFirmware()} disabled={arduino.busy}>
                {arduino.busy ? 'Preparing…' : '⬇ Download sketches (.zip)'}
              </button>
              <p className="text-white/50 text-[11px]">
                Both sketches, ready to upload: show, length ({formatShowTime(project.lengthMs)}) and LED type already set. Unzip, open each <code>.ino</code> in the Arduino IDE, upload.
              </p>
            </div>
            {arduino.error && <p className="text-red-400 text-[11px] font-mono mb-3">Couldn&apos;t build the sketches: {arduino.error}</p>}

            {preflight && (
              <div className="rounded-lg border border-white/10 bg-black/30 p-3 mb-3 text-[11px] font-mono">
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                  <span className={preflight.fidelity.matchPct >= 90 ? 'text-green-300' : preflight.fidelity.matchPct >= 70 ? 'text-yellow-300' : 'text-red-300'}>
                    Costume matches preview: {Math.round(preflight.fidelity.matchPct)} %
                  </span>
                  <span className={preflight.cues > CUE_BUDGET ? 'text-red-300' : 'text-white/50'}>
                    {preflight.cues} cues (fits ≈ {CUE_BUDGET})
                  </span>
                  <button className="text-yellow-200/80 hover:text-yellow-100 underline-offset-2 hover:underline" onClick={() => { setCostumeView(arduino.output); setArduino(null) }}>
                    See it in Costume view →
                  </button>
                </div>
                {preflight.fidelity.issues.length > 0 && (
                  <ul className="mt-2 space-y-0.5 max-h-24 overflow-y-auto">
                    {preflight.fidelity.issues.slice(0, 8).map((i) => (
                      <li key={`${i.track}-${i.clipStartMs}`}>
                        <button className="text-left text-white/50 hover:text-white" onClick={() => { pb.seek(i.clipStartMs); setArduino(null) }}>
                          ⚠ {formatShowTime(i.clipStartMs)} · {i.effect} ({i.track === ALL_DANCERS ? 'all' : `Dancer ${i.track + 1}`}) looks {Math.round(i.mismatchPct)} % different on the costume
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {preflight.notes.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-white/35">
                    {preflight.notes.map((n) => <li key={n}>· {n}</li>)}
                  </ul>
                )}
              </div>
            )}

            <p className="text-white/30 text-[10px] font-mono tracking-widest mb-1">OR COPY THE CUE TABLE ONLY</p>
            <textarea readOnly value={arduinoCode} className="w-full h-56 bg-black/50 border border-white/10 rounded-md p-3 text-[11px] font-mono text-green-200" />
            <div className="flex gap-2 mt-3">
              <button className={btnIdle} onClick={() => void navigator.clipboard.writeText(arduinoCode).then(() => addLog('INFO', 'Show · firmware cue table copied'))}>Copy</button>
              <p className="text-white/30 text-[11px] self-center">Paste over <code>SHOW[]</code> in <code>test_costume.ino</code> and set <code>SHOW_LENGTH_MS</code> in both sketches.</p>
              <button className={`${btnIdle} ml-auto`} onClick={() => setArduino(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
