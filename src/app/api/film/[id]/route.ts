import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { VIDEO_COLUMNS, cfStreamApi, getCfConfig, getFilmAccess, mapVideoRow } from '@/lib/film'
import { normCuts } from '@/components/videoboard/cuts'
import { detailColumns } from '@/components/videoboard/filmMeta'

// DELETE /api/film/:id — remove a film from the team library. Coach only.
// Its clips cascade in the database, and the underlying Cloudflare video is
// deleted best-effort so storage isn't paid for orphaned film.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getFilmAccess(req)
  if (!access.manage) {
    return NextResponse.json({ error: 'Coach sign-in required.' }, { status: 403 })
  }
  const cf = getCfConfig()
  if (!cf) return NextResponse.json({ error: 'Film storage is not configured.' }, { status: 503 })

  const { id: idParam } = await params
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid id.' }, { status: 400 })
  }

  const sb = createServiceClient()
  const { data: row } = await sb.from('team_videos').select('uid').eq('id', id).maybeSingle()
  const { error } = await sb.from('team_videos').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: 'Could not delete from the team library.' }, { status: 500 })
  }
  if (row?.uid) {
    try {
      await fetch(cfStreamApi(cf, `/${row.uid}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${cf.apiToken}` },
      })
    } catch {
      // Row is gone either way; a stray Cloudflare video can be cleaned up
      // from the Cloudflare dashboard.
    }
  }
  return NextResponse.json({ ok: true })
}

// PATCH /api/film/:id { name?, category?, gameId?, folder?, notes?, cuts? } —
// a film's details, which any coach may set (whoever uploaded it fills them
// in), and its edit — the stretches cut out of it — which only the head coach
// may change.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getFilmAccess(req)
  if (!access.manage) {
    return NextResponse.json({ error: 'Coach sign-in required.' }, { status: 403 })
  }
  const cf = getCfConfig()
  if (!cf) return NextResponse.json({ error: 'Film storage is not configured.' }, { status: 503 })

  const { id: idParam } = await params
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid id.' }, { status: 400 })
  }
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
  }
  if (typeof body.name === 'string' && !body.name.trim()) {
    return NextResponse.json({ error: 'The film needs a name.' }, { status: 400 })
  }
  const patch: Record<string, unknown> = detailColumns(body)
  if (body.cuts !== undefined) {
    if (!access.edit) return NextResponse.json({ error: 'Only the head coach can edit film.' }, { status: 403 })
    patch.cuts = normCuts(body.cuts)
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 })

  const { data, error } = await createServiceClient()
    .from('team_videos')
    .update(patch)
    .eq('id', id)
    .select(VIDEO_COLUMNS)
    .maybeSingle()
  if (error || !data) {
    return NextResponse.json({ error: 'Could not save.' }, { status: 500 })
  }
  return NextResponse.json({ video: mapVideoRow(data, cf.customerCode) })
}
