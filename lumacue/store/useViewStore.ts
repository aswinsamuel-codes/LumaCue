import { create } from 'zustand'

/** Per-viewer display preferences (this browser only). */
const KEY = 'lumacue.view.v1'

function load(): { view3d: boolean } {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null
    const v = raw ? JSON.parse(raw) : null
    return { view3d: v?.view3d === true }
  } catch {
    return { view3d: false }
  }
}

interface ViewState {
  view3d: boolean
  setView3d: (v: boolean) => void
}

export const useViewStore = create<ViewState>((set) => ({
  ...load(),
  setView3d: (view3d) => {
    set({ view3d })
    try { window.localStorage.setItem(KEY, JSON.stringify({ view3d })) } catch { /* storage blocked */ }
  },
}))
