'use client'

import { useState } from 'react'
import { deleteCalEvent, saveCalEvent } from '@/lib/calendarActions'
import {
  CAL_AUDIENCES,
  CAL_EVENT_KINDS,
  KIND_COLORS,
  type CalAudience,
  type CalEventKind,
  type CalTeam,
} from '@/lib/calendarModel'
import { WEEKDAY_NAMES, MONTH_SHORT, toYmd } from '@/lib/calendarMath'
import { teamLabel } from './calShared'

/**
 * Putting something on the calendar, or changing it.
 *
 * The head coach's own words set the order of this form: what it is, and then
 * who sees it — "just coaches, or coaches and players, or everyone, or just
 * parents". That choice is four big cards, not a dropdown, and it starts on
 * Coaches only, so nothing reaches a parent's phone unless a coach picked it.
 *
 * Times are typed on the phone's own clock and sent as exact instants. The
 * whole staff lives around Cary, so that clock is the team's.
 */

export interface EditorDraft {
  id: string | null
  title: string
  kind: CalEventKind
  team: CalTeam
  audience: CalAudience
  startsAt: Date
  endsAt: Date
  allDay: boolean
  location: string
  notes: string
}

interface Form {
  title: string
  kind: CalEventKind
  team: CalTeam
  audience: CalAudience
  allDay: boolean
  /** First day, YYYY-MM-DD. */
  date: string
  /** Last day for all-day, end day for timed; YYYY-MM-DD. */
  endDate: string
  /** Whether the end-day field is showing. */
  multiDay: boolean
  start: string
  end: string
  location: string
  notes: string
}

/** Who ends up seeing each audience — drawn as little pills on its card. */
const REACH: Record<CalAudience, string[]> = {
  coaches: ['Coaches'],
  team: ['Coaches', 'Players'],
  parents: ['Coaches', 'Parents'],
  public: ['Coaches', 'Players', 'Parents', 'Public site'],
}

const AUDIENCE_ICON: Record<CalAudience, string> = {
  coaches: '🔒',
  team: '🥍',
  parents: '👪',
  public: '📣',
}

const DAY_MS = 86_400_000
const MAX_DAYS = 60

const pad = (n: number) => String(n).padStart(2, '0')
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

function parseYmd(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null
}

/** A date and a clock time on this phone's clock. */
function at(ymd: string, time: string): Date | null {
  const p = parseYmd(ymd)
  const t = /^(\d{1,2}):(\d{2})$/.exec(time)
  if (!p || !t) return null
  return new Date(p.y, p.m - 1, p.d, Number(t[1]), Number(t[2]))
}

function addDaysYmd(ymd: string, n: number): string {
  const p = parseYmd(ymd)
  if (!p) return ymd
  return toYmd(new Date(p.y, p.m - 1, p.d + n))
}

function niceDay(ymd: string): string {
  const p = parseYmd(ymd)
  if (!p) return ''
  const d = new Date(p.y, p.m - 1, p.d)
  return `${WEEKDAY_NAMES[d.getDay()].slice(0, 3)}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`
}

function toForm(d: EditorDraft): Form {
  const s = d.startsAt
  // An all-day end is midnight after the last day; the form shows the last day.
  const lastDay = d.allDay ? new Date(Math.max(s.getTime(), d.endsAt.getTime() - 1)) : d.endsAt
  const date = toYmd(s)
  const endDate = toYmd(lastDay)
  return {
    title: d.title,
    kind: d.kind,
    team: d.team,
    audience: d.audience,
    allDay: d.allDay,
    date,
    endDate,
    multiDay: endDate !== date && !(!d.allDay && d.endsAt.getTime() === new Date(s.getFullYear(), s.getMonth(), s.getDate() + 1).getTime()),
    start: hm(s),
    end: hm(d.endsAt),
    location: d.location,
    notes: d.notes,
  }
}

