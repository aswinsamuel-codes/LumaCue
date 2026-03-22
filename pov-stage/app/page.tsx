'use client'
import TopBar from '@/components/TopBar'
import ZoneCard from '@/components/ZoneCard'
import ColorPanel from '@/components/ColorPanel'
import PresetPanel from '@/components/PresetPanel'
import GlobalControlBar from '@/components/GlobalControlBar'
import LogPanel from '@/components/LogPanel'
import { useDashboardStore } from '@/store/useDashboardStore'

export default function Home() {
  const { zones } = useDashboardStore()

  return (
    <div className="flex flex-col h-screen bg-[#0A0A0A] overflow-hidden">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-pink-500/3 rounded-full blur-3xl" />
      </div>

      <TopBar />

      <main className="flex flex-1 gap-3 p-3 overflow-hidden relative">
        {/* LEFT PANEL */}
        <div className="flex flex-col gap-3 w-[420px] shrink-0 overflow-y-auto pr-1">
          {/* Zone Cards */}
          <div>
            <p className="text-white/20 text-[10px] font-mono tracking-widest mb-2 px-1">ZONE CONTROL</p>
            <div className="grid grid-cols-3 gap-2">
              {zones.map((zone) => (
                <ZoneCard key={zone.id} zone={zone} />
              ))}
            </div>
          </div>

          {/* Color Panel */}
          <div>
            <p className="text-white/20 text-[10px] font-mono tracking-widest mb-2 px-1">COLOR CONTROL</p>
            <ColorPanel />
          </div>

          {/* Preset Panel */}
          <div>
            <p className="text-white/20 text-[10px] font-mono tracking-widest mb-2 px-1">PRESETS & TIMERS</p>
            <PresetPanel />
          </div>

          {/* Global Control Bar */}
          <GlobalControlBar />
        </div>

        {/* RIGHT PANEL — Log */}
        <div className="flex-1 flex flex-col min-w-0">
          <p className="text-white/20 text-[10px] font-mono tracking-widest mb-2 px-1">SYSTEM LOG</p>
          <div className="flex-1 min-h-0">
            <LogPanel />
          </div>
        </div>
      </main>
    </div>
  )
}
