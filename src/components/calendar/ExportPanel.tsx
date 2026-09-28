'use client'

import { useState } from 'react'
import { CAL_TEAMS, type CalItem, type CalTeam } from '@/lib/calendarModel'
import { addDays, toYmd, fromYmd } from '@/lib/calendarMath'
import { CAL_LAYERS, type CalLayer } from './calShared'
import { download, pickForExport, toCsv, toIcs } from './calExport'

type Range = 'view' | 'year' | 'custom'
type Format = 'pdf' | 'print' | 'ics' | 'csv'

const FORMATS: { key: Format; label: string; action: string; hint: string; staffOnly?: boolean }[] = [
  { key: 'pdf', label: 'PDF', action: 'Download PDF', hint: 'A file to save, send or print later.' },
  { key: 'print', label: 'Print', action: 'Print', hint: 'Opens the print page.', staffOnly: true },
  { key: 'ics', label: 'Calendar file', action: 'Download calendar file', hint: 'Opens in Google, Apple or Outlook calendar.' },
  { key: 'csv', label: 'Spreadsheet', action: 'Download spreadsheet', hint: 'Opens in Excel, Numbers or Google Sheets.' },
]

/** August to August: the school year the calendar is in. */
function schoolYear(d: Date): { from: Date; to: Date } {
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1
  return { from: new Date(y, 7, 1), to: new Date(y + 1, 7, 1) }
}

/**
 * Getting the calendar out: what is on screen, or any stretch of it, for
 * whichever calendars and kinds of thing are picked — as a PDF, a printout, a
 * file for a phone's calendar, or a spreadsheet.
 */
