'use client'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { FieldBoard } from '@/components/planner/FieldBoard'
import { ClipPlayer } from '@/components/planner/ClipPlayer'
import { savePlayAction, deletePlayAction, saveShotAction } from '@/lib/actions'
import { addPlayToPlaybook } from '@/lib/playbookActions'
import { sectionLabel, type PlaybookSection } from '@/lib/playbook'
import { teamLabel, withTeam, type Team } from '@/lib/teams'
import type { PlaybookSpot } from '@/lib/playbookData'
import { clipLength } from '@/lib/planner'
import { EMPTY_BOARD, MAX_PLAY_STEPS, readBoard, type Board, type BoardClip, type BoardFrame, type PlayStep } from '@/lib/planner'
import { PlaybookPicker, spotLabel, teamSpots } from '@/app/admin/(hub)/library/PlaybookPicker'
import { Popover } from '@/app/admin/(hub)/library/Popover'
import { ProgressionPanel } from './Progression'

/**
 * The board you grab in a pinch.
 *
 * A coach on a sideline with thirty seconds does not want a practice plan, a
 * block and a drill — he wants a field and a marker. This is that: it opens
 * drawable, it goes full screen on one tap, and the board you were last working
 * on is still on the glass.
 *
 * Named plays go to the program, not to this browser: one drawn on the laptop
 * on Sunday has to open on the phone at practice on Monday, and every coach has
 * to be able to pull up the one the head coach drew. Only the unnamed scratch
 * board stays local, because a half-drawn thought is nobody else's business.
 *
 * Record catches the drawing as it happens — every change to the board, with
 * how far into the take it was — so the play saves as something that runs
 * rather than something that sits there. Screenshot saves a still of the field
 * to the Library, where any practice plan, note or game plan can pull it in.
 */

const SCRATCH = 'gh-playboard-v1'
/* What the board on the glass is: its name, and the saved play it is (if any).
   Kept beside the drawing, so coming back to the board brings back the title
   too, not just the lines. */
const SCRATCH_META = 'gh-playboard-open-v1'

interface OpenMeta {
  name: string
  openId: string | null
  openName: string
  /** The progression being built, and which step is on the board. */
  steps?: PlayStep[] | null
  active?: number
  /** The fingerprint of what was last saved or opened — anything else on the glass is unsaved. */
  saved?: number
}

function loadMeta(plays: SavedPlay[], board: Board): OpenMeta {
  try {
    const m = JSON.parse(localStorage.getItem(SCRATCH_META) ?? 'null') as Partial<OpenMeta> | null
    if (!m) {
      // Nothing kept yet (a board from before titles were kept): if the drawing
      // is exactly a saved play, it is that play.
      const same = plays.find((p) => JSON.stringify(p.board) === JSON.stringify(board))
      return same
        ? { name: same.name, openId: same.id, openName: same.name, steps: same.steps, active: 0 }
        : { name: '', openId: null, openName: '' }
    }
    const name = typeof m?.name === 'string' ? m.name : ''
    // A play deleted since is no longer one to update; the name stays as typed.
    const openId = typeof m?.openId === 'string' && plays.some((p) => p.id === m.openId) ? m.openId : null
    const steps = Array.isArray(m?.steps)
      ? m.steps.flatMap((x) => {
          const b = readBoard((x as PlayStep | null)?.board)
          return b ? [{ board: b, note: typeof x?.note === 'string' ? x.note : '' }] : []
        }).slice(0, MAX_PLAY_STEPS)
      : null
    const active = steps?.length ? Math.min(Math.max(0, Number(m?.active) || 0), steps.length - 1) : 0
    return {
      name,
      openId,
      openName: openId && typeof m?.openName === 'string' ? m.openName : '',
      steps: steps?.length ? steps : null,
      active,
      saved: typeof m?.saved === 'number' ? m.saved : undefined,
    }
  } catch {
    return { name: '', openId: null, openName: '' }
  }
}

export interface SavedPlay {
  id: string
  name: string
  board: Board
  clip: BoardClip | null
  /** A progression: the play as a run of steps. */
  steps: PlayStep[] | null
  createdBy: string | null
}

