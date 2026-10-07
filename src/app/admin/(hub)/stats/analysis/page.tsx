import Link from 'next/link'
import { requireTeam } from '@/lib/permissions'
import { withTeam, type Team } from '@/lib/teams'
import { loadSeason, playerMap } from '@/lib/statsData'
import { aggregate, filterGames, fmtPct, gamesInSeason, insights, isGameFilter, pickSeason, statSeasons, type GameFilter, type Insight, type Rate } from '@/lib/stats'
import { StatsTabs } from '../StatsTabs'
import {
  MIN_ATTEMPTS,
  MIN_FACED,
  MIN_FACEOFFS,
  MIN_SHOTS,
  SHOT_ORDER,
  conditionalRecords,
  isMetricKey,
  metricCards,
  pickTakeaways,
  playerRows,
  quarterRows,
  recordText,
  shotProfile,
  situationGoals,
  winsVsLosses,
  type ConditionRow,
  type ShotSide,
  type SituationGoals,
} from './analysis'
import { Key, QuarterChart, ShotBar, VIZ_CSS, WinMeter } from './charts'
import { FilterChips } from './FilterChips'
import { MetricExplorer } from './MetricExplorer'
import { PlayerTables } from './PlayerTables'

export const metadata = { title: 'Stats · Analysis' }
export const dynamic = 'force-dynamic'

/**
 * Analysis: what the tracked games say, from the numbers a coach asks for
 * first down to the player leaderboard.
 *
 * Everything is worked out by stats.ts (the same functions behind the box
 * score and the printed report), so a number here matches a number anywhere
 * else. The filter rides in the address, so "conference games only" is a
 * link you can send; the selected trend number does too.
 */
export default async function StatsAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const { team } = await requireTeam('stats', sp.team)
  const filter: GameFilter = isGameFilter(sp.filter) ? sp.filter : 'all'
  const metric = isMetricKey(sp.metric) ? sp.metric : 'shooting'

  const loaded = await loadSeason(team)
  // One season at a time (the newest with tracked games unless another is asked for).
  const seasons = statSeasons(loaded.games)
  const year = pickSeason(loaded.games, sp.season)
  const season = { ...loaded, games: gamesInSeason(loaded.games, year) }
  const games = filterGames(season.games, filter)
  const anyTracked = season.games.some((g) => g.tracked)
  // Carried on every link here, so changing a filter or the team stays in this season.
  const seasonQuery = year != null && year !== seasons[0] ? `season=${year}` : ''
  const query = [filter !== 'all' ? `filter=${filter}` : '', seasonQuery].filter(Boolean).join('&')

  return (
    <div className="stats-viz max-w-5xl space-y-6">
      <style>{VIZ_CSS}</style>
      <div>
        <StatsTabs team={team} active="analysis" query={query} />
        <h1 className="text-xl font-black mb-1">Analysis</h1>
        <p className="text-gray-500 text-sm">What the tracked games say: the big numbers, what wins, and who&rsquo;s doing it.</p>
      </div>

      {seasons.length > 1 && (
        <nav className="flex flex-wrap gap-1.5" aria-label="Season">
          {seasons.map((y) => (
            <Link
              key={y}
              href={withTeam(
                `/admin/stats/analysis?${[filter !== 'all' ? `filter=${filter}` : '', y !== seasons[0] ? `season=${y}` : ''].filter(Boolean).join('&')}`.replace(/\?$/, ''),
                team,
              )}
              aria-current={y === year ? 'page' : undefined}
              className={`px-3 min-h-8 inline-flex items-center rounded-full text-xs font-black ${
                y === year ? 'bg-gray-900 text-white' : 'border text-gray-500 hover:text-gray-900'
              }`}
              style={y === year ? undefined : { borderColor: 'var(--border)' }}
            >
              {y} season
            </Link>
          ))}
        </nav>
      )}

      <FilterRow team={team} filter={filter} season={year} latest={seasons[0] ?? null} count={games.length} record={recordText(games)} />

      {games.length === 0 ? (
        <Empty team={team} filtered={filter !== 'all' && anyTracked} />
      ) : (
        <Analysis team={team} filter={filter} metric={metric} season={season} games={games} />
      )}
    </div>
  )
}

