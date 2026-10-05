'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { shrinkImage, uploadImage } from '@/lib/uploadImage'
import { checkVideo, renderVideo, saveVideoSetup } from '@/lib/videoActions'
import {
  VIDEO_TEMPLATES,
  VIDEO_TRACKS,
  cleanVideoFields,
  composeVideo,
  videoTemplate,
  type VideoField,
  type VideoTemplate,
} from '@/lib/videoTemplates'
import type { ContentItem } from '@/lib/content'
import type { AudioLinks, ContentPlayer, GameOption, VideoRender } from '@/lib/contentData'

const ET = 'America/New_York'

/** "Fri · Mar 13 · 7:00 PM" in Eastern time. */
function gameWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const part = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: ET, ...o }).format(d)
  const time = part({ hour: 'numeric', minute: '2-digit' })
  const midnight = /^12:00\s?AM$/i.test(time)
  return [part({ weekday: 'short' }), part({ month: 'short', day: 'numeric' }), midnight ? '' : time].filter(Boolean).join(' · ')
}

const classOf = (y: string | null) => (!y ? '' : /^\d{4}$/.test(y.trim()) ? `Class of ${y.trim()}` : y.trim())

/** Answers we can fill in from the video's game or featured player. */
function prefill(key: string, game: GameOption | null, player: ContentPlayer | null): Record<string, string> {
  const level = game?.level && /jv/i.test(game.level) ? 'JV' : 'Varsity'
  if (key === 'game-day' && game)
    return {
      level,
      vs: game.home_away === 'away' ? 'at' : 'vs',
      opponent: game.opponent,
      when: gameWhen(game.game_date),
      where: game.location ?? '',
    }
  if (key === 'final-score' && game)
    return {
      level,
      opponent: game.opponent,
      ...(game.team_score != null ? { us: String(game.team_score) } : {}),
      ...(game.opp_score != null ? { them: String(game.opp_score) } : {}),
    }
  if (key === 'spotlight' && player)
    return {
      name: player.name,
      number: player.number ?? '',
      position: player.position ?? '',
      year: classOf(player.class_year),
      ...(player.photo_url ? { photo: player.photo_url } : {}),
    }
  if (key === 'commit' && player)
    return {
      name: player.name,
      detail: [player.number && `#${player.number}`, player.position, classOf(player.class_year)].filter(Boolean).join(' · '),
      ...(player.photo_url ? { photo: player.photo_url } : {}),
    }
  return {}
}

const textOnly = (t: VideoTemplate, fields: Record<string, string>) =>
  Object.fromEntries(Object.entries(fields).filter(([k]) => !t.fields.some((f) => f.key === k && f.kind === 'photo')))
const photosOf = (t: VideoTemplate, fields: Record<string, string>) =>
  Object.fromEntries(t.fields.filter((f) => f.kind === 'photo').map((f) => [f.key, fields[f.key] ?? '']))

