'use client'
import { useState, useEffect } from 'react'
import TopBar from '@/components/TopBar'
import ZoneCard from '@/components/ZoneCard'
import ColorPanel from '@/components/ColorPanel'
import PresetPanel from '@/components/PresetPanel'
import GlobalControlBar from '@/components/GlobalControlBar'
import LogPanel from '@/components/LogPanel'
import LoginPage from '@/components/LoginPage'
import TabBar from '@/components/TabBar'
import type { ShowTab } from '@/components/TabBar'
import TimelineView from '@/components/timeline/TimelineView'
import ShowModeView from '@/components/showmode/ShowModeView'
import { ShowPlaybackProvider } from '@/lib/show/playback'
import { useShowStore } from '@/store/useShowStore'
import { useDashboardStore } from '@/store/useDashboardStore'
import { useCostumeStore } from '@/store/useCostumeStore'

export default function Home() {
  const { zones, authenticated, addZone, deleteZone, initializeWebSocket } = useDashboardStore()
  const [showAddZone, setShowAddZone] = useState(false)
  const [newZoneName, setNewZoneName] = useState('')
  const [tab, setTab] = useState<ShowTab>('band')
  const watchBaseStation = useCostumeStore((s) => s.watchBaseStation)
  const showLengthMs = useShowStore((s) => s.project.lengthMs)

  // Start both hardware links after authentication. Each one reconnects on its own.
  useEffect(() => {
    if (authenticated) {
      initializeWebSocket()
      watchBaseStation()
    }
  }, [authenticated, initializeWebSocket, watchBaseStation])

  if (!authenticated) {
    return <LoginPage />
  }

  const handleAddZone = () => {
    if (newZoneName.trim()) {
      addZone(newZoneName.trim())
      setNewZoneName('')
      setShowAddZone(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[#0A0A0A] overflow-hidden">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-pink-500/3 rounded-full blur-3xl" />
      </div>

      <TopBar />
      <TabBar active={tab} onChange={setTab} />

      <main className="flex flex-1 gap-3 p-3 overflow-hidden relative">
        {/* LEFT PANEL */}
        <div className={`flex flex-col gap-3 flex-1 min-w-0 pr-1 ${tab === 'band' ? 'overflow-y-auto' : 'overflow-hidden'}`}>
          {/* Both tabs stay mounted so a running preset or show keeps going when you switch */}
          <div role="tabpanel" className={tab === 'band' ? 'flex flex-col gap-3' : 'hidden'}>
            {/* Zone Cards */}
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-white/20 text-[10px] font-mono tracking-widest">HAND BAND ZONES</p>
                <button
                  onClick={() => setShowAddZone(true)}
                  className="text-[10px] px-2 py-1 rounded bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 transition-all font-mono"
                >
                  + ADD ZONE
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {zones.map((zone) => (
                  <ZoneCard key={zone.id} zone={zone} onDelete={() => deleteZone(zone.id)} />
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
          {/* Studio and Show Mode share one show clock and song */}
          <ShowPlaybackProvider lengthMs={showLengthMs}>
            <div role="tabpanel" className={tab === 'studio' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
              <TimelineView active={tab === 'studio'} />
            </div>
            <div role="tabpanel" className={tab === 'live' ? 'flex flex-col flex-1 min-h-0' : 'hidden'}>
              <ShowModeView active={tab === 'live'} />
            </div>
          </ShowPlaybackProvider>
        </div>

        {/* RIGHT PANEL — Compact Log */}
        <div className={tab === 'studio' ? 'hidden' : 'flex flex-col w-80 shrink-0'}>
          <p className="text-white/20 text-[10px] font-mono tracking-widest mb-2 px-1">SYSTEM LOG</p>
          <div className="flex-1 min-h-0">
            <LogPanel />
          </div>
        </div>
      </main>

      {/* Add Zone Modal */}
      {showAddZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0f0f0f] p-5 animate-scale-in">
            <h4 className="text-white font-semibold mb-4">Add New Zone</h4>
            <input
              type="text"
              placeholder="Zone name (e.g., Zone D)"
              value={newZoneName}
              onChange={(e) => setNewZoneName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddZone()}
              className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-white text-sm mb-4 focus:outline-none focus:border-purple-500/50"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowAddZone(false); setNewZoneName('') }}
                className="flex-1 py-2 rounded-md border border-white/10 text-white/40 text-sm hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAddZone}
                className="flex-1 py-2 rounded-md bg-blue-500/30 border border-blue-500/50 text-blue-300 text-sm hover:bg-blue-500/40 transition-all"
              >
                Add Zone
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
