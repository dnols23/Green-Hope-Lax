// Reading the Content Studio. Server only; every page calls requireSection('social')
// before any of these.

import { createClient, createServiceClient } from './supabase-server'
import {
  AUDIO_BUCKET,
  DEFAULT_ELEVENLABS_MODEL,
  ELEVENLABS_MODEL_KEY,
  ELEVENLABS_VOICES_KEY,
  readItem,
  readSeries,
  readSnippet,
  nowIso,
  readVoices,
  VIDEO_BUCKET,
  type ContentItem,
  type ContentSeries,
  type CaptionSnippet,
  type Voice,
} from './content'

export interface ContentPlayer {
  id: string
  name: string
  number: string | null
  team: string
  is_active: boolean
  position: string | null
  class_year: string | null
  photo_url: string | null
}

export async function listSeries(): Promise<ContentSeries[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('content_series').select('*').order('sort_order').order('name')
  return ((data ?? []) as Record<string, unknown>[]).map(readSeries)
}

export async function listItems(): Promise<ContentItem[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('content_items').select('*').order('publish_at', { ascending: true, nullsFirst: false })
  return ((data ?? []) as Record<string, unknown>[]).map(readItem)
}

export async function getItem(id: string): Promise<ContentItem | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const supabase = await createClient()
  const { data } = await supabase.from('content_items').select('*').eq('id', id).maybeSingle()
  return data ? readItem(data as Record<string, unknown>) : null
}

export async function listSnippets(): Promise<CaptionSnippet[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('caption_snippets').select('*').order('kind').order('label')
  return ((data ?? []) as Record<string, unknown>[]).map(readSnippet)
}

export async function listContentPlayers(): Promise<ContentPlayer[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('players').select('id, name, number, team, is_active, position, class_year, photo_url').order('name')
  return ((data ?? []) as Record<string, unknown>[]).map((p) => ({
    id: String(p.id),
    name: String(p.name ?? ''),
    number: p.number == null || p.number === '' ? null : String(p.number),
    team: String(p.team ?? ''),
    is_active: p.is_active !== false,
    position: (p.position as string) || null,
    class_year: (p.class_year as string) || null,
    photo_url: (p.photo_url as string) || null,
  }))
}

/** Practices from the calendar, between two instants. calendar_events has no
 *  policy for signed-in reads, so this goes through the server's own key. */
export async function listPractices(fromIso: string, toIso: string): Promise<{ id: string; title: string; starts_at: string; location: string | null }[]> {
  const { data } = await createServiceClient()
    .from('calendar_events')
    .select('id, title, starts_at, location, kind')
    .eq('kind', 'practice')
    .gte('starts_at', fromIso)
    .lt('starts_at', toIso)
    .order('starts_at')
  return ((data ?? []) as Record<string, unknown>[]).map((e) => ({
    id: String(e.id),
    title: String(e.title ?? 'Practice'),
    starts_at: String(e.starts_at),
    location: (e.location as string) ?? null,
  }))
}

export interface GameOption {
  id: string
  opponent: string
  game_date: string
  location: string | null
  home_away: string | null
  level: string | null
  team_score: number | null
  opp_score: number | null
}

export async function listGameOptions(): Promise<GameOption[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('games').select('id, opponent, game_date, location, home_away, level, team_score, opp_score').order('game_date')
  return ((data ?? []) as Record<string, unknown>[]).map((g) => ({
    id: String(g.id),
    opponent: String(g.opponent ?? ''),
    game_date: String(g.game_date ?? ''),
    location: (g.location as string) ?? null,
    home_away: (g.home_away as string) ?? null,
    level: (g.level as string) ?? null,
    team_score: typeof g.team_score === 'number' ? g.team_score : null,
    opp_score: typeof g.opp_score === 'number' ? g.opp_score : null,
  }))
}

/** The drill bank's names, for the drill picker. */
export async function listDrillOptions(): Promise<{ id: string; name: string }[]> {
  const { data } = await createServiceClient().from('drills').select('id, name').order('name')
  return ((data ?? []) as { id: string; name: string }[]).map((d) => ({ id: String(d.id), name: String(d.name ?? '') }))
}

