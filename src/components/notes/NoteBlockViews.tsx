'use client'

import { useEffect, useRef, useState } from 'react'
import { FieldBoard } from '@/components/planner/FieldBoard'
import { ClipPlayer } from '@/components/planner/ClipPlayer'
import { LibraryPicker } from '@/components/planner/LibraryPicker'
import { driveImageUrl, imageFromClipboard, shrinkImage, uploadImage } from '@/lib/uploadImage'
import { MAX_TABLE_COLS, MAX_TABLE_ROWS, type NoteBoard, type NoteBookmark, type NoteImage, type NoteTable } from '@/lib/noteBlocks'
import { safeImageUrl, safeUrl } from '@/lib/noteText'
import { boardItemCount, type Board } from '@/lib/planner'
import { NoteIcon } from './NoteIcons'

/** Keeps the newest callback for work that finishes after the render that started it. */
function useLatest<T>(value: T) {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  })
  return ref
}

/**
 * A lacrosse field with a play on it. A play drawn into a note is on the
 * sideline in March, and a paragraph describing that play is not — so the
 * field opens as the thing itself, with its own full screen.
 */
export function BoardBlock({
  block,
  startOpen,
  readOnly,
  onPatch,
}: {
  block: NoteBoard
  startOpen: boolean
  readOnly: boolean
  onPatch: (next: Partial<NoteBoard>) => void
}) {
  const [open, setOpen] = useState(startOpen)
  const [picking, setPicking] = useState(false)
  const [pasting, setPasting] = useState<string | null>(null)
  const patch = useLatest(onPatch)
  const b = block

  /** A picture pasted onto the field block. A text paste goes where the caret is. */
  async function pasteInto(e: React.ClipboardEvent) {
    const file = imageFromClipboard(e.clipboardData)
    if (!file || readOnly) return
    e.preventDefault()
    setPasting('Saving the picture…')
    const { url, error } = await uploadImage(file, 'library')
    if (url) {
      patch.current({ shotUrl: url })
      setPasting(null)
    } else {
      setPasting(error ?? 'That picture would not save.')
    }
  }

  return (
    <div data-own-undo onPaste={(e) => void pasteInto(e)} className="py-1">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <NoteIcon name="field" size={18} className="text-gray-400" />
        <input
          value={b.label}
          readOnly={readOnly}
          onChange={(e) => onPatch({ label: e.target.value })}
          placeholder="Name this play"
          aria-label="Play name"
          className="flex-1 min-w-[8rem] bg-transparent border-0 p-0 font-bold focus:outline-none focus:ring-0"
        />
        {!readOnly && (
          <button type="button" onClick={() => setPicking(!picking)} className="ne-link-btn">
            Library
          </button>
        )}
        {pasting && <span className="text-xs text-gray-500">{pasting}</span>}
        {!b.shotUrl && (
          <button type="button" onClick={() => setOpen(!open)} className="ne-link-btn text-[var(--gh-green)]">
            {open ? 'Collapse' : readOnly ? 'Open the field' : 'Open the field'}
          </button>
        )}
      </div>

      {picking && (
        <LibraryPicker
          onPlay={(picked) => {
            onPatch({ board: picked.board, clip: picked.clip, shotUrl: null, label: b.label || picked.name })
            setPicking(false)
            setOpen(true)
          }}
          onShot={(url, title) => {
            onPatch({ shotUrl: url, label: b.label || title })
            setPicking(false)
          }}
          onClose={() => setPicking(false)}
        />
      )}

      {b.shotUrl ? (
        <div>
          {/* Our own bucket, and a flat PNG — nothing to resize. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.shotUrl} alt={b.label || 'From the Library'} className="w-full rounded-lg block" />
          {!readOnly && (
            <button type="button" onClick={() => onPatch({ shotUrl: null })} className="ne-link-btn mt-1">
              Take the picture out
            </button>
          )}
        </div>
      ) : b.clip && !open ? (
        <div>
          <ClipPlayer clip={b.clip} />
          <button type="button" onClick={() => setOpen(true)} className="ne-link-btn mt-1">
            Edit the field
          </button>
        </div>
      ) : open ? (
        readOnly ? (
          <FieldBoard board={b.board} readOnly title={b.label || null} />
        ) : (
          <FieldBoard board={b.board} onChange={(next: Board) => onPatch({ board: next })} title={b.label || null} />
        )
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full min-h-16 rounded-lg border border-dashed border-gray-300 py-5 text-sm text-gray-500 hover:border-[var(--gh-green)] hover:text-[var(--gh-green)]"
        >
          {boardItemCount(b.board) > 0
            ? `${boardItemCount(b.board)} on the field — tap to open`
            : readOnly
              ? 'Nothing drawn yet'
              : 'Tap to draw the play'}
        </button>
      )}
    </div>
  )
}

/**
 * A picture: uploaded from the phone, pasted, or a link to one. A Google
 * Drive share link is turned into the picture itself.
 */
export function ImageBlock({
  block,
  file,
  error,
  autoFocus,
  readOnly,
  onPatch,
  onFile,
  onUploaded,
}: {
  block: NoteImage
  /** A picture waiting to go up — pasted, or just picked. */
  file: File | null
  error: string | null
  autoFocus: boolean
  readOnly: boolean
  onPatch: (next: Partial<NoteImage>) => void
  onFile: (file: File) => void
  onUploaded: (res: { url?: string; error?: string }) => void
}) {
  const [link, setLink] = useState('')
  const done = useLatest(onUploaded)

  // A picture handed over goes up once; whatever comes back is reported to the
  // newest editor, not the one from the render that started it.
  useEffect(() => {
    if (!file) return
    let live = true
    void (async () => {
      const res = await uploadImage(await shrinkImage(file), 'notes', file.name || 'note.png')
      if (live) done.current(res)
    })()
    return () => {
      live = false
    }
  }, [file, done])

  if (block.url) {
    return (
      <figure className="py-1">
        {/* A coach's own upload or a link they chose; any size, any host. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={block.url} alt={block.caption || 'Picture'} className="max-w-full rounded-lg block" loading="lazy" />
        <figcaption className="flex items-center gap-2 mt-1">
          <input
            value={block.caption}
            readOnly={readOnly}
            onChange={(e) => onPatch({ caption: e.target.value })}
            placeholder={readOnly ? '' : 'Add a caption'}
            aria-label="Caption"
            className="flex-1 min-w-0 bg-transparent border-0 p-0 text-sm text-gray-500 focus:outline-none focus:ring-0"
          />
          {!readOnly && (
            <button type="button" onClick={() => onPatch({ url: '' })} className="ne-link-btn">
              Replace
            </button>
          )}
        </figcaption>
      </figure>
    )
  }

  if (readOnly) return <p className="py-1 text-sm text-gray-400">No picture</p>

  const use = () => {
    const url = safeImageUrl(driveImageUrl(link))
    if (url) onPatch({ url })
  }

  return (
    <div
      className="my-1 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3"
      onPaste={(e) => {
        const f = imageFromClipboard(e.clipboardData)
        if (f) {
          e.preventDefault()
          onFile(f)
        }
      }}
    >
      {file ? (
        <p className="text-sm text-gray-500 flex items-center gap-2">
          <NoteIcon name="upload" size={16} /> Uploading the picture…
        </p>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="btn btn-ghost !py-1.5 text-sm cursor-pointer shrink-0 min-h-9">
            <NoteIcon name="upload" size={16} /> Upload
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onFile(f)
                e.target.value = ''
              }}
            />
          </label>
          <span className="text-xs text-gray-400 hidden sm:inline">or</span>
          <input
            value={link}
            autoFocus={autoFocus}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                use()
              }
            }}
            inputMode="url"
            placeholder="Paste a picture's link"
            aria-label="Picture link"
            className="field !py-1.5 text-sm flex-1 min-w-0"
          />
          <button type="button" onClick={use} disabled={!safeImageUrl(driveImageUrl(link))} className="btn btn-primary !py-1.5 text-sm disabled:opacity-50 min-h-9">
            Add
          </button>
        </div>
      )}
      {error && <p className="text-sm font-semibold text-red-700 mt-2" role="alert">{error}</p>}
    </div>
  )
}

const hostOf = (url: string) => {
  try {
    return new URL(url, 'https://example.com').hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

const isVideo = (url: string) => /youtube\.com|youtu\.be|vimeo\.com|hudl\.com|twitter\.com|x\.com/i.test(url)

/** A link to a page or a video, shown as a card with a title. */
export function BookmarkBlock({
  block,
  autoFocus,
  readOnly,
  onPatch,
}: {
  block: NoteBookmark
  autoFocus: boolean
  readOnly: boolean
  onPatch: (next: Partial<NoteBookmark>) => void
}) {
  const [editing, setEditing] = useState(!block.url)
  const [url, setUrl] = useState(block.url)
  const [title, setTitle] = useState(block.title)
  const href = safeUrl(block.url)

  if (!editing || readOnly) {
    if (!href) return <p className="py-1 text-sm text-gray-400">No link</p>
    return (
      <div className="py-1 flex items-stretch gap-1">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-0 flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5 hover:bg-gray-50"
        >
          <span className="grid place-items-center w-9 h-9 rounded-md bg-gray-100 text-gray-500 shrink-0">
            <NoteIcon name={isVideo(href) ? 'video' : 'link'} size={18} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-gray-800 truncate">{block.title || hostOf(href)}</span>
            <span className="block text-xs text-gray-500 truncate">{href}</span>
          </span>
          <NoteIcon name="open" size={16} className="text-gray-400 ml-auto" />
        </a>
        {!readOnly && (
          <button
            type="button"
            onClick={() => {
              setUrl(block.url)
              setTitle(block.title)
              setEditing(true)
            }}
            aria-label="Edit link"
            className="ne-icon-btn"
          >
            <NoteIcon name="edit" size={16} />
          </button>
        )}
      </div>
    )
  }

  const save = () => {
    const clean = safeUrl(url)
    if (!clean) return
    onPatch({ url: clean, title: title.trim() })
    setEditing(false)
  }
  return (
    <div className="my-1 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={url}
          autoFocus={autoFocus}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              save()
            }
          }}
          inputMode="url"
          placeholder="Paste a link — a page, a video"
          aria-label="Link"
          className="field !py-1.5 text-sm flex-1 min-w-0"
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              save()
            }
          }}
          placeholder="What it is (optional)"
          aria-label="Link title"
          className="field !py-1.5 text-sm sm:w-56"
        />
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={save} disabled={!safeUrl(url)} className="btn btn-primary !py-1.5 text-sm disabled:opacity-50 min-h-9">
          Save link
        </button>
        {block.url && (
          <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost !py-1.5 text-sm min-h-9">
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * A plain table. Each cell is a box to type in; Tab moves along a row as it
 * does in any spreadsheet. It scrolls sideways inside itself on a phone
 * rather than pushing the page wider.
 */
export function TableBlock({
  block,
  autoFocus,
  readOnly,
  onPatch,
}: {
  block: NoteTable
  autoFocus: boolean
  readOnly: boolean
  onPatch: (next: Partial<NoteTable>) => void
}) {
  const [at, setAt] = useState<{ r: number; c: number } | null>(null)
  const rows = block.rows
  const width = rows[0]?.length ?? 1

  const setCell = (r: number, c: number, v: string) =>
    onPatch({ rows: rows.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)) })
  const addRow = (after = rows.length - 1) =>
    rows.length < MAX_TABLE_ROWS &&
    onPatch({ rows: [...rows.slice(0, after + 1), Array.from({ length: width }, () => ''), ...rows.slice(after + 1)] })
  const addCol = () => width < MAX_TABLE_COLS && onPatch({ rows: rows.map((row) => [...row, '']) })
  const dropRow = () => {
    if (rows.length <= 1) return
    const r = at?.r ?? rows.length - 1
    onPatch({ rows: rows.filter((_, i) => i !== r) })
    setAt(null)
  }
  const dropCol = () => {
    if (width <= 1) return
    const c = at?.c ?? width - 1
    onPatch({ rows: rows.map((row) => row.filter((_, j) => j !== c)) })
    setAt(null)
  }

  return (
    <div className="py-1">
      <div className="overflow-x-auto max-w-full rounded-lg border border-gray-200">
        <table className="ne-table border-collapse text-sm">
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className={block.header && r === 0 ? 'bg-gray-50 font-bold' : ''}>
                {row.map((cell, c) => (
                  <td key={c} className="border-gray-200 p-0 align-top">
                    <input
                      value={cell}
                      readOnly={readOnly}
                      autoFocus={autoFocus && r === 0 && c === 0}
                      onFocus={() => setAt({ r, c })}
                      onChange={(e) => setCell(r, c, e.target.value)}
                      onKeyDown={(e) => {
                        // Return on the last row starts another, the way a spreadsheet does.
                        if (e.key === 'Enter' && !readOnly) {
                          e.preventDefault()
                          const next = (e.currentTarget.closest('tbody')?.children[r + 1] as HTMLElement | undefined)?.querySelectorAll('input')[c]
                          if (next) next.focus()
                          else addRow()
                        }
                      }}
                      aria-label={`Row ${r + 1}, column ${c + 1}`}
                      className={`w-full min-w-[7.5rem] bg-transparent border-0 px-2.5 py-2 focus:outline-none focus:bg-gray-50 ${
                        block.header && r === 0 ? 'font-bold' : ''
                      }`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1 mt-1 text-xs">
          <button type="button" className="ne-link-btn" onClick={() => addRow()} disabled={rows.length >= MAX_TABLE_ROWS}>
            + Row
          </button>
          <button type="button" className="ne-link-btn" onClick={addCol} disabled={width >= MAX_TABLE_COLS}>
            + Column
          </button>
          <button type="button" className="ne-link-btn" onClick={dropRow} disabled={rows.length <= 1}>
            − Row{at ? ` ${at.r + 1}` : ''}
          </button>
          <button type="button" className="ne-link-btn" onClick={dropCol} disabled={width <= 1}>
            − Column{at ? ` ${at.c + 1}` : ''}
          </button>
          <label className="ne-link-btn flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={!!block.header}
              onChange={(e) => onPatch({ header: e.target.checked })}
              className="w-4 h-4 accent-[var(--gh-green)]"
            />
            Header row
          </label>
        </div>
      )}
    </div>
  )
}
