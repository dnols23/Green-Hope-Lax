'use client'
import { useState, useTransition } from 'react'
import {
  addPriorityAction,
  addPriorityListAction,
  deletePriorityAction,
  deletePriorityListAction,
  renamePriorityListAction,
  setPriorityAction,
} from '@/lib/actions'
import { DEFAULT_LEVEL, PRIORITY_LEVELS, levelOf, type PriorityList } from '@/lib/priorityLevels'
import { LevelSlider, PriorityChip } from '@/components/admin/PriorityBits'
import { teamLabel, withTeam, type Team } from '@/lib/teams'
import Link from 'next/link'

/**
 * Keeping the lists.
 *
 * Built around the thirty seconds it has to take on a sideline: pick the list,
 * type the thing, slide how badly it matters, done. Everything else — renaming,
 * reordering, ticking off — is for Sunday.
 */
export function PrioritiesClient({
  lists,
  ready,
  team,
  locked,
}: {
  lists: PriorityList[]
  ready: boolean
  team: Team
  /** This coach only works one side of the program — no switch to offer. */
  locked: boolean
}) {
  const [openList, setOpenList] = useState<string | null>(lists[0]?.id ?? null)
  const [body, setBody] = useState('')
  const [level, setLevel] = useState(DEFAULT_LEVEL)
  const [saving, startSaving] = useTransition()
  const [newList, setNewList] = useState('')
  const [showDone, setShowDone] = useState(false)

  const active = lists.find((l) => l.id === openList) ?? lists[0] ?? null

  function add() {
    if (!active || !body.trim()) return
    const data = new FormData()
    data.set('listId', active.id)
    data.set('body', body.trim())
    data.set('level', String(level))
    startSaving(async () => {
      await addPriorityAction(data)
      setBody('')
    })
  }

  function setOn(id: string, next: Record<string, string>) {
    const data = new FormData()
    data.set('id', id)
    for (const [k, v] of Object.entries(next)) data.set(k, v)
    startSaving(() => setPriorityAction(data))
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h1 className="text-xl font-black">
            {team === 'varsity' ? 'Priorities' : `${teamLabel(team)} Priorities`}
          </h1>
          {/* The other staff's list, one tap away — and never the same list.
              Left out for a coach who only works one side of the program. */}
          {!locked && (
            <Link
              href={withTeam('/admin/priorities', team === 'varsity' ? 'jv' : 'varsity')}
              className="text-xs font-bold px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 hover:border-[var(--gh-green)] hover:text-[var(--gh-green)]"
            >
              {team === 'varsity' ? 'JV' : 'Varsity'} &rarr;
            </Link>
          )}
        </div>
        <p className="text-gray-500 text-sm">
          What you noticed on the sideline, kept where practice planning starts. This is the{' '}
          <strong>{teamLabel(team)}</strong> list
          {!locked && ` — ${team === 'varsity' ? 'JV' : 'varsity'} keeps its own, so nothing lands in the wrong place`}
          . Every practice plan and game plan has a Review
          priorities button that opens the list for that plan&rsquo;s team.
        </p>
      </div>

      {!ready && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-900 font-bold mb-1">Priorities aren&rsquo;t switched on yet.</p>
          <p className="text-sm text-amber-900">
            Run <code>supabase/migrations/0030_priorities.sql</code> in the Supabase SQL editor.
            Nothing else on the site is affected.
          </p>
        </div>
      )}

      {/* The lists, as tabs. Offense, Defense, Man-down — whatever the staff keeps. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {lists.map((l) => {
          const live = l.items.filter((i) => !i.done)
          const worst = live.length ? Math.max(...live.map((i) => i.level)) : 0
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => setOpenList(l.id)}
              className="px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors inline-flex items-center gap-1.5"
              style={{
                background: active?.id === l.id ? 'var(--gh-green)' : '#fff',
                color: active?.id === l.id ? '#fff' : '#4b5563',
                borderColor: active?.id === l.id ? 'var(--gh-green)' : '#e5e7eb',
              }}
            >
              {worst > 0 && (
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ background: levelOf(worst).color }}
                  aria-hidden
                />
              )}
              {l.name}
              {live.length > 0 && (
                <span className={active?.id === l.id ? 'text-white/60' : 'text-gray-400'}>
                  {live.length}
                </span>
              )}
            </button>
          )
        })}

        <form action={addPriorityListAction} className="inline-flex items-center gap-1">
          <input type="hidden" name="team" value={team} />
          <input
            name="name"
            value={newList}
            onChange={(e) => setNewList(e.target.value)}
            placeholder="New list"
            className="field !py-1.5 !w-28 text-sm"
          />
          <button type="submit" disabled={!newList.trim()} className="btn btn-ghost !py-1.5 text-sm disabled:opacity-40">
            Add
          </button>
        </form>
      </div>

      {active && (
        <>
          {/* Thirty seconds on a sideline: type it, slide it, done. */}
          <div className="card p-4 space-y-3">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  add()
                }
              }}
              placeholder={`What did you see? (${active.name})`}
              className="field w-full"
            />
            <div className="flex items-center gap-3 flex-wrap">
              <LevelSlider value={level} onChange={setLevel} />
              <button
                type="button"
                onClick={add}
                disabled={!body.trim() || saving || !ready}
                className="btn btn-primary !py-1.5 text-sm disabled:opacity-50 ml-auto"
              >
                {saving ? 'Saving…' : 'Add it'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <h2 className="text-[0.7rem] font-black tracking-[0.15em] uppercase text-gray-400">
              {active.name}
            </h2>
            <button
              type="button"
              onClick={() => setShowDone(!showDone)}
              className="text-xs font-bold text-gray-400 hover:text-gray-700"
            >
              {showDone ? 'Hide what is done' : 'Show what is done'}
            </button>
            <form action={renamePriorityListAction} className="ml-auto inline-flex items-center gap-1">
              <input type="hidden" name="id" value={active.id} />
              <input
                name="name"
                defaultValue={active.name}
                key={active.id}
                className="field !py-1 !w-32 text-xs"
                aria-label="Rename this list"
              />
              <button type="submit" className="text-xs font-semibold text-gray-400 hover:text-gray-700">
                Rename
              </button>
            </form>
            <form action={deletePriorityListAction}>
              <input type="hidden" name="id" value={active.id} />
              <button type="submit" className="text-xs font-semibold text-gray-300 hover:text-[var(--gh-maroon)]">
                Delete list
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
            {active.items.filter((i) => showDone || !i.done).length === 0 ? (
              <p className="text-sm text-gray-400 px-4 py-6">
                Nothing on this list. Which is either very good news or the season has not started.
              </p>
            ) : (
              active.items
                .filter((i) => showDone || !i.done)
                .map((item) => (
                  <div key={item.id} className="px-4 py-3 flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={(e) => setOn(item.id, { done: String(e.target.checked) })}
                      aria-label={item.done ? 'Put it back on the list' : 'Mark it done'}
                      className="w-4 h-4 accent-[var(--gh-green)] mt-1 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-sm font-semibold ${item.done ? 'line-through text-gray-400' : ''}`}
                      >
                        {item.body}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <PriorityChip level={item.level} />
                        <LevelSlider
                          value={item.level}
                          onChange={(v) => setOn(item.id, { level: String(v) })}
                          compact
                        />
                        {item.createdBy && (
                          <span className="text-xs text-gray-400">{item.createdBy}</span>
                        )}
                      </div>
                    </div>
                    <form action={deletePriorityAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <button
                        type="submit"
                        aria-label="Delete"
                        className="text-xs font-semibold text-gray-300 hover:text-[var(--gh-maroon)]"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                ))
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
            <span className="font-bold uppercase tracking-wider">Scale</span>
            {PRIORITY_LEVELS.map((l) => (
              <span key={l.level} className="inline-flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
                {l.label} — {l.blurb}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
