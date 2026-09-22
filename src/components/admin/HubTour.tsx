'use client'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  INSTALL_GUIDES,
  TOUR_EVENT,
  TOUR_KEY,
  TOUR_STEPS,
  platformOf,
  type Platform,
  type TourStep,
} from '@/lib/tour'

/* Whether this coach has been welcomed, read the same way the sidebar reads its
   saved order: straight out of the browser, so the server's render and the
   first client one agree and then settle. The server has to assume they've seen
   it, or every page would flash a welcome card at a coach who hasn't. */
function readSeen(): string {
  try { return localStorage.getItem(TOUR_KEY) ? 'seen' : 'new' } catch { return 'seen' }
}
function subscribeSeen(onChange: () => void) {
  window.addEventListener(TOUR_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(TOUR_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

function findEl(target?: string): HTMLElement | null {
  if (!target) return null
  const sel = target.startsWith('mode:')
    ? `[data-tour-mode="${CSS.escape(target.slice(5))}"]`
    : `[data-tour="${CSS.escape(target)}"]`
  return document.querySelector<HTMLElement>(sel)
}

interface Box { top: number; left: number; width: number; height: number }

/**
 * The first thing a coach sees, and the walk round the hub that follows.
 *
 * Two jobs in one component because they're one moment: a coach signs in on his
 * phone, and before he touches anything he's told how to put the app on his home
 * screen and then shown where everything is. It runs once — kept in that
 * browser, which is right, since saving to a home screen is a thing you do on
 * each device — and the sidebar carries a button to run it again.
 */
export function HubTour({ name }: { name: string }) {
  const pathname = usePathname()
  const seen = useSyncExternalStore(subscribeSeen, readSeen, () => 'seen')

  const [asked, setAsked] = useState(false)
  const [phase, setPhase] = useState<'welcome' | 'tour'>('welcome')
  const [steps, setSteps] = useState<TourStep[]>([])
  const [at, setAt] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  /* The card's own height, and the window's — both measured, because the card
     has to be placed against the one and kept inside the other. */
  const [cardH, setCardH] = useState(180)
  const [view, setView] = useState({ w: 0, h: 0 })
  const cardRef = useRef<HTMLDivElement>(null)
  /* The same number as `cardH`, kept in a ref so the measuring function can
     read it without being rebuilt every time the card changes size. */
  const cardHRef = useRef(180)
  const [platform, setPlatform] = useState<Platform>('desktop')
  const [installed, setInstalled] = useState(false)

  // Asked for again from the sidebar, whether or not it's been seen before.
  useEffect(() => {
    const replay = () => {
      if (!localStorage.getItem(`${TOUR_KEY}-replay`)) return
      localStorage.removeItem(`${TOUR_KEY}-replay`)
      setPhase('welcome')
      setAt(0)
      setAsked(true)
    }
    window.addEventListener(TOUR_EVENT, replay)
    return () => window.removeEventListener(TOUR_EVENT, replay)
  }, [])

  // Which directions this device needs, and whether it already has the app.
  useEffect(() => {
    const read = () => {
      setPlatform(platformOf(navigator.userAgent, navigator.maxTouchPoints))
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true
      setInstalled(standalone)
    }
    const id = requestAnimationFrame(read)
    return () => cancelAnimationFrame(id)
  }, [])

  const open = asked || (seen === 'new' && pathname === '/admin/hub')
  const step = phase === 'tour' ? steps[at] : undefined

  /*
   * Follow the highlighted element — and keep the ring on the screen.
   *
   * The sidebar on a phone is one full-width column taller than the window, so
   * its box starts above the top of the screen and ends below the bottom. Ring
   * that and you get a rectangle with no visible top or bottom edge and a card
   * shoved off the page. So the box is clipped to what is actually on screen,
   * and the card is placed against that.
   */
  const measure = useCallback(() => {
    if (!step) { setBox(null); return }
    const el = findEl(step.target)
    if (!el) { setBox(null); return }
    const r = el.getBoundingClientRect()
    const edge = 8
    /* On a phone the card sits on the bottom, so the ring stops above it —
       otherwise the thing being pointed at is underneath the words pointing
       at it. */
    const phone = window.innerWidth < 640
    const floor = window.innerHeight - edge - (phone ? cardHRef.current + 20 : 0)
    const top = Math.max(edge, r.top)
    const left = Math.max(edge, r.left)
    const right = Math.min(window.innerWidth - edge, r.right)
    const bottom = Math.min(floor, r.bottom)
    // Scrolled out of sight entirely: dim everything rather than ring nothing.
    if (right - left < 8 || bottom - top < 8) { setBox(null); return }
    setBox({ top, left, width: right - left, height: bottom - top })
  }, [step])

  useEffect(() => {
    if (!open || phase !== 'tour') return
    const el = findEl(step?.target)
    if (el) {
      /* A target taller than the window cannot be centred — centring it puts
         its top off the screen. Bring its top into view instead, high enough
         that the card has somewhere to sit. */
      const r = el.getBoundingClientRect()
      const tall = r.height > window.innerHeight * 0.55
      el.scrollIntoView({ block: tall ? 'start' : 'center', behavior: 'smooth' })
      if (tall) {
        // Leave a strip above it, so the ring's top edge is not under the bar.
        window.setTimeout(() => window.scrollBy({ top: -72, behavior: 'smooth' }), 260)
      }
    }
    const id = requestAnimationFrame(measure)
    const again = setTimeout(measure, 420) // after the smooth scroll settles
    const settled = setTimeout(measure, 820) // and after the nudge above
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(id)
      clearTimeout(again)
      clearTimeout(settled)
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [open, phase, step, measure])

  /* The card's height changes with the words on it and with the width of the
     screen, so it is watched rather than measured once. */
  useEffect(() => {
    const el = cardRef.current
    const read = () => {
      setView({ w: window.innerWidth, h: window.innerHeight })
      if (cardRef.current) {
        cardHRef.current = cardRef.current.offsetHeight
        setCardH(cardRef.current.offsetHeight)
      }
    }
    const id = requestAnimationFrame(read)
    const ro = el ? new ResizeObserver(read) : null
    if (el && ro) ro.observe(el)
    window.addEventListener('resize', read)
    return () => {
      cancelAnimationFrame(id)
      ro?.disconnect()
      window.removeEventListener('resize', read)
    }
  }, [open, phase, at])

  // The ring stops above the card, so it has to be redrawn once the card's
  // height is known — and again whenever a longer step makes it taller.
  useEffect(() => {
    if (!open || phase !== 'tour') return
    const id = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(id)
  }, [cardH, open, phase, measure])

  if (!open) return null

  function finish() {
    try { localStorage.setItem(TOUR_KEY, new Date().toISOString()) } catch {}
    setAsked(false)
    setPhase('welcome')
    setAt(0)
    window.dispatchEvent(new Event(TOUR_EVENT))
  }

  function startTour() {
    // Only the stops this coach actually has. Someone without the playboard
    // shouldn't be shown a hole where it would be.
    const here = pathname === '/admin/hub'
    const usable = TOUR_STEPS.filter((s) => {
      if (s.warRoomOnly && !here) return false
      return !s.target || !!findEl(s.target)
    })
    if (usable.length === 0) { finish(); return }
    setSteps(usable)
    setAt(0)
    setPhase('tour')
  }

  const guide = INSTALL_GUIDES[platform]

  if (phase === 'welcome') {
    return (
      <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-3 sm:p-6"
        style={{ background: 'rgba(17,24,39,0.6)' }} role="dialog" aria-modal="true" aria-label="Welcome">
        <div className="card w-full max-w-lg p-5 max-h-[88vh] overflow-y-auto">
          <div className="flex items-center gap-2 mb-1">
            <span aria-hidden className="text-2xl">🦅</span>
            <h2 className="text-lg font-black">Welcome to the Coaches Hub{name ? `, ${name}` : ''}</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            This is where you plan, draw it up, evaluate and run the week.
          </p>

          {installed ? (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 mb-4">
              <p className="text-sm text-green-900 font-bold">You&rsquo;re already running it as an app ✓</p>
              <p className="text-sm text-green-900">Nothing to install here.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 mb-4">
              <p className="font-bold text-sm mb-1">Put it on your home screen first</p>
              <p className="text-xs text-gray-500 mb-3">
                It opens like an app, full screen, and you&rsquo;re one tap from the plan on the field.
              </p>

              {/* The device you're holding is preselected; the others are here so
                  a head coach can read them out to somebody on a different phone. */}
              <div className="flex gap-1.5 mb-3 flex-wrap">
                {(['ios', 'android', 'desktop'] as Platform[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatform(p)}
                    className="text-xs font-bold px-2.5 py-1 rounded-full border transition-colors"
                    style={
                      p === platform
                        ? { background: 'var(--gh-green)', color: '#fff', borderColor: 'var(--gh-green)' }
                        : { background: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }
                    }
                  >
                    {p === 'ios' ? 'iPhone / iPad' : p === 'android' ? 'Android' : 'Computer'}
                  </button>
                ))}
              </div>

              <p className="text-xs font-black tracking-wider uppercase text-gray-400 mb-1.5">{guide.heading}</p>
              <ol className="space-y-1.5">
                {guide.steps.map((s, i) => (
                  <li key={s} className="flex gap-2 text-sm">
                    <span
                      className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[0.65rem] font-black text-white"
                      style={{ background: 'var(--gh-green)' }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-gray-700">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={startTour} className="btn btn-primary flex-1 sm:flex-none">
              Show me around
            </button>
            <button type="button" onClick={finish} className="btn btn-ghost flex-1 sm:flex-none">
              I&rsquo;ll look myself
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            You can run this again any time — it&rsquo;s the <strong>Show me around</strong> button under the menu.
          </p>
        </div>
      </div>
    )
  }

  // ── The walk round ──
  const last = at === steps.length - 1
  const pad = 6

  /*
   * Where the card goes.
   *
   * Under the ring if there is room, over it if there isn't, and pinned to the
   * bottom of the screen when neither fits — which on a phone, against a
   * full-height sidebar, is most of the time. Measured rather than guessed: the
   * card's own height decides, so a long step doesn't hang off the bottom.
   */
  const gap = pad + 10
  const vh = view.h || 1
  const roomBelow = box ? vh - (box.top + box.height) - gap : vh
  const roomAbove = box ? box.top - gap : vh
  const fits = (room: number) => room >= cardH + 8

  let cardStyle: React.CSSProperties
  if (!box) {
    cardStyle = { top: '50%', left: 12, right: 12, transform: 'translateY(-50%)' }
  } else if (fits(roomBelow)) {
    cardStyle = { top: box.top + box.height + gap, left: 12, right: 12 }
  } else if (fits(roomAbove)) {
    cardStyle = { top: Math.max(8, box.top - gap - cardH), left: 12, right: 12 }
  } else {
    // Nothing fits either side. Sit on the bottom like a sheet, always whole.
    cardStyle = { bottom: 12, left: 12, right: 12 }
  }

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={step?.title ?? 'Tour'}>
      {/* One element makes the whole overlay: a transparent window with a
          shadow big enough to darken everything outside it. */}
      {box ? (
        <div
          className="absolute rounded-xl pointer-events-none transition-all duration-200"
          style={{
            top: box.top - pad,
            left: box.left - pad,
            width: box.width + pad * 2,
            height: box.height + pad * 2,
            boxShadow: '0 0 0 9999px rgba(17,24,39,0.62)',
            outline: '3px solid var(--gh-green)',
            outlineOffset: 2,
          }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: 'rgba(17,24,39,0.62)' }} />
      )}

      <div
        ref={cardRef}
        className="absolute mx-auto max-w-md card p-4 shadow-xl overflow-y-auto"
        style={{ ...cardStyle, maxHeight: 'min(60vh, 26rem)' }}
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 className="font-black">{step?.title}</h3>
          <span className="text-xs font-bold text-gray-400 tabular-nums shrink-0 mt-0.5">
            {at + 1} / {steps.length}
          </span>
        </div>
        <p className="text-sm text-gray-600 mb-3">{step?.body}</p>
        <div className="flex items-center gap-2">
          {at > 0 && (
            <button type="button" onClick={() => setAt(at - 1)} className="btn btn-ghost text-sm">
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => (last ? finish() : setAt(at + 1))}
            className="btn btn-primary text-sm flex-1 sm:flex-none"
          >
            {last ? 'Got it' : 'Next'}
          </button>
          {!last && (
            <button type="button" onClick={finish} className="text-xs font-bold text-gray-400 hover:text-gray-600 ml-auto">
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
