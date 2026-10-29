/**
 * Cue sheet for rehearsals: every clip in show order with its section, as CSV
 * (opens in Excel / Google Sheets, prints on paper for the dancers).
 */
import { ALL_DANCERS, EFFECT_BY_ID, formatShowTime } from '@/lib/show/model'
import type { ShowProject } from '@/lib/show/model'

export interface CueSheetZone {
  id: string
  name: string
}

const csvCell = (v: string | number) => {
  let s = String(v)
  // Names starting with = + - @ would run as formulas in Excel / Sheets: keep them as text.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function cueSheetCsv(project: ShowProject, zones: CueSheetZone[]): string {
  const zoneName = new Map(zones.map((z) => [z.id, z.name]))
  const sectionAt = (t: number) =>
    (project.sections ?? []).filter((s) => t >= s.startMs && t < s.endMs).map((s) => s.name).join(' + ')
  const rows = [...project.clips]
    .filter((c) => c.startMs < project.lengthMs && (c.track === ALL_DANCERS || c.track < project.dancers))
    .sort((a, b) => a.startMs - b.startMs || a.track - b.track)
    .map((c) => {
      const effect = EFFECT_BY_ID[c.effect]
      return [
        formatShowTime(c.startMs),
        formatShowTime(Math.min(project.lengthMs, c.startMs + c.durationMs)),
        sectionAt(c.startMs),
        c.track === ALL_DANCERS ? 'All dancers' : `Dancer ${c.track + 1}`,
        effect?.label ?? c.effect,
        effect?.noColor ? '' : effect?.usesColor2 ? `${c.color} → ${c.color2}` : c.color,
        c.zones.length ? c.zones.map((z) => zoneName.get(z) ?? z).join(' + ') : 'Whole costume',
      ]
    })
  return [
    `# ${project.name} · ${formatShowTime(project.lengthMs)} · ${project.dancers} dancers${project.audioName ? ` · music: ${project.audioName}` : ''}`,
    ['From', 'To', 'Section', 'Who', 'Effect', 'Colour', 'Zones'].join(','),
    ...rows.map((r) => r.map(csvCell).join(',')),
  ].map((line, i) => (i === 0 ? csvCell(line) : line)).join('\r\n') + '\r\n'
}
