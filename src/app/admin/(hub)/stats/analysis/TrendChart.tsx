'use client'

import { useState } from 'react'
import type { MetricCard } from './analysis'
import { trendScale } from './analysis'
import { Key } from './charts'

/**
 * One headline number game by game: the game's own value (green line and
 * dots), the rolling 3-game average (gray), the stretch's average (a solid
 * hairline) and, where there is one, the target (dashed).
 *
 * Drawn in percentages — the lines in a stretchable SVG, the dots and labels
 * as positioned boxes — so it fills any width without a resize listener and
 * the dots stay round. Pointing at (or tapping, or arrowing to) a game shows
 * its numbers in the line above the chart, which never covers the data; with
 * nothing pointed at, that line shows the latest game.
 */
export function TrendChart({ card }: { card: MetricCard }) {
  const [active, setActive] = useState<number | null>(null)
  const pts = card.points
  const n = pts.length
  if (!n) return null

  const hasRolling = pts.some((p) => p.rolling != null)
  const scale = trendScale([...pts.map((p) => p.value), ...pts.map((p) => p.rolling), card.average, card.target], card.kind)
  const pad = n <= 2 ? 20 : 4
  const x = (i: number) => (n === 1 ? 50 : pad + (i * (100 - 2 * pad)) / (n - 1))
  const y = (v: number) => (1 - (v - scale.min) / (scale.max - scale.min)) * 100
  const tick = (t: number) => (card.kind === 'rate' ? `${Math.round(t * 100)}%` : t > 0 ? `+${t}` : `${t}`)
  const path = (vals: (number | null)[]) =>
    vals
      .map((v, i) => (v == null ? null : `${x(i)},${y(v)}`))
      .filter(Boolean)
      .join(' ')

  const shown = active ?? n - 1
  const cur = pts[shown]
  // Which games get a name under the axis: all of them if `room` allows,
  // otherwise every k-th game counting back from the latest, so the gaps are
  // even and the newest game is always named.
  const pick = (room: number) => {
    const s = new Set<number>()
    const step = n <= room ? 1 : Math.ceil((n - 1) / (room - 1))
    for (let i = n - 1; i >= 0; i -= step) s.add(i)
    return s
  }
  // Sized so a name (up to 4.5rem) never runs into the next one at that width.
  const small = pick(3)
  const medium = pick(5)
  const large = pick(8)

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const from = active ?? n - 1
      setActive(Math.max(0, Math.min(n - 1, from + (e.key === 'ArrowLeft' ? -1 : 1))))
    } else if (e.key === 'Escape') setActive(null)
  }

  return (
    <div>
      {/* The read-out: the game in focus, and the averages beside it. */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 min-h-12" aria-live="polite">
        <div className="text-sm text-gray-500 min-w-0">
          <span className="font-semibold text-gray-700">vs {cur.opponent}</span> · {cur.date}
          {active == null && n > 1 && <span className="text-gray-400"> (latest)</span>}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-black">{cur.valueText}</span>
          {cur.detail && <span className="text-sm text-gray-500 tabular-nums">{cur.detail}</span>}
          {cur.value == null && <span className="text-sm text-gray-400">nothing to measure</span>}
        </div>
        {cur.rolling != null && (
          <div className="text-sm text-gray-500">
            3-game avg <span className="font-bold text-gray-700 tabular-nums">{cur.rollingText}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-2 mb-3">
        <Key color="var(--viz-us)" kind="line">
          Each game
        </Key>
        {hasRolling && (
          <Key color="var(--viz-roll)" kind="line">
            3-game average
          </Key>
        )}
        <Key color="var(--viz-ref)" kind="line">
          Average <span className="font-bold text-gray-700 tabular-nums">{card.valueText}</span>
        </Key>
        {card.targetText && (
          <Key color="var(--viz-ref)" kind="line" dashed>
            Target <span className="font-bold text-gray-700 tabular-nums">{card.targetText}</span>
          </Key>
        )}
      </div>

      <div
        className="relative h-52 sm:h-60 pl-10 pr-2 pb-7 outline-none rounded-lg focus-visible:ring-2 focus-visible:ring-[var(--gh-green)]"
        tabIndex={0}
        role="group"
        aria-label={`${card.label} game by game. Use the arrow keys to step through the games.`}
        onKeyDown={onKey}
        // A finger lifting off counts as leaving; keep the tapped game showing.
        onPointerLeave={(e) => {
          if (e.pointerType !== 'touch') setActive(null)
        }}
      >
        <div className="relative h-full w-full">
          {/* Y axis: round ticks in the left margin, hairline gridlines across. */}
          {scale.ticks.map((t) => (
            <span
              key={`label-${t}`}
              className="absolute -left-10 w-8 -translate-y-1/2 text-right text-[0.7rem] tabular-nums text-gray-400"
              style={{ top: `${y(t)}%` }}
              aria-hidden
            >
              {tick(t)}
            </span>
          ))}
          {scale.ticks.map((t) => (
            <div
              key={t}
              className="absolute inset-x-0 border-t"
              style={{ top: `${y(t)}%`, borderColor: t === 0 && card.kind === 'margin' ? 'var(--viz-axis)' : 'var(--viz-grid)' }}
              aria-hidden
            />
          ))}
          {card.average != null && (
            <div className="absolute inset-x-0 border-t" style={{ top: `${y(card.average)}%`, borderColor: 'var(--viz-ref)' }} aria-hidden />
          )}
          {card.target != null && (
            <div className="absolute inset-x-0 border-t border-dashed" style={{ top: `${y(card.target)}%`, borderColor: 'var(--viz-ref)' }} aria-hidden />
          )}

          {/* Crosshair on the game in focus. */}
          {active != null && (
            <div className="absolute inset-y-0 border-l" style={{ left: `${x(active)}%`, borderColor: 'var(--viz-axis)' }} aria-hidden />
          )}

          <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            {hasRolling && (
              <polyline
                points={path(pts.map((p) => p.rolling))}
                fill="none"
                stroke="var(--viz-roll)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                opacity={0.7}
              />
            )}
            <polyline
              points={path(pts.map((p) => p.value))}
              fill="none"
              stroke="var(--viz-us)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {pts.map((p, i) =>
            p.value == null ? null : (
              <span
                key={p.gameId}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--surface)] transition-[width,height] ${
                  i === shown ? 'h-3 w-3' : 'h-2 w-2'
                }`}
                style={{ left: `${x(i)}%`, top: `${y(p.value)}%`, background: 'var(--viz-us)' }}
                aria-hidden
              />
            )
          )}

          {/* Hit areas: each game owns the strip halfway to its neighbours, so the pointer only has to be near. */}
          {pts.map((p, i) => {
            const left = i === 0 ? 0 : (x(i - 1) + x(i)) / 2
            const right = i === n - 1 ? 100 : (x(i) + x(i + 1)) / 2
            return (
              <div
                key={p.gameId}
                className="absolute inset-y-0"
                style={{ left: `${left}%`, width: `${right - left}%` }}
                onPointerEnter={() => setActive(i)}
                onPointerDown={() => setActive(i)}
                aria-hidden
              />
            )
          })}

          {/* Opponents along the bottom, thinned out to what fits. */}
          {pts.map((p, i) => {
            const cls = [small.has(i) ? 'block' : 'hidden', medium.has(i) ? 'sm:block' : 'sm:hidden', large.has(i) ? 'xl:block' : 'xl:hidden'].join(' ')
            return (
              <span
                key={p.gameId}
                className={`${cls} absolute top-full mt-2 max-w-[4.5rem] truncate text-[0.7rem] ${i === shown ? 'font-bold text-gray-700' : 'text-gray-400'}`}
                style={{ left: `${x(i)}%`, transform: `translateX(-${x(i)}%)` }}
                aria-hidden
              >
                {p.opponent}
              </span>
            )
          })}
        </div>
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer list-none text-xs font-semibold text-gray-500 hover:text-gray-900 inline-flex items-center gap-1">
          <span className="caret">▸</span> Every game as a table
        </summary>
        <div className="table-scroll mt-2">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Opponent</th>
                <th className="!text-right">{card.label}</th>
                {hasRolling && <th className="!text-right">3-game avg</th>}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {pts.map((p) => (
                <tr key={p.gameId}>
                  <td className="whitespace-nowrap text-gray-500">{p.date}</td>
                  <td>{p.opponent}</td>
                  <td className="text-right whitespace-nowrap">
                    <span className="font-semibold">{p.valueText}</span>
                    {p.detail && <span className="text-gray-400 ml-1.5">{p.detail}</span>}
                  </td>
                  {hasRolling && <td className="text-right text-gray-500">{p.rollingText}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
