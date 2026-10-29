import { describe, expect, it } from 'vitest'
import { spreadAcrossDancers, spreadSlot } from '@/lib/show/spread'
import { useShowStore } from '@/store/useShowStore'
import { starterProject } from '@/lib/show/model'
import { clip } from './helpers/fixtures'

describe('spread across dancers', () => {
  it('orders the starts as asked', () => {
    const slots = (order: Parameters<typeof spreadSlot>[2]) => [0, 1, 2, 3, 4].map((d) => spreadSlot(d, 5, order))
    expect(slots('forward')).toEqual([0, 1, 2, 3, 4])
    expect(slots('reverse')).toEqual([4, 3, 2, 1, 0])
    expect(slots('center-out')).toEqual([2, 1, 0, 1, 2])
    expect(slots('edges-in')).toEqual([0, 1, 2, 1, 0])
  })

  it('makes one copy per dancer, staggered, and keeps them inside the show', () => {
    const c = clip({ startMs: 9000, durationMs: 2000, effect: 'wipe' })
    const out = spreadAcrossDancers(c, 5, 250, 'forward', 10000)
    expect(out.map((x) => [x.track, x.startMs, x.durationMs])).toEqual([[0, 9000, 1000], [1, 9250, 750], [2, 9500, 500], [3, 9750, 250]])
    expect(out.every((x) => x.effect === 'wipe' && x.id !== c.id)).toBe(true)
  })

  it('is one undo step in the editor', () => {
    const s = useShowStore.getState()
    s.replaceProject({ ...starterProject(), clips: [clip({ id: 'x', startMs: 1000 })] })
    useShowStore.getState().spreadClip('x', 100, 'forward')
    const p = useShowStore.getState().project
    expect(p.clips.map((c) => c.track)).toEqual([0, 1, 2, 3, 4])
    useShowStore.getState().undo()
    expect(useShowStore.getState().project.clips.map((c) => c.id)).toEqual(['x'])
  })
})
