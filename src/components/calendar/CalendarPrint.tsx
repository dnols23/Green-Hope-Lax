'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CAL_TEAMS, colorFor, isCalTeam, type CalItem, type CalTeam } from '@/lib/calendarModel'
import {
  MONTH_NAMES,
  WEEKDAY_SHORT,
  addDays,
  addMonths,
  formatRange,
  fromYmd,
  isAllDayish,
  itemsOnDay,
  monthGrid,
  sameDay,
  startOfMonth,
} from '@/lib/calendarMath'
import { CAL_LAYERS, dayKey, itemTitle, kindMeta, shortTime, teamLabel, type CalLayer } from './calShared'
import { pickForExport } from './calExport'

const MAX_DAYS = 365

/** The calendar on paper: month pages or a list, then straight to the print dialog. */
export function CalendarPrint() {
  const sp = useSearchParams()
  const from = fromYmd(sp.get('from'))
  const last = fromYmd(sp.get('to'))
  const to = addDays(last, 1)
  const teams = (sp.get('teams') ?? '').split(',').filter(isCalTeam) as CalTeam[]
  const layers = (sp.get('layers') ?? '').split(',').filter((l) => CAL_LAYERS.some((x) => x.key === l)) as CalLayer[]
  const fields = sp.get('fields') === '1'
  const layout = sp.get('layout') === 'list' ? 'list' : 'month'
  const key = sp.toString()

  const [loaded, setLoaded] = useState<{ key: string; items: CalItem[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    ;(async () => {
      // A year at most per ask, the same as the calendar screen.
      const chunks: CalItem[] = []
      for (let s = from; s < to; s = addDays(s, MAX_DAYS)) {
        const e = addDays(s, MAX_DAYS) < to ? addDays(s, MAX_DAYS) : to
        const res = await fetch(`/api/calendar?from=${encodeURIComponent(s.toISOString())}&to=${encodeURIComponent(e.toISOString())}`)
        const body = (await res.json().catch(() => null)) as { items?: CalItem[] } | null
        if (!res.ok || !body?.items) {
          if (live) setError('Couldn’t load the calendar.')
          return
        }
        chunks.push(...body.items)
      }
      const seen = new Set<string>()
      const unique = chunks.filter((it) => (seen.has(it.key) ? false : (seen.add(it.key), true)))
      if (live) setLoaded({ key, items: pickForExport(unique, { teams, layers, fields }) })
    })()
    return () => {
      live = false
    }
    // The query string is the whole input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const items = loaded?.key === key ? loaded.items : null

  // Straight to the print dialog once it is all on the page.
  useEffect(() => {
    if (!items) return
    const t = window.setTimeout(() => window.print(), 400)
    return () => window.clearTimeout(t)
  }, [items])

  const months = useMemo(() => {
    const out: Date[] = []
    for (let m = startOfMonth(from); m < to; m = addMonths(m, 1)) out.push(m)
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const heading = `Green Hope Lacrosse · ${
    teams.length === CAL_TEAMS.length ? 'All calendars' : teams.map((t) => teamLabel(t)).join(', ')
  } · ${from.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${last.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  return (
    <div className="cal-print bg-white text-gray-900 min-h-screen">
      <style>{`
        @page { size: ${layout === 'month' ? 'landscape' : 'portrait'}; margin: 0.4in; }
        .cal-print { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print { .cal-print-bar { display: none !important; } .safe-top { display: none; } body { padding: 0 !important; } }
      `}</style>
      <div className="cal-print-bar sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white">
        <span className="font-bold text-sm flex-1 truncate">{heading}</span>
        <button type="button" onClick={() => window.print()} className="btn btn-primary !py-1.5">Print</button>
        <button type="button" onClick={() => window.close()} className="btn btn-ghost !py-1.5">Close</button>
      </div>

      {error && <p className="p-6 text-red-700">{error}</p>}
      {!items && !error && <p className="p-6 text-gray-500">Loading…</p>}

      {items && layout === 'month' &&
        months.map((m, i) => (
          <section key={dayKey(m)} className="p-4" style={{ breakBefore: i ? 'page' : undefined }}>
            <div className="flex items-baseline justify-between mb-2">
              <h1 className="text-2xl font-black">{MONTH_NAMES[m.getMonth()]} {m.getFullYear()}</h1>
              <span className="text-xs text-gray-500">{heading}</span>
            </div>
            <table className="w-full table-fixed border-collapse text-[9px] leading-tight">
              <thead>
                <tr>
                  {WEEKDAY_SHORT.map((d) => (
                    <th key={d} className="border border-gray-300 py-1 text-[10px] font-bold uppercase text-gray-500">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthGrid(m)
                  .filter((week) => week.some((d) => d.getMonth() === m.getMonth()))
                  .map((week) => (
                    <tr key={dayKey(week[0])}>
                      {week.map((d) => {
                        const inMonth = d.getMonth() === m.getMonth() && d >= from && d < to
                        const onDay = inMonth ? itemsOnDay(items, d) : []
                        return (
                          <td key={dayKey(d)} className="border border-gray-300 align-top p-1" style={{ height: '1.05in' }}>
                            <div className={`text-[11px] font-black ${inMonth ? '' : 'text-gray-300'}`}>{d.getDate()}</div>
                            {onDay.map((it) => (
                              <div key={it.key} className="flex gap-1 mt-0.5">
                                <span className="w-1.5 h-1.5 rounded-full mt-[2px] shrink-0" style={{ background: colorFor(it).bg, border: `1px solid ${colorFor(it).border}` }} />
                                <span className="min-w-0">
                                  {!(it.allDay || isAllDayish(it)) && <b>{shortTime(new Date(it.startsAt))} </b>}
                                  {itemTitle(it)}
                                </span>
                              </div>
                            ))}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        ))}

      {items && layout === 'list' && (
        <div className="p-6 max-w-3xl mx-auto">
          <h1 className="text-xl font-black mb-4">{heading}</h1>
          {items.length === 0 && <p className="text-gray-500">Nothing scheduled.</p>}
          {Array.from({ length: Math.round((to.getTime() - from.getTime()) / 86_400_000) }, (_, i) => addDays(from, i))
            .map((day) => ({ day, list: itemsOnDay(items, day) }))
            .filter((d) => d.list.length > 0)
            .map(({ day, list }) => (
              <section key={dayKey(day)} className="mb-4" style={{ breakInside: 'avoid' }}>
                <h2 className="font-black border-b border-gray-300 pb-1 mb-1">
                  {day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h2>
                <table className="w-full text-sm">
                  <tbody>
                    {list.map((it) => {
                      const allDay = it.allDay || isAllDayish(it)
                      const started = new Date(it.startsAt) < day && !sameDay(new Date(it.startsAt), day)
                      return (
                        <tr key={it.key} className="align-top">
                          <td className="py-1 pr-3 w-36 whitespace-nowrap text-gray-600">
                            {allDay ? 'All day' : started ? `Until ${shortTime(new Date(it.endsAt))}` : formatRange(it.startsAt, it.endsAt, false)}
                          </td>
                          <td className="py-1">
                            <span className="font-bold">{itemTitle(it)}</span>
                            <span className="text-gray-500">
                              {' · '}
                              {[kindMeta(it).label, teamLabel(it.team), it.location].filter(Boolean).join(' · ')}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </section>
            ))}
        </div>
      )}
    </div>
  )
}
