'use client'

import Link from 'next/link'
import { useState } from 'react'
import { deleteAvailability, deleteCalEvent } from '@/lib/calendarActions'
import { CAL_AUDIENCES, colorFor, type CalItem } from '@/lib/calendarModel'
import { MONTH_NAMES, WEEKDAY_NAMES, formatRange, isAllDayish, sameDay } from '@/lib/calendarMath'
import { AUDIENCE_TONE, isFieldTime, itemTitle, kindMeta, teamLabel, whoSees } from './calShared'

/**
 * What a block on the calendar is, when it is tapped.
 *
 * The one question the head coach asked for by name gets its own line: who
 * sees this. A coaches-only meeting and an everyone fundraiser look alike on
 * the grid, and the difference matters the moment a parent asks about it.
 *
 * Games and practice plans live on their own pages, so they get a button that
 * goes there; events and availability are changed right here.
 */

export type DetailTarget = { type: 'item'; item: CalItem } | { type: 'out'; day: Date; items: CalItem[] }

type Props = {
  target: DetailTarget
  myEmail: string
  onClose: () => void
  /** Open the editor on this event. */
  onEdit: (item: CalItem) => void
  /** Open the availability panel. */
  onEditAvailability: () => void
  /** Start a workout in an open field slot (coaches who may post only). */
  onPlanHere?: (slot: CalItem) => void
  /** Show one availability block from the "who's out" list. */
  onOpen: (item: CalItem) => void
  /** After a delete, so the calendar can fetch again. */
  onChanged: (message: string) => void
}

function longDay(d: Date): string {
  return `${WEEKDAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`
}

/** "Tuesday, September 22 · 4:00 – 6:00 PM", or just the range when it spans days. */
export function whenText(item: Pick<CalItem, 'startsAt' | 'endsAt' | 'allDay'>): string {
  const s = new Date(item.startsAt)
  const e = new Date(item.endsAt)
  const range = formatRange(item.startsAt, item.endsAt, item.allDay || isAllDayish(item))
  const lastInstant = new Date(Math.max(s.getTime(), e.getTime() - 1))
  if (sameDay(s, lastInstant)) {
    return `${longDay(s)} · ${range}`
  }
  if (item.allDay) {
    const days = Math.round((e.getTime() - s.getTime()) / 86_400_000)
    return `${range} · ${days} days`
  }
  return range
}

