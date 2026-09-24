import { NextResponse, type NextRequest } from 'next/server'
import { getViewer } from '@/lib/permissions'
import {
  availabilityReady,
  calendarReady,
  listCalendarItems,
  listMyAvailability,
  postableTeams,
} from '@/lib/calendarData'

/**
 * GET /api/calendar?from=<ISO>&to=<ISO>
 *
 * The coaches' calendar for a window: events, games, practices and everyone's
 * availability, each marked with whether this coach may change it. The screen
 * calls it every time the window moves — next week, last month, another year.
 *
 * Coach sign-in required. A window longer than about a year is refused; the
 * year view is the widest thing that asks.
 */
export async function GET(request: NextRequest) {
  const viewer = await getViewer()
  if (!viewer) return NextResponse.json({ error: 'Coach sign-in required.' }, { status: 403 })

  const p = request.nextUrl.searchParams
  const from = new Date(p.get('from') ?? '')
  const to = new Date(p.get('to') ?? '')
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    return NextResponse.json({ error: 'from and to must be ISO times, from before to.' }, { status: 400 })
  }
  if (to.getTime() - from.getTime() > 1000 * 60 * 60 * 24 * 380) {
    return NextResponse.json({ error: 'That window is longer than a year.' }, { status: 400 })
  }

  const [ready, availReady] = await Promise.all([calendarReady(), availabilityReady()])
  const [items, mine] = await Promise.all([
    listCalendarItems({ from, to, surface: 'coach', viewer, withFieldTimes: true }),
    availReady ? listMyAvailability(viewer.email) : Promise.resolve([]),
  ])

  return NextResponse.json({
    ready: ready && availReady,
    items,
    myAvailability: mine,
    canPost: postableTeams(viewer),
    me: { email: viewer.email, name: viewer.name, isOwner: viewer.isOwner },
  })
}
