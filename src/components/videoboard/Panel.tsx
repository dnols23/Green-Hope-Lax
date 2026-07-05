'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type Hls from 'hls.js'
import styles from './VideoBoard.module.css'
import { ClipsDrawer } from './ClipsDrawer'
import {
  IconClose,
  IconExpand,
  IconFilm,
  IconFrame,
  IconPause,
  IconPlay,
  IconScissors,
  IconSkip,
  IconVolume,
} from './icons'
import { PLAYBACK_SPEEDS, type Clip, type LibVideo } from './types'
import { fmtDuration, fmtTime, shortName } from './utils'

const FRAME = 1 / 30 // one step of frame-by-frame review

export type PanelProps = {
  index: number
  videos: LibVideo[]
  clips: Clip[]
  isSource: boolean
  onSaveClip: (clip: { videoId: number; name: string; start: number; end: number }) => void
  onDeleteClip: (id: number) => void
  /** Add dropped files to the shared library; returns the created entries. */
  addFiles: (files: Iterable<File>) => LibVideo[]
  registerVideo: (index: number, el: HTMLVideoElement | null) => void
  onPlayingChange: (index: number, playing: boolean) => void
  notify: (msg: string) => void
}

export function Panel({
  index,
  videos,
  clips,
  isSource,
  onSaveClip,
  onDeleteClip,
  addFiles,
  registerVideo,
  onPlayingChange,
  notify,
}: PanelProps) {
  const [videoId, setVideoId] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [ctrlShow, setCtrlShow] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pseudoFs, setPseudoFs] = useState(false)
  const [nativeFs, setNativeFs] = useState(false)
  const [seekDragging, setSeekDragging] = useState(false)
  const [stageDrop, setStageDrop] = useState(false)
  const [markIn, setMarkIn] = useState<number | null>(null)
  const [markOut, setMarkOut] = useState<number | null>(null)
  const [clipName, setClipName] = useState('')

  const panelRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const seekRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const endWatcherRef = useRef<number | null>(null)
  const pendingClipRef = useRef<Clip | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hlsRef = useRef<Hls | null>(null)

  // Derived: a removed library video empties the panel (the <video> unmounts).
  const vid = videoId != null ? videos.find((v) => v.id === videoId) : undefined
  const loadedId = vid ? videoId : null

  // ── HLS attach for team-library film (Cloudflare Stream) ─────────────────
  // Safari plays HLS natively; everyone else gets hls.js, loaded on demand so
  // it never weighs down the page for local-file review. A 404/500 on the
  // manifest means Cloudflare is still transcoding a fresh upload — retry for
  // a couple of minutes before giving up.
  const vidId = vid?.id
  const vidUrl = vid?.url
  const vidHls = vid?.hls
  useEffect(() => {
    const video = videoRef.current
    if (!video || vidId == null || !vidUrl || !vidHls) return
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = vidUrl
    } else {
      import('hls.js').then(({ default: HlsMod }) => {
        if (cancelled) return
        if (!HlsMod.isSupported()) {
          video.src = vidUrl
          return
        }
        const hls = new HlsMod({ maxBufferLength: 30 })
        hlsRef.current = hls
        let processingTries = 0
        hls.on(HlsMod.Events.ERROR, (_evt, data) => {
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
                hls.loadSource(vidUrl)
                hls.startLoad()
              } catch {}
            }, 8000)
          } else if (data.type === HlsMod.ErrorTypes.MEDIA_ERROR) {
            try {
              hls.recoverMediaError()
            } catch {}
          } else {
            notify('Could not load this film — it may still be processing. Try again shortly.')
          }
        })
        hls.loadSource(vidUrl)
        hls.attachMedia(video)
      })
    }
    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [vidId, vidUrl, vidHls, notify])

  // ── Progress engine ───────────────────────────────────────────────────────
  // The seek bar and clock update via requestAnimationFrame writing straight
  // to the DOM — smooth 60fps progress with zero React re-renders, instead of
  // the choppy ~4Hz `timeupdate` the old board (and Practice Perfect) used.
  const syncProgress = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const dur = video.duration || 0
    const pct = dur ? (video.currentTime / dur) * 100 : 0
    if (fillRef.current) fillRef.current.style.width = pct + '%'
    if (handleRef.current) handleRef.current.style.left = pct + '%'
    if (timeRef.current) {
      timeRef.current.innerHTML = `<b>${fmtTime(video.currentTime)}</b> / ${fmtTime(dur)}`
    }
    if (endWatcherRef.current != null && video.currentTime >= endWatcherRef.current) {
      video.pause()
      endWatcherRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!playing) return
    let raf = 0
    const tick = () => {
      syncProgress()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, syncProgress])

  useEffect(() => () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
  }, [])

  // ── Basic controls ────────────────────────────────────────────────────────
  const showControls = useCallback(() => {
    const video = videoRef.current
    if (!video || !video.src) return
    setCtrlShow(true)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    if (!video.paused) hideTimerRef.current = setTimeout(() => setCtrlShow(false), 2600)
  }, [])

  function selectVideo(id: number | null) {
    setVideoId(id)
    setPlaying(false)
    setDuration(0)
    endWatcherRef.current = null
    pendingClipRef.current = null
    if (isSource) {
      setMarkIn(null)
      setMarkOut(null)
    }
  }

  function togglePlay() {
    const video = videoRef.current
    if (!video || loadedId == null) return
    if (video.paused) video.play()
    else video.pause()
  }

  const seekBy = useCallback(
    (secs: number) => {
      const video = videoRef.current
      if (!video) return
      const max = video.duration || Infinity
      video.currentTime = Math.min(max, Math.max(0, video.currentTime + secs))
      endWatcherRef.current = null
      syncProgress()
      showControls()
    },
    [syncProgress, showControls]
  )

  const stepFrame = useCallback(
    (dir: -1 | 1) => {
      const video = videoRef.current
      if (!video) return
      video.pause()
      seekBy(dir * FRAME)
    },
    [seekBy]
  )

  function changeSpeed(s: number) {
    setSpeed(s)
    if (videoRef.current) videoRef.current.playbackRate = s
  }

  function toggleMute() {
    setMuted((m) => {
      if (videoRef.current) videoRef.current.muted = !m
      return !m
    })
  }

  function changeVolume(v: number) {
    setVolume(v)
    if (videoRef.current) {
      videoRef.current.volume = v
      if (v > 0 && videoRef.current.muted) {
        videoRef.current.muted = false
        setMuted(false)
      }
    }
  }

  // ── Seek bar (pointer-driven, draggable) ─────────────────────────────────
  const seekToClientX = useCallback(
    (clientX: number) => {
      const video = videoRef.current
      const bar = seekRef.current
      if (!video || !bar || !video.duration) return
      const rect = bar.getBoundingClientRect()
      const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      video.currentTime = frac * video.duration
      endWatcherRef.current = null
      syncProgress()
    },
    [syncProgress]
  )

  // ── Clips ─────────────────────────────────────────────────────────────────
  function playClip(clip: Clip) {
    const target = videos.find((v) => v.id === clip.videoId)
    if (!target) {
      notify("That clip's video is no longer in the library.")
      return
    }
    if (loadedId !== target.id) {
      pendingClipRef.current = clip
      selectVideo(target.id)
    } else {
      const video = videoRef.current
      if (!video) return
      endWatcherRef.current = clip.end
      video.currentTime = clip.start
      video.play()
    }
  }

  const clipValid = markIn != null && markOut != null && markIn < markOut && loadedId != null

  function saveClip() {
    if (!clipValid) {
      if (loadedId == null) notify('Load a video first.')
      else if (markIn == null || markOut == null) notify('Set both In and Out points first.')
      else notify('The Out point must come after the In point.')
      return
    }
    onSaveClip({ videoId: loadedId!, name: clipName.trim() || 'Clip', start: markIn!, end: markOut! })
    setClipName('')
    setMarkIn(null)
    setMarkOut(null)
  }

  // ── Fullscreen (native, with pseudo fallback for iOS/mobile) ─────────────
  useEffect(() => {
    const onFsChange = () => setNativeFs(document.fullscreenElement === panelRef.current)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  useEffect(() => {
    if (!pseudoFs) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [pseudoFs])

  const toggleFullscreen = useCallback(() => {
    const el = panelRef.current
    if (!el) return
    if (pseudoFs) setPseudoFs(false)
    else if (document.fullscreenElement === el) document.exitFullscreen()
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => setPseudoFs(true))
    else setPseudoFs(true)
  }, [pseudoFs])

  const inFs = pseudoFs || nativeFs

  // ── Keyboard shortcuts (panel is focusable; keys act on the focused panel) ─
  function onKeyDown(e: React.KeyboardEvent) {
    const t = e.target as HTMLElement
    if (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') return
    const key = e.key.toLowerCase()
    let handled = true
    switch (key) {
      case ' ':
      case 'k': togglePlay(); break
      case 'j': seekBy(-10); break
      case 'l': seekBy(10); break
      case 'arrowleft': seekBy(-5); break
      case 'arrowright': seekBy(5); break
      case ',': stepFrame(-1); break
      case '.': stepFrame(1); break
      case 'm': toggleMute(); break
      case 'f': toggleFullscreen(); break
      case 'i': if (isSource) setMarkIn(videoRef.current?.currentTime ?? 0); else handled = false; break
      case 'o': if (isSource) setMarkOut(videoRef.current?.currentTime ?? 0); else handled = false; break
      default: handled = false
    }
    if (handled) {
      e.preventDefault()
      showControls()
    }
  }

  // ── Stage click: single = play/pause, double = fullscreen ────────────────
  function onStageClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest(`.${styles.controls}`)) return
    if (loadedId == null) return
    if (e.detail === 2) {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
      toggleFullscreen()
      return
    }
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
    clickTimerRef.current = setTimeout(() => {
      togglePlay()
      showControls()
    }, 200)
  }

  // ── Drag & drop onto the stage: library chips or raw files ───────────────
  function onStageDrop(e: React.DragEvent) {
    e.preventDefault()
    setStageDrop(false)
    const chipId = e.dataTransfer.getData('application/x-vb-video')
    if (chipId) {
      selectVideo(+chipId)
      return
    }
    const added = addFiles(Array.from(e.dataTransfer.files))
    if (added.length) selectVideo(added[0].id)
  }

  const rangeLeft = duration && markIn != null ? (markIn / duration) * 100 : null
  const rangeRight = duration && markOut != null ? (markOut / duration) * 100 : null

  return (
    <div
      ref={panelRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={`${styles.panel} ${pseudoFs ? styles.pseudoFs : ''}`}
    >
      {/* Header */}
      <div className={styles.panelHead}>
        <span className={styles.panelTitle}>
          Panel {index + 1}
          {isSource && <span className={styles.srcTag}>clip source</span>}
        </span>
        <select
          className={styles.videoSelect}
          value={loadedId ?? ''}
          onChange={(e) => selectVideo(e.target.value ? +e.target.value : null)}
        >
          <option value="">— select film —</option>
          {videos.map((v) => (
            <option key={v.id} value={v.id}>{shortName(v.name)}</option>
          ))}
        </select>
        <button
          type="button"
          className={styles.headBtn}
          title="Show / hide clips"
          onClick={() => setDrawerOpen((o) => !o)}
        >
          Clips <span className={styles.badge}>{clips.length > 0 ? clips.length : ''}</span>
        </button>
        <button
          type="button"
          className={styles.headBtn}
          title={inFs ? 'Exit fullscreen' : 'Fullscreen this panel (F)'}
          onClick={toggleFullscreen}
        >
          {inFs ? <IconClose size={13} /> : <IconExpand size={13} />}
        </button>
      </div>

      {/* Stage */}
      <div
        className={[
          styles.stage,
          vid && ctrlShow ? styles.ctrlShow : '',
          vid && !playing ? styles.stagePaused : '',
          stageDrop ? styles.stageDrop : '',
        ].join(' ')}
        onClick={onStageClick}
        onMouseMove={showControls}
        onMouseLeave={() => {
          if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
          if (videoRef.current && !videoRef.current.paused) setCtrlShow(false)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setStageDrop(true)
        }}
        onDragLeave={() => setStageDrop(false)}
        onDrop={onStageDrop}
      >
        {vid ? (
          <video
            key={vid.id}
            ref={(el) => {
              videoRef.current = el
              registerVideo(index, el)
            }}
            className={styles.video}
            src={vid.hls ? undefined : vid.url}
            preload="metadata"
            playsInline
            onPlay={() => {
              setPlaying(true)
              onPlayingChange(index, true)
              showControls()
            }}
            onPause={() => {
              setPlaying(false)
              onPlayingChange(index, false)
              setCtrlShow(true)
              syncProgress()
            }}
            onEnded={() => {
              endWatcherRef.current = null
            }}
            onLoadedMetadata={(e) => {
              const video = e.currentTarget
              setDuration(video.duration)
              video.playbackRate = speed
              video.volume = volume
              video.muted = muted
              syncProgress()
              const pending = pendingClipRef.current
              if (pending) {
                pendingClipRef.current = null
                endWatcherRef.current = pending.end
                video.currentTime = pending.start
                video.play()
              }
            }}
          />
        ) : (
          <div className={styles.emptyState}>
            <IconFilm size={40} />
            <div>
              {videos.length === 0
                ? 'Load game film with the button above,\nor drop video files anywhere.'
                : 'Choose film from the menu above,\nor drag a clip chip onto this panel.'}
            </div>
          </div>
        )}

        <div className={styles.centerBadge} aria-hidden="true">
          <IconPlay size={30} />
        </div>

        {/* Controls overlay */}
        <div className={styles.controls}>
          <div
            ref={seekRef}
            className={`${styles.seek} ${seekDragging ? styles.seekDragging : ''}`}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              setSeekDragging(true)
              seekToClientX(e.clientX)
            }}
            onPointerMove={(e) => {
              if (seekDragging) seekToClientX(e.clientX)
            }}
            onPointerUp={() => setSeekDragging(false)}
            onPointerCancel={() => setSeekDragging(false)}
          >
            <div className={styles.seekTrack}>
              <div ref={fillRef} className={styles.seekFill} />
              {/* Marked in/out region for the clip being built — above the fill */}
              {isSource && rangeLeft != null && rangeRight != null && rangeRight > rangeLeft && (
                <div
                  className={styles.seekRange}
                  style={{ left: `${rangeLeft}%`, width: `${rangeRight - rangeLeft}%` }}
                />
              )}
              {isSource && rangeLeft != null && rangeRight == null && (
                <div className={styles.seekRange} style={{ left: `${rangeLeft}%`, width: 2, borderRight: 'none' }} />
              )}
              {isSource && rangeRight != null && rangeLeft == null && (
                <div className={styles.seekRange} style={{ left: `${rangeRight}%`, width: 2, borderLeft: 'none' }} />
              )}
              <div ref={handleRef} className={styles.seekHandle} />
            </div>
          </div>

          <div className={styles.tRow}>
            <button type="button" className={styles.tBtn} title="Back 10s (J)" onClick={() => seekBy(-10)}>
              <IconSkip n={10} dir={-1} />
            </button>
            <button type="button" className={styles.tBtn} title="Back 5s (←)" onClick={() => seekBy(-5)}>
              <IconSkip n={5} dir={-1} size={17} />
            </button>
            <button type="button" className={`${styles.tBtn} ${styles.tPlay}`} title="Play / pause (Space)" onClick={togglePlay}>
              {playing ? <IconPause size={20} /> : <IconPlay size={20} />}
            </button>
            <button type="button" className={styles.tBtn} title="Forward 5s (→)" onClick={() => seekBy(5)}>
              <IconSkip n={5} dir={1} size={17} />
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
            <span ref={timeRef} className={styles.timeText}>
              <b>0:00</b> / {fmtTime(duration)}
            </span>
            <span className={styles.tSpacer} />
            <select
              className={styles.speedSel}
              title="Playback speed"
              value={speed}
              onChange={(e) => changeSpeed(+e.target.value)}
            >
              {PLAYBACK_SPEEDS.map((s) => (
                <option key={s} value={s}>{s === 1 ? '1×' : `${s}×`}</option>
              ))}
            </select>
            <div className={styles.volWrap}>
              <button type="button" className={styles.tBtn} title="Mute (M)" onClick={toggleMute}>
                <IconVolume size={17} muted={muted || volume === 0} />
              </button>
              <input
                className={styles.volSlider}
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={muted ? 0 : volume}
                onChange={(e) => changeVolume(+e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Clip creation bar — source panel only */}
      {isSource && (
        <div className={styles.clipBar}>
          <span className={styles.clipBarLabel}>
            <IconScissors size={14} /> Clip
          </span>
          <button
            type="button"
            className={styles.markBtn}
            title="Mark the clip start at the playhead (I)"
            onClick={() => setMarkIn(videoRef.current?.currentTime ?? 0)}
          >
            In {markIn != null && <em>{fmtTime(markIn)}</em>}
          </button>
          <button
            type="button"
            className={styles.markBtn}
            title="Mark the clip end at the playhead (O)"
            onClick={() => setMarkOut(videoRef.current?.currentTime ?? 0)}
          >
            Out {markOut != null && <em>{fmtTime(markOut)}</em>}
          </button>
          {clipValid && <span className={styles.clipDur}>{fmtDuration(markOut! - markIn!)}</span>}
          <input
            className={styles.clipNameInput}
            type="text"
            placeholder="Clip name…"
            maxLength={40}
            value={clipName}
            onChange={(e) => setClipName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveClip()
            }}
          />
          <button type="button" className={styles.saveBtn} disabled={!clipValid} onClick={saveClip}>
            Save Clip
          </button>
        </div>
      )}

      <ClipsDrawer
        open={drawerOpen}
        clips={clips}
        videos={videos}
        onClose={() => setDrawerOpen(false)}
        onPlay={playClip}
        onDelete={onDeleteClip}
      />
    </div>
  )
}
