import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { CLIP_COLUMNS, getCfConfig, getFilmAccess, mapClipRow } from '@/lib/film'

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

// PATCH /api/film/clips/:id { name?, notes? } — rename a clip or keep notes
// on it. Coach only.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getFilmAccess(req)
  if (!access.manage) {
    return NextResponse.json({ error: 'Coach sign-in required.' }, { status: 403 })
  }
  const { id: idParam } = await params
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid id.' }, { status: 400 })
  }
  let body: { name?: unknown; notes?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
  }
  const patch: { name?: string; notes?: string | null } = {}
  if (typeof body.name === 'string') {
    const name = body.name.trim().slice(0, 60)
    if (!name) return NextResponse.json({ error: 'The clip needs a name.' }, { status: 400 })
    patch.name = name
  }
  if (body.notes === null || typeof body.notes === 'string') {
    patch.notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 4000) || null : null
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 })

  const { data, error } = await createServiceClient()
    .from('team_clips')
    .update(patch)
    .eq('id', id)
    .select(CLIP_COLUMNS)
    .maybeSingle()
  if (error || !data) {
    return NextResponse.json({ error: 'Could not save the clip.' }, { status: 500 })
  }
  return NextResponse.json({ clip: mapClipRow(data) })
}
