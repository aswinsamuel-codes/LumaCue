import { beforeEach, describe, expect, it } from 'vitest'
import { useCostumeStore } from '@/store/useCostumeStore'
import { useDashboardStore } from '@/store/useDashboardStore'

const flush = () => new Promise((r) => setTimeout(r, 0))
const logs = () => useDashboardStore.getState().logs.map((l) => l.message)

describe('costume store with the simulated base station', () => {
  beforeEach(async () => {
    await useCostumeStore.getState().disconnectBase()
    useCostumeStore.setState({ musicSync: true, baseDriftMs: null, running: false, armed: false })
  })

  it('connects, arms, starts and syncs to the music', async () => {
    const s = useCostumeStore.getState()
    await s.connectSimulator()
    expect(useCostumeStore.getState().baseKind).toBe('simulator')
    s.arm()
    s.start()
    await flush()
    useCostumeStore.getState().syncToMusic(0)
    await flush()
    await flush()
    expect(useCostumeStore.getState().baseDriftMs).not.toBeNull()
    expect(logs().some((m) => m.includes('Base: START run'))).toBe(true)
    // routine sync lines are not logged
    expect(logs().some((m) => m.includes('sync err_ms'))).toBe(false)
  })

  it('does not send music sync when it is turned off or the show is not running', async () => {
    const s = useCostumeStore.getState()
    await s.connectSimulator()
    s.syncToMusic(1000) // not running
    await flush()
    expect(useCostumeStore.getState().baseDriftMs).toBeNull()
    s.setMusicSync(false)
    s.start()
    useCostumeStore.getState().syncToMusic(1000)
    await flush()
    await flush()
    expect(useCostumeStore.getState().baseDriftMs).toBeNull()
  })

  it('blackout clears running and armed', async () => {
    const s = useCostumeStore.getState()
    await s.connectSimulator()
    s.arm()
    s.start()
    s.blackout()
    expect(useCostumeStore.getState()).toMatchObject({ running: false, armed: false })
  })
})
