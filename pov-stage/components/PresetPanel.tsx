'use client'
import { useState } from 'react'
import { useDashboardStore, Preset, PresetColor } from '@/store/useDashboardStore'

function makeId() { return Math.random().toString(36).slice(2, 9) }

const EMPTY_PRESET: Omit<Preset, 'id'> = { name: '', colors: [{ color: '#3B82F6', duration: 1000 }], loop: false }

export default function PresetPanel() {
  const { presets, addPreset, updatePreset, deletePreset, addLog } = useDashboardStore()
  const [editing, setEditing] = useState<Preset | null>(null)
  const [isNew, setIsNew] = useState(false)

  const openNew = () => {
    setEditing({ id: makeId(), ...EMPTY_PRESET })
    setIsNew(true)
  }

  const openEdit = (p: Preset) => {
    setEditing({ ...p, colors: p.colors.map((c) => ({ ...c })) })
    setIsNew(false)
  }

  const save = () => {
    if (!editing || !editing.name.trim()) return
    if (isNew) addPreset(editing)
    else updatePreset(editing)
    setEditing(null)
  }

  const addColor = () => {
    if (!editing) return
    setEditing({ ...editing, colors: [...editing.colors, { color: '#A855F7', duration: 1000 }] })
  }

  const removeColor = (i: number) => {
    if (!editing) return
    setEditing({ ...editing, colors: editing.colors.filter((_, idx) => idx !== i) })
  }

  const updateColor = (i: number, patch: Partial<PresetColor>) => {
    if (!editing) return
    setEditing({ ...editing, colors: editing.colors.map((c, idx) => idx === i ? { ...c, ...patch } : c) })
  }

  const runPreset = (p: Preset) => {
    addLog('ACTION', `Preset "${p.name}" started`)
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-sm tracking-wide">Presets & Timers</h3>
        <button
          onClick={openNew}
          className="text-xs px-3 py-1 rounded-md bg-blue-500/20 border border-blue-500/40 text-blue-400 hover:bg-blue-500/30 transition-all"
        >
          + Add Preset
        </button>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
        {presets.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-2 p-3 rounded-lg bg-black/30 border border-white/5 group transition-all duration-200"
          >
              {/* color sequence preview */}
              <div className="flex gap-1 flex-1">
                <div className="flex gap-0.5 items-center">
                  {p.colors.map((c, i) => (
                    <div key={i} className="w-4 h-4 rounded-sm" style={{ background: c.color, boxShadow: `0 0 4px ${c.color}80` }} />
                  ))}
                  {p.loop && <span className="text-white/30 text-xs ml-1">↻</span>}
                </div>
                <div className="ml-2">
                  <p className="text-white text-xs font-medium">{p.name}</p>
                  <p className="text-white/30 text-[10px] font-mono">{p.colors.length} steps · {p.colors.reduce((a, c) => a + c.duration, 0)}ms</p>
                </div>
              </div>

              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => runPreset(p)} className="text-[10px] px-2 py-1 rounded bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30">▶</button>
                <button onClick={() => openEdit(p)} className="text-[10px] px-2 py-1 rounded bg-white/5 text-white/50 border border-white/10 hover:bg-white/10">Edit</button>
                <button onClick={() => deletePreset(p.id)} className="text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20">✕</button>
              </div>
            </div>
          ))}
      </div>

      {/* Editor modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0f0f0f] p-5 animate-scale-in">
              <h4 className="text-white font-semibold mb-4">{isNew ? 'New Preset' : 'Edit Preset'}</h4>

              <input
                type="text"
                placeholder="Preset name..."
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-white text-sm mb-4 focus:outline-none focus:border-purple-500/50"
              />

              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto pr-1">
                {editing.colors.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-white/30 text-xs font-mono w-4">{i + 1}</span>
                    <input
                      type="color"
                      value={c.color}
                      onChange={(e) => updateColor(i, { color: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                    />
                    <input
                      type="number"
                      value={c.duration}
                      min={100}
                      max={10000}
                      step={100}
                      onChange={(e) => updateColor(i, { duration: Number(e.target.value) })}
                      className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-white text-xs font-mono focus:outline-none"
                    />
                    <span className="text-white/30 text-xs">ms</span>
                    {editing.colors.length > 1 && (
                      <button onClick={() => removeColor(i)} className="text-red-400/60 hover:text-red-400 text-xs">✕</button>
                    )}
                  </div>
                ))}
              </div>

              <button onClick={addColor} className="w-full text-xs py-1.5 rounded-md border border-dashed border-white/10 text-white/30 hover:text-white/60 hover:border-white/20 mb-4 transition-all">
                + Add Color Step
              </button>

              <label className="flex items-center gap-2 text-white/50 text-xs mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.loop}
                  onChange={(e) => setEditing({ ...editing, loop: e.target.checked })}
                  className="accent-purple-500"
                />
                Loop sequence
              </label>

              <div className="flex gap-2">
                <button onClick={() => setEditing(null)} className="flex-1 py-2 rounded-md border border-white/10 text-white/40 text-sm hover:bg-white/5 transition-all">Cancel</button>
                <button onClick={save} className="flex-1 py-2 rounded-md bg-purple-500/30 border border-purple-500/50 text-purple-300 text-sm hover:bg-purple-500/40 transition-all">Save</button>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}
