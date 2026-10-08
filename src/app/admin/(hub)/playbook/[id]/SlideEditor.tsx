'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { SlidePlay } from '@/components/playbook/BlockArt'
import { arrangeSlides, createSlide, deleteSlides, duplicateSlides } from '@/lib/playbookActions'
import {
  PLAYBOOK_SECTIONS,
  autoFrames,
  deckRuns,
  isPlaybookSection,
  orderedDeck,
  startingBlocks,
  stepOf,
  type PageKind,
  type PageLayout,
  type PlaybookPage,
  type PlaybookSection,
  type SlideBlock,
} from '@/lib/playbook'
import { withTeam, type Team } from '@/lib/teams'
import { Filmstrip, type DropTarget } from './Filmstrip'
import { NewSlideMenu, SlideMenu, anchorUnder, type Anchor, type NewKind } from './Menus'
import { PageEditor, type Shot } from './PageEditor'
import type { ToPlayboard } from './KindEditors'
import { useAutosave, type SaveState, type SlidePatch } from './useAutosave'

/** A saved play, and how many steps it has if it is a progression (0 if not). */
export interface EditorPlay extends SlidePlay {
  steps: number
}

/** What undo puts back: the page's contents and how it is laid out. */
interface Snapshot {
  blocks: SlideBlock[]
  layout: PageLayout
}
interface History {
  undo: Snapshot[]
  redo: Snapshot[]
  /** When the last change came in. A burst of changes (a drag, a sentence) is one step. */
  at: number
}
const BURST_MS = 600
/* Only ever read while handling a change, never during render; out here so
   the compiler can see the component itself stays pure. */
const clock = () => Date.now()
const HISTORY_MAX = 100

type Menu =
  | { kind: 'slide'; id: string; at: Anchor }
  | { kind: 'new'; section: PlaybookSection | null; afterId: string | null; at: Anchor }

const typing = (el: Element | null) =>
  !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || (el as HTMLElement).isContentEditable)

/** The deck's order by sort order alone — the order the server keeps and renumbers. */
const bySort = (pages: PlaybookPage[]) => [...pages].sort((a, b) => a.sortOrder - b.sortOrder)

/** The run (a progression's pages, or the one page) a page moves with. */
function runIn(flat: PlaybookPage[], id: string) {
  const runs = deckRuns(flat)
  const i = runs.findIndex((r) => r.pages.some((p) => p.id === id))
  return { runs, i, ids: i >= 0 ? runs[i].pages.map((p) => p.id) : [id] }
}

/** Pages renumbered to an order of ids, touching only the ones that changed. */
function renumber(pages: PlaybookPage[], order: string[], sections: Record<string, PlaybookSection | null> = {}): PlaybookPage[] {
  const at = new Map(order.map((id, i) => [id, i + 1]))
  return pages.map((p) => {
    const sortOrder = at.get(p.id) ?? p.sortOrder
    const section = p.id in sections ? sections[p.id] : p.section
    return sortOrder === p.sortOrder && section === p.section ? p : { ...p, sortOrder, section }
  })
}

/**
 * The slide editor, shaped like Google Slides.
 *
 * Every page of this team's playbook down the side, the page being made in the
 * middle, and a bar across the top: back to the deck, the title, its section,
 * Present from here, previous and next. Nothing has a Save button — a change
 * is written a moment after it is made, and the bar says so quietly.
 *
 * The whole deck is held here, so moving between pages is instant: the address
 * is swapped in place (a refresh lands on the same page) without the server
 * being asked for anything.
 */
