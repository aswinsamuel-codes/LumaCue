'use client'
import { useDeferredValue, useMemo } from 'react'
import { benchFingerprint } from '@/lib/show/bench'
import { useShowStore } from '@/store/useShowStore'
import { useCostumeStore } from '@/store/useCostumeStore'
import { useFirmwareStore } from '@/store/useFirmwareStore'

export type FirmwareState = 'ok' | 'stale' | 'never'

/**
 * Per dancer: was firmware downloaded for the show (and costume settings) as
 * they are now? Based on downloads from this browser, not on the boards.
 */
export function useFirmwareStatus() {
  // Deferred: a clip drag re-renders at full speed; the badge catches up when idle.
  const project = useDeferredValue(useShowStore((s) => s.project))
  const zones = useCostumeStore((s) => s.zones)
  const brightness = useCostumeStore((s) => s.brightness)
  const flashed = useFirmwareStore((s) => s.byDancer)

  return useMemo(() => {
    const ids = zones.map((z) => z.id)
    const perDancer = Array.from({ length: project.dancers }, (_, d) => {
      const rec = flashed[d]
      const state: FirmwareState = !rec
        ? 'never'
        : rec.fingerprint === benchFingerprint(project, ids, d, { output: rec.output, board: rec.board, zoneLeds: zones.map((z) => z.leds), brightnessPct: brightness })
          ? 'ok'
          : 'stale'
      return { dancer: d, state }
    })
    return { perDancer, toUpdate: perDancer.filter((f) => f.state !== 'ok').length }
  }, [project, zones, flashed, brightness])
}
