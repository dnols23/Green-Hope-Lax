'use client'

import { useRef, useState } from 'react'
import type { MetricKey } from '@/lib/stats'
import type { MetricCard } from './analysis'
import { Sparkline } from './charts'
import { TrendChart } from './TrendChart'

/**
 * The headline tiles and the trend chart they drive. Tapping a tile puts that
 * number on the chart; the choice goes into the address (?metric=) so a link
 * to "our clearing, game by game" opens on exactly that. The takeaways sit
 * between the two, passed through as they were rendered on the server.
 */
export function MetricExplorer({
  cards,
  initial,
  children,
}: {
  cards: MetricCard[]
  initial: MetricKey
  children?: React.ReactNode
}) {
  const [selected, setSelected] = useState<MetricKey>(initial)
  const trendRef = useRef<HTMLElement>(null)
  const card = cards.find((c) => c.key === selected) ?? cards[0]

  const choose = (key: MetricKey) => {
    setSelected(key)
    // Into the address without a round trip to the server: Next keeps its router in step.
    const params = new URLSearchParams(window.location.search)
    params.set('metric', key)
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
    // On a phone the chart is a screen away; bring it up so the tap visibly did something.
    const el = trendRef.current
    if (el && el.getBoundingClientRect().top > window.innerHeight - 160) {
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })
    }
  }

  return (
    <>
      <section aria-labelledby="headline-numbers">
        <h2 id="headline-numbers" className="sr-only">
          Headline numbers
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
          {cards.map((c) => (
            <Tile key={c.key} card={c} on={c.key === card.key} onPick={() => choose(c.key)} />
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-400">Tap a number to see it game by game.</p>
      </section>

      {children}

      <section ref={trendRef} className="card p-4 sm:p-5 min-w-0 scroll-mt-4" aria-labelledby="trend-title">
        <div className="mb-3">
          <h2 id="trend-title" className="font-bold text-gray-700">
            {card.label}, game by game
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">{card.help}</p>
        </div>
        <TrendChart card={card} />
      </section>
    </>
  )
}

/**
 * One headline number: the stretch's value large, the made/attempts under a
 * rate, the game-by-game shape, and a quiet word on the target. Under five
 * attempts the target line only says what the target is — too few to judge.
 */
function Tile({ card: c, on, onPick }: { card: MetricCard; on: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={on}
      title={c.help}
      className={`card text-left p-3 sm:p-3.5 min-w-0 flex flex-col transition-colors ${
        on ? 'ring-2 ring-[var(--gh-green)] border-transparent' : 'hover:border-gray-300'
      }`}
    >
      <span className="text-xs font-bold text-gray-500 leading-tight truncate">{c.label}</span>
      <span className="mt-1 flex items-baseline gap-1.5 min-w-0">
        <span className="text-[1.65rem] leading-none font-black tracking-tight">{c.valueText}</span>
        <span className="text-xs text-gray-400 tabular-nums truncate">{c.detail}</span>
      </span>
      <span className="mt-2.5 block">
        <Sparkline values={c.points.map((p) => p.value)} />
      </span>
      <span className="mt-2 text-[0.7rem] text-gray-500 min-h-4 flex items-center gap-1.5">
        {c.targetText && c.status === 'on' && (
          <>
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'var(--viz-good)' }} aria-hidden />
            On target <span className="text-gray-400">· {c.targetText}</span>
          </>
        )}
        {c.targetText && c.status === 'under' && (
          <>
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'var(--viz-bad)' }} aria-hidden />
            Under target <span className="text-gray-400">· {c.targetText}</span>
          </>
        )}
        {c.targetText && c.status === 'thin' && <span className="text-gray-400">Target {c.targetText}</span>}
      </span>
    </button>
  )
}
