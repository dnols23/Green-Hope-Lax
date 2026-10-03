// The Instagram Content Studio: @ghlacrosse Reels, planned and produced.
//
// Pure — types, the readers for what the database sends back, and the time
// helpers. Every date and time here is Cary time (America/New_York): a post
// "Sunday at 7" is 7pm Eastern whatever the server's clock says.

import { zonedToUtc, ymdOf, hmOf, addDaysYmd } from './zoned'
import { TEAM_TIME_ZONE } from './format'

export const CONTENT_STATUSES = ['idea', 'planned', 'shot', 'editing', 'ready', 'posted', 'skipped'] as const
export type ContentStatus = (typeof CONTENT_STATUSES)[number]

export const STATUS_LABELS: Record<ContentStatus, string> = {
  idea: 'Idea',
  planned: 'Planned',
  shot: 'Shot',
  editing: 'Editing',
  ready: 'Ready',
  posted: 'Posted',
  skipped: 'Skipped',
}

export const CONTENT_FORMATS = ['reel', 'story', 'carousel_video', 'live'] as const
export type ContentFormat = (typeof CONTENT_FORMATS)[number]

export const FORMAT_LABELS: Record<ContentFormat, string> = {
  reel: 'Reel',
  story: 'Story',
  carousel_video: 'Carousel video',
  live: 'Live',
}

export const VO_MODES = ['none', 'narration', 'announcer', 'sfx_only'] as const
export type VoMode = (typeof VO_MODES)[number]

export const VO_MODE_LABELS: Record<VoMode, string> = {
  none: 'No voice',
  narration: 'Narration',
  announcer: 'Announcer',
  sfx_only: 'Sound effects only',
}

export const SNIPPET_KINDS = ['hook', 'cta', 'signoff', 'hashtags'] as const
export type SnippetKind = (typeof SNIPPET_KINDS)[number]

/** Statuses a video can't reach while anyone in it lacks a media release. */
export const NEEDS_RELEASE: ContentStatus[] = ['ready', 'posted']

/** Instagram's caption limit, hashtags included. */
export const CAPTION_LIMIT = 2200

export const ELEVENLABS_VOICES_KEY = 'elevenlabs_voices'
export const ELEVENLABS_MODEL_KEY = 'elevenlabs_model'
export const DEFAULT_ELEVENLABS_MODEL = 'eleven_multilingual_v2'
export const AUDIO_BUCKET = 'content-audio'

export const isStatus = (v: unknown): v is ContentStatus => CONTENT_STATUSES.includes(v as ContentStatus)
export const isFormat = (v: unknown): v is ContentFormat => CONTENT_FORMATS.includes(v as ContentFormat)
export const isVoMode = (v: unknown): v is VoMode => VO_MODES.includes(v as VoMode)

export interface Shot {
  shot: string
  secs: number
}

export interface ChecklistShot extends Shot {
  done: boolean
}

export interface ContentSeries {
  id: string
  slug: string
  name: string
  purpose: string | null
  cadence: string | null
  target_length_s: number | null
  hook_formula: string | null
  shot_list: Shot[]
  canva_template_url: string | null
  caption_formula: string | null
  default_hashtags: string | null
  color: string
  vo_mode: VoMode
  vo_template: string | null
  sort_order: number
  is_active: boolean
}

export interface ContentItem {
  id: string
  series_id: string | null
  title: string
  status: ContentStatus
  format: ContentFormat
  shoot_date: string | null
  publish_at: string | null
  posted_at: string | null
  game_id: string | null
  calendar_event_id: string | null
  drill_id: string | null
  featured_player_ids: string[]
  shot_checklist: ChecklistShot[]
  drive_folder_url: string | null
  canva_design_url: string | null
  final_video_url: string | null
  audio_note: string | null
  vo_script: string | null
  vo_voice_id: string | null
  vo_audio_url: string | null
  sfx_prompt: string | null
  sfx_audio_url: string | null
  caption: string | null
  hashtags: string | null
  instagram_url: string | null
  views: number | null
  likes: number | null
  shares: number | null
  saves: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CaptionSnippet {
  id: string
  kind: SnippetKind
  label: string
  body: string
}

export interface Voice {
  label: string
  id: string
}

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null)
const int = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Math.round(Number(v)))

