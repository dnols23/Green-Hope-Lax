'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import styles from './VideoBoard.module.css'
import { IconClose } from './icons'
import type { Clip } from './types'
import { fmtDuration } from './utils'
import { SHARE_GROUPS, isShareGroup, type Recipient, type Share, type ShareGroup } from '@/lib/clipShare'

export const ASK_AFTER_CLIP_KEY = 'gh-film-send-after-clip'

/**
 * Send a clip — the head coach's one stop for it.
 *
 * Its name, his notes (what to see), a question if he wants an answer, and
 * who gets it: whole groups in a tap, anyone else by typing their name. It
 * opens by itself right after a clip is saved, so a clip goes from marked to
 * sent without a detour; "Not now" leaves it in the clip list to send later.
 */
export function SendClipDialog({
  clip,
  recipients,
  shares: startShares,
  afterSave,
  onClose,
  onSend,
}: {
  clip: Clip
  recipients: Recipient[]
  shares: Share[]
  /** Opened by saving the clip — offers to stop opening by itself. */
  afterSave: boolean
  onClose: () => void
  onSend: (clipId: number, input: { name: string; notes: string; prompt: string; shares: Share[] }) => Promise<boolean>
}) {
  const [name, setName] = useState(clip.name)
  const [notes, setNotes] = useState(clip.notes ?? '')
  const [prompt, setPrompt] = useState(clip.prompt ?? '')
  const [shares, setShares] = useState<Share[]>(startShares)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  // Only ever drawn in the browser (it opens on a tap), so storage is there to read.
  const [askAfter, setAskAfter] = useState(() => {
    try {
      return localStorage.getItem(ASK_AFTER_CLIP_KEY) !== 'off'
    } catch {
      return true
    }
  })
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
    nameRef.current?.select()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const has = (s: Share) => shares.some((x) => x.target === s.target && x.targetId === s.targetId)
  const toggle = (s: Share) =>
    setShares((cur) => (has(s) ? cur.filter((x) => !(x.target === s.target && x.targetId === s.targetId)) : [...cur, s]))

  const groupOn = (g: ShareGroup) => has({ target: g, targetId: '' })
  const people = shares.filter((s) => !isShareGroup(s.target))
  const nameOf = (s: Share) => recipients.find((r) => r.kind === s.target && r.id === s.targetId)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return recipients
      .filter((r) => !has({ target: r.kind, targetId: r.id }))
      .filter((r) => `${r.name} ${r.detail}`.toLowerCase().includes(q))
      .slice(0, 8)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, recipients, shares])

  const changed =
    name.trim() !== clip.name ||
    notes.trim() !== (clip.notes ?? '') ||
    prompt.trim() !== (clip.prompt ?? '') ||
    JSON.stringify([...shares].map((s) => `${s.target}|${s.targetId}`).sort()) !==
      JSON.stringify([...startShares].map((s) => `${s.target}|${s.targetId}`).sort())
  const newCount = shares.filter((s) => !startShares.some((x) => x.target === s.target && x.targetId === s.targetId)).length

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    const ok = await onSend(clip.id, { name: name.trim(), notes, prompt, shares })
    setBusy(false)
    if (ok) onClose()
  }

  const label = busy
    ? 'Sending…'
    : newCount > 0
      ? 'Send'
      : shares.length < startShares.length
        ? 'Save'
        : changed
          ? 'Save'
          : 'Done'

  return (
    <div className={styles.dlgBack} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className={`${styles.dlg} ${styles.sendDlg}`} onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="send-clip-title">
        <div className={styles.dlgHead}>
          <span aria-hidden>➤</span>
          <h2 id="send-clip-title">{afterSave ? 'Clip saved — send it?' : 'Send clip'}</h2>
          <button type="button" className={styles.dlgX} onClick={onClose} aria-label="Close">
            <IconClose size={13} />
          </button>
        </div>
        <p className={styles.dlgHint}>{fmtDuration(clip.end - clip.start)} of film · lands in their Film Room, ready to play</p>

        <label className={styles.dlgLabel} htmlFor="send-name">
          Name
        </label>
        <input
          id="send-name"
          ref={nameRef}
          className={styles.dlgInput}
          value={name}
          maxLength={60}
          required
          onChange={(e) => setName(e.target.value)}
        />

        <label className={styles.dlgLabel} htmlFor="send-notes">
          Coach’s notes <span>what to see</span>
        </label>
        <textarea
          id="send-notes"
          className={styles.dlgInput}
          rows={3}
          maxLength={4000}
          value={notes}
          placeholder="Watch the 2-man game up top — where does the slide come from?"
          onChange={(e) => setNotes(e.target.value)}
        />

        <label className={styles.dlgLabel} htmlFor="send-prompt">
          Ask them <span>optional — they answer from the clip</span>
        </label>
        <input
          id="send-prompt"
          className={styles.dlgInput}
          maxLength={500}
          value={prompt}
          placeholder="What would you do differently here?"
          onChange={(e) => setPrompt(e.target.value)}
        />

        <label className={styles.dlgLabel}>Send to</label>
        <div className={styles.dlgChips}>
          {SHARE_GROUPS.map((g) => (
            <button
              key={g.key}
              type="button"
              className={`${styles.fChip} ${groupOn(g.key) ? styles.fChipOn : ''}`}
              aria-pressed={groupOn(g.key)}
              onClick={() => toggle({ target: g.key, targetId: '' })}
            >
              {groupOn(g.key) ? '✓ ' : ''}
              {g.label}
            </button>
          ))}
        </div>

        <div className={styles.pickWrap}>
          <input
            className={styles.dlgInput}
            value={query}
            placeholder="Or add someone by name — a player, a parent, a coach"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                const first = matches[0]
                if (first) {
                  toggle({ target: first.kind, targetId: first.id })
                  setQuery('')
                }
              }
            }}
            aria-label="Add someone by name"
          />
          {matches.length > 0 && (
            <ul className={styles.pickList}>
              {matches.map((r) => (
                <li key={`${r.kind}:${r.id}`}>
                  <button
                    type="button"
                    className={styles.pickItem}
                    onClick={() => {
                      toggle({ target: r.kind, targetId: r.id })
                      setQuery('')
                    }}
                  >
                    <span className={styles.pickName}>{r.name}</span>
                    <span className={styles.pickDetail}>{r.detail}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query.trim() && matches.length === 0 && <p className={styles.pickNone}>Nobody by that name.</p>}
        </div>

        {people.length > 0 && (
          <div className={styles.dlgChips} style={{ marginTop: 8 }}>
            {people.map((s) => {
              const r = nameOf(s)
              return (
                <span key={`${s.target}:${s.targetId}`} className={styles.personChip}>
                  {r?.name ?? 'Someone'}
                  <span className={styles.personKind}>{s.target}</span>
                  <button type="button" onClick={() => toggle(s)} aria-label={`Remove ${r?.name ?? 'them'}`}>
                    ×
                  </button>
                </span>
              )
            })}
          </div>
        )}

        <div className={styles.dlgFoot}>
          {afterSave && (
            <label className={styles.askAfter}>
              <input
                type="checkbox"
                checked={askAfter}
                onChange={(e) => {
                  setAskAfter(e.target.checked)
                  try {
                    localStorage.setItem(ASK_AFTER_CLIP_KEY, e.target.checked ? 'on' : 'off')
                  } catch {}
                }}
              />
              Ask after every clip
            </label>
          )}
          <button type="button" className={styles.dlgLink} onClick={onClose}>
            Not now
          </button>
          <button type="submit" className={styles.saveBtn} disabled={busy || !name.trim()}>
            {label}
          </button>
        </div>
      </form>
    </div>
  )
}
