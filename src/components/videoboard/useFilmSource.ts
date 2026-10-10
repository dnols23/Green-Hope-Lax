'use client'

import { useEffect, type RefObject } from 'react'
import type { LibVideo } from './types'

/**
 * HLS attach for team-library film (Cloudflare Stream).
 *
 * Safari plays HLS natively; everyone else gets hls.js, loaded on demand so it
 * never weighs down the page for local-file review. A 404/500 on the manifest
 * means Cloudflare is still transcoding a fresh upload (or cutting a new
 * piece) — retry for a couple of minutes before giving up.
 */
export function useFilmSource(
  videoRef: RefObject<HTMLVideoElement | null>,
  vid: LibVideo | undefined,
  notify: (msg: string) => void
) {
  const vidId = vid?.id
  const vidUrl = vid?.url
  const vidHls = vid?.hls
  useEffect(() => {
    const video = videoRef.current
    if (!video || vidId == null || !vidUrl || !vidHls) return
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let hls: import('hls.js').default | null = null
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = vidUrl
    } else {
      import('hls.js').then(({ default: HlsMod }) => {
        if (cancelled) return
        if (!HlsMod.isSupported()) {
          video.src = vidUrl
          return
        }
        const h = new HlsMod({ maxBufferLength: 30 })
        hls = h
        let processingTries = 0
        h.on(HlsMod.Events.ERROR, (_evt, data) => {
          if (!data?.fatal) return
          const code = data.response?.code ?? 0
          const stillProcessing =
            data.type === HlsMod.ErrorTypes.NETWORK_ERROR &&
            (code === 404 || code === 500 || data.details === 'manifestLoadError')
          if (stillProcessing && processingTries < 20) {
            processingTries++
            notify('Cloudflare is still processing this film — retrying…')
            retryTimer = setTimeout(() => {
              try {
                h.loadSource(vidUrl)
                h.startLoad()
              } catch {}
            }, 8000)
          } else if (data.type === HlsMod.ErrorTypes.MEDIA_ERROR) {
            try {
              h.recoverMediaError()
            } catch {}
          } else {
            notify('Could not load this film — it may still be processing. Try again shortly.')
          }
        })
        h.loadSource(vidUrl)
        h.attachMedia(video)
      })
    }
    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      if (hls) hls.destroy()
    }
  }, [videoRef, vidId, vidUrl, vidHls, notify])
}
