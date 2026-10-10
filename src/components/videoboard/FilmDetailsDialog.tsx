'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './VideoBoard.module.css'
import { IconClose, IconFilm } from './icons'
import { FILM_TYPES, gameLabel, type FilmDetails, type FilmGame, type FilmType } from './filmMeta'

const NEW_FOLDER = '__new'

export interface DetailsTarget {
  /** One per film — the uploads in flight, or the one film being changed. */
  films: { key: number; name: string }[]
  /** Shared by them all. */
  start: Omit<FilmDetails, 'name'>
  /** When it was opened, for which games are worth listing. */
  at: number
  mode: 'upload' | 'edit'
}

/**
 * What a film is and where it's kept.
 *
 * Opens the moment film is chosen for upload — the upload carries on behind
 * it — and again from the Library to change it. A name for each film, then
 * the type, the game it's from and a folder, shared by everything uploaded
 * together. Picking a game names untouched films after it, so "IMG_4553"
 * becomes "vs Panther Creek · Mar 4" without typing.
 */
export function FilmDetailsDialog({
  target,
  games,
  folders,
  onSave,
  onClose,
}: {
  target: DetailsTarget
  games: FilmGame[]
  folders: string[]
  onSave: (names: Map<number, string>, shared: Omit<FilmDetails, 'name'>) => void
  onClose: () => void
}) {
  const [names, setNames] = useState(() => new Map(target.films.map((f) => [f.key, f.name])))
  const [touched, setTouched] = useState<Set<number>>(() => new Set(target.mode === 'edit' ? target.films.map((f) => f.key) : []))
  const [category, setCategory] = useState<FilmType>(target.start.category)
  const [gameId, setGameId] = useState<string | null>(target.start.gameId)
  const [folder, setFolder] = useState<string | null>(target.start.folder)
  const [newFolder, setNewFolder] = useState(false)
  const [notes, setNotes] = useState(target.start.notes ?? '')
  const firstRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstRef.current?.focus()
    firstRef.current?.select()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // This season and last, plus what's coming up in the next month — and the
  // game already picked, wherever it falls.
  const DAY = 86_400_000
  const listed = games.filter((g) => {
    const t = +new Date(g.date)
    return g.id === gameId || (t > target.at - 420 * DAY && t < target.at + 30 * DAY)
  })
  const byLevel = (lvl: FilmGame['level']) => listed.filter((g) => g.level === lvl)

  function pickGame(id: string | null) {
    setGameId(id)
    const g = games.find((x) => x.id === id)
    if (!g) return
    // Untouched names take the game's.
    const base = gameLabel(g)
    setNames((cur) => {
      const next = new Map(cur)
      target.films.forEach((f, i) => {
        if (!touched.has(f.key)) next.set(f.key, target.films.length > 1 ? `${base} · ${i + 1}` : base)
      })
      return next
    })
  }

  const allNamed = target.films.every((f) => (names.get(f.key) ?? '').trim())

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!allNamed) return
    onSave(
      new Map(target.films.map((f) => [f.key, (names.get(f.key) ?? '').trim()])),
      { category, gameId, folder: folder?.trim() || null, notes: notes.trim() || null }
    )
  }

  const many = target.films.length > 1
  return (
    <div className={styles.dlgBack} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className={styles.dlg} onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="film-details-title">
        <div className={styles.dlgHead}>
          <IconFilm size={16} />
          <h2 id="film-details-title">
            {target.mode === 'edit' ? 'Film details' : many ? `${target.films.length} films uploading` : 'Film uploading'}
          </h2>
          <button type="button" className={styles.dlgX} onClick={onClose} aria-label="Close">
            <IconClose size={13} />
          </button>
        </div>
        {target.mode === 'upload' && (
          <p className={styles.dlgHint}>It keeps uploading while you fill this in.</p>
        )}

        <label className={styles.dlgLabel}>{many ? 'Names' : 'Name'}</label>
        <div className={styles.dlgNames}>
          {target.films.map((f, i) => (
            <input
              key={f.key}
              ref={i === 0 ? firstRef : undefined}
              className={styles.dlgInput}
              value={names.get(f.key) ?? ''}
              maxLength={120}
              required
              placeholder="vs Panther Creek · 1st half"
              onChange={(e) => {
                const v = e.target.value
                setNames((cur) => new Map(cur).set(f.key, v))
                setTouched((cur) => new Set(cur).add(f.key))
              }}
            />
          ))}
        </div>

        <label className={styles.dlgLabel}>Type</label>
        <div className={styles.dlgChips}>
          {FILM_TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`${styles.fChip} ${category === t.key ? styles.fChipOn : ''}`}
              aria-pressed={category === t.key}
              onClick={() => setCategory(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className={styles.dlgRow}>
          <div>
            <label className={styles.dlgLabel} htmlFor="film-game">
              Game <span>optional</span>
            </label>
            <select
              id="film-game"
              className={styles.dlgInput}
              value={gameId ?? ''}
              onChange={(e) => pickGame(e.target.value || null)}
            >
              <option value="">No game</option>
              {(['varsity', 'jv'] as const).map((lvl) =>
                byLevel(lvl).length ? (
                  <optgroup key={lvl} label={lvl === 'jv' ? 'JV' : 'Varsity'}>
                    {byLevel(lvl).map((g) => (
                      <option key={g.id} value={g.id}>
                        {gameLabel({ ...g, level: 'varsity' }, true)}
                      </option>
                    ))}
                  </optgroup>
                ) : null
              )}
            </select>
          </div>
          <div>
            <label className={styles.dlgLabel} htmlFor="film-folder">
              Folder <span>optional</span>
            </label>
            {newFolder ? (
              <div className={styles.dlgInline}>
                <input
                  id="film-folder"
                  className={styles.dlgInput}
                  value={folder ?? ''}
                  maxLength={60}
                  autoFocus
                  placeholder="e.g. Man-up, Scouting Apex"
                  onChange={(e) => setFolder(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.dlgLink}
                  onClick={() => {
                    setNewFolder(false)
                    setFolder(target.start.folder)
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <select
                id="film-folder"
                className={styles.dlgInput}
                value={folder ?? ''}
                onChange={(e) => {
                  if (e.target.value === NEW_FOLDER) {
                    setNewFolder(true)
                    setFolder('')
                  } else setFolder(e.target.value || null)
                }}
              >
                <option value="">No folder</option>
                {folders.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
                <option value={NEW_FOLDER}>＋ New folder…</option>
              </select>
            )}
          </div>
        </div>

        <label className={styles.dlgLabel} htmlFor="film-notes">
          Notes <span>optional</span>
        </label>
        <textarea
          id="film-notes"
          className={styles.dlgInput}
          rows={2}
          maxLength={2000}
          value={notes}
          placeholder="What to watch for"
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className={styles.dlgFoot}>
          <button type="button" className={styles.dlgLink} onClick={onClose}>
            {target.mode === 'upload' ? 'Skip' : 'Cancel'}
          </button>
          <button type="submit" className={styles.saveBtn} disabled={!allNamed}>
            Save
          </button>
        </div>
      </form>
    </div>
  )
}

/** Every folder in use, A–Z. */
export function foldersOf(videos: { folder?: string | null }[]): string[] {
  const seen = new Map<string, string>()
  for (const v of videos) {
    const f = v.folder?.trim()
    if (f && !seen.has(f.toLowerCase())) seen.set(f.toLowerCase(), f)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}
