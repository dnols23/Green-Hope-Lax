// The Analysis page's small charts, drawn by hand: no chart library, just
// HTML boxes and the odd SVG line, sized in percentages so they fill whatever
// width they're given and never push the page sideways on a phone.
//
// No hooks here, so the server can render these and the client pieces can
// borrow them. Hover read-outs are CSS only (group-hover / focus), and each
// one is pinned inside its chart so a read-out at the edge can't overflow the
// screen. Every value they show is also printed on the chart or in a table
// beside it; hovering is a convenience, never the only way to read a number.

import type { QuarterRow, ShotSide } from './analysis'

/**
 * The chart colours, by job. Green Hope is the brand green; the opponent is a
 * quiet gray, so our line is the one the eye lands on. Shot results run one
 * blue from dark (in) to light (missed) — closer to a goal, darker — and turn
 * the other way round on the dark theme, where light reads as "more". The
 * pairs were checked for colour-blind separation and contrast against both
 * themes' card colour.
 */
export const VIZ_CSS = `
.stats-viz {
  --viz-us: var(--gh-green);
  --viz-us-wash: color-mix(in srgb, var(--gh-green) 14%, transparent);
  --viz-them: #868b93;
  --viz-grid: #eceeec;
  --viz-axis: #cdd2cd;
  --viz-ref: #8a919b;
  --viz-roll: #4b5563;
  --viz-good: #0ca30c;
  --viz-bad: #d03b3b;
  --shot-goal: #104281;    --shot-goal-ink: #ffffff;
  --shot-saved: #1c5cab;   --shot-saved-ink: #ffffff;
  --shot-post: #2a78d6;    --shot-post-ink: #ffffff;
  --shot-blocked: #5598e7; --shot-blocked-ink: #0b2545;
  --shot-missed: #86b6ef;  --shot-missed-ink: #0b2545;
}
html[data-theme='dark'] .app-theme .stats-viz {
  --viz-them: #6b7480;
  --viz-grid: #222930;
  --viz-axis: #3a434e;
  --viz-ref: #7d8793;
  --viz-roll: #c9cfd6;
  --shot-goal: #cde2fb;    --shot-goal-ink: #0b2545;
  --shot-saved: #9ec5f4;   --shot-saved-ink: #0b2545;
  --shot-post: #6da7ec;    --shot-post-ink: #0b2545;
  --shot-blocked: #3987e5; --shot-blocked-ink: #0b2545;
  --shot-missed: #256abf;  --shot-missed-ink: #ffffff;
}
`

/** A read-out that appears over a chart on hover or keyboard focus. */
const TIP =
  'pointer-events-none absolute z-10 hidden group-hover:block group-focus-visible:block whitespace-nowrap rounded-lg border bg-white px-2.5 py-1.5 text-xs shadow-md'

/**
 * A tile's tiny game-by-game line. The line is gray and the latest game is a
 * green dot: the shape is context, the last game is the news. Games with
 * nothing to measure are stepped over.
 */
export function Sparkline({ values }: { values: (number | null)[] }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v != null)
  if (!pts.length) return <div className="h-7" aria-hidden />
  const lo = Math.min(...pts.map((p) => p.v))
  const hi = Math.max(...pts.map((p) => p.v))
  const n = values.length
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100)
  // A flat line sits in the middle; otherwise 12% headroom keeps the stroke off the edges.
  const y = (v: number) => (hi - lo < 1e-9 ? 50 : 88 - ((v - lo) / (hi - lo)) * 76)
  const last = pts[pts.length - 1]
  return (
    <div className="relative h-7" aria-hidden>
      {pts.length > 1 && (
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline
            points={pts.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')}
            fill="none"
            stroke="var(--viz-them)"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
      <span
        className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--surface)]"
        style={{ left: `${x(last.i)}%`, top: `${y(last.v)}%`, background: 'var(--viz-us)' }}
      />
    </div>
  )
}

/** A legend key: a small square for bars, a short stroke for lines. */
export function Key({ color, kind = 'box', dashed = false, children }: { color: string; kind?: 'box' | 'line' | 'dot'; dashed?: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {kind === 'box' ? (
        <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} aria-hidden />
      ) : kind === 'dot' ? (
        <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />
      ) : (
        <span className="w-4 border-t-2" style={{ borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }} aria-hidden />
      )}
      {children}
    </span>
  )
}

const BAR_H = 64 // px, the tallest bar either way from the middle
const CAP = 18 // px, room for the number on a bar's end

/**
 * Goals for (up, green) and against (down, gray) in each quarter, from one
 * middle line, with the quarter's differential underneath. Columns rather
 * than a line: quarters are four separate buckets, not a time series.
 */
