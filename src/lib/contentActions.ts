'use server'

// Changing the Content Studio. Every action checks the Instagram section first.
// The ElevenLabs key is read here, on the server, and never leaves it.

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireSection } from './permissions'
import { createClient, createServiceClient } from './supabase-server'
import {
  AUDIO_BUCKET,
  ELEVENLABS_MODEL_KEY,
  ELEVENLABS_VOICES_KEY,
  NEEDS_RELEASE,
  STATUS_LABELS,
  fillPlaceholders,
  fromEtInput,
  isFormat,
  isStatus,
  isVoMode,
  etTime,
  nowIso,
  readItem,
  readSeries,
  shotsFromText,
  voicesFromText,
  type ChecklistShot,
  type ContentStatus,
} from './content'
import { readVoiceSettings, signedAudio, type AudioLinks } from './contentData'

type Result = { ok: true } | { ok: false; error: string }

function refresh() {
  revalidatePath('/admin/content', 'layout')
}

const str = (v: unknown, max = 4000) => String(v ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max)
const optional = (v: unknown, max = 4000) => str(v, max) || null
const url = (v: unknown) => {
  const s = str(v, 1000)
  return /^https?:\/\//i.test(s) ? s : null
}
const count = (v: unknown) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.round(Number(v))))
const ymd = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) ? String(v) : null)
const uuid = (v: unknown) => (/^[0-9a-f-]{36}$/i.test(String(v ?? '')) ? String(v) : null)

/** The names of featured players with no media release on file. */
async function withoutRelease(ids: string[]): Promise<string[]> {
  if (!ids.length) return []
  const supabase = await createClient()
  const { data } = await supabase.from('players').select('id, name, media_cleared')
  return ((data ?? []) as { id: string; name: string; media_cleared: boolean | null }[])
    .filter((p) => ids.includes(String(p.id)) && p.media_cleared !== true)
    .map((p) => p.name)
}

function releaseError(status: ContentStatus, names: string[]): string {
  return `Can’t mark it ${STATUS_LABELS[status]}: no media release for ${names.join(', ')}. Clear them on Media Releases, or take them off this video.`
}

// ── Videos ──────────────────────────────────────────────────────────────────

