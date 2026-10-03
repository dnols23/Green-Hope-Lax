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
  readVoices,
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
  media_cleared: boolean
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
  const { data } = await supabase.from('players').select('id, name, number, team, is_active, media_cleared').order('name')
  return ((data ?? []) as Record<string, unknown>[]).map((p) => ({
    id: String(p.id),
    name: String(p.name ?? ''),
    number: p.number == null || p.number === '' ? null : String(p.number),
    team: String(p.team ?? ''),
    is_active: p.is_active !== false,
    media_cleared: p.media_cleared === true,
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
}

export async function listGameOptions(): Promise<GameOption[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('games').select('id, opponent, game_date, location, home_away').order('game_date')
  return ((data ?? []) as Record<string, unknown>[]).map((g) => ({
    id: String(g.id),
    opponent: String(g.opponent ?? ''),
    game_date: String(g.game_date ?? ''),
    location: (g.location as string) ?? null,
    home_away: (g.home_away as string) ?? null,
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
