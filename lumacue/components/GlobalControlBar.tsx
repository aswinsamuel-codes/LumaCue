'use client'
import { useDashboardStore } from '@/store/useDashboardStore'

export default function GlobalControlBar() {
  const { applyToAllZones, syncAll, emergencyOff } = useDashboardStore()

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-3 flex gap-2">
      <button
        onClick={applyToAllZones}
        className="flex-1 py-2 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-medium hover:bg-blue-500/30 transition-all active:scale-95"
      >
        Apply to All Zones
      </button>

      <button
        onClick={syncAll}
        className="flex-1 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-medium hover:bg-purple-500/30 transition-all active:scale-95"
      >
        Sync All
      </button>

      <button
        onClick={emergencyOff}
        className="flex-1 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-bold hover:bg-red-500/30 transition-all tracking-wider active:scale-95"
      >
        ⚡ EMERGENCY OFF
      </button>
    </div>
  )
}