export interface VoiceSettings {
  voices: Voice[]
  model: string
  keySet: boolean
}

export async function readVoiceSettings(): Promise<VoiceSettings> {
  const svc = createServiceClient()
  const read = async (key: string) => {
    const { data } = await svc.from('app_settings').select('value').eq('key', key).maybeSingle()
    return (data as { value?: unknown } | null)?.value
  }
  const [voices, model] = await Promise.all([read(ELEVENLABS_VOICES_KEY), read(ELEVENLABS_MODEL_KEY)])
  return {
    voices: readVoices(voices),
    model: typeof model === 'string' && model.trim() ? model.trim() : DEFAULT_ELEVENLABS_MODEL,
    keySet: !!process.env.ELEVENLABS_API_KEY?.trim(),
  }
}

export interface AudioLinks {
  play: string
  download: string
}

/** Short-lived links to a file in the private audio bucket: one to play, one to save. */
export async function signedAudio(path: string | null, name: string): Promise<AudioLinks | null> {
  if (!path) return null
  const bucket = (await createClient()).storage.from(AUDIO_BUCKET)
  const [play, download] = await Promise.all([
    bucket.createSignedUrl(path, 60 * 60),
    bucket.createSignedUrl(path, 60 * 60, { download: name }),
  ])
  if (!play.data?.signedUrl || !download.data?.signedUrl) return null
  return { play: play.data.signedUrl, download: download.data.signedUrl }
}

export interface VideoRender {
  status: ContentItem['video_status']
  error: string | null
  requestedAt: string | null
  play: string | null
  download: string | null
}

/** Give up on a render that has said nothing for this long. */
const RENDER_TIMEOUT_MS = 25 * 60 * 1000

/** Where the item's template video stands. A render in progress is settled
 *  here: the job uploads either the mp4 or an error note beside it. */
export async function settleVideo(item: ContentItem): Promise<VideoRender> {
  let { video_status: status, video_error: error, video_path: path } = item
  if (status === 'rendering' && item.video_job) {
    const bucket = createServiceClient().storage.from(VIDEO_BUCKET)
    const [folder, name] = [item.video_job.split('/')[0], item.video_job.split('/').slice(1).join('/')]
    const { data } = await bucket.list(folder, { search: name })
    const files = (data ?? []).map((f) => f.name)
    const patch: Record<string, unknown> = {}
    if (files.includes(`${name}.mp4`)) {
      status = 'ready'
      path = `${item.video_job}.mp4`
      error = null
      Object.assign(patch, { video_status: status, video_path: path, video_error: null })
    } else if (files.includes(`${name}.error.txt`)) {
      const { data: blob } = await bucket.download(`${item.video_job}.error.txt`)
      status = 'failed'
      error = ((await blob?.text()) ?? '').trim().slice(0, 600) || 'The render failed.'
      Object.assign(patch, { video_status: status, video_error: error })
    } else if (item.video_requested_at && Date.parse(nowIso()) - Date.parse(item.video_requested_at) > RENDER_TIMEOUT_MS) {
      status = 'failed'
      error = 'The render never finished. Check the Render video run on GitHub, then try again.'
      Object.assign(patch, { video_status: status, video_error: error })
    }
    if (Object.keys(patch).length) await (await createClient()).from('content_items').update(patch).eq('id', item.id)
  }

  let play: string | null = null
  let download: string | null = null
  if (path) {
    const bucket = createServiceClient().storage.from(VIDEO_BUCKET)
    const name = `${(item.title || 'video').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'video'}.mp4`
    const [p, d] = await Promise.all([bucket.createSignedUrl(path, 60 * 60), bucket.createSignedUrl(path, 60 * 60, { download: name })])
    play = p.data?.signedUrl ?? null
    download = d.data?.signedUrl ?? null
  }
  return { status, error, requestedAt: item.video_requested_at, play, download }
}
