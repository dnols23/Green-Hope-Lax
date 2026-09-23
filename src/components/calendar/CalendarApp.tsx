'use client'

import { useEffect, useMemo, useState } from 'react'
import { moveCalEvent } from '@/lib/calendarActions'
import {
  CAL_TEAMS,
  CAL_VIEWS,
  isCalEventKind,
  type CalItem,
  type CalTeam,
  type CalView,
} from '@/lib/calendarModel'
import {
  MONTH_SHORT,
  WEEKDAY_SHORT,
  fromYmd,
  itemsOnDay,
  rangeFor,
  sameDay,
  startOfDay,
  stepAnchor,
  titleFor,
  toYmd,
  weekDays,
} from '@/lib/calendarMath'
import { timeLabel, timeRange, whoIsOut } from '@/lib/availabilityText'
import { AvailabilityPanel } from './AvailabilityPanel'
import { AgendaView } from './AgendaView'
import { EventDetail, type DetailTarget } from './EventDetail'
import { EventEditor, type EditorDraft } from './EventEditor'
import { Modal } from './Modal'
import { MonthView } from './MonthView'
import { TimeGrid } from './TimeGrid'
import { MiniMonth, YearView, dayLoad } from './YearView'
import { CAL_LAYERS, coachLabel, isAvailability, layerOf, type CalLayer, type CalPayload } from './calShared'
import { savePrefs, useHydrated, useNarrow, useNowMinute, usePrefs } from './calHooks'

/**
 * The coaches' calendar.
 *
 * One screen for everything with a date on it — games from the schedule,
 * practice plans from the planner, the events the head coach puts on, and
 * when each coach can and can't be there — in the five views a coach already
 * knows from Google: day, week, month, year and a plain list.
 *
 * This file keeps the state: which view, which date, what has been fetched,
 * what is filtered out, and what is open on top. The views only draw.
 *
 * Data comes from /api/calendar a window at a time. Day, week and month all
 * ask for the month's whole six-week grid, so stepping from Tuesday to
 * Wednesday, or from this week to next, is instant and never refetches.
 */

type Loaded = { key: string; data: CalPayload }
type Toast = { id: number; text: string; tone: 'ok' | 'error'; action?: { label: string; run: () => void } }

/** The window a view fetches. */
function fetchWindow(view: CalView, anchor: Date): { from: Date; to: Date } {
  return view === 'day' || view === 'week' || view === 'month' ? rangeFor('month', anchor) : rangeFor(view, anchor)
}

function shortWhen(d: Date): string {
  return `${WEEKDAY_SHORT[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${timeLabel(d)}`
}

