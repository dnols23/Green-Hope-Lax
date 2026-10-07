'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, type ReactNode } from 'react'
import { SlideList } from '@/components/admin/SlideList'
import { saveDrillOrder } from '@/lib/drillActions'

/**
 * The bank's categories, each draggable by the ☰ beside it — pick one up and
 * slide it above or below the others, right where they are. Saved on drop.
 * `order` is every group in the staff's order, including the empty ones not
 * drawn, so they keep their place.
 */
export function DrillGroupList({
  groups,
  order,
  canMove,
}: {
  groups: { id: string; label: string; node: ReactNode }[]
  order: string[]
  canMove: boolean
}) {
  const router = useRouter()
  /* Only the order is held here, and only while a drag is being saved. The
     groups themselves always come from the page, so a drill added or deleted
     shows the moment the page refreshes. (Holding the groups in state froze
     the list at first load: new drills never appeared, deleted ones never left.) */
  const [moved, setMoved] = useState<string[] | null>(null)
  const [, start] = useTransition()
  const list = moved
    ? [
        ...moved.map((id) => groups.find((g) => g.id === id)).filter((g): g is (typeof groups)[number] => !!g),
        ...groups.filter((g) => !moved.includes(g.id)),
      ]
    : groups

  function reorder(ids: string[]) {
    setMoved(ids)
    // Shown groups take their new order; the hidden ones keep their spots around them.
    const shown = new Set(ids)
    const queue = [...ids]
    const full = order.map((k) => (shown.has(k) ? queue.shift()! : k))
    start(async () => {
      await saveDrillOrder(full)
      // The new order comes back as a new key on this list, which starts it fresh.
      router.refresh()
    })
  }

  return (
    <SlideList
      items={list}
      locked={!canMove}
      onReorder={reorder}
      label={(g) => g.label}
      className="space-y-4"
      renderItem={(g, grip, dragging) => (
        <div className={`flex items-start gap-1 ${dragging ? 'shadow-xl rounded-2xl' : ''}`}>
          {grip && (
            <span
              {...grip}
              title="Drag to move this category"
              className="mt-3.5 -ml-1 w-7 h-8 shrink-0 grid place-items-center rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 select-none"
            >
              ☰
            </span>
          )}
          <div className="flex-1 min-w-0">{g.node}</div>
        </div>
      )}
    />
  )
}
