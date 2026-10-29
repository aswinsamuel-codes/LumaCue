'use client'
import { formatShowTime, makeId } from '@/lib/show/model'
import type { ShowSection } from '@/lib/show/model'
import { useShowStore } from '@/store/useShowStore'
import { useCostumeStore } from '@/store/useCostumeStore'

const input = 'bg-black/40 border border-white/10 rounded-md px-2 py-1 text-white text-xs focus:outline-none focus:border-purple-500/50'
const btn = 'px-2.5 py-1.5 rounded-md border text-[11px] font-mono transition-all disabled:opacity-30'
const btnIdle = `${btn} bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white`

/**
 * Sections: named parts of the show where chosen zones stay dark, e.g.
 * "Hands only" then "Full costume". Clips stay as they are; the section
 * decides which parts of the costume are allowed to light.
 */
export default function SectionsDialog({ timeMs, onClose, onSeek }: { timeMs: number; onClose: () => void; onSeek: (ms: number) => void }) {
  const { project, setProject } = useShowStore()
  const zones = useCostumeStore((s) => s.zones)
  const sections = project.sections ?? []
  const handZones = zones.filter((z) => z.placement === 'hands').map((z) => z.id)
  const bodyZones = zones.filter((z) => z.placement !== 'hands').map((z) => z.id)

  const save = (next: ShowSection[]) => setProject({ sections: [...next].sort((a, b) => a.startMs - b.startMs) })
  const update = (id: string, patch: Partial<ShowSection>) => save(sections.map((s) => (s.id === id ? { ...s, ...patch } : s)))

  const add = (name: string, darkZones: string[]) => {
    const start = Math.max(0, Math.min(Math.round(timeMs), project.lengthMs - 1000))
    // Runs to the next section, or the end of the show.
    const next = sections.find((s) => s.startMs > start)
    save([...sections, { id: makeId(), name, startMs: start, endMs: next ? next.startMs : project.lengthMs, darkZones }])
  }

  const toggleZone = (s: ShowSection, zoneId: string) =>
    update(s.id, { darkZones: s.darkZones.includes(zoneId) ? s.darkZones.filter((z) => z !== zoneId) : [...s.darkZones, zoneId] })

  const secs = (ms: number) => (ms / 1000).toFixed(1)
  const parseSecs = (v: string) => Math.max(0, Math.min(project.lengthMs, Math.round(Number(v) * 1000) || 0))

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-xl border border-white/10 bg-[#0f0f0f] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-white font-semibold">Sections</h4>
          <button className={btnIdle} onClick={onClose}>Close</button>
        </div>
        <p className="text-white/40 text-[11px] mb-4">
          Parts of the show where some zones stay dark whatever the clips say: e.g. a &quot;Hands only&quot; opening, then the full costume.
          Ticked zones light; unticked ones stay dark. New sections start at the playhead ({formatShowTime(timeMs)}).
        </p>

        <div className="flex flex-wrap gap-1.5 mb-4">
          <button className={btnIdle} disabled={!handZones.length} title={handZones.length ? 'Only the hand bands light' : 'Add a zone placed on "Hand bands" in Costume setup first'} onClick={() => add('Hands only', bodyZones)}>
            + Hands only
          </button>
          <button className={btnIdle} disabled={!handZones.length} title="Everything but the hand bands lights" onClick={() => add('Costume only', handZones)}>
            + Costume only
          </button>
          <button className={btnIdle} onClick={() => add('Full costume', [])}>+ Everything</button>
          {!handZones.length && <span className="text-yellow-300/70 text-[10px] font-mono self-center">No zone is placed on &quot;Hand bands&quot; yet (Costume setup).</span>}
        </div>

        {sections.length === 0 ? (
          <p className="text-white/30 text-xs font-mono py-6 text-center">No sections: every zone can light for the whole show.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/30 text-[10px] font-mono text-left">
                  <th className="pb-2 pr-2 font-normal">NAME</th>
                  <th className="pb-2 pr-2 font-normal">FROM (s)</th>
                  <th className="pb-2 pr-2 font-normal">TO (s)</th>
                  {zones.map((z) => <th key={z.id} className="pb-2 px-1 font-normal text-center max-w-20 truncate" title={z.name}>{z.name.replace(/^Zone [A-Z] — /, '')}</th>)}
                  <th />
                </tr>
              </thead>
              <tbody>
                {sections.map((s) => {
                  const overlaps = sections.some((o) => o.id !== s.id && o.startMs < s.endMs && s.startMs < o.endMs)
                  return (
                    <tr key={s.id} className="border-t border-white/5">
                      <td className="py-1.5 pr-2"><input value={s.name} onChange={(e) => update(s.id, { name: e.target.value })} className={`${input} w-36`} aria-label="Section name" /></td>
                      <td className="py-1.5 pr-2"><input type="number" step={0.1} value={secs(s.startMs)} onChange={(e) => update(s.id, { startMs: Math.min(parseSecs(e.target.value), s.endMs - 100) })} className={`${input} w-20 font-mono`} aria-label="Start, seconds" /></td>
                      <td className="py-1.5 pr-2"><input type="number" step={0.1} value={secs(s.endMs)} onChange={(e) => update(s.id, { endMs: Math.max(parseSecs(e.target.value), s.startMs + 100) })} className={`${input} w-20 font-mono`} aria-label="End, seconds" /></td>
                      {zones.map((z) => (
                        <td key={z.id} className="py-1.5 px-1 text-center">
                          <input type="checkbox" checked={!s.darkZones.includes(z.id)} onChange={() => toggleZone(s, z.id)} className="accent-purple-500" aria-label={`${z.name} lights in ${s.name}`} />
                        </td>
                      ))}
                      <td className="py-1.5 pl-2 whitespace-nowrap">
                        <button className="text-white/40 hover:text-white text-[11px] font-mono mr-2" onClick={() => onSeek(s.startMs)} title="Move the playhead here">▶</button>
                        <button className="text-red-400/50 hover:text-red-400 text-[11px]" onClick={() => save(sections.filter((o) => o.id !== s.id))} title="Delete section">✕</button>
                        {overlaps && <span className="ml-2 text-yellow-300/70 text-[10px] font-mono" title="Overlapping sections combine: a zone dark in either stays dark">overlap</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
