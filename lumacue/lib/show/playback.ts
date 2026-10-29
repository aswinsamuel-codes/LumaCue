'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

/** Peak level per 20 ms of audio, for drawing the waveform. */
export async function audioPeaks(file: File, bucketMs = 20): Promise<{ peaks: Float32Array; durationMs: number }> {
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
    return { peaks, durationMs: buf.duration * 1000 }
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

  useEffect(() => () => {
    audio.current?.pause()
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current)
  }, [])

  return { playing, timeMs, play, pause, seek, loop, setLoop, setAudioFile }
}

export type Playback = ReturnType<typeof usePlayback>
