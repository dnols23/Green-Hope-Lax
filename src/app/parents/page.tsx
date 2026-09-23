import Link from 'next/link'
import { currentParent, parentHubReady } from '@/lib/parentAccess'
import { getSheet, listSheets, spotsLeft } from '@/lib/signupSheets'
import { SheetCard } from '@/components/parents/SheetCard'
import { NewSheetForm } from '@/components/parents/NewSheetForm'
import { calendarReady, listCalendarItems } from '@/lib/calendarData'
import { mayReadParentCalendar } from '@/lib/calendarGate'
import { addDaysYmd, ymdOf, zonedToUtc } from '@/lib/zoned'
import { UpcomingList } from '@/components/calendar/UpcomingList'

export const metadata = { title: 'Parent Hub' }
export const dynamic = 'force-dynamic'

export default async function ParentHubPage() {
  if (!(await parentHubReady())) {
    return (
      <div className="card p-6">
        <h1 className="text-xl font-black mb-2">Parent Hub</h1>
        <p className="text-gray-600">
          The Parent Hub is not switched on yet. A coach needs to run the parent hub SQL in
          Supabase.
        </p>
      </div>
    )
  }

  const parent = await currentParent()
  const sheets = await listSheets()
  const withCounts = await Promise.all(
    sheets.map(async (s) => {
      const full = await getSheet(s.id)
      return { sheet: s, left: full ? spotsLeft(full) : 0 }
    })
  )

  /* The next few things on the calendar that the coaches marked for parents or
     for everyone, games included. Left off entirely until the calendar is
     switched on and the cookie is known to be a real parent's (or a coach's). */
  // Dynamic (force-dynamic) server render — today's date is the point here.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const todayYmd = ymdOf(now)
  const showCalendar = (await calendarReady()) && (await mayReadParentCalendar())
  const comingUp = showCalendar
    ? (
        await listCalendarItems({
          from: zonedToUtc(todayYmd, '00:00'),
          to: zonedToUtc(addDaysYmd(todayYmd, 60), '00:00'),
          surface: 'parents',
        })
      ).filter((i) => +new Date(i.endsAt) > now)
    : []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black mb-1">
          {parent ? `Hi, ${parent.name.split(' ')[0]}` : 'Parent Hub'}
        </h1>
        <p className="text-gray-600">
          Sign-up sheets for the things the team needs hands for. Take a spot and you will get
          an email with what you said you would bring.
        </p>
      </div>

      {showCalendar && (
        <section>
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h2 className="font-bold text-gray-700">Coming up</h2>
            <Link href="/parents/calendar" className="text-sm font-semibold text-[var(--gh-green)]">
              Full calendar →
            </Link>
          </div>
          <div className="card p-5">
            <UpcomingList
              items={comingUp}
              today={todayYmd}
              compact
              limit={5}
              empty="Nothing on the calendar right now."
            />
          </div>
        </section>
      )}

      <section>
        <h2 className="font-bold text-gray-700 mb-3">Open sign-ups</h2>
        {withCounts.length === 0 ? (
          <p className="card p-6 text-gray-500">
            Nothing needs volunteers right now. This is where it will appear.
          </p>
        ) : (
          <div className="space-y-3">
            {withCounts.map(({ sheet, left }) => (
              <SheetCard key={sheet.id} sheet={sheet} spotsLeft={left} />
            ))}
          </div>
        )}
      </section>

      {parent?.is_team_parent && (
        <details className="card p-5">
          <summary className="cursor-pointer font-bold text-gray-700 list-none">
            ✚ New sign-up sheet
            <span className="ml-2 text-xs font-normal text-gray-400">team parent</span>
          </summary>
          <div className="mt-4">
            <NewSheetForm from="hub" />
          </div>
        </details>
      )}
    </div>
  )
}
