'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import styles from './VideoBoard.module.css'
import { IconFilm, IconScissors } from './icons'
import type { Clip, LibVideo } from './types'
import { baseName, fmtDuration, fmtTime } from './utils'
import { TEAM_TIME_ZONE } from '@/lib/format'
import { FILM_TYPES, filmTypeLabel, gameLabel, type FilmDetails, type FilmGame, type FilmType } from './filmMeta'
import { FilmDetailsDialog, foldersOf, type DetailsTarget } from './FilmDetailsDialog'

// Hudl-style library: search + filter over all team film and clips, tap to
// open on the board. Each film is filed under its folder, else the game it's
// from, else the month it came in — and its clips sit with it. Team film
// only — local files never leave the device, so they can't appear here.

type Home = { key: string; label: string; icon: string; rank: number; order: string }

type Item = {
  key: string
  kind: 'film' | 'clip'
  /** The film's type — a clip takes its film's. */
  type: FilmType
  home: Home
  id: number
  title: string
  sub: string
  thumb?: string
  clipTime?: number // thumbnail frame for clips
  createdAt?: string
  href: string
}

type Filter = 'all' | 'clip' | FilmType

/** Read only when the details popup opens, never while rendering. */
const clockNow = () => Date.now()

function monthLabel(iso?: string): string {
  if (!iso) return 'Recently added'
  const d = new Date(iso)
  if (isNaN(+d)) return 'Recently added'
  return d.toLocaleDateString('en-US', { timeZone: TEAM_TIME_ZONE, month: 'long', year: 'numeric' })
}

function dayLabel(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(+d)) return ''
  return d.toLocaleDateString('en-US', { timeZone: TEAM_TIME_ZONE, month: 'short', day: 'numeric', year: 'numeric' })
}

