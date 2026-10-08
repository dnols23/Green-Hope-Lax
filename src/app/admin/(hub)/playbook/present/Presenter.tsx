'use client'
import { useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { SlidePlay } from '@/components/playbook/SlideView'
import { PLAYBOOK_SECTIONS, sectionLabel, type DeckRun, type PlaybookPage, type PlaybookSection } from '@/lib/playbook'
import { PageArt, RunArt, SLIDE_FIT, StepDots, buildDeck, isProgression, runName, runsBySection, stepNote, useSwipe } from './slides'

const BG = '#0b0d10'
const PANEL = '#14181e'
/** Dark glass under a control, so it reads over any slide. */
const GLASS = 'bg-black/45 backdrop-blur-md'
/** How long the chrome stays after the mouse stops. */
const IDLE_MS = 2600

/* A slide coming on fades in over the one going off, which stays put
   underneath until it has. Reduced motion still ends the animation — that is
   what takes the old slide away. */
const CSS = `
@keyframes pb-in { from { opacity: 0 } to { opacity: 1 } }
.pb-in { animation: pb-in 320ms ease-out both }
@media (prefers-reduced-motion: reduce) { .pb-in { animation-duration: 1ms } }
`

const onFullscreen = (cb: () => void) => {
  document.addEventListener('fullscreenchange', cb)
  return () => document.removeEventListener('fullscreenchange', cb)
}
const never = () => () => {}

type Layer = { key: string; run: DeckRun; step: number; role: 'prev' | 'cur' | 'next' }

/**
 * The playbook, one slide at a time, the whole screen.
 *
 * Present uses it on the projector — with the grid, the section menu, full
 * screen and, for the head coach, his notes — and the players' playbook opens
 * it when a slide is tapped. Notes are only ever drawn when `notes` is on, and
 * the pages handed to anyone else have none in them to draw.
 */
export function Presenter({
  pages,
  plays,
  title,
  startId,
  section,
  notes = false,
  tools = false,
  onClose,
  onMove,
}: {
  /** The whole playbook; put in reading order here. */
  pages: PlaybookPage[]
  plays: Record<string, SlidePlay>
  title: string
  /** The page to open on. */
  startId?: string | null
  /** Only this section, to begin with. */
  section?: PlaybookSection | null
  /** The head coach's notes panel (N). */
  notes?: boolean
  /** The meeting-room extras: section menu, grid (G), full screen (F), screen kept awake. */
  tools?: boolean
  /** Told the page on screen as it closes. */
  onClose: (pageId: string | null) => void
  /** Told each page as it comes on, and the section the deck is cut to. */
  onMove?: (pageId: string, section: PlaybookSection | null) => void
}) {
  const all = useMemo(() => buildDeck(pages), [pages])
  const [only, setOnly] = useState<PlaybookSection | null>(section ?? null)
  const deck = useMemo(() => {
    if (!only) return all
    const cut = buildDeck(pages.filter((p) => p.section === only))
    return cut.pages.length ? cut : all
  }, [all, only, pages])
  const cutTo = deck === all ? null : only

  const [at, setAt] = useState(() => Math.max(0, deck.pages.findIndex((p) => p.id === startId)))
  const last = deck.pages.length - 1
  const i = Math.max(0, Math.min(at, last))
  const page: PlaybookPage | undefined = deck.pages[i]
  const { run: r, step: s } = deck.where[i] ?? { run: 0, step: 0 }
  const run: DeckRun | undefined = deck.runs[r]

  const [grid, setGrid] = useState(false)
  const [menu, setMenu] = useState(false)
  const [notesOn, setNotesOn] = useState(false)

  // ── Which slides are on the stage ──
  /* The slide going off is remembered until the one coming on has faded in
     over it — set while rendering, the way React asks for state that follows
     a prop, so there is never a frame with nothing underneath. */
  const [shown, setShown] = useState<{ run: DeckRun | undefined; step: number; prev: { run: DeckRun; step: number } | null }>(
    { run, step: s, prev: null }
  )
  if (shown.run !== run) setShown({ run, step: s, prev: shown.run ? { run: shown.run, step: shown.step } : null })
  else if (shown.step !== s) setShown({ ...shown, step: s })

  const layers: Layer[] = []
  if (run) {
    const keyOf = (x: DeckRun) => x.pages[0].id
    layers.push({ key: keyOf(run), run, step: s, role: 'cur' })
    const prev = shown.prev
    if (prev && !layers.some((l) => l.key === keyOf(prev.run))) layers.push({ key: keyOf(prev.run), ...prev, role: 'prev' })
    // The next slide is drawn already, out of sight, so it is ready the moment it is wanted.
    const ahead = deck.runs[r + 1]
    if (ahead && !layers.some((l) => l.key === keyOf(ahead))) layers.push({ key: keyOf(ahead), run: ahead, step: 0, role: 'next' })
    // Painted in reading order, so a slide changing role is never moved in the page.
    const order = (l: Layer) => all.pages.indexOf(l.run.pages[0])
    layers.sort((a, b) => order(a) - order(b))
  }

  // ── Moving ──
  const go = (n: number) => setAt(Math.max(0, Math.min(last, n)))
  const next = () => go(i + 1)
  const back = () => go(i - 1)
  const toSlide = (slide: number) => go(deck.starts[slide] ?? 0)

  const close = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    onClose(page?.id ?? null)
  }

  const jumpToSection = (sec: PlaybookSection | null) => {
    setMenu(false)
    const here = deck.pages.findIndex((p) => p.section === sec)
    if (here >= 0) return go(here)
    setOnly(null)
    setAt(Math.max(0, all.pages.findIndex((p) => p.section === sec)))
  }
  const showWhole = () => {
    setMenu(false)
    setOnly(null)
    setAt(Math.max(0, all.pages.findIndex((p) => p.id === page?.id)))
  }

  // ── Full screen, where the browser has it (not an iPhone) ──
  const root = useRef<HTMLDivElement>(null)
  const isFull = useSyncExternalStore(onFullscreen, () => !!document.fullscreenElement, () => false)
  const canFull = useSyncExternalStore(never, () => !!document.fullscreenEnabled, () => false)
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else root.current?.requestFullscreen?.().catch(() => {})
  }

  // ── The chrome, which gets out of the way ──
  const [awake, setAwake] = useState(true)
  const timer = useRef(0)
  const overChrome = useRef(false)
  const sleepSoon = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      if (overChrome.current) sleepSoon()
      else setAwake(false)
    }, IDLE_MS)
  }
  const wake = () => {
    setAwake(true)
    sleepSoon()
  }
  const firstSleep = useEffectEvent(() => sleepSoon())
  useEffect(() => {
    firstSleep()
    return () => window.clearTimeout(timer.current)
  }, [])
  const chrome = awake || menu || grid
  const hold = {
    onPointerEnter: () => { overChrome.current = true },
    onPointerLeave: () => { overChrome.current = false },
  }

  const swipe = useSwipe({
    onNext: next,
    onPrev: back,
    // A click moves on, like Slides. A tap on glass brings the controls back, or puts them away.
    onTap: (e) => {
      if (e.pointerType === 'mouse') next()
      else if (awake) setAwake(false)
      else wake()
    },
  })

  // ── Keys: the arrows, a clicker's PageUp/PageDown, space, and the letters ──
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const k = e.key
    // A control reached with Tab works the way a control does.
    if ((k === ' ' || k === 'Enter') && (e.target as Element | null)?.closest?.('button, a, [role="button"]')) return
    if (k === 'Escape') {
      e.preventDefault()
      if (menu) setMenu(false)
      else if (grid) setGrid(false)
      else close()
    } else if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !e.shiftKey)) {
      e.preventDefault()
      next()
    } else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp' || k === 'Backspace' || (k === ' ' && e.shiftKey)) {
      e.preventDefault()
      back()
    } else if (k === 'Home') {
      e.preventDefault()
      go(0)
    } else if (k === 'End') {
      e.preventDefault()
      go(last)
    } else if (k === 'Enter' && grid) {
      setGrid(false)
    } else if (tools && (k === 'g' || k === 'G')) {
      setMenu(false)
      setGrid((v) => !v)
    } else if (tools && canFull && (k === 'f' || k === 'F')) {
      toggleFull()
    } else if (notes && (k === 'n' || k === 'N')) {
      setNotesOn((v) => !v)
    }
  })
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey(e)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // Whoever opened it keeps track of where it is — the address, the list behind.
  const moved = useEffectEvent((id: string, sec: PlaybookSection | null) => onMove?.(id, sec))
  useEffect(() => {
    if (page) moved(page.id, cutTo)
  }, [page, cutTo])

  // Nothing behind it scrolls while it is up.
  useEffect(() => {
    const body = document.body.style
    const was = body.overflow
    body.overflow = 'hidden'
    return () => {
      body.overflow = was
    }
  }, [])

  // A laptop on the TV shouldn't go to sleep mid-meeting.
  useEffect(() => {
    if (!tools || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let done = false
    const take = () => {
      if (document.visibilityState !== 'visible') return
      navigator.wakeLock.request('screen').then((l) => {
        if (done) l.release().catch(() => {})
        else lock = l
      }).catch(() => {})
    }
    take()
    document.addEventListener('visibilitychange', take)
    return () => {
      done = true
      document.removeEventListener('visibilitychange', take)
      lock?.release().catch(() => {})
    }
  }, [tools])

  const fade = `transition-opacity duration-300 ${chrome ? 'opacity-100' : 'opacity-0 pointer-events-none'}`

  if (!page || !run) {
    return (
      <div className="fixed inset-0 z-[85] flex flex-col items-center justify-center gap-4 text-white" style={{ background: BG }}>
        <style>{CSS}</style>
        <p className="text-white/60">Nothing in the playbook yet.</p>
        <button type="button" onClick={close} className="btn btn-outline !py-1.5 text-sm">Close</button>
      </div>
    )
  }

  const prog = isProgression(run)
  const note = prog ? stepNote(page) : ''
  const sections = runsBySection(all)
  const nextPage = deck.pages[i + 1]
  const nextUp = !nextPage
    ? 'The end'
    : deck.where[i + 1].run === r
      ? `Step ${s + 2} of ${run.pages.length}`
      : runName(deck.runs[r + 1], plays) || 'Untitled'

  return (
    <div
      ref={root}
      className="fixed inset-0 z-[85] flex flex-col md:flex-row text-white select-none"
      style={{ background: BG }}
      onPointerMove={(e) => { if (e.pointerType === 'mouse') wake() }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <style>{CSS}</style>

      <main className="relative flex-1 min-w-0 min-h-0" style={{ cursor: chrome ? undefined : 'none' }}>
        {/* The stage: the slide letterboxed into whatever screen this is. */}
        <div
          className="absolute inset-0 grid place-items-center"
          style={{ containerType: 'size', touchAction: 'pan-y pinch-zoom' }}
          {...swipe}
        >
          <div className="grid" style={{ width: SLIDE_FIT }}>
            {layers.map((l) => (
              <div
                key={l.key}
                aria-hidden={l.role !== 'cur'}
                className={`[grid-area:1/1] ${l.role === 'cur' && shown.prev ? 'pb-in' : ''}`}
                style={{
                  zIndex: l.role === 'cur' ? 2 : l.role === 'prev' ? 1 : 0,
                  visibility: l.role === 'next' ? 'hidden' : undefined,
                }}
                onAnimationEnd={
                  l.role === 'cur'
                    ? (e) => { if (e.target === e.currentTarget) setShown((v) => ({ ...v, prev: null })) }
                    : undefined
                }
              >
                <RunArt run={l.run} step={l.step} plays={plays} />
              </div>
            ))}
          </div>
        </div>

        {/* Top: the way out, where you are, the tools. Each control sits on its
            own dark glass, so it reads over a white page and over grass without
            a band drawn across the slide. */}
        <div
          className="absolute inset-x-0 top-0 z-10 flex items-start gap-2 px-2 sm:px-4 pointer-events-none"
          style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
        >
          <span className={`pointer-events-auto ${fade}`} {...hold}>
            <Btn onClick={close} label="Close (Esc)"><IconX /></Btn>
          </span>
          <div className={`min-w-0 relative pointer-events-auto ${fade}`} {...hold}>
            <div className={`${GLASS} rounded-2xl px-3 py-1.5 max-w-[60vw] sm:max-w-sm`}>
              <div className="text-[0.6rem] font-black uppercase tracking-[0.18em] text-white/55 truncate">{title}</div>
              {tools ? (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setMenu((v) => !v)}
                  aria-expanded={menu}
                  aria-haspopup="menu"
                  className="flex items-center gap-1.5 text-sm font-bold max-w-full hover:text-white/80"
                >
                  <span className="truncate">{sectionIcon(page.section)} {sectionLabel(page.section)}</span>
                  {cutTo && <span className="text-[0.6rem] font-black uppercase tracking-wider text-white/50 shrink-0">only</span>}
                  <span aria-hidden className="text-white/55 text-xs shrink-0">▾</span>
                </button>
              ) : (
                <div className="text-sm font-bold truncate">{sectionIcon(page.section)} {sectionLabel(page.section)}</div>
              )}
            </div>
            {menu && (
              <>
                <div className="fixed inset-0" onClick={() => setMenu(false)} />
                <div
                  role="menu"
                  className="absolute left-0 top-full mt-2 w-60 rounded-xl py-1.5 shadow-2xl ring-1 ring-white/10"
                  style={{ background: PANEL }}
                >
                  {cutTo && (
                    <>
                      <MenuItem onClick={showWhole} label="Whole playbook" count={all.runs.length} />
                      <div className="my-1.5 border-t border-white/10" />
                    </>
                  )}
                  {sections.map((sec) => (
                    <MenuItem
                      key={sec.section ?? 'none'}
                      onClick={() => jumpToSection(sec.section)}
                      label={`${sectionIcon(sec.section)} ${sectionLabel(sec.section)}`}
                      count={sec.runs.length}
                      on={sec.section === page.section}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
          <div className={`ml-auto flex items-center gap-1.5 pointer-events-auto ${fade}`} {...hold}>
            {notes && (
              <Btn onClick={() => setNotesOn((v) => !v)} label="Notes (N)" on={notesOn}><IconNotes /></Btn>
            )}
            {tools && (
              <Btn onClick={() => { setMenu(false); setGrid(true) }} label="All slides (G)"><IconGrid /></Btn>
            )}
            {tools && canFull && (
              <Btn onClick={toggleFull} label={isFull ? 'Leave full screen (F)' : 'Full screen (F)'}>
                <IconFull out={isFull} />
              </Btn>
            )}
          </div>
        </div>

        {/* Bottom: back, the build, where you are, next. */}
        <div
          className="absolute inset-x-0 bottom-0 z-10 flex items-end gap-2 px-2 sm:px-4 pointer-events-none"
          style={{ paddingBottom: 'max(0.6rem, env(safe-area-inset-bottom))' }}
        >
          <span className={`pointer-events-auto ${fade}`} {...hold}>
            <Btn onClick={back} label="Back" disabled={i === 0}><IconChevron left /></Btn>
          </span>
          <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5 text-center">
            {prog && (
              <div className={`${GLASS} rounded-xl px-3 py-1 max-w-full ${fade}`}>
                <div className="text-sm font-bold truncate">
                  {runName(run, plays)} <span className="text-white/60">· {s + 1} of {run.pages.length}</span>
                </div>
                {note && <div className="text-xs text-white/75 line-clamp-2">{note}</div>}
              </div>
            )}
            {/* The build's dots stay up when the rest goes: the room is watching the play develop. */}
            {prog && (
              <div className={`${GLASS} pointer-events-auto rounded-full px-1.5`}>
                <StepDots count={run.pages.length} at={s} onPick={(n) => go(deck.starts[r] + n)} tone="dark" />
              </div>
            )}
            {!tools && (
              <div className={`hidden max-md:portrait:block text-[0.7rem] text-white/45 ${fade}`}>
                Turn your phone sideways for a bigger view
              </div>
            )}
          </div>
          <span className={`pointer-events-auto flex items-center gap-1.5 ${fade}`} {...hold}>
            <span className={`${GLASS} rounded-full px-2.5 py-1 text-xs font-bold tabular-nums text-white/80`}>
              {r + 1} / {deck.runs.length}
            </span>
            <Btn onClick={next} label="Next" disabled={i === last}><IconChevron /></Btn>
          </span>
        </div>
        <div className={`absolute left-0 bottom-0 h-[3px] z-10 ${fade}`} style={{ width: `${((i + 1) / deck.pages.length) * 100}%`, background: 'var(--gh-green)' }} />

        {grid && (
          <Overview
            deck={deck}
            plays={plays}
            title={title}
            current={r}
            cutTo={cutTo}
            onPick={(slide) => { toSlide(slide); setGrid(false) }}
            onWhole={showWhole}
            onClose={() => setGrid(false)}
            notes={notes}
          />
        )}
      </main>

      {notes && notesOn && (
        <aside
          className="shrink-0 h-[36%] md:h-auto md:w-[min(26rem,34vw)] overflow-y-auto border-t md:border-t-0 md:border-l border-white/10 p-5 select-text"
          style={{ background: PANEL }}
        >
          <div className="flex items-center mb-3">
            <span className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-white/45">Your notes</span>
            <button type="button" onClick={() => setNotesOn(false)} className="ml-auto text-xs font-bold text-white/45 hover:text-white">
              Hide (N)
            </button>
          </div>
          {page.notes?.trim() ? (
            <p className="text-lg leading-relaxed whitespace-pre-wrap text-white/90">{page.notes}</p>
          ) : (
            <p className="text-sm text-white/40">No notes on this slide.</p>
          )}
          <div className="mt-6 pt-4 border-t border-white/10 text-sm text-white/45">
            Next: <span className="font-bold text-white/80">{nextUp}</span>
          </div>
        </aside>
      )}
    </div>
  )
}

/** Every slide at once, by section — pick one to go straight to it. */
function Overview({
  deck,
  plays,
  title,
  current,
  cutTo,
  onPick,
  onWhole,
  onClose,
  notes,
}: {
  deck: ReturnType<typeof buildDeck>
  plays: Record<string, SlidePlay>
  title: string
  current: number
  cutTo: PlaybookSection | null
  onPick: (slide: number) => void
  onWhole: () => void
  onClose: () => void
  notes: boolean
}) {
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto overscroll-contain" style={{ background: 'rgba(8,10,13,0.97)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-8 pb-10" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-lg font-black truncate">{title}</h2>
          {cutTo && (
            <button type="button" onClick={onWhole} className="text-xs font-bold text-white/55 hover:text-white shrink-0">
              {sectionLabel(cutTo)} only · show all
            </button>
          )}
          <span className="ml-auto" />
          <Btn onClick={onClose} label="Close (Esc)"><IconX /></Btn>
        </div>
        {runsBySection(deck).map((sec) => (
          <section key={sec.section ?? 'none'} className="mb-8">
            <h3 className="text-[0.66rem] font-black uppercase tracking-[0.18em] text-white/45 mb-3">
              {sectionIcon(sec.section)} {sectionLabel(sec.section)}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-5">
              {sec.runs.map(({ run, r }) => (
                /* Not a <button>: an older page's field carries a button of its own. */
                <div
                  key={run.pages[0].id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onPick(r)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(r) }
                  }}
                  // The slide you were on, brought into view when the grid opens.
                  ref={r === current ? (el) => el?.scrollIntoView({ block: 'center' }) : undefined}
                  className="text-left group cursor-pointer"
                >
                  <div
                    className={`rounded-lg ring-2 transition-shadow ${
                      r === current ? 'ring-white' : 'ring-transparent group-hover:ring-white/35'
                    }`}
                  >
                    <div className="pointer-events-none">
                      <PageArt page={run.pages[0]} plays={plays} />
                    </div>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2 text-xs">
                    <span className="tabular-nums text-white/35 font-bold">{r + 1}</span>
                    <span className="truncate font-bold text-white/80">{runName(run, plays) || 'Untitled'}</span>
                    {isProgression(run) && <span className="ml-auto shrink-0 text-white/40">{run.pages.length} steps</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
        <p className="text-xs text-white/35 mt-2">
          ← → or space to move · Home / End · G all slides · F full screen{notes ? ' · N notes' : ''} · Esc to close
        </p>
      </div>
    </div>
  )
}

function sectionIcon(s: PlaybookSection | null): string {
  return PLAYBOOK_SECTIONS.find((x) => x.key === s)?.icon ?? ''
}

function MenuItem({ label, count, on, onClick }: { label: string; count: number; on?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3.5 py-2 text-left text-sm hover:bg-white/10 ${on ? 'font-black text-white' : 'font-semibold text-white/75'}`}
    >
      <span className="truncate">{label}</span>
      <span className="ml-auto text-xs tabular-nums text-white/40">{count}</span>
    </button>
  )
}

/** A round control on dark glass. A mouse click doesn't leave it focused, so space still moves the deck. */
function Btn({
  onClick,
  label,
  children,
  on = false,
  disabled = false,
}: {
  onClick: () => void
  label: string
  children: React.ReactNode
  on?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      disabled={disabled}
      aria-label={label}
      aria-pressed={on || undefined}
      title={label}
      className={`w-10 h-10 inline-flex items-center justify-center rounded-full backdrop-blur-md transition-colors disabled:opacity-30 ${
        on ? 'bg-white/30 text-white' : 'bg-black/45 text-white/90 hover:bg-black/65 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

const svg = { width: 20, height: 20, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

function IconX() {
  return <svg {...svg} aria-hidden><path d="M5 5l10 10M15 5L5 15" /></svg>
}
function IconGrid() {
  return (
    <svg {...svg} aria-hidden>
      <rect x="3" y="4" width="6" height="5" rx="1" /><rect x="11" y="4" width="6" height="5" rx="1" />
      <rect x="3" y="11" width="6" height="5" rx="1" /><rect x="11" y="11" width="6" height="5" rx="1" />
    </svg>
  )
}
function IconNotes() {
  return <svg {...svg} aria-hidden><rect x="3.5" y="3" width="13" height="14" rx="2" /><path d="M7 7.5h6M7 10.5h6M7 13.5h3.5" /></svg>
}
function IconFull({ out }: { out: boolean }) {
  return out ? (
    <svg {...svg} aria-hidden><path d="M8 3v5H3M12 3v5h5M8 17v-5H3M12 17v-5h5" /></svg>
  ) : (
    <svg {...svg} aria-hidden><path d="M3 8V3h5M17 8V3h-5M3 12v5h5M17 12v5h-5" /></svg>
  )
}
function IconChevron({ left = false }: { left?: boolean }) {
  return <svg {...svg} aria-hidden><path d={left ? 'M12.5 4.5L7 10l5.5 5.5' : 'M7.5 4.5L13 10l-5.5 5.5'} /></svg>
}
