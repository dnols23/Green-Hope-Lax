'use client'

import { useState } from 'react'
import styles from './VideoBoard.module.css'
import { IconClose, IconPlay, IconTrash } from './icons'
import type { Clip, LibVideo } from './types'
import { baseName, fmtDuration, fmtTime, shortName } from './utils'
import { GripDots, SortableList } from '@/components/admin/SortableList'

type ClipsDrawerProps = {
  open: boolean
  clips: Clip[]
  videos: LibVideo[]
  /** Coach signed in — may rename, reorder, keep notes on and delete team clips. */
  canManage: boolean
  onClose: () => void
  onPlay: (clip: Clip) => void
  onDelete: (id: number) => void
  onUpdate: (id: number, patch: { name?: string; notes?: string | null }) => void
  onReorder: (ids: number[]) => void
}

/**
 * The clip list, in the order the staff want it watched.
 *
 * Coaches drag a clip by its grip to move it, tap its name to rename it, and
 * open its notes to write what to look for. Everyone else sees the same order
 * and can open the notes to read them.
 */
export function ClipsDrawer({
  open,
  clips,
  videos,
  canManage,
  onClose,
  onPlay,
  onDelete,
  onUpdate,
  onReorder,
}: ClipsDrawerProps) {
  const [openNotes, setOpenNotes] = useState<Set<number>>(new Set())
  const [renaming, setRenaming] = useState<number | null>(null)

  const mayChange = (clip: Clip) => !clip.remote || canManage
  const toggleNotes = (id: number) =>
    setOpenNotes((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const items = clips.map((c) => ({ id: String(c.id), clip: c }))

  return (
    <div className={`${styles.drawer} ${open ? styles.drawerOpen : ''}`}>
      <div className={styles.drawerHead}>
        <span className={styles.drawerTitle}>Clips</span>
        <span className={styles.drawerCount}>{clips.length}</span>
        <button type="button" className={styles.drawerClose} title="Close" onClick={onClose}>
          <IconClose size={14} />
        </button>
      </div>
      <div className={styles.drawerBody}>
        {clips.length === 0 ? (
          <div className={styles.noClips}>
            No clips yet.
            <br />
            Mark In / Out points in Panel 1 to create one.
          </div>
        ) : (
          <SortableList
            items={items}
            onReorder={(ids) => onReorder(ids.map(Number))}
            className={styles.clipList}
            dragClassName={styles.clipDragging}
            label={(i) => i.clip.name}
            renderItem={({ clip }, grip) => {
              const source = videos.find((v) => v.id === clip.videoId)
              const notesOpen = openNotes.has(clip.id)
              const change = mayChange(clip)
              return (
                <div className={styles.clipCard}>
                  <div className={styles.clipTop}>
                    {canManage && (
                      <span {...grip} className={styles.clipGrip}>
                        <GripDots />
                      </span>
                    )}
                    <div className={styles.clipInfo}>
                      {renaming === clip.id ? (
                        <input
                          className={styles.clipRename}
                          defaultValue={clip.name}
                          maxLength={60}
                          autoFocus
                          onFocus={(e) => e.currentTarget.select()}
                          onKeyDown={(e) => {
                            e.stopPropagation()
                            if (e.key === 'Enter') e.currentTarget.blur()
                            if (e.key === 'Escape') {
                              e.currentTarget.value = clip.name
                              e.currentTarget.blur()
                            }
                          }}
                          onBlur={(e) => {
                            const name = e.currentTarget.value.trim()
                            setRenaming(null)
                            if (name && name !== clip.name) onUpdate(clip.id, { name })
                          }}
                          aria-label="Clip name"
                        />
                      ) : change ? (
                        <button
                          type="button"
                          className={`${styles.clipName} ${styles.clipNameBtn}`}
                          title={`${clip.name} — tap to rename`}
                          onClick={() => setRenaming(clip.id)}
                        >
                          {clip.name}
                        </button>
                      ) : (
                        <div className={styles.clipName} title={clip.name}>
                          {clip.name}
                        </div>
                      )}
                      <div className={styles.clipMeta}>
                        {fmtTime(clip.start)}–{fmtTime(clip.end)} · {fmtDuration(clip.end - clip.start)}
                        {source ? ` · ${shortName(baseName(source.name), 16)}` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`${styles.clipAct} ${styles.clipActPlay}`}
                      title="Load and play clip"
                      onClick={() => onPlay(clip)}
                    >
                      <IconPlay size={14} />
                    </button>
                    {change && (
                      <button
                        type="button"
                        className={`${styles.clipAct} ${styles.clipActDel}`}
                        title="Delete clip"
                        onClick={() => {
                          if (confirm(`Delete “${clip.name}”?`)) onDelete(clip.id)
                        }}
                      >
                        <IconTrash size={14} />
                      </button>
                    )}
                  </div>

                  {(change || clip.notes) && (
                    <button
                      type="button"
                      className={styles.clipNotesToggle}
                      aria-expanded={notesOpen}
                      onClick={() => toggleNotes(clip.id)}
                    >
                      <span className={`${styles.clipChevron} ${notesOpen ? styles.clipChevronOpen : ''}`} aria-hidden>
                        ›
                      </span>
                      Notes
                      {!notesOpen && clip.notes && <span className={styles.clipNotesPeek}>{clip.notes}</span>}
                    </button>
                  )}
                  {notesOpen &&
                    (change ? (
                      <textarea
                        className={styles.clipNotes}
                        defaultValue={clip.notes ?? ''}
                        rows={3}
                        maxLength={4000}
                        placeholder="What to see in this clip"
                        autoFocus={!clip.notes}
                        onKeyDown={(e) => e.stopPropagation()}
                        onBlur={(e) => {
                          const notes = e.currentTarget.value.trim() || null
                          if (notes !== (clip.notes ?? null)) onUpdate(clip.id, { notes })
                        }}
                        aria-label={`Notes on ${clip.name}`}
                      />
                    ) : (
                      <p className={styles.clipNotesText}>{clip.notes}</p>
                    ))}
                </div>
              )
            }}
          />
        )}
      </div>
    </div>
  )
}
