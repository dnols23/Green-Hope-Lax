// Server-side helpers for the Film Room (video board cloud storage).
// Videos live on Cloudflare Stream; Supabase stores the shared library and
// clip records. Never import this into a client component.

import type { Clip, LibVideo } from '@/components/videoboard/types'

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
