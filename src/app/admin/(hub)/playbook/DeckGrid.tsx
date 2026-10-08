'use client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Fragment,
  useEffect,
  useEffectEvent,
  useOptimistic,
  useState,
  useTransition,
  type DragEvent,
  type MouseEvent,
} from 'react'
import type { SlidePlay } from '@/components/playbook/SlideView'
import {
  addSavedPlayToPlaybook,
  arrangeSlides,
  createSlide,
  deleteSlides,
  duplicateSlides,
} from '@/lib/playbookActions'
import {
  PLAYBOOK_SECTIONS,
  deckRuns,
  deckSections,
  orderedDeck,
  sectionLabel,
  type DeckRun,
  type PlaybookPage,
  type PlaybookSettings,
} from '@/lib/playbook'
import { teamLabel, withTeam, type Team } from '@/lib/teams'
import {
  afterTheirRuns,
  applyEdit,
  moveTo,
  newPageSection,
  readView,
  runKey,
  viewOf,
  viewSection,
  type DeckEdit,
  type DeckView,
  type Drop,
  type SectionKey,
} from './deck'
import { PageCard, RunCard, StepTray, type CardApi, type GroupMove } from './DeckCard'
import { MenuLabel, NewMenuItems, Popover, SectionList, SettingsForm, readersLabel, type NewKind } from './DeckMenus'
import { LibraryPicker, type ShelfPlay } from './LibraryPicker'

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

/** A thrown action (a dropped connection, a lapsed login) reads like any other failure. */
async function safely<T extends { ok: boolean }>(call: () => Promise<T>): Promise<T | { ok: false; error: string }> {
  try {
    return await call()
  } catch {
    return { ok: false, error: 'That didn’t save. Check the connection and try again.' }
  }
}

