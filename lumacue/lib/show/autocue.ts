/**
 * Turns a song analysis into a starting set of light cues. The result is
 * ordinary clips, so the light engineer can edit, move or delete any of them.
 *
 * Rules of thumb used:
 *  - calm parts breathe (pulse / twinkle), one breath per bar
 *  - building parts move (chase, one lap per bar) with staggered wipes across dancers
 *  - high-energy parts hit harder (fast chase / rainbow, strobes on phrase starts)
 *  - a drop gets one beat of blackout, then a bar of strobe on the beat
 *  - strong hits get a short accent flash; the song ends with a fade to black
 */
import type { AudioAnalysis, EnergyLevel } from '@/lib/show/analyze'
import { ALL_DANCERS, makeId } from '@/lib/show/model'
import type { Clip, EffectId } from '@/lib/show/model'

export type CueStyle = 'calm' | 'balanced' | 'energetic'

export const PALETTES: { id: string; label: string; colors: string[] }[] = [
  { id: 'neon', label: 'Neon', colors: ['#00E5FF', '#FF00CC', '#7C3AED', '#FFFFFF'] },
  { id: 'fire', label: 'Fire', colors: ['#FF3300', '#FF8800', '#FFD000', '#FFFFFF'] },
  { id: 'ice', label: 'Ice', colors: ['#00E5FF', '#2563EB', '#A5F3FC', '#FFFFFF'] },
  { id: 'jungle', label: 'Jungle', colors: ['#00FF66', '#FFD000', '#00E5FF', '#FFFFFF'] },
  { id: 'royal', label: 'Royal', colors: ['#7C3AED', '#FFD000', '#FF0055', '#FFFFFF'] },
  // Only colours the bench's red/green 5 mm LEDs can show (red, green, yellow; yellow accent).
  { id: 'bench', label: 'Bench 5 mm', colors: ['#FF0000', '#00FF00', '#FF2000', '#FFB000'] },
]

export interface AutoCueOptions {
  style: CueStyle
  palette: string
  stagger: boolean   // staggered wipes across dancers
  accents: boolean   // short flashes on the strongest hits
}

/** Inverse of speedHz() in render.ts: the speed (0–100) that gives `hz`. Not rounded, so effects stay on the beat. */
function speedFor(hz: number) {
  return Math.max(0, Math.min(100, (100 / 5) * Math.log2(hz / 0.25)))
}

const LEVELS: EnergyLevel[] = ['low', 'mid', 'high']

export function generateCues(a: AudioAnalysis, dancers: number, lengthMs: number, o: AutoCueOptions): Clip[] {
  const pal = (PALETTES.find((p) => p.id === o.palette) ?? PALETTES[0]).colors
  const accent = pal[pal.length - 1]
  const beat = a.beatMs
  const bar = beat * 4
  const barSec = bar / 1000
  const shift = o.style === 'calm' ? -1 : o.style === 'energetic' ? 1 : 0
  const clips: Clip[] = []

  const add = (track: number, startMs: number, durationMs: number, effect: EffectId, color: string, extra: Partial<Clip> = {}) => {
    const s = Math.max(0, Math.round(startMs))
    const d = Math.min(lengthMs - s, Math.round(durationMs))
    if (d >= 50) clips.push({ id: makeId(), track, startMs: s, durationMs: d, effect, color, color2: '#000000', zones: [], speed: 50, ...extra })
  }

  // Strobe flashes 2·hz times a second → one flash per beat.
  const strobeOnBeat = speedFor(1000 / beat / 2)
  const breathPerBar = speedFor(2 / barSec)
  const lapPerBar = speedFor(2 / barSec)
  const twoLapsPerBar = speedFor(4 / barSec)
  const rainbowPerBar = speedFor(4 / barSec)

  a.sections.forEach((s, i) => {
    const level = LEVELS[Math.max(0, Math.min(2, LEVELS.indexOf(s.level) + shift))]
    const color = pal[i % (pal.length - 1)]
    const next = pal[(i + 1) % (pal.length - 1)]

    // Split the section into 4-bar phrases so looks change with the music.
    const phrases: [number, number][] = []
    for (let p = s.startMs; p < s.endMs - beat; p += bar * 4) phrases.push([p, Math.min(s.endMs, p + bar * 4)])
    if (!phrases.length) phrases.push([s.startMs, s.endMs])

    if (i === 0 && s.startMs < bar) {
      // Fade in from black over the first two bars.
      add(ALL_DANCERS, 0, Math.min(bar * 2, s.endMs), 'fade', '#000000', { color2: color })
    }

    phrases.forEach(([p0, p1], k) => {
      const skipIntro = i === 0 && k === 0 && s.startMs < bar
      const start = skipIntro ? Math.min(bar * 2, p1) : p0

      if (level === 'low') {
        if (k % 2 === 0 || o.style === 'energetic') add(ALL_DANCERS, start, p1 - start, 'pulse', color, { speed: breathPerBar })
        else add(ALL_DANCERS, start, p1 - start, 'twinkle', color, { speed: 45 })
      } else if (level === 'mid') {
        add(ALL_DANCERS, start, p1 - start, 'chase', k % 2 ? next : color, { speed: lapPerBar })
        if (o.stagger && dancers > 1) {
          // A wave across the line: each dancer starts half a beat after the previous one.
          for (let d = 0; d < dancers; d++) add(d, p0 + d * (beat / 2), beat * 2, 'wipe', accent)
        }
      } else {
        let from = start
        if (s.drop && k === 0) {
          add(ALL_DANCERS, s.startMs - beat, beat, 'blackout', '#000000')
          add(ALL_DANCERS, s.startMs, bar, 'strobe', accent, { speed: strobeOnBeat })
          from = s.startMs + bar
        } else if (o.style === 'energetic') {
          add(ALL_DANCERS, p0, bar, 'strobe', accent, { speed: strobeOnBeat })
          from = p0 + bar
        }
        if (k % 2 === 0) add(ALL_DANCERS, from, p1 - from, 'chase', color, { speed: twoLapsPerBar })
        // Rainbow uses every hue, so palettes limited to what the hardware can show get a second chase instead.
        else if (o.palette === 'bench') add(ALL_DANCERS, from, p1 - from, 'chase', next, { speed: twoLapsPerBar })
        else add(ALL_DANCERS, from, p1 - from, 'rainbow', '#FFFFFF', { speed: rainbowPerBar })
      }
    })

    // Accent flashes on the strongest hits (not in calm parts, at most one per bar).
    if (o.accents && level !== 'low') {
      let lastBar = -1
      for (const t of a.accents) {
        if (t < s.startMs || t >= s.endMs) continue
        const b = Math.floor((t - s.startMs) / bar)
        if (b === lastBar || (s.drop && t < s.startMs + bar)) continue
        lastBar = b
        add(ALL_DANCERS, t, 120, 'solid', accent)
      }
    }
  })

  // Fade to black over the last two bars (or 4 s).
  const outro = Math.min(bar * 2, 4000, lengthMs / 4)
  const lastColor = pal[Math.max(0, a.sections.length - 1) % (pal.length - 1)]
  add(ALL_DANCERS, lengthMs - outro, outro, 'fade', lastColor, { color2: '#000000' })

  return clips
}
