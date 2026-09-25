'use client'
import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { PriorityChip, PriorityEditForm } from '@/components/admin/PriorityBits'
import { GripDots, SortableList, type GripProps } from '@/components/admin/SortableList'
import { addPriorityAction, reorderPrioritiesAction, setPriorityAction } from '@/lib/actions'
import { DEFAULT_LEVEL, PRIORITY_LEVELS, isPositionList, type PriorityItem } from '@/lib/priorityLevels'

type PanelList = { id: string; name: string; items: PriorityItem[] }

/** How many lines "All" shows before counting the rest. */
const ALL_LINES = 6

/**
 * The War Room's priorities.
 *
 * "All" is the worst of everything, across every list. Pick a position or a
 * group and it is that list in the staff's own order — slide a row by its grip
 * to move it, and the order is kept for everyone.
 */
export function PrioritiesPanel({
  lists,
  canWrite,
  allHref,
}: {
  lists: PanelList[]
  canWrite: boolean
  /** Where "All priorities" goes; none on the page that already is all of them. */
  allHref?: string
}) {
  const [group, setGroup] = useState<string>('all')
  const [error, setError] = useState<string | null>(null)
  const listRefs = lists.map((l) => ({ id: l.id, name: l.name }))
  const open = (l: PanelList) => l.items.filter((i) => !i.done)
  const chosen = lists.find((l) => l.id === group) ?? null

  const allItems = lists
    .flatMap((l) => open(l).map((i) => ({ ...i, listName: l.name })))
    .sort((a, b) => b.level - a.level || (a.sortOrder ?? 1e9) - (b.sortOrder ?? 1e9) || a.createdAt.localeCompare(b.createdAt))
  const shown = chosen ? open(chosen).map((i) => ({ ...i, listName: chosen.name })) : allItems

  const counts = PRIORITY_LEVELS.slice()
    .reverse()
    .map((l) => ({ ...l, n: shown.filter((i) => i.level === l.level).length }))
    .filter((l) => l.n > 0)

  const positions = lists.filter((l) => isPositionList(l.name))
  const groups = lists.filter((l) => !isPositionList(l.name))
  const optionLabel = (l: PanelList) => {
    const n = open(l).length
    return n ? `${l.name} (${n})` : l.name
  }

  function reorder(ids: string[]) {
    if (!chosen) return
    setError(null)
    reorderPrioritiesAction(chosen.id, ids)
      .then((r) => {
        if (!r.ok) setError(r.error ?? 'Couldn’t save the order.')
      })
      .catch(() => setError('No connection — the order wasn’t saved.'))
  }

  return (
    <div>
      <label className="sr-only" htmlFor="priority-group">Which priorities</label>
      <select
        id="priority-group"
        value={group}
        onChange={(e) => setGroup(e.target.value)}
        className="field !py-1.5 text-sm font-bold mb-2"
      >
        <option value="all">All ({allItems.length})</option>
        {positions.length > 0 && (
          <optgroup label="Positions">
            {positions.map((l) => (
              <option key={l.id} value={l.id}>{optionLabel(l)}</option>
            ))}
          </optgroup>
        )}
        {groups.length > 0 && (
          <optgroup label="Groups">
            {groups.map((l) => (
              <option key={l.id} value={l.id}>{optionLabel(l)}</option>
            ))}
          </optgroup>
        )}
      </select>

      {counts.length > 0 && (
        <p className="text-xs text-gray-500 mb-2">
          {counts.map((l, i) => (
            <span key={l.level}>
              {i > 0 && ' · '}
              <span className="font-bold" style={{ color: l.level >= 3 ? '#b42318' : undefined }}>
                {l.n} {l.label}
              </span>
            </span>
          ))}{' '}
          open{chosen ? '' : ` across ${lists.length} list${lists.length === 1 ? '' : 's'}`}
          {chosen && canWrite && shown.length > 1 ? ' · slide ⠿ to reorder' : ''}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="text-sm text-gray-500">
          {lists.length === 0
            ? 'No lists yet. Start one and what the staff notices lands here.'
            : chosen
              ? `Nothing open on ${chosen.name}.`
              : 'Nothing open. Everything the staff flagged has been dealt with.'}
        </p>
      ) : chosen && canWrite ? (
        <SortableList
          items={shown}
          onReorder={reorder}
          className="space-y-1"
          itemClassName="py-0.5"
          label={(i) => i.body}
          renderItem={(item, grip) => (
            <PriorityRow item={item} lists={listRefs} canWrite={canWrite} grip={grip} />
          )}
        />
      ) : (
        <ul className="space-y-1.5">
          {(chosen ? shown : shown.slice(0, ALL_LINES)).map((item) => (
            <li key={item.id}>
              <PriorityRow item={item} lists={listRefs} canWrite={canWrite} />
            </li>
          ))}
        </ul>
      )}
      {!chosen && shown.length > ALL_LINES && (
        <p className="text-xs text-gray-400 mt-1">+{shown.length - ALL_LINES} more — pick a list to see it all</p>
      )}
      {error && <p className="text-xs font-semibold text-[var(--gh-maroon)] mt-1" role="alert">{error}</p>}

      {canWrite && lists.length > 0 && (
        /* The thirty-second capture: something went wrong at practice, it goes
           on the list without leaving the War Room. */
        <details className="mt-3" key={group}>
          <summary className="cursor-pointer text-sm font-semibold text-[var(--gh-green)] list-none">+ Add a priority</summary>
          <form action={addPriorityAction} className="mt-2 space-y-2">
            <input
              name="body"
              required
              maxLength={300}
              placeholder="e.g. Slides late off the ball carrier"
              aria-label="What needs work"
              className="field !py-1.5 text-sm"
            />
            <div className="flex gap-2">
              <select name="listId" defaultValue={chosen?.id ?? lists[0].id} aria-label="Which list" className="field !py-1.5 text-sm min-w-0 flex-1">
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <select name="level" defaultValue={DEFAULT_LEVEL} aria-label="How urgent" className="field !py-1.5 text-sm !w-auto">
                {PRIORITY_LEVELS.slice().reverse().map((l) => (
                  <option key={l.level} value={l.level}>{l.label}</option>
                ))}
              </select>
              <button type="submit" className="btn btn-primary !py-1.5 !px-3 text-sm">Add</button>
            </div>
          </form>
        </details>
      )}
      {allHref && (
        <Link href={allHref} className="inline-block mt-2 text-sm font-semibold text-[var(--gh-green)]">
          All priorities →
        </Link>
      )}
    </div>
  )
}

