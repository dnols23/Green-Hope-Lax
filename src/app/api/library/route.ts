import { NextResponse } from 'next/server'
import { getViewer } from '@/lib/permissions'
import { listPlays, playsReady } from '@/lib/plays'
import { listShots, libraryReady } from '@/lib/library'

/**
 * GET /api/library — what is on the shelf.
 *
 * Fetched when a coach opens the Library picker inside a practice plan, a note
 * or a game plan, rather than loaded with every one of those pages: most notes
 * never pull a play in, and the boards are not small.
 *
 * Coach sign-in required. These are coach-only records.
 */
export async function GET() {
  const viewer = await getViewer()
  if (!viewer) {
    return NextResponse.json({ error: 'Coach sign-in required.' }, { status: 403 })
  }

  const [plays, shots] = await Promise.all([
    playsReady().then((ok) => (ok ? listPlays() : [])),
    libraryReady().then((ok) => (ok ? listShots() : [])),
  ])

  return NextResponse.json({
    plays: plays.map((p) => ({ id: p.id, name: p.name, board: p.board, clip: p.clip })),
    shots: shots.map((s) => ({ id: s.id, title: s.title, url: s.url })),
  })
}
