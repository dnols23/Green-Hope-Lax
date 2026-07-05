import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { getCfConfig, getFilmAccess } from '@/lib/film'

// DELETE /api/film/clips/:id — remove a saved clip from the team library.
// Coach only.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getFilmAccess(req)
  if (!access.manage) {
    return NextResponse.json({ error: 'Coach sign-in required.' }, { status: 403 })
  }
  if (!getCfConfig()) {
    return NextResponse.json({ error: 'Film storage is not configured.' }, { status: 503 })
  }

  const { id: idParam } = await params
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid id.' }, { status: 400 })
  }

  const sb = createServiceClient()
  const { error } = await sb.from('team_clips').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: 'Could not delete the clip.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
