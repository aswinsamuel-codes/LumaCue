/**
 * Digital twin of one costume: where each LED sits on the body.
 * Coordinates are in a 100 × 200 front-view figure box (as the audience sees
 * the dancer). LED order follows the paths, which is also the wiring order on
 * the strip. A zone is either a ready-made placement (arms, chest…) or lines
 * the user drew on the front and back of the body ('custom').
 */

export type Placement = 'arms' | 'chest' | 'legs' | 'head' | 'belt' | 'hands' | 'custom'

/** A point on the figure. `back` = on the back of the body (x still as seen from the front). */
export interface Pt { x: number; y: number; back?: boolean }

export type Side = 'front' | 'back'

/** One drawn LED line, in strip order. Points use front-view coordinates on both sides. */
export interface StripPath {
  side: Side
  points: Pt[]
}

/** What a zone needs for its LED positions. */
export interface ZoneShape {
  leds: number
  placement: Placement
  paths?: StripPath[]
}

export const MAX_PATH_POINTS = 64
export const MAX_PATHS = 8

const p = (x: number, y: number): Pt => ({ x, y })

function circle(cx: number, cy: number, r: number, segments = 18): Pt[] {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const a = -Math.PI / 2 + (i / segments) * Math.PI * 2
    return p(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
  })
}

/** Ready-made placements ('custom' is drawn by the user instead). */
export const PLACEMENTS: { id: Exclude<Placement, 'custom'>; label: string; paths: Pt[][] }[] = [
  { id: 'arms', label: 'Arms', paths: [[p(34, 45), p(22, 78), p(14, 106)], [p(66, 45), p(78, 78), p(86, 106)]] },
  { id: 'chest', label: 'Chest (V)', paths: [[p(37, 46), p(50, 82), p(63, 46)]] },
  { id: 'legs', label: 'Legs', paths: [[p(44, 112), p(41, 152), p(39, 190)], [p(56, 112), p(59, 152), p(61, 190)]] },
  { id: 'head', label: 'Head / hood', paths: [circle(50, 21, 12)] },
  { id: 'belt', label: 'Belt', paths: [[p(36, 104), p(64, 104)]] },
  { id: 'hands', label: 'Hand bands', paths: [circle(13, 113, 5, 12), circle(87, 113, 5, 12)] },
]

const PLACEMENT_BY_ID = Object.fromEntries(PLACEMENTS.map((pl) => [pl.id, pl])) as Record<Exclude<Placement, 'custom'>, (typeof PLACEMENTS)[number]>

export const PLACEMENT_LABELS: Record<Placement, string> = {
  ...(Object.fromEntries(PLACEMENTS.map((pl) => [pl.id, pl.label])) as Record<Exclude<Placement, 'custom'>, string>),
  custom: 'Drawn (custom)',
}

/** The lines a zone's LEDs follow: the drawn ones, or the preset's. */
export function zonePaths(zone: ZoneShape): { side: Side; points: Pt[] }[] {
  const drawn = zone.placement === 'custom' ? (zone.paths ?? []).filter((path) => path.points.length > 0) : []
  if (drawn.length) return drawn
  const preset = zone.placement === 'custom' ? PLACEMENT_BY_ID.belt : PLACEMENT_BY_ID[zone.placement] ?? PLACEMENT_BY_ID.belt
  return preset.paths.map((points) => ({ side: 'front' as const, points }))
}

export interface ZoneLayout {
  id: string
  start: number      // first LED index on this costume
  count: number
  points: Pt[]       // one per LED
}

export interface CostumeLayout {
  zones: ZoneLayout[]
  total: number
}

function length(path: Pt[]) {
  let L = 0
  for (let i = 1; i < path.length; i++) L += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)
  return L
}

function pointAt(path: Pt[], d: number): Pt {
  for (let i = 1; i < path.length; i++) {
    const seg = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)
    if (d <= seg || i === path.length - 1) {
      const t = seg ? Math.min(1, d / seg) : 0
      return p(path[i - 1].x + (path[i].x - path[i - 1].x) * t, path[i - 1].y + (path[i].y - path[i - 1].y) * t)
    }
    d -= seg
  }
  return path[path.length - 1]
}

/** Spreads `count` LEDs evenly along a zone's lines (drawn or preset). */
export function sampleZone(zone: ZoneShape, count = zone.leds): Pt[] {
  const paths = zonePaths(zone)
  // A single clicked point counts as a very short line, so its LEDs sit on that spot.
  const lengths = paths.map((path) => Math.max(0.001, length(path.points)))
  const total = lengths.reduce((a, b) => a + b, 0)
  // Share LEDs between lines by length, so both arms get the same number.
  const counts = lengths.map((L) => Math.floor((count * L) / total))
  for (let i = 0; counts.reduce((a, b) => a + b, 0) < count; i = (i + 1) % counts.length) counts[i]++
  return paths.flatMap((path, k) => Array.from({ length: counts[k] }, (_, j) => {
    const q = pointAt(path.points, ((j + 0.5) / counts[k]) * length(path.points))
    return path.side === 'back' ? { x: q.x, y: q.y, back: true } : { x: q.x, y: q.y }
  }))
}

export function buildLayout(zones: ({ id: string } & ZoneShape)[]): CostumeLayout {
  let start = 0
  const out = zones.map((z) => {
    const zl: ZoneLayout = { id: z.id, start, count: z.leds, points: sampleZone(z) }
    start += z.leds
    return zl
  })
  return { zones: out, total: start }
}

/** Draws the body outline the LEDs sit on. ctx is already scaled to the 100 × 200 box. */
export function drawSilhouette(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#16161d'
  ctx.strokeStyle = '#24242e'
  ctx.lineWidth = 1
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.beginPath()
  ctx.arc(50, 21, 13, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(33, 41); ctx.lineTo(67, 41); ctx.lineTo(63, 110); ctx.lineTo(37, 110); ctx.closePath()
  ctx.fill()
  ctx.stroke()

  const limb = (pts: Pt[], w: number) => {
    ctx.lineWidth = w
    ctx.strokeStyle = '#16161d'
    ctx.beginPath()
    pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)))
    ctx.stroke()
  }
  limb([p(35, 46), p(22, 78), p(13, 110)], 9)
  limb([p(65, 46), p(78, 78), p(87, 110)], 9)
  limb([p(44, 108), p(41, 152), p(39, 192)], 11)
  limb([p(56, 108), p(59, 152), p(61, 192)], 11)
}
