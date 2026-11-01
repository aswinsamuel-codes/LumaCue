'use client'
import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MAX_PATHS, MAX_PATH_POINTS, PLACEMENTS, sampleZone, zonePaths } from '@/lib/show/body'
import type { Pt, Side, StripPath } from '@/lib/show/body'
import type { CostumeZone } from '@/store/useCostumeStore'

const W = 100, H = 200

/** The figure outline (same shape as the twin's silhouette), in the 100 × 200 box. */
function Figure() {
  const limb = 'stroke-[#22222c] fill-none'
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      <circle cx={50} cy={21} r={13} className="fill-[#16161d] stroke-[#2a2a36]" strokeWidth={1} />
      <polygon points="33,41 67,41 63,110 37,110" className="fill-[#16161d] stroke-[#2a2a36]" strokeWidth={1} />
      <polyline points="35,46 22,78 13,110" className={limb} strokeWidth={9} />
      <polyline points="65,46 78,78 87,110" className={limb} strokeWidth={9} />
      <polyline points="44,108 41,152 39,192" className={limb} strokeWidth={11} />
      <polyline points="56,108 59,152 61,192" className={limb} strokeWidth={11} />
    </g>
  )
}

/**
 * Draw where a zone's LED strip runs on the costume: click to place points
 * along the strip, front and back. LumaCue spaces the zone's LEDs evenly along
 * the lines, in drawing order (= wiring order: start where the data wire enters).
 */