/** The stretch of games: one row of chips, the count and record beside them, and the printout. */
function FilterRow({
  team,
  filter,
  season,
  latest,
  count,
  record,
}: {
  team: Team
  filter: GameFilter
  season: number | null
  latest: number | null
  count: number
  record: string
}) {
  const printQuery = [filter !== 'all' ? `filter=${filter}` : '', season != null && season !== latest ? `season=${season}` : '']
    .filter(Boolean)
    .join('&')
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <FilterChips team={team} filter={filter} />
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm text-gray-500 tabular-nums">
          <span className="font-bold text-gray-900">{count}</span> {count === 1 ? 'game' : 'games'}
          {count > 0 && (
            <>
              {' '}
              · <span className="font-bold text-gray-900">{record}</span>
            </>
          )}
        </span>
        <Link
          href={withTeam(`/admin/stats/report${printQuery ? `?${printQuery}` : ''}`, team)}
          className="btn btn-ghost !py-1.5 !px-3.5 !text-xs"
        >
          🖨 Print report
        </Link>
      </div>
    </div>
  )
}

function Empty({ team, filtered }: { team: Team; filtered: boolean }) {
  return (
    <div className="card p-8 text-center">
      <div className="text-3xl mb-2" aria-hidden>
        📈
      </div>
      {filtered ? (
        <>
          <p className="font-bold text-gray-700">No tracked games fit this filter.</p>
          <p className="text-sm text-gray-500 mt-1">Pick another, or look at every game.</p>
          <Link href={withTeam('/admin/stats/analysis', team)} className="btn btn-ghost mt-4">
            All games
          </Link>
        </>
      ) : (
        <>
          <p className="font-bold text-gray-700">No tracked games yet.</p>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
            Track a game from the Games tab — shots, faceoffs, clears, ground balls — and the analysis fills in here.
          </p>
          <Link href={withTeam('/admin/stats', team)} className="btn btn-primary mt-4">
            Go to Games
          </Link>
        </>
      )}
    </div>
  )
}

type Season = Awaited<ReturnType<typeof loadSeason>>

