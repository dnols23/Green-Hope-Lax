'use client'
import { memo, useEffect, useRef, useState } from 'react'
import { SlideView, type SlidePlay } from '@/components/playbook/SlideView'
import { PLAYBOOK_SECTIONS, deckRuns, deckSections, isPageKind, sectionLabel, type PlaybookPage, type PlaybookSection } from '@/lib/playbook'
import { anchorAt, anchorUnder, type Anchor } from './Menus'

/** Where a dragged page lands: before a page, or at the end of a section. */
export interface DropTarget {
  section: PlaybookSection | null
  beforeId: string | null
}

/* The page itself, shrunk. Only redrawn when that page changes, so typing on
   one page doesn't redraw forty fields down the side. */
const ThumbArt = memo(function ThumbArt({ page, plays }: { page: PlaybookPage; plays: Record<string, SlidePlay> }) {
  return <SlideView page={page} plays={plays} scale="thumb" />
})

/** Wide enough for the strip to sit beside the page rather than above it. */
const wide = () => window.matchMedia('(min-width: 1024px)').matches

/**
 * Every page of this team's playbook, down the side — the way Google Slides
 * shows a deck. Grouped by section, a progression's step pages bracketed
 * together, the page being edited lit up. Click to go to a page, drag to move
 * one (a progression moves as one), right-click or ⋯ for the rest. On a phone
 * it is a strip across the top instead.
 */
