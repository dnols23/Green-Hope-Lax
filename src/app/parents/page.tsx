import { redirect } from 'next/navigation'
import { isCalView } from '@/lib/calendarModel'
import { mayReadParentCalendar } from '@/lib/calendarGate'
import { ymdOf } from '@/lib/zoned'
import { CalendarApp } from '@/components/calendar/CalendarApp'

export const metadata = { title: 'Parent Hub' }
export const dynamic = 'force-dynamic'

/**
 * The Parent Hub: for now, the calendar and nothing else — what the coaches
 * shared with the parents, in the same views the coaches use.
 */
export default async function ParentHubPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (!(await mayReadParentCalendar())) redirect('/parents/welcome')
  const sp = await searchParams
  const view = typeof sp.view === 'string' && isCalView(sp.view) ? sp.view : null
  const date = typeof sp.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : ymdOf(new Date())

  return <CalendarApp hub="parents" initialView={view} initialDate={date} />
}
