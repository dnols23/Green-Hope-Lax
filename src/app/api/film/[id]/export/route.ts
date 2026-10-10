import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { VIDEO_COLUMNS, cfStreamApi, getCfConfig, getFilmAccess, mapVideoRow } from '@/lib/film'
import type { LibVideo } from '@/components/videoboard/types'

export const maxDuration = 60

const MAX_PARTS = 20

// POST /api/film/:id/export { parts: [{ start, end, name }] } — make each
// piece of a film its own film in the team library. Cloudflare cuts them from
// the original on its side (nothing is downloaded or uploaded again); the new
// films play once Cloudflare has finished, usually within a minute or two.
// The original stays as it is. Head coach only.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getFilmAccess(req)
  if (!access.edit) {
    return NextResponse.json({ error: 'Only the head coach can edit film.' }, { status: 403 })
  }
  const cf = getCfConfig()
  if (!cf) return NextResponse.json({ error: 'Film storage is not configured.' }, { status: 503 })

  const { id: idParam } = await params
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid id.' }, { status: 400 })
  }
  let body: { parts?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
  }
  const parts = (Array.isArray(body.parts) ? body.parts : [])
    .map((p) => {
      const r = (p ?? {}) as Record<string, unknown>
      // Cloudflare cuts on whole seconds: widen to keep every frame asked for.
      const start = Math.max(0, Math.floor(Number(r.start)))
      const end = Math.ceil(Number(r.end))
      const name = (typeof r.name === 'string' ? r.name.trim() : '').slice(0, 120) || 'Film'
      return { start, end, name }
    })
    .filter((p) => Number.isFinite(p.start) && Number.isFinite(p.end) && p.end - p.start >= 1)
  if (!parts.length) return NextResponse.json({ error: 'Nothing to export.' }, { status: 400 })
  if (parts.length > MAX_PARTS) {
    return NextResponse.json({ error: `At most ${MAX_PARTS} pieces at a time.` }, { status: 400 })
  }

  const sb = createServiceClient()
  const { data: source } = await sb.from('team_videos').select('uid').eq('id', id).maybeSingle()
  if (!source?.uid) return NextResponse.json({ error: 'That film is no longer in the library.' }, { status: 404 })

  const made: LibVideo[] = []
  for (const part of parts) {
    let res: Response
    let json: { success?: boolean; result?: { uid?: string }; errors?: { code?: number; message?: string }[] } = {}
    try {
      res = await fetch(cfStreamApi(cf, '/clip'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${cf.apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clippedFromVideoUID: source.uid,
          startTimeSeconds: part.start,
          endTimeSeconds: part.end,
          meta: { name: part.name },
        }),
      })
      json = await res.json().catch(() => ({}))
    } catch {
      return NextResponse.json({ error: 'Could not reach Cloudflare.', videos: made }, { status: 502 })
    }
    const uid = json.result?.uid
    if (!res.ok || !json.success || !uid) {
      const why = json.errors?.map((e) => e.message).filter(Boolean).join('; ')
      return NextResponse.json(
        { error: `Cloudflare would not cut “${part.name}”${why ? `: ${why}` : ''}.`, videos: made },
        { status: 502 }
      )
    }
    const { data, error } = await sb.from('team_videos').insert({ uid, name: part.name }).select(VIDEO_COLUMNS).single()
    if (error || !data) {
      return NextResponse.json({ error: 'Could not save to the team library.', videos: made }, { status: 500 })
    }
    made.push(mapVideoRow(data, cf.customerCode))
  }
  return NextResponse.json({ videos: made })
}