export function SlideEditor({
  team,
  pages,
  initialId,
  plays,
  shots,
}: {
  team: Team
  pages: PlaybookPage[]
  initialId: string
  plays: EditorPlay[]
  shots: Shot[]
}) {
  const router = useRouter()
  const save = useAutosave()

  /* Every block placed, as the page editor has always opened a page — so an
     older laid-out page can be taken over by hand without a pile-up. */
  const [deck, setDeckState] = useState<PlaybookPage[]>(() => pages.map((p) => ({ ...p, blocks: autoFrames(p.blocks, p.layout) })))
  const deckRef = useRef(deck)
  const [currentId, setCurrentId] = useState(initialId)
  const [selected, setSelected] = useState<string | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [adding, setAdding] = useState(false)
  const history = useRef(new Map<string, History>())
  const [canUndo, setCanUndo] = useState({ undo: 0, redo: 0 })

  const flat = useMemo(() => orderedDeck(deck), [deck])
  const at = flat.findIndex((p) => p.id === currentId)
  const page = at >= 0 ? flat[at] : null
  // The strip can trail a keystroke behind the page; the page never does.
  const strip = useDeferredValue(flat)
  const playMap = useMemo(() => Object.fromEntries(plays.map((p) => [p.id, p])), [plays])

  const deckUrl = withTeam('/admin/playbook', team)
  const pageUrl = (id: string) => withTeam(`/admin/playbook/${id}`, team)

  function setDeck(next: PlaybookPage[]) {
    deckRef.current = next
    setDeckState(next)
  }
  const find = (id: string) => deckRef.current.find((p) => p.id === id) ?? null
  const historyOf = (id: string) => {
    let h = history.current.get(id)
    if (!h) history.current.set(id, (h = { undo: [], redo: [], at: 0 }))
    return h
  }

  // ── Changing a page ──────────────────────────────────────────────────────

  /** Apply a change to a page and queue it to be written. */
  function apply(id: string, patch: SlidePatch) {
    setDeck(deckRef.current.map((p) => (p.id === id ? { ...p, ...patch } : p)))
    save.queue(id, patch)
  }

  /** A change to what is on the page, which undo can take back. */
  function edit(id: string, patch: Pick<SlidePatch, 'blocks' | 'layout'>) {
    const cur = find(id)
    if (!cur) return
    const h = historyOf(id)
    const now = clock()
    /* Something put on or taken off, or a new layout, is always a step of its
       own — a delete straight after a drag shouldn't be undone with it. */
    const ids = (bs: SlideBlock[]) => bs.map((b) => b.id).join()
    const structural = (patch.layout !== undefined && patch.layout !== cur.layout) || (!!patch.blocks && ids(patch.blocks) !== ids(cur.blocks))
    if (structural || now - h.at > BURST_MS) {
      h.undo.push({ blocks: cur.blocks, layout: cur.layout })
      if (h.undo.length > HISTORY_MAX) h.undo.shift()
    }
    h.at = structural ? 0 : now
    h.redo = []
    apply(id, patch)
    setCanUndo({ undo: h.undo.length, redo: 0 })
  }

  function step(dir: 'undo' | 'redo') {
    const cur = page && find(page.id)
    if (!cur) return
    const h = historyOf(cur.id)
    const snap = (dir === 'undo' ? h.undo : h.redo).pop()
    if (!snap) return
    ;(dir === 'undo' ? h.redo : h.undo).push({ blocks: cur.blocks, layout: cur.layout })
    h.at = 0
    apply(cur.id, snap)
    setCanUndo({ undo: h.undo.length, redo: h.redo.length })
  }

  // ── Moving round the deck ────────────────────────────────────────────────

  function open(id: string) {
    if (id === currentId || !find(id)) return
    void save.flush()
    setCurrentId(id)
    setSelected(null)
    setDrawing(false)
    setMenu(null)
    const h = history.current.get(id)
    setCanUndo({ undo: h?.undo.length ?? 0, redo: h?.redo.length ?? 0 })
    // The address follows, so a refresh or a shared link opens this page.
    window.history.replaceState(null, '', pageUrl(id))
  }

  /** Leave the editor once everything is written. */
  async function go(href: string) {
    const ok = await save.flush()
    if (!ok && !window.confirm('Some changes didn’t save. Leave anyway?')) return
    router.push(href)
  }
  const to: ToPlayboard = {
    href: (playId) => `/admin/playboard?play=${encodeURIComponent(playId)}&back=${encodeURIComponent(page ? pageUrl(page.id) : deckUrl)}`,
    go: (href) => void go(href),
  }

  // ── Arranging ────────────────────────────────────────────────────────────

  /** Move pages (a whole progression run moves together) to a spot in the deck. */
  function place(ids: string[], target: DropTarget) {
    const flatIds = orderedDeck(deckRef.current).map((p) => p.id)
    const moving = flatIds.filter((id) => ids.includes(id))
    const rest = flatIds.filter((id) => !ids.includes(id))
    let at = target.beforeId ? rest.indexOf(target.beforeId) : -1
    if (at < 0) {
      // The end of the section: after its last page that isn't moving.
      const last = rest.reduce((n, id, i) => ((find(id)?.section ?? null) === target.section ? i : n), -1)
      at = last >= 0 ? last + 1 : rest.length
    }
    const order = [...rest.slice(0, at), ...moving, ...rest.slice(at)]
    const sections: Record<string, PlaybookSection | null> = {}
    for (const id of moving) if ((find(id)?.section ?? null) !== target.section) sections[id] = target.section
    if (order.join() === flatIds.join() && !Object.keys(sections).length) return
    setDeck(renumber(deckRef.current, order, sections))
    void save.act(() => arrangeSlides({ team, order, sections }))
  }

  const runOf = (id: string) => runIn(orderedDeck(deckRef.current), id)

  function moveBy(id: string, by: -1 | 1) {
    const { runs, i, ids } = runOf(id)
    if (by < 0) {
      const prev = runs[i - 1]
      if (prev) place(ids, { section: prev.pages[0].section, beforeId: prev.pages[0].id })
      return
    }
    const next = runs[i + 1]
    if (!next) return
    const after = runs[i + 2]
    const section = next.pages[0].section
    place(ids, { section, beforeId: after && after.pages[0].section === section ? after.pages[0].id : null })
  }

  function moveToSection(id: string, section: PlaybookSection | null) {
    if ((find(id)?.section ?? null) === section) return
    place(runOf(id).ids, { section, beforeId: null })
  }

  // ── Adding and taking away ───────────────────────────────────────────────

  async function create(kind: NewKind, section: PlaybookSection | null, afterId: string | null) {
    if (adding) return
    setAdding(true)
    const res = await save.act(() => createSlide({ team, kind, section, afterId }))
    setAdding(false)
    if (!res?.ok) return
    // The same page the server just made, so there's no round trip to show it.
    const half = kind === 'field-half'
    const k: PageKind = kind === 'field-half' ? 'field' : kind
    const fresh: PlaybookPage = {
      id: res.id,
      team,
      sortOrder: 0,
      section,
      title: k === 'words' ? 'New section' : k === 'picture' ? 'Picture' : half ? 'Half field' : 'New play',
      blocks: autoFrames(startingBlocks(k, { half }), k),
      layout: k,
      notes: null,
      createdBy: null,
      updatedAt: '',
    }
    const ids = bySort(deckRef.current).map((p) => p.id)
    const after = afterId ? ids.indexOf(afterId) : -1
    const order = after >= 0 ? [...ids.slice(0, after + 1), fresh.id, ...ids.slice(after + 1)] : [...ids, fresh.id]
    setDeck(renumber([...deckRef.current, fresh], order))
    open(fresh.id)
  }

  async function duplicate(id: string) {
    const src = find(id)
    if (!src) return
    // The copy is made from what the server has, so it has to have all of it first.
    await save.flush()
    const res = await save.act(() => duplicateSlides({ ids: [id] }))
    const copyId = res?.ok ? res.ids[0] : null
    if (!copyId) return
    const now = find(id) ?? src
    const copy: PlaybookPage = {
      ...now,
      id: copyId,
      title: `${now.title} (copy)`.slice(0, 200),
      // A copy is the page's own: no longer a step of its progression.
      blocks: now.blocks.map((b) => {
        if (b.kind !== 'play' || b.step === undefined) return b
        const { step: _step, ...rest } = b
        return rest
      }),
    }
    const ids = bySort(deckRef.current).map((p) => p.id)
    const i = ids.indexOf(id)
    setDeck(renumber([...deckRef.current, copy], [...ids.slice(0, i + 1), copyId, ...ids.slice(i + 1)]))
    open(copyId)
  }

  function remove(id: string) {
    const doomed = find(id)
    if (!doomed) return
    const hasPlay = doomed.blocks.some((b) => b.kind === 'play' && b.playId)
    if (!window.confirm(`Delete “${doomed.title || 'this page'}”?${hasPlay ? ' The play stays in the Library.' : ''}`)) return
    save.drop(id)
    history.current.delete(id)
    const ids = orderedDeck(deckRef.current).map((p) => p.id)
    const i = ids.indexOf(id)
    const next = ids[i + 1] ?? ids[i - 1] ?? null
    if (id === currentId) {
      if (!next) {
        // The last page: back to the (empty) deck, and take it out on the way.
        void save.flush().then(() => deleteSlides({ ids: [id] }))
        router.push(deckUrl)
        return
      }
      // Off the page first, so nothing asks the server for a page that's gone.
      open(next)
    }
    setDeck(deckRef.current.filter((p) => p.id !== id))
    void save.act(() => deleteSlides({ ids: [id] }))
  }

  // ── Keys ─────────────────────────────────────────────────────────────────

  /* ← → and Page Up / Down turn the page, Ctrl+Z / ⌘Z undo — unless a box is
     being typed in, something on the page is picked up (arrows nudge it), a
     field is open full screen (it has its own keys) or a menu is open. */
  const onKey = (e: KeyboardEvent) => {
    if (drawing || menu || e.defaultPrevented || typing(document.activeElement)) return
    const mod = e.metaKey || e.ctrlKey
    if (mod && !e.altKey && (e.key === 'z' || e.key === 'Z' || e.key === 'y')) {
      e.preventDefault()
      step(e.key === 'y' || e.shiftKey ? 'redo' : 'undo')
      return
    }
    if (mod || e.altKey || selected) return
    const dir = e.key === 'ArrowLeft' || e.key === 'PageUp' ? -1 : e.key === 'ArrowRight' || e.key === 'PageDown' ? 1 : 0
    if (!dir) return
    const target = flat[at + dir]
    if (target) {
      e.preventDefault()
      open(target.id)
    }
  }
  const keyRef = useRef(onKey)
  useEffect(() => {
    keyRef.current = onKey
  })
  useEffect(() => {
    const key = (e: KeyboardEvent) => keyRef.current(e)
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  // ── Drawing it ───────────────────────────────────────────────────────────

  if (!page) {
    return (
      <div className="card p-6 text-sm text-gray-500">
        That page isn&rsquo;t in the playbook any more.{' '}
        <Link href={deckUrl} className="font-bold text-[var(--gh-green)]">Back to the playbook</Link>
      </div>
    )
  }

  const id = page.id
  const presentUrl = withTeam(`/admin/playbook/present?from=${id}`, team)
  const prev = flat[at - 1] ?? null
  const next = flat[at + 1] ?? null
  const runIds = runIn(flat, id)
  const progression = progressionOf(page, flat, playMap)
  const leave = (href: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    void go(href)
  }
  const menuPage = menu?.kind === 'slide' ? flat.find((p) => p.id === menu.id) ?? null : null
  const menuRun = menuPage ? runIn(flat, menuPage.id) : null

  return (
    <div>
      {/* ── The bar across the top ── */}
      <div className="mb-3 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Link href={deckUrl} onClick={leave(deckUrl)} className="text-sm font-bold text-[var(--gh-green)] shrink-0 pr-1" aria-label="Back to the playbook">
            ←<span className="hidden sm:inline"> Playbook</span>
          </Link>
          <SaveStatus state={save.state} error={save.error} onRetry={() => void save.flush()} />
          {canUndo.undo > 0 && (
            <button type="button" onClick={() => step('undo')} className="h-8 w-8 shrink-0 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800" aria-label="Undo" title="Undo (Ctrl+Z)">↶</button>
          )}
          {canUndo.redo > 0 && (
            <button type="button" onClick={() => step('redo')} className="h-8 w-8 shrink-0 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800" aria-label="Redo" title="Redo (Ctrl+Shift+Z)">↷</button>
          )}
          <div className="flex items-center shrink-0 rounded-lg border border-gray-200 bg-white">
            <button type="button" disabled={!prev} onClick={() => prev && open(prev.id)} className="h-8 w-8 text-gray-600 disabled:text-gray-300" aria-label="Previous page" title="Previous page (←)">‹</button>
            <span className="text-xs tabular-nums text-gray-500 min-w-[2.75rem] text-center">{at + 1} / {flat.length}</span>
            <button type="button" disabled={!next} onClick={() => next && open(next.id)} className="h-8 w-8 text-gray-600 disabled:text-gray-300" aria-label="Next page" title="Next page (→)">›</button>
          </div>
          <Link href={presentUrl} onClick={leave(presentUrl)} className="btn btn-primary !py-1.5 !px-3 text-sm shrink-0" title="Present from this page">
            ▶<span className="hidden sm:inline ml-1.5">Present</span>
          </Link>
          <button
            type="button"
            onClick={(e) => setMenu({ kind: 'slide', id, at: anchorUnder(e.currentTarget) })}
            className="h-8 w-8 shrink-0 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Page options"
          >
            ⋯
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={page.title}
            onChange={(e) => apply(id, { title: e.target.value })}
            placeholder={page.layout === 'words' ? 'The heading — e.g. Man-up offense' : 'Name this page'}
            aria-label="Page title"
            maxLength={200}
            className="flex-1 min-w-0 bg-transparent text-lg sm:text-xl font-black rounded-lg px-2 py-1 -ml-2 border border-transparent hover:border-gray-200 focus:border-[var(--gh-green)] focus:outline-none focus:bg-white"
          />
          <select
            value={page.section ?? ''}
            onChange={(e) => moveToSection(id, isPlaybookSection(e.target.value) ? e.target.value : null)}
            aria-label="Section"
            title={runIds.ids.length > 1 ? 'Moves every step of this progression' : 'Which section of the playbook'}
            className="field !py-1 !w-auto max-w-[9.5rem] text-sm shrink-0"
          >
            {PLAYBOOK_SECTIONS.map((s) => (
              <option key={s.key} value={s.key}>{s.icon} {s.label}</option>
            ))}
            <option value="">Not sorted</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 lg:gap-5 items-start">
        <Filmstrip
          pages={strip}
          plays={playMap}
          currentId={id}
          adding={adding}
          onOpen={open}
          onMenu={(pid, a) => setMenu({ kind: 'slide', id: pid, at: a })}
          onNew={(section, afterId, a) =>
            setMenu({ kind: 'new', section: afterId ? section : page.section, afterId: afterId ?? id, at: a })
          }
          onPlace={place}
        />

        <div className="flex-1 min-w-0 w-full">
          {progression && <StepBar progression={progression} currentId={id} onOpen={open} />}

          <PageEditor
            key={id}
            page={page}
            plays={plays}
            shots={shots}
            setBlocks={(update) => {
              const cur = find(id)
              if (cur) edit(id, { blocks: update(cur.blocks) })
            }}
            setLayout={(layout) => edit(id, { layout })}
            selected={selected}
            onSelect={setSelected}
            onDrawing={setDrawing}
            to={to}
          >
            {/* What the head coach says while it's up — his alone. */}
            <div className="mt-4">
              <label htmlFor="page-notes" className="text-[0.65rem] font-black uppercase tracking-wider text-gray-400">
                What you say while it&rsquo;s up
              </label>
              <textarea
                id="page-notes"
                value={page.notes ?? ''}
                onChange={(e) => apply(id, { notes: e.target.value || null })}
                rows={2}
                placeholder="Yours alone — never shown to players."
                className="field mt-1 text-sm"
              />
            </div>
          </PageEditor>
        </div>
      </div>

      {menu?.kind === 'slide' && menuPage && menuRun && (
        <SlideMenu
          at={menu.at}
          title={menuPage.title}
          section={menuPage.section}
          canEarlier={menuRun.i > 0}
          canLater={menuRun.i < menuRun.runs.length - 1}
          onClose={() => setMenu(null)}
          onDuplicate={() => void duplicate(menuPage.id)}
          onSection={(s) => moveToSection(menuPage.id, s)}
          onMove={(by) => moveBy(menuPage.id, by)}
          onDelete={() => remove(menuPage.id)}
        />
      )}
      {menu?.kind === 'new' && (
        <NewSlideMenu
          at={menu.at}
          where={`New slide · ${PLAYBOOK_SECTIONS.find((s) => s.key === menu.section)?.label ?? 'Not sorted'}`}
          onClose={() => setMenu(null)}
          onPick={(k) => void create(k, menu.section, menu.afterId)}
        />
      )}
    </div>
  )
}

/** Saving… / Saved ✓ / Couldn't save — retry. Quiet unless something is wrong. */
function SaveStatus({ state, error, onRetry }: { state: SaveState; error: string | null; onRetry: () => void }) {
  return (
    <div className="flex-1 min-w-0 text-xs truncate" role="status" aria-live="polite">
      {state === 'saving' && <span className="text-gray-400">Saving…</span>}
      {state === 'saved' && <span className="text-gray-400">Saved ✓</span>}
      {state === 'error' && (
        <button type="button" onClick={onRetry} className="font-bold text-[var(--gh-maroon)] hover:underline" title={error ?? undefined}>
          <span className="hidden sm:inline">Couldn&rsquo;t save — </span>Retry
        </button>
      )}
    </div>
  )
}

interface Progression {
  playId: string
  name: string
  step: number
  total: number
  /** The page for each step, in step order; null where a step has no page here. */
  pages: (string | null)[]
}

/** Which progression a page is a step of, and where its other steps are in this deck. */
function progressionOf(page: PlaybookPage, flat: PlaybookPage[], plays: Record<string, EditorPlay>): Progression | null {
  const s = stepOf(page)
  if (!s) return null
  const byStep = new Map<number, string>()
  for (const p of flat) {
    const o = stepOf(p)
    if (o?.playId === s.playId && !byStep.has(o.step)) byStep.set(o.step, p.id)
  }
  const total = Math.max(plays[s.playId]?.steps ?? 0, ...[...byStep.keys()].map((k) => k + 1))
  return {
    playId: s.playId,
    name: plays[s.playId]?.name ?? page.title,
    step: s.step,
    total,
    pages: Array.from({ length: total }, (_, i) => byStep.get(i) ?? null),
  }
}

/** "2-1-3 · step 2 of 4", with every step a tap away. */
function StepBar({ progression: pr, currentId, onOpen }: { progression: Progression; currentId: string; onOpen: (id: string) => void }) {
  return (
    <div className="mb-2 flex items-center gap-x-3 gap-y-1 flex-wrap">
      <span className="text-sm font-bold text-gray-700 min-w-0 truncate">
        {pr.name} <span className="font-normal text-gray-400">· step {pr.step + 1} of {pr.total}</span>
      </span>
      <span className="flex items-center gap-1" role="group" aria-label="Steps">
        {pr.pages.map((pid, i) => {
          const on = pid === currentId
          return (
            <button
              key={i}
              type="button"
              disabled={!pid}
              onClick={() => pid && onOpen(pid)}
              aria-current={on ? 'step' : undefined}
              aria-label={`Step ${i + 1}${pid ? '' : ' — not in this playbook'}`}
              className={`h-6 min-w-6 px-1.5 rounded-full text-xs font-bold tabular-nums ${
                on ? 'bg-[var(--gh-green)] text-white' : pid ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-transparent text-gray-300 border border-dashed border-gray-200'
              }`}
            >
              {i + 1}
            </button>
          )
        })}
      </span>
      <span className="text-xs text-gray-400 basis-full">
        Its steps are drawn on the Playboard — change them there and Update, and these pages follow.
      </span>
    </div>
  )
}
