'use client'

import { useMemo, useState } from 'react'
import { ExportCsvButton } from '@/components/admin/ExportCsvButton'
import { EVAL_CATEGORIES, readRating, tierFor } from '@/lib/evaluations'

export interface EvaluatorLine {
  name: string
  overall: number | null
  ratings: Record<string, unknown>
  strengths: string | null
  areas: string | null
  notes: string | null
  playing_time: string | null
}
export interface BoardRow {
  playerId: string
  name: string
  number: string | null
  team: string
  teamLabel: string
  position: string | null
  count: number
  overallAvg: number
  catAvg: Record<string, number>
  evaluators: EvaluatorLine[]
}

// Heat map cells use the same tier colours as the sliders, deepening with the
// score, so a column scans as "who's strong here" at a glance.
function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

function cellAlpha(v: number): number {
  return 0.14 + (Math.min(100, Math.max(0, v)) / 100) * 0.62
}

function cellBg(v?: number): string {
  if (!v) return 'transparent'
  return rgba(tierFor(v).color, cellAlpha(v))
}

// Once a cell is dark enough, black text stops being readable on it.
function cellInk(v?: number): string | undefined {
  if (!v) return undefined
  return cellAlpha(v) > 0.5 ? '#fff' : undefined
}

export function BoardTable({ rows }: { rows: BoardRow[] }) {
  const [sort, setSort] = useState<'overall' | 'name' | 'position'>('overall')
  const [team, setTeam] = useState('all')
  const [pos, setPos] = useState('all')
  const [open, setOpen] = useState<string | null>(null)

  const teams = useMemo(() => Array.from(new Map(rows.map((r) => [r.team, r.teamLabel])).entries()), [rows])
  const positions = useMemo(() => Array.from(new Set(rows.map((r) => r.position).filter(Boolean))) as string[], [rows])

  const view = useMemo(() => {
    const v = rows.filter((r) => (team === 'all' || r.team === team) && (pos === 'all' || r.position === pos))
    return [...v].sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name)
        : sort === 'position' ? (a.position ?? '').localeCompare(b.position ?? '') || b.overallAvg - a.overallAvg
          : b.overallAvg - a.overallAvg)
  }, [rows, team, pos, sort])

  const csv = view.map((r) => ({
    player: r.name, number: r.number ?? '', team: r.teamLabel, position: r.position ?? '',
    evals: r.count, overall: r.overallAvg,
    ...Object.fromEntries(EVAL_CATEGORIES.map((c) => [c.label, r.catAvg[c.key] ?? ''])),
  }))

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="field !py-1.5 max-w-[10rem]">
          <option value="overall">Sort: Overall</option>
          <option value="name">Sort: Name</option>
          <option value="position">Sort: Position</option>
        </select>
        <select value={team} onChange={(e) => setTeam(e.target.value)} className="field !py-1.5 max-w-[10rem]">
          <option value="all">All teams</option>
          {teams.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <select value={pos} onChange={(e) => setPos(e.target.value)} className="field !py-1.5 max-w-[9rem]">
          <option value="all">All positions</option>
          {positions.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <span className="text-xs text-gray-400">{view.length} players</span>
        <span className="ml-auto"><ExportCsvButton rows={csv} filename="falcons-evaluations.csv" /></span>
      </div>

      <div className="card table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Player</th><th>Pos</th><th className="text-center">Evals</th><th className="text-center">Overall</th>
              {EVAL_CATEGORIES.map((c) => <th key={c.key} className="text-center whitespace-nowrap" title={c.label}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <FragmentRow key={r.playerId} r={r} open={open === r.playerId} onToggle={() => setOpen(open === r.playerId ? null : r.playerId)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FragmentRow({ r, open, onToggle }: { r: BoardRow; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer" style={{ background: open ? 'var(--surface-2)' : undefined }}>
        <td className="font-semibold whitespace-nowrap">
          <span className="text-gray-400 mr-1">{open ? '▾' : '▸'}</span>
          {r.number ? `#${r.number} ` : ''}{r.name}
        </td>
        <td className="text-gray-500">{r.position ?? '—'}</td>
        <td className="text-center">{r.count}</td>
        <td className="text-center font-black tabular-nums"
          style={{ background: cellBg(r.overallAvg), color: cellInk(r.overallAvg) }}>
          {r.overallAvg || '—'}
        </td>
        {EVAL_CATEGORIES.map((c) => (
          <td key={c.key} className="text-center font-semibold tabular-nums"
            style={{ background: cellBg(r.catAvg[c.key]), color: cellInk(r.catAvg[c.key]) }}>
            {r.catAvg[c.key] ?? '—'}
          </td>
        ))}
      </tr>
      {open && (
        <tr>
          <td colSpan={4 + EVAL_CATEGORIES.length} style={{ background: 'var(--surface-2)' }}>
            <div className="p-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {r.evaluators.map((ev, i) => (
                <div key={i} className="card p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm">{ev.name}</span>
                    <span className="text-xs font-black" style={{ color: 'var(--gh-green)' }}>{ev.overall ?? '—'}/100</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                    {EVAL_CATEGORIES.map((c) => {
                      const rating = readRating(ev.ratings?.[c.key])
                      return (
                        <div key={c.key} className="flex justify-between gap-2" title={rating?.note ?? undefined}>
                          <span className="text-gray-500 truncate">{c.label}</span>
                          <span className="font-semibold tabular-nums shrink-0">
                            {rating ? rating.score : '—'}
                            {rating?.note && <span className="text-gray-400 ml-1">✎</span>}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  {ev.playing_time && <div className="text-xs mt-2"><span className="text-gray-400">Playing time:</span> <b>{ev.playing_time}</b></div>}
                  {ev.strengths && <div className="text-xs mt-1"><span className="text-gray-400">Strengths:</span> {ev.strengths}</div>}
                  {ev.areas && <div className="text-xs mt-1"><span className="text-gray-400">Improve:</span> {ev.areas}</div>}
                  {ev.notes && <div className="text-xs mt-1 text-gray-600">{ev.notes}</div>}
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