export function CalendarApp({ initialView, initialDate }: { initialView: CalView | null; initialDate: string }) {
  const hydrated = useHydrated()
  const narrow = useNarrow()
  const now = useNowMinute()
  const prefs = usePrefs()

  const [picked, setPicked] = useState<CalView | null>(initialView)
  const [anchor, setAnchor] = useState<Date>(() => fromYmd(initialDate))
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null)
  const [tick, setTick] = useState(0)
  // Where a dragged event now sits while the server catches up.
  const [moved, setMoved] = useState<Record<string, { startsAt: string; endsAt: string }>>({})
  const [detail, setDetail] = useState<DetailTarget | null>(null)
  const [editor, setEditor] = useState<EditorDraft | null>(null)
  const [availOpen, setAvailOpen] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)

  // A phone opens on the list, the one view that reads well at that width —
  // unless the link or the coach's last visit says otherwise.
  const view: CalView = picked ?? prefs.view ?? (narrow ? 'agenda' : 'week')
  const win = useMemo(() => fetchWindow(view, anchor), [view, anchor])
  const key = `${win.from.toISOString()}|${win.to.toISOString()}`

  // ── Fetching ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const [from, to] = key.split('|')
    const ctrl = new AbortController()
    fetch(`/api/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
      signal: ctrl.signal,
      cache: 'no-store',
    })
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as (CalPayload & { error?: string }) | null
        if (!r.ok || !body) {
          throw new Error(
            r.status === 403
              ? 'Your sign-in has run out. Sign in again and the calendar will be here.'
              : body?.error || `The calendar didn’t load (error ${r.status}).`,
          )
        }
        return body
      })
      .then((data) => {
        setLoaded({ key, data })
        setFailed(null)
        // The server's copy now has every drag in it.
        setMoved({})
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return
        const message =
          err instanceof TypeError
            ? 'Couldn’t reach the server. Check the signal and try again.'
            : err instanceof Error
              ? err.message
              : 'The calendar didn’t load.'
        setFailed({ key, message })
      })
    return () => ctrl.abort()
  }, [key, tick])

  const refetch = () => setTick((t) => t + 1)
  const data = loaded?.data ?? null
  const loading = !failed && loaded?.key !== key
  const canPost = useMemo(() => data?.canPost ?? [], [data])
  const canCreate = canPost.length > 0

  // Keep the address bar on what is showing, so a link sent to another coach
  // opens on the same week. replaceState, not the router: nothing needs to
  // reload, and the back button shouldn't step through every click of ›.
  useEffect(() => {
    if (!hydrated) return
    const url = new URL(window.location.href)
    url.searchParams.set('view', view)
    url.searchParams.set('date', toYmd(anchor))
    if (url.href !== window.location.href) window.history.replaceState(null, '', url)
  }, [hydrated, view, anchor])

  // ── What is drawn ────────────────────────────────────────────────────────

  const items = useMemo(() => {
    if (!data) return []
    return data.items
      .map((it) => (moved[it.key] ? { ...it, ...moved[it.key] } : it))
      .filter(
        (it) =>
          prefs.layers.includes(layerOf(it)) &&
          // Availability is the staff's, not a team's, so the team chips leave it be.
          (isAvailability(it) || prefs.teams.includes(it.team)),
      )
  }, [data, moved, prefs])

  const days = useMemo(() => (view === 'week' ? weekDays(anchor) : [startOfDay(anchor)]), [view, anchor])
  const load = useMemo(() => dayLoad(items, win.from, win.to), [items, win.from, win.to])

  // ── Actions ──────────────────────────────────────────────────────────────

  function say(text: string, tone: Toast['tone'] = 'ok', action?: Toast['action']) {
    const id = Date.now()
    setToast({ id, text, tone, action })
    window.setTimeout(() => setToast((t) => (t?.id === id ? null : t)), action ? 6000 : 3500)
  }

  function setView(v: CalView) {
    setPicked(v)
    savePrefs({ view: v })
  }

  function step(dir: -1 | 1) {
    setAnchor((a) => stepAnchor(view, a, dir))
  }

  function goToday() {
    setAnchor(startOfDay(new Date()))
  }

  function openDay(day: Date) {
    setAnchor(startOfDay(day))
    setView('day')
    setDetail(null)
  }

  function toggleTeam(t: CalTeam) {
    const on = prefs.teams.includes(t)
    const next = on ? prefs.teams.filter((x) => x !== t) : [...prefs.teams, t]
    // Switching off the last one turns them all back on, rather than leaving a
    // blank calendar with no obvious way back.
    savePrefs({ teams: next.length ? next : CAL_TEAMS.map((x) => x.key) })
  }

  function toggleLayer(l: CalLayer) {
    const on = prefs.layers.includes(l)
    const next = on ? prefs.layers.filter((x) => x !== l) : [...prefs.layers, l]
    savePrefs({ layers: next.length ? next : CAL_LAYERS.map((x) => x.key) })
  }

  function defaultTeam(): CalTeam {
    const shown = canPost.filter((t) => prefs.teams.includes(t))
    if (shown.length === 1) return shown[0]
    if (shown.includes('program')) return 'program'
    return shown[0] ?? canPost[0] ?? 'program'
  }

  /** Open the editor on a new event — over a dragged range, or a sensible hour. */
  function newEvent(start?: Date, end?: Date, allDay = false) {
    if (!canCreate) return
    let s = start
    let e = end
    if (!s || !e) {
      const nowD = new Date()
      const visible = view === 'week' ? days.some((d) => sameDay(d, nowD)) : sameDay(anchor, nowD)
      const day = visible || view === 'agenda' || view === 'year' ? startOfDay(nowD) : startOfDay(anchor)
      // Today: the next full hour. Another day: four o'clock, when practice is.
      const hour = sameDay(day, nowD) ? Math.min(22, Math.max(7, nowD.getHours() + 1)) : 16
      s = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour)
      e = new Date(s.getTime() + 60 * 60_000)
    }
    setDetail(null)
    setEditor({
      id: null,
      title: '',
      kind: 'event',
      team: defaultTeam(),
      audience: 'coaches',
      startsAt: s,
      endsAt: e,
      allDay,
      location: '',
      notes: '',
    })
  }

  function editEvent(item: CalItem) {
    setDetail(null)
    setEditor({
      id: item.id,
      title: item.title,
      kind: isCalEventKind(item.kind) ? item.kind : 'event',
      team: item.team,
      audience: item.audience,
      startsAt: new Date(item.startsAt),
      endsAt: new Date(item.endsAt),
      allDay: item.allDay,
      location: item.location ?? '',
      notes: item.notes ?? '',
    })
  }

  /** A drag or a resize: move it now, tell the server, put it back if the server says no. */
  function moveEvent(item: CalItem, s: Date, e: Date, undoable = true) {
    const before = { startsAt: item.startsAt, endsAt: item.endsAt }
    setMoved((m) => ({ ...m, [item.key]: { startsAt: s.toISOString(), endsAt: e.toISOString() } }))
    const revert = () =>
      setMoved((m) => {
        const next = { ...m }
        delete next[item.key]
        return next
      })
    moveCalEvent(item.id, s.toISOString(), e.toISOString())
      .then((res) => {
        if (!res.ok) {
          revert()
          say(res.error, 'error')
          return
        }
        const resized = s.getTime() === Date.parse(before.startsAt)
        say(
          resized ? `Now ends ${timeLabel(e)}` : `Moved to ${shortWhen(s)}`,
          'ok',
          undoable
            ? {
                label: 'Undo',
                run: () =>
                  moveEvent(
                    { ...item, startsAt: s.toISOString(), endsAt: e.toISOString() },
                    new Date(before.startsAt),
                    new Date(before.endsAt),
                    false,
                  ),
              }
            : undefined,
        )
        refetch()
      })
      .catch(() => {
        revert()
        say('Couldn’t reach the server — it’s back where it was.', 'error')
      })
  }

  function openItem(item: CalItem) {
    setDetail({ type: 'item', item })
  }

  function openOut(day: Date, list: CalItem[]) {
    if (list.length) setDetail({ type: 'out', day, items: list })
  }

  // ── Keyboard ─────────────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      const typing = !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

      if (e.key === 'Escape') {
        // The availability panel backs out of its own questions first.
        if (availOpen) return
        if (editor) setEditor(null)
        else if (detail) setDetail(null)
        return
      }
      if (typing || editor || detail || availOpen) return

      const k = e.key.toLowerCase()
      const views: Record<string, CalView> = { d: 'day', w: 'week', m: 'month', y: 'year', a: 'agenda' }
      if (views[k]) setView(views[k])
      else if (k === 't') goToday()
      // The arrows, or Google's own J and K for the coach whose fingers know them.
      else if (e.key === 'ArrowLeft' || k === 'k' || k === 'p') step(-1)
      else if (e.key === 'ArrowRight' || k === 'j') step(1)
      else if (k === 'n' && canCreate) newEvent()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ── Drawing ──────────────────────────────────────────────────────────────

  const title = titleFor(view, anchor)
  const outToday = view === 'day' ? itemsOnDay(items.filter(isAvailability), anchor) : []

  return (
    <div className="space-y-3">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2.5">
        <div className="flex items-center gap-1 min-w-0 flex-1 sm:flex-none">
          <button type="button" onClick={goToday} className="btn btn-ghost !px-3 !py-1.5 min-h-9 mr-1" title="Today (T)">
            Today
          </button>
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous"
            title="Previous (←)"
            className="w-9 h-9 grid place-items-center rounded-full text-xl text-gray-600 hover:bg-gray-200/70"
          >
            &lsaquo;
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next"
            title="Next (→)"
            className="w-9 h-9 grid place-items-center rounded-full text-xl text-gray-600 hover:bg-gray-200/70"
          >
            &rsaquo;
          </button>
          <h2 className="ml-1 text-lg sm:text-xl font-black tracking-tight truncate min-w-0" aria-live="polite">
            {view === 'day' && narrow
              ? `${WEEKDAY_SHORT[anchor.getDay()]}, ${MONTH_SHORT[anchor.getMonth()]} ${anchor.getDate()}`
              : title}
          </h2>
          {hydrated && loading && data && (
            <span className="ml-1 w-2 h-2 rounded-full bg-[var(--gh-green)] animate-pulse shrink-0" aria-label="Loading" />
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
          {/* The view switcher: a letter each on a phone, the word on a laptop. */}
          <div className="flex flex-1 sm:flex-none rounded-full border border-gray-200 bg-white p-0.5" role="group" aria-label="View">
            {CAL_VIEWS.map((v) => {
              const on = hydrated && view === v.key
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setView(v.key)}
                  aria-pressed={on}
                  title={`${v.label} (${v.short})`}
                  className="flex-1 sm:flex-none min-h-8 px-2.5 sm:px-3 rounded-full text-sm font-bold transition-colors"
                  style={on ? { background: 'var(--gh-green)', color: '#fff' } : { color: '#4b5563' }}
                >
                  <span className="sm:hidden">{v.short}</span>
                  <span className="hidden sm:inline">{v.label}</span>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => setAvailOpen(true)}
            className="btn btn-ghost !px-3 !py-1.5 min-h-9 whitespace-nowrap"
            title="When you can and can’t be there"
          >
            <span aria-hidden>🙋</span>
            <span className="sm:hidden">Availability</span>
            <span className="hidden sm:inline">Set availability</span>
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={() => newEvent()}
              className="btn btn-primary !px-3.5 !py-1.5 min-h-9 whitespace-nowrap"
              title="New event (N)"
            >
              <span aria-hidden>+</span>
              <span className="hidden sm:inline">New</span>
              <span className="sr-only sm:hidden">New event</span>
            </button>
          )}
        </div>

        {/* Filters: which team, and which kinds of thing. They double as the legend. */}
        <div className="w-full -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto [scrollbar-width:none]">
          <div className="flex items-center gap-1.5 w-max sm:w-auto sm:flex-wrap">
            {CAL_TEAMS.map((t) => {
              const on = prefs.teams.includes(t.key)
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => toggleTeam(t.key)}
                  aria-pressed={on}
                  className="min-h-8 px-3 rounded-full border text-xs font-bold inline-flex items-center gap-1 transition-colors"
                  style={
                    on
                      ? { background: '#111827', color: '#fff', borderColor: '#111827' }
                      : { background: '#fff', color: '#9ca3af', borderColor: '#e5e7eb' }
                  }
                >
                  {on && <span aria-hidden>✓</span>}
                  {t.label}
                </button>
              )
            })}
            <span aria-hidden className="w-px h-5 bg-gray-200 mx-1 shrink-0" />
            {CAL_LAYERS.map((l) => {
              const on = prefs.layers.includes(l.key)
              return (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => toggleLayer(l.key)}
                  aria-pressed={on}
                  className="min-h-8 px-3 rounded-full border text-xs font-bold inline-flex items-center gap-1.5 bg-white transition-colors"
                  style={{ color: on ? '#374151' : '#9ca3af', borderColor: on ? '#d1d5db' : '#eef0ee' }}
                >
                  <span
                    aria-hidden
                    className="w-2.5 h-2.5 rounded-full border"
                    style={
                      l.key === 'availability'
                        ? {
                            background: on ? 'repeating-linear-gradient(135deg, #d98f99 0 2px, #fde8ea 2px 4px)' : 'transparent',
                            borderColor: '#d98f99',
                          }
                        : { background: on ? l.color : 'transparent', borderColor: l.color }
                    }
                  />
                  <span style={{ textDecoration: on ? undefined : 'line-through' }}>{l.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Banners ── */}
      {data && !data.ready && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-900 font-bold mb-1">The calendar isn&rsquo;t switched on yet.</p>
          <p className="text-sm text-amber-900">
            Games and practice plans show below, but events and availability can&rsquo;t be saved until{' '}
            <code className="font-mono text-[0.8rem] bg-amber-100 px-1 rounded">supabase/migrations/0039_calendar.sql</code> is
            run in the Supabase SQL editor. Nothing else on the site is affected.
          </p>
        </div>
      )}
      {failed && failed.key === key && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-red-800 font-semibold flex-1 min-w-0">{failed.message}</p>
          <button type="button" onClick={refetch} className="btn btn-ghost !py-1.5">
            Try again
          </button>
        </div>
      )}

      {/* ── The view ── */}
      {!hydrated || (!data && !failed) ? (
        <Skeleton view={hydrated ? view : 'week'} />
      ) : view === 'day' || view === 'week' ? (
        <div className={view === 'day' ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-4 items-start' : ''}>
          <TimeGrid
            key={view}
            days={days}
            items={items}
            now={now}
            canCreate={canCreate}
            onOpen={openItem}
            onOpenOut={openOut}
            onCreate={newEvent}
            onMove={moveEvent}
            onPickDay={view === 'week' ? openDay : undefined}
          />
          {view === 'day' && (
            <aside className="hidden lg:block space-y-4">
              <div className="card p-3">
                <MiniMonth
                  month={new Date(anchor.getFullYear(), anchor.getMonth(), 1)}
                  load={load}
                  now={now}
                  selected={anchor}
                  onPickDay={(d) => setAnchor(startOfDay(d))}
                />
              </div>
              <div className="card p-3">
                <div className="section-label mb-2">Staff this day</div>
                {whoIsOut(outToday).length === 0 ? (
                  <p className="text-sm text-gray-500">Nobody has said they&rsquo;re out.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {whoIsOut(outToday).map((g) => (
                      <li key={g.coachEmail || g.coachName}>
                        <button
                          type="button"
                          onClick={() => openItem(g.items[0])}
                          className="w-full text-left text-sm rounded-md px-1.5 py-1 -mx-1.5 hover:bg-gray-50"
                        >
                          <span className="font-bold text-[var(--gh-maroon)]">{g.coachName}</span>
                          <span className="block text-xs text-gray-500">
                            {g.items[0].allDay
                              ? 'Out all day'
                              : `Out ${timeRange(new Date(g.items[0].startsAt), new Date(g.items[0].endsAt))}`}
                            {g.items[0].notes ? ` — ${g.items[0].notes}` : ''}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {outToday.some((a) => a.kind === 'available') && (
                  <p className="mt-2 text-xs text-[#00512F] font-semibold">
                    Offering time:{' '}
                    {[...new Set(outToday.filter((a) => a.kind === 'available').map(coachLabel))].join(', ')}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setAvailOpen(true)}
                  className="mt-3 text-xs font-bold text-gray-500 hover:text-[var(--gh-green)]"
                >
                  Set your own availability &rarr;
                </button>
              </div>
            </aside>
          )}
        </div>
      ) : view === 'month' ? (
        <MonthView
          anchor={anchor}
          items={items}
          now={now}
          narrow={narrow}
          canCreate={canCreate}
          onOpen={openItem}
          onOpenOut={openOut}
          onOpenDay={openDay}
          onCreate={newEvent}
        />
      ) : view === 'year' ? (
        <YearView
          anchor={anchor}
          items={items}
          now={now}
          onPickDay={openDay}
          onPickMonth={(m) => {
            setAnchor(m)
            setView('month')
          }}
        />
      ) : (
        <AgendaView
          from={anchor}
          items={items}
          now={now}
          canCreate={canCreate}
          onOpen={openItem}
          onOpenOut={openOut}
          onNew={() => newEvent()}
          onLater={() => step(1)}
        />
      )}

      {hydrated && !narrow && (
        <p className="hidden md:block text-xs text-gray-400">
          Keys: <Kbd>T</Kbd> today · <Kbd>←</Kbd> <Kbd>→</Kbd> back and on · <Kbd>D</Kbd> <Kbd>W</Kbd> <Kbd>M</Kbd>{' '}
          <Kbd>Y</Kbd> <Kbd>A</Kbd> views
          {canCreate && (
            <>
              {' '}
              · <Kbd>N</Kbd> new event · drag across empty time to add, drag a block to move it
            </>
          )}{' '}
          · <Kbd>Esc</Kbd> close
        </p>
      )}

      {/* ── On top ── */}
      {detail && data && (
        <Modal shape="card" label="Details" onClose={() => setDetail(null)}>
          <EventDetail
            target={detail}
            myEmail={data.me.email}
            onClose={() => setDetail(null)}
            onEdit={editEvent}
            onEditAvailability={() => {
              setDetail(null)
              setAvailOpen(true)
            }}
            onOpen={openItem}
            onChanged={(msg) => {
              say(msg)
              refetch()
            }}
          />
        </Modal>
      )}
      {editor && (
        <Modal shape="dialog" label={editor.id ? 'Edit event' : 'New event'} onClose={() => setEditor(null)}>
          <EventEditor
            draft={editor}
            canPost={canPost}
            onClose={() => setEditor(null)}
            onSaved={(msg) => {
              say(msg)
              refetch()
            }}
          />
        </Modal>
      )}
      {availOpen && (
        <Modal shape="drawer" label="Set availability" onClose={() => setAvailOpen(false)}>
          <AvailabilityPanel
            myAvailability={data?.myAvailability ?? []}
            isOwner={data?.me.isOwner ?? false}
            onChanged={refetch}
            onClose={() => setAvailOpen(false)}
          />
        </Modal>
      )}

      {toast && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2 z-[75] flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold shadow-xl max-w-[calc(100vw-2rem)]"
          style={{
            bottom: 'calc(1.25rem + env(safe-area-inset-bottom))',
            background: toast.tone === 'error' ? '#7f1d1d' : '#111827',
            color: '#fff',
          }}
        >
          <span className="min-w-0">{toast.text}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.run()
                setToast(null)
              }}
              className="shrink-0 font-black text-[#7fd1a8] hover:text-white"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-block min-w-[1.25rem] text-center rounded border border-gray-200 bg-white px-1 font-sans text-[0.68rem] font-bold text-gray-500">
      {children}
    </kbd>
  )
}

/** A light outline of the view while the first fetch is out — never a blank page. */
function Skeleton({ view }: { view: CalView }) {
  if (view === 'agenda') {
    return (
      <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 animate-pulse" aria-label="Loading the calendar">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="px-4 py-3 space-y-2">
            <div className="h-4 w-40 rounded bg-gray-100" />
            <div className="h-3 w-3/4 rounded bg-gray-100" />
            <div className="h-3 w-1/2 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    )
  }
  const cells = view === 'month' ? 42 : view === 'year' ? 12 : view === 'week' ? 7 : 1
  return (
    <div
      className="rounded-xl border border-gray-200 bg-white p-3 animate-pulse"
      style={{ height: 'max(26rem, calc(100dvh - 18rem))' }}
      aria-label="Loading the calendar"
    >
      <div
        className="grid gap-2 h-full"
        style={{
          gridTemplateColumns: `repeat(${view === 'year' ? 4 : Math.min(cells, 7)}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: cells }, (_, i) => (
          <div key={i} className="rounded-lg bg-gray-100/80" />
        ))}
      </div>
    </div>
  )
}
