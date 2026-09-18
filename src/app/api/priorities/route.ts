import { NextResponse } from 'next/server'
import { getViewer } from '@/lib/permissions'
import { listPriorities, prioritiesReady } from '@/lib/priorities'

/**
 * GET /api/priorities — the lists, for the Review priorities panel.
 *
 * Fetched when the panel is opened rather than loaded with every plan: most
 * times a plan is opened it is to change one block's minutes.
 *
 * Coach sign-in required.
 */
export async function GET() {
  if (!(await getViewer())) {
    return NextResponse.json({ error: 'Coach sign-in required.' }, { status: 403 })
  }
  const ready = await prioritiesReady()
  return NextResponse.json({ ready, lists: ready ? await listPriorities() : [] })
}
