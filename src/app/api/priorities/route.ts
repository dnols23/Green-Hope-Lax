import { NextResponse, type NextRequest } from 'next/server'
import { getViewer } from '@/lib/permissions'
import { listPriorities, prioritiesReady } from '@/lib/priorities'
import { readTeam } from '@/lib/teams'

/**
 * GET /api/priorities?team=jv — one team's lists, for the Review priorities panel.
 *
 * Fetched when the panel is opened rather than loaded with every plan: most
 * times a plan is opened it is to change one block's minutes. The team comes
 * from the plan being written, so a JV practice reviews the JV list.
 *
 * Coach sign-in required.
 */
export async function GET(request: NextRequest) {
  if (!(await getViewer())) {
    return NextResponse.json({ error: 'Coach sign-in required.' }, { status: 403 })
  }
  const team = readTeam(request.nextUrl.searchParams.get('team'))
  const ready = await prioritiesReady()
  return NextResponse.json({ ready, team, lists: ready ? await listPriorities(team) : [] })
}