/** A new video. From a series it starts with that series' shots, caption, hashtags and script. */
export async function createContentItem(formData: FormData) {
  await requireSection('social')
  const supabase = await createClient()
  const seriesId = uuid(formData.get('series_id'))
  let series = null
  if (seriesId) {
    const { data } = await supabase.from('content_series').select('*').eq('id', seriesId).maybeSingle()
    series = data ? readSeries(data as Record<string, unknown>) : null
  }
  const shootDate = ymd(formData.get('shoot_date'))
  const publishAt = fromEtInput(formData.get('publish_at'))
  const title =
    str(formData.get('title'), 200) ||
    [series?.name ?? 'New video', shootDate ? shootDate.slice(5).replace('-', '/') : null].filter(Boolean).join(' — ')
  const { data, error } = await supabase
    .from('content_items')
    .insert({
      series_id: series?.id ?? null,
      title,
      status: shootDate || publishAt ? 'planned' : 'idea',
      format: 'reel',
      shoot_date: shootDate,
      publish_at: publishAt,
      shot_checklist: (series?.shot_list ?? []).map((s) => ({ ...s, done: false })),
      caption: series?.caption_formula ?? null,
      hashtags: series?.default_hashtags ?? null,
      vo_script: series?.vo_template ?? null,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`Couldn’t add the video: ${error?.message ?? 'unknown error'}`)
  refresh()
  redirect(`/admin/content/${data.id}`)
}

/** The board's status dropdown. Saves on change. */
export async function setContentStatus(id: string, status: string): Promise<Result> {
  await requireSection('social')
  if (!isStatus(status)) return { ok: false, error: 'Unknown status.' }
  const supabase = await createClient()
  const { data } = await supabase.from('content_items').select('*').eq('id', id).maybeSingle()
  if (!data) return { ok: false, error: 'That video is gone.' }
  const item = readItem(data as Record<string, unknown>)
  if (NEEDS_RELEASE.includes(status)) {
    const missing = await withoutRelease(item.featured_player_ids)
    if (missing.length) return { ok: false, error: releaseError(status, missing) }
  }
  const { error } = await supabase
    .from('content_items')
    .update({ status, ...(status === 'posted' && !item.posted_at ? { posted_at: nowIso() } : {}) })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  refresh()
  return { ok: true }
}

export interface ContentItemInput {
  id: string
  title: string
  series_id: string | null
  status: string
  format: string
  shoot_date: string
  publish_at: string
  game_id: string | null
  drill_id: string | null
  featured_player_ids: string[]
  drive_folder_url: string
  canva_design_url: string
  final_video_url: string
  instagram_url: string
  audio_note: string
  caption: string
  hashtags: string
  vo_script: string
  vo_voice_id: string
  sfx_prompt: string
  views: string
  likes: string
  shares: string
  saves: string
  notes: string
}

/**
 * Everything on the video page. A picked drill or game fills its placeholders
 * in the caption and script; the filled text comes back so the page shows it.
 */
export async function saveContentItem(
  input: ContentItemInput,
): Promise<{ ok: true; caption: string | null; vo_script: string | null } | { ok: false; error: string }> {
  await requireSection('social')
  const supabase = await createClient()
  const { data: before } = await supabase.from('content_items').select('*').eq('id', input.id).maybeSingle()
  if (!before) return { ok: false, error: 'That video is gone.' }
  const was = readItem(before as Record<string, unknown>)
  const status = isStatus(input.status) ? input.status : was.status
  const featured = [...new Set((input.featured_player_ids ?? []).map(uuid).filter((x): x is string => !!x))]
  if (NEEDS_RELEASE.includes(status)) {
    const missing = await withoutRelease(featured)
    if (missing.length) return { ok: false, error: releaseError(status, missing) }
  }

  const gameId = uuid(input.game_id)
  const drillId = uuid(input.drill_id)
  const fills: Record<string, string | null> = {}
  if (drillId) {
    const { data: drill } = await createServiceClient().from('drills').select('name').eq('id', drillId).maybeSingle()
    fills['Drill name'] = (drill as { name?: string } | null)?.name ?? null
  }
  if (gameId) {
    const { data: game } = await supabase.from('games').select('opponent, game_date, location, home_away').eq('id', gameId).maybeSingle()
    const g = game as { opponent?: string; game_date?: string; location?: string | null; home_away?: string } | null
    if (g) {
      fills.Opponent = g.opponent ?? null
      fills.Time = g.game_date ? etTime(g.game_date) : null
      fills.Location = g.location || (g.home_away === 'home' ? 'Green Hope HS' : null)
    }
  }
  const caption = fillPlaceholders(optional(input.caption, 2200), fills)
  const voScript = fillPlaceholders(optional(input.vo_script, 5000), fills)

  const { error } = await supabase
    .from('content_items')
    .update({
      title: str(input.title, 200) || was.title,
      series_id: uuid(input.series_id),
      status,
      format: isFormat(input.format) ? input.format : was.format,
      shoot_date: ymd(input.shoot_date),
      publish_at: fromEtInput(input.publish_at),
      ...(status === 'posted' && !was.posted_at ? { posted_at: nowIso() } : {}),
      game_id: gameId,
      drill_id: drillId,
      featured_player_ids: featured,
      drive_folder_url: url(input.drive_folder_url),
      canva_design_url: url(input.canva_design_url),
      final_video_url: url(input.final_video_url),
      instagram_url: url(input.instagram_url),
      audio_note: optional(input.audio_note, 1000),
      caption,
      hashtags: optional(input.hashtags, 1000),
      vo_script: voScript,
      vo_voice_id: optional(input.vo_voice_id, 100),
      sfx_prompt: optional(input.sfx_prompt, 1000),
      views: count(input.views),
      likes: count(input.likes),
      shares: count(input.shares),
      saves: count(input.saves),
      notes: optional(input.notes),
    })
    .eq('id', input.id)
  if (error) return { ok: false, error: error.message }
  refresh()
  return { ok: true, caption, vo_script: voScript }
}

/** One shot ticked or unticked, saved straight away. */
export async function toggleContentShot(id: string, index: number, done: boolean): Promise<Result> {
  await requireSection('social')
  const supabase = await createClient()
  const { data } = await supabase.from('content_items').select('shot_checklist').eq('id', id).maybeSingle()
  if (!data) return { ok: false, error: 'That video is gone.' }
  const list = (Array.isArray(data.shot_checklist) ? data.shot_checklist : []) as ChecklistShot[]
  if (!list[index]) return { ok: false, error: 'That shot is gone.' }
  const next = list.map((s, i) => (i === index ? { ...s, done } : s))
  const { error } = await supabase.from('content_items').update({ shot_checklist: next }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  refresh()
  return { ok: true }
}

export async function deleteContentItem(id: string) {
  await requireSection('social')
  const supabase = await createClient()
  await supabase.from('content_items').delete().eq('id', id)
  refresh()
  redirect('/admin/content')
}

// ── Series ──────────────────────────────────────────────────────────────────

export async function saveContentSeries(formData: FormData) {
  await requireSection('social')
  const supabase = await createClient()
  const id = uuid(formData.get('id'))
  const name = str(formData.get('name'), 120)
  if (!name) return
  const slug =
    str(formData.get('slug'), 80)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') ||
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const color = str(formData.get('color'), 9)
  const row = {
    slug,
    name,
    purpose: optional(formData.get('purpose')),
    cadence: optional(formData.get('cadence'), 80),
    target_length_s: count(formData.get('target_length_s')),
    hook_formula: optional(formData.get('hook_formula')),
    shot_list: shotsFromText(String(formData.get('shot_list') ?? '')),
    canva_template_url: url(formData.get('canva_template_url')),
    caption_formula: optional(formData.get('caption_formula')),
    default_hashtags: optional(formData.get('default_hashtags'), 1000),
    color: /^#[0-9a-f]{6}$/i.test(color) ? color : '#1f4d2b',
    vo_mode: isVoMode(formData.get('vo_mode')) ? String(formData.get('vo_mode')) : 'none',
    vo_template: optional(formData.get('vo_template')),
    sort_order: count(formData.get('sort_order')) ?? 0,
    is_active: formData.get('is_active') !== 'false',
  }
  const { error } = id
    ? await supabase.from('content_series').update(row).eq('id', id)
    : await supabase.from('content_series').insert(row)
  if (error) throw new Error(`Couldn’t save the series: ${error.message}`)
  refresh()
}

// ── Media releases ──────────────────────────────────────────────────────────

export async function setMediaCleared(formData: FormData) {
  await requireSection('social')
  const id = uuid(formData.get('id'))
  if (!id) return
  const supabase = await createClient()
  await supabase.from('players').update({ media_cleared: formData.get('cleared') === 'true' }).eq('id', id)
  refresh()
}

// ── ElevenLabs ──────────────────────────────────────────────────────────────

export async function saveVoiceSettings(formData: FormData) {
  await requireSection('social')
  const voices = voicesFromText(String(formData.get('voices') ?? ''))
  const model = str(formData.get('model'), 80) || 'eleven_multilingual_v2'
  // app_settings has no policy for signed-in writes; the server key writes it.
  const svc = createServiceClient()
  await svc.from('app_settings').upsert(
    [
      { key: ELEVENLABS_VOICES_KEY, value: JSON.stringify(voices) },
      { key: ELEVENLABS_MODEL_KEY, value: model },
    ],
    { onConflict: 'key' },
  )
  refresh()
}

type AudioResult = { ok: true; links: AudioLinks } | { ok: false; error: string }

async function elevenLabs(path: string, body: Record<string, unknown>): Promise<ArrayBuffer | string> {
  const key = process.env.ELEVENLABS_API_KEY?.trim()
  if (!key) return 'ELEVENLABS_API_KEY isn’t set on the server. Add it in Vercel → Settings → Environment Variables.'
  const res = await fetch(`https://api.elevenlabs.io/v1/${path}`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) {
    const raw = await res.text().catch(() => '')
    let why = raw.slice(0, 300)
    try {
      const j = JSON.parse(raw) as { detail?: { message?: string } | string }
      why = typeof j.detail === 'string' ? j.detail : j.detail?.message ?? why
    } catch {}
    return `ElevenLabs said no (${res.status})${why ? `: ${why}` : ''}`
  }
  return res.arrayBuffer()
}

async function storeAudio(itemId: string, kind: 'vo' | 'sfx', audio: ArrayBuffer): Promise<string | { error: string }> {
  const path = `${itemId}/${kind}-${Date.now()}.mp3`
  const { error } = await (await createClient()).storage
    .from(AUDIO_BUCKET)
    .upload(path, new Uint8Array(audio), { contentType: 'audio/mpeg', upsert: false })
  return error ? { error: `Made the audio but couldn’t store it: ${error.message}` } : path
}

/** Read the script in the chosen voice; keep the mp3 with the video. */
export async function generateVoiceover(input: { itemId: string; text: string; voiceId: string }): Promise<AudioResult> {
  await requireSection('social')
  const itemId = uuid(input.itemId)
  const text = str(input.text, 5000)
  if (!itemId) return { ok: false, error: 'Save the video first.' }
  if (!text) return { ok: false, error: 'Write the script first.' }
  const settings = await readVoiceSettings()
  const voice = settings.voices.find((v) => v.id === input.voiceId)
  if (!voice) return { ok: false, error: 'Pick a voice. Add voices on Series & Voices.' }

  const audio = await elevenLabs(`text-to-speech/${encodeURIComponent(voice.id)}?output_format=mp3_44100_128`, {
    text,
    model_id: settings.model,
  })
  if (typeof audio === 'string') return { ok: false, error: audio }
  const path = await storeAudio(itemId, 'vo', audio)
  if (typeof path !== 'string') return { ok: false, error: path.error }

  await (await createClient())
    .from('content_items')
    .update({ vo_script: text, vo_voice_id: voice.id, vo_audio_url: path })
    .eq('id', itemId)
  refresh()
  const links = await signedAudio(path, `voiceover-${itemId.slice(0, 8)}.mp3`)
  return links ? { ok: true, links } : { ok: false, error: 'Saved, but couldn’t make a link to it. Reload the page.' }
}

/** A sound effect from a description, 0.5 to 22 seconds. */
export async function generateSfx(input: { itemId: string; prompt: string; seconds: number }): Promise<AudioResult> {
  await requireSection('social')
  const itemId = uuid(input.itemId)
  const prompt = str(input.prompt, 1000)
  if (!itemId) return { ok: false, error: 'Save the video first.' }
  if (!prompt) return { ok: false, error: 'Describe the sound first.' }
  const seconds = Math.min(22, Math.max(0.5, Number(input.seconds) || 3))

  const audio = await elevenLabs('sound-generation?output_format=mp3_44100_128', { text: prompt, duration_seconds: seconds })
  if (typeof audio === 'string') return { ok: false, error: audio }
  const path = await storeAudio(itemId, 'sfx', audio)
  if (typeof path !== 'string') return { ok: false, error: path.error }

  await (await createClient())
    .from('content_items')
    .update({ sfx_prompt: prompt, sfx_audio_url: path })
    .eq('id', itemId)
  refresh()
  const links = await signedAudio(path, `sfx-${itemId.slice(0, 8)}.mp3`)
  return links ? { ok: true, links } : { ok: false, error: 'Saved, but couldn’t make a link to it. Reload the page.' }
}
