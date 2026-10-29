'use client'
import { useState } from 'react'
import { useCostumeStore } from '@/store/useCostumeStore'

// Planning figures, not measurements: a WS2812B draws up to ~60 mA at full
// white and roughly a third of that showing one colour.
const MA_FULL_WHITE = 60
const MA_ONE_COLOUR = 20
const POWER_BANK_MAH = 5000
const USABLE_FRACTION = 0.8   // conversion losses and cut-off, assumed
const CURRENT_LIMIT_MA = 1000 // firmware cap proposed in the hardware review

export default function CostumeZones() {
  const { zones, brightness, addZone, updateZone, deleteZone, setBrightness } = useCostumeStore()
  const [newName, setNewName] = useState('')

  const totalLeds = zones.reduce((n, z) => n + z.leds, 0)
  const worstMa = Math.round(totalLeds * MA_FULL_WHITE * (brightness / 100))
  const typicalMa = Math.round(totalLeds * MA_ONE_COLOUR * (brightness / 100))
  const runtimeH = typicalMa > 0 ? (POWER_BANK_MAH * USABLE_FRACTION) / typicalMa : 0
  const overLimit = worstMa > CURRENT_LIMIT_MA

  const handleAdd = () => {
    if (!newName.trim()) return
    addZone(newName.trim(), 15)
    setNewName('')
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
      {/* Zones of one costume */}
      <div className="flex flex-col gap-1.5 mb-3">
        {zones.map((zone, i) => {
          const first = zones.slice(0, i).reduce((n, z) => n + z.leds, 0)
          return (
            <div key={zone.id} className="flex items-center gap-2">
              <input
                value={zone.name}
                onChange={(e) => updateZone(zone.id, { name: e.target.value })}
                className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-white text-xs focus:outline-none focus:border-purple-500/50"
              />
              <input
                type="number"
                min={1}
                max={300}
                value={zone.leds}
                onChange={(e) => updateZone(zone.id, { leds: Math.max(1, Math.min(300, Number(e.target.value) || 1)) })}
                className="w-16 bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-purple-500/50"
                aria-label={`${zone.name} LED count`}
              />
              <span className="w-20 text-white/30 text-[11px] font-mono tabular-nums">
                LED {first}–{first + zone.leds - 1}
              </span>
              <button
                onClick={() => deleteZone(zone.id)}
                className="w-6 h-6 rounded text-red-400/40 hover:text-red-400 hover:bg-red-500/10 transition-all text-xs"
                title="Remove zone"
              >
                ✕
              </button>
            </div>
          )
        })}
      </div>

      <div className="flex gap-2 mb-4">
        <input
          placeholder="New zone (e.g. Zone D — back)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="flex-1 bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-white text-xs focus:outline-none focus:border-purple-500/50"
        />
        <button
          onClick={handleAdd}
          className="text-[10px] px-3 rounded bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 transition-all font-mono"
        >
          + ADD ZONE
        </button>
      </div>

      {/* Brightness */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-white/40 mb-1">
          <span>Brightness cap</span>
          <span className="font-mono">{brightness}%</span>
        </div>
        <input
          type="range"
          min={5}
          max={100}
          step={5}
          value={brightness}
          onChange={(e) => setBrightness(Number(e.target.value))}
          className="w-full h-1 rounded-full appearance-none cursor-pointer accent-purple-500"
          style={{ background: `linear-gradient(to right, #a855f7 ${brightness}%, #ffffff15 ${brightness}%)` }}
        />
      </div>

      {/* Power estimate */}
      <div className="grid grid-cols-4 gap-2">
        <Stat label="LEDs" value={String(totalLeds)} />
        <Stat label="Full white" value={`${worstMa} mA`} warn={overLimit} />
        <Stat label="One colour" value={`${typicalMa} mA`} />
        <Stat label={`${POWER_BANK_MAH} mAh bank`} value={runtimeH ? `~${runtimeH.toFixed(1)} h` : '—'} />
      </div>
      <p className={`text-[10px] font-mono mt-3 ${overLimit ? 'text-red-400/80' : 'text-white/20'}`}>
        {overLimit
          ? `Full white would draw over ${CURRENT_LIMIT_MA} mA: lower the brightness cap or the firmware must limit current.`
          : 'Estimates only (60 mA/LED full white, 20 mA one colour, 80 % of the bank usable). Measure on the bench.'}
      </p>
    </div>
  )
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-lg border px-2 py-2 ${warn ? 'border-red-500/40 bg-red-500/10' : 'border-white/5 bg-black/30'}`}>
      <p className="text-white/30 text-[10px] font-mono truncate">{label}</p>
      <p className={`font-mono text-sm tabular-nums ${warn ? 'text-red-300' : 'text-white'}`}>{value}</p>
    </div>
  )
}
