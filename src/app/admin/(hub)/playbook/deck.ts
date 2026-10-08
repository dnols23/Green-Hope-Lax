// The deck screen's arithmetic: which section you're looking at, and where a
// page ends up when it is dragged. Pure, so it can be reasoned about (and
// checked) without a browser.

import {
  PLAYBOOK_SECTIONS,
  isPlaybookSection,
  type DeckRun,
  type PlaybookPage,
  type PlaybookSection,
} from '@/lib/playbook'

/** A page's section; null is "not sorted yet". */
export type SectionKey = PlaybookSection | null

/** What the section bar is showing: everything, one section, or the unsorted pile. */
export type DeckView = 'all' | PlaybookSection | 'unsorted'

export function readView(raw: string | null | undefined): DeckView {
  if (raw === 'unsorted') return 'unsorted'
  return isPlaybookSection(raw) ? raw : 'all'
}

/** The section a view stands for — undefined for "All", which is every one. */
export function viewSection(view: DeckView): SectionKey | undefined {
  if (view === 'all') return undefined
  return view === 'unsorted' ? null : view
}

/** Where a new page goes: the section on screen, or Offense when looking at everything. */
export function newPageSection(view: DeckView): SectionKey {
  const s = viewSection(view)
  return s === undefined ? 'offense' : s
}

export function viewOf(section: SectionKey): DeckView {
  return section ?? 'unsorted'
}

/** Every section a page can be moved to, "Not sorted" last. */
export const MOVE_TARGETS: { key: SectionKey; label: string }[] = [
  ...PLAYBOOK_SECTIONS.map((s) => ({ key: s.key as SectionKey, label: s.label })),
  { key: null, label: 'Not sorted' },
]

/** One change to the deck, shown at once and then confirmed by the server. */
export type DeckEdit =
  | { kind: 'arrange'; order: string[]; sections: Record<string, SectionKey> }
  | { kind: 'remove'; ids: string[] }

/**
 * The deck with an edit applied, the way arrangeSlides and deleteSlides will
 * leave it — so what the coach sees while it saves is what he'll get.
 */
export function applyEdit(pages: PlaybookPage[], edit: DeckEdit): PlaybookPage[] {
  if (edit.kind === 'remove') {
    const gone = new Set(edit.ids)
    return pages.filter((p) => !gone.has(p.id))
  }
  const at = new Map(edit.order.map((id, i) => [id, i]))
  // Pages the screen didn't know about keep their place at the end, as on the server.
  const rank = (p: PlaybookPage) => at.get(p.id) ?? Number.MAX_SAFE_INTEGER
  return [...pages]
    .sort((a, b) => rank(a) - rank(b) || a.sortOrder - b.sortOrder)
    .map((p, i) => ({
      ...p,
      sortOrder: i + 1,
      section: Object.prototype.hasOwnProperty.call(edit.sections, p.id) ? edit.sections[p.id] : p.section,
    }))
}

/** Where a drag lets go. */
export type Drop =
  | { at: 'before' | 'after'; pageId: string }
  | { at: 'start' | 'end'; section: SectionKey }

/**
 * Move some pages (in reading order) to a spot in the deck.
 *
 * Returns the whole new order and the pages whose section changed — exactly
 * what arrangeSlides wants — or null when nothing would change. `deck` must be
 * in reading order (orderedDeck).
 */
export function moveTo(
  deck: PlaybookPage[],
  moving: string[],
  drop: Drop,
): { order: string[]; sections: Record<string, SectionKey> } | null {
  const set = new Set(moving)
  if ('pageId' in drop && set.has(drop.pageId)) return null
  const moved = deck.filter((p) => set.has(p.id))
  const rest = deck.filter((p) => !set.has(p.id))
  if (!moved.length) return null

  let index: number
  let section: SectionKey
  if ('pageId' in drop) {
    const i = rest.findIndex((p) => p.id === drop.pageId)
    if (i < 0) return null
    index = drop.at === 'before' ? i : i + 1
    section = rest[i].section
  } else {
    section = drop.section
    const first = rest.findIndex((p) => p.section === section)
    let last = -1
    rest.forEach((p, i) => { if (p.section === section) last = i })
    // An empty section: anywhere will do, since the deck reads section by section.
    index = first < 0 ? rest.length : drop.at === 'start' ? first : last + 1
  }

  const order = [...rest.slice(0, index), ...moved, ...rest.slice(index)].map((p) => p.id)
  const sections: Record<string, SectionKey> = {}
  for (const p of moved) if (p.section !== section) sections[p.id] = section
  const same = order.every((id, i) => id === deck[i].id)
  return same && !Object.keys(sections).length ? null : { order, sections }
}

/** A run's own key: its first page, which is where it sits in the deck. */
export const runKey = (run: DeckRun) => run.pages[0].id

/**
 * What a progression's stack is called. The play's own name when we have it,
 * else the step page's title without its " · 1 of 4".
 */
export function runName(run: DeckRun, plays: Record<string, { name: string }>): string {
  const fromPlay = run.playId ? plays[run.playId]?.name : ''
  if (fromPlay) return fromPlay
  return run.pages[0].title.replace(/\s*·\s*\d+\s+of\s+\d+\s*$/, '') || 'Progression'
}

/** "1 of 4" for a step page, else its title. */
export function stepTitle(page: PlaybookPage): string {
  return page.title.match(/(\d+\s+of\s+\d+)\s*$/)?.[1] ?? page.title
}

/**
 * Where duplicates go: after the whole run they came from, not inside it — a
 * copy wedged between step 2 and step 3 would split the progression in two.
 * `after` is the last page of the run each unit belongs to.
 */
export function afterTheirRuns(
  deck: PlaybookPage[],
  units: { ids: string[]; after: string }[],
  copies: Map<string, string>,
): string[] {
  const behind = new Map<string, string[]>()
  for (const unit of units) {
    const made = unit.ids.map((id) => copies.get(id)).filter((x): x is string => !!x)
    behind.set(unit.after, [...(behind.get(unit.after) ?? []), ...made])
  }
  const made = new Set(copies.values())
  const out: string[] = []
  for (const p of deck) {
    if (made.has(p.id)) continue
    out.push(p.id, ...(behind.get(p.id) ?? []))
  }
  return out
}
