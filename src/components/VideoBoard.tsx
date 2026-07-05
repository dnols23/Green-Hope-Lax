'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './VideoBoard.module.css'

// Film review board ported from Practice Perfect. Videos load as local object
// URLs and clips live in component state, so everything is session-only —
// nothing is uploaded or saved to a server.

export type LibVideo = { id: number; name: string; url: string }
export type Clip = { id: number; name: string; videoId: number; start: number; end: number }

function fmtTime(t: number | null | undefined): string {
  if (t == null || isNaN(t)) return '0:00'
  const m = Math.floor(t / 60)
  const s = String(Math.floor(t % 60)).padStart(2, '0')
  return `${m}:${s}`
}

function shortName(name: string, max = 22): string {
  return name.length > max ? name.slice(0, max - 1) + '…' : name
}

// ── Panel ──────────────────────────────────────────────────────────────────

type PanelProps = {
  index: number
  videos: LibVideo[]
  clips: Clip[]
  isSource: boolean
  onSaveClip: (clip: { videoId: number; name: string; start: number; end: number }) => void
  onDeleteClip: (id: number) => void
  notify: (msg: string) => void
}

function Panel({ index, videos, clips, isSource, onSaveClip, onDeleteClip, notify }: PanelProps) {
  const [videoId, setVideoId] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [curTime, setCurTime] = useState(0)
  const [volume, setVolume] = useState(1)
  const [ctrlShow, setCtrlShow] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pseudoFs, setPseudoFs] = useState(false)
  const [nativeFs, setNativeFs] = useState(false)
  const [markIn, setMarkIn] = useState<number | null>(null)
  const [markOut, setMarkOut] = useState<number | null>(null)
  const [clipName, setClipName] = useState('')

  const panelRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const endWatcherRef = useRef<number | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingClipRef = useRef<Clip | null>(null)

  // Derived: if the loaded video was removed from the library, the panel
  // behaves as empty (the <video> unmounts; selectVideo resets stale state).
  const vid = videoId != null ? videos.find((v) => v.id === videoId) : undefined
  const loadedId = vid ? videoId : null

  const showControls = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    setCtrlShow(true)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    if (!video.paused) {
      hideTimerRef.current = setTimeout(() => setCtrlShow(false), 2500)
    }
  }, [])

  useEffect(() => () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
  }, [])

  function selectVideo(id: number | null) {
    setVideoId(id)
    setPlaying(false)
    setDuration(0)
    setCurTime(0)
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

  function seekBy(secs: number) {
    const video = videoRef.current
    if (!video) return
    const max = video.duration || Infinity
    video.currentTime = Math.min(max, Math.max(0, video.currentTime + secs))
    showControls()
  }

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

  function saveClip() {
    if (markIn == null || markOut == null) {
      notify('Set both a Mark In and Mark Out point before saving.')
      return
    }
    if (markIn >= markOut) {
      notify('Mark Out must come after Mark In.')
      return
    }
    if (loadedId == null) {
      notify('No video loaded in Panel 1.')
      return
    }
    onSaveClip({ videoId: loadedId, name: clipName.trim() || 'Clip', start: markIn, end: markOut })
    setClipName('')
    setMarkIn(null)
    setMarkOut(null)
  }

  // Fullscreen with pseudo-fs fallback for iOS/mobile.
  useEffect(() => {
    function onFsChange() {
      setNativeFs(document.fullscreenElement === panelRef.current)
    }
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

  function toggleFullscreen() {
    const el = panelRef.current
    if (!el) return
    if (pseudoFs) {
      setPseudoFs(false)
    } else if (document.fullscreenElement === el) {
      document.exitFullscreen()
    } else if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => setPseudoFs(true))
    } else {
      setPseudoFs(true)
    }
  }

  const inFs = pseudoFs || nativeFs

  return (
    <div ref={panelRef} className={`${styles.panel} ${pseudoFs ? styles.pseudoFs : ''}`}>
      <div className={styles.panelHdr}>
        <span className={styles.panelNum}>
          Panel {index + 1}
          {isSource ? ' — Clip Source' : ''}
        </span>
        <select
          className={styles.videoSel}
          value={loadedId ?? ''}
          onChange={(e) => selectVideo(e.target.value ? +e.target.value : null)}
        >
          <option value="">— select video —</option>
          {videos.map((v) => (
            <option key={v.id} value={v.id}>
              {shortName(v.name)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.clipsToggleBtn}
          title="Show / hide clips"
          onClick={() => setDrawerOpen((o) => !o)}
        >
          Clips <span className={styles.clipsBadge}>{clips.length > 0 ? clips.length : ''}</span>
        </button>
        <button
          type="button"
          className={styles.fsBtn}
          title="Fullscreen this panel"
          onClick={toggleFullscreen}
        >
          {inFs ? '✕' : '⛶'}
        </button>
      </div>

      <div
        className={[
          styles.videoWrap,
          vid && ctrlShow ? styles.ctrlShow : '',
          vid && !playing ? styles.paused : '',
        ].join(' ')}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest(`.${styles.transport}`)) return
          togglePlay()
          showControls()
        }}
        onMouseMove={showControls}
        onMouseLeave={() => {
          if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
          if (videoRef.current && !videoRef.current.paused) setCtrlShow(false)
        }}
      >
        {vid ? (
          <video
            key={vid.id}
            ref={videoRef}
            className={styles.video}
            src={vid.url}
            preload="metadata"
            onPlay={() => {
              setPlaying(true)
              showControls()
            }}
            onPause={() => {
              setPlaying(false)
              setCtrlShow(true)
            }}
            onEnded={() => {
              endWatcherRef.current = null
            }}
            onLoadedMetadata={(e) => {
              setDuration(e.currentTarget.duration)
              const pending = pendingClipRef.current
              if (pending) {
                pendingClipRef.current = null
                endWatcherRef.current = pending.end
                e.currentTarget.currentTime = pending.start
                e.currentTarget.play()
              }
            }}
            onTimeUpdate={(e) => {
              const video = e.currentTarget
              setCurTime(video.currentTime)
              if (endWatcherRef.current != null && video.currentTime >= endWatcherRef.current) {
                video.pause()
                endWatcherRef.current = null
              }
            }}
          />
        ) : (
          <div className={styles.noVideo}>Upload a video above, then select it here.</div>
        )}
        <div className={styles.centerPlay} aria-hidden="true">▶</div>
        <div className={styles.transport}>
          <button type="button" className={styles.tBtn} title="Rewind 10s" onClick={(e) => { e.stopPropagation(); seekBy(-10) }}>⏪ 10s</button>
          <button type="button" className={styles.tBtn} title="Rewind 5s" onClick={(e) => { e.stopPropagation(); seekBy(-5) }}>⏪ 5s</button>
          <button type="button" className={`${styles.tBtn} ${styles.playBtn}`} title="Play / Pause" onClick={(e) => { e.stopPropagation(); togglePlay() }}>
            {playing ? '⏸' : '▶'}
          </button>
          <button type="button" className={styles.tBtn} title="Forward 5s" onClick={(e) => { e.stopPropagation(); seekBy(5) }}>5s ⏩</button>
          <button type="button" className={styles.tBtn} title="Forward 10s" onClick={(e) => { e.stopPropagation(); seekBy(10) }}>10s ⏩</button>
          <input
            className={styles.seek}
            type="range"
            min="0"
            max="100"
            step="0.01"
            value={duration ? (curTime / duration) * 100 : 0}
            onChange={(e) => {
              const video = videoRef.current
              if (video && video.duration) {
                video.currentTime = (+e.target.value / 100) * video.duration
                endWatcherRef.current = null
              }
            }}
          />
          <span className={styles.timeDisp}>{fmtTime(curTime)} / {fmtTime(duration)}</span>
          <input
            className={styles.vol}
            type="range"
            min="0"
            max="1"
            step="0.05"
            title="Volume"
            value={volume}
            onChange={(e) => {
              setVolume(+e.target.value)
              if (videoRef.current) videoRef.current.volume = +e.target.value
            }}
          />
        </div>
      </div>

      {isSource && (
        <div className={styles.clipCreate}>
          <div className={styles.createLabel}>Create Clip</div>
          <div className={styles.createRow}>
            <button type="button" className={styles.markBtn} onClick={() => setMarkIn(videoRef.current?.currentTime ?? 0)}>Mark In</button>
            <span className={styles.pointDisp}>{markIn != null ? fmtTime(markIn) : '—'}</span>
            <button type="button" className={styles.markBtn} onClick={() => setMarkOut(videoRef.current?.currentTime ?? 0)}>Mark Out</button>
            <span className={styles.pointDisp}>{markOut != null ? fmtTime(markOut) : '—'}</span>
            <input
              className={styles.clipNameIn}
              type="text"
              placeholder="Clip name…"
              maxLength={40}
              value={clipName}
              onChange={(e) => setClipName(e.target.value)}
            />
            <button type="button" className={styles.saveClipBtn} onClick={saveClip}>Save Clip</button>
          </div>
        </div>
      )}

      <div className={`${styles.drawer} ${drawerOpen ? styles.open : ''}`}>
        <div className={styles.drawerHdr}>
          <span className={styles.drawerTitle}>Clips</span>
          <span className={styles.drawerCount}>{clips.length}</span>
          <button type="button" className={styles.drawerClose} title="Close" onClick={() => setDrawerOpen(false)}>✕</button>
        </div>
        <div className={styles.clipsBody}>
          {clips.length === 0 ? (
            <div className={styles.noClips}>No clips yet. Use Panel 1 to create clips.</div>
          ) : (
            clips.map((clip) => (
              <div key={clip.id} className={styles.clipRow}>
                <span className={styles.clipIName} title={clip.name}>{shortName(clip.name, 18)}</span>
                <span className={styles.clipIMeta}>{fmtTime(clip.start)}–{fmtTime(clip.end)}</span>
                <button
                  type="button"
                  className={styles.clipIPlay}
                  title="Load and play clip"
                  onClick={() => playClip(clip)}
                >
                  ▶
                </button>
                <button type="button" className={styles.clipIDel} title="Delete clip" onClick={() => onDeleteClip(clip.id)}>×</button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ── Board ──────────────────────────────────────────────────────────────────

export function VideoBoard() {
  const [videos, setVideos] = useState<LibVideo[]>([])
  const [clips, setClips] = useState<Clip[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [panelCount, setPanelCount] = useState(1)
  const [dragOver, setDragOver] = useState(false)
  const [boardPseudoFs, setBoardPseudoFs] = useState(false)
  const [boardNativeFs, setBoardNativeFs] = useState(false)
  const [toast, setToast] = useState<{ msg: string; show: boolean } | null>(null)

  const mainRef = useRef<HTMLDivElement>(null)
  const nextVidRef = useRef(1)
  const nextClipRef = useRef(1)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const urlsRef = useRef<Set<string>>(new Set())

  const notify = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ msg, show: true })
    toastTimerRef.current = setTimeout(() => {
      setToast((t) => (t ? { ...t, show: false } : null))
      toastTimerRef.current = setTimeout(() => setToast(null), 300)
    }, 2200)
  }, [])

  // Release object URLs when the board unmounts.
  useEffect(() => {
    const urls = urlsRef.current
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u))
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  function addFiles(files: Iterable<File>) {
    const added: LibVideo[] = []
    for (const file of files) {
      if (!file.type.startsWith('video/')) continue
      const url = URL.createObjectURL(file)
      urlsRef.current.add(url)
      added.push({ id: nextVidRef.current++, name: file.name, url })
    }
    if (added.length) setVideos((v) => [...v, ...added])
  }

  function removeVideos(ids: Set<number>) {
    setVideos((vs) =>
      vs.filter((v) => {
        if (!ids.has(v.id)) return true
        URL.revokeObjectURL(v.url)
        urlsRef.current.delete(v.url)
        return false
      })
    )
    // Local videos can't come back once removed, so their clips go too.
    setClips((cs) => cs.filter((c) => !ids.has(c.videoId)))
    setSelectedIds((sel) => {
      const next = new Set(sel)
      ids.forEach((id) => next.delete(id))
      return next
    })
  }

  function saveClip(data: { videoId: number; name: string; start: number; end: number }) {
    setClips((cs) => [...cs, { id: nextClipRef.current++, ...data }])
    notify('Clip saved')
  }

  function deleteClip(id: number) {
    setClips((cs) => cs.filter((c) => c.id !== id))
  }

  // Board-level fullscreen with pseudo-fs fallback.
  useEffect(() => {
    function onFsChange() {
      setBoardNativeFs(document.fullscreenElement === mainRef.current)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  useEffect(() => {
    if (!boardPseudoFs) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [boardPseudoFs])

  function toggleBoardFullscreen() {
    const el = mainRef.current
    if (!el) return
    if (boardPseudoFs) {
      setBoardPseudoFs(false)
    } else if (document.fullscreenElement) {
      document.exitFullscreen()
    } else if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => setBoardPseudoFs(true))
    } else {
      setBoardPseudoFs(true)
    }
  }

  const inBoardFs = boardPseudoFs || boardNativeFs

  return (
    <div ref={mainRef} className={`${styles.main} ${boardPseudoFs ? styles.pseudoFs : ''}`}>
      <div
        className={`${styles.topBar} ${dragOver ? styles.dragOver : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          addFiles(e.dataTransfer.files)
        }}
      >
        <label className={styles.uploadBtn} title="Load video files">
          ↑ Load Video
          <input
            type="file"
            accept="video/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </label>

        <div className={styles.library}>
          {videos.length === 0 ? (
            <span className={styles.libEmpty}>
              No film loaded yet — videos stay on this device for this session only.
            </span>
          ) : (
            videos.map((v) => (
              <div
                key={v.id}
                className={`${styles.libItem} ${selectedIds.has(v.id) ? styles.libSel : ''}`}
              >
                <span
                  className={styles.libName}
                  title={v.name}
                  onClick={() =>
                    setSelectedIds((sel) => {
                      const next = new Set(sel)
                      if (next.has(v.id)) next.delete(v.id)
                      else next.add(v.id)
                      return next
                    })
                  }
                >
                  {shortName(v.name)}
                </span>
                <button
                  type="button"
                  className={styles.libRemove}
                  title="Remove video"
                  onClick={() => removeVideos(new Set([v.id]))}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        {selectedIds.size > 0 && (
          <button type="button" className={styles.delSelectedBtn} onClick={() => removeVideos(selectedIds)}>
            Delete ({selectedIds.size})
          </button>
        )}

        <div className={styles.layoutGroup}>
          <span className={styles.topLabel}>Panels:</span>
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              className={`${styles.layoutBtn} ${panelCount === n ? styles.active : ''}`}
              onClick={() => setPanelCount(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <div className={styles.layoutGroup}>
          <button
            type="button"
            className={`${styles.layoutBtn} ${styles.fsAllBtn} ${inBoardFs ? styles.active : ''}`}
            title="Fullscreen — entire videoboard"
            onClick={toggleBoardFullscreen}
          >
            {inBoardFs ? '✕ Exit Fullscreen' : '⛶ Fullscreen'}
          </button>
        </div>
      </div>

      <div className={styles.grid} data-count={panelCount}>
        {Array.from({ length: panelCount }, (_, i) => (
          <Panel
            key={i}
            index={i}
            videos={videos}
            clips={clips}
            isSource={i === 0}
            onSaveClip={saveClip}
            onDeleteClip={deleteClip}
            notify={notify}
          />
        ))}
      </div>

      {toast && (
        <div className={`${styles.toast} ${toast.show ? styles.toastShow : ''}`}>{toast.msg}</div>
      )}
    </div>
  )
}
