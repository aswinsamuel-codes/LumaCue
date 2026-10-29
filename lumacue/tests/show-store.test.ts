import { describe, expect, it } from 'vitest'
import { useShowStore } from '@/store/useShowStore'
import { starterProject } from '@/lib/show/model'

describe('undo / redo', () => {
  it('covers clips and sections together', () => {
    const s = useShowStore.getState()
    s.replaceProject(starterProject())
    const clips0 = useShowStore.getState().project.clips.length

    s.setSections([{ id: 's', name: 'Hands only', startMs: 0, endMs: 5000, darkZones: ['b'] }])
    useShowStore.getState().addClip(-1, 1000, 'solid')
    expect(useShowStore.getState().project.clips.length).toBe(clips0 + 1)

    useShowStore.getState().undo() // the clip
    expect(useShowStore.getState().project.clips.length).toBe(clips0)
    expect(useShowStore.getState().project.sections).toHaveLength(1)

    useShowStore.getState().undo() // the section
    expect(useShowStore.getState().project.sections).toBeUndefined()

    useShowStore.getState().redo()
    expect(useShowStore.getState().project.sections?.[0].name).toBe('Hands only')
    useShowStore.getState().redo()
    expect(useShowStore.getState().project.clips.length).toBe(clips0 + 1)
  })

  it('typing in a section field is not one step per key', () => {
    const s = useShowStore.getState()
    s.replaceProject(starterProject())
    s.setSections([{ id: 's', name: 'A', startMs: 0, endMs: 5000, darkZones: [] }])
    const steps = useShowStore.getState().past.length
    for (const name of ['B', 'Bo', 'Bou']) useShowStore.getState().setSections([{ id: 's', name, startMs: 0, endMs: 5000, darkZones: [] }], false)
    expect(useShowStore.getState().past.length).toBe(steps)
  })
})
