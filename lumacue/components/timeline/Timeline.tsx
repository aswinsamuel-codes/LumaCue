'use client'
import { useEffect, useMemo, useRef } from 'react'
import { ALL_DANCERS, EFFECT_BY_ID, trackLabel } from '@/lib/show/model'
import type { Clip } from '@/lib/show/model'
import { formatShowTime } from '@/lib/costume-show'
import { useShowStore } from '@/store/useShowStore'

const HEADER_W = 140
const ROW_H = 34
const MIN_CLIP_MS = 100

interface Props {
  timeMs: number
  pxPerSec: number
  snap: boolean
  following: boolean
  peaks: Float32Array | null
  peaksMs: number
  audioName: string | null
  onSeek: (ms: number) => void
}

function tickStep(pxPerSec: number) {
  for (const s of [0.5, 1, 2, 5, 10, 30, 60]) if (s * pxPerSec >= 70) return s
  return 120
}

function clipBackground(c: Clip) {
  if (c.effect === 'rainbow') return 'linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)'
  if (c.effect === 'blackout') return 'repeating-linear-gradient(45deg,#1a1a1a 0 6px,#262626 6px 12px)'
  if (c.effect === 'fade') return `linear-gradient(90deg,${c.color},${c.color2})`
  if (c.effect === 'strobe') return `repeating-linear-gradient(90deg,${c.color} 0 5px,#111 5px 10px)`
  if (c.effect === 'wipe') return `linear-gradient(90deg,#111,${c.color})`
  if (c.effect === 'chase' || c.effect === 'twinkle') return `repeating-linear-gradient(90deg,${c.color}cc 0 3px,#111 3px 9px)`
  return c.color
}

/** Mirrored waveform as an SVG path, downsampled so long songs stay light. */
function waveformPath(peaks: Float32Array, points: number) {
  const n = Math.min(points, peaks.length)
  const per = peaks.length / n
  const top: string[] = []
  const bottom: string[] = []
  for (let i = 0; i < n; i++) {
    let m = 0
    for (let j = Math.floor(i * per); j < Math.floor((i + 1) * per); j++) m = Math.max(m, peaks[j])
    const h = Math.min(1, m) * 48
    top.push(`${i},${50 - h}`)
    bottom.unshift(`${i},${50 + h}`)
  }
  return { d: `M0,50 L${top.join(' L')} L${bottom.join(' L')} Z`, n }
}

