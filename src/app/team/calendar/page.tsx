import Link from 'next/link'
import { redirect } from 'next/navigation'
import { listCalendarItems } from '@/lib/calendarData'
import { mayReadTeamCalendar } from '@/lib/calendarGate'
import { addDaysYmd, ymdOf, zonedToUtc } from '@/lib/zoned'
import { UpcomingList } from '@/components/calendar/UpcomingList'

export const metadata = { title: 'Team Calendar' }
export const dynamic = 'force-dynamic'

// How far ahead the players' list reaches — the rest of a season, give or take.
const DAYS_AHEAD = 120

/**
 * The players' calendar.
 *
 * Everything the head coach marked for players or for everyone, the games
 * that are not coaches-only, and practice plans once they are published to
 * the team. A coaches-only meeting or a parents-only note never reaches this
 * page: it asks for the 'team' surface and the data layer does the filtering.
 */
export default async function TeamCalendarPage() {
  if (!(await mayReadTeamCalendar())) redirect('/team/login')

  // Dynamic (force-dynamic) server render — today's date is the point here.
  // eslint-disable-next-line react-hooks/purity
  const todayYmd = ymdOf(Date.now())
  const items = await listCalendarItems({
    from: zonedToUtc(todayYmd, '00:00'),
    to: zonedToUtc(addDaysYmd(todayYmd, DAYS_AHEAD), '00:00'),
    surface: 'team',
  })

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/team" className="text-sm font-bold" style={{ color: 'var(--gh-green)' }}>
        ← Team Hub
      </Link>
      <div className="section-label mt-2">Next four months</div>
      <h1 className="page-title mb-2">Team calendar</h1>
      <p className="text-sm text-gray-500 mb-6">
        Games, practices and everything else the coaches have put on the calendar for the
        team. Times are Cary time.
      </p>
      <UpcomingList
        items={items}
        today={todayYmd}
        empty="Nothing on the calendar yet. When the coaches add something, it shows up here."
      />
    </div>
  )
}
