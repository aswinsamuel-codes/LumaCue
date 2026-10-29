/**
 * The bench sync tests from firmware/bench_sync_test/README.md (T1–T12) and
 * firmware/esp32/README.md (E1–E5), for the bench test log in Show Mode.
 * Short titles and pass criteria only; the README has the full procedure.
 */

export interface BenchTest {
  id: string
  title: string
  passIf: string
}

export const BENCH_TESTS: BenchTest[] = [
  { id: 'T1', title: 'Radio check', passIf: 'Both print "Radio OK"' },
  { id: 'T2', title: 'Arm', passIf: 'Costume logs ARMED, zone A blinks' },
  { id: 'T3', title: 'Start + play', passIf: 'START run 1 at t=0..40, plays the show, then "show ended"' },
  { id: 'T4', title: 'Beacon error', passIf: 'err_ms settles within ±5 ms' },
  { id: 'T5', title: 'Sync on video', passIf: 'Offset ≤ 20 ms (≤ 5 frames at 240 fps)' },
  { id: 'T6', title: 'Free-running drift', passIf: 'Record the first err_ms after beacons come back' },
  { id: 'T7', title: 'Link loss', passIf: '"link lost - continuing on local clock", finishes alone' },
  { id: 'T8', title: 'Late join', passIf: 'LATE JOIN within ~0.5 s at the right point' },
  { id: 'T9', title: 'Blackout', passIf: 'Dark immediately, stays dark' },
  { id: 'T10', title: 'Range', passIf: 'Starts at 5/10/20 m; note where it fails' },
  { id: 'T11', title: 'Strip mode', passIf: 'T3–T6 pass with WS2812B; nothing hot' },
  { id: 'T12', title: 'Base clock vs music', passIf: 'Sync off: record ppm. Sync on: within ±20 ms' },
  { id: 'E1', title: 'ESP32: base + 1 costume', passIf: 'Same as the bench sketches' },
  { id: 'E2', title: 'ESP32: 3 costumes, 10 m, filmed', passIf: 'Within ±20 ms of each other' },
  { id: 'E3', title: 'ESP32: base clock vs music', passIf: 'Within ±20 ms with sync on' },
  { id: 'E4', title: 'ESP32: 3 min + 30 min idle on a bank', passIf: 'No brown-outs; bank stays on' },
  { id: 'E5', title: 'ESP32: Wi-Fi-heavy room', passIf: 'Beacons still arrive' },
]

export type BenchResultStatus = 'pass' | 'fail' | 'partial'

export interface BenchResult {
  status: BenchResultStatus
  date: string    // YYYY-MM-DD
  mode: string    // e.g. 5 mm, strip, ESP32
  notes: string
}

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\s*[\r\n]+\s*/g, ' ').trim()

/** The Results table of the bench README, filled in. Tests without a result keep empty cells. */
export function benchResultsMarkdown(results: Record<string, BenchResult>, ids = BENCH_TESTS.map((t) => t.id)) {
  const label: Record<BenchResultStatus, string> = { pass: 'Pass', fail: 'FAIL', partial: 'Partial' }
  return [
    '| # | Date | Mode | Result | Numbers / notes |',
    '|---|---|---|---|---|',
    ...ids.map((id) => {
      const r = results[id]
      return r ? `| ${id} | ${cell(r.date)} | ${cell(r.mode)} | ${label[r.status]} | ${cell(r.notes)} |` : `| ${id} | | | | |`
    }),
  ].join('\n')
}
