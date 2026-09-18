'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PriorityChip } from '@/components/admin/PriorityBits'
import type { PriorityList } from '@/lib/priorityLevels'

/**
 * The lists, over the plan you are writing.
 *
 * The whole reason for writing something down on a sideline is that it is in
 * front of you when the plan is being made, so this is a button on the plan
 * rather than another page to remember to visit. What is already done stays
 * hidden — this is the list of what is left.
 */
export function ReviewPriorities() {
  const [open, setOpen] = useState(false)
  const [lists, setLists] = useState<PriorityList[] | null>(null)
  const [ready, setReady] = useState(true)

  useEffect(() => {
    if (!open || lists) return
    let live = true
    fetch('/api/priorities')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('no'))))
      .then((d: { ready?: boolean; lists?: PriorityList[] }) => {
        if (!live) return
        setReady(d.ready !== false)
        setLists(d.lists ?? [])
      })
      .catch(() => live && setLists([]))
    return () => {
      live = false
    }
  }, [open, lists])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const live = (lists ?? []).map((l) => ({ ...l, items: l.items.filter((i) => !i.done) }))
  const anything = live.some((l) => l.items.length > 0)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-ghost !py-1.5 text-sm"
        title="What the staff said needs work"
      >
        Review priorities
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
            style={{ background: 'rgba(0,0,0,0.35)' }}
          />
          <div
            role="dialog"
            aria-label="Priorities"
            className="fixed z-50 inset-x-3 top-[8vh] mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-2xl"
            style={{ maxHeight: '80vh', overflowY: 'auto' }}
          >
            <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="font-black">Priorities</h2>
              <Link
                href="/admin/priorities"
                className="text-xs font-bold text-[var(--gh-green)]"
                onClick={() => setOpen(false)}
              >
                Keep the lists →
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-auto text-sm font-bold text-gray-400 hover:text-gray-700"
              >
                Close
              </button>
            </div>

            <div className="px-5 py-4 space-y-5">
              {lists === null && <p className="text-sm text-gray-400">Opening…</p>}

              {lists !== null && !ready && (
                <p className="text-sm text-amber-900">
                  Priorities aren&rsquo;t switched on yet — run{' '}
                  <code>supabase/migrations/0030_priorities.sql</code> in the Supabase SQL editor.
                </p>
              )}

              {lists !== null && ready && !anything && (
                <p className="text-sm text-gray-400">
                  Nothing on the lists. Add what you see from the Priorities page — or from the
                  sideline, on your phone.
                </p>
              )}

              {live
                .filter((l) => l.items.length > 0)
                .map((l) => (
                  <section key={l.id}>
                    <h3 className="text-[0.7rem] font-black tracking-[0.15em] uppercase text-gray-400 mb-1.5">
                      {l.name} <span className="text-gray-300">· {l.items.length}</span>
                    </h3>
                    <ul className="space-y-1.5">
                      {l.items.map((i) => (
                        <li key={i.id} className="flex items-start gap-2">
                          <PriorityChip level={i.level} />
                          <span className="text-sm">{i.body}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}
