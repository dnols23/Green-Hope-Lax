'use client'

import { useState } from 'react'
import { FieldBoard } from '@/components/planner/FieldBoard'
import { boardDrawn, hasDetails, type NoteDetails } from '@/lib/noteBlocks'
import { safeUrl } from '@/lib/noteText'
import { EMPTY_BOARD } from '@/lib/planner'
import { NoteIcon } from './NoteIcons'

/** The little tags beside a line that has details, so they show without opening it. */
export function detailTags(d: NoteDetails | undefined): string[] {
  if (!d) return []
  const tags: string[] = []
  if (d.setup?.trim() || d.run?.trim() || d.why?.trim()) tags.push('Notes')
  if (boardDrawn(d.board)) tags.push('Diagram')
  if (d.link?.trim()) tags.push('Video')
  if (!tags.length && d.notes?.trim()) tags.push('Notes')
  return tags
}

/**
 * What an item on a checklist is, written out the way a drill in the drill
 * bank is: how it is set up, how it runs, why we run it, a video, the field
 * drawn — and anything else. It belongs to the note, so it saves with the
 * note as it is typed; there is no separate Save.
 */
export function ItemDetails({
  details,
  title,
  readOnly,
  onChange,
  onClose,
}: {
  details: NoteDetails | undefined
  /** The line these are the details of — named on the full-screen field. */
  title: string
  readOnly: boolean
  onChange: (next: NoteDetails | undefined) => void
  onClose: () => void
}) {
  const d = details ?? {}
  const [drawing, setDrawing] = useState(false)
  const set = (k: keyof NoteDetails, v: NoteDetails[keyof NoteDetails]) => {
    const next: NoteDetails = { ...d, [k]: v }
    onChange(hasDetails(next) || next.linkLabel?.trim() ? next : undefined)
  }
  const link = d.link ? safeUrl(d.link) : null

  return (
    <div className="ne-details mt-1 mb-2 rounded-lg border border-gray-200 bg-gray-50 px-3 pb-3 pt-2 space-y-3">
      <div className="flex items-center gap-2 -mb-1 min-w-0">
        <NoteIcon name="details" size={16} className="text-gray-400" />
        <span className="section-label">Details</span>
        {/* On a phone the pill on the line already says these. */}
        <span className="hidden sm:inline-flex gap-1.5">
          {detailTags(details).map((t) => (
            <span key={t} className="badge badge-sched">{t}</span>
          ))}
        </span>
        <button type="button" onClick={onClose} className="ne-icon-btn ml-auto" aria-label="Close details">
          <NoteIcon name="x" size={16} />
        </button>
      </div>

      <Box label="Setup" value={d.setup} readOnly={readOnly} placeholder="Two lines at X, balls at the front of each, goalie in" onChange={(v) => set('setup', v)} />
      <Box label="How it runs" value={d.run} readOnly={readOnly} placeholder="Step by step: who goes, where, when it ends" onChange={(v) => set('run', v)} />
      <Box label="Why we run it" value={d.why} readOnly={readOnly} placeholder="What good looks like; what to coach" onChange={(v) => set('why', v)} />

      <div>
        <label className="block min-w-0">
          <span className="section-label">Video or link</span>
          {readOnly ? (
            <DetailLink href={link} label={d.linkLabel} />
          ) : (
            <input
              type="url"
              inputMode="url"
              value={d.link ?? ''}
              onChange={(e) => set('link', e.target.value)}
              placeholder="https://"
              className="field !py-1.5 min-h-9 text-sm mt-1"
            />
          )}
        </label>
        {!readOnly && (
          <label className="block min-w-0 mt-2">
            <span className="section-label">Link name (optional)</span>
            <input
              value={d.linkLabel ?? ''}
              onChange={(e) => set('linkLabel', e.target.value)}
              maxLength={80}
              placeholder="Watch it"
              className="field !py-1.5 min-h-9 text-sm mt-1"
            />
          </label>
        )}
      </div>
      {!readOnly && link && <DetailLink href={link} label={d.linkLabel} />}

      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="section-label">Field diagram</span>
          {!readOnly && !drawing && (
            <button type="button" onClick={() => setDrawing(true)} className="btn btn-ghost !py-1 text-xs ml-auto min-h-9">
              {boardDrawn(d.board) ? '✎ Edit the diagram' : '+ Draw it'}
            </button>
          )}
        </div>
        {drawing ? (
          <div className="space-y-2">
            {/* The field keeps its own undo. */}
            <div data-own-undo>
              <FieldBoard board={d.board ?? EMPTY_BOARD} onChange={(next) => set('board', next)} title={title || null} />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => setDrawing(false)} className="btn btn-primary !py-1.5 text-sm min-h-9">
                Done
              </button>
              {boardDrawn(d.board) && (
                <button
                  type="button"
                  onClick={() => {
                    set('board', null)
                    setDrawing(false)
                  }}
                  className="ml-auto text-xs font-bold text-gray-400 hover:text-red-700 min-h-9"
                >
                  Take the diagram off
                </button>
              )}
            </div>
          </div>
        ) : boardDrawn(d.board) ? (
          <FieldBoard board={d.board} readOnly title={title || null} />
        ) : (
          <p className="text-sm text-gray-400">Not drawn yet.</p>
        )}
      </div>

      <Box label="Notes" value={d.notes} readOnly={readOnly} placeholder="Anything else — who runs it, what to watch for" onChange={(v) => set('notes', v)} />
    </div>
  )
}

function DetailLink({ href, label }: { href: string | null; label?: string }) {
  if (!href) return <p className="text-sm text-gray-400 mt-1">No video on this one yet.</p>
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block mt-1 text-sm font-bold text-[var(--gh-green)] hover:underline break-all"
    >
      ▶ {label?.trim() || 'Watch it'} →
    </a>
  )
}

function Box({
  label,
  value,
  readOnly,
  placeholder,
  onChange,
}: {
  label: string
  value: string | undefined
  readOnly: boolean
  placeholder: string
  onChange: (v: string) => void
}) {
  if (readOnly) {
    return (
      <div>
        <div className="section-label mb-1">{label}</div>
        {value?.trim() ? (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{value}</p>
        ) : (
          <p className="text-sm text-gray-400">—</p>
        )}
      </div>
    )
  }
  return (
    <label className="block">
      <span className="section-label">{label}</span>
      <textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className="field grow-with-text !min-h-[3.25rem] !py-1.5 text-sm mt-1"
      />
    </label>
  )
}
