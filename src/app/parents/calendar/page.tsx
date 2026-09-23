import Link from 'next/link'
import { redirect } from 'next/navigation'
import { listCalendarItems } from '@/lib/calendarData'
import { mayReadParentCalendar } from '@/lib/calendarGate'
import { addDaysYmd, ymdOf, zonedToUtc } from '@/lib/zoned'
import { UpcomingList } from '@/components/calendar/UpcomingList'

export const metadata = { title: 'Calendar' }
export const dynamic = 'force-dynamic'

// How far ahead the parents' list reaches — the rest of a season, give or take.
const DAYS_AHEAD = 120

/**
 * The parents' calendar.
 *
 * What the head coach marked for parents or for everyone, plus the games that
 * are not coaches-only. It asks for the 'parents' surface and nothing else, so
 * a coaches-only meeting, a players-only note or an unpublished practice plan
 * cannot turn up here.
 */
export default async function ParentCalendarPage() {
  if (!(await mayReadParentCalendar())) redirect('/parents/welcome')

  // Dynamic (force-dynamic) server render — today's date is the point here.
  // eslint-disable-next-line react-hooks/purity
  const todayYmd = ymdOf(Date.now())
  const items = await listCalendarItems({
    from: zonedToUtc(todayYmd, '00:00'),
    to: zonedToUtc(addDaysYmd(todayYmd, DAYS_AHEAD), '00:00'),
    surface: 'parents',
  })

  return (
    <div className="space-y-6">
      <div>
        <Link href="/parents" className="text-sm font-semibold text-[var(--gh-green)]">
          ← Parent Hub
        </Link>
        <h1 className="text-2xl font-black mt-2">Calendar</h1>
        <p className="text-gray-600 mt-1">
          Games and everything else the coaches want families to know about, for the next four
          months. Times are Cary time.
        </p>
      </div>
      <UpcomingList
        items={items}
        today={todayYmd}
        empty="Nothing on the calendar yet. When the coaches add something, it shows up here."
      />
    </div>
  )
}
