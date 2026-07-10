import type { Metadata } from 'next'
import { getGames } from '@/lib/queries'
import { assertPageVisible } from '@/lib/pages'
import { seasonYear } from '@/lib/format'
import { ScheduleView } from '@/components/ScheduleView'

export const metadata: Metadata = {
  title: 'Schedule & Results',
  description: 'Game schedule, scores, and results for Green Hope Falcons boys and girls lacrosse.',
}

// Label the page from the seasons actually on the schedule, so it never goes
// stale. Falls back to the current year when there are no games yet.
function seasonLabel(years: number[]): string {
  if (years.length === 0) return `${new Date().getFullYear()} Season`
  const min = years[0]
  const max = years[years.length - 1]
  return min === max ? `${min} Season` : `${min}–${max} Seasons`
}

export default async function SchedulePage() {
  await assertPageVisible('schedule')
  const games = await getGames()
  const years = [...new Set(games.map((g) => seasonYear(g.game_date)))].sort((a, b) => a - b)
  return (
    <div className="max-w-screen-xl mx-auto px-4 py-10">
      <div className="section-label">{seasonLabel(years)}</div>
      <h1 className="page-title mb-6">Schedule &amp; Results</h1>
      <ScheduleView games={games} />
    </div>
  )
}
