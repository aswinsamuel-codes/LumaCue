'use client'
import { useEffect, useRef, useState } from 'react'
import { drawSilhouette } from '@/lib/show/body'
import type { CostumeLayout } from '@/lib/show/body'
import { frameMilliamps, renderDancer } from '@/lib/show/render'
import type { ShowProject } from '@/lib/show/model'

const CURRENT_LIMIT_MA = 1000

interface Props {
  project: ShowProject
  layout: CostumeLayout
  timeMs: number
  view: 'all' | 'single'
  focusDancer: number
  brightness: number
  xray: boolean
  onPickDancer: (dancer: number) => void
}

function grid(n: number, view: 'all' | 'single') {
  if (view === 'single') return { cols: 1, rows: 1 }
  const cols = n <= 6 ? n : Math.ceil(n / 2)
  return { cols, rows: Math.ceil(n / cols) }
}

export default function StageCanvas({ project, layout, timeMs, view, focusDancer, brightness, xray, onPickDancer }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const frame = useRef(new Float32Array(0))
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = canvas.current?.parentElement
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const c = canvas.current
    if (!c || !size.w || !size.h) return
    const dpr = window.devicePixelRatio || 1
    if (c.width !== Math.round(size.w * dpr)) c.width = Math.round(size.w * dpr)
    if (c.height !== Math.round(size.h * dpr)) c.height = Math.round(size.h * dpr)
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Stage floor
    const bg = ctx.createRadialGradient(size.w / 2, size.h * 0.95, 10, size.w / 2, size.h * 0.95, size.w * 0.7)
    bg.addColorStop(0, '#15121f')
    bg.addColorStop(1, '#070709')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, size.w, size.h)

    if (frame.current.length !== layout.total * 3) frame.current = new Float32Array(layout.total * 3)
    const f = frame.current
    const dancers = view === 'single' ? [Math.min(focusDancer, project.dancers - 1)] : Array.from({ length: project.dancers }, (_, i) => i)
    const { cols, rows } = grid(dancers.length, view)
    const cellW = size.w / cols
    const cellH = size.h / rows
    const s = Math.min(cellW / 115, (cellH - 22) / 205)
    let peak = 0

    dancers.forEach((d, k) => {
      renderDancer(project, layout, d, timeMs, f)
      const mA = frameMilliamps(f, brightness)
      peak = Math.max(peak, mA)

      const cx = (k % cols) * cellW + cellW / 2
      const top = Math.floor(k / cols) * cellH + 6

      ctx.save()
      ctx.translate(cx - 50 * s, top)
      ctx.scale(s, s)
      if (!xray) drawSilhouette(ctx)

      // Dark LEDs first, then lit ones added on top so overlaps glow.
      ctx.globalCompositeOperation = 'source-over'
      for (const z of layout.zones) {
        for (let i = 0; i < z.count; i++) {
          const o = (z.start + i) * 3
          if (f[o] + f[o + 1] + f[o + 2] > 12) continue
          ctx.fillStyle = xray ? '#3a3a48' : '#2a2a34'
          ctx.beginPath()
          ctx.arc(z.points[i].x, z.points[i].y, 0.9, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.globalCompositeOperation = 'lighter'
      for (const z of layout.zones) {
        for (let i = 0; i < z.count; i++) {
          const o = (z.start + i) * 3
          const r = f[o], g = f[o + 1], b = f[o + 2]
          if (r + g + b <= 12) continue
          const { x, y } = z.points[i]
          ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},0.16)`
          ctx.beginPath()
          ctx.arc(x, y, 3.6, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = `rgb(${Math.min(255, r + 40) | 0},${Math.min(255, g + 40) | 0},${Math.min(255, b + 40) | 0})`
          ctx.beginPath()
          ctx.arc(x, y, 1.2, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.restore()

      ctx.globalCompositeOperation = 'source-over'
      ctx.font = '10px ui-monospace, monospace'
      ctx.textAlign = 'center'
      ctx.fillStyle = d === focusDancer && view === 'all' ? '#d8b4fe' : 'rgba(255,255,255,0.45)'
      ctx.fillText(`Dancer ${d + 1}`, cx, top + 205 * s + 10)
      ctx.fillStyle = mA > CURRENT_LIMIT_MA ? '#f87171' : 'rgba(255,255,255,0.25)'
      ctx.fillText(`${Math.round(mA)} mA`, cx, top + 205 * s + 21)
    })

    ctx.textAlign = 'left'
    ctx.font = '10px ui-monospace, monospace'
    ctx.fillStyle = peak > CURRENT_LIMIT_MA ? '#f87171' : 'rgba(255,255,255,0.35)'
    ctx.fillText(`${layout.total} LEDs/costume · peak draw now ≈ ${Math.round(peak)} mA at ${brightness}% cap`, 10, 16)
  }, [project, layout, timeMs, view, focusDancer, brightness, xray, size])

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (view === 'single') return
    const rect = e.currentTarget.getBoundingClientRect()
    const { cols, rows } = grid(project.dancers, view)
    const col = Math.floor(((e.clientX - rect.left) / rect.width) * cols)
    const row = Math.floor(((e.clientY - rect.top) / rect.height) * rows)
    const d = row * cols + col
    if (d >= 0 && d < project.dancers) onPickDancer(d)
  }

  return (
    <canvas
      ref={canvas}
      onClick={handleClick}
      className="absolute inset-0 w-full h-full cursor-pointer"
      style={{ width: size.w, height: size.h }}
      aria-label="Digital twin of the costumes, showing simulated LEDs"
    />
  )
}