/**
 * Text as it was typed. The seeded formulas were stored with the two
 * characters "\n" where a line break belongs; read them as the break.
 */
export const unescapeLines = (v: string | null) => (v == null ? null : v.replace(/\\n/g, '\n'))

function readShots(raw: unknown): Shot[] {
  return (Array.isArray(raw) ? raw : [])
    .map((s) => (s ?? {}) as Record<string, unknown>)
    .filter((s) => typeof s.shot === 'string' && s.shot.trim())
    .map((s) => ({ shot: String(s.shot).trim(), secs: Math.max(0, int(s.secs) ?? 0) }))
}

export function readSeries(row: Record<string, unknown>): ContentSeries {
  return {
    id: String(row.id),
    slug: String(row.slug ?? ''),
    name: String(row.name ?? ''),
    purpose: text(row.purpose),
    cadence: text(row.cadence),
    target_length_s: int(row.target_length_s),
    hook_formula: text(row.hook_formula),
    shot_list: readShots(row.shot_list),
    canva_template_url: text(row.canva_template_url),
    caption_formula: unescapeLines(text(row.caption_formula)),
    default_hashtags: text(row.default_hashtags),
    color: typeof row.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(row.color) ? row.color : '#1f4d2b',
    vo_mode: isVoMode(row.vo_mode) ? row.vo_mode : 'none',
    vo_template: unescapeLines(text(row.vo_template)),
    sort_order: int(row.sort_order) ?? 0,
    is_active: row.is_active !== false,
  }
}

export function readItem(row: Record<string, unknown>): ContentItem {
  return {
    id: String(row.id),
    series_id: text(row.series_id),
    title: String(row.title ?? ''),
    status: isStatus(row.status) ? row.status : 'idea',
    format: isFormat(row.format) ? row.format : 'reel',
    shoot_date: text(row.shoot_date)?.slice(0, 10) ?? null,
    publish_at: text(row.publish_at),
    posted_at: text(row.posted_at),
    game_id: text(row.game_id),
    calendar_event_id: text(row.calendar_event_id),
    drill_id: text(row.drill_id),
    featured_player_ids: Array.isArray(row.featured_player_ids) ? row.featured_player_ids.map(String) : [],
    shot_checklist: readShots(row.shot_checklist).map((s, i) => ({
      ...s,
      done: ((Array.isArray(row.shot_checklist) ? row.shot_checklist[i] : null) as { done?: unknown } | null)?.done === true,
    })),
    drive_folder_url: text(row.drive_folder_url),
    canva_design_url: text(row.canva_design_url),
    final_video_url: text(row.final_video_url),
    audio_note: text(row.audio_note),
    vo_script: unescapeLines(text(row.vo_script)),
    vo_voice_id: text(row.vo_voice_id),
    vo_audio_url: text(row.vo_audio_url),
    sfx_prompt: text(row.sfx_prompt),
    sfx_audio_url: text(row.sfx_audio_url),
    caption: unescapeLines(text(row.caption)),
    hashtags: text(row.hashtags),
    instagram_url: text(row.instagram_url),
    views: int(row.views),
    likes: int(row.likes),
    shares: int(row.shares),
    saves: int(row.saves),
    notes: text(row.notes),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}

export function readSnippet(row: Record<string, unknown>): CaptionSnippet {
  return {
    id: String(row.id),
    kind: SNIPPET_KINDS.includes(row.kind as SnippetKind) ? (row.kind as SnippetKind) : 'cta',
    label: String(row.label ?? ''),
    body: String(row.body ?? ''),
  }
}

// ── Shot lists ──────────────────────────────────────────────────────────────

/** "secs | shot", one per line — how a series' shot list is edited. */
export const shotsToText = (shots: Shot[]) => shots.map((s) => `${s.secs} | ${s.shot}`).join('\n')

export function shotsFromText(raw: string): Shot[] {
  return String(raw ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = /^(\d+(?:\.\d+)?)\s*s?\s*\|\s*(.+)$/.exec(line)
      return m ? { secs: Math.round(Number(m[1])), shot: m[2].trim() } : { secs: 0, shot: line.replace(/^\|\s*/, '') }
    })
    .filter((s) => s.shot)
}

export const shotsTotal = (shots: Shot[]) => shots.reduce((n, s) => n + s.secs, 0)