// Mounted under both /admin/film and /team/video; `basePath` keeps every link
// pointing back at the side the viewer came from.
export function Library({ basePath = '/team/video' }: { basePath?: string } = {}) {
  const [loaded, setLoaded] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [canManage, setCanManage] = useState(false)
  const [videos, setVideos] = useState<LibVideo[]>([])
  const [clips, setClips] = useState<Clip[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [games, setGames] = useState<FilmGame[]>([])
  const [details, setDetails] = useState<DetailsTarget | null>(null)

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
          setGames((d.games ?? []) as FilmGame[])
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
    const gameById = new Map(games.map((g) => [g.id, g]))
    // Folders first (A–Z), then games (newest first), then the rest by month.
    const homeOf = (v: LibVideo | undefined, createdAt?: string): Home => {
      const folder = v?.folder?.trim()
      if (folder) return { key: `f:${folder.toLowerCase()}`, label: folder, icon: '📁', rank: 0, order: folder.toLowerCase() }
      const g = v?.gameId ? gameById.get(v.gameId) : undefined
      if (g) return { key: `g:${g.id}`, label: gameLabel(g, true), icon: '🥍', rank: 1, order: g.date }
      const label = monthLabel(v?.createdAt ?? createdAt)
      return { key: `m:${label}`, label, icon: '', rank: 2, order: v?.createdAt ?? createdAt ?? '' }
    }
    const describe = (v: LibVideo) => {
      const g = v.gameId ? gameById.get(v.gameId) : undefined
      return [filmTypeLabel(v.category), g && v.folder ? gameLabel(g) : null].filter(Boolean).join(' · ')
    }
    const films: Item[] = videos.map((v) => ({
      key: `film-${v.id}`,
      kind: 'film',
      type: v.category ?? 'game',
      home: homeOf(v),
      id: v.id,
      title: baseName(v.name),
      sub: describe(v) + (v.notes ? ` · ${v.notes}` : ''),
      thumb: v.thumb,
      createdAt: v.createdAt,
      href: `${basePath}?v=${v.id}`,
    }))
    const clipItems: Item[] = clips.map((c) => {
      const parent = videos.find((v) => v.id === c.videoId)
      return {
        key: `clip-${c.id}`,
        kind: 'clip',
        type: parent?.category ?? 'game',
        home: homeOf(parent, c.createdAt),
        id: c.id,
        title: c.name,
        sub: `Clip · ${fmtTime(c.start)}–${fmtTime(c.end)} (${fmtDuration(c.end - c.start)})${parent ? ` · ${baseName(parent.name)}` : ''}`,
        thumb: parent?.thumb,
        clipTime: c.start,
        createdAt: c.createdAt,
        href: `${basePath}?clip=${c.id}`,
      }
    })
    const q = query.trim().toLowerCase()
    const all = [...films, ...clipItems]
      .filter((i) => filter === 'all' || (filter === 'clip' ? i.kind === 'clip' : i.kind === 'film' && i.type === filter))
      .filter((i) => !q || `${i.title} ${i.sub} ${i.home.label}`.toLowerCase().includes(q))
    // Within a section: films first, newest first, then their clips.
    all.sort((a, b) => (a.kind === b.kind ? (b.createdAt ?? '').localeCompare(a.createdAt ?? '') : a.kind === 'film' ? -1 : 1))
    return all
  }, [videos, clips, games, filter, query, basePath])

  const sections = useMemo(() => {
    const byHome = new Map<string, { home: Home; items: Item[] }>()
    for (const item of items) {
      const s = byHome.get(item.home.key) ?? { home: item.home, items: [] }
      s.items.push(item)
      byHome.set(item.home.key, s)
    }
    return [...byHome.values()].sort((a, b) =>
      a.home.rank !== b.home.rank
        ? a.home.rank - b.home.rank
        : a.home.rank === 0
          ? a.home.order.localeCompare(b.home.order)
          : b.home.order.localeCompare(a.home.order)
    )
  }, [items])

  // The types there actually is film for, so the chips don't offer empty ones.
  const typesInUse = FILM_TYPES.filter((t) => videos.some((v) => (v.category ?? 'game') === t.key))

  function openDetails(id: number) {
    const v = videos.find((x) => x.id === id)
    if (!v) return
    setMenuFor(null)
    setDetails({
      films: [{ key: v.id, name: baseName(v.name) }],
      start: { category: v.category ?? 'game', gameId: v.gameId ?? null, folder: v.folder ?? null, notes: v.notes ?? null },
      at: clockNow(),
      mode: 'edit',
    })
  }

  async function saveDetails(names: Map<number, string>, shared: Omit<FilmDetails, 'name'>) {
    setDetails(null)
    for (const [id, name] of names) {
      try {
        const res = await fetch(`/api/film/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...shared, name }),
        })
        const j = await res.json()
        if (!res.ok) throw new Error(j.error)
        const video = j.video as LibVideo
        setVideos((vs) => vs.map((v) => (v.id === video.id ? video : v)))
      } catch {
        window.alert('Could not save the film details. Try again.')
      }
    }
  }

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
              ...typesInUse.map((t) => [t.key, t.plural]),
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
          <Link href={basePath} className={styles.libNoteBtn}>Open the board</Link>
        </div>
      ) : items.length === 0 ? (
        <div className={styles.libNote}>
          {query || filter !== 'all'
            ? 'Nothing matches that search.'
            : 'Nothing in the team library yet — upload film from the board and it will show up here.'}
          <Link href={basePath} className={styles.libNoteBtn}>Open the board</Link>
        </div>
      ) : (
        sections.map((section) => (
          <section key={section.home.key}>
            <div className={styles.monthHdr}>
              {section.home.icon && <span aria-hidden>{section.home.icon} </span>}
              {section.home.label}
            </div>
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
                      {canManage && item.kind === 'film' && (
                        <button type="button" className={styles.rowMenuItem} onClick={() => openDetails(item.id)}>
                          ✎ Name, type &amp; folder
                        </button>
                      )}
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

      {details && (
        <FilmDetailsDialog
          target={details}
          games={games}
          folders={foldersOf(videos)}
          onSave={saveDetails}
          onClose={() => setDetails(null)}
        />
      )}
    </div>
  )
}
