import { NextResponse, type NextRequest } from 'next/server'
import { isTeamRequest } from '@/lib/teamAuth'
import { cfStreamApi, getCfConfig } from '@/lib/film'

// POST /api/film/upload-url { uploadLength, name }
// Mints a one-time Cloudflare Stream resumable (tus) upload URL. The browser
// then uploads the file straight to Cloudflare — the API token never leaves
// the server, and big game films resume if the connection drops.
export async function POST(req: NextRequest) {
  if (!(await isTeamRequest(req))) {
    return NextResponse.json({ error: 'Not signed in to the Team Hub.' }, { status: 401 })
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
    return NextResponse.json({ error: 'Cloudflare rejected the upload.' }, { status: 502 })
  }
  const uploadURL = res.headers.get('location')
  const uid = res.headers.get('stream-media-id')
  if (!uploadURL || !uid) {
    return NextResponse.json({ error: 'No upload URL returned by Cloudflare.' }, { status: 502 })
  }
  return NextResponse.json({ uploadURL, uid })
}