/** One open priority: its grip when the list can be ordered, tick it off, or fix it where it sits. */
export function PriorityRow({
  item,
  lists,
  canWrite,
  grip,
}: {
  item: { id: string; body: string; level: number; listId: string; listName: string }
  lists: { id: string; name: string }[]
  canWrite: boolean
  grip?: GripProps
}) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <div className="rounded-lg border border-gray-200 p-2">
        <PriorityEditForm item={item} lists={lists} onDone={() => setEditing(false)} />
      </div>
    )
  }

  let handle: ReactNode = null
  if (grip) {
    handle = (
      <span {...grip} className="shrink-0 -ml-1 px-1 pt-0.5 text-gray-300 hover:text-gray-600 select-none">
        <GripDots />
      </span>
    )
  }

  return (
    <div className="flex items-start gap-2">
      {handle}
      <span className="shrink-0 pt-0.5">
        <PriorityChip level={item.level} />
      </span>
      <span className="min-w-0 flex-1 text-sm leading-snug">
        {item.body}
        <span className="block text-[0.7rem] text-gray-400">{item.listName}</span>
      </span>
      {canWrite && (
        <>
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Edit: ${item.body}`}
            className="shrink-0 text-xs font-semibold text-gray-400 hover:text-[var(--gh-green)] px-1 pt-1"
          >
            Edit
          </button>
          <form action={setPriorityAction} className="shrink-0">
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="done" value="true" />
            <button
              type="submit"
              aria-label={`Mark done: ${item.body}`}
              title="Mark done"
              className="w-7 h-7 inline-flex items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:border-[var(--gh-green)] hover:text-[var(--gh-green)] text-xs font-black"
            >
              ✓
            </button>
          </form>
        </>
      )}
    </div>
  )
}