export function ExportPanel({
  view,
  teams: startTeams,
  layers: startLayers,
  endpoint = '/api/calendar',
  staff = true,
  onClose,
}: {
  /** What the calendar is showing now. */
  view: { from: Date; to: Date; label: string }
  teams: CalTeam[]
  layers: CalLayer[]
  /** Where the calendar is read from — the coaches' or a hub's. */
  endpoint?: string
  /** The staff can print and see who's out and open field time; a hub can't. */
  staff?: boolean
  onClose: () => void
}) {
  const formats = FORMATS.filter((f) => staff || !f.staffOnly)
  const [format, setFormat] = useState<Format>('pdf')
  const [range, setRange] = useState<Range>('view')
  const [from, setFrom] = useState(toYmd(view.from))
  const [to, setTo] = useState(toYmd(addDays(view.to, -1)))
  const [teams, setTeams] = useState<CalTeam[]>(startTeams)
  // The schedule itself by default; who's out and open field time only when asked for.
  const [layers, setLayers] = useState<CalLayer[]>(startLayers.filter((l) => l !== 'availability'))
  const [fields, setFields] = useState(false)
  const [layout, setLayout] = useState<'month' | 'list'>('month')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const window_ = () =>
    range === 'view'
      ? { from: view.from, to: view.to }
      : range === 'year'
        ? schoolYear(view.from)
        : { from: fromYmd(from), to: addDays(fromYmd(to), 1) }

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  async function load(): Promise<CalItem[] | null> {
    const w = window_()
    const res = await fetch(`${endpoint}${endpoint.includes('?') ? '&' : '?'}from=${encodeURIComponent(w.from.toISOString())}&to=${encodeURIComponent(w.to.toISOString())}`)
    const body = (await res.json().catch(() => null)) as { items?: CalItem[]; error?: string } | null
    if (!res.ok || !body?.items) {
      setError(body?.error ?? 'Couldn’t load the calendar.')
      return null
    }
    return pickForExport(body.items, { teams, layers, fields })
  }

  function print() {
    const w = window_()
    const q = new URLSearchParams({
      from: toYmd(w.from),
      to: toYmd(addDays(w.to, -1)),
      teams: teams.join(','),
      layers: layers.join(','),
      fields: fields ? '1' : '0',
      layout,
    })
    window.open(`/admin/calendar-print?${q}`, '_blank')
  }

  async function go() {
    const w = window_()
    setError(null)
    setDone(null)
    if (!(w.to > w.from)) return setError('The end date has to be after the start.')
    if (format === 'print') return print()
    setBusy(true)
    try {
      const items = await load()
      if (!items) return
      if (!items.length) return setError('Nothing on the calendar in that stretch.')
      const name = `falcons-calendar-${toYmd(w.from)}-to-${toYmd(addDays(w.to, -1))}`
      if (format === 'pdf') {
        const { savePdf } = await import('./calPdf')
        const label = range === 'view' ? view.label : `${toYmd(w.from)} to ${toYmd(addDays(w.to, -1))}`
        await savePdf(items, { from: w.from, to: w.to, layout, filename: `${name}${layout === 'list' ? '-list' : ''}.pdf`, label })
      } else if (format === 'ics') {
        download(toIcs(items, 'Green Hope Lacrosse'), `${name}.ics`, 'text/calendar')
      } else {
        download(toCsv(items), `${name}.csv`, 'text/csv;charset=utf-8')
      }
      setDone(`${items.length} ${items.length === 1 ? 'item' : 'items'} saved.`)
    } catch {
      setError('Something went wrong making the file. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const chip = (on: boolean) =>
    `min-h-8 px-3 rounded-full border text-xs font-bold ${on ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500'}`
  const picked = formats.find((f) => f.key === format) ?? formats[0]

  return (
    <>
      <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-gray-100">
        <h2 className="text-lg font-black flex-1">{staff ? 'Export & print' : 'Save the calendar'}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="w-10 h-10 -mr-2 rounded-full text-2xl leading-none text-gray-400 hover:text-gray-800 hover:bg-gray-100">
          &times;
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5">
        <section>
          <div className="field-label">As</div>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Format">
            {formats.map((f) => {
              const on = format === f.key
              return (
                <button
                  key={f.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setFormat(f.key)
                    setDone(null)
                    setError(null)
                  }}
                  className="min-h-11 rounded-xl border-2 px-3 text-sm font-bold transition-colors"
                  style={
                    on
                      ? { borderColor: 'var(--gh-green)', background: 'var(--gh-green)', color: '#fff' }
                      : { borderColor: 'var(--border)', color: 'var(--text-muted)' }
                  }
                >
                  {f.label}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-gray-500 mt-1.5">{picked.hint}</p>
        </section>

        <section>
          <div className="field-label">When</div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" aria-pressed={range === 'view'} onClick={() => setRange('view')} className={chip(range === 'view')}>
              {view.label}
            </button>
            <button type="button" aria-pressed={range === 'year'} onClick={() => setRange('year')} className={chip(range === 'year')}>
              Whole school year
            </button>
            <button type="button" aria-pressed={range === 'custom'} onClick={() => setRange('custom')} className={chip(range === 'custom')}>
              Pick dates
            </button>
          </div>
          {range === 'custom' && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label htmlFor="ex-from" className="field-label">From</label>
                <input id="ex-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="field" />
              </div>
              <div>
                <label htmlFor="ex-to" className="field-label">To</label>
                <input id="ex-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="field" />
              </div>
            </div>
          )}
        </section>

        <section>
          <div className="field-label">Calendars</div>
          <div className="flex flex-wrap gap-1.5">
            {CAL_TEAMS.map((t) => (
              <button key={t.key} type="button" aria-pressed={teams.includes(t.key)} onClick={() => setTeams((x) => toggle(x, t.key))} className={chip(teams.includes(t.key))}>
                {t.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="field-label">Include</div>
          <div className="flex flex-wrap gap-1.5">
            {CAL_LAYERS.filter((l) => staff || l.key !== 'availability').map((l) => (
              <button key={l.key} type="button" aria-pressed={layers.includes(l.key)} onClick={() => setLayers((x) => toggle(x, l.key))} className={chip(layers.includes(l.key))}>
                {l.key === 'availability' ? 'Who’s out' : l.label}
              </button>
            ))}
            {staff && (
              <button type="button" aria-pressed={fields} onClick={() => setFields((v) => !v)} className={chip(fields)}>
                Field Availability
              </button>
            )}
          </div>
        </section>

        {(format === 'pdf' || format === 'print') && (
          <section>
            <div className="field-label">Layout</div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" aria-pressed={layout === 'month'} onClick={() => setLayout('month')} className={chip(layout === 'month')}>
                Month pages
              </button>
              <button type="button" aria-pressed={layout === 'list'} onClick={() => setLayout('list')} className={chip(layout === 'list')}>
                List
              </button>
            </div>
          </section>
        )}
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        {done && <p className="text-sm text-green-700" role="status">{done}</p>}
      </div>

      <div className="px-5 py-3 border-t border-gray-100">
        <button type="button" onClick={() => void go()} disabled={busy} className="btn btn-primary w-full justify-center min-h-11 disabled:opacity-60">
          {busy ? 'Making it…' : picked.action}
        </button>
      </div>
    </>
  )
}
