'use client'
import { useEffect, useRef } from 'react'
import { useDashboardStore, LogType } from '@/store/useDashboardStore'

const LOG_COLORS: Record<LogType, string> = {
  INFO: 'text-blue-400',
  WARN: 'text-yellow-400',
  ERROR: 'text-red-400',
  ACTION: 'text-purple-400',
  SYNC: 'text-green-400',
}

const LOG_BG: Record<LogType, string> = {
  INFO: 'bg-blue-500/10',
  WARN: 'bg-yellow-500/10',
  ERROR: 'bg-red-500/10',
  ACTION: 'bg-purple-500/10',
  SYNC: 'bg-green-500/10',
}

export default function LogPanel() {
  const { logs } = useDashboardStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="flex flex-col h-full rounded-xl border border-white/10 bg-black/60 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-black/40">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white/70 text-xs font-mono font-semibold tracking-widest">SYSTEM LOG</span>
        </div>
        <span className="text-white/20 text-xs font-mono">{logs.length} entries</span>
      </div>

      {/* Terminal body */}
      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-0.5 scrollbar-thin scrollbar-thumb-white/10">
        {logs.map((log) => (
          <div
            key={log.id}
            className={`flex items-start gap-2 px-2 py-1 rounded ${LOG_BG[log.type]} group animate-fade-in`}
          >
            <span className="text-white/25 shrink-0">[{log.time}]</span>
            <span className={`shrink-0 font-bold ${LOG_COLORS[log.type]}`}>[{log.type}]</span>
            <span className="text-white/70 group-hover:text-white/90 transition-colors">{log.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-white/5 bg-black/40 flex items-center gap-2">
        <span className="text-green-400 font-mono text-xs">▶</span>
        <span className="text-white/20 font-mono text-xs">pov.stage ~ ready</span>
        <span className="w-1.5 h-3 bg-white/40 animate-pulse ml-0.5" />
      </div>
    </div>
  )
}
