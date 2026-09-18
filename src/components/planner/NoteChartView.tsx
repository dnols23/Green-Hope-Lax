'use client'
import { useState } from 'react'
import {
  niceTicks,
  scatterRange,
  seriesColor,
  slices,
  tickLabel,
  valueRange,
  type ChartType,
} from '@/lib/charts'
import type { NoteChart } from '@/lib/noteBlocks'

/**
 * A note's chart, drawn.
 *
 * The rules it follows, so it does not have to be argued about again: bars grow
 * from zero and are capped so the band keeps some air; a touching neighbour is
 * separated by a gap in the surface colour rather than by a stroke; gridlines
 * are hairline and recessive; text never wears the series colour — the swatch
 * beside it carries the identity; and two or more series always get a legend,
 * because nobody should have to match colours from memory.
 *
 * The surface is white, which is what the note card is.
 */

const SURFACE = '#ffffff'
const INK = '#0b0b0b'
const MUTED = '#898781'
const GRID = '#e1e0d9'
const AXIS = '#c3c2b7'

/** Room for the axis labels, in the chart's own units. */
const PAD = { top: 14, right: 16, bottom: 34, left: 46 }
const H = 240
const W = 560
const BAR_CAP = 24 // never fill the slot — the leftover is air
const GAP = 2 // the surface gap between touching marks

type Hover = { x: number; y: number; title: string; lines: { color: string; text: string }[] } | null

function Legend({ names, count }: { names: string[]; count: number }) {
  if (count < 2) return null
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 text-xs" style={{ color: '#52514e' }}>
          <span
            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: seriesColor(i, count) }}
          />
          {names[i] || `Series ${i + 1}`}
        </span>
      ))}
    </div>
  )
}