export function VideoPanel({
  item,
  game,
  player,
  voAudio,
  initialRender,
}: {
  item: ContentItem
  game: GameOption | null
  player: ContentPlayer | null
  voAudio: AudioLinks | null
  initialRender: VideoRender
}) {
  const [key, setKey] = useState<string | null>(item.video_template)
  const t = videoTemplate(key)
  const [fields, setFields] = useState<Record<string, string>>(() => (t ? cleanVideoFields(t, item.video_fields) : {}))
  const [track, setTrack] = useState<string>(item.video_track ?? t?.tracks[0] ?? 'riff')
  const [render, setRender] = useState<VideoRender>(initialRender)
  const [busy, setBusy] = useState<'render' | 'save' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function pick(next: VideoTemplate) {
    setKey(next.key)
    setFields(cleanVideoFields(next, next.key === item.video_template ? item.video_fields : prefill(next.key, game, player)))
    setTrack(next.key === item.video_template && item.video_track ? item.video_track : next.tracks[0])
    setError(null)
  }

  const setField = (k: string, v: string) => {
    setFields((x) => ({ ...x, [k]: v }))
    setSaved(false)
  }

  // While a render runs, ask every 10 seconds whether it has landed.
  useEffect(() => {
    if (render.status !== 'rendering') return
    const timer = setInterval(async () => {
      const r = await checkVideo(item.id)
      if (r && r.status !== 'rendering') setRender(r)
    }, 10000)
    return () => clearInterval(timer)
  }, [render.status, item.id])

  async function go() {
    if (!t) return
    setBusy('render')
    setError(null)
    const r = await renderVideo({ itemId: item.id, template: t.key, track, fields })
    if (r.ok) setRender((x) => ({ ...r.render, play: x.play, download: x.download }))
    else setError(r.error)
    setBusy(null)
  }

  async function save() {
    if (!t) return
    setBusy('save')
    setError(null)
    const r = await saveVideoSetup({ itemId: item.id, template: t.key, track, fields })
    if (r.ok) setSaved(true)
    else setError(r.error)
    setBusy(null)
  }

  const fill = t ? prefill(t.key, game, player) : {}
  const canFill = Object.keys(fill).length > 0

  return (
    <section className="card p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-bold text-gray-700">Make the video</h2>
        <span className="text-xs text-gray-400">Pick a template, fill it in, render. About 2 minutes.</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {VIDEO_TEMPLATES.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => pick(x)}
            className={`text-left rounded-lg border px-3 py-2 transition ${
              x.key === key ? 'border-[var(--gh-green)] bg-[var(--gh-green)]/5 ring-1 ring-[var(--gh-green)]' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <span className="block text-sm font-bold text-gray-800">{x.name}</span>
            <span className="block text-xs text-gray-500 leading-snug">{x.blurb}</span>
          </button>
        ))}
      </div>

      {t && (
        <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,240px)] gap-4 items-start">
          <div className="space-y-3 min-w-0">
            {canFill && (
              <button
                type="button"
                onClick={() => {
                  setFields((x) => cleanVideoFields(t, { ...x, ...fill }))
                  setSaved(false)
                }}
                className="text-sm font-bold text-[var(--gh-green)]"
              >
                ↻ Fill in from this video’s {t.key === 'spotlight' || t.key === 'commit' ? 'featured player' : 'game'}
              </button>
            )}
            {t.fields.map((f) => (
              <Field key={f.key} field={f} value={fields[f.key] ?? ''} onChange={(v) => setField(f.key, v)} />
            ))}
            <div>
              <label className="field-label">Sound</label>
              <select value={track} onChange={(e) => setTrack(e.target.value)} className="field">
                {VIDEO_TRACKS.filter((x) => t.tracks.includes(x.key)).map((x) => (
                  <option key={x.key} value={x.key}>
                    {x.label}
                    {x.key === 'voiceover' && !voAudio ? ' (generate it below first)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Preview t={t} fields={fields} track={track} voAudio={voAudio} />
        </div>
      )}

      {t && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={go}
            disabled={!!busy || render.status === 'rendering'}
            className="btn btn-primary disabled:opacity-60"
          >
            {busy === 'render' ? 'Starting…' : render.status === 'rendering' ? 'Rendering…' : render.play ? 'Render again' : '🎬 Render video'}
          </button>
          <button type="button" onClick={save} disabled={!!busy} className="btn btn-ghost disabled:opacity-60">
            {busy === 'save' ? 'Saving…' : saved ? 'Saved' : 'Save for later'}
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm font-semibold text-red-700" role="alert">
          {error}
        </p>
      )}

      {render.status === 'rendering' && (
        <p className="text-sm rounded-lg border border-[var(--gh-green)]/30 bg-[var(--gh-green)]/5 px-3 py-2 text-gray-700" role="status">
          <span className="inline-block animate-pulse mr-1">●</span>
          Rendering on GitHub. It usually takes 1–3 minutes, and this updates by itself.
        </p>
      )}
      {render.status === 'failed' && render.error && (
        <p className="text-sm rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800" role="alert">
          The last render failed: {render.error}
        </p>
      )}
      {render.play && (
        <div className="space-y-2">
          <video key={render.play} src={render.play} controls playsInline preload="metadata" className="w-full max-w-[280px] rounded-lg bg-black aspect-[9/16]" />
          <div className="flex gap-4 flex-wrap text-sm font-bold">
            {render.download && (
              <a href={render.download} className="text-[var(--gh-green)]">
                Download MP4
              </a>
            )}
            <a href={render.play} target="_blank" rel="noopener noreferrer" className="text-[var(--gh-green)]">
              Open full screen ↗
            </a>
          </div>
          <p className="text-xs text-gray-500">On iPhone: open it full screen, tap Share, then Save Video.</p>
        </div>
      )}
    </section>
  )
}

function Field({ field: f, value, onChange }: { field: VideoField; value: string; onChange: (v: string) => void }) {
  if (f.kind === 'photo') return <PhotoField field={f} value={value} onChange={onChange} />
  return (
    <div>
      <label className="field-label">
        {f.label}
        {f.required && <span className="text-red-600"> *</span>}
      </label>
      {f.kind === 'select' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className="field">
          {f.options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : f.kind === 'lines' ? (
        <textarea rows={f.rows ?? 3} value={value} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} className="field" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} maxLength={f.max} placeholder={f.placeholder} className="field" />
      )}
      {f.hint && <p className="text-xs text-gray-400 mt-1">{f.hint}</p>}
    </div>
  )
}

function PhotoField({ field: f, value, onChange }: { field: VideoField; value: string; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError('')
    const blob = await shrinkImage(file).catch(() => file)
    const r = await uploadImage(blob, 'video', `photo.${(blob.type || 'image/jpeg').split('/')[1] ?? 'jpg'}`)
    if (r.url) onChange(r.url)
    else setError(r.error ?? 'The upload did not go through.')
    setBusy(false)
    if (input.current) input.current.value = ''
  }

  return (
    <div>
      <label className="field-label">{f.label}</label>
      <div className="flex items-center gap-3">
        {value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="w-14 h-20 rounded-md object-cover border border-gray-200 shrink-0" />
        )}
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="btn btn-ghost">
          {busy ? 'Uploading…' : value ? 'Replace' : 'Choose a photo'}
        </button>
        {value && !busy && (
          <button type="button" onClick={() => onChange('')} className="text-sm font-semibold text-[var(--gh-maroon)]">
            Remove
          </button>
        )}
        <input ref={input} type="file" accept="image/*" onChange={onPick} className="hidden" />
      </div>
      {error ? <p className="text-sm text-red-700 mt-1">{error}</p> : f.hint && <p className="text-xs text-gray-400 mt-1">{f.hint}</p>}
    </div>
  )
}

type Timeline = { seek: (t: number) => void; pause: () => void }

/** The template itself, live in the page: the same HTML the renderer captures. */
function Preview({
  t,
  fields,
  track,
  voAudio,
}: {
  t: VideoTemplate
  fields: Record<string, string>
  track: string
  voAudio: AudioLinks | null
}) {
  const [html, setHtml] = useState<Record<string, string>>({})
  const [doc, setDoc] = useState('')
  const [width, setWidth] = useState(240)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const raf = useRef(0)
  const still = t.seconds * 0.6

  useEffect(() => {
    if (html[t.key] != null) return
    let live = true
    fetch(`/video/${t.key}.html`)
      .then((r) => r.text())
      .then((h) => live && setHtml((x) => ({ ...x, [t.key]: h })))
    return () => {
      live = false
    }
  }, [t.key, html])

  // Rebuild the page a moment after typing stops.
  useEffect(() => {
    const src = html[t.key]
    if (src == null) return
    const timer = setTimeout(
      () => setDoc(composeVideo(src, { fields: textOnly(t, fields), photos: photosOf(t, fields), audio: null, seconds: t.seconds, base: '/video/' })),
      350,
    )
    return () => clearTimeout(timer)
  }, [html, t, fields])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const timeline = useCallback((): Timeline | null => {
    const w = frame.current?.contentWindow as (Window & { __timelines?: Record<string, Timeline> }) | null
    return w?.__timelines?.main ?? null
  }, [])

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current)
    audio.current?.pause()
    setPlaying(false)
  }, [])

  useEffect(() => stop, [stop])

  function seek(s: number) {
    setTime(s)
    timeline()?.seek(s)
  }

  function play() {
    const tl = timeline()
    if (!tl) return
    stop()
    const src = track === 'voiceover' ? voAudio?.play : VIDEO_TRACKS.find((x) => x.key === track)?.file
    const a = src ? new Audio(track === 'voiceover' ? src : `/video/${src}`) : null
    audio.current = a
    const startedAt = performance.now()
    if (a) {
      a.volume = 0.95
      void a.play().catch(() => {})
    }
    setPlaying(true)
    const tick = () => {
      const s = a && !a.paused && a.currentTime > 0 ? a.currentTime : (performance.now() - startedAt) / 1000
      if (a && s > t.seconds - 0.8) a.volume = Math.max(0, ((t.seconds - s) / 0.8) * 0.95)
      if (s >= t.seconds) {
        tl.seek(t.seconds)
        setTime(t.seconds)
        stop()
        return
      }
      tl.seek(s)
      setTime(s)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }

  const scale = width / 1080
  return (
    <div className="space-y-2 w-full max-w-[240px] mx-auto md:mx-0">
      <div ref={box} className="relative w-full overflow-hidden rounded-lg bg-black" style={{ height: 1920 * scale }}>
        {doc && (
          <iframe
            ref={frame}
            title="Preview"
            srcDoc={doc}
            onLoad={() => {
              // a fresh page after an edit: stop, and show the moment where everything is on screen
              stop()
              setTime(still)
              timeline()?.seek(still)
            }}
            className="absolute left-0 top-0 border-0 pointer-events-none"
            style={{ width: 1080, height: 1920, transform: `scale(${scale})`, transformOrigin: '0 0' }}
          />
        )}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={playing ? stop : play} className="btn btn-ghost !px-3 !py-1.5 text-sm" aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? '❚❚' : '▶'}
        </button>
        <input
          type="range"
          min={0}
          max={t.seconds}
          step={0.05}
          value={time}
          onChange={(e) => {
            stop()
            seek(Number(e.target.value))
          }}
          className="flex-1 accent-[var(--gh-green)]"
          aria-label="Scrub"
        />
        <span className="text-xs tabular-nums text-gray-500 w-9 text-right">{time.toFixed(1)}s</span>
      </div>
      <p className="text-xs text-gray-400">Preview. The rendered MP4 is sharper.</p>
    </div>
  )
}
