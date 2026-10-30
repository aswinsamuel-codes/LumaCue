/**
 * YouTube as a music source, through YouTube's official IFrame Player API.
 * The song plays in YouTube's own embedded player (which must stay visible);
 * LumaCue only reads its play position to drive the show clock. Nothing is
 * downloaded, and the audio itself can't be read, so there is no waveform and
 * no automatic cues for a YouTube source.
 */

/** Video id from the usual YouTube link shapes, or a bare 11-character id. */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim()
  if (/^[\w-]{11}$/.test(s)) return s
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '')
  let id: string | null = null
  if (host === 'youtu.be') id = url.pathname.split('/')[1] ?? null
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = url.searchParams.get('v')
    const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/)
    if (!id && m) id = m[1]
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null
}

/** The bits of the YT.Player API we use. */
export interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  getVideoData?(): { title?: string }
  destroy(): void
}

export const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const

interface YTNamespace {
  Player: new (el: HTMLElement, opts: {
    videoId: string
    width?: string | number
    height?: string | number
    playerVars?: Record<string, string | number>
    events?: { onReady?: () => void; onError?: (e: { data: number }) => void; onStateChange?: (e: { data: number }) => void }
  }) => YTPlayer
}

type YTWindow = Window & { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void }

let apiPromise: Promise<YTNamespace> | null = null

function loadApi(): Promise<YTNamespace> {
  const w = window as YTWindow
  if (w.YT?.Player) return Promise.resolve(w.YT)
  apiPromise ??= new Promise<YTNamespace>((resolve, reject) => {
    const previous = w.onYouTubeIframeAPIReady
    w.onYouTubeIframeAPIReady = () => {
      previous?.()
      if (w.YT) resolve(w.YT)
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => {
      apiPromise = null
      reject(new Error('Could not reach YouTube. Check the internet connection.'))
    }
    document.head.appendChild(script)
  })
  return apiPromise
}

const ERRORS: Record<number, string> = {
  2: 'That link has an invalid video id.',
  5: 'This video can’t be played in the browser’s player.',
  100: 'Video not found (removed or private).',
  101: 'The owner doesn’t allow this video to be played in other apps. Try another upload of the song, or load a music file.',
  150: 'The owner doesn’t allow this video to be played in other apps. Try another upload of the song, or load a music file.',
}

/**
 * Creates a player inside `host` and waits until it's ready and knows the
 * video's length. The returned player has been cued, not started.
 */
export async function createYouTubePlayer(
  host: HTMLElement,
  videoId: string,
  onStateChange: (state: number) => void,
): Promise<{ player: YTPlayer; durationMs: number; title: string }> {
  const YT = await loadApi()
  // YouTube replaces the element it is given, so give it a child we own.
  host.replaceChildren()
  const el = document.createElement('div')
  host.appendChild(el)

  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => fail('YouTube didn’t answer in time. Check the internet connection.'), 15000)
    const fail = (msg: string) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { player.destroy() } catch { /* already gone */ }
      reject(new Error(msg))
    }
    const player = new YT.Player(el, {
      videoId,
      width: '100%',
      height: '100%',
      playerVars: { playsinline: 1, rel: 0, controls: 1, disablekb: 1 },
      events: {
        onReady: () => {
          // Duration can read 0 for a moment after ready; give it up to ~3 s.
          let tries = 0
          const waitForDuration = () => {
            const d = player.getDuration()
            if (d > 0 || tries++ > 30) {
              if (settled) return
              settled = true
              clearTimeout(timer)
              const title = player.getVideoData?.().title?.trim() || `YouTube ${videoId}`
              resolve({ player, durationMs: d * 1000, title })
            } else setTimeout(waitForDuration, 100)
          }
          waitForDuration()
        },
        onError: (e) => fail(ERRORS[e.data] ?? `YouTube error ${e.data}.`),
        onStateChange: (e) => onStateChange(e.data),
      },
    })
  })
}
