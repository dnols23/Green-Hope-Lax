'use client'

import { useState } from 'react'
import { fmtPct } from '@/lib/stats'
import { MIN_FACED, MIN_FACEOFFS, MIN_SHOTS, type GoalieRow, type SkaterRow } from './analysis'

/**
 * A column of a leaderboard. `sort` gives the number it sorts by; `qualified`
 * marks a rate with too few attempts to lead on — it is shown faded and kept
 * below the players who qualify whichever way the column is sorted.
 */
interface Col<T> {
  key: string
  label: string
  title: string
  sort: (r: T) => number | string | null
  cell: (r: T) => React.ReactNode
  qualified?: (r: T) => boolean
  /** Name and number sort A→Z first; every count sorts biggest first. */
  ascFirst?: boolean
  strong?: boolean
}

const jersey = (n: string | null) => (n != null && n !== '' && Number.isFinite(Number(n)) ? Number(n) : null)

function PlayerCell({ number, name }: { number: string | null; name: string }) {
  return (
    <span className="flex items-baseline gap-2 min-w-0">
      <span className="w-6 shrink-0 text-right text-xs font-semibold text-gray-400 tabular-nums">{number ?? ''}</span>
      <span className="font-semibold truncate">{name}</span>
    </span>
  )
}

const rateCell = (pct: number | null, ok: boolean) => <span className={ok ? '' : 'text-gray-300'}>{fmtPct(pct)}</span>

const SKATER_COLS: Col<SkaterRow>[] = [
  { key: 'name', label: 'Player', title: 'Player', sort: (r) => r.name.toLowerCase(), cell: (r) => <PlayerCell number={r.number} name={r.name} />, ascFirst: true },
  { key: 'gp', label: 'GP', title: 'Games played (with a stat)', sort: (r) => r.gp, cell: (r) => r.gp },
  { key: 'g', label: 'G', title: 'Goals', sort: (r) => r.g, cell: (r) => r.g },
  { key: 'a', label: 'A', title: 'Assists', sort: (r) => r.a, cell: (r) => r.a },
  { key: 'pts', label: 'Pts', title: 'Points (goals + assists)', sort: (r) => r.pts, cell: (r) => r.pts, strong: true },
  { key: 'sh', label: 'Sh', title: 'Shots', sort: (r) => r.sh, cell: (r) => r.sh },
  {
    key: 'shPct',
    label: 'Sh%',
    title: `Shooting % (needs ${MIN_SHOTS} shots to lead)`,
    sort: (r) => r.shPct,
    cell: (r) => rateCell(r.shPct, r.shQualified),
    qualified: (r) => r.shQualified,
  },
  { key: 'sog', label: 'SOG', title: 'Shots on goal', sort: (r) => r.sog, cell: (r) => r.sog },
  { key: 'gb', label: 'GB', title: 'Ground balls', sort: (r) => r.gb, cell: (r) => r.gb },
  { key: 'ct', label: 'CT', title: 'Caused turnovers', sort: (r) => r.ct, cell: (r) => r.ct },
  { key: 'to', label: 'TO', title: 'Turnovers', sort: (r) => r.to, cell: (r) => r.to },
  {
    key: 'fo',
    label: 'FO',
    title: 'Faceoffs won–lost',
    sort: (r) => r.foW + r.foL,
    cell: (r) => (r.foW + r.foL ? `${r.foW}–${r.foL}` : <span className="text-gray-300">—</span>),
  },
  {
    key: 'foPct',
    label: 'FO%',
    title: `Faceoff % (needs ${MIN_FACEOFFS} faceoffs to lead)`,
    sort: (r) => r.foPct,
    cell: (r) => rateCell(r.foPct, r.foQualified),
    qualified: (r) => r.foQualified,
  },
  {
    key: 'pen',
    label: 'Pen',
    title: 'Penalties (minutes on hover)',
    sort: (r) => r.pen,
    cell: (r) => <span title={r.pen ? `${r.pim} min` : undefined}>{r.pen}</span>,
  },
]

