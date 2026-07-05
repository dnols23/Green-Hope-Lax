// Server-side helpers for the Film Room (video board cloud storage).
// Videos live on Cloudflare Stream; Supabase stores the shared library and
// clip records. Never import this into a client component.

import type { Clip, LibVideo } from '@/components/videoboard/types'
import { createClient } from './supabase-server'
import { isTeamRequest } from './teamAuth'

// Who's calling the film APIs?
//  - manage: a signed-in coach (any Supabase admin user) — can upload/delete
//    team film and manage shared clips.
//  - view: a coach OR anyone signed into the Team Hub — can watch the team
//    library and play its clips.
export async function getFilmAccess(req: {
  cookies: { get(name: string): { value: string } | undefined }
}): Promise<{ view: boolean; manage: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) return { view: true, manage: true }
  const team = await isTeamRequest(req)
  return { view: team, manage: false }
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

// ── Row → client shape mappers ───────────────────────────────────────────────

type VideoRow = { id: number; uid: string; name: string }
type ClipRow = { id: number; video_id: number; name: string; start_time: number; end_time: number }

export function mapVideoRow(row: VideoRow, customerCode: string): LibVideo {
  return {
    id: row.id,
    name: row.name,
    url: filmHlsUrl(customerCode, row.uid),
    hls: true,
    remote: true,
  }
}

export function mapClipRow(row: ClipRow): Clip {
  return {
    id: row.id,
    name: row.name,
    videoId: row.video_id,
    start: row.start_time,
    end: row.end_time,
    remote: true,
  }
}