export function EventDetail({ target, myEmail, onClose, onEdit, onEditAvailability, onPlanHere, onOpen, onChanged }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (target.type === 'out') return <OutList target={target} onClose={onClose} onOpen={onOpen} />

  const item = target.item
  const avail = item.source === 'availability'
  const mine = avail && (item.coachEmail ?? '').toLowerCase() === myEmail.toLowerCase()
  const meta = kindMeta(item)
  const c = colorFor(item)
  const tone = AUDIENCE_TONE[item.audience]
  const result = item.result
  let resultTone = 'badge-sched'
  if (result) {
    const [us, them] = result.split(/[–-]/).map((n) => Number(n))
    resultTone = us > them ? 'badge-win' : us < them ? 'badge-loss' : 'badge-tie'
  }

  async function remove() {
    setBusy(true)
    setError(null)
    try {
      const res = avail ? await deleteAvailability(item.id) : await deleteCalEvent(item.id)
      if (!res.ok) {
        setError(res.error)
        return
      }
      onChanged(avail ? 'Availability deleted.' : 'Deleted.')
      onClose()
    } catch {
      setError('Couldn’t reach the server. Check the signal and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Grabber />
      <div className="flex items-start gap-3 px-5 pt-3 sm:pt-5 pb-3">
        <span
          aria-hidden
          className="mt-1 w-3.5 h-3.5 rounded shrink-0 border"
          style={{ background: c.bg, borderColor: c.border }}
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black leading-snug break-words">{itemTitle(item)}</h2>
          <p className="text-sm text-gray-600 mt-0.5">{whenText(item)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 w-10 h-10 -mr-2 -mt-1 rounded-full text-2xl leading-none text-gray-400 hover:text-gray-800 hover:bg-gray-100"
        >
          &times;
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">
            <span aria-hidden>{meta.icon}</span>
            {meta.label}
          </span>
          {!avail && (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">
              {teamLabel(item.team)}
            </span>
          )}
          {item.source === 'game' && item.homeAway && (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700 capitalize">
              {item.homeAway}
            </span>
          )}
          {result && <span className={`badge ${resultTone}`}>Final {result}</span>}
        </div>

        {/* Who sees this — the line the head coach cares about most. */}
        <div className="flex items-start gap-2 rounded-lg px-3 py-2" style={{ background: tone.bg, color: tone.fg }}>
          <span aria-hidden>👁</span>
          <span>
            <span className="font-bold">Who sees this:</span> {whoSees(item)}
            {avail && <span className="opacity-75"> — players and parents never do</span>}
            {item.source === 'event' && (
              <span className="block text-xs opacity-80">{CAL_AUDIENCES.find((a) => a.key === item.audience)?.hint}</span>
            )}
          </span>
        </div>

        {item.location && (
          <p className="flex gap-2">
            <span aria-hidden>📍</span>
            <span className="break-words">{item.location}</span>
          </p>
        )}
        {item.notes && <p className="whitespace-pre-wrap break-words text-gray-700 leading-relaxed">{item.notes}</p>}
        {avail && !item.notes && (
          <p className="text-gray-400">{mine ? 'No note on this one.' : 'No note left.'}</p>
        )}

        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-semibold text-red-800">
            {error}
          </p>
        )}
      </div>

      <div className="border-t border-gray-100 px-5 py-3 flex flex-wrap items-center gap-2">
        {confirming ? (
          <>
            <span className="text-sm font-bold text-gray-700 mr-auto">
              {avail ? 'Delete this block?' : item.audience === 'coaches' ? 'Delete this event?' : 'Delete it for everyone who sees it?'}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void remove()}
              className="btn btn-maroon min-h-10 disabled:opacity-50"
            >
              {busy ? 'Deleting…' : 'Delete'}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="btn btn-ghost min-h-10">
              Keep it
            </button>
          </>
        ) : (
          <>
            {item.href && (
              <Link href={item.href} className="btn btn-primary min-h-10">
                {item.source === 'practice' ? 'Open the plan' : 'Open in Games'} &rarr;
              </Link>
            )}
            {isFieldTime(item) && onPlanHere && (
              <button type="button" onClick={() => onPlanHere(item)} className="btn btn-primary min-h-10">
                Schedule a workout here
              </button>
            )}
            {item.source === 'event' && item.editable && (
              <button
                type="button"
                onClick={() => onEdit(item)}
                className={`btn min-h-10 ${isFieldTime(item) ? 'btn-ghost' : 'btn-primary'}`}
              >
                Edit
              </button>
            )}
            {avail && mine && (
              <button type="button" onClick={onEditAvailability} className="btn btn-primary min-h-10">
                Edit my availability
              </button>
            )}
            {item.editable && (item.source === 'event' || avail) && (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="btn btn-ghost min-h-10 !text-[var(--gh-maroon)]"
              >
                Delete
              </button>
            )}
            <button type="button" onClick={onClose} className="btn btn-ghost min-h-10 ml-auto">
              Close
            </button>
          </>
        )}
      </div>
    </>
  )
}

/** The little bar at the top of a bottom sheet that says "this pulls down". */
function Grabber() {
  return <div aria-hidden className="sm:hidden mx-auto mt-2 h-1.5 w-10 rounded-full bg-gray-200" />
}

/** Everybody who is out (or offering time) on one day, from the "Out:" line on a day. */
function OutList({
  target,
  onClose,
  onOpen,
}: {
  target: { day: Date; items: CalItem[] }
  onClose: () => void
  onOpen: (item: CalItem) => void
}) {
  const out = target.items.filter((i) => i.kind === 'unavailable')
  const free = target.items.filter((i) => i.kind === 'available')
  return (
    <>
      <Grabber />
      <div className="flex items-start gap-3 px-5 pt-3 sm:pt-5 pb-2">
        <div className="min-w-0 flex-1">
          <div className="section-label">Staff availability</div>
          <h2 className="text-lg font-black leading-snug">{longDay(target.day)}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 w-10 h-10 -mr-2 rounded-full text-2xl leading-none text-gray-400 hover:text-gray-800 hover:bg-gray-100"
        >
          &times;
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 space-y-4">
        {[
          { title: 'Out', list: out },
          { title: 'Available', list: free },
        ]
          .filter((g) => g.list.length > 0)
          .map((g) => (
            <div key={g.title}>
              <div className="text-[0.7rem] font-black tracking-[0.15em] uppercase text-gray-400 mb-1.5">{g.title}</div>
              <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
                {g.list.map((i) => {
                  const c = colorFor(i)
                  return (
                    <button
                      key={i.key}
                      type="button"
                      onClick={() => onOpen(i)}
                      className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-gray-50 min-h-11"
                    >
                      <span
                        aria-hidden
                        className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 border"
                        style={{ background: c.bg, borderColor: c.fg }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-gray-900">
                          {i.coachName || (i.coachEmail ?? '').split('@')[0]}
                        </span>
                        <span className="block text-xs text-gray-500">
                          {formatRange(i.startsAt, i.endsAt, i.allDay || isAllDayish(i))}
                          {i.notes ? ` — ${i.notes}` : ''}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        {out.length === 0 && free.length === 0 && (
          <p className="text-sm text-gray-500">The whole staff is around that day.</p>
        )}
      </div>
    </>
  )
}
