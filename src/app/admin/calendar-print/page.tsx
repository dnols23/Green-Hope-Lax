import { Suspense } from 'react'
import { requireSection } from '@/lib/permissions'
import { CalendarPrint } from '@/components/calendar/CalendarPrint'

export const metadata = { title: 'Calendar' }
export const dynamic = 'force-dynamic'

/** The calendar laid out for paper. Opened from Export & print on the calendar. */
export default async function CalendarPrintPage() {
  await requireSection('calendar')
  return (
    <Suspense fallback={null}>
      <CalendarPrint />
    </Suspense>
  )
}
