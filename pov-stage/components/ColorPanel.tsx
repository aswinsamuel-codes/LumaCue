'use client'
import { useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import { useDashboardStore } from '@/store/useDashboardStore'

const QUICK_COLORS = [
  '#FF0000', '#FF6B00', '#FFD700', '#00FF88',
  '#00BFFF', '#3B82F6', '#A855F7', '#EC4899',
  '#FFFFFF', '#FF00FF',
]

export default function ColorPanel() {
  const { activeColor, setActiveColor, saveFavoriteColor, favoriteColors, removeFavoriteColor, addLog } = useDashboardStore()
  const [saved, setSaved] = useState(false)

  const handleQuickColor = (color: string) => {
    setActiveColor(color)
    addLog('INFO', `Quick color selected: ${color.toUpperCase()}`)
  }

  const handleFavorite = () => {
    saveFavoriteColor(activeColor)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-sm tracking-wide">Color Control</h3>
        <div
          className="w-6 h-6 rounded-md border border-white/20"
          style={{ background: activeColor, boxShadow: `0 0 12px ${activeColor}60` }}
        />
      </div>

      {/* Color picker */}
      <div className="mb-4 [&_.react-colorful]:w-full [&_.react-colorful]:rounded-lg [&_.react-colorful]:overflow-hidden [&_.react-colorful__saturation]:rounded-t-lg [&_.react-colorful__last-control]:rounded-b-lg">
        <HexColorPicker color={activeColor} onChange={setActiveColor} />
      </div>

      {/* Hex input */}
      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          value={activeColor.toUpperCase()}
          onChange={(e) => {
            const v = e.target.value
            if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setActiveColor(v)
          }}
          className="flex-1 bg-black/40 border border-white/10 rounded-md px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-purple-500/50"
        />
        <button
          onClick={handleFavorite}
          className={`p-2 rounded-md border transition-all duration-200 active:scale-90 ${saved ? 'border-pink-500 bg-pink-500/20 text-pink-400' : 'border-white/10 bg-white/5 text-white/40 hover:text-pink-400 hover:border-pink-500/50'}`}
        >
          <svg className="w-4 h-4" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

      {/* Quick colors */}
      <div className="mb-3">
        <p className="text-white/30 text-xs mb-2 font-mono">QUICK COLORS</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => handleQuickColor(c)}
              className={`w-7 h-7 rounded-md border-2 transition-all duration-150 hover:scale-110 active:scale-90 ${activeColor === c ? 'border-white scale-110' : 'border-transparent'}`}
              style={{ background: c, boxShadow: activeColor === c ? `0 0 10px ${c}` : 'none' }}
            />
          ))}
        </div>
      </div>

      {/* Favorites */}
      {favoriteColors.length > 0 && (
        <div>
          <p className="text-white/30 text-xs mb-2 font-mono">FAVORITES</p>
          <div className="flex flex-wrap gap-2">
            {favoriteColors.map((c) => (
              <div key={c} className="relative group">
                <button
                  onClick={() => { setActiveColor(c); addLog('INFO', `Favorite color applied: ${c.toUpperCase()}`) }}
                  className="w-7 h-7 rounded-md border border-white/20"
                  style={{ background: c, boxShadow: `0 0 6px ${c}60` }}
                />
                <button
                  onClick={() => removeFavoriteColor(c)}
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] hidden group-hover:flex items-center justify-center"
                >×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
