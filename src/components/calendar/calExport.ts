// Getting the calendar out: which items go, and the two files they go in.
//
// Runs in the browser, so every time is written in the coach's own clock —
// the same clock the calendar on his screen uses.

import type { CalItem, CalTeam } from '@/lib/calendarModel'
import { formatRange, isAllDayish, toYmd } from '@/lib/calendarMath'
import { audienceBadge, isFieldTime, itemTitle, kindMeta, layerOf, teamLabel, type CalLayer } from './calShared'

export interface ExportChoice {
  teams: CalTeam[]
  layers: CalLayer[]
  fields: boolean
}

export function pickForExport(items: CalItem[], c: ExportChoice): CalItem[] {
  return items
    .filter((it) => {
      if (it.source === 'availability') return c.layers.includes('availability') && it.kind === 'unavailable'
      if (isFieldTime(it)) return c.fields && c.teams.includes(it.team)
      return c.layers.includes(layerOf(it)) && c.teams.includes(it.team)
    })
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
}

// ── The .ics file: opens in Google, Apple and Outlook calendars ──────────────

const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const utc = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const dateOnly = (d: Date) => toYmd(d).replace(/-/g, '')

/** Lines longer than 75 characters are folded, as the format asks. */
function fold(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = []
  for (let i = 0; i < line.length; i += 74) parts.push((i ? ' ' : '') + line.slice(i, i + 74))
  return parts.join('\r\n')
}

export function toIcs(items: CalItem[], name: string): string {
  const stamp = utc(new Date().toISOString())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Green Hope Falcons Lacrosse//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsText(name)}`,
  ]
  for (const it of items) {
    const allDay = it.allDay || isAllDayish(it)
    const desc = [kindMeta(it).label, teamLabel(it.team), it.notes ?? ''].filter(Boolean).join(' · ')
    lines.push(
      'BEGIN:VEVENT',
      `UID:${it.key.replace(/[^a-zA-Z0-9:_-]/g, '')}@greenhopelacrosse.com`,
      `DTSTAMP:${stamp}`,
      allDay ? `DTSTART;VALUE=DATE:${dateOnly(new Date(it.startsAt))}` : `DTSTART:${utc(it.startsAt)}`,
      allDay ? `DTEND;VALUE=DATE:${dateOnly(new Date(it.endsAt))}` : `DTEND:${utc(it.endsAt)}`,
      `SUMMARY:${icsText(itemTitle(it))}`,
    )
    if (it.location) lines.push(`LOCATION:${icsText(it.location)}`)
    if (desc) lines.push(`DESCRIPTION:${icsText(desc)}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

// ── The spreadsheet ──────────────────────────────────────────────────────────

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

export function toCsv(items: CalItem[]): string {
  const head = ['Date', 'Time', 'What', 'Type', 'Team', 'Location', 'Who sees it', 'Notes']
  const rows = items.map((it) => {
    const allDay = it.allDay || isAllDayish(it)
    const s = new Date(it.startsAt)
    return [
      s.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
      allDay ? 'All day' : formatRange(it.startsAt, it.endsAt, false),
      itemTitle(it),
      kindMeta(it).label,
      teamLabel(it.team),
      it.location ?? '',
      audienceBadge(it),
      it.notes ?? '',
    ]
  })
  return [head, ...rows].map((r) => r.map((v) => csvCell(String(v))).join(',')).join('\r\n')
}

export function download(text: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
