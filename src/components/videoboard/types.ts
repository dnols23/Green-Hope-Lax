export type LibVideo = {
  /** Positive = team library row id (Supabase); negative = local session file. */
  id: number
  name: string
  /** Object URL for local files, Cloudflare HLS manifest URL for team film. */
  url: string
  /** True when `url` is an HLS manifest that needs hls.js (or native Safari HLS). */
  hls?: boolean
  /** True when this video lives in the shared team library. */
  remote?: boolean
  /** Probed after load — shown as a badge on the library chip. */
  duration?: number
}

export type Clip = {
  /** Positive = team library row id (Supabase); negative = local session clip. */
  id: number
  name: string
  videoId: number
  start: number
  end: number
  remote?: boolean
}

export const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const
