'use client'
import { useState } from 'react'
import { PALETTES, generateCues } from '@/lib/show/autocue'
import type { CueStyle } from '@/lib/show/autocue'
import type { AudioAnalysis } from '@/lib/show/analyze'
import { formatShowTime } from '@/lib/show/model'
import { useShowStore } from '@/store/useShowStore'
import { useDashboardStore } from '@/store/useDashboardStore'

const LEVEL_COLORS = { low: '#3b82f6', mid: '#a855f7', high: '#ec4899' }
const STYLES: { id: CueStyle; label: string; hint: string }[] = [
  { id: 'calm', label: 'Calm', hint: 'Soft pulses and chases, no extra strobes' },
  { id: 'balanced', label: 'Balanced', hint: 'Follows the song’s energy' },
  { id: 'energetic', label: 'Energetic', hint: 'Strobes on phrases, more movement' },
]

const pill = (on: boolean) =>
  `px-3 py-1.5 rounded-md border text-xs transition-all ${on ? 'bg-purple-500/30 border-purple-500/60 text-purple-100' : 'bg-black/30 border-white/10 text-white/50 hover:bg-white/10'}`

export default function AutoCueDialog({ analysis, lengthMs, onDone, onClose }: {
  analysis: AudioAnalysis
  lengthMs: number
  onDone: () => void
  onClose: () => void
}) {
  const { project, applyClips } = useShowStore()
  const addLog = useDashboardStore((s) => s.addLog)
  const [style, setStyle] = useState<CueStyle>('balanced')
  const [palette, setPalette] = useState(PALETTES[0].id)
  const [stagger, setStagger] = useState(true)
  const [accents, setAccents] = useState(true)
  const [replace, setReplace] = useState(true)
  const existing = project.clips.length
  const drops = analysis.sections.filter((s) => s.drop).length

  const generate = () => {
    const clips = generateCues(analysis, project.dancers, lengthMs, { style, palette, stagger, accents })
    applyClips(clips, replace)
    addLog('SYNC', `Show · auto cues: ${clips.length} clips from ≈${analysis.bpm.toFixed(0)} BPM, ${analysis.sections.length} sections (${style})`)
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-xl border border-white/10 bg-[#0f0f0f] p-5" onClick={(e) => e.stopPropagation()}>
        <h4 className="text-white font-semibold mb-1">✨ Generate light cues from the music</h4>
        <p className="text-white/40 text-xs mb-4">
          LumaCue listened to the song and found its beat and energy. The cues it makes are normal clips: change or delete any of them afterwards.
        </p>

        {/* What was detected */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            ['Tempo', `≈ ${analysis.bpm.toFixed(1)} BPM`],
            ['Bars', String(analysis.downbeats.length)],
            ['Sections', String(analysis.sections.length)],
            ['Drops', String(drops)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-white/5 bg-black/30 px-2 py-2">
              <p className="text-white/30 text-[10px] font-mono">{k}</p>
              <p className="text-white font-mono text-sm">{v}</p>
            </div>
          ))}
        </div>
        <div className="flex h-3 rounded overflow-hidden mb-1">
          {analysis.sections.map((s, i) => (
            <div key={i} title={`${formatShowTime(s.startMs)}–${formatShowTime(s.endMs)} · ${s.level}${s.drop ? ' · drop' : ''}`}
              style={{ width: `${((s.endMs - s.startMs) / lengthMs) * 100}%`, background: LEVEL_COLORS[s.level] }}
              className={s.drop ? 'border-l-2 border-white' : ''} />
          ))}
        </div>
        <p className="text-white/30 text-[10px] font-mono mb-4">
          <span style={{ color: LEVEL_COLORS.low }}>■</span> calm <span style={{ color: LEVEL_COLORS.mid }}>■</span> building <span style={{ color: LEVEL_COLORS.high }}>■</span> high energy · white edge = drop
        </p>

        {/* Options */}
        <p className="text-white/30 text-[10px] font-mono tracking-widest mb-1">STYLE</p>
        <div className="flex gap-1 mb-1">
          {STYLES.map((s) => <button key={s.id} className={pill(style === s.id)} onClick={() => setStyle(s.id)}>{s.label}</button>)}
        </div>
        <p className="text-white/30 text-[11px] mb-3">{STYLES.find((s) => s.id === style)?.hint}</p>

        <p className="text-white/30 text-[10px] font-mono tracking-widest mb-1">COLOURS</p>
        <div className="flex gap-1 flex-wrap mb-3">
          {PALETTES.map((p) => (
            <button key={p.id} className={`${pill(palette === p.id)} flex items-center gap-1.5`} onClick={() => setPalette(p.id)}>
              <span className="flex">{p.colors.map((c) => <span key={c} className="w-2.5 h-2.5 rounded-full -ml-0.5 first:ml-0 border border-black/40" style={{ background: c }} />)}</span>
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5 mb-4 text-xs text-white/60">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={stagger} onChange={(e) => setStagger(e.target.checked)} className="accent-purple-500" />
            Waves across the dancers (staggered wipes in building parts)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={accents} onChange={(e) => setAccents(e.target.checked)} className="accent-purple-500" />
            Flash on the strongest hits
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="accent-purple-500" />
            Replace the {existing} clip{existing === 1 ? '' : 's'} already on the timeline
            {replace && existing > 0 && <span className="text-white/30">(Ctrl+Z brings them back)</span>}
          </label>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-md border border-white/10 text-white/50 text-sm hover:bg-white/5">Cancel</button>
          <button onClick={generate} className="flex-1 py-2 rounded-md bg-purple-500/30 border border-purple-500/60 text-purple-100 text-sm font-semibold hover:bg-purple-500/40">
            Generate cues
          </button>
        </div>
        <p className="text-white/25 text-[10px] font-mono mt-3">
          Beat and section detection is an estimate and works best on songs with a clear, steady beat. Always check the result by playing it.
        </p>
      </div>
    </div>
  )
}
