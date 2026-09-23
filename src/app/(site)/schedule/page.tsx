import type { Metadata } from 'next'
import { getGames } from '@/lib/queries'
import { assertPageVisible } from '@/lib/pages'
import { seasonYear } from '@/lib/format'
import { ScheduleView } from '@/components/ScheduleView'
import { listCalendarItems } from '@/lib/calendarData'
import { addDaysYmd, ymdOf, zonedToUtc } from '@/lib/zoned'
import { UpcomingList } from '@/components/calendar/UpcomingList'

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
  const games = await getGames(undefined, 'public')
  const years = [...new Set(games.map((g) => seasonYear(g.game_date)))].sort((a, b) => a - b)
  /* Anything the head coach put on the calendar for everyone — a team
     fundraiser, the banquet. Only the 'public' surface, and only events: the
     games are already drawn above, and nothing meant for the staff, players or
     parents alone can come back from this call. A calendar not yet switched on
     just comes back empty, and the section is left off. */
  // Dynamic server render — today's date is the point here.
  // eslint-disable-next-line react-hooks/purity
  const todayYmd = ymdOf(Date.now())
  const events = (
    await listCalendarItems({
      from: zonedToUtc(todayYmd, '00:00'),
      to: zonedToUtc(addDaysYmd(todayYmd, 365), '00:00'),
      surface: 'public',
      withAvailability: false,
    })
  ).filter((i) => i.source === 'event')

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-10">
      <div className="section-label">{seasonLabel(years)}</div>
      <h1 className="page-title mb-6">Schedule &amp; Results</h1>
      <ScheduleView games={games} />
      {events.length > 0 && (
        <section className="mt-12 max-w-3xl">
          <div className="section-label">Around the program</div>
          <h2 className="text-2xl font-black mb-4">Events</h2>
          <UpcomingList items={events} today={todayYmd} empty="" />
        </section>
      )}
    </div>
  )
}
