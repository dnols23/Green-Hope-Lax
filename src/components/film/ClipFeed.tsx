'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type Hls from 'hls.js'
import styles from './ClipFeed.module.css'
import type { FeedClip, ClipMessage, FilmHub } from '@/lib/clipShareData'
import { markWatched, replyToCoach, saveMyNotes } from '@/lib/clipShareActions'

const fmt = (t: number) => {
  const s = Math.max(0, Math.floor(t))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function sentLabel(iso: string): string {
  const d = new Date(iso)
  if (isNaN(+d)) return ''
  return d.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' })
}

/**
 * A Film Room for whoever the clips were sent to.
 *
 * The newest clip is up and ready the moment the page opens; every other one
 * is a tap away in the list, and the tap plays it. Under the film, three
 * folds: the coach's notes, your own notes (only you see them), and a line
 * back to the coach — with his question, if he asked one.
 */
export function ClipFeed({
  hub,
  clips: initial,
  coachName,
}: {
  hub: FilmHub
  clips: FeedClip[]
  /** Who replies go to, as the viewer knows him. */
  coachName: string
}) {
  const [clips, setClips] = useState(initial)
  const firstId = (initial.find((c) => !c.seen) ?? initial[0])?.id ?? null
  const [currentId, setCurrentId] = useState<number | null>(firstId)
  const clip = clips.find((c) => c.id === currentId) ?? null

  const patch = useCallback((id: number, p: Partial<FeedClip>) => {
    setClips((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c)))
  }, [])

  const fresh = clips.filter((c) => !c.seen || c.unreadFromCoach > 0).length

  if (!clips.length) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon} aria-hidden>
          🎬
        </div>
        <p className={styles.emptyTitle}>No film yet</p>
        <p className={styles.emptyText}>When {coachName} sends you clips, they show up here, ready to watch.</p>
      </div>
    )
  }

  return (
    <div className={styles.feed}>
      <div className={styles.main}>
        {clip && (
          <Player
            key="player"
            clip={clip}
            onWatched={() => {
              if (clip.seen && !clip.unreadFromCoach) return
              patch(clip.id, { seen: true, unreadFromCoach: 0 })
              void markWatched(hub, clip.id)
            }}
            onEnded={() => {
              const i = clips.findIndex((c) => c.id === clip.id)
              const next = clips.slice(i + 1).find((c) => !c.seen)
              return next ? next.id : null
            }}
            onNext={(id) => setCurrentId(id)}
          />
        )}
        {clip && <Details key={clip.id} hub={hub} clip={clip} coachName={coachName} onChange={(p) => patch(clip.id, p)} />}
      </div>

      <aside className={styles.side}>
        <div className={styles.sideHead}>
          <span>Your clips</span>
          {fresh > 0 && <span className={styles.newCount}>{fresh} new</span>}
        </div>
        <ol className={styles.list}>
          {clips.map((c) => {
            const on = c.id === currentId
            const isNew = !c.seen
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className={`${styles.item} ${on ? styles.itemOn : ''}`}
                  aria-current={on ? 'true' : undefined}
                  onClick={() => {
                    setCurrentId(c.id)
                    // Wake the player in the same tap, so a phone lets it play.
                    window.dispatchEvent(new CustomEvent('clipfeed:play', { detail: c.id }))
                  }}
                >
                  <span className={styles.thumb}>
                    {c.film ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`${c.film.thumb.split('?')[0]}?time=${Math.round(c.start)}s&height=120`} alt="" loading="lazy" />
                    ) : null}
                    <span className={styles.dur}>{fmt(c.end - c.start)}</span>
                    {on && <span className={styles.nowPlaying} aria-hidden>▶</span>}
                  </span>
                  <span className={styles.itemBody}>
                    <span className={styles.itemName}>{c.name}</span>
                    <span className={styles.itemMeta}>
                      {sentLabel(c.sentAt)}
                      {c.prompt && <span className={styles.askTag}>Question</span>}
                    </span>
                  </span>
                  {isNew ? (
                    <span className={styles.newDot} aria-label="New" />
                  ) : c.unreadFromCoach > 0 ? (
                    <span className={styles.replyDot} aria-label="Coach replied">
                      💬
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ol>
      </aside>
    </div>
  )
}

// ── The film ────────────────────────────────────────────────────────────────

function Player({
  clip,
  onWatched,
  onEnded,
  onNext,
}: {
  clip: FeedClip
  onWatched: () => void
  /** The next clip to offer when this one ends, if any. */
  onEnded: () => number | null
  onNext: (id: number) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)
  const clockRef = useRef<HTMLSpanElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const loadedUrl = useRef<string | null>(null)
  const pendingSeek = useRef<number | null>(null)
  const wantPlay = useRef(false)
  const clipRef = useRef(clip)
  const [playing, setPlaying] = useState(false)
  const [done, setDone] = useState(false)
  const [slow, setSlow] = useState(false)
  const [next, setNext] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  const [scrubbing, setScrubbing] = useState(false)

  const onEndedRef = useRef(onEnded)
  useEffect(() => {
    clipRef.current = clip
    onEndedRef.current = onEnded
  }, [clip, onEnded])

  const draw = useCallback(() => {
    const v = videoRef.current
    const c = clipRef.current
    if (!v) return
    const len = Math.max(0.1, c.end - c.start)
    const t = Math.min(len, Math.max(0, v.currentTime - c.start))
    if (fillRef.current) fillRef.current.style.width = `${(t / len) * 100}%`
    if (clockRef.current) clockRef.current.textContent = `${fmt(t)} / ${fmt(len)}`
    barRef.current?.setAttribute('aria-valuenow', String(Math.round(t)))
  }, [])

  /**
   * Put this clip's film in the player and go to its start. Called inside the
   * tap that asked for it, so a phone allows the sound-on play that follows.
   */
  const load = useCallback(
    (c: FeedClip, play: boolean) => {
      const v = videoRef.current
      if (!v || !c.film) return
      setDone(false)
      setNext(null)
      setFailed(false)
      wantPlay.current = play
      const url = c.film.url
      if (loadedUrl.current === url && v.readyState >= 1) {
        v.currentTime = c.start
        draw()
        if (play) void v.play().catch(() => {})
        return
      }
      loadedUrl.current = url
      pendingSeek.current = c.start
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      if (v.canPlayType('application/vnd.apple.mpegurl')) {
        v.src = url
        if (play) void v.play().catch(() => {})
        return
      }
      void import('hls.js').then(({ default: HlsMod }) => {
        if (loadedUrl.current !== url) return
        if (!HlsMod.isSupported()) {
          v.src = url
          return
        }
        const h = new HlsMod({ maxBufferLength: 20, startPosition: c.start })
        hlsRef.current = h
        let tries = 0
        h.on(HlsMod.Events.ERROR, (_e, d) => {
          if (!d?.fatal) return
          if (d.type === HlsMod.ErrorTypes.MEDIA_ERROR) {
            h.recoverMediaError()
          } else if (tries++ < 3) {
            setTimeout(() => {
              h.loadSource(url)
              h.startLoad()
            }, 3000)
          } else setFailed(true)
        })
        h.loadSource(url)
        h.attachMedia(v)
      })
    },
    [draw]
  )

  // A new clip: load it. The list's tap has already asked to play.
  useEffect(() => {
    load(clip, wantPlay.current)
  }, [clip.id, load]) // eslint-disable-line react-hooks/exhaustive-deps

  /* The list asks to play from inside its own tap. A different clip is about
     to be loaded, so the player is only woken here — started silently and
     stopped at once — which is what lets a phone play it with sound a moment
     later, once its film is in. */
  useEffect(() => {
    const onPlay = (e: Event) => {
      wantPlay.current = true
      const v = videoRef.current
      if (!v || !v.paused) return
      if ((e as CustomEvent<number>).detail === clipRef.current.id && v.readyState >= 1) {
        void v.play().catch(() => {})
        return
      }
      const muted = v.muted
      v.muted = true
      v.play()
        .then(() => {
          if (!wantPlay.current || loadedUrl.current !== clipRef.current.film?.url) v.pause()
        })
        .catch(() => {})
        .finally(() => {
          v.muted = muted
        })
    }
    window.addEventListener('clipfeed:play', onPlay)
    return () => window.removeEventListener('clipfeed:play', onPlay)
  }, [])

  useEffect(
    () => () => {
      hlsRef.current?.destroy()
    },
    []
  )

  // Progress at screen rate while it plays; stop at the clip's end.
  useEffect(() => {
    if (!playing) return
    let raf = 0
    const tick = () => {
      const v = videoRef.current
      const c = clipRef.current
      if (v && !scrubbing && v.currentTime >= c.end - 0.03) {
        v.pause()
        v.currentTime = c.end
        setDone(true)
        setNext(onEndedRef.current())
      }
      draw()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, scrubbing, draw])

  function toggle() {
    const v = videoRef.current
    if (!v || !clip.film) return
    if (v.paused) {
      if (done || v.currentTime < clip.start - 0.2 || v.currentTime >= clip.end - 0.05) v.currentTime = clip.start
      setDone(false)
      setNext(null)
      void v.play().catch(() => {})
    } else v.pause()
  }

  function scrubTo(clientX: number) {
    const v = videoRef.current
    const bar = barRef.current
    if (!v || !bar) return
    const r = bar.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    v.currentTime = clip.start + f * (clip.end - clip.start)
    setDone(false)
    draw()
  }

  function fullscreen() {
    const v = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
    const box = boxRef.current
    if (document.fullscreenElement) void document.exitFullscreen()
    else if (box?.requestFullscreen) void box.requestFullscreen().catch(() => v?.webkitEnterFullscreen?.())
    else v?.webkitEnterFullscreen?.()
  }

  return (
    <div className={styles.player}>
      <div ref={boxRef} className={styles.stage}>
        <video
          ref={videoRef}
          className={styles.video}
          playsInline
          preload="metadata"
          poster={clip.film ? `${clip.film.thumb.split('?')[0]}?time=${Math.round(clip.start)}s&height=540` : undefined}
          onClick={toggle}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget
            if (pendingSeek.current != null) {
              v.currentTime = pendingSeek.current
              pendingSeek.current = null
            }
            v.playbackRate = slow ? 0.5 : 1
            draw()
            if (wantPlay.current && v.paused) void v.play().catch(() => {})
          }}
          onPlay={() => {
            setPlaying(true)
            setDone(false)
            onWatched()
          }}
          onPause={() => {
            setPlaying(false)
            draw()
          }}
          onSeeked={draw}
        />
        {!clip.film ? (
          <div className={styles.overlay}>This clip’s film is no longer in the library.</div>
        ) : failed ? (
          <div className={styles.overlay}>The film is still processing. Try again in a minute.</div>
        ) : done ? (
          <div className={styles.overlay}>
            <button type="button" className={styles.again} onClick={toggle}>
              ↻ Watch again
            </button>
            {next != null && (
              <button
                type="button"
                className={styles.nextBtn}
                onClick={() => {
                  wantPlay.current = true
                  onNext(next)
                }}
              >
                Next clip →
              </button>
            )}
          </div>
        ) : (
          !playing && (
            <button type="button" className={styles.bigPlay} onClick={toggle} aria-label="Play">
              <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden fill="currentColor">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            </button>
          )
        )}
      </div>
      <div className={styles.controls}>
        <button type="button" className={styles.ctl} onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="currentColor">
              <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="currentColor">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
          )}
        </button>
        <div
          ref={barRef}
          className={styles.bar}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            setScrubbing(true)
            scrubTo(e.clientX)
          }}
          onPointerMove={(e) => scrubbing && scrubTo(e.clientX)}
          onPointerUp={() => setScrubbing(false)}
          onPointerCancel={() => setScrubbing(false)}
          role="slider"
          aria-label="Position in the clip"
          aria-valuemin={0}
          aria-valuemax={Math.round(clip.end - clip.start)}
          aria-valuenow={0}
          tabIndex={0}
          onKeyDown={(e) => {
            const v = videoRef.current
            if (!v) return
            if (e.key === 'ArrowLeft') v.currentTime = Math.max(clip.start, v.currentTime - 1)
            else if (e.key === 'ArrowRight') v.currentTime = Math.min(clip.end, v.currentTime + 1)
            else return
            e.preventDefault()
            draw()
          }}
        >
          <div ref={fillRef} className={styles.fill} />
        </div>
        <span ref={clockRef} className={styles.clock}>
          0:00 / {fmt(clip.end - clip.start)}
        </span>
        <button
          type="button"
          className={`${styles.ctl} ${styles.ctlText} ${slow ? styles.ctlOn : ''}`}
          onClick={() => {
            const s = !slow
            setSlow(s)
            if (videoRef.current) videoRef.current.playbackRate = s ? 0.5 : 1
          }}
          title="Slow motion"
          aria-pressed={slow}
        >
          ½×
        </button>
        <button type="button" className={styles.ctl} onClick={fullscreen} aria-label="Full screen">
          <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ── Under the film ──────────────────────────────────────────────────────────

