'use client'
import { useEffect, useState } from 'react'
import { deleteAvailability, saveAvailability, type AvailabilityInput } from '@/lib/calendarActions'
import { KIND_COLORS, type Availability, type AvailabilityStatus } from '@/lib/calendarModel'
import {
  describeAvailability,
  findAvailabilityClash,
  lastDayOf,
  localMidnight,
  localYmd,
  nextOccurrence,
  overlappingAvailabilityIds,
} from '@/lib/availabilityText'

/**
 * Setting availability.
 *
 * The one thing every assistant puts on the calendar. It has to take as long
 * as a text to the head coach would — "out Thursday", done — because if it
 * takes longer, the text is what gets sent and the calendar is wrong. So: a
 * preset or a date, one tap on Save, and the block is on everybody's grid.
 *
 * Times are typed and read on the phone's own clock. The staff all live
 * around Cary, so that is the team's clock too.
 */

type Props = {
  myAvailability: Availability[]
  isOwner: boolean
  /** After every save or delete, so the calendar can fetch again. */
  onChanged: () => void
  onClose: () => void
}

interface Form {
  id: string | null
  status: AvailabilityStatus
  /** First day, YYYY-MM-DD. */
  date: string
  multiDay: boolean
  /** Last day, YYYY-MM-DD, when multiDay. */
  lastDate: string
  allDay: boolean
  start: string
  end: string
  weekly: boolean
  /** YYYY-MM-DD, inclusive; blank repeats for the season. */
  until: string
  note: string
}

const DAY_MS = 24 * 60 * 60 * 1000

// Practice runs after school, so an afternoon window is the likeliest thing a
// coach means when a block isn't the whole day.
const DEFAULT_START = '16:00'
const DEFAULT_END = '18:00'

function blankForm(today: string): Form {
  return {
    id: null,
    status: 'unavailable',
    date: today,
    multiDay: false,
    lastDate: '',
    // All day is on to start with: nearly every "can't make it" is a whole
    // day — a wedding, a work trip, a kid's tournament — and it saves a coach
    // two time pickers on a phone. A partial day is one tap away.
    allDay: true,
    start: DEFAULT_START,
    end: DEFAULT_END,
    weekly: false,
    until: '',
    note: '',
  }
}

function addDays(ymd: string, n: number): string {
  const d = localMidnight(ymd)
  return localYmd(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n))
}

function at(ymd: string, hm: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  const [h, mi] = hm.split(':').map(Number)
  return new Date(y, m - 1, d, h || 0, mi || 0)
}

function hm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function weekdayOf(ymd: string): string {
  return localMidnight(ymd).toLocaleDateString('en-US', { weekday: 'long' })
}

/** The form, as the instants the server stores — or what's wrong with it. */
function toInput(f: Form): AvailabilityInput | string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) return 'Pick a day.'
  const last = f.multiDay && f.lastDate ? f.lastDate : f.date
  if (last < f.date) return 'The last day is before the first.'

  let startsAt: Date
  let endsAt: Date
  if (f.allDay) {
    startsAt = localMidnight(f.date)
    // Exclusive: midnight after the last day, the way the calendar draws it.
    endsAt = localMidnight(addDays(last, 1))
  } else {
    if (!f.start || !f.end) return 'Set a start and an end time.'
    startsAt = at(f.date, f.start)
    endsAt = at(last, f.end)
    if (endsAt <= startsAt) {
      return f.multiDay ? 'It has to finish after it starts.' : 'The end time has to be after the start. Running overnight? Add a last day.'
    }
  }

  const span = endsAt.getTime() - startsAt.getTime()
  if (span > 60 * DAY_MS) return 'That’s more than sixty days — split it into two blocks.'
  if (f.weekly && span > 7 * DAY_MS) return 'A weekly block has to fit inside a week.'
  if (f.weekly && f.until && f.until < f.date) return 'The “until” date is before the first week.'

  return {
    id: f.id,
    status: f.status,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    allDay: f.allDay,
    repeatWeekly: f.weekly,
    repeatUntil: f.weekly && f.until ? f.until : null,
    note: f.note.trim() || null,
  }
}

/** The form's input as a block, to describe it or check it against the others. */
function asBlock(input: AvailabilityInput): Availability {
  return {
    id: input.id ?? '',
    coachEmail: '',
    coachName: '',
    status: input.status,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    allDay: input.allDay,
    repeatWeekly: input.repeatWeekly,
    repeatUntil: input.repeatUntil ?? null,
    note: input.note ?? null,
  }
}

