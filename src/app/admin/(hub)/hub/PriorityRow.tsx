'use client'
import { useState } from 'react'
import { PriorityChip, PriorityEditForm } from '@/components/admin/PriorityBits'
import { setPriorityAction } from '@/lib/actions'

/** One open priority in the War Room: tick it off, or fix it where it sits. */
export function PriorityRow({
  item,
  lists,
  canWrite,
}: {
  item: { id: string; body: string; level: number; listId: string; listName: string }
  lists: { id: string; name: string }[]
  canWrite: boolean
}) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <li className="rounded-lg border border-gray-200 p-2">
        <PriorityEditForm item={item} lists={lists} onDone={() => setEditing(false)} />
      </li>
    )
  }

  return (
    <li className="flex items-start gap-2">
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
    </li>
  )
}
