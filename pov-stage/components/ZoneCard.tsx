'use client'
import { useDashboardStore, Zone, ZoneMode } from '@/store/useDashboardStore'

const MODES: ZoneMode[] = ['Static', 'Pulse', 'Flash']

export default function ZoneCard({ zone, onDelete }: { zone: Zone; onDelete?: () => void }) {
  const { toggleZone, setZoneMode, setZoneSpeed, setZoneColor, activeColor } = useDashboardStore()

  return (
    <div className="relative rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 overflow-hidden transition-all duration-200"
    >
      {/* color glow strip */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 opacity-80"
        style={{ background: zone.enabled ? zone.color : '#333' }}
      />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full transition-all duration-300"
            style={{
              background: zone.enabled ? zone.color : '#333',
              boxShadow: zone.enabled ? `0 0 10px ${zone.color}` : 'none',
            }}
          />
          <span className="text-white font-semibold text-sm">{zone.name}</span>
        </div>

        <div className="flex items-center gap-1">
          {/* Toggle */}
          <button
            onClick={() => toggleZone(zone.id)}
            className={`relative w-10 h-5 rounded-full transition-all duration-300 ${zone.enabled ? 'bg-blue-500' : 'bg-white/10'}`}
          >
            <div
              className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300"
              style={{ transform: zone.enabled ? 'translateX(20px)' : 'translateX(2px)' }}
            />
          </button>

          {/* Delete button */}
          {onDelete && (
            <button
              onClick={onDelete}
              className="w-5 h-5 rounded text-red-400/40 hover:text-red-400 hover:bg-red-500/10 transition-all text-xs flex items-center justify-center"
              title="Delete zone"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Mode selector */}
      <div className="flex gap-1 mb-3">
        {MODES.map((m) => (
          <button
            key={m}
            onClick={() => setZoneMode(zone.id, m)}
            className={`flex-1 text-xs py-1 rounded-md font-mono transition-all duration-150 ${
              zone.mode === m
                ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Speed slider */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-white/40 mb-1">
          <span>Speed</span>
          <span className="font-mono">{zone.speed}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={zone.speed}
          onChange={(e) => setZoneSpeed(zone.id, Number(e.target.value))}
          className="w-full h-1 rounded-full appearance-none cursor-pointer accent-purple-500"
          style={{ background: `linear-gradient(to right, #a855f7 ${zone.speed}%, #ffffff15 ${zone.speed}%)` }}
        />
      </div>

      {/* Apply active color */}
      <button
        onClick={() => setZoneColor(zone.id, activeColor)}
        className="w-full text-xs py-1.5 rounded-md bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2"
      >
        <span
          className="w-3 h-3 rounded-full inline-block"
          style={{ background: activeColor, boxShadow: `0 0 6px ${activeColor}` }}
        />
        Apply Active Color
      </button>
    </div>
  )
}
