import { readFileSync } from 'node:fs'
import path from 'node:path'
import { buildLayout } from '@/lib/show/body'
import type { Placement } from '@/lib/show/body'
import { ALL_DANCERS } from '@/lib/show/model'
import type { Clip, ShowProject } from '@/lib/show/model'
import { renderDancer } from '@/lib/show/render'

export const FIRMWARE_DIR = path.resolve(__dirname, '..', '..', '..', 'firmware', 'bench_sync_test')
export const readFirmware = (rel: string) => readFileSync(path.join(FIRMWARE_DIR, rel), 'utf8')

export const templates = () => ({
  baseIno: readFirmware('base_station/base_station.ino'),
  baseProtocol: readFirmware('base_station/lumacue_protocol.h'),
  costumeIno: readFirmware('test_costume/test_costume.ino'),
  costumeProtocol: readFirmware('test_costume/lumacue_protocol.h'),
})

export const ZONE_IDS = ['a', 'b', 'c']

let n = 0
export const clip = (over: Partial<Clip>): Clip => ({
  id: `c${n++}`, track: ALL_DANCERS, startMs: 0, durationMs: 1000,
  effect: 'solid', color: '#FF0000', color2: '#000000', zones: [], speed: 50, ...over,
})

export const project = (clips: Clip[], over: Partial<ShowProject> = {}): ShowProject => ({
  version: 1, name: 'Test', dancers: 2, lengthMs: 10000, audioName: null, clips, ...over,
})

/** The editor's preview, averaged per zone, for a bench-shaped costume (3 zones × 20 LEDs). */
export function editorZones(p: ShowProject, dancer: number) {
  const layout = buildLayout(ZONE_IDS.map((id) => ({ id, leds: 20, placement: 'belt' as Placement })))
  const frame = new Float32Array(layout.total * 3)
  return (t: number) => {
    renderDancer(p, layout, dancer, t, frame)
    return layout.zones.map((z) => {
      let r = 0, g = 0, b = 0
      for (let i = z.start; i < z.start + z.count; i++) { r += frame[i * 3]; g += frame[i * 3 + 1]; b += frame[i * 3 + 2] }
      return [r / z.count, g / z.count, b / z.count] as [number, number, number]
    })
  }
}

/** A stand-in for the Web Audio AudioBuffer, enough for analyzeAudio(). */
export function fakeAudioBuffer(samples: Float32Array, sampleRate: number) {
  return {
    sampleRate,
    length: samples.length,
    duration: samples.length / sampleRate,
    numberOfChannels: 1,
    getChannelData: () => samples,
  } as unknown as AudioBuffer
}

/** Kick-drum-like clicks at `bpm`, louder on bar starts, with a quiet first half and loud second half. */
export function clickTrack(bpm: number, seconds: number, sampleRate = 22050) {
  const s = new Float32Array(Math.round(seconds * sampleRate))
  const beat = 60 / bpm
  let k = 0
  for (let t = 0.1; t < seconds; t += beat, k++) {
    const loud = t > seconds / 2 ? 1 : 0.25
    const amp = (k % 4 === 0 ? 1 : 0.6) * loud
    const i0 = Math.round(t * sampleRate)
    for (let i = 0; i < 0.06 * sampleRate && i0 + i < s.length; i++) {
      const tt = i / sampleRate
      s[i0 + i] += amp * Math.sin(2 * Math.PI * 60 * tt) * Math.exp(-tt * 40)
    }
  }
  return s
}

/** Bench cues without the editor-only fields, as they appear in the C table. */
export const tableOf = (cues: { source: unknown; effect: unknown; section?: unknown }[]) =>
  cues.map((c) => Object.fromEntries(Object.entries(c).filter(([k]) => k !== 'source' && k !== 'effect' && k !== 'section')))
