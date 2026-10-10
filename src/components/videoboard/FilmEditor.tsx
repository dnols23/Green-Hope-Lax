'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styles from './VideoBoard.module.css'
import { IconClose, IconFrame, IconPause, IconPlay, IconScissors, IconSkip } from './icons'
import { PLAYBACK_SPEEDS, type LibVideo } from './types'
import { baseName, fmtDuration, fmtTime, shortName } from './utils'
import { addCut, cutTotal, keepRange, keptParts, normCuts, segmentsOf, skipFrom, type Cut } from './cuts'
import { useFilmSource } from './useFilmSource'

const FRAME = 1 / 30
const ZOOMS = [1, 2, 4, 8, 16, 32] as const
/** Seconds between ruler labels: the first that leaves room to read them. */
const RULER_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800]
const MAX_PARTS = 20

type Edit = { cuts: Cut[]; splits: number[] }

const EDIT_KEYS: Array<[string, string]> = [
  ['S', 'Split at the playhead'],
  ['Del', 'Cut / keep the piece under the playhead'],
  ['Q / W', 'Cut everything before / after'],
  ['I · O · X', 'Mark in, mark out, cut between'],
  ['⌘Z', 'Undo (⇧⌘Z redo)'],
  ['+ / −', 'Zoom the timeline'],
]

/**
 * The Film Room's edit mode — the head coach's alone.
 *
 * Split the film, cut the dead time out (between whistles, timeouts, the half),
 * trim the warm-up off the front. Saving keeps the film whole on Cloudflare and
 * stores the cuts, so everyone who plays it skips straight past them and the
 * edit can always be changed or undone. A game can also be broken into pieces
 * that become films of their own (a half each, a quarter each).
 */
