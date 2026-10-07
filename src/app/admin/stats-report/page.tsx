import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { requireSection, requireTeam } from '@/lib/permissions'
import { getStatGame, loadSeason, playerMap } from '@/lib/statsData'
import { filterGames, seasonOf } from '@/lib/stats'
import { teamLabel } from '@/lib/teams'
import { dateSpan, filterLabel, gameLine, gamesIn, plural, stretchLine, trackedSeasons, untrackedFinals, generatedNow } from './format'
import { firstParam, readFilter, readNotes, readSeasonYear, readSections, reportBuilderHref } from './sections'
import { GameBody, NothingToReport, ReportFrame, SeasonBody } from './ReportSheet'

export const metadata = { title: 'Stats Report', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/**
 * Where the toolbar's Back goes. From a box score (which opens this in its own
 * tab), back to that box score; otherwise to the "make a report" screen, set
 * up exactly as it was — notes and all — so one change doesn't mean starting
 * over.
 */
async function cameFromBoxScore(): Promise<string | null> {
  const h = await headers()
  const ref = h.get('referer')
  if (!ref) return null
  try {
    const url = new URL(ref)
    if (url.host !== h.get('host')) return null
    return /^\/admin\/stats\/[0-9a-f-]{36}\/?$/i.test(url.pathname) ? url.pathname + url.search : null
  } catch {
    return null
  }
}

/**
 * The stats report, laid out for paper, outside the admin chrome so nothing
 * but the sheet prints. Opened from the Report tab (a stretch of games) or a
 * box score (one game). Printing is always a tap on the Print button.
 */
export default async function StatsReportSheetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const gameId = firstParam(sp.game)
  const notes = readNotes(firstParam(sp.notes))
  const generated = generatedNow()

  // ── One game ──
  if (gameId !== undefined) {
    await requireSection('stats')
    const game = await getStatGame(gameId)
    if (!game) notFound()
    // A game's team is its own; the season load also gives players who have
    // since left the roster their names back.
    const team = game.level
    const season = await loadSeason(team)
    const summary = season.games.find((g) => g.game.id === game.id)
    if (!summary) notFound()
    const sections = readSections(firstParam(sp.sections), 'game')
    const box = await cameFromBoxScore()
    return (
      <ReportFrame
        title={`Green Hope Lacrosse · ${teamLabel(team)} · Stats Report`}
        scope={gameLine(summary)}
        scopeDetail={summary.game.is_conference ? 'Conference' : null}
        generated={generated}
        backHref={box ?? reportBuilderHref(team, { mode: 'game', gameId: game.id }, sections, notes)}
        backLabel={box ? 'Back to box score' : 'Back to Stats'}
        footNote="From the tracked stats for this game."
        legend={sections.includes('takeaways') && summary.tracked}
        compact
      >
        {summary.tracked ? (
          <GameBody game={summary} events={season.events} who={playerMap(season.players)} sections={sections} notes={notes} />
        ) : (
          <NothingToReport title="This game wasn’t tracked">
            There are no stats to print for it — only the score on the schedule. Track a game from the Games tab and its report
            fills in here.
          </NothingToReport>
        )}
      </ReportFrame>
    )
  }

  // ── A stretch of games ──
  const { team } = await requireTeam('stats', firstParam(sp.team))
  const season = await loadSeason(team)
  const filter = readFilter(firstParam(sp.filter))
  const sections = readSections(firstParam(sp.sections), 'season')
  // The season asked for, or the latest one with anything tracked in it.
  const asked = readSeasonYear(firstParam(sp.season))
  const years = trackedSeasons(season.games)
  const year =
    asked ?? years[0] ?? season.games.map((g) => seasonOf(g.game)).filter((y): y is number => y != null).sort((a, b) => b - a)[0] ?? null
  const inSeason = year == null ? [] : gamesIn(season.games, year)
  const games = filterGames(inSeason, filter)
  const untracked = untrackedFinals(inSeason)

  return (
    <ReportFrame
      title={`Green Hope Lacrosse · ${teamLabel(team)} · Stats Report`}
      scope={`${filterLabel(filter)} · ${games.length ? stretchLine(games) : 'no tracked games'}`}
      scopeDetail={dateSpan(games) ?? (year != null ? `${year} season` : null)}
      generated={generated}
      backHref={reportBuilderHref(team, { mode: 'season', season: year, filter }, sections, notes)}
      backLabel="Back to Stats"
      legend={games.length > 0 && (sections.includes('headline') || sections.includes('takeaways'))}
      // A long season (playoffs and all) tightens up to stay on two pages.
      compact={games.length > 16}
      footNote={
        untracked && filter === 'all'
          ? `Only tracked games are counted: ${plural(untracked, 'finished game')} ${untracked === 1 ? 'wasn’t' : 'weren’t'} tracked.`
          : 'Only tracked games are counted.'
      }
    >
      {games.length ? (
        <SeasonBody games={games} events={season.events} who={playerMap(season.players)} sections={sections} notes={notes} />
      ) : (
        <NothingToReport title={`No tracked games${filter === 'all' ? '' : ` in “${filterLabel(filter)}”`}${year != null ? ` for ${year}` : ''}`}>
          {filter === 'all'
            ? 'Track a game from the Games tab and the report fills in from there.'
            : 'Go back and pick another set of games — All games, say.'}
        </NothingToReport>
      )}
    </ReportFrame>
  )
}