function Analysis({
  team,
  filter,
  metric,
  season,
  games,
}: {
  team: Team
  filter: GameFilter
  metric: Parameters<typeof MetricExplorer>[0]['initial']
  season: Season
  games: Season['games']
}) {
  const { events } = season
  const all = aggregate(games, events)
  const cards = metricCards(games, events)
  const takeaways = pickTakeaways(insights(games, events))
  const conditions = conditionalRecords(games, events)
  const wl = winsVsLosses(games, events)
  const quarters = quarterRows(all.periods)
  const shots = { us: shotProfile(all.lines.us), them: shotProfile(all.lines.them) }
  const shooting = { us: all.lines.us.shooting, them: all.lines.them.shooting }
  const situations = situationGoals(events, new Set(games.map((g) => g.game.id)))
  const people = playerRows(all.players, playerMap(season.players))
  const bothOutcomes = games.some((g) => g.outcome === 'W') && games.some((g) => g.outcome === 'L')

  return (
    <>
      <MetricExplorer key={`${team}:${filter}`} cards={cards} initial={metric}>
        <Takeaways shown={takeaways.shown} more={takeaways.more} />
      </MetricExplorer>

      <section className="card p-4 sm:p-5 min-w-0">
        <SectionHead title="What wins games" note="Our record split by how each game went. Finished games only." />
        {conditions.length > 0 ? (
          <ConditionList rows={conditions} />
        ) : (
          <p className="text-sm text-gray-500">
            {filter === 'wins' || filter === 'losses'
              ? 'This compares wins with losses, so it needs both. Switch to All games to see it.'
              : !bothOutcomes
                ? 'Once there are finished games won and lost, this shows what separates them.'
                : 'Not enough tracked detail to split the record yet. Faceoffs, clears and ground balls fill this in.'}
          </p>
        )}

        {wl && (
          <div className="mt-6">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-500 mb-1">In wins vs in losses</h3>
            {/* A grid rather than a table: on a phone each number's name gets its own line
                and the three figures sit in columns under it, so nothing scrolls sideways. */}
            <div role="table" aria-label="Wins against losses" className="text-sm tabular-nums">
              <div role="row" className={`${WL_GRID} border-b-2 pb-1.5 text-[0.65rem] font-extrabold uppercase tracking-[0.1em] text-gray-500`} style={{ borderColor: 'var(--border)' }}>
                <span role="columnheader" className="hidden sm:block">
                  Number
                </span>
                <span role="columnheader" className="text-right">
                  Wins ({wl.wins})
                </span>
                <span role="columnheader" className="text-right">
                  Losses ({wl.losses})
                </span>
                <span role="columnheader" className="text-right">
                  Difference
                </span>
              </div>
              {wl.rows.map((r) => (
                <div key={r.key} role="row" className={`${WL_GRID} border-b py-2 last:border-b-0`} style={{ borderColor: 'var(--border)' }}>
                  <span role="rowheader" className="col-span-3 sm:col-span-1 font-semibold">
                    {r.label}
                  </span>
                  <span role="cell" className="text-right">
                    {r.wins}
                  </span>
                  <span role="cell" className="text-right">
                    {r.losses}
                  </span>
                  <span role="cell" className={`text-right font-bold ${r.diff != null && r.diff < 0 ? 'text-gray-500' : 'text-gray-900'}`}>
                    {r.diffText}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">Rates differ in percentage points; margins in goals, ground balls or turnovers per game.</p>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-4 sm:p-5 min-w-0">
          <SectionHead title="By quarter" note="Goals for and against in each quarter, and the difference." />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
            <Key color="var(--viz-us)">Green Hope</Key>
            <Key color="var(--viz-them)">Opponents</Key>
          </div>
          <QuarterChart rows={quarters} />
        </section>

        <section className="card p-4 sm:p-5 min-w-0">
          <SectionHead title="Shot profile" note="Where the shots went, ours and theirs." />
          <ShotProfile us={shots.us} them={shots.them} shooting={shooting} />
          <SituationTable us={situations.us} them={situations.them} />
        </section>
      </div>

      <section className="card p-4 sm:p-5 min-w-0">
        <SectionHead title="Players" note="Tap a column to sort." />
        <PlayerTables skaters={people.skaters} goalies={people.goalies} />
        <p className="text-xs text-gray-400 mt-3">
          GP counts games with at least one stat. A shooting % under {MIN_SHOTS} shots, a faceoff % under {MIN_FACEOFFS} faceoffs or a save % under {MIN_FACED} shots on goal is faded and sorts last.
        </p>
      </section>
    </>
  )
}

/** Wins vs losses: three number columns, plus the name column from a small tablet up. */
const WL_GRID = 'grid grid-cols-3 sm:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] gap-x-3 gap-y-0.5 items-baseline'

function SectionHead({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-bold text-gray-700">{title}</h2>
      {note && <p className="text-xs text-gray-500 mt-0.5">{note}</p>}
    </div>
  )
}

const TONE = {
  good: { color: 'var(--viz-good)', mark: '↑', word: 'Good' },
  bad: { color: 'var(--viz-bad)', mark: '↓', word: 'Needs work' },
  neutral: { color: 'var(--viz-ref)', mark: '•', word: 'Note' },
} as const

/** The sentences worth saying in a team meeting, each marked good, bad or just worth knowing. */
function Takeaways({ shown, more }: { shown: Insight[]; more: Insight[] }) {
  if (!shown.length) return null
  const line = (ins: Insight, i: number) => {
    const t = TONE[ins.tone]
    return (
      <li key={i} className="flex items-start gap-2.5 py-2 text-sm">
        <span
          className="mt-0.5 h-5 w-5 shrink-0 rounded-full inline-flex items-center justify-center text-[0.7rem] font-black text-white"
          style={{ background: t.color }}
          aria-hidden
        >
          {t.mark}
        </span>
        <span className="sr-only">{t.word}: </span>
        <span className="text-gray-800 leading-snug">{ins.text}</span>
      </li>
    )
  }
  return (
    <section className="card p-4 sm:p-5 min-w-0">
      <SectionHead title="Takeaways" />
      <ul className="divide-y divide-gray-100 -my-2">{shown.map(line)}</ul>
      {more.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer list-none text-xs font-semibold text-gray-500 hover:text-gray-900 inline-flex items-center gap-1">
            <span className="caret">▸</span> {more.length} more
          </summary>
          <ul className="divide-y divide-gray-100 mt-1">{more.map(line)}</ul>
        </details>
      )}
      <p className="text-xs text-gray-400 mt-3">A rate is only talked about once it has {MIN_ATTEMPTS} attempts behind it.</p>
    </section>
  )
}

/**
 * Each split as one line: the record when it happened against the record
 * when it didn't, with a thin win-% bar under each so the gap reads at a glance.
 */
function ConditionList({ rows }: { rows: ConditionRow[] }) {
  return (
    <ul className="divide-y divide-gray-100 -my-3">
      {rows.map((r) => (
        <li key={r.key} className="py-3 grid grid-cols-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-5 gap-y-2 items-center">
          <div className="col-span-2 sm:col-span-1 min-w-0">
            <div className="text-sm font-semibold text-gray-800">When we {r.label.charAt(0).toLowerCase() + r.label.slice(1)}</div>
            <div className="text-xs text-gray-400">{r.how}</div>
          </div>
          <Side label="Yes" split={r.yes} strong />
          <Side label="No" split={r.no} />
        </li>
      ))}
    </ul>
  )
}

function Side({ label, split, strong = false }: { label: string; split: ConditionRow['yes']; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-[0.7rem] font-bold uppercase tracking-wide text-gray-400">{label}</span>
        <span className="tabular-nums whitespace-nowrap">
          <span className={`text-sm font-black ${strong ? 'text-gray-900' : 'text-gray-600'}`}>{split.text}</span>
          <span className="text-xs text-gray-400 ml-1.5">{fmtPct(split.winPct)}</span>
        </span>
      </div>
      <WinMeter pct={split.winPct} label={`${label}: ${split.text}, ${fmtPct(split.winPct)} won`} />
    </div>
  )
}

/** Our shots and theirs, each one bar split by result; the table beneath is both the key and every number. */
function ShotProfile({ us, them, shooting }: { us: ShotSide; them: ShotSide; shooting: { us: Rate; them: Rate } }) {
  const rows = [
    { key: 'us', name: 'Green Hope', side: us, shooting: shooting.us },
    { key: 'them', name: 'Opponents', side: them, shooting: shooting.them },
  ]
  return (
    <div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.key} className="grid grid-cols-[5.25rem_minmax(0,1fr)] items-center gap-3">
            <span className="text-xs font-bold text-gray-700">{r.name}</span>
            <ShotBar side={r.side} />
          </div>
        ))}
      </div>
      <table className="data-table text-sm mt-4">
        <thead>
          <tr>
            <th className="!px-0" />
            {rows.map((r) => (
              <th key={r.key} className="!text-right !px-0 !pl-3">
                {r.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {SHOT_ORDER.map((res, i) => (
            <tr key={res}>
              <td className="!py-1.5 !px-0">
                <Key color={`var(--shot-${res})`}>{us.parts[i].label}</Key>
              </td>
              {rows.map((r) => (
                <td key={r.key} className="!py-1.5 !px-0 !pl-3 text-right">
                  {r.side.parts[i].count}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td className="!py-1.5 !px-0 font-semibold">Shots</td>
            {rows.map((r) => (
              <td key={r.key} className="!py-1.5 !px-0 !pl-3 text-right font-bold">
                {r.side.total}
              </td>
            ))}
          </tr>
          <tr>
            <td className="!py-1.5 !px-0 font-semibold">Shooting %</td>
            {rows.map((r) => (
              <td key={r.key} className="!py-1.5 !px-0 !pl-3 text-right font-bold">
                {fmtPct(r.shooting)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/** Goals by situation. Ours on the man-up is theirs on the man-down, and the other way round. */
function SituationTable({ us, them }: { us: SituationGoals; them: SituationGoals }) {
  const rows = [
    { key: 'us', name: 'Green Hope', s: us },
    { key: 'them', name: 'Opponents', s: them },
  ]
  return (
    <div className="mt-5">
      <h3 className="text-xs font-black uppercase tracking-wider text-gray-500 mb-1">Goals by situation</h3>
      <table className="data-table text-sm">
        <thead>
          <tr>
            <th className="!px-0" />
            {rows.map((r) => (
              <th key={r.key} className="!text-right !px-0 !pl-3">
                {r.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {(
            [
              ['even', 'Even'],
              ['manUp', 'Man-up'],
              ['shortHanded', 'Short-handed'],
            ] as const
          ).map(([k, label]) => (
            <tr key={k}>
              <td className="!py-1.5 !px-0">{label}</td>
              {rows.map((r) => (
                <td key={r.key} className="!py-1.5 !px-0 !pl-3 text-right">
                  {r.s[k]}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td className="!py-1.5 !px-0 font-semibold">Goals</td>
            {rows.map((r) => (
              <td key={r.key} className="!py-1.5 !px-0 !pl-3 text-right font-bold">
                {r.s.total}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
