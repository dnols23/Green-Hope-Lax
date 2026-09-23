import { requireSection } from '@/lib/permissions'
import { postableTeams } from '@/lib/calendarData'
import { isCalView } from '@/lib/calendarModel'
import { ymdOf } from '@/lib/zoned'
import { CalendarApp } from '@/components/calendar/CalendarApp'

export const metadata = { title: 'Calendar' }
export const dynamic = 'force-dynamic'

/**
 * The staff calendar.
 *
 * Every coach has it. The head coach puts things on it and decides, one event
 * at a time, who else sees each one — the staff, the players, the parents or
 * everybody. Every other coach's part is the one thing only that coach knows:
 * when they can and can't be there.
 *
 * The page itself only reads the address bar. The calendar fetches its own
 * data for whatever window is on screen, so paging a week or a year never
 * reloads the page.
 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const viewer = await requireSection('calendar')
  const sp = await searchParams
  const view = typeof sp.view === 'string' && isCalView(sp.view) ? sp.view : null
  // The date is always handed down, today's in Cary if the link has none, so
  // the server's first draw and the browser's agree on which week it is.
  const date = typeof sp.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : ymdOf(new Date())
  const posts = postableTeams(viewer).length > 0

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-black">Calendar</h1>
        <p className="hidden sm:block text-sm text-gray-500 max-w-3xl">
          {posts
            ? 'Games, practice plans and everything you put on the calendar, with the staff’s availability alongside. Every event you add says who sees it — just the coaches, the players, the parents, or everyone.'
            : 'Games, practice plans and team events in one place. Your part is your availability — set the days and times you can’t make, and the staff plans around them.'}
        </p>
      </div>
      <CalendarApp initialView={view} initialDate={date} />
    </div>
  )
}
