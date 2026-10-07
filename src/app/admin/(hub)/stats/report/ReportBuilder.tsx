'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { GameFilter } from '@/lib/stats'
import type { Team } from '@/lib/teams'
import {
  NOTES_MAX,
  REPORT_SECTIONS,
  reportBuilderHref,
  reportSheetHref,
  type ReportScope,
  type SectionKey,
} from '@/app/admin/stats-report/sections'

/** One chip: a stretch of games and what it adds up to. */
export interface FilterOption {
  key: GameFilter
  label: string
  count: number
  /** "12 games · 9–3". */
  line: string
  /** "Mar 3 – Apr 28, 2026". */
  dates: string | null
}

/** One tracked game in the picker, newest first. */
export interface GameOption {
  id: string
  /** "Mar 13 · vs Panther Creek · W 12–8", for the dropdown. */
  label: string
  /** "vs Panther Creek", for the summary. */
  title: string
  /** "Mar 13 · W 12–8". */
  detail: string
}

/** A season with tracked games in it, and what each choice there adds up to. */
export interface SeasonOption {
  year: number
  filters: FilterOption[]
  games: GameOption[]
  /** Finished games that season nobody tracked. */
  untracked: number
}

/**
 * The choices for a printed report. Everything starts filled in, so the
 * button can be pressed straight away; each change shows at once in the
 * summary beside it.
 */
