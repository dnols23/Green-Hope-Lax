'use client'
import { useRef } from 'react'
import { SlideView, type SlidePlay } from '@/components/playbook/SlideView'
import { FieldPageView } from '@/components/playbook/KindPages'
import { Stage } from '@/components/playbook/Stage'
import {
  SLIDE_H,
  SLIDE_W,
  deckRuns,
  firstOf,
  isFree,
  isPageKind,
  orderedDeck,
  type DeckRun,
  type PlaybookPage,
} from '@/lib/playbook'

/**
 * What Present and the players' playbook share: a page drawn as a slide, a
 * progression drawn as one slide that builds, and the deck as both pages and
 * slides.
 *
 * Next and back move a page at a time, so a progression's steps come in one
 * after another like a build in Slides; the counter, the grid and the cards
 * count slides, so a play in four steps is one play.
 */

export interface Deck {
  /** Every page, in reading order. */
  pages: PlaybookPage[]
  /** The same pages as slides: a progression's steps are one. */
  runs: DeckRun[]
  /** Page index → the slide it is on, and which step of it. */
  where: { run: number; step: number }[]
  /** Slide index → the index of its first page. */
  starts: number[]
}

export function buildDeck(pages: PlaybookPage[]): Deck {
  const ordered = orderedDeck(pages)
  const runs = deckRuns(ordered)
  const where: Deck['where'] = []
  const starts: number[] = []
  runs.forEach((run, r) => {
    starts.push(where.length)
    run.pages.forEach((_, step) => where.push({ run: r, step }))
  })
  return { pages: ordered, runs, where, starts }
}

/** A run the size of one page is a page, whatever made it. */
export const isProgression = (run: DeckRun) => run.pages.length > 1

/** What a slide is called: the play, for a progression; the page's title otherwise. */
export function runName(run: DeckRun, plays: Record<string, SlidePlay>): string {
  const first = run.pages[0]
  if (!isProgression(run) || !run.playId) return first.title
  return plays[run.playId]?.name || first.title.replace(/\s*·\s*\d+ of \d+$/, '')
}

/** The coach's line under one step of a progression. */
export function stepNote(page: PlaybookPage): string {
  return firstOf(page.blocks, 'play')?.caption?.trim() ?? ''
}

/** Runs grouped under their sections, keeping each run's slide index. */
export function runsBySection(deck: Deck) {
  const out: { section: PlaybookPage['section']; runs: { run: DeckRun; r: number }[] }[] = []
  deck.runs.forEach((run, r) => {
    const section = run.pages[0].section
    const last = out[out.length - 1]
    if (last && last.section === section) last.runs.push({ run, r })
    else out.push({ section, runs: [{ run, r }] })
  })
  return out
}

/**
 * The largest 16:9 box that fits the container, letterboxed. The container is
 * a size container (`containerType: 'size'`), so this is pure CSS — nothing
 * measured, nothing to settle after a resize or a turn of the phone.
 */
export const SLIDE_FIT = `min(100cqw, calc(100cqh * ${SLIDE_W} / ${SLIDE_H}))`

/**
 * One page, as a slide filling the width it is given.
 *
 * The kinds of page are 16:9 by themselves. A field is drawn without its own
 * double-tap zoom — here a tap or a swipe belongs to the deck. The older
 * laid-out pages get the white 16:9 page they were designed on.
 */
export function PageArt({ page, plays }: { page: PlaybookPage; plays: Record<string, SlidePlay> }) {
  if (page.layout === 'field') {
    return (
      <div className="keep-light rounded-lg overflow-hidden">
        <FieldPageView page={page} plays={plays} zoomable={false} />
      </div>
    )
  }
  if (isPageKind(page.layout) || isFree(page)) {
    return (
      <div className="rounded-lg overflow-hidden">
        <SlideView page={page} plays={plays} />
      </div>
    )
  }
  /* Drawn on the stage at slide size and scaled as a whole, so it keeps its
     proportions on a phone and on the TV alike. */
  return (
    <Stage className="rounded-lg">
      <div className="keep-light absolute inset-0 overflow-hidden" style={{ padding: '32px 44px' }}>
        <SlideView page={page} plays={plays} />
      </div>
    </Stage>
  )
}

/**
 * A slide: one page, or a progression showing one of its steps.
 *
 * The steps are stacked in the same spot. Every step up to the one shown is
 * opaque and the later ones are clear, so going forward the next step fades in
 * over the last and going back it fades off it: what stayed put stays put, and
 * what moved is seen to move.
 */
export function RunArt({ run, step, plays }: { run: DeckRun; step: number; plays: Record<string, SlidePlay> }) {
  if (!isProgression(run)) return <PageArt page={run.pages[0]} plays={plays} />
  return (
    <div className="grid">
      {run.pages.map((p, i) => (
        <div
          key={p.id}
          aria-hidden={i !== step}
          className="[grid-area:1/1] transition-opacity duration-500 ease-out motion-reduce:transition-none"
          style={{ opacity: i <= step ? 1 : 0 }}
        >
          <PageArt page={p} plays={plays} />
        </div>
      ))}
    </div>
  )
}

/** A progression's steps as dots, the one shown drawn long. */
export function StepDots({
  count,
  at,
  onPick,
  tone,
}: {
  count: number
  at: number
  onPick: (step: number) => void
  /** Dark: over a slide or the presenter's black. Light: on the page. */
  tone: 'dark' | 'light'
}) {
  return (
    <div className="flex items-center" role="group" aria-label="Steps">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPick(i)}
          aria-label={`Step ${i + 1} of ${count}`}
          aria-current={i === at ? 'step' : undefined}
          className="p-1.5"
        >
          <span
            className="block h-2 rounded-full transition-all duration-300"
            style={{
              width: i === at ? 20 : 8,
              background:
                tone === 'dark'
                  ? i === at ? '#ffffff' : 'rgba(255,255,255,0.4)'
                  : i === at ? 'var(--gh-green)' : 'rgba(107,114,128,0.35)',
            }}
          />
        </button>
      ))}
    </div>
  )
}

/**
 * A swipe or a tap, by pointer: a finger, a pen, or a mouse dragged across.
 * The element it is spread on wants `touch-action: pan-y`, so a thumb going
 * up and down still scrolls and one going sideways is ours.
 */
export function useSwipe({
  onNext,
  onPrev,
  onTap,
}: {
  onNext: () => void
  onPrev: () => void
  onTap?: (e: React.PointerEvent) => void
}) {
  const from = useRef<{ x: number; y: number; id: number } | null>(null)
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.isPrimary && e.button === 0) from.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    },
    onPointerUp: (e: React.PointerEvent) => {
      const s = from.current
      from.current = null
      if (!s || s.id !== e.pointerId) return
      const dx = e.clientX - s.x
      const dy = e.clientY - s.y
      if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        if (dx < 0) onNext()
        else onPrev()
      } else if (Math.hypot(dx, dy) < 10) onTap?.(e)
    },
    onPointerCancel: () => {
      from.current = null
    },
  }
}
