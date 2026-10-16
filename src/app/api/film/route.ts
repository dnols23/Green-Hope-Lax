import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { CLIP_COLUMNS, VIDEO_COLUMNS, getCfConfig, getFilmAccess, listFilmGames, mapClipRow, mapVideoRow } from '@/lib/film'
import { detailColumns } from '@/components/videoboard/filmMeta'
import { filmViewerFor, newForViewer, unreadReplies } from '@/lib/clipShareData'

// GET /api/film — the shared team film library + clips.
// Returns { configured: false } when Cloudflare env vars aren't set, which
// tells the board to run in local, session-only mode. `canManage` is true for
// a signed-in coach; team members get a watch-only library. `canEdit` is the
// head coach alone, who may cut the film itself.
export async function GET(req: NextRequest) {
  const access = await getFilmAccess(req)
  if (!access.view) {
    return NextResponse.json({ error: 'Not signed in to the Team Hub.' }, { status: 401 })
  }
  const cf = getCfConfig()
  if (!cf) {
    return NextResponse.json({ configured: false, canManage: access.manage, canEdit: false, videos: [], clips: [], games: [] })
  }

  const sb = createServiceClient()
  // What's waiting for this coach: film sent to him, and (for the head coach) replies.
  const waiting = async () => {
    if (!access.manage) return { forYou: 0, replies: 0 }
    const me = await filmViewerFor('admin')
    const [forYou, replies] = await Promise.all([me ? newForViewer(me) : 0, access.edit ? unreadReplies() : 0])
    return { forYou, replies }
  }
  const [videosRes, clipsRes, games, counts] = await Promise.all([
    sb.from('team_videos').select(VIDEO_COLUMNS).order('created_at', { ascending: true }),
    sb
      .from('team_clips')
      .select(CLIP_COLUMNS)
      .order('position', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true }),
    listFilmGames(sb),
    waiting(),
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
    canEdit: access.edit,
    videos: videosRes.data.map((row) => mapVideoRow(row, cf.customerCode)),
    clips: clipsRes.data.map(mapClipRow),
    games,
    ...counts,
  })
}

// POST /api/film { uid, name, category?, gameId?, folder?, notes? } — record a
// finished Cloudflare upload in the shared library so the whole team sees it,
// with whatever details the coach gave it while it uploaded. Coach only.
export async function POST(req: NextRequest) {
  const access = await getFilmAccess(req)
  if (!access.manage) {
    return NextResponse.json({ error: 'Coach sign-in required.' }, { status: 403 })
  }
  const cf = getCfConfig()
  if (!cf) return NextResponse.json({ error: 'Film storage is not configured.' }, { status: 503 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
  }
  const uid = typeof body.uid === 'string' ? body.uid : ''
  const details = detailColumns(body)
  const name = details.name ?? 'Film'
  if (!/^[a-zA-Z0-9]{16,64}$/.test(uid)) {
    return NextResponse.json({ error: 'Invalid video id.' }, { status: 400 })
  }

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('team_videos')
    .insert({ ...details, uid, name })
    .select(VIDEO_COLUMNS)
    .single()
  if (error || !data) {
    return NextResponse.json({ error: 'Could not save to the team library.' }, { status: 500 })
  }
  return NextResponse.json({ video: mapVideoRow(data, cf.customerCode) })
}
