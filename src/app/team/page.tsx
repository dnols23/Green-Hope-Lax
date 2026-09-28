import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ThemeToggle } from '@/components/ThemeToggle'
import { teamLogout } from '@/lib/actions'
import { FalconHead } from '@/components/Logo'
import { isCalView } from '@/lib/calendarModel'
import { mayReadTeamCalendar } from '@/lib/calendarGate'
import { ymdOf } from '@/lib/zoned'
import { CalendarApp } from '@/components/calendar/CalendarApp'

export const dynamic = 'force-dynamic'

/**
 * The Team Hub: for now, the team calendar and nothing else — what the
 * coaches shared with the players, in the same views the coaches use.
 */
export default async function TeamHubPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (!(await mayReadTeamCalendar())) redirect('/team/login')
  const sp = await searchParams
  const view = typeof sp.view === 'string' && isCalView(sp.view) ? sp.view : null
  const date = typeof sp.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : ymdOf(new Date())

  return (
    <>
      <header className="text-white" style={{ background: '#004D2E' }}>
        <div className="max-w-screen-xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/team" className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center bg-white rounded-lg px-1.5 py-1">
              <FalconHead size={26} />
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-black">Team Hub</span>
              <span className="text-[0.6rem] tracking-widest" style={{ color: '#f3c9cd' }}>GREEN HOPE FALCONS</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <form action={teamLogout}>
              <button type="submit" className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded transition-colors">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="max-w-screen-xl mx-auto px-4 py-5">
        <CalendarApp hub="team" initialView={view} initialDate={date} />
      </div>
    </>
  )
}
