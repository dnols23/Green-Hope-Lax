import { NextResponse, type NextRequest } from 'next/server'
import { getViewer } from '@/lib/permissions'
import { listLooks, saveLook, deleteLook } from '@/lib/looks'
import { lookFromTokens } from '@/lib/formations'
import { readBoard } from '@/lib/planner'

/**
 * The looks shelf, for the board.
 *
 * Fetched by the board itself rather than handed down from every page that
 * draws one — a note with four field blocks in it would otherwise load the
 * shelf four times.
 *
 * Coach sign-in required; these are the staff's own work.
 */
export async function GET() {
  if (!(await getViewer())) {
    return NextResponse.json({ error: 'Coach sign-in required.' }, { status: 403 })
  }
  return NextResponse.json({ looks: await listLooks() })
}

export async function POST(req: NextRequest) {
  if (!(await getViewer())) {
    return NextResponse.json({ error: 'Coach sign-in required.' }, { status: 403 })
  }

  let body: { name?: string; tokens?: unknown; id?: string; remove?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'That did not arrive in one piece.' }, { status: 400 })
  }

  if (body.remove && body.id) {
    await deleteLook(body.id)
    return NextResponse.json({ looks: await listLooks() })
  }

  // Run the discs back through the board reader, so nothing reaches the store
  // that could not have been drawn.
  const clean = readBoard({ tokens: body.tokens, paths: [] })
  const look = lookFromTokens(String(body.name ?? ''), clean?.tokens ?? [])
  if (!look) {
    return NextResponse.json({ error: 'There was nothing in the box to save.' }, { status: 400 })
  }
  await saveLook(look)
  return NextResponse.json({ looks: await listLooks() })
}
