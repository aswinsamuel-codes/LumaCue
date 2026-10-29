import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { BENCH_TESTS, benchResultsMarkdown } from '@/lib/show/bench-tests'
import { FIRMWARE_DIR } from './helpers/fixtures'

describe('bench test log', () => {
  it('lists every test in the bench README', () => {
    const readme = readFileSync(path.join(FIRMWARE_DIR, 'README.md'), 'utf8')
    const inReadme = [...readme.matchAll(/^\| (T\d+) \| [^|\s]/gm)].map((m) => m[1])
    expect(BENCH_TESTS.filter((t) => t.id.startsWith('T')).map((t) => t.id)).toEqual([...new Set(inReadme)])
  })

  it('writes the README results table, keeping empty rows and escaping pipes', () => {
    const md = benchResultsMarkdown(
      { T1: { status: 'pass', date: '2026-11-01', mode: '5 mm', notes: 'both "Radio OK"' }, T6: { status: 'fail', date: '2026-11-01', mode: 'strip', notes: 'err 120 ms | FastLED?\nretry' } },
      ['T1', 'T2', 'T6'],
    )
    expect(md.split('\n')).toEqual([
      '| # | Date | Mode | Result | Numbers / notes |',
      '|---|---|---|---|---|',
      '| T1 | 2026-11-01 | 5 mm | Pass | both "Radio OK" |',
      '| T2 | | | | |',
      '| T6 | 2026-11-01 | strip | FAIL | err 120 ms \\| FastLED? retry |',
    ])
  })
})
