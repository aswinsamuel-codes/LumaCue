'use client'
/**
 * The LumaCue mark, animated: the eight LEDs of the "L" light up one after
 * another like a costume chase, then the sweep arc draws in and the cue point
 * flashes. After that the mark breathes gently. Respects prefers-reduced-motion.
 */
const DOTS: [number, number][] = [
  [44, 30], [44, 46], [44, 62], [44, 78], [44, 94], [60, 94], [76, 94], [92, 94],
]

export default function LogoMark({ size = 96, loop = false }: { size?: number; loop?: boolean }) {
  const cycle = loop ? 'infinite' : '1'
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" role="img" aria-label="LumaCue" className="lc-mark">
      <style>{`
        .lc-mark .lc-dot { opacity: .12; animation: lc-dot 2.4s ease-out ${cycle} both; }
        .lc-mark .lc-arc { stroke-dasharray: 101; stroke-dashoffset: 101; animation: lc-arc 2.4s ease-in-out ${cycle} both; }
        .lc-mark .lc-cue { opacity: 0; transform-origin: 89.25px 48.75px; animation: lc-cue 2.4s ease-out ${cycle} both; }
        .lc-mark .lc-all { animation: lc-breathe 3.2s ease-in-out 2.4s infinite; }
        @keyframes lc-dot { 0% { opacity: .12 } 12% { opacity: 1 } 100% { opacity: 1 } }
        @keyframes lc-arc { 0%, 40% { stroke-dashoffset: 101 } 75%, 100% { stroke-dashoffset: 0 } }
        @keyframes lc-cue { 0%, 72% { opacity: 0; transform: scale(.2) } 82% { opacity: 1; transform: scale(1.6) } 100% { opacity: 1; transform: scale(1) } }
        @keyframes lc-breathe { 0%, 100% { filter: brightness(1) } 50% { filter: brightness(1.25) } }
        @media (prefers-reduced-motion: reduce) {
          .lc-mark .lc-dot, .lc-mark .lc-arc, .lc-mark .lc-cue, .lc-mark .lc-all { animation: none; opacity: 1; stroke-dashoffset: 0; }
        }
      `}</style>
      <defs>
        <linearGradient id="lcm-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22D3EE" />
          <stop offset="0.5" stopColor="#A855F7" />
          <stop offset="1" stopColor="#EC4899" />
        </linearGradient>
        <radialGradient id="lcm-tile" cx="0.3" cy="0.25" r="0.9">
          <stop offset="0" stopColor="#1B1530" />
          <stop offset="1" stopColor="#08070C" />
        </radialGradient>
        <filter id="lcm-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width="128" height="128" rx="28" fill="url(#lcm-tile)" />
      <g className="lc-all">
        <path className="lc-arc" d="M44 30 A64 64 0 0 1 108 94" fill="none" stroke="url(#lcm-grad)"
          strokeWidth="4" strokeLinecap="round" filter="url(#lcm-glow)" />
        <g fill="url(#lcm-grad)" filter="url(#lcm-glow)">
          {DOTS.map(([cx, cy], i) => (
            <circle key={i} className="lc-dot" cx={cx} cy={cy} r="6" style={{ animationDelay: `${i * 0.11}s` }} />
          ))}
        </g>
        <circle className="lc-cue" cx="89.25" cy="48.75" r="5" fill="#FFFFFF" filter="url(#lcm-glow)" />
      </g>
    </svg>
  )
}
