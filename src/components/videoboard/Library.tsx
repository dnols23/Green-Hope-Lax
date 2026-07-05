'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import styles from './VideoBoard.module.css'
import { IconFilm, IconScissors } from './icons'
import type { Clip, LibVideo } from './types'
import { baseName, fmtDuration, fmtTime } from './utils'

// Hudl-style library: search + filter over all team film and clips, grouped
// by month, tap to open on the board. Team film only — local files never
// leave the device, so they can't appear here.

type Item = {
  key: string
  kind: 'film' | 'clip'
  id: number
  title: string
  sub: string
  thumb?: string
  clipTime?: number // thumbnail frame for clips
  createdAt?: string
  href: string
}

type Filter = 'all' | 'film' | 'clip'

function monthLabel(iso?: string): string {
  if (!iso) return 'Recently added'
  const d = new Date(iso)
  if (isNaN(+d)) return 'Recently added'
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function dayLabel(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(+d)) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function Library() {
  const [loaded, setLoaded] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [canManage, setCanManage] = useState(false)
  const [videos, setVideos] = useState<LibVideo[]>([])
  const [clips, setClips] = useState<Clip[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [menuFor, setMenuFor] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/film')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return
        if (d?.configured) {
          setConfigured(true)
          setCanManage(!!d.canManage)
          setVideos(d.videos as LibVideo[])
          setClips(d.clips as Clip[])
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (menuFor == null) return
    const close = () => setMenuFor(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [menuFor])

  const items = useMemo<Item[]>(() => {
    const films: Item[] = videos.map((v) => ({
      key: `film-${v.id}`,
      kind: 'film',
      id: v.id,
      title: baseName(v.name),
      sub: 'Game film',
      thumb: v.thumb,
      createdAt: v.createdAt,
      href: `/team/video?v=${v.id}`,
    }))
    const clipItems: Item[] = clips.map((c) => {
      const parent = videos.find((v) => v.id === c.videoId)
      return {
        key: `clip-${c.id}`,
        kind: 'clip',
        id: c.id,
        title: c.name,
        sub: `Clip · ${fmtTime(c.start)}–${fmtTime(c.end)} (${fmtDuration(c.end - c.start)})${parent ? ` · ${baseName(parent.name)}` : ''}`,
        thumb: parent?.thumb,
        clipTime: c.start,
        createdAt: c.createdAt,
        href: `/team/video?clip=${c.id}`,
      }
    })
    const all = [...films, ...clipItems]
      .filter((i) => filter === 'all' || i.kind === filter)
      .filter((i) => i.title.toLowerCase().includes(query.trim().toLowerCase()))
    // Newest first; undated items sink to the bottom.
    all.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    return all
  }, [videos, clips, filter, query])

  // Group into month sections, preserving the newest-first order.
  const sections = useMemo(() => {
    const out: Array<{ label: string; items: Item[] }> = []
    for (const item of items) {
      const label = monthLabel(item.createdAt)
      const last = out[out.length - 1]
      if (last && last.label === label) last.items.push(item)
      else out.push({ label, items: [item] })
    }
    return out
  }, [items])

  function thumbSrc(item: Item): string | undefined {
    if (!item.thumb) return undefined
    return item.clipTime != null ? `${item.thumb}&time=${Math.max(0, Math.round(item.clipTime))}s` : item.thumb
  }

  async function deleteItem(item: Item) {
    if (item.kind === 'film') {
      if (!window.confirm(`Delete “${item.title}” and its clips for the whole team?`)) return
      setVideos((vs) => vs.filter((v) => v.id !== item.id))
      setClips((cs) => cs.filter((c) => c.videoId !== item.id))
      await fetch(`/api/film/${item.id}`, { method: 'DELETE' }).catch(() => {})
    } else {
      setClips((cs) => cs.filter((c) => c.id !== item.id))
      await fetch(`/api/film/clips/${item.id}`, { method: 'DELETE' }).catch(() => {})
    }
  }

  return (
    <div className={styles.libPage}>
      <div className={styles.searchRow}>
        <input
          className={styles.searchBox}
          type="search"
          placeholder="Search film and clips…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className={styles.fChips}>
          {(
            [
              ['all', 'All'],
              ['film', 'Film'],
              ['clip', 'Clips'],
            ] as Array<[Filter, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`${styles.fChip} ${filter === value ? styles.fChipOn : ''}`}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!loaded ? (
        <div className={styles.libNote}>Loading the team library…</div>
      ) : !configured ? (
        <div className={styles.libNote}>
          The library shows the team&apos;s cloud film, and cloud storage isn&apos;t connected yet.
          Film loaded on the board stays on that device.
          <Link href="/team/video" className={styles.libNoteBtn}>Open the board</Link>
        </div>
      ) : items.length === 0 ? (
        <div className={styles.libNote}>
          {query || filter !== 'all'
            ? 'Nothing matches that search.'
            : 'Nothing in the team library yet — upload film from the board and it will show up here.'}
          <Link href="/team/video" className={styles.libNoteBtn}>Open the board</Link>
        </div>
      ) : (
        sections.map((section) => (
          <section key={section.label}>
            <div className={styles.monthHdr}>{section.label}</div>
            {section.items.map((item) => (
              <div key={item.key} className={styles.rowCard}>
                <Link href={item.href} className={styles.rowLink}>
                  {thumbSrc(item) ? (
                    // Plain <img>: Cloudflare thumbnails are already sized frames.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className={styles.rowThumb} src={thumbSrc(item)} alt="" loading="lazy" />
                  ) : (
                    <span className={`${styles.rowThumb} ${styles.rowThumbPh}`}>
                      {item.kind === 'film' ? <IconFilm size={22} /> : <IconScissors size={20} />}
                    </span>
                  )}
                  <span className={styles.rowBody}>
                    <span className={styles.rowTitle}>{item.title}</span>
                    <span className={styles.rowMeta}>
                      {dayLabel(item.createdAt) && `${dayLabel(item.createdAt)} · `}
                      {item.sub}
                    </span>
                  </span>
                </Link>
                <div className={styles.rowMenuWrap}>
                  <button
                    type="button"
                    className={styles.rowDots}
                    aria-label="More actions"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuFor((m) => (m === item.key ? null : item.key))
                    }}
                  >
                    ⋮
                  </button>
                  {menuFor === item.key && (
                    <div className={styles.rowMenu}>
                      <Link href={item.href} className={styles.rowMenuItem}>
                        ▶ Open in Film Room
                      </Link>
                      {canManage && (
                        <button
                          type="button"
                          className={`${styles.rowMenuItem} ${styles.rowMenuDanger}`}
                          onClick={() => deleteItem(item)}
                        >
                          Delete{item.kind === 'film' ? ' film + clips' : ' clip'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  )
}
