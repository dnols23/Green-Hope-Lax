// Server-side helpers for the Film Room (video board cloud storage).
// Videos live on Cloudflare Stream; Supabase stores the shared library and
// clip records. Never import this into a client component.

import type { Clip, LibVideo } from '@/components/videoboard/types'
import { normCuts } from '@/components/videoboard/cuts'
import { isFilmType, type FilmGame } from '@/components/videoboard/filmMeta'
import { getViewer } from './permissions'
import { createClient } from './supabase-server'
import { isTeamRequest } from './teamAuth'

// Who's calling the film APIs?
//  - manage: a signed-in coach (any Supabase admin user) — can upload/delete
//    team film and manage shared clips.
//  - view: a coach OR anyone signed into the Team Hub — can watch the team
//    library and play its clips.
//  - edit: the head coach only — cuts and edits the film itself.
export async function getFilmAccess(req: {
  cookies: { get(name: string): { value: string } | undefined }
}): Promise<{ view: boolean; manage: boolean; edit: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) return { view: true, manage: true, edit: !!(await getViewer())?.isOwner }
  const team = await isTeamRequest(req)
  return { view: team, manage: false, edit: false }
}

export type CfConfig = {
  accountId: string
  apiToken: string
  customerCode: string
}

// All three env vars must be set for cloud film to be on; otherwise the board
// quietly runs in local, session-only mode.
export function getCfConfig(): CfConfig | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN
  const customerCode = process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE
  if (!accountId || !apiToken || !customerCode) return null
  return { accountId, apiToken, customerCode }
}

export function cfStreamApi(cf: CfConfig, path = ''): string {
  return `https://api.cloudflare.com/client/v4/accounts/${cf.accountId}/stream${path}`
}

export function filmHlsUrl(customerCode: string, uid: string): string {
  return `https://customer-${customerCode}.cloudflarestream.com/${uid}/manifest/video.m3u8`
}

export function filmThumbUrl(customerCode: string, uid: string): string {
  return `https://customer-${customerCode}.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg?height=270`
}

// ── Row → client shape mappers ───────────────────────────────────────────────

type VideoRow = {
  id: number
  uid: string
  name: string
  created_at?: string
  cuts?: unknown
  category?: unknown
  game_id?: string | null
  folder?: string | null
  notes?: string | null
}
type ClipRow = { id: number; video_id: number; name: string; start_time: number; end_time: number; created_at?: string }

export function mapVideoRow(row: VideoRow, customerCode: string): LibVideo {
  return {
    id: row.id,
    name: row.name,
    url: filmHlsUrl(customerCode, row.uid),
    thumb: filmThumbUrl(customerCode, row.uid),
    hls: true,
    remote: true,
    createdAt: row.created_at,
    cuts: normCuts(row.cuts),
    category: isFilmType(row.category) ? row.category : 'game',
    gameId: row.game_id ?? null,
    folder: row.folder ?? null,
    notes: row.notes ?? null,
  }
}

/** The columns mapVideoRow reads. */
export const VIDEO_COLUMNS = 'id, uid, name, created_at, cuts, category, game_id, folder, notes'

/** Boys' games on the schedule, newest first — for filing film under a game. */
export async function listFilmGames(sb: ReturnType<typeof import('./supabase-server').createServiceClient>): Promise<FilmGame[]> {
  const { data } = await sb
    .from('games')
    .select('id, game_date, opponent, home_away, level')
    .eq('gender', 'boys')
    .order('game_date', { ascending: false })
    .limit(300)
  return ((data ?? []) as Record<string, unknown>[]).map((g) => ({
    id: String(g.id),
    date: String(g.game_date ?? ''),
    opponent: String(g.opponent ?? ''),
    homeAway: g.home_away === 'away' || g.home_away === 'neutral' ? g.home_away : 'home',
    level: g.level === 'jv' ? 'jv' : 'varsity',
  }))
}

export function mapClipRow(row: ClipRow): Clip {
  return {
    id: row.id,
    name: row.name,
    videoId: row.video_id,
    start: row.start_time,
    end: row.end_time,
    remote: true,
    createdAt: row.created_at,
  }
}