export default function PathEditor({ zone, allZones, onChange, onLeds, onClose }: {
  zone: CostumeZone
  allZones: CostumeZone[]
  onChange: (paths: StripPath[]) => void
  onLeds: (leds: number) => void
  onClose: () => void
}) {
  const [side, setSide] = useState<Side>('front')
  const [newLine, setNewLine] = useState(false)
  const svg = useRef<SVGSVGElement>(null)
  const paths = useMemo(() => (zone.placement === 'custom' ? zone.paths ?? [] : []), [zone])
  const shown = (x: number) => (side === 'back' ? W - x : x) // the back view is seen from behind: mirror x

  const leds = useMemo(() => (paths.length ? sampleZone({ ...zone, placement: 'custom', paths }) : []), [zone, paths])
  const others = useMemo(
    () => allZones.filter((z) => z.id !== zone.id).flatMap((z) => sampleZone(z)),
    [allZones, zone.id],
  )
  const onSide = (p: Pt) => (side === 'back' ? !!p.back : !p.back)

  const addPoint = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = svg.current!.getBoundingClientRect()
    const x = Math.max(0, Math.min(W, ((e.clientX - r.left) / r.width) * W))
    const y = Math.max(0, Math.min(H, ((e.clientY - r.top) / r.height) * H))
    const pt = { x: Math.round(shown(x) * 10) / 10, y: Math.round(y * 10) / 10 }
    const last = paths[paths.length - 1]
    if (!last || newLine || last.side !== side) {
      if (paths.length >= MAX_PATHS) return
      onChange([...paths, { side, points: [pt] }])
      setNewLine(false)
    } else {
      if (last.points.length >= MAX_PATH_POINTS) return
      onChange([...paths.slice(0, -1), { ...last, points: [...last.points, pt] }])
    }
  }

  const undo = () => {
    const last = paths[paths.length - 1]
    if (!last) return
    onChange(last.points.length > 1 ? [...paths.slice(0, -1), { ...last, points: last.points.slice(0, -1) }] : paths.slice(0, -1))
  }

  const btn = 'px-2.5 py-1.5 rounded-md border text-[11px] font-mono transition-all disabled:opacity-30'
  const idle = `${btn} bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white`
  const on = `${btn} bg-purple-500/25 border-purple-500/50 text-purple-100`
  const frontCount = leds.filter((p) => !p.back).length

  // Portal to <body>: the Costume setup panel's backdrop blur would otherwise trap this fixed dialog.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 overflow-auto" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl border border-white/10 bg-[#0f0f0f] p-4 flex gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0">
          <div className="flex gap-1 mb-2">
            <button className={side === 'front' ? on : idle} onClick={() => setSide('front')}>Front</button>
            <button className={side === 'back' ? on : idle} onClick={() => setSide('back')}>Back</button>
          </div>
          <svg
            ref={svg}
            viewBox={`0 0 ${W} ${H}`}
            className="w-[230px] h-[460px] rounded-lg bg-black/50 border border-white/10 cursor-crosshair"
            onClick={addPoint}
            role="img"
            aria-label={`${side} of the costume: click to draw the LED line`}
          >
            <Figure />
            {/* Other zones, for reference */}
            {others.filter(onSide).map((p, i) => <circle key={`o${i}`} cx={shown(p.x)} cy={p.y} r={0.9} className="fill-white/15" />)}
            {/* This zone's lines */}
            {paths.map((path, k) => path.side === side && (
              <g key={k}>
                <polyline points={path.points.map((p) => `${shown(p.x)},${p.y}`).join(' ')} className="fill-none stroke-purple-400/60" strokeWidth={0.8} />
                {path.points.map((p, i) => (
                  <circle key={i} cx={shown(p.x)} cy={p.y} r={k === 0 && i === 0 ? 2.2 : 1.3} className={k === 0 && i === 0 ? 'fill-green-400' : 'fill-purple-300'} />
                ))}
              </g>
            ))}
            {/* Where the LEDs land */}
            {leds.filter(onSide).map((p, i) => <circle key={`l${i}`} cx={shown(p.x)} cy={p.y} r={1.1} className="fill-cyan-300" />)}
          </svg>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div>
            <p className="text-white font-semibold text-sm">Draw the LEDs: {zone.name}</p>
            <p className="text-white/40 text-xs mt-1">
              Click along the costume where this strip runs. Start where the data wire comes in (green dot). Use <b>New line</b> for a second strip piece (e.g. the other arm), and switch to <b>Back</b> for the back of the dress.
            </p>
          </div>

          <label className="flex items-center gap-2 text-xs text-white/60">
            LEDs on this strip
            <input
              type="number" min={1} max={300} value={zone.leds}
              onChange={(e) => onLeds(Math.max(1, Math.min(300, Number(e.target.value) || 1)))}
              className="w-20 bg-black/40 border border-white/10 rounded-md px-2 py-1 text-white text-xs font-mono"
            />
          </label>

          <div className="flex flex-wrap gap-1.5">
            <button className={newLine ? on : idle} onClick={() => setNewLine(true)} disabled={!paths.length || paths.length >= MAX_PATHS}>+ New line</button>
            <button className={idle} onClick={undo} disabled={!paths.length}>↶ Undo point</button>
            <button className={idle} onClick={() => onChange([])} disabled={!paths.length}>Clear</button>
          </div>

          <label className="flex items-center gap-2 text-xs text-white/50">
            Start from
            <select
              value=""
              onChange={(e) => {
                const preset = PLACEMENTS.find((p) => p.id === e.target.value)
                if (preset) onChange(zonePaths({ leds: zone.leds, placement: preset.id }).map((p) => ({ side: 'front' as const, points: p.points.map((q) => ({ x: q.x, y: q.y })) })))
              }}
              className="bg-black/40 border border-white/10 rounded-md px-1 py-1 text-white text-xs"
            >
              <option value="">a ready-made shape…</option>
              {PLACEMENTS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>

          <div className="rounded-lg border border-white/5 bg-black/30 p-2 text-[11px] font-mono text-white/50 leading-relaxed">
            {paths.length
              ? <>{paths.length} line{paths.length > 1 ? 's' : ''} · {paths.reduce((n, p) => n + p.points.length, 0)} points · {zone.leds} LEDs: {frontCount} front, {zone.leds - frontCount} back</>
              : 'Nothing drawn yet: the twin uses a belt line until you draw.'}
          </div>

          <p className="text-white/25 text-[10px] font-mono mt-auto">
            LEDs are spread evenly along the lines in the order drawn, which is the order on the strip. The firmware download writes these positions in, so Rise / Sweep / Ripple follow your pattern.
          </p>
          <button className={`${btn} bg-green-500/20 border-green-500/40 text-green-200 hover:bg-green-500/30 self-end`} onClick={onClose}>Done</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
