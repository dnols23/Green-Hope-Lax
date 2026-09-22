'use client'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { SlideView, type SlidePlay } from '@/components/playbook/SlideView'
import { orderPlaybook } from '@/lib/playbookActions'
import { reorder, type PlaybookPage } from '@/lib/playbook'
import { withTeam, type Team } from '@/lib/teams'

/**
 * The deck, as cards you can pick up and move.
 *
 * Order is the whole point of a playbook — it is the order you install in — so
 * moving a page is a drag or two taps, not a number you type into a box.
 */
export function DeckGrid({
  pages,
  plays,
  team,
  canEdit,
}: {
  pages: PlaybookPage[]
  plays: Record<string, SlidePlay>
  team: Team
  canEdit: boolean
}) {
  const [order, setOrder] = useState<string[]>(pages.map((p) => p.id))
  const [dragId, setDragId] = useState<string | null>(null)
  const [, startSaving] = useTransition()

  const byId = new Map(pages.map((p) => [p.id, p]))
  const shown = order.map((id) => byId.get(id)).filter((p): p is PlaybookPage => !!p)

  function persist(ids: string[]) {
    setOrder(ids)
    const data = new FormData()
    data.set('ids', ids.join(','))
    startSaving(() => orderPlaybook(data))
  }

  function move(id: string, by: number) {
    const from = order.indexOf(id)
    persist(reorder(order, from, from + by))
  }

  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return
    persist(reorder(order, order.indexOf(dragId), order.indexOf(targetId)))
    setDragId(null)
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {shown.map((page, i) => (
        <div
          key={page.id}
          draggable={canEdit}
          onDragStart={() => setDragId(page.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => dropOn(page.id)}
          onDragEnd={() => setDragId(null)}
          className="card p-3 flex flex-col"
          style={{ opacity: dragId === page.id ? 0.4 : 1 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-black text-gray-300 tabular-nums">{i + 1}</span>
            {canEdit && (
              <span aria-hidden title="Drag to reorder" className="cursor-grab select-none text-gray-300 text-sm">
                ☰
              </span>
            )}
            <span className="ml-auto flex items-center gap-1">
              {canEdit && (
                <>
                  <button
                    type="button"
                    aria-label={`Move ${page.title || 'page'} earlier`}
                    onClick={() => move(page.id, -1)}
                    className="px-1 text-xs text-gray-400 hover:text-gray-700"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${page.title || 'page'} later`}
                    onClick={() => move(page.id, 1)}
                    className="px-1 text-xs text-gray-400 hover:text-gray-700"
                  >
                    →
                  </button>
                </>
              )}
            </span>
          </div>

          {/* A card is the page itself, shrunk — so the deck screen is a
              contact sheet rather than a list of names. */}
          <div className="rounded-lg border border-gray-100 bg-white p-2 overflow-hidden" style={{ aspectRatio: '4 / 3' }}>
            <SlideView page={page} plays={plays} scale="thumb" />
          </div>

          {canEdit && (
            <Link
              href={withTeam(`/admin/playbook/${page.id}`, team)}
              className="text-xs font-bold text-[var(--gh-green)] mt-2 self-start"
            >
              Edit this page →
            </Link>
          )}
        </div>
      ))}
    </div>
  )
}
