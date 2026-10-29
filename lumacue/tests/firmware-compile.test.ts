/**
 * End to end: auto-cue a song, export a dancer's firmware and compile it with
 * the real Arduino toolchain for the Nano. Skipped when arduino-cli isn't found
 * (set ARDUINO_CLI to its path, or install the Arduino IDE 2).
 */
import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { analyzeAudio } from '@/lib/show/analyze'
import { generateCues } from '@/lib/show/autocue'
import { buildFirmware } from '@/lib/show/firmware-bundle'
import { compileBenchCues } from '@/lib/show/bench'
import { clickTrack, fakeAudioBuffer, project, templates, ZONE_IDS } from './helpers/fixtures'

function findCli() {
  const candidates = [
    process.env.ARDUINO_CLI,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Arduino IDE', 'resources', 'app', 'lib', 'backend', 'resources', 'arduino-cli.exe'),
  ].filter(Boolean) as string[]
  return candidates.find((c) => existsSync(c))
}

const cli = findCli()
// ARDUINO_LIBRARIES overrides the folder with RF24 (and FastLED for the strip build).
const libs = process.env.ARDUINO_LIBRARIES ?? path.join(os.homedir(), 'Documents', 'Arduino', 'libraries')
const hasRf24 = existsSync(path.join(libs, 'RF24'))
const hasFastLed = existsSync(path.join(libs, 'FastLED'))

describe.skipIf(!cli || !hasRf24)('firmware compiles for the Arduino Nano', () => {
  const SR = 22050
  const a = analyzeAudio(fakeAudioBuffer(clickTrack(128, 180, SR), SR))
  const show = project(generateCues(a, 5, 180000, { style: 'energetic', palette: 'neon', stagger: true, accents: true }), { name: 'E2E 3-minute show', dancers: 5, lengthMs: 180000 })

  console.log(`E2E show: ${show.clips.length} clips -> ${compileBenchCues(show, ZONE_IDS, 2).cues.length} cues for dancer 3`)
  const compile = (output: '5mm' | 'strip') => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'lumacue-fw-'))
    for (const f of buildFirmware(templates(), show, ZONE_IDS, 2, output)) {
      mkdirSync(path.dirname(path.join(dir, f.path)), { recursive: true })
      writeFileSync(path.join(dir, f.path), f.text)
    }
    const run = (sketch: string) => execFileSync(cli!, ['compile', '-b', 'arduino:avr:nano:cpu=atmega328old', '--libraries', libs, path.join(dir, sketch)], { encoding: 'utf8' })
    return { costume: run('test_costume'), base: run('base_station') }
  }
  const flashPct = (log: string) => Number(/Sketch uses \d+ bytes \((\d+)%\)/.exec(log)?.[1])

  it('5 mm build fits in flash with a 3-minute auto-cued show', () => {
    const { costume, base } = compile('5mm')
    console.log(`5mm costume: ${/Sketch uses.*/.exec(costume)?.[0]}`)
    expect(flashPct(costume)).toBeLessThan(95)
    expect(flashPct(base)).toBeLessThan(95)
  }, 180000)

  it.skipIf(!hasFastLed)('WS2812B strip build fits too', () => {
    const { costume } = compile('strip')
    console.log(`strip costume: ${/Sketch uses.*/.exec(costume)?.[0]}`)
    expect(flashPct(costume)).toBeLessThan(95)
  }, 180000)
})
