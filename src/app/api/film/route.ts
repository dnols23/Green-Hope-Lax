import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { getCfConfig, getFilmAccess, mapClipRow, mapVideoRow } from '@/lib/film'

// GET /api/film — the shared team film library + clips.
// Returns { configured: false } when Cloudflare env vars aren't set, which
// tells the board to run in local, session-only mode. `canManage` is true for
// a signed-in coach; team members get a watch-only library.
export async function GET(req: NextRequest) {
  const access = await getFilmAccess(req)
  if (!access.view) {
    return NextResponse.json({ error: 'Not signed in to the Team Hub.' }, { status: 401 })
  }
  const cf = getCfConfig()
  if (!cf) {
    return NextResponse.json({ configured: false, canManage: access.manage, videos: [], clips: [] })
  }

  const sb = createServiceClient()
  const [videosRes, clipsRes] = await Promise.all([
    sb.from('team_videos').select('id, uid, name').order('created_at', { ascending: true }),
    sb.from('team_clips').select('id, video_id, name, start_time, end_time').order('created_at', { ascending: true }),
  ])
  if (videosRes.error || clipsRes.error) {
    return NextResponse.json(
      { error: 'Could not load the team library. Has the film_room migration been run?' },
      { status: 500 }
    )
  }
  return NextResponse.json({
    configured: true,
    canManage: access.manage,
    videos: videosRes.data.map((row) => mapVideoRow(row, cf.customerCode)),
    clips: clipsRes.data.map(mapClipRow),
  })
}

// POST /api/film { uid, name } — record a finished Cloudflare upload in the
// shared library so the whole team sees it. Coach only.
export async function POST(req: NextRequest) {
  const access = await getFilmAccess(req)
  if (!access.manage) {
    return NextResponse.json({ error: 'Coach sign-in required.' }, { status: 403 })
  }
  const cf = getCfConfig()
  if (!cf) return NextResponse.json({ error: 'Film storage is not configured.' }, { status: 503 })

  let body: { uid?: unknown; name?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
  }
  const uid = typeof body.uid === 'string' ? body.uid : ''
  const name = (typeof body.name === 'string' ? body.name : 'Film').slice(0, 120) || 'Film'
  if (!/^[a-zA-Z0-9]{16,64}$/.test(uid)) {
    return NextResponse.json({ error: 'Invalid video id.' }, { status: 400 })
  }

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('team_videos')
    .insert({ uid, name })
    .select('id, uid, name')
    .single()
  if (error || !data) {
    return NextResponse.json({ error: 'Could not save to the team library.' }, { status: 500 })
  }
  return NextResponse.json({ video: mapVideoRow(data, cf.customerCode) })
}