// ── Placeholders ────────────────────────────────────────────────────────────

/** Every [Placeholder] still waiting to be filled in. */
export function unfilledPlaceholders(...texts: (string | null | undefined)[]): string[] {
  const found = new Set<string>()
  for (const t of texts) for (const m of String(t ?? '').matchAll(/\[([^\][\n]{1,40})\]/g)) found.add(`[${m[1]}]`)
  return [...found]
}

/** Fill the named placeholders that have a value; leave the rest for the coach. */
export function fillPlaceholders(body: string | null, values: Record<string, string | null | undefined>): string | null {
  if (body == null) return null
  let out = body
  for (const [key, value] of Object.entries(values)) {
    if (!value) continue
    out = out.split(`[${key}]`).join(value)
  }
  return out
}

/** The caption as posted: caption, a blank line, the hashtags. */
export const fullCaption = (caption: string | null, hashtags: string | null) =>
  [caption?.trim(), hashtags?.trim()].filter(Boolean).join('\n\n')

// ── Voices ──────────────────────────────────────────────────────────────────

export function readVoices(raw: unknown): Voice[] {
  let list: unknown = raw
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw)
    } catch {
      list = []
    }
  }
  return (Array.isArray(list) ? list : [])
    .map((v) => (v ?? {}) as Record<string, unknown>)
    .filter((v) => typeof v.id === 'string' && v.id.trim())
    .map((v) => ({ id: String(v.id).trim(), label: String(v.label ?? v.id).trim() }))
}

/** "Label | voice_id" lines, the way the voice list is edited. */
export function voicesFromText(raw: string): Voice[] {
  return String(raw ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [a, b] = l.split('|').map((x) => x.trim())
      return b ? { label: a || b, id: b } : { label: a, id: a }
    })
    .filter((v) => /^[A-Za-z0-9_-]{4,64}$/.test(v.id))
}

export const voicesToText = (voices: Voice[]) => voices.map((v) => `${v.label} | ${v.id}`).join('\n')

// ── Time, in Cary ───────────────────────────────────────────────────────────

/** Today's date in Cary. A function, so a page never reads the clock while it renders. */
export const etToday = (): string => ymdOf(new Date())

/** Right now, as an ISO instant. */
export const nowIso = (): string => new Date().toISOString()

/** An instant as the value a datetime-local box shows, in Eastern time. */
export const toEtInput = (iso: string | null) => (iso ? `${ymdOf(iso)}T${hmOf(iso)}` : '')

/** A datetime-local value, read as Eastern time, as an ISO instant. */
export function fromEtInput(v: unknown): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(String(v ?? ''))
  return m ? zonedToUtc(m[1], m[2]).toISOString() : null
}

export const etYmd = (iso: string) => ymdOf(iso)

/** "Thu Oct 8" for a calendar date. */
export function dayLabel(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** "Thu Oct 8, 7:00 PM" for an instant, in Cary. */
export function etLabel(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: TEAM_TIME_ZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** "7:00 PM" for an instant, in Cary. */
export function etTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { timeZone: TEAM_TIME_ZONE, hour: 'numeric', minute: '2-digit' })
}

/** Weekday of a calendar date, 0 = Sunday. */
export function weekdayOf(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/**
 * When footage shot on a day goes up: the first Thursday or Sunday at 7pm at
 * least two days later. Tuesday's shoot posts Thursday; Thursday's, Sunday.
 */
export function suggestedPost(shootYmd: string): string {
  let day = addDaysYmd(shootYmd, 2)
  while (![0, 4].includes(weekdayOf(day))) day = addDaysYmd(day, 1)
  return `${day}T19:00`
}

/** The weeks of a month as Sunday-first rows of dates; days outside the month are null. */
export function monthGrid(ym: string): (string | null)[][] {
  const [y, m] = ym.split('-').map(Number)
  const first = `${y}-${String(m).padStart(2, '0')}-01`
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const cells: (string | null)[] = Array(weekdayOf(first)).fill(null)
  for (let d = 0; d < days; d++) cells.push(addDaysYmd(first, d))
  while (cells.length % 7) cells.push(null)
  const rows: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  return rows
}

export const isMonth = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)

export function shiftMonth(ym: string, by: number): string {
  const [y, m] = ym.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1 + by, 1))
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' })
}
