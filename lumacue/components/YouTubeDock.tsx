'use client'
import { useState } from 'react'
import { useShowPlayback } from '@/lib/show/playback'

/**
 * Holds YouTube's embedded player while a YouTube link is the show's music.
 * It stays on screen on every tab (YouTube requires the player to be visible,
 * at least 200 × 200 px); the ⇄ button moves it to the other corner.
 * The host div is always mounted so the player can be created into it.
 */
export default function YouTubeDock() {
  const { youtube, youtubeLoading, unloadYouTube, setYouTubeHost } = useShowPlayback()
  const [side, setSide] = useState<'left' | 'right'>('left')
  const visible = !!youtube || youtubeLoading

  return (
    <div
      className={`fixed bottom-3 z-40 w-[356px] rounded-xl border border-white/15 bg-black shadow-2xl overflow-hidden ${side === 'left' ? 'left-3' : 'right-3'} ${visible ? '' : 'hidden'}`}
      aria-label="YouTube music player"
    >
      <div className="flex items-center gap-2 px-2 py-1 bg-[#111] border-b border-white/10">
        <span className="text-red-400 text-xs">▶</span>
        <span className="flex-1 truncate text-[11px] font-mono text-white/70" title={youtube?.name}>
          {youtube ? youtube.name : 'Loading YouTube…'}
        </span>
        <button onClick={() => setSide(side === 'left' ? 'right' : 'left')} className="text-white/40 hover:text-white text-xs px-1" title="Move to the other corner">⇄</button>
        <button onClick={unloadYouTube} className="text-white/40 hover:text-red-400 text-xs px-1" title="Stop using this YouTube video as the music">✕</button>
      </div>
      <div ref={setYouTubeHost} className="w-[356px] h-[200px]" />
    </div>
  )
}