export default function Timeline({ timeMs, pxPerSec, snap, following, peaks, peaksMs, audioName, onSeek }: Props) {
  const { project, selectedClipId, selectedTrack, selectClip, selectTrack, addClip, updateClip, checkpoint } = useShowStore()
  const scroller = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: string; mode: 'move' | 'l' | 'r'; x: number; y: number; startMs: number; durationMs: number; trackIdx: number; moved: boolean } | null>(null)

  const pps = pxPerSec / 1000
  const contentW = Math.max(200, project.lengthMs * pps)
  const tracks = useMemo(() => [ALL_DANCERS, ...Array.from({ length: project.dancers }, (_, i) => i)], [project.dancers])
  const snapMs = (ms: number) => (snap ? Math.round(ms / 100) * 100 : Math.round(ms))
  const step = tickStep(pxPerSec)
  const wave = useMemo(() => (peaks ? waveformPath(peaks, 4000) : null), [peaks])

  // Keep the playhead in view while playing.
  useEffect(() => {
    const el = scroller.current
    if (!el || !following) return
    const x = timeMs * pps
    const visible = el.clientWidth - HEADER_W
    if (x < el.scrollLeft || x > el.scrollLeft + visible - 60) el.scrollLeft = Math.max(0, x - 80)
  }, [timeMs, pps, following])

  // ---- Ruler scrubbing ----
  const seekFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    onSeek(snapMs((e.clientX - rect.left) / pps))
  }

  // ---- Clip drag / resize ----
  const onClipDown = (e: React.PointerEvent<HTMLDivElement>, c: Clip) => {
    e.stopPropagation()
    selectClip(c.id)
    const handle = (e.target as HTMLElement).dataset.handle as 'l' | 'r' | undefined
    drag.current = { id: c.id, mode: handle ?? 'move', x: e.clientX, y: e.clientY, startMs: c.startMs, durationMs: c.durationMs, trackIdx: tracks.indexOf(c.track), moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onClipMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const dms = (e.clientX - d.x) / pps
    if (!d.moved) {
      if (Math.abs(e.clientX - d.x) < 3 && Math.abs(e.clientY - d.y) < 3) return
      d.moved = true
      checkpoint()
    }
    const end = d.startMs + d.durationMs
    if (d.mode === 'move') {
      const startMs = Math.max(0, Math.min(project.lengthMs - d.durationMs, snapMs(d.startMs + dms)))
      const idx = Math.max(0, Math.min(tracks.length - 1, d.trackIdx + Math.round((e.clientY - d.y) / ROW_H)))
      updateClip(d.id, { startMs, track: tracks[idx] })
    } else if (d.mode === 'l') {
      const startMs = Math.max(0, Math.min(end - MIN_CLIP_MS, snapMs(d.startMs + dms)))
      updateClip(d.id, { startMs, durationMs: end - startMs })
    } else {
      const durationMs = Math.max(MIN_CLIP_MS, Math.min(project.lengthMs - d.startMs, snapMs(d.durationMs + dms)))
      updateClip(d.id, { durationMs })
    }
  }

  const onClipUp = () => { drag.current = null }

  return (
    <div ref={scroller} className="relative flex-1 min-h-0 overflow-auto rounded-xl border border-white/10 bg-black/30 select-none">
      <div className="relative" style={{ width: HEADER_W + contentW }}>
        {/* Ruler */}
        <div className="sticky top-0 z-20 flex h-6 bg-[#0d0d10] border-b border-white/10">
          <div className="sticky left-0 z-30 shrink-0 bg-[#0d0d10] border-r border-white/10 px-2 text-[10px] font-mono text-white/30 leading-6" style={{ width: HEADER_W }}>
            {formatShowTime(timeMs)}
          </div>
          <div className="relative cursor-ew-resize" style={{ width: contentW }}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); seekFromEvent(e) }}
            onPointerMove={(e) => { if (e.buttons & 1) seekFromEvent(e) }}
          >
            {Array.from({ length: Math.floor(project.lengthMs / 1000 / step) + 1 }, (_, i) => (
              <div key={i} className="absolute top-0 bottom-0 border-l border-white/15" style={{ left: i * step * pxPerSec }}>
                <span className="absolute left-1 top-1 text-[9px] font-mono text-white/35 whitespace-nowrap">{formatShowTime(i * step * 1000)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Audio */}
        <div className="flex h-10 border-b border-white/10">
          <div className="sticky left-0 z-10 shrink-0 bg-[#0d0d10] border-r border-white/10 px-2 flex items-center text-[10px] font-mono text-cyan-300/60 truncate" style={{ width: HEADER_W }} title={audioName ?? undefined}>
            ♪ {audioName ?? 'No music loaded'}
          </div>
          <div className="relative" style={{ width: contentW }}>
            {wave && (
              <svg className="absolute top-0 left-0 h-full" style={{ width: peaksMs * pps }} viewBox={`0 0 ${wave.n} 100`} preserveAspectRatio="none" aria-hidden>
                <path d={wave.d} fill="#22d3ee" fillOpacity={0.35} />
              </svg>
            )}
          </div>
        </div>

        {/* Tracks */}
        {tracks.map((track) => {
          const selected = track === selectedTrack
          return (
            <div key={track} className={`flex border-b border-white/5 ${track === ALL_DANCERS ? 'bg-purple-500/[0.04]' : ''}`} style={{ height: ROW_H }}>
              <button
                onClick={() => { selectTrack(track); selectClip(null) }}
                className={`sticky left-0 z-10 shrink-0 text-left px-2 text-[11px] font-mono border-r border-white/10 truncate ${selected ? 'bg-purple-500/20 text-purple-200' : 'bg-[#0d0d10] text-white/50 hover:text-white/80'}`}
                style={{ width: HEADER_W }}
              >
                {track === ALL_DANCERS ? '★ ' : ''}{trackLabel(track)}
              </button>
              <div
                className="relative"
                style={{ width: contentW }}
                onPointerDown={() => { selectTrack(track); selectClip(null) }}
                onDoubleClick={(e) => addClip(track, snapMs((e.clientX - e.currentTarget.getBoundingClientRect().left) / pps))}
                title="Double-click to add a clip"
              >
                {project.clips.filter((c) => c.track === track).map((c) => (
                  <div
                    key={c.id}
                    onPointerDown={(e) => onClipDown(e, c)}
                    onPointerMove={onClipMove}
                    onPointerUp={onClipUp}
                    onPointerCancel={onClipUp}
                    onDoubleClick={(e) => e.stopPropagation()}
                    className={`absolute top-1 bottom-1 rounded-md overflow-hidden cursor-grab active:cursor-grabbing ${c.id === selectedClipId ? 'ring-2 ring-white z-10' : 'ring-1 ring-black/60'}`}
                    style={{ left: c.startMs * pps, width: Math.max(4, c.durationMs * pps), background: clipBackground(c) }}
                    title={`${EFFECT_BY_ID[c.effect].label} · ${(c.durationMs / 1000).toFixed(1)} s`}
                  >
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-white whitespace-nowrap [text-shadow:0_0_3px_#000,0_0_2px_#000] pointer-events-none">
                      {EFFECT_BY_ID[c.effect].short} {(c.durationMs / 1000).toFixed(1)}s
                    </span>
                    <div data-handle="l" className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/50" />
                    <div data-handle="r" className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/50" />
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {/* Playhead */}
        <div className="absolute top-0 bottom-0 w-px bg-red-500 z-20 pointer-events-none" style={{ left: HEADER_W + timeMs * pps }}>
          <div className="absolute -top-0 -left-1.5 w-3 h-3 bg-red-500 rotate-45 -translate-y-1/2" />
        </div>
      </div>
    </div>
  )
}
