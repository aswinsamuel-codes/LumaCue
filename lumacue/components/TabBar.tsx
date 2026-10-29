'use client'

export type ShowTab = 'band' | 'costume' | 'timeline'

const TABS: { id: ShowTab; label: string; hint: string }[] = [
  { id: 'band', label: 'HAND BAND', hint: 'Live zone control' },
  { id: 'costume', label: 'COSTUME', hint: 'Stored show · base station' },
  { id: 'timeline', label: 'SHOW STUDIO', hint: 'Timeline · digital twin' },
]

export default function TabBar({ active, onChange }: { active: ShowTab; onChange: (tab: ShowTab) => void }) {
  return (
    <nav className="flex gap-1 px-3 pt-3 shrink-0 relative" role="tablist">
      {TABS.map((tab) => {
        const selected = tab.id === active
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`flex items-baseline gap-2 px-4 py-2 rounded-lg border text-xs font-mono tracking-widest transition-all ${
              selected
                ? 'bg-purple-500/20 border-purple-500/40 text-purple-200'
                : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/70'
            }`}
          >
            {tab.label}
            <span className={`text-[10px] tracking-normal ${selected ? 'text-purple-300/60' : 'text-white/20'}`}>{tab.hint}</span>
          </button>
        )
      })}
    </nav>
  )
}