export function FilmEditor({
  videos,
  initialId,
  onSaved,
  onExported,
  onClose,
  notify,
}: {
  /** Team film only — the edit is saved on the library row. */
  videos: LibVideo[]
  initialId: number | null
  onSaved: (video: LibVideo) => void
  onExported: (videos: LibVideo[]) => void
  onClose: () => void
  notify: (msg: string) => void
}) {
  const [filmId, setFilmId] = useState<number | null>(() =>
    initialId != null && videos.some((v) => v.id === initialId) ? initialId : videos[videos.length - 1]?.id ?? null
  )
  const vid = videos.find((v) => v.id === filmId)
  const saved = useMemo(() => vid?.cuts ?? [], [vid?.cuts])

  const [edit, setEdit] = useState<Edit>({ cuts: saved, splits: [] })
  const [past, setPast] = useState<Edit[]>([])
  const [future, setFuture] = useState<Edit[]>([])
  const [duration, setDuration] = useState(0)
  const [now, setNow] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [preview, setPreview] = useState(true)
  const [zoom, setZoom] = useState<number>(1)
  const [markIn, setMarkIn] = useState<number | null>(null)
  const [markOut, setMarkOut] = useState<number | null>(null)
  const [busy, setBusy] = useState<'save' | 'export' | null>(null)
  const [name, setName] = useState(vid?.name ?? '')
  const [width, setWidth] = useState(0)
  const [scrubbing, setScrubbing] = useState(false)
  const [keysOpen, setKeysOpen] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const clockRef = useRef<HTMLSpanElement>(null)
  const cutsRef = useRef<Cut[]>(edit.cuts)
  const previewRef = useRef(preview)

  useFilmSource(videoRef, vid, notify)

  useEffect(() => {
    cutsRef.current = edit.cuts
    previewRef.current = preview
  }, [edit.cuts, preview])

  /* The keys work the whole time the editor is open, wherever the focus was
     left (a button that just went disabled drops it on the page). The editor
     covers the board, so nothing else is listening. */
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // How wide the timeline is, for the thumbnails and the ruler.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const dirty = JSON.stringify(edit.cuts) !== JSON.stringify(saved)

  // ── Film ────────────────────────────────────────────────────────────────
  function pickFilm(id: number) {
    if (id === filmId) return
    if (dirty && !confirm('Switch film? Your unsaved edit on this one will be lost.')) return
    const next = videos.find((v) => v.id === id)
    setFilmId(id)
    setEdit({ cuts: next?.cuts ?? [], splits: [] })
    setPast([])
    setFuture([])
    setDuration(0)
    setNow(0)
    setPlaying(false)
    setMarkIn(null)
    setMarkOut(null)
    setName(next?.name ?? '')
  }

  async function patch(body: { name?: string; cuts?: Cut[] }): Promise<LibVideo | null> {
    if (!vid) return null
    try {
      const res = await fetch(`/api/film/${vid.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
      onSaved(j.video as LibVideo)
      return j.video as LibVideo
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not save.')
      return null
    }
  }

  async function saveName() {
    const next = name.trim()
    if (!vid || !next || next === vid.name) {
      setName(vid?.name ?? '')
      return
    }
    if (await patch({ name: next })) notify('Renamed')
  }

  async function save() {
    if (!dirty || busy) return
    setBusy('save')
    const ok = await patch({ cuts: edit.cuts })
    setBusy(null)
    if (ok) notify(edit.cuts.length ? 'Edit saved — everyone now plays it with the cuts skipped' : 'Edit cleared — the film plays whole again')
  }

  const parts = duration ? keptParts(duration, edit.cuts, edit.splits) : []
  const canExport = parts.length > 1 || (parts.length === 1 && edit.cuts.length > 0)

  async function exportParts() {
    if (!vid || !canExport || busy) return
    if (parts.length > MAX_PARTS) {
      notify(`At most ${MAX_PARTS} pieces at a time.`)
      return
    }
    const base = baseName(vid.name)
    const named = parts.map((p, i) => ({
      start: p.start,
      end: p.end,
      name: parts.length === 1 ? `${base} (cut)` : `${base} · ${i + 1} of ${parts.length}`,
    }))
    const what = parts.length === 1 ? 'one new film' : `${parts.length} new films, one for each kept piece`
    if (!confirm(`Make ${what}? The original stays as it is.`)) return
    setBusy('export')
    try {
      const res = await fetch(`/api/film/${vid.id}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parts: named }),
      })
      const j = await res.json()
      const made = (j.videos ?? []) as LibVideo[]
      if (made.length) onExported(made)
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
      notify(`${made.length} new film${made.length === 1 ? '' : 's'} in the library — ready to play in a minute or two`)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not make the new films.')
    } finally {
      setBusy(null)
    }
  }

  // ── Edit history ────────────────────────────────────────────────────────
  function change(fn: (e: Edit) => Edit) {
    const next = fn(edit)
    if (next === edit) return
    setPast([...past.slice(-99), edit])
    setFuture([])
    setEdit(next)
  }

  function undo() {
    const prev = past[past.length - 1]
    if (!prev) return
    setPast(past.slice(0, -1))
    setFuture([edit, ...future])
    setEdit(prev)
  }

  function redo() {
    const next = future[0]
    if (!next) return
    setFuture(future.slice(1))
    setPast([...past, edit])
    setEdit(next)
  }

  // ── Tools ───────────────────────────────────────────────────────────────
  const at = () => videoRef.current?.currentTime ?? now
  const segments = useMemo(() => segmentsOf(duration, edit.cuts, edit.splits), [duration, edit])
  const current = segments.find((s) => now >= s.start && now < s.end) ?? segments[segments.length - 1]

  function split() {
    const t = at()
    if (!duration || t < 0.2 || t > duration - 0.2) return
    change((e) => (e.splits.some((s) => Math.abs(s - t) < 0.1) ? e : { ...e, splits: [...e.splits, t] }))
  }

  function cutBefore() {
    const t = at()
    if (!duration || t < 0.2) return
    change((e) => ({ ...e, cuts: addCut(e.cuts, 0, t, duration) }))
  }

  function cutAfter() {
    const t = at()
    if (!duration || t > duration - 0.2) return
    change((e) => ({ ...e, cuts: addCut(e.cuts, t, duration, duration) }))
  }

  /** Cut the piece under the playhead, or put it back if it's cut. */
  function toggleCurrent() {
    const t = at()
    const seg = segments.find((s) => t >= s.start && t < s.end) ?? segments[segments.length - 1]
    if (!seg) return
    // Keep its edges as splits, so putting it back leaves the pieces as they were.
    const edges = [seg.start, seg.end].filter((x) => x > 0 && x < duration)
    change((e) => ({
      cuts: seg.cut ? keepRange(e.cuts, seg.start, seg.end, duration) : addCut(e.cuts, seg.start, seg.end, duration),
      splits: [...e.splits, ...edges.filter((x) => !e.splits.some((s) => Math.abs(s - x) < 0.01))],
    }))
  }

  const rangeOk = markIn != null && markOut != null && markOut - markIn >= 0.1
  function cutRange() {
    if (!rangeOk) {
      notify('Mark In (I) and Out (O) first.')
      return
    }
    change((e) => ({ ...e, cuts: addCut(e.cuts, markIn!, markOut!, duration) }))
    setMarkIn(null)
    setMarkOut(null)
  }

  function resetEdit() {
    if (!edit.cuts.length && !edit.splits.length) return
    change(() => ({ cuts: [], splits: [] }))
  }

  // ── Playback ────────────────────────────────────────────────────────────
  const syncHead = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const dur = video.duration || 0
    if (previewRef.current && !video.paused) {
      const to = skipFrom(cutsRef.current, video.currentTime)
      if (to != null) video.currentTime = dur && to >= dur - 0.05 ? dur : to
    }
    const pct = dur ? (video.currentTime / dur) * 100 : 0
    if (headRef.current) headRef.current.style.left = pct + '%'
    if (clockRef.current) clockRef.current.innerHTML = `<b>${fmtTime(video.currentTime)}</b> / ${fmtTime(dur)}`
    // Keep the playhead in view while it plays through a zoomed timeline.
    const sc = scrollRef.current
    const inner = innerRef.current
    if (sc && inner && !video.paused && inner.scrollWidth > sc.clientWidth) {
      const x = (pct / 100) * inner.scrollWidth
      if (x < sc.scrollLeft || x > sc.scrollLeft + sc.clientWidth - 24) sc.scrollLeft = x - sc.clientWidth * 0.2
    }
  }, [])

  useEffect(() => {
    if (!playing) return
    let raf = 0
    const tick = () => {
      syncHead()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, syncHead])

  function togglePlay() {
    const v = videoRef.current
    if (!v || !vid) return
    if (v.paused) void v.play()
    else v.pause()
  }

  function seekTo(t: number) {
    const v = videoRef.current
    if (!v || !duration) return
    v.currentTime = Math.min(duration, Math.max(0, t))
    setNow(v.currentTime)
    syncHead()
  }

  const seekBy = (s: number) => seekTo(at() + s)

  function stepFrame(dir: -1 | 1) {
    videoRef.current?.pause()
    seekBy(dir * FRAME)
  }

  function changeSpeed(s: number) {
    setSpeed(s)
    if (videoRef.current) videoRef.current.playbackRate = s
  }

  function zoomBy(dir: -1 | 1) {
    const i = ZOOMS.indexOf(zoom as (typeof ZOOMS)[number])
    const next = ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, i + dir))]
    if (next === zoom) return
    setZoom(next)
    // Zoom in on the playhead, not on the left edge.
    requestAnimationFrame(() => {
      const sc = scrollRef.current
      if (sc && duration) sc.scrollLeft = (at() / duration) * sc.scrollWidth - sc.clientWidth / 2
    })
  }

  // ── Timeline pointer: tap or drag to scrub ─────────────────────────────
  function scrubTo(clientX: number) {
    const inner = innerRef.current
    if (!inner || !duration) return
    const r = inner.getBoundingClientRect()
    seekTo(((clientX - r.left) / r.width) * duration)
  }

  function done() {
    if (dirty && !confirm('Leave edit mode without saving your edit?')) return
    onClose()
  }

  function onKeyDown(e: KeyboardEvent) {
    const t = e.target as HTMLElement
    if (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') return
    // Space on a focused button would press it as well as play.
    if (t.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return
    const key = e.key.toLowerCase()
    const mod = e.metaKey || e.ctrlKey
    let handled = true
    if (mod && key === 'z') {
      if (e.shiftKey) redo()
      else undo()
    } else if (mod && key === 'y') redo()
    else if (mod || e.altKey) handled = false
    else
      switch (key) {
        case ' ':
        case 'k': togglePlay(); break
        case 'j': seekBy(-10); break
        case 'l': seekBy(10); break
        case 'arrowleft': seekBy(e.shiftKey ? -1 : -5); break
        case 'arrowright': seekBy(e.shiftKey ? 1 : 5); break
        case ',': stepFrame(-1); break
        case '.': stepFrame(1); break
        case 's': split(); break
        case 'q': cutBefore(); break
        case 'w': cutAfter(); break
        case 'delete':
        case 'backspace': toggleCurrent(); break
        case 'i': setMarkIn(at()); break
        case 'o': setMarkOut(at()); break
        case 'x': cutRange(); break
        case '+':
        case '=': zoomBy(1); break
        case '-':
        case '_': zoomBy(-1); break
        case 'escape': done(); break
        default: handled = false
      }
    if (handled) e.preventDefault()
  }

  useEffect(() => {
    keyRef.current = onKeyDown
  })

  // ── Timeline drawing ────────────────────────────────────────────────────
  const innerPx = width * zoom
  const pct = (t: number) => (duration ? (t / duration) * 100 : 0)
  const thumbBase = vid?.thumb?.split('?')[0]
  const thumbCount = duration && thumbBase ? Math.min(240, Math.max(1, Math.ceil(innerPx / 96))) : 0
  const step = RULER_STEPS.find((s) => duration && (s / duration) * innerPx >= 64) ?? 3600
  const ticks = duration ? Array.from({ length: Math.floor(duration / step) + 1 }, (_, i) => i * step) : []
  const cutTime = cutTotal(edit.cuts)

  if (!vid) {
    return (
      <div className={styles.editor}>
        <div className={styles.editEmpty}>
          <IconScissors size={32} />
          <p>Upload film to the team library first — edit mode works on team film.</p>
          <button type="button" className={styles.iconBtn} onClick={onClose}>
            Back to the board
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.editor}>
      {/* ── Header: which film, its name, where the edit stands ── */}
      <div className={styles.editHead}>
        <span className={styles.editBadge}>
          <IconScissors size={13} /> Edit
        </span>
        <select
          className={styles.videoSelect}
          value={vid.id}
          onChange={(e) => pickFilm(+e.target.value)}
          aria-label="Film to edit"
        >
          {videos.map((v) => (
            <option key={v.id} value={v.id}>
              {shortName(baseName(v.name), 40)}
            </option>
          ))}
        </select>
        <input
          className={styles.editName}
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') {
              setName(vid.name)
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          aria-label="Film name"
          title="Rename the film"
        />
        <span className={styles.editSummary}>
          {duration > 0 &&
            (edit.cuts.length
              ? `${fmtTime(duration)} → ${fmtTime(duration - cutTime)} · ${edit.cuts.length} cut${edit.cuts.length === 1 ? '' : 's'}`
              : `${fmtTime(duration)} · no cuts`)}
          {dirty && <em> · unsaved</em>}
        </span>
        <span className={styles.tSpacer} />
        <div className={styles.toolGroup}>
          <button
            type="button"
            className={`${styles.iconBtn} ${keysOpen ? styles.iconBtnOn : ''}`}
            onClick={() => setKeysOpen((o) => !o)}
            title="Editing keys"
          >
            Keys
          </button>
          {keysOpen && (
            <div className={styles.shortcutsPop}>
              <div className={styles.shortcutsTitle}>Editing keys</div>
              {EDIT_KEYS.map(([k, label]) => (
                <div key={k} className={styles.shortcutRow}>
                  <span>{label}</span>
                  <span className={styles.kbd}>
                    <span>{k}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
          <button type="button" className={styles.iconBtn} onClick={done} title="Back to the board (Esc)">
            <IconClose size={12} /> Done
          </button>
        </div>
      </div>

      {/* ── The film ── */}
      <div className={styles.editStage} onClick={togglePlay}>
        <video
          key={vid.id}
          ref={videoRef}
          className={styles.video}
          src={vid.hls ? undefined : vid.url}
          preload="metadata"
          playsInline
          onPlay={() => setPlaying(true)}
          onPause={() => {
            setPlaying(false)
            setNow(videoRef.current?.currentTime ?? 0)
            syncHead()
          }}
          onSeeked={() => {
            setNow(videoRef.current?.currentTime ?? 0)
            syncHead()
          }}
          onTimeUpdate={() => setNow(videoRef.current?.currentTime ?? 0)}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget
            setDuration(v.duration)
            v.playbackRate = speed
            // The saved cuts, trimmed to the film's real length.
            setEdit((cur) => ({ ...cur, cuts: normCuts(cur.cuts, v.duration) }))
            syncHead()
          }}
        />
        {!playing && (
          <div className={styles.editPlayBadge} aria-hidden>
            <IconPlay size={30} />
          </div>
        )}
      </div>

      {/* ── Transport ── */}
      <div className={styles.editTransport}>
        <button type="button" className={styles.tBtn} title="Back 10s (J)" onClick={() => seekBy(-10)}>
          <IconSkip n={10} dir={-1} />
        </button>
        <button type="button" className={`${styles.tBtn} ${styles.tPlay}`} title="Play / pause (Space)" onClick={togglePlay}>
          {playing ? <IconPause size={20} /> : <IconPlay size={20} />}
        </button>
        <button type="button" className={styles.tBtn} title="Forward 10s (L)" onClick={() => seekBy(10)}>
          <IconSkip n={10} dir={1} />
        </button>
        <button type="button" className={styles.tBtn} title="Previous frame (,)" onClick={() => stepFrame(-1)}>
          <IconFrame dir={-1} />
        </button>
        <button type="button" className={styles.tBtn} title="Next frame (.)" onClick={() => stepFrame(1)}>
          <IconFrame dir={1} />
        </button>
        <span ref={clockRef} className={styles.timeText}>
          <b>{fmtTime(now)}</b> / {fmtTime(duration)}
        </span>
        <span className={styles.tSpacer} />
        <label className={styles.editCheck} title="Play the film as edited, skipping the cuts">
          <input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} /> Skip cuts
        </label>
        <select className={styles.speedSel} value={speed} onChange={(e) => changeSpeed(+e.target.value)} title="Playback speed">
          {PLAYBACK_SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s === 1 ? '1×' : `${s}×`}
            </option>
          ))}
        </select>
        <div className={styles.segmented} title="Zoom the timeline">
          <button type="button" className={styles.segBtn} onClick={() => zoomBy(-1)} disabled={zoom === 1} aria-label="Zoom out">
            −
          </button>
          <span className={styles.zoomLabel}>{zoom}×</span>
          <button type="button" className={styles.segBtn} onClick={() => zoomBy(1)} disabled={zoom === 32} aria-label="Zoom in">
            +
          </button>
        </div>
      </div>

      {/* ── Timeline ── */}
      <div ref={scrollRef} className={styles.tlScroll}>
        <div
          ref={innerRef}
          className={`${styles.tlInner} ${scrubbing ? styles.tlScrubbing : ''}`}
          style={{ width: `${zoom * 100}%` }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            setScrubbing(true)
            scrubTo(e.clientX)
          }}
          onPointerMove={(e) => {
            if (scrubbing) scrubTo(e.clientX)
          }}
          onPointerUp={() => setScrubbing(false)}
          onPointerCancel={() => setScrubbing(false)}
        >
          <div className={styles.tlRuler}>
            {ticks.map((t) => (
              <span key={t} style={{ left: `${pct(t)}%` }}>
                {fmtTime(t)}
              </span>
            ))}
          </div>
          <div className={styles.tlTrack}>
            {thumbBase &&
              Array.from({ length: thumbCount }, (_, i) => {
                const t = Math.floor(((i + 0.5) * duration) / thumbCount)
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`${thumbCount}-${i}`}
                    src={`${thumbBase}?time=${t}s&height=56`}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    className={styles.tlThumb}
                    style={{ left: `${(i / thumbCount) * 100}%`, width: `${100 / thumbCount}%` }}
                  />
                )
              })}
            {segments.map((s) => (
              <div
                key={`${s.start}-${s.end}`}
                className={[
                  styles.tlSeg,
                  s.cut ? styles.tlSegCut : '',
                  current && s.start === current.start ? styles.tlSegOn : '',
                ].join(' ')}
                style={{ left: `${pct(s.start)}%`, width: `${pct(s.end - s.start)}%` }}
              />
            ))}
            {edit.splits.map((s) => (
              <div key={s} className={styles.tlSplit} style={{ left: `${pct(s)}%` }} />
            ))}
            {markIn != null && (
              <div
                className={styles.tlMark}
                style={{
                  left: `${pct(markIn)}%`,
                  width: markOut != null && markOut > markIn ? `${pct(markOut - markIn)}%` : 2,
                }}
              />
            )}
            {markOut != null && markIn == null && <div className={styles.tlMark} style={{ left: `${pct(markOut)}%`, width: 2 }} />}
          </div>
          <div ref={headRef} className={styles.tlHead} />
        </div>
      </div>

      {/* ── Tools ── */}
      <div className={styles.editTools}>
        <button type="button" className={styles.editTool} onClick={split} title="Split the film at the playhead (S)">
          <IconScissors size={13} /> Split
        </button>
        <button
          type="button"
          className={`${styles.editTool} ${current?.cut ? styles.editToolKeep : styles.editToolCut}`}
          onClick={toggleCurrent}
          title="Cut the piece under the playhead, or put it back (Delete)"
        >
          {current?.cut ? 'Keep this piece' : 'Cut this piece'}
        </button>
        <button type="button" className={styles.editTool} onClick={cutBefore} title="Cut everything before the playhead (Q)">
          ⇤ Cut before
        </button>
        <button type="button" className={styles.editTool} onClick={cutAfter} title="Cut everything after the playhead (W)">
          Cut after ⇥
        </button>
        <span className={styles.editDivider} aria-hidden />
        <button type="button" className={styles.markBtn} onClick={() => setMarkIn(at())} title="Mark In at the playhead (I)">
          In {markIn != null && <em>{fmtTime(markIn)}</em>}
        </button>
        <button type="button" className={styles.markBtn} onClick={() => setMarkOut(at())} title="Mark Out at the playhead (O)">
          Out {markOut != null && <em>{fmtTime(markOut)}</em>}
        </button>
        <button
          type="button"
          className={`${styles.editTool} ${styles.editToolCut}`}
          onClick={cutRange}
          disabled={!rangeOk}
          title="Cut from In to Out (X)"
        >
          Cut In→Out {rangeOk && <em>{fmtDuration(markOut! - markIn!)}</em>}
        </button>
        <span className={styles.editDivider} aria-hidden />
        <button type="button" className={styles.editTool} onClick={undo} disabled={!past.length} title="Undo (⌘Z)">
          ↶
        </button>
        <button type="button" className={styles.editTool} onClick={redo} disabled={!future.length} title="Redo (⇧⌘Z)">
          ↷
        </button>
        <button
          type="button"
          className={styles.editTool}
          onClick={resetEdit}
          disabled={!edit.cuts.length && !edit.splits.length}
          title="Take every cut and split out"
        >
          Reset
        </button>
        <span className={styles.tSpacer} />
        <button
          type="button"
          className={styles.editTool}
          onClick={exportParts}
          disabled={!canExport || !!busy}
          title="Each kept piece becomes its own film in the library. The original stays."
        >
          {busy === 'export'
            ? 'Making films…'
            : canExport
              ? `Make ${parts.length} new film${parts.length === 1 ? '' : 's'}`
              : 'Make new films'}
        </button>
        <button type="button" className={styles.saveBtn} onClick={save} disabled={!dirty || !!busy}>
          {busy === 'save' ? 'Saving…' : 'Save edit'}
        </button>
      </div>
    </div>
  )
}
