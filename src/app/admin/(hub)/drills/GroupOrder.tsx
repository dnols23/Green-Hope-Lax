'use client'

import { useState, useTransition } from 'react'
import { SlideList } from '@/components/admin/SlideList'
import { saveDrillOrder } from '@/lib/drillActions'

type Group = { id: string; label: string; icon: string }

/** Slide the bank's groups into the order the staff wants. Saved on every drop. */
export function GroupOrder({ groups }: { groups: Group[] }) {
  const [open, setOpen] = useState(false)
  const [list, setList] = useState(groups)
  const [saving, start] = useTransition()

  function reorder(ids: string[]) {
    const next = ids.map((id) => list.find((g) => g.id === id)).filter((g): g is Group => !!g)
    setList(next)
    start(async () => {
      await saveDrillOrder(next.map((g) => g.id))
    })
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`min-h-9 px-3 rounded-full border text-sm font-bold ${
          open ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-700 bg-white'
        }`}
      >
        {open ? 'Done' : '↕ Reorder'}
      </button>
      {open && (
        <div className="card p-2 mt-2">
          <SlideList
            items={list}
            onReorder={reorder}
            label={(g) => g.label}
            className="space-y-1"
            renderItem={(g, grip, dragging) => (
              <div
                className={`flex items-center gap-2 rounded-lg border px-3 min-h-11 ${dragging ? 'shadow-lg' : ''}`}
                style={{ background: 'var(--surface, #fff)', borderColor: 'var(--border)' }}
              >
                <span className="text-sm font-bold flex-1">
                  {g.icon} {g.label}
                </span>
                {grip && (
                  <span {...grip} className="px-2 py-2 text-lg leading-none select-none text-gray-400">
                    ☰
                  </span>
                )}
              </div>
            )}
          />
          <p className="text-xs text-gray-400 mt-1.5 px-1" role="status">{saving ? 'Saving…' : 'Drag ☰ to move.'}</p>
        </div>
      )}
    </div>
  )
}
