import { NextResponse, type NextRequest } from 'next/server'
import { cfStreamApi, getCfConfig, getFilmAccess } from '@/lib/film'

// POST /api/film/upload-url { uploadLength, name } — coach only.
// Mints a one-time Cloudflare Stream resumable (tus) upload URL. The browser
// then uploads the file straight to Cloudflare — the API token never leaves
// the server, and big game films resume if the connection drops.
export async function POST(req: NextRequest) {
  const access = await getFilmAccess(req)
  if (!access.manage) {
    return NextResponse.json({ error: 'Coach sign-in required.' }, { status: 403 })
  }
  const cf = getCfConfig()
  if (!cf) return NextResponse.json({ error: 'Film storage is not configured.' }, { status: 503 })

  let body: { uploadLength?: unknown; name?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
  }
  const uploadLength = Number(body.uploadLength)
  if (!Number.isFinite(uploadLength) || uploadLength <= 0) {
    return NextResponse.json({ error: 'uploadLength required.' }, { status: 400 })
  }
  const name = (typeof body.name === 'string' ? body.name : 'film').slice(0, 120)

  // tus Upload-Metadata: comma-separated "key <base64 value>" pairs.
  const meta = [
    'name ' + Buffer.from(name).toString('base64'),
    'maxdurationseconds ' + Buffer.from('21600').toString('base64'), // up to 6h of film
  ].join(',')

  const res = await fetch(cfStreamApi(cf, '?direct_user=true'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cf.apiToken}`,
      'Tus-Resumable': '1.0.0',
      'Upload-Length': String(uploadLength),
      'Upload-Metadata': meta,
    },
  })
  if (res.status !== 201) {
    // Say why, in words a coach can act on. Cloudflare's own message goes to
    // the server log and, briefly, to the screen, so a wrong setting can be
    // fixed without guessing.
    let detail = ''
    try {
      const j = (await res.json()) as { errors?: { code?: number; message?: string }[] }
      detail = (j.errors ?? []).map((e) => `${e.message ?? ''}${e.code ? ` (${e.code})` : ''}`).filter(Boolean).join('; ')
    } catch {
      detail = (await res.text().catch(() => '')).slice(0, 200)
    }
    console.error('film upload-url: Cloudflare said', res.status, detail)
    const hint =
      res.status === 401 || res.status === 403
        ? 'The Cloudflare API token can’t upload. In Vercel, check CLOUDFLARE_STREAM_API_TOKEN is the token with Stream: Edit, then redeploy.'
        : res.status === 404
          ? 'Cloudflare can’t find that account. In Vercel, check CLOUDFLARE_ACCOUNT_ID, then redeploy.'
          : /quota|storage|minutes|capacity/i.test(detail)
            ? 'The Cloudflare Stream plan is out of storage minutes. Delete old film or add minutes in Cloudflare.'
            : 'Cloudflare rejected the upload.'
    return NextResponse.json({ error: detail ? `${hint} Cloudflare said: ${detail}` : hint }, { status: 502 })
  }
  const uploadURL = res.headers.get('location')
  const uid = res.headers.get('stream-media-id')
  if (!uploadURL || !uid) {
    return NextResponse.json({ error: 'No upload URL returned by Cloudflare.' }, { status: 502 })
  }
  return NextResponse.json({ uploadURL, uid })
}
