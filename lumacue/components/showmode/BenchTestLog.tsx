'use client'
import { useState } from 'react'
import { BENCH_TESTS, benchResultsMarkdown } from '@/lib/show/bench-tests'
import type { BenchResultStatus } from '@/lib/show/bench-tests'
import { useBenchLogStore } from '@/store/useBenchLogStore'
import { useCostumeStore } from '@/store/useCostumeStore'

const input = 'bg-black/40 border border-white/10 rounded px-1.5 py-1 text-white text-[11px] placeholder:text-white/20 focus:outline-none focus:border-purple-500/50'
const btn = 'px-2.5 py-1.5 rounded-md border text-[11px] font-mono transition-all'
const btnIdle = `${btn} bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white`

/**
 * Bench test log: tick off T1–T12 (and E1–E5 for the ESP32) while testing,
 * then copy the filled-in Results table into firmware/bench_sync_test/README.md.
 */
export default function BenchTestLog({ onClose }: { onClose: () => void }) {
  const { results, setResult, clearStatus } = useBenchLogStore()
  const { baseDriftMs, baseDriftPpm, musicSync } = useCostumeStore()
  const [copied, setCopied] = useState<'' | 'ok' | 'failed'>('')
  const [showEsp32, setShowEsp32] = useState(Object.keys(results).some((id) => id.startsWith('E')))

  const tests = BENCH_TESTS.filter((t) => showEsp32 || t.id.startsWith('T'))
  const done = tests.filter((t) => results[t.id]?.status).length
  const failed = tests.filter((t) => results[t.id]?.status === 'fail').length

  const copy = () => {
    const done = (state: 'ok' | 'failed') => {
      setCopied(state)
      setTimeout(() => setCopied(''), 2500)
    }
    // The clipboard can be blocked (permissions, non-localhost http): say so rather than fail silently.
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(benchResultsMarkdown(results, tests.map((t) => t.id))))
      .then(() => done('ok'), () => done('failed'))
  }

  // T12 can take the live reading from Show Mode.
  const driftReading = baseDriftMs === null ? null : musicSync ? `sync on: ${baseDriftMs > 0 ? '+' : ''}${baseDriftMs} ms` : `sync off: ${baseDriftPpm ?? '?'} ppm (${baseDriftMs > 0 ? '+' : ''}${baseDriftMs} ms)`

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-full overflow-y-auto rounded-xl border border-white/10 bg-[#0f0f0f] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1 gap-3">
          <h4 className="text-white font-semibold">Bench test log</h4>
          <div className="flex gap-2 items-center">
            <span className={`text-[10px] font-mono ${failed ? 'text-red-300' : 'text-white/40'}`}>{done}/{tests.length} done{failed ? ` · ${failed} failed` : ''}</span>
            <label className="flex items-center gap-1 text-[10px] font-mono text-white/40"><input type="checkbox" checked={showEsp32} onChange={(e) => setShowEsp32(e.target.checked)} className="accent-purple-500" />ESP32 tests</label>
            <button className={btnIdle} onClick={copy}>{copied === 'ok' ? 'Copied ✓' : copied === 'failed' ? "Couldn't copy: clipboard blocked" : 'Copy results table'}</button>
            <button className={btnIdle} onClick={onClose}>Close</button>
          </div>
        </div>
        <p className="text-white/40 text-[11px] mb-3">
          Procedures: <code>firmware/bench_sync_test/README.md</code> §4{showEsp32 ? ' and firmware/esp32/README.md' : ''}. Kept in this browser; <b>Copy results table</b> and paste it over §5 Results in the README.
        </p>
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-white/30 text-[10px] font-mono text-left">
              <th className="pb-1 pr-2 font-normal">#</th>
              <th className="pb-1 pr-2 font-normal">TEST · PASS IF</th>
              <th className="pb-1 pr-2 font-normal">RESULT</th>
              <th className="pb-1 pr-2 font-normal">MODE</th>
              <th className="pb-1 font-normal">NUMBERS / NOTES</th>
            </tr>
          </thead>
          <tbody>
            {tests.map((t) => {
              const r = results[t.id]
              return (
                <tr key={t.id} className="border-t border-white/5 align-top">
                  <td className="py-1.5 pr-2 font-mono text-white/60">{t.id}</td>
                  <td className="py-1.5 pr-2 text-white/70">{t.title}<div className="text-white/30 text-[10px]">{t.passIf}</div></td>
                  <td className="py-1.5 pr-2 whitespace-nowrap">
                    {(['pass', 'partial', 'fail'] as BenchResultStatus[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => (r?.status === s ? clearStatus(t.id) : setResult(t.id, { status: s }))}
                        className={`mr-1 px-1.5 py-0.5 rounded border font-mono text-[10px] ${
                          r?.status === s
                            ? s === 'pass' ? 'bg-green-500/25 border-green-500/50 text-green-200' : s === 'fail' ? 'bg-red-500/25 border-red-500/50 text-red-200' : 'bg-yellow-500/20 border-yellow-500/40 text-yellow-200'
                            : 'border-white/10 text-white/35 hover:text-white/70'
                        }`}
                        aria-label={`${t.id} ${s}`}
                      >
                        {s === 'pass' ? '✓' : s === 'fail' ? '✕' : '~'}
                      </button>
                    ))}
                  </td>
                  <td className="py-1.5 pr-2"><input value={r?.mode ?? ''} placeholder="5 mm / strip" onChange={(e) => setResult(t.id, { mode: e.target.value })} className={`${input} w-24`} aria-label={`${t.id} mode`} /></td>
                  <td className="py-1.5">
                    <div className="flex gap-1">
                      <input value={r?.notes ?? ''} onChange={(e) => setResult(t.id, { notes: e.target.value })} className={`${input} flex-1 min-w-0`} aria-label={`${t.id} notes`} />
                      {(t.id === 'T12' || t.id === 'E3') && driftReading && (
                        <button className={`${btnIdle} whitespace-nowrap py-0.5`} title="Add the live base-vs-music reading from Show Mode" onClick={() => setResult(t.id, { notes: [r?.notes, driftReading].filter(Boolean).join('; ') })}>
                          + {driftReading}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
