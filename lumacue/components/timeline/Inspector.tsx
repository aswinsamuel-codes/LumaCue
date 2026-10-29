'use client'
import { ALL_DANCERS, EFFECTS, EFFECT_BY_ID, trackLabel } from '@/lib/show/model'
import { useShowStore } from '@/store/useShowStore'
import { useState } from 'react'
import { SPREAD_ORDERS } from '@/lib/show/spread'
import type { SpreadOrder } from '@/lib/show/spread'
import { useCostumeStore } from '@/store/useCostumeStore'

const SWATCHES = ['#FFFFFF', '#FF0033', '#FF6B00', '#FFD000', '#00FF66', '#00E5FF', '#2563EB', '#7C3AED', '#FF00CC', '#000000']

const label = 'text-white/30 text-[10px] font-mono tracking-widest mb-1'
const input = 'w-full bg-black/40 border border-white/10 rounded-md px-2 py-1 text-white text-xs font-mono focus:outline-none focus:border-purple-500/50'

export default function Inspector({ timeMs, audioLoaded }: { timeMs: number; audioLoaded: boolean }) {
  const { project, selectedClipId, selectedTrack, addClip, updateClip, deleteClip, duplicateClip, checkpoint, setProject, spreadClip } = useShowStore()
  const [spreadStep, setSpreadStep] = useState(150)
  const [spreadOrder, setSpreadOrder] = useState<SpreadOrder>('forward')
  const zones = useCostumeStore((s) => s.zones)
  const clip = project.clips.find((c) => c.id === selectedClipId) ?? null
  const info = clip ? EFFECT_BY_ID[clip.effect] : null
  const tracks = [ALL_DANCERS, ...Array.from({ length: project.dancers }, (_, i) => i)]

  const change = (patch: Parameters<typeof updateClip>[1]) => {
    if (!clip) return
    checkpoint()
    updateClip(clip.id, patch)
  }

  return (
    <aside className="w-72 shrink-0 rounded-xl border border-white/10 bg-white/5 p-3 overflow-y-auto">
      {/* Effect palette */}
      <p className={label}>ADD EFFECT · {trackLabel(selectedTrack).toUpperCase()} @ {(timeMs / 1000).toFixed(1)}s</p>
      <div className="grid grid-cols-3 gap-1 mb-4">
        {EFFECTS.map((fx) => (
          <button
            key={fx.id}
            onClick={() => (clip ? change({ effect: fx.id }) : addClip(selectedTrack, timeMs, fx.id))}
            title={clip ? `Change clip to ${fx.label}: ${fx.hint}` : `Add ${fx.label} at the playhead: ${fx.hint}`}
            className={`py-1.5 rounded-md border text-[11px] transition-all ${
              clip?.effect === fx.id
                ? 'bg-purple-500/30 border-purple-500/60 text-purple-100'
                : 'bg-black/30 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            {fx.label}
          </button>
        ))}
      </div>
      {clip && (
        <button onClick={() => addClip(selectedTrack, timeMs, clip.effect)} className="w-full mb-4 py-1.5 rounded-md bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[11px] hover:bg-blue-500/30">
          + New {info?.label} clip at playhead
        </button>
      )}

      {clip && info ? (
        <div className="flex flex-col gap-3">
          <p className="text-white text-sm font-semibold">{info.label} <span className="text-white/30 text-xs font-normal">· {info.hint}</span></p>

          <div>
            <p className={label}>{info.usesColor2 ? 'FROM COLOUR' : 'COLOUR'}</p>
            <div className="flex gap-1 flex-wrap items-center">
              <input type="color" value={clip.color} onFocus={checkpoint} onChange={(e) => updateClip(clip.id, { color: e.target.value })} className="w-8 h-6 bg-transparent cursor-pointer" aria-label="Colour" />
              {SWATCHES.map((c) => (
                <button key={c} onClick={() => change({ color: c })} className="w-5 h-5 rounded border border-white/20" style={{ background: c }} aria-label={c} />
              ))}
            </div>
          </div>

          {info.usesColor2 && (
            <div>
              <p className={label}>TO COLOUR</p>
              <div className="flex gap-1 flex-wrap items-center">
                <input type="color" value={clip.color2} onFocus={checkpoint} onChange={(e) => updateClip(clip.id, { color2: e.target.value })} className="w-8 h-6 bg-transparent cursor-pointer" aria-label="Second colour" />
                {SWATCHES.map((c) => (
                  <button key={c} onClick={() => change({ color2: c })} className="w-5 h-5 rounded border border-white/20" style={{ background: c }} aria-label={c} />
                ))}
              </div>
            </div>
          )}

          {info.usesSpeed && (
            <div>
              <div className="flex justify-between"><p className={label}>SPEED</p><span className="text-white/40 text-[10px] font-mono">{Math.round(clip.speed)}</span></div>
              <input type="range" min={0} max={100} value={clip.speed} onPointerDown={checkpoint} onChange={(e) => updateClip(clip.id, { speed: Number(e.target.value) })} className="w-full accent-purple-500" />
            </div>
          )}

          <div>
            <p className={label}>ZONES</p>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => change({ zones: [] })}
                className={`px-2 py-1 rounded text-[10px] border ${clip.zones.length === 0 ? 'bg-purple-500/30 border-purple-500/50 text-purple-100' : 'border-white/10 text-white/50'}`}
              >
                Whole costume
              </button>
              {zones.map((z) => {
                const on = clip.zones.includes(z.id)
                return (
                  <button
                    key={z.id}
                    onClick={() => change({ zones: on ? clip.zones.filter((id) => id !== z.id) : [...clip.zones, z.id] })}
                    className={`px-2 py-1 rounded text-[10px] border ${on ? 'bg-purple-500/30 border-purple-500/50 text-purple-100' : 'border-white/10 text-white/50'}`}
                  >
                    {z.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label>
              <p className={label}>START (s)</p>
              <input type="number" step={0.1} min={0} value={(clip.startMs / 1000).toFixed(1)} onFocus={checkpoint}
                onChange={(e) => updateClip(clip.id, { startMs: Math.max(0, Math.min(project.lengthMs - clip.durationMs, Number(e.target.value) * 1000)) })} className={input} />
            </label>
            <label>
              <p className={label}>LENGTH (s)</p>
              <input type="number" step={0.1} min={0.1} value={(clip.durationMs / 1000).toFixed(1)} onFocus={checkpoint}
                onChange={(e) => updateClip(clip.id, { durationMs: Math.max(100, Math.min(project.lengthMs - clip.startMs, Number(e.target.value) * 1000)) })} className={input} />
            </label>
          </div>

          <label>
            <p className={label}>TRACK</p>
            <select value={clip.track} onChange={(e) => change({ track: Number(e.target.value) })} className={input}>
              {tracks.map((t) => <option key={t} value={t}>{trackLabel(t)}</option>)}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => duplicateClip(clip.id)} className="py-1.5 rounded-md bg-white/5 border border-white/10 text-white/60 text-xs hover:bg-white/10">Duplicate</button>
            <button onClick={() => deleteClip(clip.id)} className="py-1.5 rounded-md bg-red-500/15 border border-red-500/30 text-red-300 text-xs hover:bg-red-500/25">Delete</button>
          </div>

          {/* The hand-sweep look: the same clip travelling down the line of dancers */}
          {project.dancers > 1 && (
            <div className="rounded-md border border-white/10 p-2">
              <p className={label}>SPREAD ACROSS DANCERS</p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <select value={spreadOrder} onChange={(e) => setSpreadOrder(e.target.value as SpreadOrder)} className={input} aria-label="Spread order">
                  {SPREAD_ORDERS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                <select value={spreadStep} onChange={(e) => setSpreadStep(Number(e.target.value))} className={input} aria-label="Delay between dancers">
                  {[50, 100, 150, 250, 400, 600].map((ms) => <option key={ms} value={ms}>{ms} ms apart</option>)}
                </select>
              </div>
              <button
                onClick={() => spreadClip(clip.id, spreadStep, spreadOrder)}
                className="w-full py-1.5 rounded-md bg-purple-500/20 border border-purple-500/40 text-purple-200 text-xs hover:bg-purple-500/30"
                title="Replace this clip with a copy on each dancer's track, each a little later"
              >
                ⇶ Spread over {project.dancers} dancers
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-white/40 text-xs">Select a clip to edit it, or pick an effect above to add one at the playhead. Double-click a track to add a clip there.</p>
          <label>
            <p className={label}>SHOW NAME</p>
            <input value={project.name} onChange={(e) => setProject({ name: e.target.value })} className={input} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label>
              <p className={label}>DANCERS</p>
              <input type="number" min={1} max={12} value={project.dancers} onChange={(e) => setProject({ dancers: Math.max(1, Math.min(12, Number(e.target.value) || 1)) })} className={input} />
            </label>
            <label>
              <p className={label}>LENGTH (s)</p>
              <input type="number" min={5} max={900} step={1} value={Math.round(project.lengthMs / 1000)} disabled={audioLoaded}
                title={audioLoaded ? 'Set by the music' : undefined}
                onChange={(e) => setProject({ lengthMs: Math.max(5, Math.min(900, Number(e.target.value) || 5)) * 1000 })} className={`${input} disabled:opacity-40`} />
            </label>
          </div>
          <p className="text-white/25 text-[10px] font-mono leading-relaxed">
            Shortcuts: Space play/pause · Del delete · Ctrl+D duplicate · Ctrl+Z / Ctrl+Shift+Z undo/redo · Home go to start
          </p>
        </div>
      )}
    </aside>
  )
}