const GOALIE_COLS: Col<GoalieRow>[] = [
  { key: 'name', label: 'Goalie', title: 'Goalie', sort: (r) => r.name.toLowerCase(), cell: (r) => <PlayerCell number={r.number} name={r.name} />, ascFirst: true },
  { key: 'gp', label: 'GP', title: 'Games played (with a stat)', sort: (r) => r.gp, cell: (r) => r.gp },
  { key: 'saves', label: 'Sv', title: 'Saves', sort: (r) => r.saves, cell: (r) => r.saves },
  { key: 'ga', label: 'GA', title: 'Goals against', sort: (r) => r.ga, cell: (r) => r.ga },
  {
    key: 'svPct',
    label: 'Sv%',
    title: `Save % (needs ${MIN_FACED} shots on goal to lead)`,
    sort: (r) => r.svPct,
    cell: (r) => rateCell(r.svPct, r.qualified),
    qualified: (r) => r.qualified,
    strong: true,
  },
]

function SortTable<T extends { id: string; name: string; number: string | null }>({
  rows,
  cols,
  initial,
  label,
  narrow = false,
}: {
  rows: T[]
  cols: Col<T>[]
  initial: string
  label: string
  /** A short table: as wide as its columns rather than the card. */
  narrow?: boolean
}) {
  const [sort, setSort] = useState<{ key: string; asc: boolean }>({ key: initial, asc: !!cols.find((c) => c.key === initial)?.ascFirst })
  const col = cols.find((c) => c.key === sort.key) ?? cols[0]

  const sorted = [...rows].sort((a, b) => {
    // Too few attempts to lead: below everyone who qualifies, either direction.
    if (col.qualified) {
      const qa = col.qualified(a)
      const qb = col.qualified(b)
      if (qa !== qb) return qa ? -1 : 1
    }
    const va = col.sort(a)
    const vb = col.sort(b)
    // Nothing to show sorts last, either direction.
    if (va == null || vb == null) {
      if (va == null && vb != null) return 1
      if (vb == null && va != null) return -1
    } else if (va !== vb) {
      const d = typeof va === 'string' && typeof vb === 'string' ? va.localeCompare(vb) : Number(va) - Number(vb)
      return sort.asc ? d : -d
    }
    // Level: jersey order, then name.
    const ja = jersey(a.number)
    const jb = jersey(b.number)
    if (ja != null && jb != null && ja !== jb) return ja - jb
    return a.name.localeCompare(b.name)
  })

  const pick = (c: Col<T>) =>
    setSort((s) => (s.key === c.key ? { key: c.key, asc: !s.asc } : { key: c.key, asc: !!c.ascFirst }))

  return (
    <div className="table-scroll -mx-4 sm:mx-0">
      <table className={`data-table min-w-max ${narrow ? 'sm:!w-auto' : ''}`} aria-label={label}>
        <thead>
          <tr>
            {cols.map((c, i) => {
              const on = c.key === col.key
              return (
                <th
                  key={c.key}
                  aria-sort={on ? (sort.asc ? 'ascending' : 'descending') : undefined}
                  className={`!px-0 ${i === 0 ? 'sticky left-0 z-[1] bg-white !pl-4 sm:!pl-2' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => pick(c)}
                    title={c.title}
                    className={`w-full px-2.5 py-1 inline-flex items-center gap-1 uppercase tracking-[0.1em] ${i === 0 ? 'justify-start' : 'justify-end'} ${
                      on ? 'text-gray-900' : 'hover:text-gray-700'
                    }`}
                  >
                    {c.label}
                    <span className={`text-[0.6rem] ${on ? '' : 'invisible'}`} aria-hidden>
                      {sort.asc ? '▲' : '▼'}
                    </span>
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {sorted.map((r) => (
            <tr key={r.id}>
              {cols.map((c, i) => (
                <td
                  key={c.key}
                  className={`!py-2 ${
                    i === 0 ? 'sticky left-0 z-[1] bg-white !pl-4 sm:!pl-2 max-w-[11rem]' : 'text-right !px-3'
                  } ${c.strong ? 'font-bold' : ''} ${c.key === col.key && i > 0 ? 'bg-gray-50' : ''}`}
                >
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function PlayerTables({ skaters, goalies }: { skaters: SkaterRow[]; goalies: GoalieRow[] }) {
  return (
    <div className="space-y-6">
      {skaters.length > 0 ? (
        <SortTable rows={skaters} cols={SKATER_COLS} initial="pts" label="Players" />
      ) : (
        <p className="text-sm text-gray-500">No player stats yet. Tag who shot, scored and picked up the ball in the tracker and they show up here.</p>
      )}
      {goalies.length > 0 && (
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-500 mb-1">Goalies</h3>
          <SortTable rows={goalies} cols={GOALIE_COLS} initial="svPct" label="Goalies" narrow />
        </div>
      )}
    </div>
  )
}
