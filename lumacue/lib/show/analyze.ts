/**
 * Song analysis for automatic cues, done entirely in the browser.
 * Finds tempo, a beat grid, bars, energy sections, drops and strong hits.
 *
 * Method (kept simple and fast, no FFT): full-band and bass energy every ~10 ms
 * → onset strength from rises in log energy → tempo by autocorrelation →
 * beats by dynamic programming (follows small tempo drifts instead of a rigid
 * grid) → bars from bass hits → section energy per 4-bar phrase.
 */

export type EnergyLevel = 'low' | 'mid' | 'high'

export interface Section {
  startMs: number
  endMs: number
  level: EnergyLevel
  energy: number   // 0–1, relative to the rest of the song
  drop: boolean    // sudden jump into a high-energy part
}

export interface AudioAnalysis {
  bpm: number
  beatMs: number
  beats: number[]      // ms
  downbeats: number[]  // ms, first beat of each bar
  sections: Section[]
  accents: number[]    // ms, strongest hits
}

const TARGET_HOP_S = 0.01
const TIGHTNESS = 100 // how strongly beat spacing is held to the detected tempo

function percentile(values: number[], p: number) {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.max(0, Math.floor((p / 100) * (s.length - 1))))]
}

export function analyzeAudio(buf: AudioBuffer): AudioAnalysis {
  const sr = buf.sampleRate
  const hop = Math.max(1, Math.round(sr * TARGET_HOP_S))
  const HOP_S = hop / sr // exact frame length, so times don't drift at odd sample rates
  const frames = Math.floor(buf.length / hop)
  const channels = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c))
  const lpA = Math.exp((-2 * Math.PI * 150) / sr) // one-pole low-pass for the bass band

  // ---- Energy per 10 ms frame ----
  const eFull = new Float32Array(frames)
  const eLow = new Float32Array(frames)
  let lp = 0
  for (let f = 0; f < frames; f++) {
    let full = 0, low = 0
    for (let i = f * hop, end = i + hop; i < end; i++) {
      let x = 0
      for (const ch of channels) x += ch[i]
      x /= channels.length
      lp = lpA * lp + (1 - lpA) * x
      full += x * x
      low += lp * lp
    }
    eFull[f] = full / hop
    eLow[f] = low / hop
  }

  // ---- Onset strength: rises in log energy, minus the local average ----
  const raw = new Float32Array(frames)
  const rawLow = new Float32Array(frames)
  for (let f = 1; f < frames; f++) {
    const dFull = Math.log(1e-9 + eFull[f]) - Math.log(1e-9 + eFull[f - 1])
    const dLow = Math.log(1e-9 + eLow[f]) - Math.log(1e-9 + eLow[f - 1])
    rawLow[f] = Math.max(0, dLow)
    raw[f] = Math.max(0, dFull) + rawLow[f]
  }
  const onset = new Float32Array(frames)
  const W = 25 // ±250 ms
  const prefix = new Float64Array(frames + 1)
  for (let f = 0; f < frames; f++) prefix[f + 1] = prefix[f] + raw[f]
  for (let f = 0; f < frames; f++) {
    const lo = Math.max(0, f - W), hi = Math.min(frames, f + W + 1)
    onset[f] = Math.max(0, raw[f] - (prefix[hi] - prefix[lo]) / (hi - lo))
  }

  // ---- Tempo: autocorrelation over 70–190 BPM, gently preferring ~120 ----
  const minLag = Math.floor(60 / 190 / HOP_S)
  const maxLag = Math.ceil(60 / 70 / HOP_S)
  const ac = (lag: number) => {
    let s = 0
    for (let f = 0; f + lag < frames; f++) s += onset[f] * onset[f + lag]
    return s / Math.max(1, frames - lag)
  }
  const r: number[] = []
  for (let L = 0; L <= maxLag * 2 + 1; L++) r[L] = L >= minLag ? ac(L) : 0
  let bestLag = 50, bestScore = -1
  for (let L = minLag; L <= maxLag; L++) {
    const bpm = 60 / (L * HOP_S)
    const prior = Math.exp(-0.5 * (Math.log2(bpm / 120) / 0.9) ** 2)
    const score = (r[L] + 0.5 * (r[2 * L] ?? 0)) * prior
    if (score > bestScore) { bestScore = score; bestLag = L }
  }
  // Parabolic refinement for a fractional period
  const y0 = r[bestLag - 1] ?? 0, y1 = r[bestLag], y2 = r[bestLag + 1] ?? 0
  const denom = y0 - 2 * y1 + y2
  const period = bestScore > 0 && denom !== 0 ? bestLag + Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / denom)) : 50

  // ---- Beats: best path of onsets spaced about one period apart (Ellis-style DP) ----
  let mean = 0
  for (let f = 0; f < frames; f++) mean += onset[f]
  mean /= Math.max(1, frames)
  let variance = 0
  for (let f = 0; f < frames; f++) variance += (onset[f] - mean) ** 2
  const sd = Math.sqrt(variance / Math.max(1, frames)) || 1
  const score = new Float64Array(frames)
  const back = new Int32Array(frames).fill(-1)
  const minGap = Math.max(1, Math.round(period / 2)), maxGap = Math.round(period * 2)
  for (let t = 0; t < frames; t++) {
    let best = -Infinity, arg = -1
    for (let tau = t - maxGap; tau <= t - minGap; tau++) {
      if (tau < 0) continue
      const v = score[tau] - TIGHTNESS * Math.log((t - tau) / period) ** 2
      if (v > best) { best = v; arg = tau }
    }
    score[t] = onset[t] / sd + (arg >= 0 ? Math.max(0, best) : 0)
    back[t] = arg >= 0 && best > 0 ? arg : -1
  }
  let end = Math.max(0, frames - 1)
  for (let t = Math.max(0, frames - Math.ceil(period)); t < frames; t++) if (score[t] > score[end]) end = t
  const beatFrames: number[] = []
  for (let t = end; t >= 0; t = back[t]) beatFrames.unshift(t)
  const beats = beatFrames.map((x) => x * HOP_S * 1000)
  // Average spacing over the whole song is finer than one frame; fall back to the
  // median if the tracker skipped beats (spacing far from typical).
  const intervals = beats.slice(1).map((b, i) => b - beats[i])
  const median = intervals.length ? percentile(intervals, 50) : period * HOP_S * 1000
  const span = beats.length > 1 ? (beats[beats.length - 1] - beats[0]) / (beats.length - 1) : median
  const beatMs = Math.abs(span - median) < median * 0.03 ? span : median

  // ---- Bars: which of the 4 beat positions carries the most bass hits ----
  let barOffset = 0, barScore = -1
  for (let j = 0; j < 4; j++) {
    let s = 0
    for (let k = j; k < beatFrames.length; k += 4) s += rawLow[Math.round(beatFrames[k])] ?? 0
    if (s > barScore) { barScore = s; barOffset = j }
  }
  const downbeats = beats.filter((_, k) => k >= barOffset && (k - barOffset) % 4 === 0)

  // ---- Section energy per 4-bar phrase ----
  const lengthMs = (buf.length / sr) * 1000
  const barMs = beatMs * 4
  const rmsDb = (a: number, b: number) => {
    const fa = Math.max(0, Math.floor(a / 1000 / HOP_S)), fb = Math.min(frames, Math.ceil(b / 1000 / HOP_S))
    let s = 0
    for (let f = fa; f < fb; f++) s += eFull[f]
    return 10 * Math.log10(1e-9 + s / Math.max(1, fb - fa))
  }
  const phraseStarts = downbeats.filter((_, i) => i % 4 === 0)
  if (!phraseStarts.length || phraseStarts[0] > 0) phraseStarts.unshift(0)
  const phrases = phraseStarts.map((start, i) => {
    const end = i + 1 < phraseStarts.length ? phraseStarts[i + 1] : lengthMs
    return { start, end, db: rmsDb(start, end) }
  }).filter((p) => p.end - p.start > barMs / 4)
  const lo = percentile(phrases.map((p) => p.db), 10)
  const hi = percentile(phrases.map((p) => p.db), 95)
  const norm = (db: number) => Math.max(0, Math.min(1, (db - lo) / Math.max(1e-6, hi - lo)))
  const levelOf = (e: number): EnergyLevel => (e < 0.4 ? 'low' : e < 0.75 ? 'mid' : 'high')

  const sections: Section[] = []
  for (const p of phrases) {
    const energy = norm(p.db)
    const level = levelOf(energy)
    const last = sections[sections.length - 1]
    if (last && last.level === level) {
      const w1 = last.endMs - last.startMs, w2 = p.end - p.start
      last.energy = (last.energy * w1 + energy * w2) / (w1 + w2)
      last.endMs = p.end
    } else {
      sections.push({ startMs: p.start, endMs: p.end, level, energy, drop: false })
    }
  }
  for (let i = 1; i < sections.length; i++) {
    const prev = sections[i - 1], s = sections[i]
    s.drop = s.level === 'high' && prev.level !== 'high' && s.energy - prev.energy > 0.25
  }
  if (sections.length) {
    sections[0].startMs = 0
    sections[sections.length - 1].endMs = lengthMs
  }

  // ---- Accents: strongest onset peaks, at least 250 ms apart ----
  const threshold = percentile(Array.from(onset).filter((v) => v > 0), 97)
  const accents: number[] = []
  for (let f = 15; f < frames - 15; f++) {
    const v = onset[f]
    if (v < threshold || v <= 0) continue
    let peak = true
    for (let k = f - 15; k <= f + 15 && peak; k++) if (onset[k] > v) peak = false
    const ms = f * HOP_S * 1000
    if (peak && (!accents.length || ms - accents[accents.length - 1] >= 250)) accents.push(ms)
  }

  return { bpm: 60000 / beatMs, beatMs, beats, downbeats, sections, accents }
}
