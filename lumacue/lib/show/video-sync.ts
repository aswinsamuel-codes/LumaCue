/**
 * Keeps a rehearsal video in step with the show clock. offsetMs is where the
 * show's 0:00 falls in the video (a positive offset = the video started
 * recording before the music did).
 */

/** Where the video should be, in seconds, or null if this show time is outside the video. */
export function videoTargetSec(showMs: number, offsetMs: number, videoDurationSec: number): number | null {
  const sec = (showMs + offsetMs) / 1000
  return sec < 0 || sec > videoDurationSec ? null : sec
}

/**
 * Whether to correct the video's position. While playing, small drift is
 * left alone (seeking stutters); paused, it follows the playhead closely.
 */
export function shouldSeek(currentSec: number, targetSec: number, playing: boolean) {
  return Math.abs(currentSec - targetSec) > (playing ? 0.12 : 0.02)
}
