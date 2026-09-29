import { redirect } from 'next/navigation'
import { isCalView } from '@/lib/calendarModel'
import { mayReadTeamCalendar } from '@/lib/calendarGate'
import { ymdOf } from '@/lib/zoned'
import { CalendarApp } from '@/components/calendar/CalendarApp'
import { TeamHubShell } from '@/components/team/TeamHubShell'

export const metadata = { title: 'Team Calendar' }
export const dynamic = 'force-dynamic'

/** The team calendar: what the coaches shared with the players, in every view. */
export default async function TeamCalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (!(await mayReadTeamCalendar())) redirect('/team/login')
  const sp = await searchParams
  const view = typeof sp.view === 'string' && isCalView(sp.view) ? sp.view : null
  const date = typeof sp.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : ymdOf(new Date())
  return (
    <TeamHubShell tab="calendar">
      <CalendarApp hub="team" initialView={view} initialDate={date} />
    </TeamHubShell>
  )
}
