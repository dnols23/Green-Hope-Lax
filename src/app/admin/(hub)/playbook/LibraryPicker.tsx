'use client'
import Link from 'next/link'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { SlideView, type SlidePlay } from '@/components/playbook/SlideView'
import type { PlaybookPage } from '@/lib/playbook'
import type { Team } from '@/lib/teams'

/** A play on the head coach's shelf, as the picker needs it. */
export interface ShelfPlay {
  id: string
  name: string
  /** How many steps, when it is a progression (0 when it isn't). */
  steps: number
}

/** A play drawn as the field page it would become, for its thumbnail. */
function asPage(play: ShelfPlay, team: Team): PlaybookPage {
  return {
    id: `pick-${play.id}`,
    team,
    sortOrder: 0,
    section: null,
    title: '',
    blocks: [{ kind: 'play', id: 'b1', playId: play.id }],
    layout: 'field',
    notes: null,
    createdBy: null,
    updatedAt: '',
  }
}

/**
 * "From the Library…": the plays already drawn, small enough to see a dozen at
 * once. Picking one puts it in the section being looked at; a progression
 * comes in as one page per step.
 */
export function LibraryPicker({
  shelf,
  plays,
  team,
  inDeck,
  sectionName,
  busyId,
  onPick,
  onClose,
}: {
  shelf: ShelfPlay[]
  plays: Record<string, SlidePlay>
  team: Team
  /** Plays this playbook already shows. */
  inDeck: Set<string>
  sectionName: string
  /** The play being added right now. */
  busyId: string | null
  onPick: (play: ShelfPlay) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const search = useRef<HTMLInputElement>(null)

  const close = useEffectEvent(() => onClose())
  useEffect(() => {
    // Straight into the search box with a mouse; on a phone the keyboard would
    // cover the plays before anybody asked to type.
    if (window.matchMedia('(pointer: fine)').matches) search.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const needle = q.trim().toLowerCase()
  const shown = needle ? shelf.filter((p) => p.name.toLowerCase().includes(needle)) : shelf

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add from the Library"
        onClick={(e) => e.stopPropagation()}
        className="card w-full sm:max-w-3xl h-[88dvh] sm:h-[80vh] flex flex-col shadow-xl rounded-b-none sm:rounded-b-xl overflow-hidden"
      >
        <div className="px-4 sm:px-5 pt-4 pb-3 flex items-start gap-3">
          <div className="min-w-0">
            <h2 className="font-black text-lg leading-tight">Add from the Library</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Goes in {sectionName}. A progression comes in as one page per step.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto -mr-1 w-9 h-9 shrink-0 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>
        <div className="px-4 sm:px-5 pb-3">
          <input
            ref={search}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your plays"
            aria-label="Search your plays"
            className="field"
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 pb-5 border-t border-[var(--border)] pt-4">
          {shelf.length === 0 ? (
            <p className="text-sm text-gray-500">
              Nothing saved yet. Draw a play on the{' '}
              <Link href="/admin/playboard" className="font-bold text-[var(--gh-green)]">Playboard</Link> and hit Save.
            </p>
          ) : shown.length === 0 ? (
            <p className="text-sm text-gray-500">No play called that.</p>
          ) : (
            <ul className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-4">
              {shown.map((p) => {
                const here = inDeck.has(p.id)
                const busy = busyId === p.id
                return (
                  <li key={p.id} className="group relative">
                    <div className="relative keep-light rounded-lg overflow-hidden border border-[var(--border)] group-hover:border-[var(--gh-green)] transition-colors">
                      {/* No pointer events: the little field would otherwise open full screen on a double tap. */}
                      <div className="pointer-events-none [&_button]:hidden">
                        <SlideView page={asPage(p, team)} plays={plays} scale="thumb" />
                      </div>
                      {busy && (
                        <div className="absolute inset-0 grid place-items-center bg-white/70 text-xs font-bold text-gray-700">
                          Adding…
                        </div>
                      )}
                    </div>
                    <div className="mt-1.5 text-sm font-semibold truncate">{p.name}</div>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 min-h-[1.1rem]">
                      {p.steps > 1 && <span className="text-[0.65rem] font-bold text-gray-500">{p.steps} steps</span>}
                      {here && <span className="text-[0.65rem] font-bold text-[var(--gh-green)]">✓ In this playbook</span>}
                    </div>
                    {/* The whole tile picks, laid over it: the field inside has buttons of its own, and a button can't hold one. */}
                    <button
                      type="button"
                      onClick={() => onPick(p)}
                      disabled={!!busyId}
                      aria-label={`${p.name}${p.steps > 1 ? `, ${p.steps} steps` : ''}${here ? ', already in this playbook' : ''}`}
                      title={here ? 'Already in this playbook — picking it brings it up to date' : `Add ${p.name}`}
                      className="absolute inset-0 rounded-lg disabled:cursor-wait"
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <div className="px-4 sm:px-5 py-3 border-t border-[var(--border)] text-xs text-gray-500">
          Not there?{' '}
          <Link href="/admin/playboard" className="font-bold text-[var(--gh-green)]">Draw it on the Playboard</Link>
          {' '}— save it, and it&rsquo;s here.
        </div>
      </div>
    </div>
  )
}
