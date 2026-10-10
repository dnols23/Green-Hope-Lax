import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { CLIP_COLUMNS, getCfConfig, getFilmAccess, mapClipRow } from '@/lib/film'

// POST /api/film/clips { videoId, name, start, end } — save a marked clip to
// the shared team library. Coach only.
export async function POST(req: NextRequest) {
  const access = await getFilmAccess(req)
  if (!access.manage) {
    return NextResponse.json({ error: 'Coach sign-in required.' }, { status: 403 })
  }
  if (!getCfConfig()) {
    return NextResponse.json({ error: 'Film storage is not configured.' }, { status: 503 })
  }

  let body: { videoId?: unknown; name?: unknown; start?: unknown; end?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
  }
  const videoId = Number(body.videoId)
  const start = Number(body.start)
  const end = Number(body.end)
  const name = (typeof body.name === 'string' ? body.name.trim() : '').slice(0, 60) || 'Clip'
  if (!Number.isInteger(videoId) || videoId <= 0 || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
    return NextResponse.json({ error: 'Invalid clip.' }, { status: 400 })
  }

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('team_clips')
    // New clips go to the end of the list: seconds since 1970 outrun any
    // position a drag has handed out.
    .insert({ video_id: videoId, name, start_time: start, end_time: end, position: Date.now() / 1000 })
    .select(CLIP_COLUMNS)
    .single()
  if (error || !data) {
    return NextResponse.json({ error: 'Could not save the clip.' }, { status: 500 })
  }
  return NextResponse.json({ clip: mapClipRow(data) })
}

// PUT /api/film/clips { ids } — the clip list in the order coaches dragged it
// into. Coach only.
export async function PUT(req: NextRequest) {
  const access = await getFilmAccess(req)
  if (!access.manage) {
    return NextResponse.json({ error: 'Coach sign-in required.' }, { status: 403 })
  }
  let body: { ids?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
  }
  const ids = (Array.isArray(body.ids) ? body.ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0)
  if (!ids.length || ids.length > 2000) return NextResponse.json({ error: 'Invalid order.' }, { status: 400 })
  const sb = createServiceClient()
  const results = await Promise.all(ids.map((id, i) => sb.from('team_clips').update({ position: i }).eq('id', id)))
  if (results.some((r) => r.error)) {
    return NextResponse.json({ error: 'Could not save the order.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
