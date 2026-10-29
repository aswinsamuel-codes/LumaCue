import { create } from 'zustand'
import { ALL_DANCERS, isShowProject, makeId, starterProject } from '@/lib/show/model'
import type { Clip, EffectId, ShowProject } from '@/lib/show/model'

const STORAGE_KEY = 'lumacue.show.v1'
const HISTORY_LIMIT = 100

function loadSaved(): ShowProject {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
    const parsed = raw ? JSON.parse(raw) : null
    if (isShowProject(parsed)) return parsed
  } catch {
    // Private window or blocked storage: start fresh.
  }
  return starterProject()
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
function saveSoon(project: ShowProject) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
    } catch {
      // Storage full or blocked — the Export button still works.
    }
  }, 400)
}

interface ShowState {
  project: ShowProject
  selectedClipId: string | null
  selectedTrack: number
  lastEffect: EffectId
  lastColor: string
  past: Clip[][]
  future: Clip[][]

  /** Call once before a change that should be one undo step (a drag calls it on pointer-down). */
  checkpoint: () => void
  undo: () => void
  redo: () => void

  selectClip: (id: string | null) => void
  selectTrack: (track: number) => void
  addClip: (track: number, startMs: number, effect?: EffectId) => void
  updateClip: (id: string, patch: Partial<Omit<Clip, 'id'>>) => void
  deleteClip: (id: string) => void
  duplicateClip: (id: string) => void
  setProject: (patch: Partial<Omit<ShowProject, 'version' | 'clips'>>) => void
  replaceProject: (project: ShowProject) => void
  /** Adds generated clips as one undo step, optionally replacing everything. */
  applyClips: (clips: Clip[], replace: boolean) => void
}

export const useShowStore = create<ShowState>((set, get) => {
  const commit = (clips: Clip[], extra: Partial<ShowState> = {}) => {
    const project = { ...get().project, clips }
    set({ project, ...extra })
    saveSoon(project)
  }

  return {
    project: loadSaved(),
    selectedClipId: null,
    selectedTrack: ALL_DANCERS,
    lastEffect: 'solid',
    lastColor: '#00E5FF',
    past: [],
    future: [],

    checkpoint: () => set((s) => ({ past: [...s.past.slice(-HISTORY_LIMIT + 1), s.project.clips], future: [] })),

    undo: () => {
      const { past, project } = get()
      if (!past.length) return
      commit(past[past.length - 1], { past: past.slice(0, -1), future: [project.clips, ...get().future] })
    },

    redo: () => {
      const { future, project } = get()
      if (!future.length) return
      commit(future[0], { future: future.slice(1), past: [...get().past, project.clips] })
    },

    selectClip: (id) => {
      const clip = get().project.clips.find((c) => c.id === id)
      set(clip ? { selectedClipId: id, selectedTrack: clip.track } : { selectedClipId: null })
    },

    selectTrack: (track) => set({ selectedTrack: track }),

    addClip: (track, startMs, effect) => {
      get().checkpoint()
      const { lastEffect, lastColor, project } = get()
      const durationMs = 2000
      const clip: Clip = {
        id: makeId(),
        track,
        startMs: Math.max(0, Math.min(startMs, project.lengthMs - 100)),
        durationMs: Math.min(durationMs, project.lengthMs - Math.max(0, startMs)) || durationMs,
        effect: effect ?? lastEffect,
        color: lastColor,
        color2: '#000000',
        zones: [],
        speed: 50,
      }
      commit([...project.clips, clip], { selectedClipId: clip.id, selectedTrack: track, lastEffect: clip.effect })
    },

    updateClip: (id, patch) => {
      const clips = get().project.clips.map((c) => (c.id === id ? { ...c, ...patch } : c))
      const extra: Partial<ShowState> = {}
      if (patch.color) extra.lastColor = patch.color
      if (patch.effect) extra.lastEffect = patch.effect
      if (patch.track !== undefined && id === get().selectedClipId) extra.selectedTrack = patch.track
      commit(clips, extra)
    },

    deleteClip: (id) => {
      get().checkpoint()
      commit(get().project.clips.filter((c) => c.id !== id), { selectedClipId: null })
    },

    duplicateClip: (id) => {
      const c = get().project.clips.find((x) => x.id === id)
      if (!c) return
      get().checkpoint()
      const copy = { ...c, id: makeId(), startMs: Math.min(c.startMs + c.durationMs, get().project.lengthMs - 100) }
      commit([...get().project.clips, copy], { selectedClipId: copy.id })
    },

    setProject: (patch) => {
      const project = { ...get().project, ...patch }
      set({ project })
      saveSoon(project)
    },

    applyClips: (clips, replace) => {
      get().checkpoint()
      commit(replace ? clips : [...get().project.clips, ...clips], { selectedClipId: null })
    },

    replaceProject: (project) => {
      set({ project, past: [], future: [], selectedClipId: null, selectedTrack: ALL_DANCERS })
      saveSoon(project)
    },
  }
})
