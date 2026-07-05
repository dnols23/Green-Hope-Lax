import { NextResponse, type NextRequest } from 'next/server'
import { isTeamRequest } from '@/lib/teamAuth'
import { createServiceClient } from '@/lib/supabase-server'
import { cfStreamApi, getCfConfig } from '@/lib/film'

// DELETE /api/film/:id — remove a film from the team library. Its clips
// cascade in the database, and the underlying Cloudflare video is deleted
// best-effort so storage isn't paid for orphaned film.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isTeamRequest(req))) {
    return NextResponse.json({ error: 'Not signed in to the Team Hub.' }, { status: 401 })
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