/** A saved block, back in the form, for editing. */
function toForm(a: Availability, today: string): Form {
  const start = new Date(a.startsAt)
  const end = new Date(a.endsAt)
  const date = localYmd(start)
  const last = a.allDay ? localYmd(lastDayOf(a.startsAt, a.endsAt)) : localYmd(end)
  return {
    ...blankForm(today),
    id: a.id,
    status: a.status,
    date,
    multiDay: last !== date,
    lastDate: last !== date ? last : '',
    allDay: a.allDay,
    start: a.allDay ? DEFAULT_START : hm(start),
    end: a.allDay ? DEFAULT_END : hm(end),
    weekly: a.repeatWeekly,
    until: a.repeatUntil ?? '',
    note: a.note ?? '',
  }
}

interface Preset {
  key: string
  label: string
  form: Partial<Form>
}

/**
 * The handful of things coaches actually say.
 *
 * Each one only fills the form — the coach still looks and taps Save — so a
 * mis-tap never puts a wrong day in front of the head coach.
 */
function presetsFor(today: string): Preset[] {
  const dow = localMidnight(today).getDay() // 0 Sun … 6 Sat
  // The rest of this week, through Saturday — on a Sunday, the week ahead.
  const saturday = addDays(today, dow === 0 ? 6 : 6 - dow)
  return [
    { key: 'today', label: 'Out today', form: { status: 'unavailable', date: today, allDay: true } },
    {
      key: 'week',
      label: 'Out this week',
      form: { status: 'unavailable', date: today, multiDay: saturday !== today, lastDate: saturday !== today ? saturday : '', allDay: true },
    },
  ]
}