export function QuarterChart({ rows }: { rows: QuarterRow[] }) {
  const top = Math.max(1, ...rows.map((r) => Math.max(r.goalsFor, r.goalsAgainst)))
  const h = (v: number) => (v / top) * BAR_H
  const n = rows.length
  return (
    <div className="relative">
      {/* The middle line every bar grows from. */}
      <div className="absolute inset-x-0 border-t" style={{ top: CAP + BAR_H, borderColor: 'var(--viz-axis)' }} aria-hidden />
      <div className="flex">
        {rows.map((r, i) => {
          const center = ((i + 0.5) / n) * 100
          return (
            <div
              key={r.period}
              tabIndex={0}
              className="group flex-1 min-w-0 flex flex-col items-center rounded-lg outline-none focus-visible:bg-gray-50"
              aria-label={`${r.label}: ${r.goalsFor} for, ${r.goalsAgainst} against, ${r.diff > 0 ? '+' : ''}${r.diff}. Shots ${r.shotsFor} to ${r.shotsAgainst}.`}
            >
              <div className="flex flex-col items-center justify-end" style={{ height: CAP + BAR_H }}>
                <span className="text-xs font-bold tabular-nums leading-[18px]">{r.goalsFor}</span>
                {r.goalsFor > 0 && (
                  <span
                    className="block w-full max-w-6 rounded-t-[4px] transition-opacity group-hover:opacity-80"
                    style={{ height: h(r.goalsFor), background: 'var(--viz-us)', minWidth: 14 }}
                  />
                )}
              </div>
              <div className="flex flex-col items-center justify-start" style={{ height: CAP + BAR_H }}>
                {r.goalsAgainst > 0 && (
                  <span
                    className="block w-full max-w-6 rounded-b-[4px] transition-opacity group-hover:opacity-80"
                    style={{ height: h(r.goalsAgainst), background: 'var(--viz-them)', minWidth: 14 }}
                  />
                )}
                <span className="text-xs font-semibold tabular-nums leading-[18px] text-gray-500">{r.goalsAgainst}</span>
              </div>
              <div className="mt-2 text-xs font-black text-gray-700">{r.label}</div>
              <div
                className={`mt-0.5 text-xs font-bold tabular-nums ${r.diff > 0 ? 'text-gray-900' : r.diff < 0 ? 'text-gray-500' : 'text-gray-400'}`}
              >
                {r.diff > 0 ? '+' : ''}
                {r.diff}
              </div>
              <div className={TIP} style={{ top: 0, left: `${center}%`, transform: `translateX(-${center}%)`, borderColor: 'var(--border)' }}>
                <div className="font-bold text-gray-900">
                  {r.label}: {r.goalsFor}–{r.goalsAgainst}
                </div>
                <div className="text-gray-500 tabular-nums">
                  Shots {r.shotsFor}–{r.shotsAgainst}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * One side's shots as a single bar split by result. A count sits inside its
 * piece only when the piece is wide enough to hold it; the table beside the
 * chart has every number regardless.
 */
export function ShotBar({ side }: { side: ShotSide }) {
  if (!side.total) return <div className="h-5 rounded-[4px] bg-gray-100" aria-hidden />
  const parts = side.parts.filter((p) => p.count > 0)
  // Where each piece's middle falls along the bar, for pinning its read-out.
  const centers = parts.map((p, i) => (parts.slice(0, i).reduce((s, q) => s + q.share, 0) + p.share / 2) * 100)
  return (
    <div className="relative">
      <div className="flex h-5 gap-[2px]">
        {parts.map((p, i) => {
          const center = centers[i]
          return (
            <div
              key={p.result}
              tabIndex={0}
              aria-label={`${p.label}: ${p.count} of ${side.total}`}
              className={`group min-w-[3px] flex items-center justify-center text-[0.7rem] font-bold tabular-nums outline-none transition-opacity hover:opacity-85 focus-visible:opacity-85 ${
                i === parts.length - 1 ? 'rounded-r-[4px]' : ''
              }`}
              style={{ flex: `${p.count} 1 0`, background: `var(--shot-${p.result})`, color: `var(--shot-${p.result}-ink)` }}
            >
              {p.share >= 0.1 ? p.count : null}
              <span className={TIP} style={{ bottom: 'calc(100% + 6px)', left: `${center}%`, transform: `translateX(-${center}%)`, borderColor: 'var(--border)' }}>
                <span className="font-bold text-gray-900">
                  {p.label}: {p.count}
                </span>{' '}
                <span className="text-gray-500">({Math.round(p.share * 100)}% of shots)</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** A thin bar for a win percentage: the track is a pale wash of the same green. */
export function WinMeter({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="h-1.5 w-full rounded-full" style={{ background: 'var(--viz-us-wash)' }} role="img" aria-label={label}>
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, pct)) * 100}%`, background: 'var(--viz-us)' }} />
    </div>
  )
}