function loadScratch(): Board {
  try {
    const raw = localStorage.getItem(SCRATCH)
    return (raw ? readBoard(JSON.parse(raw)) : null) ?? EMPTY_BOARD
  } catch {
    return EMPTY_BOARD
  }
}

/**
 * A fingerprint of what Save would keep: the name, and the drawing (or every
 * step of a progression). Each board is read back the way storage reads it, so
 * the same play fingerprints the same after a trip through this device's
 * storage or the database. A one-step progression saves as a plain play, so it
 * counts as one.
 */
function fingerprint(name: string, board: Board, steps: PlayStep[] | null): number {
  const clean = (b: Board) => readBoard(b) ?? b
  const run = steps && steps.length > 1 ? steps.map((s) => ({ board: clean(s.board), note: s.note })) : null
  const text = JSON.stringify([name.trim(), run ?? clean(board)])
  // FNV-1a: small, quick, and plenty to tell "the same" from "changed".
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

const BLANK = fingerprint('', EMPTY_BOARD, null)

/** What the board opens to. */
interface Start {
  board: Board
  name: string
  openId: string | null
  openName: string
  steps: PlayStep[] | null
  active: number
  clip: BoardClip | null
  saved: number
  /** A play asked for in the address while the board had unsaved work: open it only on a yes. */
  ask: SavedPlay | null
  /** Where "Back to the playbook" goes, when the board was opened from a playbook page. */
  back: string | null
  /** Something to say on arrival. */
  note: string | null
}

function fromPlay(p: SavedPlay): Pick<Start, 'board' | 'name' | 'openId' | 'openName' | 'steps' | 'active' | 'clip' | 'saved'> {
  const board = p.steps?.[0]?.board ?? p.board
  return {
    board,
    name: p.name,
    openId: p.id,
    openName: p.name,
    steps: p.steps,
    active: 0,
    clip: p.clip,
    saved: fingerprint(p.name, board, p.steps),
  }
}

/** Only back to a playbook page on this site — never anywhere an address could be talked into. */
function backFrom(params: URLSearchParams): string | null {
  const raw = params.get('back')
  if (!raw) return null
  try {
    const u = new URL(raw, window.location.origin)
    if (u.origin !== window.location.origin || !/^\/admin\/playbook(\/|$)/.test(u.pathname)) return null
    return u.pathname + u.search + u.hash
  } catch {
    return null
  }
}

/**
 * The board on the glass when you arrive: whatever you left on it — brought up
 * to date if it was a saved play you hadn't touched since — unless the address
 * asks for a play (?play=, from the Library or a playbook page). That one opens,
 * but never over unsaved work without asking.
 */
function startingPoint(plays: SavedPlay[]): Start {
  const scratch = loadScratch()
  const meta = loadMeta(plays, scratch)
  const kept = plays.find((p) => p.id === meta.openId) ?? null
  const steps = meta.steps ?? null
  const now = fingerprint(meta.name, scratch, steps)
  // A board from before fingerprints were kept: clean if it is a saved play or nothing at all.
  const clean = meta.saved === undefined ? !!kept || now === BLANK : meta.saved === now || now === BLANK

  let start: Start = {
    board: scratch,
    name: meta.name,
    openId: meta.openId,
    openName: meta.openName,
    steps,
    active: meta.active ?? 0,
    clip: kept?.clip ?? null,
    // Unsaved work stays unsaved across a reload; -1 matches nothing.
    saved: clean ? now : meta.saved ?? -1,
    ask: null,
    back: null,
    note: null,
  }
  // Untouched since it was saved: show the play as it is saved now (another device may have moved it on).
  if (clean && kept) {
    const fresh = fromPlay(kept)
    start = { ...start, ...fresh, active: fresh.steps ? Math.min(start.active, fresh.steps.length - 1) : 0 }
    start.board = fresh.steps?.[start.active]?.board ?? fresh.board
  }

  try {
    const params = new URLSearchParams(window.location.search)
    start.back = backFrom(params)
    const id = params.get('play')
    if (id) {
      const asked = plays.find((p) => p.id === id)
      if (!asked) start.note = 'That play isn’t on your shelf any more.'
      // Nothing unsaved on the board, or it already is that play exactly: just open it.
      else if (clean || fingerprint(start.name, start.board, start.steps) === fromPlay(asked).saved)
        start = { ...start, ...fromPlay(asked) }
      else start.ask = asked
    }
  } catch {
    // No address to read is no play asked for.
  }
  return start
}

export default function QuickBoard({
  plays,
  ready,
  playbookTeams = [],
  spots = {},
}: {
  plays: SavedPlay[]
  ready: boolean
  /** The decks this coach may add to — empty for everyone but the head coach. */
  playbookTeams?: Team[]
  /** Play id → the playbook pages it is already on. */
  spots?: Record<string, PlaybookSpot[]>
}) {
  const [start] = useState(() => startingPoint(plays))
  const [board, setBoard] = useState<Board>(start.board)
  const [name, setName] = useState(start.name)
  const [openId, setOpenId] = useState<string | null>(start.openId)
  /* The name the open play was saved under. Type a different one and Save
     makes a new play, so the playbook links below stop pointing at the old one. */
  const [openName, setOpenName] = useState(start.openName)
  /* The progression, when the play is being built as steps. The board above is
     always the picked step; drawing on it changes that step. */
  const [steps, setSteps] = useState<PlayStep[] | null>(start.steps)
  const [active, setActive] = useState(start.active)
  /** The fingerprint of what was last saved or opened. */
  const [saved, setSaved] = useState(start.saved)
  /** A take recorded since the last save — the fingerprint doesn't cover takes. */
  const [newTake, setNewTake] = useState(false)
  const [ask, setAsk] = useState<SavedPlay | null>(start.ask)
  const back = start.back
  const [added, setAdded] = useState<Record<string, PlaybookSpot[]>>({})
  const [said, setSaid] = useState<{ ok: boolean; text: string; href?: string; link?: string; primary?: boolean } | null>(
    start.note ? { ok: false, text: start.note } : null
  )
  const [saving, startSaving] = useTransition()

  /* The take. While recording, every change to the board lands in here with the
     millisecond it happened, which is the whole recording — no timer, no
     frames anybody has to think about. */
  const [recording, setRecording] = useState(false)
  const [clip, setClip] = useState<BoardClip | null>(start.clip)
  const [watching, setWatching] = useState(false)
  const frames = useRef<BoardFrame[]>([])
  const startedAt = useRef(0)
  const [shot, setShot] = useState<string | null>(null)
  /* The recent saves, behind one button. A row of chips was fine at two plays
     and a wall at twenty. */
  const [openList, setOpenList] = useState(false)
  const [find, setFind] = useState('')

  const now = useMemo(() => fingerprint(name, board, steps), [name, board, steps])
  const dirty = newTake || (now !== saved && now !== BLANK)

  /** Every change to the board goes through here, so recording is simply on or off. */
  function change(next: Board) {
    setBoard(next)
    if (steps) setSteps(steps.map((x, i) => (i === active ? { ...x, board: next } : x)))
    if (recording) {
      const at = Date.now() - startedAt.current
      // A take is thirty seconds of drawing, not an afternoon. Past the cap the
      // recording stops growing rather than filling the browser's memory.
      if (frames.current.length < 600) frames.current.push({ at, board: next })
    }
  }

  function startRecording() {
    frames.current = [{ at: 0, board }]
    startedAt.current = Date.now()
    setClip(null)
    setWatching(false)
    setRecording(true)
  }

  function stopRecording() {
    setRecording(false)
    const taken = frames.current
    // One frame is a still, and the board already is that.
    if (taken.length < 2) {
      setClip(null)
      return
    }
    setClip({ frames: [...taken, { at: Date.now() - startedAt.current, board }] })
    setNewTake(true)
  }

  /** A picture of the field, straight into the Library. */
  async function keepShot(png: Blob) {
    setShot('Saving…')
    try {
      const data = new FormData()
      data.set('file', new File([png], 'board.png', { type: 'image/png' }))
      data.set('folder', 'library')
      const res = await fetch('/api/upload', { method: 'POST', body: data })
      const body = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !body.url) {
        setShot(body.error ?? 'That picture would not save.')
        return
      }
      const row = new FormData()
      row.set('url', body.url)
      row.set('title', name.trim() || 'Board screenshot')
      await saveShotAction(row)
      setShot('Saved to the Library')
    } catch {
      setShot('That picture would not save.')
    }
  }

  /* The play asked for in the address has been dealt with (opened, or the
     board kept): take it out, so a reload doesn't ask again. ?back= stays. */
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      if (!url.searchParams.has('play')) return
      url.searchParams.delete('play')
      window.history.replaceState(null, '', url.pathname + url.search + url.hash)
    } catch {
      // Leaving the address alone is harmless.
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(SCRATCH, JSON.stringify(board))
    } catch {
      // A full or blocked store is not a reason to stop drawing.
    }
  }, [board])

  useEffect(() => {
    try {
      localStorage.setItem(SCRATCH_META, JSON.stringify({ name, openId, openName, steps, active, saved } satisfies OpenMeta))
    } catch {
      // as above
    }
  }, [name, openId, openName, steps, active, saved])

  /** The open play, if what is on the glass is still saved under its name. */
  const currentId = openId && openName === name.trim() ? openId : null
  const spotsFor = (id: string | null) => {
    if (!id) return []
    const all = [...(spots[id] ?? []), ...(added[id] ?? [])]
    return all.filter((s, i) => all.findIndex((x) => x.pageId === s.pageId) === i)
  }
  const here = spotsFor(currentId)
  const many = steps && steps.length > 1 ? steps.length : 0

  /** What is about to be kept, as of this tap. */
  function snapshot() {
    return { name: name.trim(), print: now, many }
  }

  function save() {
    if (!name.trim() || !ready) return
    const was = snapshot()
    const data = new FormData()
    data.set('name', was.name)
    data.set('board', JSON.stringify(board))
    if (clip) data.set('clip', JSON.stringify(clip))
    data.set('steps', many ? JSON.stringify(steps) : '')
    setSaid(null)
    startSaving(async () => {
      const r = await savePlayAction(data)
      if (!r?.id) {
        setSaid({ ok: false, text: 'That didn’t save. Try again.' })
        return
      }
      setOpenId(r.id)
      setOpenName(was.name)
      setSaved(was.print)
      setNewTake(false)
      setAsk(null)
      const books = r.playbooks ?? []
      if (back && books.length) {
        setSaid({ ok: true, text: 'Updated — the playbook pages are up to date.', href: back, link: 'Back to the page', primary: true })
        return
      }
      const list = books.map((t) => `${teamLabel(t)} playbook`).join(' and ')
      setSaid({
        ok: true,
        text: `Saved “${was.name}”${was.many ? `, all ${was.many} steps` : ''}. ${
          list ? `The ${list} ${books.length > 1 ? 'are' : 'is'} up to date too.` : 'It’s under Open and in the Library.'
        }`,
        ...(back ? { href: back, link: 'Back to the page' } : {}),
      })
    })
  }

  /* The other button. The Library is a shelf; the playbook is what we run.
     Saves the play, gives it pages in that team's playbook, in the section
     picked (or finds the ones it already has), and stays here with a link. */
  async function toPlaybook(team: Team, section: PlaybookSection): Promise<string | null> {
    if (!ready) return 'Plays can’t be saved yet.'
    if (!name.trim()) return 'Name the play first.'
    const was = snapshot()
    setSaid(null)
    const r = await addPlayToPlaybook({
      team,
      section,
      name: was.name,
      board: JSON.stringify(board),
      clip: clip ? JSON.stringify(clip) : null,
      steps: was.many ? JSON.stringify(steps) : null,
    })
    if (!r.ok) return r.error
    setOpenId(r.playId)
    setOpenName(was.name)
    setSaved(was.print)
    setNewTake(false)
    setAdded((x) => ({ ...x, [r.playId]: [...(x[r.playId] ?? []), { team: r.team, pageId: r.pageId, section }] }))
    setSaid({
      ok: true,
      text: `“${was.name}” is in the ${teamLabel(r.team)} playbook, under ${sectionLabel(section)}${
        was.many ? ` — ${was.many} pages` : ''
      }.${r.note}`,
      href: withTeam(`/admin/playbook/${r.pageId}`, r.team),
      link: was.many ? 'Open the first page →' : 'Open its page →',
    })
    return null
  }

  // ── Progression ─────────────────────────────────────────────────────────

  /** Put a step on the board. */
  function pick(i: number, list: PlayStep[] | null = steps) {
    if (!list?.[i]) return
    setActive(i)
    setBoard(list[i].board)
    setWatching(false)
  }

  function startProgression() {
    setSteps([{ board, note: '' }])
    setActive(0)
  }

  /** The next step starts as a copy of this one: move the players, draw what happens next. */
  function addStep() {
    if (!steps || steps.length >= MAX_PLAY_STEPS) return
    const next = [...steps.slice(0, active + 1), { board, note: '' }, ...steps.slice(active + 1)]
    setSteps(next)
    pick(active + 1, next)
  }

  function copyStep(i: number) {
    if (!steps || steps.length >= MAX_PLAY_STEPS) return
    const next = [...steps.slice(0, i + 1), { ...steps[i] }, ...steps.slice(i + 1)]
    setSteps(next)
    pick(i + 1, next)
  }

  function moveStep(i: number, to: number) {
    if (!steps || to < 0 || to >= steps.length) return
    const next = [...steps]
    const [s] = next.splice(i, 1)
    next.splice(to, 0, s)
    setSteps(next)
    // The picked step stays picked wherever it went.
    setActive(active === i ? to : active === to ? i : active)
  }

  function deleteStep(i: number) {
    if (!steps || steps.length < 2) return
    const next = steps.filter((_, k) => k !== i)
    setSteps(next)
    pick(Math.min(i === active ? i : active > i ? active - 1 : active, next.length - 1), next)
  }

  function noteStep(note: string) {
    if (steps) setSteps(steps.map((x, i) => (i === active ? { ...x, note } : x)))
  }

  /** Back to one play: the step on the board is what stays. */
  function endProgression() {
    if (steps && steps.length > 1 && !window.confirm(`Keep only step ${active + 1} and drop the other ${steps.length - 1}?`)) return
    setSteps(null)
    setActive(0)
  }

  // ── Opening and clearing ────────────────────────────────────────────────

  /** Unsaved work goes only on a yes. */
  function mayDiscard(what: string): boolean {
    return !dirty || window.confirm(`The board has changes you haven’t saved. ${what}`)
  }

  function open(play: SavedPlay) {
    const p = fromPlay(play)
    setBoard(p.board)
    setSteps(p.steps)
    setActive(0)
    setOpenId(p.openId)
    setOpenName(p.openName)
    setName(p.name)
    setSaved(p.saved)
    setNewTake(false)
    setSaid(null)
    setClip(p.clip)
    setWatching(false)
    setRecording(false)
    setAsk(null)
    setOpenList(false)
  }

  function openFromList(play: SavedPlay) {
    const again = play.id === currentId
    if (!mayDiscard(again ? `Throw them away and open the saved “${play.name}”?` : `Open “${play.name}” anyway?`)) return
    open(play)
  }

  function clearBoard() {
    if (!mayDiscard('Clear it anyway?')) return
    setBoard(EMPTY_BOARD)
    setSteps(null)
    setActive(0)
    setOpenId(null)
    setOpenName('')
    setSaved(BLANK)
    setNewTake(false)
    setSaid(null)
    setName('')
    setClip(null)
    setWatching(false)
    setRecording(false)
    setAsk(null)
  }

  const q = find.trim().toLowerCase()
  const listed = q ? plays.filter((p) => p.name.toLowerCase().includes(q)) : plays
  const saveLabel = saving ? 'Saving…' : currentId ? 'Update' : openId && name.trim() ? 'Save as new' : 'Save'

  return (
    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {back && (
          <Link href={back} className="text-sm font-bold text-[var(--gh-green)] whitespace-nowrap mr-1">
            ← Back to the playbook
          </Link>
        )}
        <h1 className="font-black text-lg mr-2">Playboard</h1>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save() } }}
          placeholder="Name this play"
          aria-label="Play name"
          className="field !py-1.5 !w-44 text-sm"
        />
        <span className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={save}
            disabled={!name.trim() || saving || !ready}
            title={
              currentId
                ? many && here.length
                  ? 'Save the changes — its playbook pages update too'
                  : 'Save the changes'
                : openId && name.trim()
                  ? `A new name makes a new play; “${openName}” stays as it was`
                  : undefined
            }
            className="btn btn-primary !py-1.5 text-sm disabled:opacity-50"
          >
            {saveLabel}
          </button>
          {dirty && !saving && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700" title="Changes you haven’t saved">
              <span aria-hidden className="w-2 h-2 rounded-full bg-amber-500" />
              Unsaved
            </span>
          )}
        </span>
        {playbookTeams.length > 0 && (
          <PlaybookPicker
            size="md"
            teams={playbookTeams}
            spots={here}
            steps={many}
            onAdd={toPlaybook}
            blocked={!ready ? 'Run the plays SQL first.' : !name.trim() ? 'Name the play first.' : null}
            hint={many && here.length ? 'Update keeps its pages current' : undefined}
          />
        )}
        <button type="button" onClick={clearBoard} className="btn btn-ghost !py-1.5 text-sm">
          New
        </button>
        {/* Recent saves, one tap away, newest first. */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenList(!openList)}
            aria-expanded={openList}
            aria-haspopup="dialog"
            disabled={plays.length === 0}
            className="btn btn-ghost !py-1.5 text-sm disabled:opacity-40"
            title={plays.length ? 'Open a play you saved' : 'Nothing saved yet'}
          >
            Open{plays.length > 0 && <span className="text-gray-400"> · {plays.length}</span>} ▾
          </button>

          <Popover open={openList} onClose={() => setOpenList(false)} label="Your plays">
            <div className="sticky top-0 bg-white px-3 pt-2.5 pb-2 border-b border-gray-100 space-y-2">
              <div className="text-[0.65rem] font-black tracking-wider uppercase text-gray-400">Your plays · newest first</div>
              {plays.length > 8 && (
                <input
                  type="search"
                  value={find}
                  onChange={(e) => setFind(e.target.value)}
                  placeholder="Find a play"
                  aria-label="Find a play"
                  className="field !py-1.5 text-sm"
                />
              )}
            </div>
            {listed.length === 0 && <p className="px-3 py-3 text-sm text-gray-400">No play called that.</p>}
            {listed.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-1 px-1.5 hover:bg-gray-50"
                style={{ background: openId === p.id ? '#f0f4f1' : undefined }}
              >
                <button
                  type="button"
                  onClick={() => openFromList(p)}
                  title={p.createdBy ? `Drawn by ${p.createdBy}` : undefined}
                  className="flex-1 min-w-0 text-left px-2 py-2"
                >
                  <span className="block text-sm font-semibold truncate">{p.name}</span>
                  <PlayTags play={p} spots={teamSpots(spotsFor(p.id))} />
                </button>
                <form
                  action={deletePlayAction}
                  onSubmit={(e) => {
                    if (!window.confirm(`Delete “${p.name}”? It comes out of the Library too.`)) {
                      e.preventDefault()
                      return
                    }
                    if (openId === p.id) {
                      // Still on the glass, but no longer saved anywhere.
                      setOpenId(null)
                      setSaved(-1)
                    }
                  }}
                >
                  <input type="hidden" name="id" value={p.id} />
                  <button
                    type="submit"
                    aria-label={`Delete ${p.name}`}
                    className="w-9 h-9 text-gray-300 hover:text-[var(--gh-maroon)]"
                  >
                    ×
                  </button>
                </form>
              </div>
            ))}
            <Link
              href="/admin/library"
              onClick={() => setOpenList(false)}
              className="block px-3 py-2.5 text-sm font-bold border-t border-gray-100"
              style={{ color: 'var(--gh-green)' }}
            >
              Everything in the Library →
            </Link>
          </Popover>
        </div>

        <Link
          href="/admin/library"
          className="btn btn-ghost !py-1.5 text-sm"
          title="Every play, every recording, every screenshot"
        >
          Library
        </Link>

        <span className="hidden md:inline text-xs text-gray-400 ml-auto">
          {ready ? 'Saved plays open on any device, for every coach' : 'Run the plays SQL to save plays'}
        </span>
      </div>

      {ask && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 flex flex-wrap items-center gap-2" role="alert">
          <p className="text-sm font-semibold text-amber-900 flex-1 min-w-[12rem]">
            {ask.id === openId
              ? `You have changes to “${ask.name}” you haven’t saved.`
              : `The board has changes you haven’t saved${name.trim() ? ` (“${name.trim()}”)` : ''}.`}
          </p>
          <button type="button" onClick={() => open(ask)} className="btn btn-primary !py-1.5 text-sm">
            {ask.id === openId ? 'Open the saved one' : `Open “${ask.name}”`}
          </button>
          <button type="button" onClick={() => setAsk(null)} className="btn btn-ghost !py-1.5 text-sm">
            {ask.id === openId ? 'Keep my changes' : 'Keep my board'}
          </button>
        </div>
      )}

      {said && (
        <div
          className={`text-sm font-semibold -mt-1 flex flex-wrap items-center gap-x-2 gap-y-1.5 ${said.ok ? 'text-[var(--gh-green)]' : 'text-red-700'}`}
          role="status"
        >
          <span>
            {said.ok && '✓ '}
            {said.text}
          </span>
          {said.href && (
            <Link href={said.href} className={said.primary ? 'btn btn-primary !py-1 text-sm' : 'underline'}>
              {said.link}
            </Link>
          )}
        </div>
      )}
      {shot && <p className="text-xs text-gray-500 -mt-1">{shot}</p>}

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0 min-h-0">
        {steps && (
          <p className="text-xs font-bold text-[var(--gh-green)] mb-1">
            Step {active + 1} of {steps.length}
            {steps[active]?.note ? ` · ${steps[active].note}` : ''}
          </p>
        )}
        {watching && clip ? (
          <ClipPlayer clip={clip} autoPlay />
        ) : (
          <FieldBoard
            board={board}
            onChange={change}
            onShot={keepShot}
            extraTools={
              <>
                <button
                  type="button"
                  onClick={recording ? stopRecording : startRecording}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold border"
                  style={{
                    borderColor: recording ? 'var(--gh-maroon)' : '#e5e7eb',
                    background: recording ? 'var(--gh-maroon)' : '#fff',
                    color: recording ? '#fff' : '#6b7280',
                  }}
                  title={recording ? 'Stop recording this play' : 'Record the play as you draw it'}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                    style={{ background: recording ? '#fff' : 'var(--gh-maroon)' }}
                  />
                  {recording ? 'Stop' : 'Record'}
                </button>
                {clip && !recording && (
                  <button
                    type="button"
                    onClick={() => setWatching(true)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50"
                    title="Watch the take back"
                  >
                    Play it back
                  </button>
                )}
              </>
            }
          />
        )}
        </div>
        <ProgressionPanel
          steps={steps}
          active={active}
          onStart={startProgression}
          onPick={(i) => pick(i)}
          onAdd={addStep}
          onMove={moveStep}
          onCopy={copyStep}
          onDelete={deleteStep}
          onNote={noteStep}
          onEnd={endProgression}
        />
      </div>

      {watching && (
        <button
          type="button"
          onClick={() => setWatching(false)}
          className="btn btn-ghost !py-1.5 text-sm self-start"
        >
          Back to drawing
        </button>
      )}
    </div>
  )
}

/** The small print under a play in the Open list: its take, its steps, where it is in the playbook. */
function PlayTags({ play, spots }: { play: SavedPlay; spots: PlaybookSpot[] }) {
  const tags = [
    ...(play.steps && play.steps.length > 1 ? [`${play.steps.length} steps`] : []),
    ...(play.clip ? [`▶ ${(clipLength(play.clip) / 1000).toFixed(0)}s`] : []),
  ]
  if (!tags.length && !spots.length) return null
  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-1">
      {tags.map((t) => (
        <span key={t} className="text-[0.65rem] font-black text-gray-400 mr-1">
          {t}
        </span>
      ))}
      {spots.map((s) => (
        <span
          key={s.team}
          className="text-[0.6rem] font-black uppercase tracking-wide rounded px-1 py-0.5 bg-[#eef6f1] text-[var(--gh-green)]"
        >
          {spotLabel(s)}
        </span>
      ))}
    </span>
  )
}