export function ReportBuilder({
  team,
  teamName,
  seasons,
  initialSeason,
  initialScope,
  initialSections,
  initialNotes,
}: {
  team: Team
  teamName: string
  /** Newest first; never empty. */
  seasons: SeasonOption[]
  initialSeason: number
  initialScope: ReportScope
  initialSections: SectionKey[]
  initialNotes: string
}) {
  const router = useRouter()
  const [year, setYear] = useState(initialSeason)
  const [filter, setFilter] = useState<GameFilter>(initialScope.mode === 'season' ? initialScope.filter : 'all')
  const [gameId, setGameId] = useState(initialScope.mode === 'game' ? initialScope.gameId : '')
  const [mode, setMode] = useState<ReportScope['mode']>(initialScope.mode)
  const [sections, setSections] = useState<SectionKey[]>(initialSections)
  const [notes, setNotes] = useState(initialNotes)

  const current = seasons.find((s) => s.year === year) ?? seasons[0]
  // The game picked, or this season's latest when the one picked is another season's.
  const game = current.games.find((g) => g.id === gameId) ?? current.games[0]
  const scope: ReportScope = mode === 'game' ? { mode, gameId: game?.id ?? '' } : { mode, season: current.year, filter }
  const parts = REPORT_SECTIONS[mode]
  const picked = parts.filter((p) => sections.includes(p.key))
  const option = current.filters.find((f) => f.key === filter)
  const empty = mode === 'season' ? !option?.count : !game
  const ready = !empty && picked.length > 0

  /* The games ride in the address too, so the Varsity/JV switch and the
     other tabs keep the filter, and a reload lands on the same choice. */
  const choose = (next: { year?: number; mode?: ReportScope['mode']; filter?: GameFilter; gameId?: string }) => {
    const y = next.year ?? current.year
    const m = next.mode ?? mode
    const f = next.filter ?? filter
    const season = seasons.find((s) => s.year === y) ?? current
    const id = next.gameId ?? (season.games.some((g) => g.id === gameId) ? gameId : (season.games[0]?.id ?? ''))
    setYear(y)
    setMode(m)
    setFilter(f)
    setGameId(id)
    router.replace(reportBuilderHref(team, m === 'game' ? { mode: m, gameId: id } : { mode: m, season: y, filter: f }, sections, notes), {
      scroll: false,
    })
  }

  const toggle = (key: SectionKey) =>
    setSections((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]))

  const chip = (on: boolean) =>
    `min-h-10 px-3.5 rounded-full border text-sm font-bold inline-flex items-center gap-1.5 transition-colors ${
      on ? 'bg-[var(--gh-green)] text-white border-[var(--gh-green)]' : 'border-gray-300 text-gray-700 hover:border-gray-500'
    }`

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_19rem] gap-4 items-start pb-24 lg:pb-0">
      <div className="space-y-4 min-w-0">
        <section className="card p-4 sm:p-5">
          <h2 className="font-black mb-3">Which games</h2>
          {seasons.length > 1 && (
            <div className="inline-flex flex-wrap rounded-full border p-0.5 mb-3" style={{ borderColor: 'var(--border)' }} role="group" aria-label="Season">
              {seasons.map((s) => (
                <button
                  key={s.year}
                  type="button"
                  aria-pressed={s.year === current.year}
                  onClick={() => choose({ year: s.year })}
                  className={`px-3 min-h-8 rounded-full text-sm font-bold tabular-nums ${s.year === current.year ? 'bg-gray-900 text-white' : 'text-gray-500'}`}
                >
                  {s.year}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2" role="group" aria-label="Which games">
            {current.filters.map((f) => {
              const on = mode === 'season' && filter === f.key
              return (
                <button key={f.key} type="button" aria-pressed={on} onClick={() => choose({ mode: 'season', filter: f.key })} className={chip(on)}>
                  {f.label}
                  <span className={`text-xs font-semibold tabular-nums ${on ? 'text-white/80' : 'text-gray-400'}`}>{f.count}</span>
                </button>
              )
            })}
            <button type="button" aria-pressed={mode === 'game'} onClick={() => choose({ mode: 'game' })} className={chip(mode === 'game')}>
              One game
            </button>
          </div>
          {mode === 'game' && (
            <label className="block mt-4">
              <span className="field-label">Game</span>
              <select className="field" value={game?.id ?? ''} onChange={(e) => choose({ gameId: e.target.value })}>
                {current.games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="text-xs text-gray-500 mt-3">
            Only tracked games count.
            {current.untracked > 0 &&
              ` ${current.untracked} finished ${current.untracked === 1 ? 'game wasn’t' : 'games weren’t'} tracked and ${current.untracked === 1 ? 'isn’t' : 'aren’t'} included.`}
          </p>
        </section>

        <section className="card p-4 sm:p-5">
          <h2 className="font-black mb-3">What’s on it</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {parts.map((p) => {
              const on = sections.includes(p.key)
              return (
                <label
                  key={p.key}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    on ? 'border-[var(--gh-green)]' : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <input type="checkbox" checked={on} onChange={() => toggle(p.key)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--gh-green)]" />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{p.label}</span>
                    <span className="block text-xs text-gray-500 leading-snug mt-0.5">{p.hint}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </section>

        <section className="card p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <h2 className="font-black">
              Notes for the team <span className="font-semibold text-gray-400 text-sm">(optional)</span>
            </h2>
            <span className={`text-xs tabular-nums ${notes.length > NOTES_MAX - 60 ? 'text-gray-700 font-bold' : 'text-gray-400'}`}>
              {notes.length}/{NOTES_MAX}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-2">Printed under Coach’s notes. Leave it empty for lines to write on.</p>
          <textarea
            className="field"
            rows={3}
            maxLength={NOTES_MAX}
            value={notes}
            placeholder="e.g. Clears won us the last two. Ground balls are on us this week."
            onChange={(e) => {
              setNotes(e.target.value)
              // Notes nobody sees on the sheet would be a nasty surprise.
              if (e.target.value.trim() && !sections.includes('notes')) setSections((s) => [...s, 'notes'])
            }}
          />
        </section>
      </div>

      <aside className="card p-4 sm:p-5 lg:sticky lg:top-4" aria-live="polite">
        <div className="section-label mb-2">On the report</div>
        <div className="text-xs font-bold uppercase tracking-wide text-gray-500">
          {teamName} · {current.year}
        </div>
        {mode === 'season' ? (
          <>
            <div className="text-lg font-black leading-tight mt-0.5">{option?.label ?? 'All games'}</div>
            {option?.count ? (
              <>
                <div className="text-sm font-bold tabular-nums mt-1">{option.line}</div>
                {option.dates && <div className="text-xs text-gray-500 mt-0.5">{option.dates}</div>}
              </>
            ) : (
              <p className="text-sm text-gray-600 mt-1">No tracked games here yet. Pick another set of games.</p>
            )}
          </>
        ) : (
          <>
            <div className="text-lg font-black leading-tight mt-0.5">{game?.title ?? 'Pick a game'}</div>
            {game && <div className="text-sm font-bold tabular-nums mt-1">{game.detail}</div>}
          </>
        )}

        <ul className="mt-4 space-y-1 text-sm border-t pt-3" style={{ borderColor: 'var(--border)' }}>
          {picked.map((p) => (
            <li key={p.key} className="flex gap-2">
              <span aria-hidden className="text-[var(--gh-green)] font-black">✓</span>
              {p.label}
            </li>
          ))}
          {!picked.length && <li className="text-gray-500">Tick at least one part to print.</li>}
        </ul>

        <div className="hidden lg:block">
          <OpenButton href={ready ? reportSheetHref(team, scope, sections, notes) : null} />
          <p className="text-xs text-gray-500 mt-2 text-center">Opens the sheet. Press Print there.</p>
        </div>
      </aside>

      {/* On a phone the summary sits at the bottom of a long page; the button
          stays in reach, with what it will print beside it. */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 text-sm leading-tight">
            <div className="font-black truncate">{mode === 'season' ? (option?.label ?? 'All games') : (game?.title ?? 'Pick a game')}</div>
            <div className="text-xs text-gray-500 truncate tabular-nums">
              {mode === 'season' ? (option?.count ? option.line : 'No tracked games here yet') : game?.detail}
            </div>
          </div>
          <div className="shrink-0">
            <OpenButton href={ready ? reportSheetHref(team, scope, sections, notes) : null} short />
          </div>
        </div>
      </div>
    </div>
  )
}

/** The one button that matters. Greyed out, with nothing to print. */
function OpenButton({ href, short = false }: { href: string | null; short?: boolean }) {
  const cls = short ? 'btn btn-primary !py-3 !px-5' : 'btn btn-primary w-full mt-5 !py-3.5 !text-base'
  const label = short ? 'Open report' : 'Open printable report'
  if (!href)
    return (
      <button type="button" disabled className={`${cls} opacity-40 cursor-not-allowed`}>
        {label}
      </button>
    )
  return (
    <Link href={href} prefetch={false} className={cls}>
      {label}
    </Link>
  )
}
