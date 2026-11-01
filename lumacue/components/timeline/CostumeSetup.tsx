'use client'
import { useState } from 'react'
import { useCostumeStore } from '@/store/useCostumeStore'
import { PLACEMENTS, PLACEMENT_LABELS } from '@/lib/show/body'
import type { Placement } from '@/lib/show/body'
import PathEditor from '@/components/timeline/PathEditor'
import { COSTUME_TEMPLATES } from '@/lib/show/templates'
import { CURRENT_LIMIT_MA, MA_FULL_WHITE, MA_ONE_COLOUR } from '@/lib/show/checklist'

const POWER_BANK_MAH = 5000
const USABLE_FRACTION = 0.8   // conversion losses and cut-off, assumed

export default function CostumeSetup() {
  const { zones, brightness, addZone, updateZone, deleteZone, setBrightness, setZones } = useCostumeStore()
  const [newName, setNewName] = useState('')
  const [drawing, setDrawing] = useState<string | null>(null) // zone id whose LED lines are being drawn
  const drawingZone = zones.find((z) => z.id === drawing) ?? null

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
      {/* Ready-made costumes: zone ids stay a, b, c… so sections keep pointing at the same parts */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className="text-white/30 text-[10px] font-mono mr-1">TEMPLATE</span>
        {COSTUME_TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => setZones(t.zones.map((z) => ({ ...z })), t.label)}
            title={`${t.hint} · ${t.zones.map((z) => `${z.name} ${z.leds}`).join(', ')}`}
            className="text-[10px] px-2 py-1 rounded bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white transition-all font-mono"
          >
            {t.label}
          </button>
        ))}
      </div>
      {zones.length > 3 && (
        <p className="text-yellow-300/70 text-[10px] font-mono mb-2">The bench firmware drives the first 3 zones only; the others show in the preview but stay dark on the Nano.</p>
      )}

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
              <select
                value={zone.placement}
                onChange={(e) => {
                  const placement = e.target.value as Placement
                  updateZone(zone.id, { placement })
                  if (placement === 'custom') setDrawing(zone.id)
                }}
                className="w-28 bg-black/40 border border-white/10 rounded-md px-1 py-1.5 text-white text-xs focus:outline-none focus:border-purple-500/50"
                aria-label={`${zone.name} position on the body`}
              >
                {PLACEMENTS.map((pl) => <option key={pl.id} value={pl.id}>{pl.label}</option>)}
                <option value="custom">{PLACEMENT_LABELS.custom}</option>
              </select>
              <button
                onClick={() => {
                  if (zone.placement !== 'custom') updateZone(zone.id, { placement: 'custom', paths: zone.paths ?? [] })
                  setDrawing(zone.id)
                }}
                className={`w-7 h-7 rounded-md border text-xs transition-all ${zone.placement === 'custom' ? 'border-purple-500/50 bg-purple-500/20 text-purple-200' : 'border-white/10 bg-white/5 text-white/50 hover:text-white'}`}
                title="Draw where this strip runs on the costume (front and back)"
                aria-label={`Draw ${zone.name} on the costume`}
              >
                ✎
              </button>
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
      {drawingZone && (
        <PathEditor
          zone={drawingZone}
          allZones={zones}
          onChange={(paths) => updateZone(drawingZone.id, { placement: 'custom', paths })}
          onLeds={(leds) => updateZone(drawingZone.id, { leds })}
          onClose={() => setDrawing(null)}
        />
      )}
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
