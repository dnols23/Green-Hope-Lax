'use client'

import { useState } from 'react'
import { CAL_TEAMS, type CalItem, type CalTeam } from '@/lib/calendarModel'
import { addDays, toYmd, fromYmd } from '@/lib/calendarMath'
import { CAL_LAYERS, type CalLayer } from './calShared'
import { download, pickForExport, toCsv, toIcs } from './calExport'

type Range = 'view' | 'year' | 'custom'

/** August to August: the school year the calendar is in. */
function schoolYear(d: Date): { from: Date; to: Date } {
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1
  return { from: new Date(y, 7, 1), to: new Date(y + 1, 7, 1) }
}

/**
 * Export or print the calendar: what is on screen, or any stretch of it, for
 * whichever calendars and kinds of thing are picked.
 */
export function ExportPanel({
  view,
  teams: startTeams,
  layers: startLayers,
  onClose,
}: {
  /** What the calendar is showing now. */
  view: { from: Date; to: Date; label: string }
  teams: CalTeam[]
  layers: CalLayer[]
  onClose: () => void
}) {
  const [range, setRange] = useState<Range>('view')
  const [from, setFrom] = useState(toYmd(view.from))
  const [to, setTo] = useState(toYmd(addDays(view.to, -1)))
  const [teams, setTeams] = useState<CalTeam[]>(startTeams)
  // The schedule itself by default; who's out and open field time only when asked for.
  const [layers, setLayers] = useState<CalLayer[]>(startLayers.filter((l) => l !== 'availability'))
  const [fields, setFields] = useState(false)
  const [layout, setLayout] = useState<'month' | 'list'>('month')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const window_ = () =>
    range === 'view'
      ? { from: view.from, to: view.to }
      : range === 'year'
        ? schoolYear(view.from)
        : { from: fromYmd(from), to: addDays(fromYmd(to), 1) }

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  async function load(): Promise<CalItem[] | null> {
    const w = window_()
    if (!(w.to > w.from)) {
      setError('The end date has to be after the start.')
      return null
    }
    const res = await fetch(`/api/calendar?from=${encodeURIComponent(w.from.toISOString())}&to=${encodeURIComponent(w.to.toISOString())}`)
    const body = (await res.json().catch(() => null)) as { items?: CalItem[]; error?: string } | null
    if (!res.ok || !body?.items) {
      setError(body?.error ?? 'Couldn’t load the calendar.')
      return null
    }
    return pickForExport(body.items, { teams, layers, fields })
  }

  async function file(kind: 'ics' | 'csv') {
    setBusy(kind)
    setError(null)
    try {
      const items = await load()
      if (!items) return
      if (!items.length) return setError('Nothing to export in that range.')
      const w = window_()
      const name = `falcons-calendar-${toYmd(w.from)}-to-${toYmd(addDays(w.to, -1))}`
      if (kind === 'ics') download(toIcs(items, 'Green Hope Lacrosse'), `${name}.ics`, 'text/calendar')
      else download(toCsv(items), `${name}.csv`, 'text/csv')
    } catch {
      setError('Couldn’t reach the server.')
    } finally {
      setBusy(null)
    }
  }

  function print() {
    const w = window_()
    if (!(w.to > w.from)) return setError('The end date has to be after the start.')
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

  const chip = (on: boolean) =>
    `min-h-8 px-3 rounded-full border text-xs font-bold ${on ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500'}`

  return (
    <>
      <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-gray-100">
        <h2 className="text-lg font-black flex-1">Export &amp; print</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="w-10 h-10 -mr-2 rounded-full text-2xl leading-none text-gray-400 hover:text-gray-800 hover:bg-gray-100">
          &times;
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5">
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
            {CAL_LAYERS.map((l) => (
              <button key={l.key} type="button" aria-pressed={layers.includes(l.key)} onClick={() => setLayers((x) => toggle(x, l.key))} className={chip(layers.includes(l.key))}>
                {l.key === 'availability' ? 'Who’s out' : l.label}
              </button>
            ))}
            <button type="button" aria-pressed={fields} onClick={() => setFields((v) => !v)} className={chip(fields)}>
              Field Availability
            </button>
          </div>
        </section>

        <section>
          <div className="field-label">Print as</div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" aria-pressed={layout === 'month'} onClick={() => setLayout('month')} className={chip(layout === 'month')}>
              Month pages
            </button>
            <button type="button" aria-pressed={layout === 'list'} onClick={() => setLayout('list')} className={chip(layout === 'list')}>
              List
            </button>
          </div>
        </section>
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      </div>

      <div className="px-5 py-3 border-t border-gray-100 grid grid-cols-3 gap-2">
        <button type="button" onClick={print} className="btn btn-primary justify-center">
          Print
        </button>
        <button type="button" onClick={() => file('ics')} disabled={!!busy} className="btn btn-ghost justify-center" title="Opens in Google, Apple or Outlook calendar">
          {busy === 'ics' ? '…' : 'Calendar file'}
        </button>
        <button type="button" onClick={() => file('csv')} disabled={!!busy} className="btn btn-ghost justify-center">
          {busy === 'csv' ? '…' : 'Spreadsheet'}
        </button>
      </div>
    </>
  )
}