/** The form as the instants the server wants, or what is wrong with it. */
function toTimes(f: Form): { startsAt: Date; endsAt: Date } | string {
  const lastDate = f.multiDay ? f.endDate : f.date
  if (f.allDay) {
    const s = at(f.date, '00:00')
    const last = at(lastDate, '00:00')
    if (!s || !last) return 'Pick a day.'
    if (last < s) return 'The last day is before the first.'
    const e = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1)
    if (e.getTime() - s.getTime() > MAX_DAYS * DAY_MS + 2 * 3_600_000) return 'That runs for more than sixty days.'
    return { startsAt: s, endsAt: e }
  }
  const s = at(f.date, f.start)
  let e = at(lastDate, f.end)
  if (!s || !e) return 'Pick a day and a time.'
  // "10 PM to 12 AM" on one day means midnight at the end of it.
  if (!f.multiDay && f.end === '00:00' && f.start !== '00:00') e = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1)
  if (e < s) return f.multiDay ? 'It has to finish after it starts.' : 'The end time is before the start. For something overnight, add an end day.'
  if (e.getTime() - s.getTime() > MAX_DAYS * DAY_MS) return 'That runs for more than sixty days.'
  return { startsAt: s, endsAt: e }
}

export function EventEditor({
  draft,
  canPost,
  onClose,
  onSaved,
}: {
  draft: EditorDraft
  canPost: CalTeam[]
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [form, setForm] = useState<Form>(() => toForm(draft))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const editing = !!draft.id
  const teams = canPost.includes(form.team) ? canPost : [form.team, ...canPost]

  function update(patch: Partial<Form>) {
    setForm((f) => ({ ...f, ...patch }))
    setError(null)
  }

  /** Moving the start keeps the length, the way every calendar does. */
  function moveStart(patch: { date?: string; start?: string }) {
    setForm((f) => {
      const next = { ...f, ...patch }
      const oldS = at(f.date, f.allDay ? '00:00' : f.start)
      const newS = at(next.date, next.allDay ? '00:00' : next.start)
      const oldE = at(f.multiDay ? f.endDate : f.date, f.allDay ? '00:00' : f.end)
      if (oldS && newS && oldE) {
        const shifted = new Date(newS.getTime() + (oldE.getTime() - oldS.getTime()))
        if (f.multiDay) next.endDate = toYmd(shifted)
        if (!f.allDay && toYmd(shifted) === (f.multiDay ? next.endDate : next.date)) next.end = hm(shifted)
      }
      return next
    })
    setError(null)
  }

  async function save() {
    const title = form.title.trim()
    if (!title) {
      setError('Give it a name.')
      return
    }
    const times = toTimes(form)
    if (typeof times === 'string') {
      setError(times)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await saveCalEvent({
        id: draft.id,
        team: form.team,
        title,
        kind: form.kind,
        startsAt: times.startsAt.toISOString(),
        endsAt: times.endsAt.toISOString(),
        allDay: form.allDay,
        location: form.location.trim() || null,
        notes: form.notes.trim() || null,
        audience: form.audience,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      onSaved(editing ? 'Saved.' : 'Added to the calendar.')
      onClose()
    } catch {
      setError('Couldn’t reach the server. Check the signal and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!draft.id) return
    setBusy(true)
    setError(null)
    try {
      const res = await deleteCalEvent(draft.id)
      if (!res.ok) {
        setError(res.error)
        return
      }
      onSaved('Deleted.')
      onClose()
    } catch {
      setError('Couldn’t reach the server. Check the signal and try again.')
    } finally {
      setBusy(false)
    }
  }

  const kindColor = KIND_COLORS[form.kind] ?? KIND_COLORS.event

  return (
    <form
      className="flex flex-col h-full min-h-0"
      onSubmit={(e) => {
        e.preventDefault()
        if (!busy) void save()
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-gray-100" style={{ borderTop: `4px solid ${kindColor.bg}` }}>
        <div className="min-w-0 flex-1">
          <div className="section-label">{editing ? 'Edit event' : 'New event'}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 w-10 h-10 -mr-1 rounded-full text-2xl leading-none text-gray-400 hover:text-gray-800 hover:bg-gray-100"
        >
          &times;
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-5 py-4 space-y-5">
        <input
          type="text"
          value={form.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="Title — e.g. Team dinner, Film: Cardinal Gibbons"
          aria-label="Title"
          maxLength={200}
          autoFocus={!editing}
          className="w-full border-0 border-b-2 border-gray-200 focus:border-[var(--gh-green)] bg-transparent px-0 py-2 text-xl font-black placeholder:font-semibold placeholder:text-gray-300"
          // The green underline is its focus mark; the global ring would box it in.
          style={{ outline: 'none' }}
        />

        {/* What it is */}
        <div>
          <div className="field-label">What it is</div>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Kind">
            {CAL_EVENT_KINDS.map((k) => {
              const on = form.kind === k.key
              const c = KIND_COLORS[k.key] ?? KIND_COLORS.event
              return (
                <button
                  key={k.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => update({ kind: k.key })}
                  className="min-h-10 px-3 rounded-full border text-sm font-bold inline-flex items-center gap-1.5 transition-colors"
                  style={
                    on
                      ? { background: c.bg, color: c.fg, borderColor: c.border }
                      : { background: '#fff', color: '#4b5563', borderColor: '#e5e7eb' }
                  }
                >
                  <span aria-hidden>{k.icon}</span>
                  {k.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Who sees it — the head coach's own requirement, front and centre. */}
        <div>
          <div className="field-label">Who sees this</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Who sees this">
            {CAL_AUDIENCES.map((a) => {
              const on = form.audience === a.key
              return (
                <button
                  key={a.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => update({ audience: a.key })}
                  className="text-left rounded-xl border-2 px-3 py-2.5 transition-colors min-h-[4.25rem]"
                  style={{
                    borderColor: on ? 'var(--gh-green)' : '#e5e7eb',
                    background: on ? '#f0f7f3' : '#fff',
                  }}
                >
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="text-base">{AUDIENCE_ICON[a.key]}</span>
                    <span className="font-black text-sm text-gray-900 flex-1">{a.label}</span>
                    <span
                      aria-hidden
                      className="w-5 h-5 rounded-full border-2 grid place-items-center shrink-0"
                      style={{ borderColor: on ? 'var(--gh-green)' : '#d1d5db' }}
                    >
                      {on && <span className="w-2.5 h-2.5 rounded-full bg-[var(--gh-green)]" />}
                    </span>
                  </span>
                  <span className="block text-xs text-gray-500 mt-0.5">{a.hint}</span>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {REACH[a.key].map((w) => (
                      <span
                        key={w}
                        className="rounded-full px-1.5 py-px text-[0.65rem] font-bold"
                        style={{
                          background: on ? 'var(--gh-green)' : '#f3f4f6',
                          color: on ? '#fff' : '#6b7280',
                        }}
                      >
                        {w}
                      </span>
                    ))}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Whose calendar */}
        {teams.length > 1 ? (
          <div>
            <div className="field-label">Team</div>
            <div className="inline-flex rounded-full border border-gray-200 bg-gray-50 p-0.5" role="radiogroup" aria-label="Team">
              {teams.map((t) => {
                const on = form.team === t
                return (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => update({ team: t })}
                    className="min-h-9 px-4 rounded-full text-sm font-bold transition-colors"
                    style={on ? { background: 'var(--gh-green)', color: '#fff' } : { color: '#4b5563' }}
                  >
                    {teamLabel(t)}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            On the <strong className="text-gray-800">{teamLabel(form.team)}</strong> calendar.
          </p>
        )}

        {/* When */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="field-label !mb-0 flex-1">When</div>
            <button
              type="button"
              role="switch"
              aria-checked={form.allDay}
              onClick={() => update({ allDay: !form.allDay })}
              className="min-h-10 inline-flex items-center gap-2 text-sm font-bold text-gray-700"
            >
              All day
              <span
                aria-hidden
                className="relative w-10 h-6 rounded-full transition-colors"
                style={{ background: form.allDay ? 'var(--gh-green)' : '#d1d5db' }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                  style={{ left: form.allDay ? '1.125rem' : '0.125rem' }}
                />
              </span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block min-w-0">
              <span className="field-label">{form.multiDay ? (form.allDay ? 'First day' : 'Starts') : 'Day'}</span>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => e.target.value && moveStart({ date: e.target.value })}
                className="field min-w-0"
              />
            </label>
            {form.multiDay ? (
              <label className="block min-w-0">
                <span className="field-label flex items-center">
                  {form.allDay ? 'Last day' : 'Ends'}
                  <button
                    type="button"
                    onClick={() => update({ multiDay: false, endDate: form.date })}
                    className="ml-auto text-xs font-bold text-gray-400 hover:text-gray-700"
                  >
                    One day
                  </button>
                </span>
                <input
                  type="date"
                  value={form.endDate}
                  min={form.date}
                  onChange={(e) => update({ endDate: e.target.value })}
                  className="field min-w-0"
                />
              </label>
            ) : (
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => update({ multiDay: true, endDate: addDaysYmd(form.date, 1) })}
                  className="btn btn-ghost w-full !px-2 !py-[0.6rem] text-sm"
                >
                  + End day
                </button>
              </div>
            )}
          </div>

          {!form.allDay && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block min-w-0">
                <span className="field-label">From</span>
                <input
                  type="time"
                  value={form.start}
                  step={300}
                  onChange={(e) => e.target.value && moveStart({ start: e.target.value })}
                  className="field min-w-0"
                />
              </label>
              <label className="block min-w-0">
                <span className="field-label">To</span>
                <input
                  type="time"
                  value={form.end}
                  step={300}
                  onChange={(e) => update({ end: e.target.value })}
                  className="field min-w-0"
                />
              </label>
            </div>
          )}
          {form.multiDay && form.allDay && form.endDate >= form.date && (
            <p className="text-xs text-gray-500 -mt-1">
              {niceDay(form.date)} through {niceDay(form.endDate)}
            </p>
          )}
        </div>

        <label className="block">
          <span className="field-label">Location</span>
          <input
            type="text"
            value={form.location}
            onChange={(e) => update({ location: e.target.value })}
            placeholder="Green Hope HS stadium, the film room…"
            maxLength={200}
            className="field"
          />
        </label>

        <label className="block">
          <span className="field-label">Notes</span>
          <textarea
            value={form.notes}
            onChange={(e) => update({ notes: e.target.value })}
            onKeyDown={(e) => {
              // Cmd/Ctrl + Enter saves from the notes box, the way a message sends.
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                if (!busy) void save()
              }
            }}
            rows={3}
            maxLength={4000}
            placeholder={form.audience === 'coaches' ? 'Only the staff reads this.' : 'Everyone who sees the event reads this.'}
            className="field resize-y"
          />
        </label>

        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
            {error}
          </p>
        )}
      </div>

      {/* Footer — pinned, so Save is always under a thumb. */}
      <div className="border-t border-gray-100 px-4 sm:px-5 py-3 flex flex-wrap items-center gap-2 bg-white">
        {confirmDelete ? (
          <>
            <span className="text-sm font-bold text-gray-700 mr-auto">Delete this event?</span>
            <button type="button" disabled={busy} onClick={() => void remove()} className="btn btn-maroon min-h-11 disabled:opacity-50">
              {busy ? 'Deleting…' : 'Delete'}
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="btn btn-ghost min-h-11">
              Keep it
            </button>
          </>
        ) : (
          <>
            {editing && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="btn btn-ghost min-h-11 !text-[var(--gh-maroon)]"
              >
                Delete
              </button>
            )}
            <button type="button" onClick={onClose} className="btn btn-ghost min-h-11 ml-auto">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="btn btn-primary min-h-11 min-w-[6.5rem] disabled:opacity-50">
              {busy ? 'Saving…' : 'Save'}
            </button>
          </>
        )}
      </div>
    </form>
  )
}
