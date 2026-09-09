'use client'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { tierFor } from '@/lib/evaluations'

export interface EvalRow {
  id: string
  name: string
  number: string | null
  position: string | null
  classYear: string | null
  teamLabel: string
  /** Compiled across every coach who has rated them; 0 when nobody has. */
  average: number
  /** How many coaches have rated them. */
  raters: number
  /** Has the coach looking at this page rated them? */
  ratedByMe: boolean
}

type SortKey = 'best' | 'worst' | 'name' | 'number' | 'grad' | 'unrated'

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'best', label: 'Rating: best first' },
  { key: 'worst', label: 'Rating: worst first' },
  { key: 'unrated', label: 'Not yet rated first' },
  { key: 'name', label: 'Name A–Z' },
  { key: 'number', label: 'Jersey number' },
  { key: 'grad', label: 'Grad year' },
]

const ANY = 'any'

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="text-xs font-bold text-gray-500">
      <span className="block mb-1">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field !py-1.5 text-sm">
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}

/**
 * The player list every evaluation route shares.
 *
 * Same controls whichever list you picked — a roster or everyone on file — so
 * "worst rated attackmen in the class of 2028" is the same three clicks either
 * way. Filtering happens here rather than on the server: these are tens of
 * players, not thousands, and a coach flicking between views shouldn't wait for
 * a round trip.
 */
export function EvaluateList({ players }: { players: EvalRow[] }) {
  const [sort, setSort] = useState<SortKey>('best')
  const [team, setTeam] = useState(ANY)
  const [grad, setGrad] = useState(ANY)
  const [position, setPosition] = useState(ANY)
  const [rated, setRated] = useState(ANY)

  const options = useMemo(() => {
    const uniq = (vals: (string | null)[]) =>
      [...new Set(vals.filter((v): v is string => Boolean(v && v.trim())))].sort()
    return {
      teams: uniq(players.map((p) => p.teamLabel)),
      grads: uniq(players.map((p) => p.classYear)),
      positions: uniq(players.map((p) => p.position)),
    }
  }, [players])

  const shown = useMemo(() => {
    const list = players.filter(
      (p) =>
        (team === ANY || p.teamLabel === team) &&
        (grad === ANY || p.classYear === grad) &&
        (position === ANY || p.position === position) &&
        (rated === ANY ||
          (rated === 'mine' && p.ratedByMe) ||
          (rated === 'not-mine' && !p.ratedByMe) ||
          (rated === 'any-coach' && p.raters > 0) ||
          (rated === 'none' && p.raters === 0))
    )
    const byName = (a: EvalRow, b: EvalRow) => a.name.localeCompare(b.name)
    return [...list].sort((a, b) => {
      switch (sort) {
        case 'best':
          return b.average - a.average || byName(a, b)
        case 'worst':
          // Unrated players have no score to be worst at, so they go last.
          if (a.average === 0 !== (b.average === 0)) return a.average === 0 ? 1 : -1
          return a.average - b.average || byName(a, b)
        case 'unrated':
          return Number(a.raters > 0) - Number(b.raters > 0) || byName(a, b)
        case 'number':
          return (Number(a.number) || 999) - (Number(b.number) || 999) || byName(a, b)
        case 'grad':
          return (a.classYear ?? '9999').localeCompare(b.classYear ?? '9999') || byName(a, b)
        default:
          return byName(a, b)
      }
    })
  }, [players, sort, team, grad, position, rated])

  const anyOption = (label: string) => ({ value: ANY, label })

  return (
    <div>
      <div className="card p-4 mb-4 flex flex-wrap gap-3">
        <Select
          label="Order"
          value={sort}
          onChange={(v) => setSort(v as SortKey)}
          options={SORTS.map((s) => ({ value: s.key, label: s.label }))}
        />
        {options.teams.length > 1 && (
          <Select label="Team" value={team} onChange={setTeam}
            options={[anyOption('All teams'), ...options.teams.map((t) => ({ value: t, label: t }))]} />
        )}
        {options.grads.length > 1 && (
          <Select label="Grad year" value={grad} onChange={setGrad}
            options={[anyOption('All years'), ...options.grads.map((g) => ({ value: g, label: g }))]} />
        )}
        {options.positions.length > 1 && (
          <Select label="Position" value={position} onChange={setPosition}
            options={[anyOption('All positions'), ...options.positions.map((p) => ({ value: p, label: p }))]} />
        )}
        <Select
          label="Evaluations"
          value={rated}
          onChange={setRated}
          options={[
            anyOption('Everyone'),
            { value: 'not-mine', label: 'I haven’t rated' },
            { value: 'mine', label: 'I have rated' },
            { value: 'none', label: 'Nobody has rated' },
            { value: 'any-coach', label: 'Rated by any coach' },
          ]}
        />
      </div>

      <p className="text-xs text-gray-500 mb-3">
        Showing {shown.length} of {players.length}
      </p>

      {shown.length === 0 ? (
        <div className="card p-6 text-sm text-gray-500">Nobody matches those filters.</div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => {
            const tier = p.average > 0 ? tierFor(p.average) : null
            return (
              <Link
                key={p.id}
                href={`/admin/hub/evaluate/${p.id}`}
                className="card p-3 flex items-center gap-3 hover:shadow-md transition-shadow"
              >
                <span
                  className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-black text-white text-sm"
                  style={{ background: 'var(--gh-green)' }}
                >
                  {p.number ?? '–'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-bold block truncate">{p.name}</span>
                  <span className="text-xs text-gray-500">
                    {[p.position, p.classYear, p.teamLabel].filter(Boolean).join(' · ') || '—'}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  {tier ? (
                    <span className="text-sm font-black" style={{ color: tier.color }}>
                      {p.average}
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-gray-400">Rate →</span>
                  )}
                  <span className="block text-[0.65rem] text-gray-400">
                    {p.ratedByMe ? '✓ yours in' : p.raters > 0 ? `${p.raters} coach${p.raters > 1 ? 'es' : ''}` : 'unrated'}
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
