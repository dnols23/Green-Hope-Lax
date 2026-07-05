'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './VideoBoard.module.css'
import { Panel } from './Panel'
import {
  IconClose,
  IconCompress,
  IconExpand,
  IconFilm,
  IconKeyboard,
  IconLayout,
  IconPause,
  IconPlay,
  IconTrash,
  IconUpload,
} from './icons'
import type { Clip, LibVideo } from './types'
import { baseName, fmtTime, shortName } from './utils'

const SHORTCUTS: Array<[string[], string]> = [
  [['Space', 'K'], 'Play / pause'],
  [['J', 'L'], 'Back / forward 10s'],
  [['←', '→'], 'Back / forward 5s'],
  [[',', '.'], 'Step one frame'],
  [['I', 'O'], 'Mark clip In / Out'],
  [['M'], 'Mute'],
  [['F'], 'Fullscreen panel'],
]

type UploadItem = {
  key: number
  name: string
  sizeMB: number
  pct: number
  done?: boolean
  error?: string
}

export function VideoBoard() {
  const [videos, setVideos] = useState<LibVideo[]>([])
  const [clips, setClips] = useState<Clip[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [panelCount, setPanelCount] = useState(1)
  const [dragOver, setDragOver] = useState(false)
  const [boardPseudoFs, setBoardPseudoFs] = useState(false)
  const [boardNativeFs, setBoardNativeFs] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [playingPanels, setPlayingPanels] = useState<Set<number>>(new Set())
  const [toast, setToast] = useState<{ msg: string; show: boolean } | null>(null)
  const [configured, setConfigured] = useState(false)
  const [canManage, setCanManage] = useState(false)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  // Deep link from the Library page: /team/video?v=<id> or ?clip=<id>
  const [autoLoad, setAutoLoad] = useState<{ videoId: number; clip?: Clip } | null>(null)

  const mainRef = useRef<HTMLDivElement>(null)
  const nextLocalVidRef = useRef(-1) // local ids are negative; library rows are positive
  const nextLocalClipRef = useRef(-1)
  const nextUploadKeyRef = useRef(1)
  const configuredRef = useRef(false)
  const canManageRef = useRef(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const urlsRef = useRef<Set<string>>(new Set())
  const videoElsRef = useRef<Map<number, HTMLVideoElement>>(new Map())

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

  // ── Team library: load shared film + clips from the server ───────────────
  useEffect(() => {
    let cancelled = false
    fetch('/api/film')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.configured) return
        configuredRef.current = true
        canManageRef.current = !!d.canManage
        setConfigured(true)
        setCanManage(!!d.canManage)
        setVideos((local) => [...(d.videos as LibVideo[]), ...local])
        setClips((local) => [...(d.clips as Clip[]), ...local])
        // Honor a Library deep link once the team film list is in.
        const params = new URLSearchParams(window.location.search)
        const clipParam = params.get('clip')
        const vParam = params.get('v')
        if (clipParam) {
          const clip = (d.clips as Clip[]).find((c) => c.id === +clipParam)
          if (clip) setAutoLoad({ videoId: clip.videoId, clip })
        } else if (vParam) {
          setAutoLoad({ videoId: +vParam })
        }
      })
      .catch(() => {}) // stay in local mode
    return () => {
      cancelled = true
    }
  }, [])

  // ── Uploads (tus → Cloudflare Stream, resumable with progress) ───────────
  const patchUpload = useCallback((key: number, patch: Partial<UploadItem> | null) => {
    setUploads((us) => (patch === null ? us.filter((u) => u.key !== key) : us.map((u) => (u.key === key ? { ...u, ...patch } : u))))
  }, [])

  const cloudUpload = useCallback(
    async (file: File) => {
      const key = nextUploadKeyRef.current++
      const sizeMB = file.size / (1024 * 1024)
      setUploads((us) => [...us, { key, name: file.name, sizeMB, pct: 0 }])
      try {
        const urlRes = await fetch('/api/film/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadLength: file.size, name: file.name }),
        })
        const urlJson = await urlRes.json()
        if (!urlRes.ok) throw new Error(urlJson.error || `HTTP ${urlRes.status}`)

        const { Upload } = await import('tus-js-client')
        await new Promise<void>((resolve, reject) => {
          new Upload(file, {
            uploadUrl: urlJson.uploadURL,
            chunkSize: 50 * 1024 * 1024,
            retryDelays: [0, 1000, 3000, 6000, 12000],
            metadata: { name: file.name, filetype: file.type },
            onError: (err) => reject(err instanceof Error ? err : new Error(String(err))),
            onProgress: (sent, total) => patchUpload(key, { pct: total ? sent / total : 0 }),
            onSuccess: () => resolve(),
          }).start()
        })

        const recRes = await fetch('/api/film', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: urlJson.uid, name: file.name }),
        })
        const recJson = await recRes.json()
        if (!recRes.ok) throw new Error(recJson.error || `HTTP ${recRes.status}`)

        setVideos((v) => [...v, recJson.video as LibVideo])
        patchUpload(key, { done: true, pct: 1 })
        setTimeout(() => patchUpload(key, null), 2500)
        notify('Film saved to the team library')
      } catch (e) {
        patchUpload(key, { error: e instanceof Error ? e.message : 'Upload failed' })
      }
    },
    [notify, patchUpload]
  )

  // ── Library ───────────────────────────────────────────────────────────────
  const addFiles = useCallback(
    (files: Iterable<File>): LibVideo[] => {
      const added: LibVideo[] = []
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('video/')) continue
        if (configuredRef.current && canManageRef.current) {
          void cloudUpload(file) // lands in the team library when the upload finishes
          continue
        }
        const url = URL.createObjectURL(file)
        urlsRef.current.add(url)
        added.push({ id: nextLocalVidRef.current--, name: file.name, url })
      }
      if (!added.length) return added
      setVideos((v) => [...v, ...added])
      // Probe durations off-screen so chips can show film length.
      added.forEach((entry) => {
        const probe = document.createElement('video')
        probe.preload = 'metadata'
        probe.src = entry.url
        probe.onloadedmetadata = () => {
          const d = probe.duration
          probe.removeAttribute('src')
          setVideos((vs) => vs.map((v) => (v.id === entry.id ? { ...v, duration: d } : v)))
        }
      })
      return added
    },
    [cloudUpload]
  )

  function removeVideos(ids: Set<number>) {
    // Team film is coach-managed; non-coaches can only drop their local files.
    if (!canManageRef.current) {
      ids = new Set([...ids].filter((id) => id < 0))
      if (!ids.size) return
    }
    const removedRemote = videos.filter((v) => ids.has(v.id) && v.remote)
    setVideos((vs) =>
      vs.filter((v) => {
        if (!ids.has(v.id)) return true
        if (!v.remote) {
          URL.revokeObjectURL(v.url)
          urlsRef.current.delete(v.url)
        }
        return false
      })
    )
    // Clips go with their film (the server cascades team clips the same way).
    setClips((cs) => cs.filter((c) => !ids.has(c.videoId)))
    setSelectedIds((sel) => {
      const next = new Set(sel)
      ids.forEach((id) => next.delete(id))
      return next
    })
    removedRemote.forEach((v) => {
      fetch(`/api/film/${v.id}`, { method: 'DELETE' })
        .then((r) => {
          if (!r.ok) throw new Error()
        })
        .catch(() => notify(`Could not delete “${shortName(baseName(v.name), 18)}” from the team library`))
    })
  }

  // ── Clips ─────────────────────────────────────────────────────────────────
  const saveClip = useCallback(
    async (data: { videoId: number; name: string; start: number; end: number }) => {
      if (data.videoId > 0 && configuredRef.current && canManageRef.current) {
        try {
          const res = await fetch('/api/film/clips', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })
          const j = await res.json()
          if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
          setClips((cs) => [...cs, j.clip as Clip])
          notify('Clip saved to the team library')
        } catch {
          notify('Could not save the clip — check your connection and try again.')
        }
        return
      }
      setClips((cs) => [...cs, { id: nextLocalClipRef.current--, ...data }])
      notify('Clip saved (this device, this session)')
    },
    [notify]
  )

  const deleteClip = useCallback(
    (id: number) => {
      if (id > 0 && !canManageRef.current) return // team clips are coach-managed
      setClips((cs) => cs.filter((c) => c.id !== id))
      if (id > 0 && configuredRef.current) {
        fetch(`/api/film/clips/${id}`, { method: 'DELETE' })
          .then((r) => {
            if (!r.ok) throw new Error()
          })
          .catch(() => notify('Could not delete the clip from the team library'))
      }
    },
    [notify]
  )

  // ── Panel registry: lets the toolbar drive all panels at once ────────────
  const registerVideo = useCallback((index: number, el: HTMLVideoElement | null) => {
    if (el) videoElsRef.current.set(index, el)
    else videoElsRef.current.delete(index)
  }, [])

  const onPlayingChange = useCallback((index: number, playing: boolean) => {
    setPlayingPanels((prev) => {
      const next = new Set(prev)
      if (playing) next.add(index)
      else next.delete(index)
      return next
    })
  }, [])

  const anyPlaying = playingPanels.size > 0

  function toggleAll() {
    const els = [...videoElsRef.current.values()]
    if (!els.length) return
    if (anyPlaying) els.forEach((v) => v.pause())
    else els.forEach((v) => void v.play())
  }

  // Panels leaving the layout must not linger in the playing set.
  function changeLayout(n: number) {
    setPanelCount(n)
    setPlayingPanels((prev) => {
      const next = new Set([...prev].filter((i) => i < n))
      return next.size === prev.size ? prev : next
    })
  }

  // ── Board fullscreen ──────────────────────────────────────────────────────
  useEffect(() => {
    const onFsChange = () => setBoardNativeFs(document.fullscreenElement === mainRef.current)
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
    if (boardPseudoFs) setBoardPseudoFs(false)
    else if (document.fullscreenElement) document.exitFullscreen()
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => setBoardPseudoFs(true))
    else setBoardPseudoFs(true)
  }

  const inBoardFs = boardPseudoFs || boardNativeFs

  return (
    <div ref={mainRef} className={`${styles.board} ${boardPseudoFs ? styles.pseudoFs : ''}`}>
      {/* ── Toolbar ── */}
      <div
        className={`${styles.toolbar} ${dragOver ? styles.dragOver : ''}`}
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
        <label
          className={styles.loadBtn}
          title={configured && canManage ? 'Upload film to the team library' : 'Load video files from this device'}
        >
          <IconUpload size={16} /> {configured && canManage ? 'Upload Film' : 'Load Film'}
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

        <div className={styles.libraryStrip}>
          {videos.length === 0 ? (
            <span className={styles.libEmpty}>
              {configured
                ? canManage
                  ? 'No film in the team library yet — uploads are shared with the whole team.'
                  : 'No team film yet — your coach can upload film here. Load Film plays files from this device.'
                : 'No film loaded — stays on this device, this session only.'}
            </span>
          ) : (
            videos.map((v) => (
              <div
                key={v.id}
                className={`${styles.chip} ${selectedIds.has(v.id) ? styles.chipSel : ''}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/x-vb-video', String(v.id))
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                onClick={() => {
                  if (v.remote && !canManage) return // selection is for batch delete
                  setSelectedIds((sel) => {
                    const next = new Set(sel)
                    if (next.has(v.id)) next.delete(v.id)
                    else next.add(v.id)
                    return next
                  })
                }}
                title={`${v.name} — drag onto a panel to load it`}
              >
                <span className={styles.chipName}>{shortName(baseName(v.name), 20)}</span>
                {v.duration != null && <span className={styles.chipDur}>{fmtTime(v.duration)}</span>}
                {(!v.remote || canManage) && (
                  <button
                    type="button"
                    className={styles.chipX}
                    title={v.remote ? 'Delete from the team library' : 'Remove from library'}
                    onClick={(e) => {
                      e.stopPropagation()
                      removeVideos(new Set([v.id]))
                    }}
                  >
                    <IconClose size={11} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {selectedIds.size > 0 && (
          <button type="button" className={styles.deleteSelBtn} onClick={() => removeVideos(selectedIds)}>
            <IconTrash size={13} /> Delete {selectedIds.size}
          </button>
        )}

        {panelCount > 1 && (
          <button
            type="button"
            className={`${styles.iconBtn} ${anyPlaying ? styles.iconBtnOn : ''}`}
            title="Play or pause every panel together"
            onClick={toggleAll}
          >
            {anyPlaying ? <IconPause size={14} /> : <IconPlay size={14} />}
            {anyPlaying ? 'Pause all' : 'Play all'}
          </button>
        )}

        <div className={styles.segmented} title="Panel layout">
          {([1, 2, 3, 4] as const).map((n) => (
            <button
              key={n}
              type="button"
              className={`${styles.segBtn} ${panelCount === n ? styles.segActive : ''}`}
              title={`${n} panel${n > 1 ? 's' : ''}`}
              onClick={() => changeLayout(n)}
            >
              <IconLayout panes={n} />
            </button>
          ))}
        </div>

        <div className={styles.toolGroup}>
          {configured && (
            <Link href="/team/video/library" className={styles.iconBtn} title="Browse the team library">
              <IconFilm size={15} /> Library
            </Link>
          )}
          <button
            type="button"
            className={`${styles.iconBtn} ${shortcutsOpen ? styles.iconBtnOn : ''}`}
            title="Keyboard shortcuts"
            onClick={() => setShortcutsOpen((o) => !o)}
          >
            <IconKeyboard size={16} />
          </button>
          {shortcutsOpen && (
            <div className={styles.shortcutsPop}>
              <div className={styles.shortcutsTitle}>Keyboard shortcuts</div>
              {SHORTCUTS.map(([keys, label]) => (
                <div key={label} className={styles.shortcutRow}>
                  <span>{label}</span>
                  <span className={styles.kbd}>
                    {keys.map((k) => (
                      <span key={k}>{k}</span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            className={`${styles.iconBtn} ${inBoardFs ? styles.iconBtnOn : ''}`}
            title="Fullscreen the whole board"
            onClick={toggleBoardFullscreen}
          >
            {inBoardFs ? <IconCompress size={15} /> : <IconExpand size={15} />}
          </button>
        </div>
      </div>

      {/* ── Panel grid ── */}
      <div className={styles.grid} data-count={panelCount}>
        {Array.from({ length: panelCount }, (_, i) => (
          <Panel
            key={i === 0 && autoLoad ? `p0-${autoLoad.videoId}-${autoLoad.clip?.id ?? 'v'}` : i}
            index={i}
            videos={videos}
            clips={clips}
            isSource={i === 0}
            canManage={canManage}
            autoLoad={i === 0 ? autoLoad : null}
            onSaveClip={saveClip}
            onDeleteClip={deleteClip}
            addFiles={addFiles}
            registerVideo={registerVideo}
            onPlayingChange={onPlayingChange}
            notify={notify}
          />
        ))}
      </div>

      {/* ── Upload progress stack ── */}
      {uploads.length > 0 && (
        <div className={styles.upStack}>
          {uploads.map((u) => (
            <div key={u.key} className={`${styles.upCard} ${u.error ? styles.upErr : ''}`}>
              <div className={styles.upName}>
                {shortName(baseName(u.name), 24)}
                <span className={styles.upSize}>
                  {u.sizeMB >= 1 ? ` · ${Math.round(u.sizeMB)} MB` : ''}
                </span>
              </div>
              {u.error ? (
                <>
                  <div className={styles.upMsg}>{u.error}</div>
                  <button type="button" className={styles.upX} title="Dismiss" onClick={() => patchUpload(u.key, null)}>
                    <IconClose size={12} />
                  </button>
                </>
              ) : u.done ? (
                <div className={styles.upMsg}>Saved to team library ✓</div>
              ) : (
                <>
                  <div className={styles.upBar}>
                    <div className={styles.upFill} style={{ width: `${Math.round(u.pct * 100)}%` }} />
                  </div>
                  <div className={styles.upMsg}>
                    {u.pct >= 1 ? 'Processing…' : `Uploading… ${Math.round(u.pct * 100)}%`}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className={`${styles.toast} ${toast.show ? styles.toastShow : ''}`}>
          <span className={styles.toastDot} />
          {toast.msg}
        </div>
      )}
    </div>
  )
}
