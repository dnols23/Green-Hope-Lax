import Link from 'next/link'
import { requireTeam } from '@/lib/permissions'
import { loadSeason } from '@/lib/statsData'
import { GAME_FILTERS, filterGames, seasonOf } from '@/lib/stats'
import { teamLabel, withTeam } from '@/lib/teams'
import { StatsTabs } from '../StatsTabs'
import {
  ALL_SECTION_KEYS,
  REPORT_SECTIONS,
  firstParam,
  readFilter,
  readNotes,
  readSeasonYear,
  readSections,
  type ReportScope,
} from '@/app/admin/stats-report/sections'
import {
  dateSpan,
  gameDate,
  gamesIn,
  opponentLabel,
  plural,
  resultLabel,
  stretchLine,
  trackedSeasons,
  untrackedFinals,
} from '@/app/admin/stats-report/format'
import { ReportBuilder, type SeasonOption } from './ReportBuilder'

export const metadata = { title: 'Stats Report' }
export const dynamic = 'force-dynamic'

/**
 * Make a report to print for a team meeting: which games, which parts, a few
 * notes, then one button to the printable sheet. Everything is set up already
 * — this season, all games, every part — so most of the time that button is
 * the only thing to press.
 */
export default async function StatsReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const { team } = await requireTeam('stats', firstParam(sp.team))
  const season = await loadSeason(team)

  // What each choice would put on the page, worked out here so the summary
  // beside the button changes the moment a chip is tapped.
  const seasons: SeasonOption[] = trackedSeasons(season.games).map((year) => {
    const games = gamesIn(season.games, year)
    return {
      year,
      filters: GAME_FILTERS.map((f) => {
        const kept = filterGames(games, f.key)
        return { key: f.key, label: f.label, count: kept.length, line: stretchLine(kept), dates: dateSpan(kept) }
      }),
      games: filterGames(games, 'all')
        .reverse()
        .map((g) => ({
          id: g.game.id,
          label: `${gameDate(g)} · ${opponentLabel(g)} · ${resultLabel(g)}`,
          title: opponentLabel(g),
          detail: `${gameDate(g)} · ${resultLabel(g)}`,
        })),
      untracked: untrackedFinals(games),
    }
  })

  // Opened from the sheet's Back button, the address carries the whole report
  // as it was, notes and all; from the Analysis page, its filter.
  const askedGame = firstParam(sp.game)
  const game = askedGame ? season.games.find((g) => g.game.id === askedGame && g.tracked) : undefined
  const askedYear = readSeasonYear(firstParam(sp.season))
  const year = (game && seasonOf(game.game)) ?? seasons.find((s) => s.year === askedYear)?.year ?? seasons[0]?.year ?? null
  const scope: ReportScope =
    askedGame !== undefined && year != null
      ? { mode: 'game', gameId: game?.game.id ?? seasons.find((s) => s.year === year)!.games[0].id }
      : { mode: 'season', season: year, filter: readFilter(firstParam(sp.filter)) }
  // Parts that belong only to the other kind of report stay ticked, so
  // switching to "One game" doesn't arrive with half its boxes empty.
  const shown = REPORT_SECTIONS[scope.mode].map((s) => s.key)
  const sections = [...ALL_SECTION_KEYS.filter((k) => !shown.includes(k)), ...readSections(firstParam(sp.sections), scope.mode)]
  const untrackedEver = untrackedFinals(season.games)

  return (
    <div className="max-w-5xl">
      <StatsTabs team={team} active="report" query={scope.mode === 'season' && scope.filter !== 'all' ? `filter=${scope.filter}` : ''} />
      <h1 className="text-xl font-black">Print a report</h1>
      <p className="text-gray-500 text-sm mb-6">
        Pick the games and what goes on it, then open the sheet and print. Black and white, one or two pages.
      </p>

      {year == null ? (
        <div className="card p-6 text-sm text-gray-600 space-y-3">
          <p className="font-bold text-gray-900">Nothing to report yet for {teamLabel(team)}.</p>
          <p>
            Reports are built from tracked games. Track a game from the Games tab and you can print its box score, or a report on
            the whole season, from here.
          </p>
          {untrackedEver > 0 && (
            <p className="text-gray-500">
              {plural(untrackedEver, 'finished game')} on the schedule {untrackedEver === 1 ? 'wasn’t' : 'weren’t'} tracked, so{' '}
              {untrackedEver === 1 ? 'it has' : 'they have'} a score but no stats.
            </p>
          )}
          <Link href={withTeam('/admin/stats', team)} className="btn btn-primary">
            Go to Games
          </Link>
        </div>
      ) : (
        <ReportBuilder
          team={team}
          teamName={teamLabel(team)}
          seasons={seasons}
          initialSeason={year}
          initialScope={scope}
          initialSections={sections}
          initialNotes={readNotes(firstParam(sp.notes))}
        />
      )}
    </div>
  )
}
