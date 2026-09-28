import { NextResponse, type NextRequest } from 'next/server'
import { listCalendarItems } from '@/lib/calendarData'
import { mayReadParentCalendar, mayReadTeamCalendar } from '@/lib/calendarGate'

/**
 * GET /api/hub-calendar?hub=team|parents&from=<ISO>&to=<ISO>
 *
 * The Team Hub's or the Parent Hub's calendar for a window — only what the
 * coaches shared with that hub, and nothing anyone can change.
 */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams
  const hub = p.get('hub') === 'parents' ? 'parents' : 'team'
  const allowed = hub === 'parents' ? await mayReadParentCalendar() : await mayReadTeamCalendar()
  if (!allowed) return NextResponse.json({ error: 'Sign in again.' }, { status: 403 })

  const from = new Date(p.get('from') ?? '')
  const to = new Date(p.get('to') ?? '')
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    return NextResponse.json({ error: 'from and to must be ISO times, from before to.' }, { status: 400 })
  }
  if (to.getTime() - from.getTime() > 1000 * 60 * 60 * 24 * 380) {
    return NextResponse.json({ error: 'That window is longer than a year.' }, { status: 400 })
  }

  const items = await listCalendarItems({ from, to, surface: hub, withAvailability: false })
  return NextResponse.json({
    ready: true,
    items,
    myAvailability: [],
    canPost: [],
    me: { email: '', name: '', isOwner: false },
  })
}