export function Filmstrip({
  pages,
  plays,
  currentId,
  adding,
  onOpen,
  onMenu,
  onNew,
  onPlace,
}: {
  /** In reading order (orderedDeck). */
  pages: PlaybookPage[]
  plays: Record<string, SlidePlay>
  currentId: string
  adding: boolean
  onOpen: (id: string) => void
  onMenu: (id: string, at: Anchor) => void
  /** A new slide: in this section, after this page (null: after the page being edited). */
  onNew: (section: PlaybookSection | null, afterId: string | null, at: Anchor) => void
  onPlace: (ids: string[], target: DropTarget) => void
}) {
  const list = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<string[] | null>(null)
  const [target, setTarget] = useState<DropTarget | null>(null)

  const number = new Map(pages.map((p, i) => [p.id, i + 1]))
  const groups = deckSections(pages).map((g) => ({ ...g, runs: deckRuns(g.pages) }))

  // The page being edited, kept in view — scrolling the strip only, never the page.
  useEffect(() => {
    const box = list.current
    const el = box?.querySelector<HTMLElement>(`[data-page="${currentId}"]`)
    if (!box || !el) return
    const b = box.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    if (r.top < b.top) box.scrollTop -= b.top - r.top + 24
    else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom + 12
    if (r.left < b.left) box.scrollLeft -= b.left - r.left + 12
    else if (r.right > b.right) box.scrollLeft += r.right - b.right + 12
  }, [currentId])

  const same = (a: DropTarget | null, b: DropTarget) => !!a && a.section === b.section && a.beforeId === b.beforeId
  function aim(next: DropTarget) {
    // Dropping a page just before itself goes nowhere; don't pretend it will.
    if (next.beforeId && dragging?.includes(next.beforeId)) return
    setTarget((t) => (same(t, next) ? t : next))
  }
  function land(e: React.DragEvent) {
    e.preventDefault()
    if (dragging && target) onPlace(dragging, target)
    setDragging(null)
    setTarget(null)
  }

  return (
    <nav aria-label="Pages" className="w-full lg:w-44 shrink-0 flex lg:block gap-2 lg:sticky lg:top-4 min-w-0">
      <button
        type="button"
        disabled={adding}
        onClick={(e) => onNew(null, null, anchorUnder(e.currentTarget))}
        className="shrink-0 btn btn-ghost !rounded-lg !px-2 !py-1 lg:!py-1.5 lg:w-full text-sm flex-col lg:flex-row gap-0 lg:gap-1.5 self-stretch lg:mb-3 disabled:opacity-50"
        aria-label="New slide, after this one"
      >
        <span aria-hidden className="text-lg leading-none lg:text-base">＋</span>
        <span className="text-[0.65rem] lg:text-sm leading-tight">{adding ? 'Adding…' : <>New<span className="hidden lg:inline"> slide</span></>}</span>
      </button>

      <div
        ref={list}
        className="flex-1 min-w-0 flex lg:flex-col gap-4 lg:gap-3 overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto lg:max-h-[calc(100dvh-11rem)] pb-2 lg:pb-4 lg:pr-1 overscroll-contain"
        onDragOver={(e) => dragging && e.preventDefault()}
        onDrop={land}
      >
        {groups.map((g) => {
          const icon = PLAYBOOK_SECTIONS.find((s) => s.key === g.section)?.icon ?? '·'
          const last = g.pages[g.pages.length - 1]
          return (
            <section key={g.section ?? 'none'} className="shrink-0 flex flex-col gap-1.5" aria-label={sectionLabel(g.section)}>
              <h3
                className="text-[0.6rem] font-black uppercase tracking-[0.14em] text-gray-400 truncate lg:pl-5"
                onDragOver={(e) => {
                  if (!dragging) return
                  e.preventDefault()
                  aim({ section: g.section, beforeId: g.pages[0].id })
                }}
              >
                <span aria-hidden className="mr-1">{icon}</span>
                {sectionLabel(g.section)}
              </h3>

              <div className="flex lg:flex-col gap-2">
                {g.runs.map((run, ri) => {
                  const ids = run.pages.map((p) => p.id)
                  const next = g.runs[ri + 1]?.pages[0].id ?? null
                  const before = target?.section === g.section && target.beforeId === ids[0]
                  const after = target?.section === g.section && target.beforeId === null && ri === g.runs.length - 1
                  const bracket = run.playId && run.pages.length > 1
                  return (
                    <div
                      key={ids[0]}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', ids.join(','))
                        setDragging(ids)
                      }}
                      onDragEnd={() => {
                        setDragging(null)
                        setTarget(null)
                      }}
                      onDragOver={(e) => {
                        if (!dragging) return
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        const r = e.currentTarget.getBoundingClientRect()
                        const late = wide() ? e.clientY > r.top + r.height / 2 : e.clientX > r.left + r.width / 2
                        aim({ section: g.section, beforeId: late ? next : ids[0] })
                      }}
                      className={`relative flex flex-col gap-1 ${dragging?.includes(ids[0]) ? 'opacity-40' : ''} ${
                        bracket ? 'rounded-md bg-gray-100/70 p-1 lg:ml-3.5 lg:pl-1.5 border-[var(--gh-green)]/40 border-b-2 lg:border-b-0 lg:border-l-2' : ''
                      }`}
                    >
                      {before && <DropLine where="before" />}
                      {after && <DropLine where="after" />}
                      {bracket && (
                        <div className="text-[0.6rem] font-bold text-gray-500 truncate px-0.5">
                          {plays[run.playId!]?.name ?? 'Progression'} · {run.pages.length} steps
                        </div>
                      )}
                      <div className="flex lg:flex-col gap-2">
                        {run.pages.map((p) => (
                          <Thumb
                            key={p.id}
                            page={p}
                            plays={plays}
                            n={number.get(p.id) ?? 0}
                            current={p.id === currentId}
                            inRun={!!bracket}
                            onOpen={onOpen}
                            onMenu={onMenu}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}

                {/* A page at the end of this section. Also where a drag lands to go last. */}
                <button
                  type="button"
                  disabled={adding}
                  onClick={(e) => onNew(g.section, last.id, anchorUnder(e.currentTarget))}
                  onDragOver={(e) => {
                    if (!dragging) return
                    e.preventDefault()
                    aim({ section: g.section, beforeId: null })
                  }}
                  aria-label={`New slide at the end of ${sectionLabel(g.section)}`}
                  className="hidden lg:flex ml-5 items-center justify-center rounded-md border border-dashed border-gray-200 text-gray-300 hover:text-[var(--gh-green)] hover:border-[var(--gh-green)] text-sm leading-none py-1 disabled:opacity-50"
                >
                  ＋
                </button>
              </div>
            </section>
          )
        })}
      </div>
    </nav>
  )
}

function DropLine({ where }: { where: 'before' | 'after' }) {
  return (
    <span
      aria-hidden
      className={`absolute z-10 rounded-full bg-[var(--gh-green)] top-0 bottom-0 w-[3px] lg:w-auto lg:h-[3px] lg:left-0 lg:right-0 ${
        where === 'before' ? '-left-[6px] lg:bottom-auto lg:-top-[6px]' : '-right-[6px] lg:top-auto lg:-bottom-[6px]'
      }`}
    />
  )
}

function Thumb({
  page,
  plays,
  n,
  current,
  inRun,
  onOpen,
  onMenu,
}: {
  page: PlaybookPage
  plays: Record<string, SlidePlay>
  n: number
  current: boolean
  inRun: boolean
  onOpen: (id: string) => void
  onMenu: (id: string, at: Anchor) => void
}) {
  const name = page.title || 'Untitled'
  return (
    <div data-page={page.id} className="group relative flex items-start gap-1.5 shrink-0">
      <span
        className={`hidden lg:block w-3.5 shrink-0 pt-0.5 text-right text-[0.6rem] font-bold tabular-nums ${current ? 'text-[var(--gh-green)]' : 'text-gray-400'} ${inRun ? 'lg:hidden' : ''}`}
      >
        {n}
      </span>
      <div
        role="button"
        tabIndex={0}
        aria-current={current ? 'page' : undefined}
        aria-label={`Page ${n}: ${name}`}
        title={name}
        onClick={() => onOpen(page.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpen(page.id)
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          onMenu(page.id, anchorAt(e.clientX, e.clientY))
        }}
        className={`keep-light relative w-28 lg:w-auto lg:flex-1 min-w-0 rounded-md overflow-hidden bg-white cursor-pointer outline-none focus-visible:ring-offset-2 ${
          current ? 'ring-2 ring-[var(--gh-green)]' : 'ring-1 ring-gray-200 hover:ring-gray-400 focus-visible:ring-2 focus-visible:ring-gray-400'
        }`}
        style={{ aspectRatio: '16 / 9' }}
      >
        {/* Only a picture here: the board's own zoom button has no business on a thumbnail. */}
        <div className={`absolute inset-0 pointer-events-none [&_button]:!hidden ${isPageKind(page.layout) ? '' : 'p-1'}`}>
          <ThumbArt page={page} plays={plays} />
        </div>
        <span className={`absolute bottom-0.5 left-0.5 rounded bg-black/45 px-1 text-[0.55rem] font-bold text-white tabular-nums pointer-events-none ${inRun ? '' : 'lg:hidden'}`}>
          {n}
        </span>
      </div>
      <button
        type="button"
        aria-label={`Options for ${name}`}
        onClick={(e) => onMenu(page.id, anchorUnder(e.currentTarget))}
        className={`absolute top-0.5 right-0.5 h-6 w-6 rounded-md bg-white/90 text-gray-600 text-sm leading-none shadow-sm hover:bg-white focus:opacity-100 ${
          current ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        ⋯
      </button>
    </div>
  )
}
