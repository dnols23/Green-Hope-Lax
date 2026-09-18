'use client'
import { useState } from 'react'
import { CHART_KINDS, MAX_SERIES, chartKind, fits, seriesColor, whyNot, type ChartType } from '@/lib/charts'
import type { NoteChart } from '@/lib/noteBlocks'
import { NoteChartView } from './NoteChartView'

/**
 * Building a chart in a note.
 *
 * Two halves: the little table of numbers, and the chart it makes, live, above
 * it. Which kinds of chart are on offer depends on what is in the table — a pie
 * wants one column of numbers, a scatter wants two, stacked wants at least two
 * — so the picker greys out the ones that do not fit and says why, rather than
 * letting a coach choose something the data cannot draw.
 */
export function ChartBlock({
  block,
  onChange,
}: {
  block: NoteChart
  onChange: (next: Partial<NoteChart>) => void
}) {
  const [showTable, setShowTable] = useState(true)
  const series = block.series?.length ? block.series : [{ name: '' }]
  const count = series.length
  const type: ChartType = block.type ?? 'column'

  const setRows = (rows: NoteChart['rows']) => onChange({ rows })

  const addSeries = () => {
    if (count >= MAX_SERIES) return
    onChange({
      series: [...series, { name: '' }],
      rows: block.rows.map((r) => ({ ...r, values: [...r.values, 0] })),
    })
  }

  const dropSeries = (i: number) => {
    if (count <= 1) return
    const left = series.filter((_, j) => j !== i)
    onChange({
      series: left,
      rows: block.rows.map((r) => ({ ...r, values: r.values.filter((_, j) => j !== i) })),
      // Dropping a column can leave the chosen kind impossible. Fall back to
      // the one that always works rather than drawing nothing.
      type: fits(type, left.length) ? type : 'column',
    })
  }

  const cell =
    'bg-white border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--gh-green)]'

  return (
    <div className="pr-16">
      <input
        value={block.label}
        onChange={(e) => onChange({ label: e.target.value })}
        placeholder="What is this a chart of?"
        className="w-full bg-transparent border-0 p-0 font-bold focus:outline-none focus:ring-0 mb-2"
      />

      {/* What kind. Anything the data cannot make says so instead of vanishing —
          a coach should be able to see that a scatter is one column away. */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {CHART_KINDS.map((k) => {
          const ok = fits(k.key, count)
          const active = type === k.key
          return (
            <button
              key={k.key}
              type="button"
              disabled={!ok}
              onClick={() => onChange({ type: k.key })}
              title={ok ? k.blurb : (whyNot(k.key, count) ?? '')}
              className="px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: active ? 'var(--gh-green)' : '#fff',
                color: active ? '#fff' : '#4b5563',
                borderColor: active ? 'var(--gh-green)' : '#e5e7eb',
              }}
            >
              {k.label}
            </button>
          )
        })}
        <span className="text-xs text-gray-400">{chartKind(type).blurb}</span>
      </div>

      <NoteChartView chart={{ ...block, type, series }} />

      <div className="flex items-center gap-3 mt-2 mb-1">
        <button
          type="button"
          onClick={() => setShowTable(!showTable)}
          className="text-xs font-bold text-[var(--gh-green)]"
        >
          {showTable ? 'Hide the numbers' : 'Show the numbers'}
        </button>
      </div>

      {showTable && (
        <div className="space-y-2">
          {/* What the rows are, and what the numbers are. Both end up on the
              chart as axis names, which is the difference between a chart
              somebody else can read and one only you can. */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={block.axis ?? ''}
              onChange={(e) => onChange({ axis: e.target.value })}
              placeholder={type === 'scatter' ? 'What each dot is (Player)' : 'What the rows are (Opponent)'}
              className={`${cell} w-48`}
            />
            {type !== 'scatter' && (
              <input
                value={block.unit ?? ''}
                onChange={(e) => onChange({ unit: e.target.value })}
                placeholder="What the numbers are (Goals)"
                className={`${cell} w-48`}
              />
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="text-sm border-separate" style={{ borderSpacing: '0 4px' }}>
              <thead>
                <tr>
                  <th className="text-left pr-2 text-[0.65rem] font-black uppercase tracking-wider text-gray-400">
                    {block.axis?.trim() || (type === 'scatter' ? 'Dot' : 'Row')}
                  </th>
                  {series.map((s, i) => (
                    <th key={i} className="px-1">
                      <span className="flex items-center gap-1">
                        {/* On a scatter the two columns are the axes, not two
                            series, so they do not get series colours. */}
                        {type !== 'scatter' && (
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: seriesColor(i, count) }}
                          />
                        )}
                        <input
                          value={s.name}
                          onChange={(e) =>
                            onChange({
                              series: series.map((x, j) => (j === i ? { name: e.target.value } : x)),
                            })
                          }
                          placeholder={
                            type === 'scatter' ? (i === 0 ? 'Across (X)' : 'Up (Y)') : `Column ${i + 1}`
                          }
                          className={`${cell} w-28 font-semibold`}
                        />
                        {count > 1 && (
                          <button
                            type="button"
                            onClick={() => dropSeries(i)}
                            aria-label={`Remove column ${i + 1}`}
                            className="text-xs text-gray-300 hover:text-[var(--gh-maroon)]"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr key={ri}>
                    <td className="pr-2">
                      <input
                        value={row.label}
                        onChange={(e) =>
                          setRows(block.rows.map((x, j) => (j === ri ? { ...x, label: e.target.value } : x)))
                        }
                        placeholder="Name"
                        className={`${cell} w-32`}
                      />
                    </td>
                    {series.map((_, si) => (
                      <td key={si} className="px-1">
                        <input
                          type="number"
                          value={row.values[si] ?? 0}
                          onChange={(e) =>
                            setRows(
                              block.rows.map((x, j) =>
                                j === ri
                                  ? {
                                      ...x,
                                      values: series.map((__, k) =>
                                        k === si ? Number(e.target.value) || 0 : (x.values[k] ?? 0)
                                      ),
                                    }
                                  : x
                              )
                            )
                          }
                          className={`${cell} w-20 text-right tabular-nums`}
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        type="button"
                        onClick={() => setRows(block.rows.filter((_, j) => j !== ri))}
                        aria-label="Remove row"
                        className="text-xs text-gray-300 hover:text-[var(--gh-maroon)] px-1"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setRows([...block.rows, { label: '', values: series.map(() => 0) }])}
              className="text-xs font-bold text-[var(--gh-green)]"
            >
              + row
            </button>
            <button
              type="button"
              onClick={addSeries}
              disabled={count >= MAX_SERIES}
              className="text-xs font-bold text-[var(--gh-green)] disabled:opacity-40"
              title={
                count >= MAX_SERIES
                  ? 'Eight is the limit — a ninth colour is one nobody can tell from the others'
                  : 'Another column of numbers'
              }
            >
              + column
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
