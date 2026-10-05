'use server'

// Template videos: save the answers, start a render on GitHub Actions, check on it.
// The GitHub token is read here, on the server, and never leaves it.

import { revalidatePath } from 'next/cache'
import { requireSection } from './permissions'
import { createClient, createServiceClient } from './supabase-server'
import { AUDIO_BUCKET, VIDEO_BUCKET, nowIso, readItem } from './content'
import { settleVideo, type VideoRender } from './contentData'
import {
  cleanVideoFields,
  missingVideoFields,
  videoTemplate,
  videoTrack,
  type RenderJob,
  type TrackKey,
} from './videoTemplates'

export interface VideoSetup {
  itemId: string
  template: string
  track: string
  fields: Record<string, string>
}

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

const uuid = (v: unknown) => (/^[0-9a-f-]{36}$/i.test(String(v ?? '')) ? String(v) : null)
const WORKFLOW = 'render-video.yml'

function clean(input: VideoSetup) {
  const itemId = uuid(input.itemId)
  const t = videoTemplate(input.template)
  if (!itemId || !t) return null
  const track: TrackKey = t.tracks.includes(input.track as TrackKey) ? (input.track as TrackKey) : t.tracks[0]
  return { itemId, t, track, fields: cleanVideoFields(t, input.fields) }
}

/** Keep the template, answers and sound with the video, without rendering. */
export async function saveVideoSetup(input: VideoSetup): Promise<Result> {
  await requireSection('social')
  const c = clean(input)
  if (!c) return { ok: false, error: 'Pick a template first.' }
  const { error } = await (await createClient())
    .from('content_items')
    .update({ video_template: c.t.key, video_track: c.track, video_fields: c.fields })
    .eq('id', c.itemId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** A photo the render job may fetch: only our own Supabase storage. */
function ownPhoto(url: string): string | null {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.host === new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host ? url : null
  } catch {
    return null
  }
}

/** Save, then hand the job to GitHub Actions. The page polls checkVideo until it lands. */
export async function renderVideo(input: VideoSetup): Promise<Result<{ render: VideoRender }>> {
  await requireSection('social')
  const c = clean(input)
  if (!c) return { ok: false, error: 'Pick a template first.' }
  const missing = missingVideoFields(c.t, c.fields)
  if (missing.length) return { ok: false, error: `Fill in ${missing.join(', ')}.` }

  const token = process.env.GITHUB_RENDER_TOKEN?.trim()
  const repo = process.env.GITHUB_RENDER_REPO?.trim() || 'dnols23/Green-Hope-Lax'
  if (!token) return { ok: false, error: 'Rendering isn’t connected: set GITHUB_RENDER_TOKEN in Vercel, then redeploy.' }

  const supabase = await createClient()
  const { data: row } = await supabase.from('content_items').select('*').eq('id', c.itemId).maybeSingle()
  if (!row) return { ok: false, error: 'That video is gone.' }
  const item = readItem(row as Record<string, unknown>)
  if (item.video_status === 'rendering' && item.video_requested_at && Date.now() - Date.parse(item.video_requested_at) < 3 * 60 * 1000) {
    return { ok: false, error: 'A render is already running. Give it a couple of minutes.' }
  }

  const svc = createServiceClient()

  // Sound
  let audio: RenderJob['audio'] = null
  if (c.track === 'voiceover') {
    if (!item.vo_audio_url) return { ok: false, error: 'Generate the voiceover first (Audio, below), or pick another sound.' }
    const { data } = await svc.storage.from(AUDIO_BUCKET).createSignedUrl(item.vo_audio_url, 2 * 60 * 60)
    if (!data?.signedUrl) return { ok: false, error: 'Couldn’t reach the voiceover file.' }
    audio = { url: data.signedUrl }
  } else {
    const file = videoTrack(c.track)?.file
    audio = file ? { file } : null
  }

  // Photos
  const photos: Record<string, string> = {}
  for (const f of c.t.fields.filter((f) => f.kind === 'photo')) {
    const v = c.fields[f.key]
    if (!v) continue
    const url = ownPhoto(v)
    if (!url) return { ok: false, error: `${f.label}: upload the photo here instead of linking it.` }
    photos[f.key] = url
  }
  const fields = Object.fromEntries(Object.entries(c.fields).filter(([k]) => !(k in photos) && !c.t.fields.some((f) => f.key === k && f.kind === 'photo')))

  // Where the job drops the result
  const job = `${c.itemId}/render-${Date.now()}`
  const bucket = svc.storage.from(VIDEO_BUCKET)
  const [video, error] = await Promise.all([bucket.createSignedUploadUrl(`${job}.mp4`), bucket.createSignedUploadUrl(`${job}.error.txt`)])
  if (!video.data || !error.data) return { ok: false, error: `Couldn’t prepare the upload: ${(video.error ?? error.error)?.message ?? 'storage error'}` }

  const payload: RenderJob = {
    template: c.t.key,
    fields,
    photos,
    audio,
    upload: { video: video.data.signedUrl, error: error.data.signedUrl, apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
  }

  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: 'main', inputs: { job: JSON.stringify(payload), label: `${c.t.name}: ${item.title}`.slice(0, 120) } }),
  }).catch(() => null)
  if (!res) return { ok: false, error: 'Couldn’t reach GitHub. Try again.' }
  if (!res.ok) {
    const why =
      res.status === 401
        ? 'GitHub turned the token down. Make a new one and update GITHUB_RENDER_TOKEN in Vercel.'
        : res.status === 403 || res.status === 404
          ? 'The GitHub token can’t start the Render video workflow. It needs Actions: Read and write on the repo.'
          : `GitHub said ${res.status}.`
    return { ok: false, error: why }
  }

  const requestedAt = nowIso()
  await supabase
    .from('content_items')
    .update({
      video_template: c.t.key,
      video_track: c.track,
      video_fields: c.fields,
      video_status: 'rendering',
      video_job: job,
      video_error: null,
      video_requested_at: requestedAt,
    })
    .eq('id', c.itemId)
  revalidatePath('/admin/content', 'layout')
  return {
    ok: true,
    render: { status: 'rendering', error: null, requestedAt, play: null, download: null },
  }
}

/** Where the render stands now. */
export async function checkVideo(itemId: string): Promise<VideoRender | null> {
  await requireSection('social')
  const id = uuid(itemId)
  if (!id) return null
  const { data } = await (await createClient()).from('content_items').select('*').eq('id', id).maybeSingle()
  if (!data) return null
  const render = await settleVideo(readItem(data as Record<string, unknown>))
  if (render.status !== 'rendering') revalidatePath('/admin/content', 'layout')
  return render
}
