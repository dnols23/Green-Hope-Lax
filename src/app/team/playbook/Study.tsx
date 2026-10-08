'use client'
import { useEffect, useMemo, useState } from 'react'
import type { SlidePlay } from '@/components/playbook/SlideView'
import { PLAYBOOK_SECTIONS, sectionLabel, type DeckRun, type PlaybookPage, type PlaybookSection } from '@/lib/playbook'
import { Presenter } from '@/app/admin/(hub)/playbook/present/Presenter'
import {
  PageArt,
  RunArt,
  StepDots,
  buildDeck,
  isProgression,
  runName,
  runsBySection,
  stepNote,
  useSwipe,
} from '@/app/admin/(hub)/playbook/present/slides'

const anchor = (s: PlaybookSection | null) => `pb-${s ?? 'unsorted'}`

/**
 * The playbook on a player's phone: section by section, every slide big, a
 * progression stepped through on its own card, and any slide a tap away from
 * full screen — where a swipe goes on to the next one.
 */
export function Study({ pages, plays, title }: { pages: PlaybookPage[]; plays: Record<string, SlidePlay>; title: string }) {
  const deck = useMemo(() => buildDeck(pages), [pages])
  const sections = useMemo(() => runsBySection(deck), [deck])
  /** The page full screen is open on. */
  const [open, setOpen] = useState<string | null>(null)
  /** The step each progression card is showing, by its first page. */
  const [steps, setSteps] = useState<Record<string, number>>({})
  const [active, setActive] = useState<PlaybookSection | null | undefined>(sections[0]?.section)

  // The tab for the section you are reading lights up as you scroll.
  useEffect(() => {
    if (sections.length < 2) return
    const seen = new Map<string, boolean>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting)
        const top = sections.find((s) => seen.get(anchor(s.section)))
        if (top) setActive(top.section)
      },
      { rootMargin: '-72px 0px -55% 0px' }
    )
    for (const s of sections) {
      const el = document.getElementById(anchor(s.section))
      if (el) io.observe(el)
    }
    return () => io.disconnect()
  }, [sections])

  /* Back from full screen, the list is where you left it: on that slide, and
     on that step of a progression. */
  const closeViewer = (pageId: string | null) => {
    setOpen(null)
    const at = deck.pages.findIndex((p) => p.id === pageId)
    if (at < 0) return
    const { run, step } = deck.where[at]
    const key = deck.runs[run].pages[0].id
    if (isProgression(deck.runs[run])) setSteps((v) => ({ ...v, [key]: step }))
    document.getElementById(`slide-${key}`)?.scrollIntoView({ block: 'center' })
  }

  return (
    <>
      {sections.length > 1 && (
        <nav
          className="sticky top-0 z-10 -mx-4 px-4 py-2.5 mb-4 backdrop-blur"
          style={{ background: 'color-mix(in srgb, var(--surface-2) 88%, transparent)' }}
          aria-label="Sections"
        >
          <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {sections.map((s) => {
              const on = s.section === active
              return (
                <a
                  key={anchor(s.section)}
                  href={`#${anchor(s.section)}`}
                  onClick={(e) => {
                    e.preventDefault()
                    document.getElementById(anchor(s.section))?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-bold transition-colors ${
                    on ? 'text-white' : 'text-gray-600 bg-white border border-gray-200'
                  }`}
                  style={on ? { background: 'var(--gh-green)' } : undefined}
                  aria-current={on ? 'true' : undefined}
                >
                  {sectionLabel(s.section)}
                </a>
              )
            })}
          </div>
        </nav>
      )}

      {sections.map((s) => (
        <section key={anchor(s.section)} id={anchor(s.section)} className="scroll-mt-16 mb-10">
          <h2 className="flex items-baseline gap-2 mb-3">
            <span aria-hidden>{PLAYBOOK_SECTIONS.find((x) => x.key === s.section)?.icon ?? '📎'}</span>
            <span className="text-xl font-black">{sectionLabel(s.section)}</span>
            <span className="text-xs font-bold text-gray-400 tabular-nums">{s.runs.length}</span>
          </h2>
          <div className="space-y-7">
            {s.runs.map(({ run }) =>
              isProgression(run) ? (
                <Progression
                  key={run.pages[0].id}
                  run={run}
                  plays={plays}
                  step={Math.min(steps[run.pages[0].id] ?? 0, run.pages.length - 1)}
                  onStep={(n) => setSteps((v) => ({ ...v, [run.pages[0].id]: n }))}
                  onOpen={setOpen}
                />
              ) : (
                // Not a <button>: an older page's field carries a button of its own.
                <div
                  key={run.pages[0].id}
                  id={`slide-${run.pages[0].id}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpen(run.pages[0].id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(run.pages[0].id) }
                  }}
                  aria-label={`${run.pages[0].title || 'Slide'} — full screen`}
                  className="block w-full rounded-lg shadow-sm ring-1 ring-black/5 cursor-pointer transition-transform active:scale-[0.99]"
                >
                  <div className="pointer-events-none">
                    <PageArt page={run.pages[0]} plays={plays} />
                  </div>
                </div>
              )
            )}
          </div>
        </section>
      ))}

      {open && <Presenter pages={pages} plays={plays} title={title} startId={open} onClose={closeViewer} />}
    </>
  )
}

/** A progression: one card, swiped or stepped through, the play building in place. */
function Progression({
  run,
  plays,
  step,
  onStep,
  onOpen,
}: {
  run: DeckRun
  plays: Record<string, SlidePlay>
  step: number
  onStep: (n: number) => void
  onOpen: (pageId: string) => void
}) {
  const n = run.pages.length
  const to = (k: number) => onStep(Math.max(0, Math.min(n - 1, k)))
  const swipe = useSwipe({ onNext: () => to(step + 1), onPrev: () => to(step - 1), onTap: () => onOpen(run.pages[step].id) })
  const note = stepNote(run.pages[step])
  return (
    <div id={`slide-${run.pages[0].id}`}>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${runName(run, plays)}, step ${step + 1} of ${n} — full screen`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(run.pages[step].id) }
          if (e.key === 'ArrowRight') { e.preventDefault(); to(step + 1) }
          if (e.key === 'ArrowLeft') { e.preventDefault(); to(step - 1) }
        }}
        className="rounded-lg shadow-sm ring-1 ring-black/5 cursor-pointer select-none"
        style={{ touchAction: 'pan-y' }}
        {...swipe}
      >
        <div className="pointer-events-none">
          <RunArt run={run} step={step} plays={plays} />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1">
        <StepButton onClick={() => to(step - 1)} disabled={step === 0} label="Step back">‹</StepButton>
        <div className="flex-1 min-w-0 flex flex-col items-center">
          <div className="text-sm font-bold truncate max-w-full">
            {runName(run, plays)} <span className="font-semibold text-gray-400">· {step + 1} of {n}</span>
          </div>
          <StepDots count={n} at={step} onPick={to} tone="light" />
        </div>
        <StepButton onClick={() => to(step + 1)} disabled={step === n - 1} label="Next step">›</StepButton>
      </div>
      {note && <p className="text-sm text-gray-600 text-center mt-0.5 whitespace-pre-wrap">{note}</p>}
    </div>
  )
}

function StepButton({ onClick, disabled, label, children }: { onClick: () => void; disabled: boolean; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-full text-3xl leading-none pb-1 text-gray-600 hover:bg-gray-100 disabled:opacity-25"
    >
      {children}
    </button>
  )
}