interface Toast {
  tone: 'note' | 'error'
  text: string
  /** A page the note is about, so it can say where that page went. */
  pageId?: string
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * The deck: the playbook as a grid of pages, sorted the way a coach thinks —
 * offense, defense, man-up and the rest — like Google Slides' grid view.
 *
 * Changes show the moment they are made and save behind the coach's back; a
 * drag that didn't take puts the cards back where they were and says so.
 * Everyone but the head coach gets the same grid with nothing to change.
 */
export function DeckGrid({
  pages,
  plays,
  shelf,
  team,
  settings,
  canEdit,
}: {
  pages: PlaybookPage[]
  plays: Record<string, SlidePlay>
  /** The head coach's Library, for "From the Library…". Empty for anyone else. */
  shelf: ShelfPlay[]
  team: Team
  settings: PlaybookSettings
  canEdit: boolean
}) {
  const router = useRouter()
  const view = readView(useSearchParams().get('section'))

  const [shown, addEdit] = useOptimistic(pages, applyEdit)
  const [saving, startSaving] = useTransition()
  const [saved, setSaved] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [anchor, setAnchor] = useState<string | null>(null)
  const [openRuns, setOpenRuns] = useState<Set<string>>(() => new Set())
  const [flash, setFlash] = useState<string[]>([])
  const [drag, setDrag] = useState<string[] | null>(null)
  const [hint, setHint] = useState<{ mark: string; drop: Drop } | null>(null)

  // ── What is on screen ──────────────────────────────────────────────────────
  const deck = orderedDeck(shown)
  const numbers = new Map(deck.map((p, i) => [p.id, i + 1]))
  const count = (s: SectionKey) => deck.filter((p) => p.section === s).length
  const only = viewSection(view)
  const groups = (only === undefined
    ? deckSections(shown)
    : [{ section: only, pages: deck.filter((p) => p.section === only) }]
  ).map((g) => ({ section: g.section, runs: deckRuns(g.pages) }))
  // Every card in the deck, whatever is on screen: what selection and duplicates work in.
  const allRuns = deckSections(shown).flatMap((g) => deckRuns(g.pages))
  const visibleRuns = groups.flatMap((g) => g.runs)
  const inDeck = new Set(
    deck.flatMap((p) => p.blocks.flatMap((b) => (b.kind === 'play' && b.playId ? [b.playId] : []))),
  )
  const picked = deck.filter((p) => selected.has(p.id))
  const pickedRuns = allRuns.filter((r) => r.pages.every((p) => selected.has(p.id)))
  const target = newPageSection(view)
  const targetName = sectionLabel(target)

  const editHref = (id: string) => withTeam(`/admin/playbook/${id}`, team)
  const presentHref = (id?: string) => withTeam(`/admin/playbook/present${id ? `?from=${id}` : ''}`, team)
  const viewHref = (v: DeckView) => withTeam(v === 'all' ? '/admin/playbook' : `/admin/playbook?section=${v}`, team)

  // ── Saying what happened ───────────────────────────────────────────────────
  function say(next: Toast) {
    setToast(next)
    // Good news goes away on its own; a failure stays until it is read.
    if (next.tone === 'note') setTimeout(() => setToast((t) => (t === next ? null : t)), 4500)
  }

  function light(ids: string[]) {
    setFlash(ids)
    setTimeout(() => setFlash((f) => (f === ids ? [] : f)), 2600)
  }

  // Bring a page that just arrived (or was just copied) into view.
  useEffect(() => {
    if (!flash.length) return
    document.querySelector(`[data-pages~="${CSS.escape(flash[0])}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [flash, shown])

  // Escape shuts the open menu, and then lets go of the selection.
  const onEscape = useEffectEvent(() => {
    if (openMenu) setOpenMenu(null)
    else if (selected.size) setSelected(new Set())
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onEscape() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Changing the deck ──────────────────────────────────────────────────────
  /** Show an edit now, save it, and say "Saved" (or put it back and say why). */
  function save(edit: DeckEdit, call: () => Promise<Result>, done?: string) {
    setToast(null)
    startSaving(async () => {
      addEdit(edit)
      const res = await safely(call)
      if (!res.ok) return say({ tone: 'error', text: res.error })
      setSaved(true)
      if (done) say({ tone: 'note', text: done })
    })
  }

  function moveUnits(ids: string[], drop: Drop) {
    const next = moveTo(deck, ids, drop)
    if (!next) return
    const moved = Object.values(next.sections)
    const done = moved.length ? `Moved to ${sectionLabel(moved[0])}.` : undefined
    save({ kind: 'arrange', ...next }, () => arrangeSlides({ team, ...next }), done)
  }

  function moveToSection(ids: string[], section: SectionKey) {
    setSelected(new Set())
    moveUnits(ids, { at: 'end', section })
  }

  function remove(ids: string[], what: string) {
    if (!window.confirm(`Delete ${what}? The plays stay in the Library.`)) return
    setSelected((s) => new Set([...s].filter((id) => !ids.includes(id))))
    save({ kind: 'remove', ids }, () => deleteSlides({ ids }), 'Deleted. The plays are still in the Library.')
  }

  function duplicate(units: string[][]) {
    setToast(null)
    const ids = units.flat()
    // Each copy goes after the whole run its page belongs to.
    const runOf = (id: string) => allRuns.find((r) => r.pages.some((p) => p.id === id))
    const placed = units.map((u) => {
      const run = runOf(u[0])
      return { ids: u, after: run ? run.pages[run.pages.length - 1].id : u[u.length - 1] }
    })
    startSaving(async () => {
      const res = await safely(() => duplicateSlides({ ids }))
      if (!res.ok) return say({ tone: 'error', text: res.error })
      // The server puts each copy straight after its original, which would
      // wedge copies inside a progression; move them past it.
      if (res.ids.length === ids.length && placed.some((u) => u.ids.length > 1 || u.after !== u.ids[u.ids.length - 1])) {
        const copies = new Map(ids.map((id, i) => [id, res.ids[i]]))
        await safely(() => arrangeSlides({ team, order: afterTheirRuns(deck, placed, copies) }))
      }
      setSaved(true)
      setSelected(new Set())
      light(res.ids)
      say({ tone: 'note', text: `Duplicated ${plural(res.ids.length, 'page')}.` })
    })
  }

  function create(kind: NewKind) {
    setOpenMenu(null)
    setToast(null)
    startSaving(async () => {
      const res = await safely(() => createSlide({ team, kind, section: target }))
      // Straight into the new page: a blank page is only ever made to be worked on.
      if (res.ok) router.push(editHref(res.id))
      else say({ tone: 'error', text: res.error })
    })
  }

  function openLibrary() {
    setOpenMenu(null)
    setPicking(true)
  }

  function addFromLibrary(play: ShelfPlay) {
    const already = inDeck.has(play.id)
    setAdding(play.id)
    setToast(null)
    startSaving(async () => {
      const res = await safely(() => addSavedPlayToPlaybook({ playId: play.id, team, section: target }))
      setAdding(null)
      if (!res.ok) return say({ tone: 'error', text: res.error })
      // Stay on the deck, with the new page lit up where it landed.
      setPicking(false)
      setSaved(true)
      light([res.pageId])
      say({
        tone: 'note',
        text: (already ? `“${play.name}” was already in — brought up to date.` : `Added “${play.name}”.`) + res.note,
        pageId: res.pageId,
      })
    })
  }

  // ── Selecting ──────────────────────────────────────────────────────────────
  const idsOf = (run: DeckRun) => run.pages.map((p) => p.id)
  const isSelected = (run: DeckRun) => run.pages.every((p) => selected.has(p.id))

  function toggle(run: DeckRun) {
    const ids = idsOf(run)
    const on = isSelected(run)
    setSelected((s) => {
      const next = new Set(s)
      for (const id of ids) if (on) next.delete(id); else next.add(id)
      return next
    })
    setAnchor(runKey(run))
  }

  /** Shift-click: everything between the last card ticked and this one. */
  function selectRange(run: DeckRun) {
    const keys = visibleRuns.map(runKey)
    const from = anchor ? keys.indexOf(anchor) : -1
    const to = keys.indexOf(runKey(run))
    if (from < 0 || to < 0) return toggle(run)
    const [a, b] = from < to ? [from, to] : [to, from]
    setSelected((s) => new Set([...s, ...visibleRuns.slice(a, b + 1).flatMap(idsOf)]))
  }

  function check(e: MouseEvent, run: DeckRun) {
    if (e.shiftKey) selectRange(run)
    else toggle(run)
  }

  /** Once something is picked a tap picks too — and ⌘/Ctrl or Shift always does. */
  function clickSelects(e: MouseEvent, run: DeckRun): boolean {
    if (!canEdit) return false
    if (e.shiftKey && anchor) { selectRange(run); return true }
    if (e.metaKey || e.ctrlKey || selected.size > 0) { toggle(run); return true }
    return false
  }

  // ── Dragging ───────────────────────────────────────────────────────────────
  function dragStart(e: DragEvent, run: DeckRun) {
    if (!canEdit) return
    // Picking up a ticked card picks up everything ticked with it.
    const ids = isSelected(run) ? picked.map((p) => p.id) : idsOf(run)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', ids.join(','))
    setOpenMenu(null)
    setDrag(ids)
  }

  function dragOver(e: DragEvent, run: DeckRun) {
    if (!drag) return
    const ids = idsOf(run)
    if (ids.some((id) => drag.includes(id))) {
      if (hint) setHint(null)
      return
    }
    // Which half of the card the pointer is over says which side it goes.
    const box = e.currentTarget.getBoundingClientRect()
    const before = e.clientX < box.left + box.width / 2
    const mark = `${runKey(run)}:${before ? 'before' : 'after'}`
    if (hint?.mark !== mark) {
      setHint({ mark, drop: before ? { at: 'before', pageId: ids[0] } : { at: 'after', pageId: ids[ids.length - 1] } })
    }
  }

  /** Over a section — its heading, its tab, its empty space. */
  function overSection(e: DragEvent, section: SectionKey, where: 'start' | 'end', mark: string) {
    if (!drag) return
    e.preventDefault()
    if (hint?.mark !== mark) setHint({ mark, drop: { at: where, section } })
  }

  function dragEnd() {
    setDrag(null)
    setHint(null)
  }

  function drop(e: DragEvent) {
    e.preventDefault()
    if (drag && hint) moveUnits(drag, hint.drop)
    dragEnd()
  }

  /** ↑ and ↓: one place, inside the section it's in. */
  function groupMove(runs: DeckRun[]): GroupMove {
    const at = (run: DeckRun) => runs.findIndex((r) => runKey(r) === runKey(run))
    return {
      canUp: (run) => at(run) > 0,
      canDown: (run) => at(run) >= 0 && at(run) < runs.length - 1,
      move: (run, by) => {
        const other = runs[at(run) + by]
        if (!other) return
        const ids = idsOf(other)
        moveUnits(idsOf(run), by < 0 ? { at: 'before', pageId: ids[0] } : { at: 'after', pageId: ids[ids.length - 1] })
      },
    }
  }

  const api: CardApi = {
    canEdit,
    plays,
    numberOf: (id) => numbers.get(id) ?? 0,
    editHref,
    presentHref,
    selecting: selected.size > 0,
    isSelected,
    isFlashed: (ids) => ids.some((id) => flash.includes(id)),
    isDragging: (id) => !!drag?.includes(id),
    dropMark: hint?.mark ?? null,
    openMenu,
    setOpenMenu,
    clickSelects,
    check,
    select: toggle,
    dragStart,
    dragOver,
    dragEnd,
    duplicate,
    moveToSection,
    remove,
  }

  function showView(e: MouseEvent, v: DeckView) {
    // A new tab is still a new tab.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    // The section rides in the address (so it can be linked and survives a
    // reload) without asking the server for a deck the screen already has.
    window.history.pushState(null, '', viewHref(v))
    setSelected(new Set())
    setOpenMenu(null)
  }

  // ── The screen ─────────────────────────────────────────────────────────────
  const tabs: { view: DeckView; label: string; n: number; section?: SectionKey }[] = [
    { view: 'all', label: 'All', n: deck.length },
    ...PLAYBOOK_SECTIONS.map((s) => ({ view: s.key as DeckView, label: s.label, n: count(s.key), section: s.key })),
    { view: 'unsorted', label: 'Not sorted', n: count(null), section: null },
  ]
  // Empty sections only for the head coach, faint, as somewhere to put things.
  const visibleTabs = tabs.filter((t) => t.view === 'all' || t.n > 0 || t.view === view || (canEdit && t.view !== 'unsorted'))
  const toastAbout = toast?.pageId ? shown.find((p) => p.id === toast.pageId) : undefined
  const elsewhere = toastAbout && only !== undefined && toastAbout.section !== only ? toastAbout.section : undefined
  const sharedSection = picked.length && picked.every((p) => p.section === picked[0].section) ? picked[0].section : undefined

  const card = (run: DeckRun, runs: DeckRun[]) => {
    const key = runKey(run)
    if (run.pages.length === 1) return <PageCard key={key} run={run} api={api} groupMove={groupMove(runs)} />
    const open = openRuns.has(key)
    const flip = () => setOpenRuns((s) => {
      const next = new Set(s)
      if (open) next.delete(key); else next.add(key)
      return next
    })
    return (
      <Fragment key={key}>
        <RunCard run={run} api={api} groupMove={groupMove(runs)} open={open} onToggle={flip} />
        {open && <StepTray run={run} api={api} onClose={flip} />}
      </Fragment>
    )
  }

  const grid = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-7'

  return (
    <div className={picked.length ? 'pb-28' : 'pb-10'}>
      {/* ── Header ── */}
      <div className="flex items-center gap-x-3 gap-y-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-xl font-black truncate">
            {teamLabel(team)} {settings.title}
          </h1>
          <Link
            href={withTeam('/admin/playbook', team === 'varsity' ? 'jv' : 'varsity')}
            className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full border border-[var(--border)] text-gray-500 hover:border-[var(--gh-green)] hover:text-[var(--gh-green)]"
          >
            {team === 'varsity' ? 'JV' : 'Varsity'} &rarr;
          </Link>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {canEdit && (
            <span className="text-xs text-gray-400 mr-1" aria-live="polite">
              {saving ? 'Saving…' : saved ? 'Saved' : ''}
            </span>
          )}
          {canEdit && (
            <div className="relative">
              <button
                type="button"
                aria-label="Playbook settings"
                aria-haspopup="menu"
                aria-expanded={openMenu === 'settings'}
                onClick={() => setOpenMenu(openMenu === 'settings' ? null : 'settings')}
                className="w-9 h-9 rounded-full grid place-items-center border border-[var(--border)] bg-white text-gray-500 hover:text-gray-800"
              >
                <span aria-hidden>⚙︎</span>
              </button>
              <Popover open={openMenu === 'settings'} onClose={() => setOpenMenu(null)} label="Playbook settings" wide>
                <SettingsForm
                  team={team}
                  settings={settings}
                  onSaved={() => {
                    setOpenMenu(null)
                    setSaved(true)
                    say({ tone: 'note', text: 'Settings saved.' })
                  }}
                />
              </Popover>
            </div>
          )}
          {deck.length > 0 && (
            <Link href={presentHref()} className="btn btn-ghost !py-1.5 text-sm">
              ▶ Present
            </Link>
          )}
          {canEdit && (
            <div className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={openMenu === 'new'}
                onClick={() => setOpenMenu(openMenu === 'new' ? null : 'new')}
                className="btn btn-primary !py-1.5 text-sm"
              >
                ＋ New
              </button>
              <Popover open={openMenu === 'new'} onClose={() => setOpenMenu(null)} label="New page" wide>
                <NewMenuItems sectionName={targetName} onCreate={create} onLibrary={openLibrary} />
              </Popover>
            </div>
          )}
        </div>
      </div>
      <p className="text-sm text-gray-500 mt-1">
        {canEdit
          ? `${readersLabel(settings)} · ${plural(deck.length, 'page')}`
          : `The ${teamLabel(team).toLowerCase()} playbook, as the head coach wrote it.`}
      </p>

      {deck.length === 0 ? (
        /* ── An empty playbook says how one gets filled ── */
        <div className="card px-6 py-12 mt-6 text-center">
          {canEdit ? (
            <>
              <p className="text-gray-600 max-w-md mx-auto">
                Draw a play on the Playboard and save it to the Library — then bring it in here.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Link href="/admin/playboard" className="btn btn-primary">Open the Playboard</Link>
                <button type="button" onClick={openLibrary} className="btn btn-ghost">From the Library</button>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">Nothing in it yet.</p>
          )}
        </div>
      ) : (
        <>
          {/* ── Sections ── */}
          <nav
            aria-label="Sections"
            className="mt-5 -mx-4 px-4 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {visibleTabs.map((t) => {
              const on = t.view === view
              const empty = t.n === 0 && t.view !== 'all'
              const mark = `tab:${t.view}`
              return (
                <a
                  key={t.view}
                  href={viewHref(t.view)}
                  onClick={(e) => showView(e, t.view)}
                  aria-current={on ? 'page' : undefined}
                  onDragOver={t.section !== undefined ? (e) => overSection(e, t.section!, 'end', mark) : undefined}
                  onDragLeave={() => { if (hint?.mark === mark) setHint(null) }}
                  onDrop={t.section !== undefined ? drop : undefined}
                  title={empty && canEdit ? `Nothing in ${t.label} yet` : undefined}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold border transition-colors ${
                    on
                      ? 'bg-[var(--gh-green)] border-[var(--gh-green)] text-white'
                      : empty
                        ? 'border-dashed border-gray-300 text-gray-400 hover:text-gray-600'
                        : 'bg-white border-[var(--border)] text-gray-600 hover:border-gray-400'
                  } ${hint?.mark === mark ? 'ring-2 ring-[var(--gh-green)] ring-offset-1' : ''}`}
                >
                  {t.label}
                  {!empty && <span className={`text-xs tabular-nums ${on ? 'text-white/75' : 'text-gray-400'}`}>{t.n}</span>}
                </a>
              )
            })}
          </nav>

          {/* ── The deck ── */}
          <div
            className="mt-6"
            onDragOver={(e) => { if (drag) e.preventDefault() }}
            onDrop={drop}
          >
            {groups.every((g) => g.runs.length === 0) ? (
              <EmptySection
                name={sectionLabel(only ?? null)}
                unsorted={view === 'unsorted'}
                canEdit={canEdit}
                menuOpen={openMenu === 'empty-new'}
                onMenu={() => setOpenMenu(openMenu === 'empty-new' ? null : 'empty-new')}
                onClose={() => setOpenMenu(null)}
                onCreate={create}
                onLibrary={openLibrary}
                onDragOver={(e) => overSection(e, only ?? null, 'end', 'empty')}
                lit={hint?.mark === 'empty'}
              />
            ) : (
              groups.map((g) => {
                const mark = `head:${g.section ?? 'unsorted'}`
                return (
                  <section key={g.section ?? 'unsorted'} className="mt-10 first:mt-0">
                    {only === undefined && (
                      <div
                        onDragOver={(e) => overSection(e, g.section, 'start', mark)}
                        className={`flex items-baseline gap-2 mb-4 pb-2 border-b-2 transition-colors ${
                          hint?.mark === mark ? 'border-[var(--gh-green)]' : 'border-[var(--border)]'
                        }`}
                      >
                        <h2 className="section-label">
                          <a href={viewHref(viewOf(g.section))} onClick={(e) => showView(e, viewOf(g.section))} className="hover:underline">
                            {sectionLabel(g.section)}
                          </a>
                        </h2>
                        <span className="text-xs text-gray-400 tabular-nums">{g.runs.reduce((n, r) => n + r.pages.length, 0)}</span>
                        {g.section === null && canEdit && (
                          <span className="text-xs text-gray-400 truncate">· drag these into a section</span>
                        )}
                      </div>
                    )}
                    <div className={grid}>{g.runs.map((r) => card(r, g.runs))}</div>
                  </section>
                )
              })
            )}
          </div>
        </>
      )}

      {/* ── What's selected, and what can be done with it ── */}
      {canEdit && picked.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pointer-events-none">
          <div role="toolbar" aria-label="Selected pages" className="pointer-events-auto card shadow-lg flex flex-wrap items-center justify-center gap-1 p-1.5 max-w-full">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              aria-label="Clear the selection"
              className="w-8 h-8 rounded-full grid place-items-center text-gray-500 hover:bg-gray-100"
            >
              ✕
            </button>
            <span className="text-sm font-bold tabular-nums pr-1">
              {picked.length}<span className="hidden sm:inline"> {picked.length === 1 ? 'page' : 'pages'}</span>
            </span>
            <span aria-hidden className="w-px h-5 bg-[var(--border)] mx-1" />
            <div className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={openMenu === 'bulk-move'}
                onClick={() => setOpenMenu(openMenu === 'bulk-move' ? null : 'bulk-move')}
                className={barBtn}
              >
                Move to ▾
              </button>
              <Popover open={openMenu === 'bulk-move'} onClose={() => setOpenMenu(null)} label="Move to section" up align="left">
                <MenuLabel>Move {plural(picked.length, 'page')} to</MenuLabel>
                <SectionList
                  current={sharedSection}
                  onPick={(s) => { setOpenMenu(null); moveToSection(picked.map((p) => p.id), s) }}
                />
              </Popover>
            </div>
            <button type="button" className={barBtn} onClick={() => duplicate(pickedRuns.map(idsOf))}>
              Duplicate
            </button>
            <Link href={presentHref(picked[0].id)} className={barBtn}>
              Present
            </Link>
            <button
              type="button"
              className={`${barBtn} text-red-700`}
              onClick={() => remove(picked.map((p) => p.id), plural(picked.length, 'page'))}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed inset-x-0 z-20 flex justify-center px-3 pointer-events-none ${
            picked.length ? 'bottom-[calc(5.5rem+env(safe-area-inset-bottom))]' : 'bottom-[calc(1rem+env(safe-area-inset-bottom))]'
          }`}
        >
          <div
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto max-w-lg rounded-2xl px-4 py-2.5 text-sm text-white shadow-lg flex items-center gap-3 ${
              toast.tone === 'error' ? 'bg-[var(--gh-maroon)]' : 'bg-gray-900'
            }`}
          >
            <span>
              {toast.text}
              {elsewhere !== undefined && (
                <>
                  {' '}
                  <a
                    href={viewHref(viewOf(elsewhere))}
                    onClick={(e) => showView(e, viewOf(elsewhere))}
                    className="font-bold underline underline-offset-2"
                  >
                    It&rsquo;s in {sectionLabel(elsewhere)}.
                  </a>
                </>
              )}
            </span>
            <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="text-white/70 hover:text-white">
              ✕
            </button>
          </div>
        </div>
      )}

      {picking && (
        <LibraryPicker
          shelf={shelf}
          plays={plays}
          team={team}
          inDeck={inDeck}
          sectionName={targetName}
          busyId={adding}
          onPick={addFromLibrary}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}

const barBtn = 'px-3 py-1.5 rounded-full text-sm font-semibold hover:bg-gray-100'

/** A section with nothing in it: somewhere to start, and somewhere to drop. */
function EmptySection({
  name,
  unsorted,
  canEdit,
  menuOpen,
  onMenu,
  onClose,
  onCreate,
  onLibrary,
  onDragOver,
  lit,
}: {
  name: string
  unsorted: boolean
  canEdit: boolean
  menuOpen: boolean
  onMenu: () => void
  onClose: () => void
  onCreate: (kind: NewKind) => void
  onLibrary: () => void
  onDragOver: (e: DragEvent) => void
  lit: boolean
}) {
  if (unsorted) {
    return <p className="text-sm text-gray-500 py-10 text-center">Everything&rsquo;s in a section.</p>
  }
  return (
    <div
      onDragOver={canEdit ? onDragOver : undefined}
      className={`rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
        lit ? 'border-[var(--gh-green)] bg-green-50' : 'border-[var(--border)]'
      }`}
    >
      <p className="text-gray-500">Nothing in {name} yet.</p>
      {canEdit && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <div className="relative">
            <button type="button" onClick={onMenu} aria-haspopup="menu" aria-expanded={menuOpen} className="btn btn-primary !py-1.5 text-sm">
              ＋ Add a page
            </button>
            <Popover open={menuOpen} onClose={onClose} label="New page" wide align="left">
              <NewMenuItems sectionName={name} onCreate={onCreate} onLibrary={onLibrary} />
            </Popover>
          </div>
          <button type="button" onClick={onLibrary} className="btn btn-ghost !py-1.5 text-sm">
            From the Library
          </button>
        </div>
      )}
    </div>
  )
}
