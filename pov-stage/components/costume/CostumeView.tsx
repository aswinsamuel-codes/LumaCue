'use client'
import { useEffect, useState } from 'react'
import ShowControl from '@/components/costume/ShowControl'
import ShowPreview from '@/components/costume/ShowPreview'
import CostumeZones from '@/components/costume/CostumeZones'
import { DEMO_SHOW } from '@/lib/costume-show'
import { useCostumeStore } from '@/store/useCostumeStore'

export default function CostumeView() {
  const { running, showStartedAt, showEnded } = useCostumeStore()
  const [showMs, setShowMs] = useState(0)

  // Local show clock for the UI. The base station's clock is the real one;
  // this only drives the preview and the time readout.
  useEffect(() => {
    if (!running || showStartedAt === null) return
    const id = setInterval(() => {
      const t = Math.max(0, performance.now() - showStartedAt)
      setShowMs(t)
      if (t >= DEMO_SHOW.lengthMs) showEnded()
    }, 40)
    return () => clearInterval(id)
  }, [running, showStartedAt, showEnded])

  const t = running ? showMs : 0

  return (
    <>
      <div>
        <p className="text-white/20 text-[10px] font-mono tracking-widest mb-2 px-1">COSTUME SHOW CONTROL</p>
        <ShowControl showMs={t} />
      </div>

      <div>
        <p className="text-white/20 text-[10px] font-mono tracking-widest mb-2 px-1">STORED SHOW PREVIEW</p>
        <ShowPreview showMs={t} />
      </div>

      <div>
        <p className="text-white/20 text-[10px] font-mono tracking-widest mb-2 px-1">COSTUME LAYOUT & POWER</p>
        <CostumeZones />
      </div>
    </>
  )
}
