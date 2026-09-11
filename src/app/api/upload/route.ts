import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { getViewer } from '@/lib/permissions'

/**
 * POST /api/upload — put a photo in the team's own storage and hand back its
 * address.
 *
 * A coach has a photo on their phone, not a URL. The browser shrinks it before
 * it gets here (a phone photo is bigger than a serverless request is allowed to
 * be), this checks it is really an image, and Supabase Storage keeps it. What
 * comes back is a permanent link on our own bucket — nothing hotlinked from
 * somebody else's website that can vanish or change under us.
 *
 * Coach sign-in required.
 */

const BUCKET = 'media'
const MAX_BYTES = 6 * 1024 * 1024

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export async function POST(req: NextRequest) {
  const viewer = await getViewer()
  if (!viewer) {
    return NextResponse.json({ error: 'Coach sign-in required.' }, { status: 403 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'That upload did not arrive in one piece. Try again.' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No photo was attached.' }, { status: 400 })
  }
  const ext = EXT[file.type]
  if (!ext) {
    return NextResponse.json(
      { error: 'That file is not a photo. Use a JPEG, PNG, WebP or GIF.' },
      { status: 400 }
    )
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'That photo is too big, even after shrinking.' }, { status: 400 })
  }

  // A folder per thing being illustrated, so the bucket stays readable a year
  // from now. The name is random: two coaches uploading "team.jpg" in the same
  // minute must not overwrite each other.
  const folder = String(form.get('folder') ?? 'uploads').replace(/[^a-z0-9-]/gi, '') || 'uploads'
  const path = `${folder}/${crypto.randomUUID()}.${ext}`

  const svc = createServiceClient()
  const { error } = await svc.storage
    .from(BUCKET)
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false })

  if (error) {
    const missing = /bucket/i.test(error.message)
    return NextResponse.json(
      {
        error: missing
          ? 'The photo store is not set up yet — run the media bucket SQL in Supabase.'
          : `Supabase would not take the photo: ${error.message}`,
      },
      { status: 500 }
    )
  }

  const { data } = svc.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
