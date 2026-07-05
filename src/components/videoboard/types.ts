export type LibVideo = {
  id: number
  name: string
  url: string
  /** Probed after load — shown as a badge on the library chip. */
  duration?: number
}

export type Clip = {
  id: number
  name: string
  videoId: number
  start: number
  end: number
}

export const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const