function Details({
  hub,
  clip,
  coachName,
  onChange,
}: {
  hub: FilmHub
  clip: FeedClip
  coachName: string
  onChange: (p: Partial<FeedClip>) => void
}) {
  return (
    <div className={styles.details}>
      <h2 className={styles.title}>{clip.name}</h2>
      {clip.notes && (
        <Fold title="Coach’s notes" icon="📋" open>
          <p className={styles.coachNotes}>{clip.notes}</p>
        </Fold>
      )}
      <MyNotes hub={hub} clip={clip} onChange={onChange} />
      <Conversation hub={hub} clip={clip} coachName={coachName} onChange={onChange} />
    </div>
  )
}

function Fold({
  title,
  icon,
  hint,
  open: startOpen = false,
  accent = false,
  children,
}: {
  title: string
  icon: string
  hint?: string
  open?: boolean
  accent?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(startOpen)
  return (
    <section className={`${styles.fold} ${accent ? styles.foldAccent : ''}`}>
      <button type="button" className={styles.foldHead} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span aria-hidden className={styles.foldIcon}>
          {icon}
        </span>
        <span className={styles.foldTitle}>{title}</span>
        {hint && !open && <span className={styles.foldHint}>{hint}</span>}
        <span aria-hidden className={`${styles.chev} ${open ? styles.chevOpen : ''}`}>
          ›
        </span>
      </button>
      {open && <div className={styles.foldBody}>{children}</div>}
    </section>
  )
}

function MyNotes({ hub, clip, onChange }: { hub: FilmHub; clip: FeedClip; onChange: (p: Partial<FeedClip>) => void }) {
  const [text, setText] = useState(clip.myNote)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const last = useRef(clip.myNote)

  const save = useCallback(
    async (body: string) => {
      if (body === last.current) return
      setState('saving')
      const r = await saveMyNotes(hub, clip.id, body)
      if (r.ok) {
        last.current = body
        onChange({ myNote: body })
        setState('saved')
      } else setState('error')
    },
    [hub, clip.id, onChange]
  )

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  return (
    <Fold title="Your notes" icon="✏️" hint={clip.myNote ? clip.myNote.split('\n')[0] : 'Only you see these'} open={!!clip.myNote}>
      <textarea
        className={styles.text}
        rows={3}
        value={text}
        maxLength={8000}
        placeholder="What you saw, what to do next time…"
        onChange={(e) => {
          const v = e.target.value
          setText(v)
          setState('idle')
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(() => void save(v), 900)
        }}
        onBlur={() => {
          if (timer.current) clearTimeout(timer.current)
          void save(text)
        }}
      />
      <p className={styles.small}>
        {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'error' ? 'Couldn’t save — check your connection.' : 'Only you see these.'}
      </p>
    </Fold>
  )
}

function Conversation({
  hub,
  clip,
  coachName,
  onChange,
}: {
  hub: FilmHub
  clip: FeedClip
  coachName: string
  onChange: (p: Partial<FeedClip>) => void
}) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const answered = clip.thread.some((m) => !m.fromCoach)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [clip.thread.length])

  async function send() {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setError('')
    const r = await replyToCoach(hub, clip.id, body)
    setSending(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    setDraft('')
    onChange({ thread: [...clip.thread, r.message as ClipMessage] })
  }

  const title = clip.prompt && !answered ? `${coachName} asked you` : `Message ${coachName}`
  return (
    <Fold
      title={title}
      icon={clip.prompt && !answered ? '❓' : '💬'}
      accent={!!clip.prompt && !answered}
      hint={clip.thread.length ? `${clip.thread.length} message${clip.thread.length === 1 ? '' : 's'}` : undefined}
      open={(!!clip.prompt && !answered) || clip.unreadFromCoach > 0}
    >
      {clip.prompt && <p className={styles.prompt}>{clip.prompt}</p>}
      {clip.thread.length > 0 && (
        <div ref={listRef} className={styles.thread}>
          {clip.thread.map((m) => (
            <div key={m.id} className={`${styles.msg} ${m.fromCoach ? styles.msgCoach : styles.msgMe}`}>
              <span className={styles.msgWho}>{m.fromCoach ? m.author || coachName : 'You'}</span>
              <span className={styles.msgBody}>{m.body}</span>
            </div>
          ))}
        </div>
      )}
      <div className={styles.compose}>
        <textarea
          className={styles.text}
          rows={2}
          value={draft}
          maxLength={4000}
          placeholder={clip.prompt && !answered ? 'Your answer…' : `A question or a thought for ${coachName}…`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void send()
          }}
        />
        <button type="button" className={styles.send} disabled={!draft.trim() || sending} onClick={() => void send()}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </Fold>
  )
}