export function NoteChartView({ chart }: { chart: NoteChart }) {
  const [hover, setHover] = useState<Hover>(null)

  const type: ChartType = chart.type ?? 'column'
  const names = (chart.series ?? []).map((s) => s.name)
  const count = Math.max(1, chart.series?.length ?? 1)
  const rows = chart.rows.filter((r) => r.label.trim() || r.values.some((v) => v !== 0))

  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-6 text-center border border-dashed border-gray-200 rounded-lg">
        Fill in a row or two and the chart draws itself.
      </p>
    )
  }

  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const tip = (e: React.MouseEvent, title: string, lines: { color: string; text: string }[]) => {
    const box = (e.currentTarget as SVGGraphicsElement).ownerSVGElement?.getBoundingClientRect()
    if (!box) return
    setHover({ x: e.clientX - box.left, y: e.clientY - box.top, title, lines })
  }

  // ── Pie ──────────────────────────────────────────────────────────────────
  if (type === 'pie') {
    const parts = slices(rows)
    const r = 82
    const cx = W / 2
    const cy = H / 2
    let angle = -Math.PI / 2

    return (
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={chart.label || 'Chart'}>
          {parts.length === 0 ? (
            <text x={cx} y={cy} textAnchor="middle" fontSize={13} fill={MUTED}>
              Put some numbers in and the slices appear.
            </text>
          ) : (
            parts.map((s, i) => {
              const sweep = s.share * Math.PI * 2
              const a0 = angle
              const a1 = angle + sweep
              angle = a1
              const mid = (a0 + a1) / 2
              const big = sweep > Math.PI ? 1 : 0
              const d =
                s.share >= 0.999
                  ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
                  : `M ${cx} ${cy} L ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} ` +
                    `A ${r} ${r} 0 ${big} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} Z`
              const color = seriesColor(i, Math.max(2, parts.length))
              return (
                <g key={s.label + i}>
                  {/* The gap between slices is surface, not a stroke. */}
                  <path
                    d={d}
                    fill={color}
                    stroke={SURFACE}
                    strokeWidth={GAP}
                    onMouseMove={(e) =>
                      tip(e, s.label || '—', [
                        { color, text: `${tickLabel(s.value)} · ${Math.round(s.share * 100)}%` },
                      ])
                    }
                    onMouseLeave={() => setHover(null)}
                  />
                  {s.share > 0.06 && (
                    <text
                      x={cx + r * 0.66 * Math.cos(mid)}
                      y={cy + r * 0.66 * Math.sin(mid)}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={12}
                      fontWeight={700}
                      fill="#ffffff"
                    >
                      {Math.round(s.share * 100)}%
                    </text>
                  )}
                </g>
              )
            })
          )}
        </svg>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
          {parts.map((s, i) => (
            <span key={s.label + i} className="inline-flex items-center gap-1.5 text-xs" style={{ color: '#52514e' }}>
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: seriesColor(i, Math.max(2, parts.length)) }}
              />
              {s.label || '—'}
              <span style={{ color: MUTED }}>{tickLabel(s.value)}</span>
            </span>
          ))}
        </div>
        <Tooltip hover={hover} />
      </div>
    )
  }

  // ── Everything with axes ─────────────────────────────────────────────────
  const [lo, hi] = valueRange(rows, type, count)
  const ticks = niceTicks(lo, hi)
  const vMin = ticks[0]
  const vMax = ticks[ticks.length - 1]
  const toY = (v: number) => PAD.top + plotH - ((v - vMin) / (vMax - vMin || 1)) * plotH
  const zeroY = toY(0)

  const band = plotW / rows.length
  const horizontal = type === 'bar'

  // Bars lying down swap the axes: the bands run down the left.
  const bandH = plotH / rows.length
  const toX = (v: number) => PAD.left + ((v - vMin) / (vMax - vMin || 1)) * plotW
  const zeroX = toX(0)

  const [sx0, sx1] = type === 'scatter' ? scatterRange(rows) : [0, 1]
  const xTicks = type === 'scatter' ? niceTicks(sx0, sx1) : []
  const sxMin = xTicks[0] ?? sx0
  const sxMax = xTicks[xTicks.length - 1] ?? sx1
  const toSx = (v: number) => PAD.left + ((v - sxMin) / (sxMax - sxMin || 1)) * plotW

  const upName = type === 'scatter' ? names[1] || chart.unit : chart.unit
  const acrossName = type === 'scatter' ? names[0] || chart.axis : chart.axis

  return (
    <div className="relative">
      {upName && (
        <div className="text-[0.7rem] font-bold mb-0.5" style={{ color: MUTED }}>
          {upName}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={chart.label || 'Chart'}>
        {/* Gridlines and the value axis. Hairline, solid, recessive. */}
        {!horizontal &&
          ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={toY(t)} y2={toY(t)} stroke={t === 0 ? AXIS : GRID} strokeWidth={1} />
              <text x={PAD.left - 8} y={toY(t)} textAnchor="end" dominantBaseline="central" fontSize={11} fill={MUTED} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {tickLabel(t)}
              </text>
            </g>
          ))}
        {horizontal &&
          ticks.map((t) => (
            <g key={t}>
              <line y1={PAD.top} y2={PAD.top + plotH} x1={toX(t)} x2={toX(t)} stroke={t === 0 ? AXIS : GRID} strokeWidth={1} />
              <text x={toX(t)} y={PAD.top + plotH + 14} textAnchor="middle" fontSize={11} fill={MUTED} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {tickLabel(t)}
              </text>
            </g>
          ))}
        {type === 'scatter' &&
          xTicks.map((t) => (
            <g key={`x${t}`}>
              <line y1={PAD.top} y2={PAD.top + plotH} x1={toSx(t)} x2={toSx(t)} stroke={GRID} strokeWidth={1} />
              <text x={toSx(t)} y={PAD.top + plotH + 14} textAnchor="middle" fontSize={11} fill={MUTED} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {tickLabel(t)}
              </text>
            </g>
          ))}

        {/* Columns, grouped side by side when there is more than one series. */}
        {type === 'column' &&
          rows.map((row, ri) => {
            const slot = (band - GAP * (count - 1)) / count
            const w = Math.min(BAR_CAP, Math.max(4, slot * 0.8))
            const groupW = w * count + GAP * (count - 1)
            const left = PAD.left + ri * band + (band - groupW) / 2
            return row.values.slice(0, count).map((v, si) => {
              const color = seriesColor(si, count)
              const y = Math.min(toY(v), zeroY)
              const h = Math.max(1, Math.abs(toY(v) - zeroY))
              const x = left + si * (w + GAP)
              return (
                <g key={`${ri}-${si}`}>
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    rx={Math.min(4, w / 2)}
                    fill={color}
                    onMouseMove={(e) =>
                      tip(e, row.label || '—', [{ color, text: `${names[si] || 'Value'}: ${tickLabel(v)}` }])
                    }
                    onMouseLeave={() => setHover(null)}
                  />
                  {/* Square where it meets the baseline: the rounding is the
                      data end, not decoration on both ends. */}
                  <rect x={x} y={v >= 0 ? zeroY - 4 : zeroY} width={w} height={4} fill={color} />
                  {count === 1 && (
                    <text x={x + w / 2} y={y - 5} textAnchor="middle" fontSize={11} fontWeight={700} fill={INK}>
                      {tickLabel(v)}
                    </text>
                  )}
                </g>
              )
            })
          })}

        {/* Bars, lying down. */}
        {horizontal &&
          rows.map((row, ri) => {
            const slot = (bandH - GAP * (count - 1)) / count
            const h = Math.min(BAR_CAP, Math.max(4, slot * 0.8))
            const groupH = h * count + GAP * (count - 1)
            const top = PAD.top + ri * bandH + (bandH - groupH) / 2
            return row.values.slice(0, count).map((v, si) => {
              const color = seriesColor(si, count)
              const x = Math.min(toX(v), zeroX)
              const w = Math.max(1, Math.abs(toX(v) - zeroX))
              const y = top + si * (h + GAP)
              return (
                <g key={`${ri}-${si}`}>
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    rx={Math.min(4, h / 2)}
                    fill={color}
                    onMouseMove={(e) =>
                      tip(e, row.label || '—', [{ color, text: `${names[si] || 'Value'}: ${tickLabel(v)}` }])
                    }
                    onMouseLeave={() => setHover(null)}
                  />
                  <rect x={v >= 0 ? zeroX : zeroX - 4} y={y} width={4} height={h} fill={color} />
                  {count === 1 && (
                    <text x={x + w + 6} y={y + h / 2} dominantBaseline="central" fontSize={11} fontWeight={700} fill={INK}>
                      {tickLabel(v)}
                    </text>
                  )}
                </g>
              )
            })
          })}

        {/* Stacked: parts of a whole, a surface gap between every segment. */}
        {type === 'stacked' &&
          rows.map((row, ri) => {
            const w = Math.min(BAR_CAP * 1.6, band * 0.62)
            const x = PAD.left + ri * band + (band - w) / 2
            let up = 0
            return row.values.slice(0, count).map((v, si) => {
              const color = seriesColor(si, count)
              const y0 = toY(up)
              up += Math.max(0, v)
              const y1 = toY(up)
              const h = Math.max(0, y0 - y1 - GAP)
              if (v <= 0) return null
              return (
                <rect
                  key={`${ri}-${si}`}
                  x={x}
                  y={y1}
                  width={w}
                  height={h}
                  rx={si === count - 1 ? 4 : 0}
                  fill={color}
                  onMouseMove={(e) =>
                    tip(e, row.label || '—', [{ color, text: `${names[si] || `Series ${si + 1}`}: ${tickLabel(v)}` }])
                  }
                  onMouseLeave={() => setHover(null)}
                />
              )
            })
          })}

        {/* Lines. 2px, round join, a labelled marker only at the end. */}
        {type === 'line' &&
          Array.from({ length: count }, (_, si) => {
            const color = seriesColor(si, count)
            const pts = rows.map((row, ri) => ({
              x: PAD.left + band * ri + band / 2,
              y: toY(row.values[si] ?? 0),
              v: row.values[si] ?? 0,
              label: row.label,
            }))
            const last = pts[pts.length - 1]
            return (
              <g key={si}>
                <polyline
                  points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {pts.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={4}
                    fill={color}
                    stroke={SURFACE}
                    strokeWidth={2}
                    onMouseMove={(e) =>
                      tip(e, p.label || '—', [{ color, text: `${names[si] || 'Value'}: ${tickLabel(p.v)}` }])
                    }
                    onMouseLeave={() => setHover(null)}
                  />
                ))}
                {last && (
                  <text x={last.x + 8} y={last.y} dominantBaseline="central" fontSize={11} fontWeight={700} fill={INK}>
                    {tickLabel(last.v)}
                  </text>
                )}
              </g>
            )
          })}

        {/* Scatter: one dot per row, x from the first column, y from the second. */}
        {type === 'scatter' &&
          rows.map((row, ri) => {
            const color = seriesColor(0, 1)
            return (
              <circle
                key={ri}
                cx={toSx(row.values[0] ?? 0)}
                cy={toY(row.values[1] ?? 0)}
                r={5}
                fill={color}
                stroke={SURFACE}
                strokeWidth={2}
                onMouseMove={(e) =>
                  tip(e, row.label || '—', [
                    { color, text: `${names[0] || 'X'}: ${tickLabel(row.values[0] ?? 0)}` },
                    { color, text: `${names[1] || 'Y'}: ${tickLabel(row.values[1] ?? 0)}` },
                  ])
                }
                onMouseLeave={() => setHover(null)}
              />
            )
          })}

        {/* The across axis. */}
        {!horizontal && type !== 'scatter' && (
          <>
            <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} stroke={AXIS} strokeWidth={1} />
            {rows.map((row, ri) => (
              <text
                key={ri}
                x={PAD.left + band * ri + band / 2}
                y={PAD.top + plotH + 15}
                textAnchor="middle"
                fontSize={11}
                fill={MUTED}
              >
                {row.label.length > 12 ? `${row.label.slice(0, 11)}…` : row.label}
              </text>
            ))}
          </>
        )}
        {horizontal &&
          rows.map((row, ri) => (
            <text
              key={ri}
              x={PAD.left - 8}
              y={PAD.top + bandH * ri + bandH / 2}
              textAnchor="end"
              dominantBaseline="central"
              fontSize={11}
              fill={MUTED}
            >
              {row.label.length > 9 ? `${row.label.slice(0, 8)}…` : row.label}
            </text>
          ))}

      </svg>

      {/* The axis names sit outside the plot. Inside, the value-axis name lands
          on the top gridline and its tick. */}
      {acrossName && (
        <div className="text-[0.7rem] font-bold text-right mt-0.5" style={{ color: MUTED }}>
          {acrossName}
        </div>
      )}

      {type !== 'scatter' && <Legend names={names} count={count} />}
      <Tooltip hover={hover} />
    </div>
  )
}

function Tooltip({ hover }: { hover: Hover }) {
  if (!hover) return null
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-lg border border-gray-200 bg-white shadow-lg px-2.5 py-1.5"
      style={{ left: Math.max(0, hover.x - 40), top: Math.max(0, hover.y - 58) }}
    >
      <div className="text-xs font-bold" style={{ color: INK }}>
        {hover.title}
      </div>
      {hover.lines.map((l, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs" style={{ color: '#52514e' }}>
          <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: l.color }} />
          {l.text}
        </div>
      ))}
    </div>
  )
}
