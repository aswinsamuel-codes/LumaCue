'use client'
import { COSTUME_ZONE_LABELS, DEMO_SHOW, activeCueIndexes, formatShowTime, zoneColorsAt } from '@/lib/costume-show'

export default function ShowPreview({ showMs }: { showMs: number }) {
  const colors = zoneColorsAt(DEMO_SHOW, showMs)
  const active = new Set(activeCueIndexes(DEMO_SHOW, showMs))
  const pct = (ms: number) => `${(ms / DEMO_SHOW.lengthMs) * 100}%`

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
      {/* Zone lamps: what one costume should be showing right now */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {COSTUME_ZONE_LABELS.map((label, i) => {
          const c = colors[i]
          return (
            <div key={label} className="flex flex-col items-center gap-2 rounded-lg bg-black/30 border border-white/5 py-4">
              <div
                className="w-10 h-10 rounded-full border border-white/10 transition-[background,box-shadow] duration-75"
                style={{ background: c ?? '#1a1a1a', boxShadow: c ? `0 0 24px ${c}` : 'none' }}
              />
              <span className="text-white/50 text-[11px] font-mono">{label}</span>
            </div>
          )
        })}
      </div>

      {/* Cue timeline, one row per zone */}
      <div className="relative mb-3">
        {COSTUME_ZONE_LABELS.map((label, zone) => (
          <div key={label} className="relative h-3 mb-1 rounded-sm bg-white/5">
            {DEMO_SHOW.cues.map((cue, i) =>
              cue.zones.includes(zone) && cue.effect !== 'off' ? (
                <div
                  key={i}
                  title={cue.label}
                  className={`absolute top-0 bottom-0 rounded-sm ${cue.effect === 'solid' ? '' : 'opacity-60'}`}
                  style={{ left: pct(cue.startMs), width: pct(cue.durationMs), background: cue.color }}
                />
              ) : null,
            )}
          </div>
        ))}
        <div className="absolute -top-1 -bottom-1 w-px bg-white" style={{ left: pct(showMs) }} />
      </div>

      {/* Cue list */}
      <div className="grid grid-cols-1 gap-0.5">
        {DEMO_SHOW.cues.map((cue, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-2 py-1 rounded text-[11px] font-mono ${active.has(i) ? 'bg-white/10 text-white' : 'text-white/35'}`}
          >
            <span className="w-14 tabular-nums">{formatShowTime(cue.startMs)}</span>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cue.effect === 'off' ? '#333' : cue.color }} />
            <span className="flex-1 truncate">{cue.label}</span>
            <span className="text-white/25">{cue.zones.map((z) => 'ABC'[z]).join('')}</span>
            <span className="w-12 text-right uppercase text-white/25">{cue.effect}</span>
          </div>
        ))}
      </div>
      <p className="text-white/20 text-[10px] font-mono mt-3">
        Mirrors show {DEMO_SHOW.id} compiled into the bench test costume. Editing shows comes with the timeline editor.
      </p>
    </div>
  )
}
