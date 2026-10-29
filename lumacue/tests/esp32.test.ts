import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { buildFirmware, buildFirmwareForAll } from '@/lib/show/firmware-bundle'
import { compileBenchCues, parseCueTable } from '@/lib/show/bench'
import { clip, FIRMWARE_DIR, project, readFirmware, tableOf, ZONE_IDS } from './helpers/fixtures'

const ESP32_DIR = path.resolve(FIRMWARE_DIR, '..', 'esp32')
const readEsp = (rel: string) => readFileSync(path.join(ESP32_DIR, rel), 'utf8').replace(/\r\n/g, '\n')
const bench = (rel: string) => readFirmware(rel).replace(/\r\n/g, '\n')

/** The text of a C function, from its signature to the closing brace at column 0. */
function fn(src: string, signature: string) {
  const start = src.indexOf(signature)
  if (start < 0) throw new Error(`${signature} not found`)
  return src.slice(start, src.indexOf('\n}\n', start) + 2)
}

const esp32Templates = () => ({
  baseIno: readEsp('base/base.ino'),
  baseProtocol: readEsp('base/lumacue_protocol.h'),
  costumeIno: readEsp('costume/costume.ino'),
  costumeProtocol: readEsp('costume/lumacue_protocol.h'),
})

describe('ESP32 firmware shares the bench rules (so the preview and simulator apply)', () => {
  const benchCostume = bench('test_costume/test_costume.ino')
  const espCostume = readEsp('costume/costume.ino')
  const benchBase = bench('base_station/base_station.ino')
  const espBase = readEsp('base/base.ino')

  it('renders cues with identical code', () => {
    for (const sig of ['uint8_t zoneOf(uint8_t i) {', 'void applyCue(const Cue& c, uint32_t t) {', 'void render() {']) {
      // The bench zoneOf has a 5 mm branch; compare the strip branch only.
      if (sig.startsWith('uint8_t zoneOf')) {
        expect(fn(espCostume, sig)).toContain('if (i < ZONE_A_LEDS + ZONE_B_LEDS) return 1;')
        continue
      }
      expect(fn(espCostume, sig)).toBe(fn(benchCostume, sig))
    }
  })

  it('runs the same sync state machine', () => {
    for (const sig of ['void beginRun(const Packet& p, bool late) {', 'void correctClock(const Packet& p) {', 'void onPacket(const Packet& p) {']) {
      expect(fn(espCostume, sig)).toBe(fn(benchCostume, sig))
    }
  })

  it('takes the same serial commands and prints the same lines', () => {
    for (const sig of ['void cmdStart(uint32_t fromMs = 0) {', 'void cmdMusicSync(uint32_t musicMs) {', 'void cmdStatus() {', 'void handleLine(const char* s) {']) {
      expect(fn(espBase, sig)).toBe(fn(benchBase, sig))
    }
  })

  it('uses the same 10-byte packet', () => {
    const packet = (h: string) => h.slice(h.indexOf('enum PacketType'))
    expect(packet(readEsp('costume/lumacue_protocol.h'))).toBe(packet(bench('test_costume/lumacue_protocol.h')))
    expect(readEsp('base/lumacue_protocol.h')).toBe(readEsp('costume/lumacue_protocol.h'))
  })
})

describe('ESP32 firmware download', () => {
  const p = project([clip({ durationMs: 3000 }), clip({ startMs: 3000, effect: 'chase', color: '#00FF00' })], { lengthMs: 42000 })

  it('fills in the ESP32 sketches (strip only) with the show, length, zones and brightness', () => {
    const files = buildFirmware(esp32Templates(), p, ZONE_IDS, 0, '5mm', new Date(), { zoneLeds: [30, 15, 30], brightnessPct: 40 }, 'esp32')
    expect(files.map((f) => f.path)).toEqual(['base/base.ino', 'base/lumacue_protocol.h', 'costume/costume.ino', 'costume/lumacue_protocol.h', 'README.txt'])
    const costume = files[2].text
    expect(costume).toContain('#define OUTPUT_MODE MODE_STRIP') // 5mm request ignored
    expect(costume).toContain('constexpr uint8_t ZONE_A_LEDS = 30, ZONE_B_LEDS = 15, ZONE_C_LEDS = 30;')
    expect(costume).toMatch(/const uint32_t SHOW_LENGTH_MS\s*= 42000;/)
    expect(files[0].text).toMatch(/const uint32_t SHOW_LENGTH_MS\s*= 42000;/)
    expect(parseCueTable(costume)).toEqual(tableOf(compileBenchCues(p, ZONE_IDS, 0, 'strip').cues))
    expect(files[4].text).toContain('ESP32 Dev Module')
  })

  it('bundles all dancers with ESP32 folder names', () => {
    const files = buildFirmwareForAll(esp32Templates(), { ...p, dancers: 2 }, ZONE_IDS, 'strip', new Date(), undefined, 'esp32')
    expect(files.map((f) => f.path)).toEqual([
      'base/base.ino', 'base/lumacue_protocol.h',
      'dancer_01/costume/costume.ino', 'dancer_01/costume/lumacue_protocol.h',
      'dancer_02/costume/costume.ino', 'dancer_02/costume/lumacue_protocol.h',
      'README.txt',
    ])
  })
})
