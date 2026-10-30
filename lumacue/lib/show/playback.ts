'use client'
import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { analyzeAudio } from '@/lib/show/analyze'
import type { AudioAnalysis } from '@/lib/show/analyze'
import { YT_STATE, createYouTubePlayer, parseYouTubeId } from '@/lib/show/youtube'
import type { YTPlayer } from '@/lib/show/youtube'

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

export interface YouTubeSource {
  name: string        // video title
  url: string
  videoId: string
  durationMs: number
}

/**
 * Show clock. With music loaded the audio element (or the YouTube player) is
 * the clock, so lights stay locked to the song; without music it runs on
 * performance.now().
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

  // YouTube source: the player lives in the YouTube dock (ytHost), see components/YouTubeDock.
  const yt = useRef<YTPlayer | null>(null)
  const ytState = useRef<number>(-1)
  const ytLast = useRef(0)          // last position YouTube reported while playing
  const ytHost = useRef<HTMLDivElement | null>(null)
  const intent = useRef(false)      // the show is meant to be playing
  const quietSeek = useRef(false)   // our own seek while stopped: YouTube must not start playing
  const [youtube, setYoutube] = useState<YouTubeSource | null>(null)
  const [youtubeLoading, setYoutubeLoading] = useState(false)

  const now = useCallback(() => {
    const p = yt.current
    if (p && intent.current && ytState.current !== YT_STATE.ENDED) {
      // While YouTube buffers (or shows an ad) the show holds where the music is.
      if (ytState.current === YT_STATE.PLAYING) ytLast.current = p.getCurrentTime() * 1000
      return ytLast.current
    }
    const a = audio.current
    if (a && !a.paused) return a.currentTime * 1000
    return clock.current.ms + (performance.now() - clock.current.perf)
  }, [])

  const seek = useCallback((ms: number) => {
    const t = Math.max(0, Math.min(lengthMs, ms))
    clock.current = { perf: performance.now(), ms: t }
    if (audio.current) audio.current.currentTime = t / 1000
    if (yt.current) {
      ytLast.current = t
      if (intent.current) yt.current.seekTo(t / 1000, true)
      else if (!(ytState.current === YT_STATE.CUED && t === 0)) {
        // seekTo starts a cued video playing; keep it stopped like the rest of the show.
        quietSeek.current = true
        yt.current.seekTo(t / 1000, true)
        yt.current.pauseVideo()
      }
    }
    setTimeMs(t)
  }, [lengthMs])

  const pause = useCallback(() => {
    const t = Math.min(lengthMs, now())
    intent.current = false
    audio.current?.pause()
    yt.current?.pauseVideo()
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
    intent.current = true
    if (yt.current) {
      quietSeek.current = false
      ytLast.current = t
      yt.current.seekTo(t / 1000, true)
      yt.current.playVideo()
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
      const ended = (a && a.ended) || (yt.current && ytState.current === YT_STATE.ENDED)
      if (ended && !rebased) {
        clock.current = { perf: performance.now(), ms: last }
        rebased = true
      }
      let t = now()
      if (t >= lengthMs) {
        if (loopRef.current) {
          clock.current = { perf: performance.now(), ms: 0 }
          if (audio.current) { audio.current.currentTime = 0; void audio.current.play().catch(() => {}) }
          if (yt.current) { ytLast.current = 0; yt.current.seekTo(0, true); yt.current.playVideo() }
          rebased = false
          t = 0
        } else {
          intent.current = false
          audio.current?.pause()
          yt.current?.pauseVideo()
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

  const dropYouTube = useCallback(() => {
    try { yt.current?.destroy() } catch { /* already gone */ }
    yt.current = null
    ytState.current = -1
    ytHost.current?.replaceChildren()
    setYoutube(null)
  }, [])

  const setAudioFile = useCallback((file: File | null) => {
    dropYouTube()
    intent.current = false
    audio.current?.pause()
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current)
    audio.current = null
    audioUrl.current = null
    setPlaying(false)
    if (!file) return
    audioUrl.current = URL.createObjectURL(file)
    audio.current = new Audio(audioUrl.current)
    audio.current.preload = 'auto'
  }, [dropYouTube])

  /** Decodes the song for the waveform and makes it the show clock. Returns its length. */
  const loadAudio = useCallback(async (file: File) => {
    const { peaks, durationMs, analysis } = await decodeSong(file)
    setAudioFile(file)
    setAudioInfo({ name: file.name, peaks, durationMs, analysis })
    return durationMs
  }, [setAudioFile])

  /**
   * Plays a YouTube video's sound as the show's music, in YouTube's own player.
   * Replaces a loaded music file. Returns the video's title and length.
   */
  const loadYouTube = useCallback(async (url: string) => {
    const videoId = parseYouTubeId(url)
    if (!videoId) throw new Error('That isn’t a YouTube link.')
    const host = ytHost.current
    if (!host) throw new Error('The YouTube player area isn’t on the page.')
    setYoutubeLoading(true)
    try {
      setAudioFile(null)
      setAudioInfo(null)
      clock.current = { perf: performance.now(), ms: 0 }
      setTimeMs(0)
      const { player, durationMs, title } = await createYouTubePlayer(host, videoId, (state) => {
        ytState.current = state
        // YouTube's own play/pause buttons drive the show too.
        if (state === YT_STATE.PAUSED) quietSeek.current = false
        if (state === YT_STATE.PLAYING && !intent.current && quietSeek.current) {
          player.pauseVideo()
        } else if (state === YT_STATE.PLAYING && !intent.current) {
          const t = player.getCurrentTime() * 1000
          ytLast.current = t
          clock.current = { perf: performance.now(), ms: t }
          intent.current = true
          setPlaying(true)
        } else if (state === YT_STATE.PAUSED && intent.current) {
          const t = player.getCurrentTime() * 1000
          intent.current = false
          clock.current = { perf: performance.now(), ms: t }
          setPlaying(false)
          setTimeMs(t)
        }
      })
      yt.current = player
      ytState.current = YT_STATE.CUED
      setYoutube({ name: title, url, videoId, durationMs })
      return { title, durationMs }
    } finally {
      setYoutubeLoading(false)
    }
  }, [setAudioFile])

  useEffect(() => () => {
    audio.current?.pause()
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current)
    try { yt.current?.destroy() } catch { /* already gone */ }
  }, [])

  // Callback ref for the YouTube dock's player area (a ref object here would trip render-time ref rules).
  const setYouTubeHost = useCallback((el: HTMLDivElement | null) => { ytHost.current = el }, [])

  // now(): the exact music position at this instant (timeMs is only updated once per frame).
  return {
    playing, timeMs, now, play, pause, seek, loop, setLoop, audio: audioInfo, loadAudio,
    youtube, youtubeLoading, loadYouTube, unloadYouTube: dropYouTube, setYouTubeHost,
  }
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
