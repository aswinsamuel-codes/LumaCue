/**
 * Show-night checklist for Show Mode: everything that should be green before
 * ARM, in one place. Pure, so it can be tested without the UI.
 */

export type CheckLevel = 'ok' | 'warn' | 'fail'

export interface CheckItem {
  id: string
  level: CheckLevel
  text: string
}

export interface ChecklistInput {
  baseKind: 'usb' | 'simulator' | null
  baseShowLengthMs: number | null
  showLengthMs: number
  firmware: ('ok' | 'stale' | 'never')[]   // per dancer
  showAudioName: string | null
  loadedAudioName: string | null
  musicSync: boolean
  speakerDelayMs: number
  worstCaseMa: number                       // one costume at full white, at the brightness cap
  currentLimitMa: number
}

const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${((ms % 60000) / 1000).toFixed(1).padStart(4, '0')}`

export function showChecklist(i: ChecklistInput): CheckItem[] {
  const items: CheckItem[] = []

  items.push(
    i.baseKind === 'usb'
      ? { id: 'base', level: 'ok', text: 'Base station connected over USB' }
      : i.baseKind === 'simulator'
        ? { id: 'base', level: 'warn', text: 'Simulator connected: no costumes are being controlled' }
        : { id: 'base', level: 'fail', text: 'Base station not connected' },
  )

  if (i.baseKind) {
    if (i.baseShowLengthMs === null) items.push({ id: 'base-length', level: 'warn', text: "Base station hasn't reported its show length yet" })
    else if (Math.abs(i.baseShowLengthMs - i.showLengthMs) > 100) items.push({ id: 'base-length', level: 'fail', text: `Base firmware is for a ${fmt(i.baseShowLengthMs)} show, this one is ${fmt(i.showLengthMs)}` })
    else items.push({ id: 'base-length', level: 'ok', text: 'Base firmware matches the show length' })
  }

  const stale = i.firmware.filter((f) => f !== 'ok').length
  items.push(
    stale === 0
      ? { id: 'firmware', level: 'ok', text: `All ${i.firmware.length} costumes have firmware for this show` }
      : { id: 'firmware', level: 'fail', text: `${stale} of ${i.firmware.length} costumes need firmware for this show (download from Show Studio and upload)` },
  )

  if (!i.showAudioName) items.push({ id: 'music', level: 'warn', text: 'No music in this show' })
  else if (!i.loadedAudioName) items.push({ id: 'music', level: 'fail', text: `Music "${i.showAudioName}" isn't loaded: load it in Show Studio` })
  else if (i.loadedAudioName !== i.showAudioName) items.push({ id: 'music', level: 'warn', text: `Loaded music "${i.loadedAudioName}" isn't the show's "${i.showAudioName}"` })
  else items.push({ id: 'music', level: 'ok', text: `Music loaded: ${i.loadedAudioName}` })

  items.push(
    i.musicSync
      ? { id: 'sync', level: 'ok', text: 'Music sync on' }
      : { id: 'sync', level: 'warn', text: 'Music sync off: costumes follow the base clock, which can drift from the music' },
  )

  items.push(
    i.speakerDelayMs > 0
      ? { id: 'speaker', level: 'ok', text: `Speaker delay ${i.speakerDelayMs} ms` }
      : { id: 'speaker', level: 'warn', text: 'Speaker delay 0 ms: measure it at the venue if the sound goes through a mixer, wireless or Bluetooth' },
  )

  items.push(
    i.worstCaseMa > i.currentLimitMa
      ? { id: 'power', level: 'warn', text: `Full white could draw ~${Math.round(i.worstCaseMa)} mA per costume (limit ${i.currentLimitMa} mA): lower the brightness cap` }
      : { id: 'power', level: 'ok', text: `Power: worst case ~${Math.round(i.worstCaseMa)} mA per costume` },
  )

  return items
}

// Planning figures, not measurements: a WS2812B draws up to ~60 mA at full
// white and roughly a third of that showing one colour. Used by Costume setup too.
export const MA_FULL_WHITE = 60
export const MA_ONE_COLOUR = 20
export const CURRENT_LIMIT_MA = 1000 // firmware cap proposed in the hardware review

export function worstCaseMilliamps(totalLeds: number, brightnessPct: number) {
  return totalLeds * MA_FULL_WHITE * (brightnessPct / 100)
}