export function AvailabilityPanel({ myAvailability, onChanged, onClose }: Props) {
  // One "now" for the life of the panel: it is open for a minute, not a day.
  const [now] = useState(() => new Date())
  const today = localYmd(now)
  const [form, setForm] = useState<Form>(() => blankForm(today))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The block this one would overlap, when that's why it can't be saved — so
  // the message can offer to open it.
  const [clashId, setClashId] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [showPast, setShowPast] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  // Deleted here, still in the props until the calendar fetches again — hide
  // them straight away so a coach doesn't tap Delete twice.
  const [gone, setGone] = useState<string[]>([])

  // Escape backs out one step: an open "delete?" first, then the panel.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (confirmId) setConfirmId(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmId, onClose])

  function showError(message: string | null, clash: string | null = null) {
    setError(message)
    setClashId(clash)
  }

  function update(patch: Partial<Form>) {
    setForm((f) => ({ ...f, ...patch }))
    showError(null)
    setFlash(null)
  }

  function applyPreset(p: Preset) {
    setForm({ ...blankForm(today), ...p.form })
    showError(null)
    setFlash(null)
    setHint(`${p.label} — check it, then tap Save.`)
  }

  function reset() {
    setForm(blankForm(today))
    showError(null)
    setHint(null)
  }

  /** Open a saved block in the form. */
  function edit(a: Availability) {
    setForm(toForm(a, today))
    showError(null)
    setFlash(null)
    setHint(null)
    setConfirmId(null)
  }

  async function save() {
    const input = toInput(form)
    if (typeof input === 'string') {
      showError(input)
      return
    }
    // Two blocks over the same time leave the staff guessing which is true, so
    // catch it here before the round trip. The server checks again and has
    // the last word — this list can be a moment out of date.
    const clash = findAvailabilityClash(asBlock(input), mine.filter((a) => a.status === 'unavailable'))
    if (clash) {
      showError(`You already have “${describeAvailability(clash, now)}” then — edit or delete that one instead.`, clash.id)
      return
    }
    setBusy(true)
    showError(null)
    try {
      const res = await saveAvailability(input)
      if (!res.ok) {
        showError(res.error, res.clashId ?? null)
        return
      }
      setFlash(form.id ? 'Updated. The calendar has the change.' : 'Saved — it’s on the calendar.')
      setForm(blankForm(today))
      setHint(null)
      onChanged()
    } catch {
      showError('Couldn’t reach the server. Check the signal and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setBusy(true)
    showError(null)
    try {
      const res = await deleteAvailability(id)
      if (!res.ok) {
        showError(res.error)
        return
      }
      setGone((g) => [...g, id])
      setConfirmId(null)
      if (form.id === id) setForm(blankForm(today))
      setFlash('Deleted.')
      onChanged()
    } catch {
      showError('Couldn’t reach the server. Check the signal and try again.')
    } finally {
      setBusy(false)
    }
  }

  const preview = toInput(form)
  const previewText = typeof preview === 'string' ? null : describeAvailability(asBlock(preview), now)

  // Soonest first: a weekly block sorts by its next time round.
  const mine = myAvailability.filter((a) => !gone.includes(a.id))
  // Blocks already on top of each other — saved before the check existed, or
  // from two phones at once. Nothing is deleted for the coach; they're marked
  // so the coach can pick which one to keep.
  const overlapping = overlappingAvailabilityIds(mine.filter((a) => a.status === 'unavailable'))
  const clashBlock = clashId ? (mine.find((a) => a.id === clashId) ?? null) : null
  const upcoming = mine
    .map((a) => ({ a, next: nextOccurrence(a, now) }))
    .filter((x): x is { a: Availability; next: { startsAt: Date; endsAt: Date } } => x.next !== null)
    .sort((x, y) => x.next.startsAt.getTime() - y.next.startsAt.getTime())
    .map((x) => x.a)
  const upcomingIds = new Set(upcoming.map((a) => a.id))
  const past = mine
    .filter((a) => !upcomingIds.has(a.id))
    .sort((x, y) => y.startsAt.localeCompare(x.startsAt))
  const shown = showPast ? [...upcoming, ...past] : upcoming

  const out = form.status === 'unavailable'
  const tone = KIND_COLORS[form.status]

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3 border-b border-gray-100">
        <div className="min-w-0 flex-1">
          <div className="section-label">Availability</div>
          <h2 className="text-lg font-black leading-tight">When you can&rsquo;t be there</h2>
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

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-5">

        <div>
          <div className="flex flex-wrap gap-2">
            {presetsFor(today).map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p)}
                className="min-h-10 px-3.5 rounded-full border border-gray-200 bg-white text-sm font-bold text-gray-700 hover:border-[var(--gh-green)] hover:text-[var(--gh-green)] active:translate-y-px"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <form
          className="card p-4 space-y-4"
          style={{ borderColor: form.id ? 'var(--gh-green)' : undefined }}
          onSubmit={(e) => {
            e.preventDefault()
            if (!busy) void save()
          }}
        >
          {form.id && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-bold text-[var(--gh-green)]">Editing a block</span>
              <button type="button" onClick={reset} className="ml-auto text-xs font-bold text-gray-400 hover:text-gray-700">
                Start a new one instead
              </button>
            </div>
          )}

          {hint && <p className="text-xs font-semibold text-gray-500 -mt-1">{hint}</p>}

          {/* The day, and the last day when it runs longer. */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block min-w-0">
              <span className="field-label">{form.multiDay ? 'First day' : 'Day'}</span>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => {
                  const date = e.target.value
                  // Moving the first day past the last drags the last day with it.
                  update(form.multiDay && form.lastDate && form.lastDate < date ? { date, lastDate: date } : { date })
                }}
                className="field min-w-0"
              />
            </label>
            {form.multiDay ? (
              <label className="block min-w-0">
                <span className="field-label flex items-center">
                  Last day
                  <button
                    type="button"
                    onClick={() => update({ multiDay: false, lastDate: '' })}
                    className="ml-auto text-xs font-bold text-gray-400 hover:text-gray-700"
                  >
                    One day
                  </button>
                </span>
                <input
                  type="date"
                  value={form.lastDate}
                  min={form.date}
                  onChange={(e) => update({ lastDate: e.target.value })}
                  className="field min-w-0"
                />
              </label>
            ) : (
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => update({ multiDay: true, lastDate: form.lastDate || addDays(form.date || today, 1) })}
                  className="btn btn-ghost w-full !px-2 !py-[0.6rem] text-sm"
                >
                  + More days
                </button>
              </div>
            )}
          </div>

          <Switch
            on={form.allDay}
            onChange={(allDay) => update({ allDay })}
            label="All day"
            hint={form.allDay ? null : 'Just part of the day'}
          />

          {!form.allDay && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block min-w-0">
                <span className="field-label">From</span>
                <input
                  type="time"
                  value={form.start}
                  step={300}
                  onChange={(e) => update({ start: e.target.value })}
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

          <Switch
            on={form.weekly}
            onChange={(weekly) => update({ weekly })}
            label="Every week"
            hint={form.weekly && form.date ? `Repeats every ${weekdayOf(form.date)}` : null}
          />

          {form.weekly && (
            <label className="block">
              <span className="field-label">
                Until <span className="font-normal text-gray-400">— leave blank for the whole season</span>
              </span>
              <input
                type="date"
                value={form.until}
                min={form.date}
                onChange={(e) => update({ until: e.target.value })}
                className="field min-w-0"
              />
            </label>
          )}

          <label className="block">
            <span className="field-label">
              Note <span className="font-normal text-gray-400">— optional, the staff sees it</span>
            </span>
            <input
              type="text"
              value={form.note}
              maxLength={500}
              onChange={(e) => update({ note: e.target.value })}
              placeholder={out ? 'Night class, work travel…' : 'Can run a clinic, happy to drive…'}
              className="field"
            />
          </label>

          {/* What the staff will read, before it is saved. */}
          {previewText && (
            <div
              className="rounded-lg border px-3 py-2 text-sm font-semibold"
              style={{ background: tone.bg, color: tone.fg, borderColor: tone.border }}
            >
              {previewText}
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
              <p>{error}</p>
              {clashBlock && clashBlock.id !== form.id && (
                <button
                  type="button"
                  onClick={() => edit(clashBlock)}
                  className="btn btn-ghost mt-2 min-h-9 !py-1.5 text-sm"
                >
                  Edit that one
                </button>
              )}
            </div>
          )}
          {flash && !error && (
            <p role="status" className="text-sm font-bold text-[var(--gh-green)]">
              {flash}
            </p>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn btn-primary flex-1 min-h-11 disabled:opacity-50">
              {busy ? 'Saving…' : form.id ? 'Save changes' : 'Save'}
            </button>
            {(form.id || hint) && (
              <button type="button" onClick={reset} disabled={busy} className="btn btn-ghost min-h-11 disabled:opacity-50">
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* What this coach has on the calendar already. */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-[0.7rem] font-black tracking-[0.15em] uppercase text-gray-400">Your blocks</h3>
            {past.length > 0 && (
              <button
                type="button"
                onClick={() => setShowPast(!showPast)}
                className="ml-auto text-xs font-bold text-gray-400 hover:text-gray-700 min-h-8"
              >
                {showPast ? 'Hide past' : `Show past (${past.length})`}
              </button>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
            {shown.length === 0 ? (
              <p className="text-sm text-gray-400 px-4 py-5">
                {mine.length === 0
                  ? 'Nothing yet.'
                  : 'Nothing coming up. Past blocks are tucked away above.'}
              </p>
            ) : (
              shown.map((a) => {
                const c = KIND_COLORS[a.status]
                const isPast = !upcomingIds.has(a.id)
                const editing = form.id === a.id
                return (
                  <div
                    key={a.id}
                    className="px-3 py-3"
                    style={{ background: editing ? '#f0f7f3' : undefined, opacity: isPast ? 0.6 : 1 }}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        aria-hidden
                        className="mt-1.5 inline-block w-2.5 h-2.5 rounded-full shrink-0 border"
                        style={{ background: c.bg, borderColor: c.fg }}
                      />
                      <p className="min-w-0 flex-1 text-sm font-semibold break-words" style={{ color: isPast ? undefined : c.fg }}>
                        {describeAvailability(a, now)}
                        {overlapping.has(a.id) && (
                          <span
                            title="Covers the same time as another of your blocks — keep one and delete the other."
                            className="ml-2 inline-block align-middle rounded-full border border-red-200 bg-red-50 px-2 py-px text-[0.65rem] font-black uppercase tracking-wider text-red-800"
                          >
                            Overlaps
                          </span>
                        )}
                      </p>
                    </div>
                    {confirmId === a.id ? (
                      <div className="mt-2 ml-5 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-gray-700">Delete this block?</span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void remove(a.id)}
                          className="btn btn-maroon !py-1.5 text-sm min-h-9 disabled:opacity-50"
                        >
                          {busy ? 'Deleting…' : 'Delete'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(null)}
                          className="btn btn-ghost !py-1.5 text-sm min-h-9"
                        >
                          Keep it
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1 ml-5 flex items-center gap-1">
                        {/* Available is the default now; an old "available"
                            block does nothing, so it can only be deleted. */}
                        {a.status === 'available' ? (
                          <span className="text-xs text-gray-400 -ml-2 px-2">Not needed — available is the default</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => edit(a)}
                            className="min-h-9 px-2 -ml-2 text-xs font-bold text-gray-500 hover:text-[var(--gh-green)]"
                          >
                            Edit
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setConfirmId(a.id)}
                          className="min-h-9 px-2 text-xs font-bold text-gray-400 hover:text-[var(--gh-maroon)]"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** An on/off row the whole width of the card, so a thumb can't miss it. */
function Switch({
  on,
  onChange,
  label,
  hint,
}: {
  on: boolean
  onChange: (on: boolean) => void
  label: string
  hint: string | null
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="w-full min-h-11 flex items-center gap-3 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-gray-800">{label}</span>
        {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      </span>
      <span
        aria-hidden
        className="relative shrink-0 w-11 h-6 rounded-full transition-colors"
        style={{ background: on ? 'var(--gh-green)' : 'var(--color-gray-300, #d1d5db)' }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
          style={{ left: on ? '1.375rem' : '0.125rem' }}
        />
      </span>
    </button>
  )
}
