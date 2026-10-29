'use client'
import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { analyzeAudio } from '@/lib/show/analyze'
import type { AudioAnalysis } from '@/lib/show/analyze'

/** Decodes a song: peak level per 20 ms for the waveform, plus beats and sections. */
export async function decodeSong(file: File, bucketMs = 20): Promise<{ peaks: Float32Array; durationMs: number; analysis: AudioAnalysis }> {
  const ctx = new AudioContext()
  try {
    const buf = await ctx.decodeAudioData(await file.arrayBuffer())
    const data = buf.getChannelData(0)
    const per = Math.max(1, Math.floor((buf.sampleRate * bucketMs) / 1000))
    const peaks = new Float32Array(Math.ceil(data.length / per))
    for (let i = 0; i < peaks.length; i++) {
      let m = 0
      for (let j = i * per, end = Math.min(data.length, j + per); j < end; j++) {
        const v = Math.abs(data[j])
        if (v > m) m = v
      }
      peaks[i] = m
    }
    return { peaks, durationMs: buf.duration * 1000, analysis: analyzeAudio(buf) }
  } finally {
    void ctx.close()
  }
}

/**
 * Show clock. With music loaded the audio element is the clock (so lights
 * stay locked to the song); without music it runs on performance.now().
 */
export function usePlayback(lengthMs: number) {
  const audio = useRef<HTMLAudioElement | null>(null)
  const audioUrl = useRef<string | null>(null)
  const clock = useRef({ perf: 0, ms: 0 })
  const [playing, setPlaying] = useState(false)
  const [timeMs, setTimeMs] = useState(0)
  const [loop, setLoop] = useState(false)
  const [audioInfo, setAudioInfo] = useState<{ name: string; peaks: Float32Array; durationMs: number; analysis: AudioAnalysis } | null>(null)
  const loopRef = useRef(loop)
  useEffect(() => { loopRef.current = loop }, [loop])

  const now = useCallback(() => {
    const a = audio.current
    if (a && !a.paused) return a.currentTime * 1000
    return clock.current.ms + (performance.now() - clock.current.perf)
  }, [])

  const seek = useCallback((ms: number) => {
    const t = Math.max(0, Math.min(lengthMs, ms))
    clock.current = { perf: performance.now(), ms: t }
    if (audio.current) audio.current.currentTime = t / 1000
    setTimeMs(t)
  }, [lengthMs])

  const pause = useCallback(() => {
    const t = Math.min(lengthMs, now())
    audio.current?.pause()
    clock.current = { perf: performance.now(), ms: t }
    setPlaying(false)
    setTimeMs(t)
  }, [lengthMs, now])

  const play = useCallback(() => {
    let t = clock.current.ms
    if (t >= lengthMs - 1) t = 0
    clock.current = { perf: performance.now(), ms: t }
    const a = audio.current
    if (a && !(t / 1000 >= a.duration)) {  // duration is NaN until metadata loads
      a.currentTime = t / 1000
      void a.play().catch(() => {})
    }
    setPlaying(true)
  }, [lengthMs])

  // Advance the clock every animation frame while playing.
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = clock.current.ms
    let rebased = false
    const tick = () => {
      // Audio ran out before the show did: carry on from where it stopped on the internal clock.
      const a = audio.current
      if (a && a.ended && !rebased) {
        clock.current = { perf: performance.now(), ms: last }
        rebased = true
      }
      let t = now()
      if (t >= lengthMs) {
        if (loopRef.current) {
          clock.current = { perf: performance.now(), ms: 0 }
          if (audio.current) { audio.current.currentTime = 0; void audio.current.play().catch(() => {}) }
          rebased = false
          t = 0
        } else {
          audio.current?.pause()
          clock.current = { perf: performance.now(), ms: lengthMs }
          setTimeMs(lengthMs)
          setPlaying(false)
          return
        }
      }
      last = t
      setTimeMs(t)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, lengthMs, now])

  const setAudioFile = useCallback((file: File | null) => {
    audio.current?.pause()
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current)
    audio.current = null
    audioUrl.current = null
    setPlaying(false)
    if (!file) return
    audioUrl.current = URL.createObjectURL(file)
    audio.current = new Audio(audioUrl.current)
    audio.current.preload = 'auto'
  }, [])

  /** Decodes the song for the waveform and makes it the show clock. Returns its length. */
  const loadAudio = useCallback(async (file: File) => {
    const { peaks, durationMs, analysis } = await decodeSong(file)
    setAudioFile(file)
    setAudioInfo({ name: file.name, peaks, durationMs, analysis })
    return durationMs
  }, [setAudioFile])

  useEffect(() => () => {
    audio.current?.pause()
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current)
  }, [])

  // now(): the exact music position at this instant (timeMs is only updated once per frame).
  return { playing, timeMs, now, play, pause, seek, loop, setLoop, audio: audioInfo, loadAudio }
}

export type Playback = ReturnType<typeof usePlayback>

/**
 * One show clock and one song for the whole app, so Show Studio and Show Mode
 * always agree on where the show is. Children don't re-render on every tick;
 * only components that call useShowPlayback() do.
 */
const PlaybackContext = createContext<Playback | null>(null)

export function ShowPlaybackProvider({ lengthMs, children }: { lengthMs: number; children: ReactNode }) {
  const pb = usePlayback(lengthMs)
  return createElement(PlaybackContext.Provider, { value: pb }, children)
}

export function useShowPlayback(): Playback {
  const pb = useContext(PlaybackContext)
  if (!pb) throw new Error('useShowPlayback must be used inside ShowPlaybackProvider')
  return pb
}
