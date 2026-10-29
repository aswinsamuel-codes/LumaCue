'use client'
import { useEffect, useRef, useState } from 'react'
import { shouldSeek, videoTargetSec } from '@/lib/show/video-sync'

const btn = 'px-1.5 py-0.5 rounded border border-white/10 bg-black/60 text-white/70 text-[10px] font-mono hover:text-white'

/**
 * A filmed rehearsal playing in step with the show, over the digital twin, to
 * check cues against the dancers' real moves. The video is muted (the show's
 * music plays) and only kept for this session, like the music.
 */
export default function RehearsalVideo({ timeMs, playing, onClose }: { timeMs: number; playing: boolean; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [src, setSrc] = useState<{ url: string; name: string } | null>(null)
  const [offsetMs, setOffsetMs] = useState(0)
  const [durationSec, setDurationSec] = useState(0) // known once the video's metadata has loaded
  const outside = !!src && durationSec > 0 && videoTargetSec(timeMs, offsetMs, durationSec) === null

  useEffect(() => () => { if (src) URL.revokeObjectURL(src.url) }, [src])

  // Follow the show clock: play with it, and seek when it has drifted or the playhead jumped.
  useEffect(() => {
    const v = video.current
    if (!v || !src || !durationSec) return
    const target = videoTargetSec(timeMs, offsetMs, durationSec)
    if (target === null) { v.pause(); return }
    if (shouldSeek(v.currentTime, target, playing)) v.currentTime = target
    if (playing && v.paused) void v.play().catch(() => {})
    if (!playing && !v.paused) v.pause()
  }, [timeMs, playing, offsetMs, src, durationSec])

  const nudge = (ms: number) => setOffsetMs((o) => o + ms)

  return (
    <div className="absolute bottom-2 right-2 z-10 w-[28%] min-w-[220px] rounded-lg border border-white/15 bg-black/80 p-1.5 shadow-xl">
      {src ? (
        <>
          <video ref={video} src={src.url} muted playsInline className={`w-full rounded ${outside ? 'opacity-30' : ''}`} onLoadedMetadata={(e) => setDurationSec(e.currentTarget.duration > 0 ? e.currentTarget.duration : 0)} onDurationChange={(e) => setDurationSec(e.currentTarget.duration > 0 ? e.currentTarget.duration : 0)} />
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span className="text-white/40 text-[10px] font-mono mr-auto truncate max-w-[45%]" title={src.name}>🎥 {src.name}</span>
            <button className={btn} onClick={() => nudge(-100)} title="The filmed moves come 100 ms later against the show">«</button>
            <button className={btn} onClick={() => nudge(-33)} title="The filmed moves come one frame (30 fps) later">‹</button>
            <span className="text-white/60 text-[10px] font-mono tabular-nums" title="Where the show's 0:00 is in the video">{offsetMs >= 0 ? '+' : ''}{(offsetMs / 1000).toFixed(2)} s</span>
            <button className={btn} onClick={() => nudge(33)} title="The filmed moves come one frame (30 fps) sooner">›</button>
            <button className={btn} onClick={() => nudge(100)} title="The filmed moves come 100 ms sooner against the show">»</button>
            <button className={btn} onClick={() => input.current?.click()} title="Load another video">↻</button>
            <button className={btn} onClick={onClose} title="Close the video">✕</button>
          </div>
          {outside && <p className="text-white/40 text-[10px] font-mono mt-0.5">Outside the video at this point in the show</p>}
        </>
      ) : (
        <div className="flex items-center gap-2 p-1">
          <button className={btn} onClick={() => input.current?.click()}>🎥 Load rehearsal video</button>
          <span className="text-white/30 text-[10px]">Plays muted, in step with the show. Use « ‹ › » to line it up.</span>
          <button className={`${btn} ml-auto`} onClick={onClose}>✕</button>
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept="video/*"
        hidden
        aria-label="Rehearsal video file"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) { setDurationSec(0); setSrc({ url: URL.createObjectURL(f), name: f.name }) }
          e.target.value = ''
        }}
      />
    </div>
  )
}
