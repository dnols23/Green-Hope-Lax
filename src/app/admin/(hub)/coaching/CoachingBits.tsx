'use client'
import { useEffect, useState } from 'react'
import type { Clip } from '@/lib/coachingBank'

/**
 * Which area an entry is filed under: one of the areas there are, or a new
 * one typed in. Plain select until he asks for a new one, so the usual case
 * is one tap on a phone.
 */
export function AreaField({ areas, value }: { areas: string[]; value: string }) {
  const [typing, setTyping] = useState(false)
  if (typing) {
    return (
      <div className="flex gap-2">
        <input name="area" required autoFocus maxLength={60} placeholder="e.g. Ground Balls" className="field" />
        <button type="button" onClick={() => setTyping(false)} className="btn btn-ghost !py-1.5 text-sm shrink-0">
          Cancel
        </button>
      </div>
    )
  }
  return (
    <select
      name="area"
      defaultValue={value}
      onChange={(e) => {
        if (e.target.value === '__new') setTyping(true)
      }}
      className="field"
    >
      {areas.map((a) => (
        <option key={a} value={a}>
          {a}
        </option>
      ))}
      <option value="__new">＋ New area…</option>
    </select>
  )
}

/**
 * The clip, played in place. Instagram's embed says how tall it wants to be
 * once it has loaded (the same message its own embed script listens for), so
 * a Reel shows whole rather than cut off or floating in white.
 */
export function ClipFrame({ clip, title }: { clip: Clip; title: string }) {
  const [height, setHeight] = useState<number | null>(null)
  useEffect(() => {
    if (clip.kind !== 'instagram') return
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== 'https://www.instagram.com') return
      try {
        const msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        const h = Number(msg?.details?.height)
        if (msg?.type === 'MEASURE' && h > 100 && h < 3000) setHeight(h)
      } catch {
        /* not one of Instagram's */
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [clip.kind])

  if (clip.kind === 'instagram') {
    return (
      <div className="w-full max-w-[360px] rounded-xl overflow-hidden border border-gray-200 bg-white">
        <iframe
          src={clip.src}
          title={title}
          loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture; clipboard-write"
          allowFullScreen
          scrolling="no"
          className="block w-full"
          style={{ height: height ?? 640, border: 0 }}
        />
      </div>
    )
  }
  return (
    <div
      className={`w-full rounded-xl overflow-hidden bg-black ${clip.tall ? 'max-w-[340px] aspect-[9/16]' : 'max-w-2xl aspect-video'}`}
    >
      <iframe
        src={clip.src}
        title={title}
        loading="lazy"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className="block w-full h-full"
        style={{ border: 0 }}
      />
    </div>
  )
}
