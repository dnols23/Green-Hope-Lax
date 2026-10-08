'use client'
import Link from 'next/link'
import { useState, type DragEvent, type MouseEvent, type ReactNode } from 'react'
import { SlideView, type SlidePlay } from '@/components/playbook/SlideView'
import { isPageKind, type DeckRun, type PlaybookPage } from '@/lib/playbook'
import { MenuItem, MenuLabel, MenuRule, Popover, SectionList } from './DeckMenus'
import { runKey, runName, stepTitle, type SectionKey } from './deck'

/**
 * What a card needs from the deck: who may change things, what is selected,
 * where a drag would land, and the things a card can ask the deck to do.
 */
export interface CardApi {
  canEdit: boolean
  plays: Record<string, SlidePlay>
  numberOf: (id: string) => number
  editHref: (id: string) => string
  presentHref: (id: string) => string
  /** Something is selected, so a tap selects rather than opens. */
  selecting: boolean
  isSelected: (run: DeckRun) => boolean
  isFlashed: (ids: string[]) => boolean
  isDragging: (id: string) => boolean
  /** Which card shows the drop line, and on which side: "<run key>:before". */
  dropMark: string | null
  openMenu: string | null
  setOpenMenu: (key: string | null) => void
  /** A click that selects instead of opening; true when it was one. */
  clickSelects: (e: MouseEvent, run: DeckRun) => boolean
  check: (e: MouseEvent, run: DeckRun) => void
  select: (run: DeckRun) => void
  dragStart: (e: DragEvent, run: DeckRun) => void
  dragOver: (e: DragEvent, run: DeckRun) => void
  dragEnd: () => void
  duplicate: (units: string[][]) => void
  moveToSection: (ids: string[], section: SectionKey) => void
  remove: (ids: string[], what: string) => void
}

/** Move a card one place earlier or later within its section. */
export interface GroupMove {
  canUp: (run: DeckRun) => boolean
  canDown: (run: DeckRun) => boolean
  move: (run: DeckRun, by: -1 | 1) => void
}

/** The page itself, shrunk: a contact sheet, not a list of names. */
function Thumb({ page, plays }: { page: PlaybookPage; plays: Record<string, SlidePlay> }) {
  return (
    <div className={`keep-light aspect-video overflow-hidden rounded-lg ${isPageKind(page.layout) ? '' : 'p-2'}`}>
      {/* The little field would open full screen on a double tap, and shows a
          button saying so; on a card, the card's own tap is the one that counts. */}
      <div className="pointer-events-none h-full [&_button]:hidden">
        <SlideView page={page} plays={plays} scale="thumb" />
      </div>
    </div>
  )
}

function DropLine({ mark, at }: { mark: string | null; at: string }) {
  if (!mark?.startsWith(`${at}:`)) return null
  const before = mark.endsWith(':before')
  return (
    <span
      aria-hidden
      className={`absolute inset-y-0 ${before ? '-left-[14px]' : '-right-[14px]'} w-1 rounded-full bg-[var(--gh-green)] z-10`}
    />
  )
}

/* A card's tap target lies over its thumbnail rather than round it: the
   little field inside draws buttons of its own, and a button (or link) may
   not hold another. */
const cover = 'absolute inset-0 z-[1] rounded-lg'

const ring = (lit: boolean) =>
  `outline-2 outline-offset-2 transition-[box-shadow,outline-color] ${lit ? 'outline outline-[var(--gh-green)]' : 'outline-transparent'}`

/** The round tick in a card's top corner (the title sits top left): on hover with a mouse, on every card once something is selected. */
function Check({ run, api, title }: { run: DeckRun; api: CardApi; title: string }) {
  const on = api.isSelected(run)
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={`Select ${title}`}
      onClick={(e) => api.check(e, run)}
      className={`absolute top-2 right-2 z-10 w-6 h-6 rounded-full grid place-items-center text-[0.7rem] font-black shadow-sm border-2 transition-opacity ${
        on ? 'bg-[var(--gh-green)] border-white text-white' : 'bg-white/90 border-gray-300 text-transparent hover:border-[var(--gh-green)]'
      } ${on || api.selecting ? '' : 'opacity-0 pointer-coarse:hidden group-hover:opacity-100 focus-visible:opacity-100'}`}
    >
      ✓
    </button>
  )
}

/** Number, title, and the head coach's controls under a card. */
function CardFoot({ n, title, sub, children }: { n: string; title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mt-2 flex items-center gap-1.5 min-w-0 min-h-8">
      <span className="text-xs font-bold text-gray-400 tabular-nums shrink-0 mr-0.5">{n}</span>
      <span className="text-sm font-semibold truncate min-w-0 flex-1" title={title}>
        {title}
        {sub}
      </span>
      {children}
    </div>
  )
}

/** ↑ ↓ on a phone, where there is no dragging. */
function UpDown({ run, move, title }: { run: DeckRun; move: GroupMove; title: string }) {
  const cls = 'hidden pointer-coarse:grid w-8 h-8 shrink-0 rounded-full place-items-center text-gray-500 hover:bg-gray-100 disabled:opacity-25'
  return (
    <>
      <button type="button" className={cls} aria-label={`Move ${title} earlier`} disabled={!move.canUp(run)} onClick={() => move.move(run, -1)}>↑</button>
      <button type="button" className={cls} aria-label={`Move ${title} later`} disabled={!move.canDown(run)} onClick={() => move.move(run, 1)}>↓</button>
    </>
  )
}

/**
 * The ⋯ button and the menu every card shares: whatever leads (Edit, Present,
 * Open the steps), then Duplicate, Move to section, Select and Delete. "Move to
 * section" turns the menu into the list of sections rather than opening a
 * second one on top of it.
 */
function MoreMenu({
  menuKey,
  api,
  title,
  run,
  lead,
  deleteLabel,
  whole = true,
}: {
  menuKey: string
  api: CardApi
  title: string
  /** The pages the menu acts on. */
  run: DeckRun
  lead: ReactNode
  deleteLabel: string
  /** A card in the deck (movable, selectable), rather than one step of a stack. */
  whole?: boolean
}) {
  const [sections, setSections] = useState(false)
  const open = api.openMenu === menuKey
  const ids = run.pages.map((p) => p.id)
  const close = () => api.setOpenMenu(null)
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={`More for ${title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setSections(false)
          api.setOpenMenu(open ? null : menuKey)
        }}
        className={`w-8 h-8 rounded-full grid place-items-center text-gray-500 hover:bg-gray-100 hover:text-gray-800 ${
          open ? 'bg-gray-100' : 'pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 focus-visible:opacity-100'
        }`}
      >
        <span aria-hidden className="text-lg leading-none">⋯</span>
      </button>
      <Popover open={open} onClose={close} label={`${title}: more`}>
        <MenuLabel>
          <span className="font-semibold text-gray-600 block truncate">{title}</span>
        </MenuLabel>
        {sections ? (
          <>
            <MenuItem icon="←" onClick={() => setSections(false)}>Move to…</MenuItem>
            <MenuRule />
            <SectionList current={run.pages[0].section} onPick={(s) => { close(); api.moveToSection(ids, s) }} />
          </>
        ) : (
          <>
            {lead}
            <MenuItem icon="⧉" onClick={() => { close(); api.duplicate([ids]) }}>Duplicate</MenuItem>
            {whole && <MenuItem icon="↦" onClick={() => setSections(true)}>Move to section…</MenuItem>}
            {whole && <MenuItem icon="☑" onClick={() => { close(); api.select(run) }}>Select</MenuItem>}
            <MenuRule />
            <MenuItem
              icon="🗑"
              danger
              onClick={() => { close(); api.remove(ids, ids.length > 1 ? `all ${ids.length} steps of “${title}”` : `“${title}”`) }}
            >
              {deleteLabel}
            </MenuItem>
          </>
        )}
      </Popover>
    </div>
  )
}

/** One page of the deck. */
export function PageCard({ run, api, groupMove }: { run: DeckRun; api: CardApi; groupMove: GroupMove }) {
  const page = run.pages[0]
  const title = page.title || 'Untitled'
  const n = api.numberOf(page.id)
  return (
    <div
      data-pages={page.id}
      className={`group relative min-w-0 ${api.isDragging(page.id) ? 'opacity-40' : ''}`}
      draggable={api.canEdit}
      onDragStart={(e) => api.dragStart(e, run)}
      onDragOver={(e) => api.dragOver(e, run)}
      onDragEnd={api.dragEnd}
    >
      <div className="relative">
        <DropLine mark={api.dropMark} at={page.id} />
        <div className={`relative rounded-lg border border-[var(--border)] shadow-sm group-hover:shadow-md ${ring(api.isSelected(run) || api.isFlashed([page.id]))}`}>
          <Thumb page={page} plays={api.plays} />
          <Link
            href={api.canEdit ? api.editHref(page.id) : api.presentHref(page.id)}
            draggable={false}
            onClick={(e) => { if (api.clickSelects(e, run)) e.preventDefault() }}
            aria-label={api.canEdit ? `Page ${n}, ${title}: edit` : `Page ${n}, ${title}: present from here`}
            className={cover}
          />
        </div>
        {api.canEdit && <Check run={run} api={api} title={title} />}
      </div>
      <CardFoot n={String(n)} title={title}>
        {api.canEdit && (
          <>
            <UpDown run={run} move={groupMove} title={title} />
            <MoreMenu
              menuKey={`card:${page.id}`}
              api={api}
              title={title}
              run={run}
              deleteLabel="Delete"
              lead={
                <>
                  <MenuItem icon="✏️" href={api.editHref(page.id)}>Edit</MenuItem>
                  <MenuItem icon="▶" href={api.presentHref(page.id)}>Present from here</MenuItem>
                </>
              }
            />
          </>
        )}
      </CardFoot>
    </div>
  )
}

/**
 * A progression: its step pages as one fanned stack. A tap opens it out into
 * its steps; a drag moves the whole run, because step 3 on its own, two
 * sections away from step 2, is not a progression any more.
 */
export function RunCard({
  run,
  api,
  groupMove,
  open,
  onToggle,
}: {
  run: DeckRun
  api: CardApi
  groupMove: GroupMove
  open: boolean
  onToggle: () => void
}) {
  const first = run.pages[0]
  const ids = run.pages.map((p) => p.id)
  const name = runName(run, api.plays)
  const n = `${api.numberOf(first.id)}–${api.numberOf(ids[ids.length - 1])}`
  const key = runKey(run)
  const sheet = 'absolute w-[calc(100%-14px)] aspect-video rounded-lg border border-[var(--border)] shadow-sm'
  return (
    <div
      data-pages={ids.join(' ')}
      className={`group relative min-w-0 ${api.isDragging(first.id) ? 'opacity-40' : ''}`}
      draggable={api.canEdit}
      onDragStart={(e) => api.dragStart(e, run)}
      onDragOver={(e) => api.dragOver(e, run)}
      onDragEnd={api.dragEnd}
    >
      <div className="relative">
        <DropLine mark={api.dropMark} at={key} />
        {/* The pages behind peek out up and to the right, inside the card's own box so nothing pokes past the screen edge. */}
        <div className="relative aspect-video">
          <span aria-hidden className={`${sheet} top-0 right-0 rotate-[2.5deg] bg-[#dbe6dd]`} />
          <span aria-hidden className={`${sheet} bottom-[4px] left-[7px] rotate-[1.2deg] bg-[#edf2ee]`} />
          <div className={`absolute bottom-0 left-0 w-[calc(100%-14px)] rounded-lg border border-[var(--border)] shadow-sm group-hover:shadow-md bg-white ${ring(api.isSelected(run) || api.isFlashed(ids))}`}>
            <Thumb page={first} plays={api.plays} />
          </div>
          <button
            type="button"
            onClick={(e) => { if (!api.clickSelects(e, run)) onToggle() }}
            aria-expanded={open}
            aria-label={`${name}, ${ids.length} steps, pages ${n}: ${open ? 'close' : 'open'} the steps`}
            className={cover}
          />
        </div>
        {api.canEdit && <Check run={run} api={api} title={name} />}
      </div>
      <CardFoot
        n={n}
        title={`${name} · ${ids.length} steps`}
        sub={<span aria-hidden className={`inline-block ml-1.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>}
      >
        {api.canEdit && (
          <>
            <UpDown run={run} move={groupMove} title={name} />
            <MoreMenu
              menuKey={`card:${key}`}
              api={api}
              title={name}
              run={run}
              deleteLabel={`Delete all ${ids.length} steps`}
              lead={
                <>
                  <MenuItem icon={open ? '▴' : '▾'} onClick={() => { api.setOpenMenu(null); onToggle() }}>
                    {open ? 'Close the steps' : 'Open the steps'}
                  </MenuItem>
                  <MenuItem icon="✏️" href={api.editHref(first.id)}>Edit step 1</MenuItem>
                  <MenuItem icon="▶" href={api.presentHref(first.id)}>Present from here</MenuItem>
                </>
              }
            />
          </>
        )}
      </CardFoot>
    </div>
  )
}

/** A progression opened out: its steps in a tray under the stack, a row of their own. */
export function StepTray({ run, api, onClose }: { run: DeckRun; api: CardApi; onClose: () => void }) {
  const name = runName(run, api.plays)
  return (
    <div className="col-span-full rounded-2xl bg-gray-100 border border-[var(--border)] p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4 min-w-0">
        <span className="text-sm font-bold truncate">{name}</span>
        <span className="text-xs text-gray-500 shrink-0">step by step</span>
        <button type="button" onClick={onClose} className="ml-auto shrink-0 text-xs font-bold text-gray-500 hover:text-gray-800 px-2 py-1">
          Close ▴
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-6">
        {run.pages.map((p) => {
          const title = `Step ${stepTitle(p)}`
          const one = { playId: null, pages: [p] }
          return (
            <div key={p.id} data-pages={p.id} className="group relative min-w-0">
              <div className={`relative rounded-lg border border-[var(--border)] shadow-sm group-hover:shadow-md ${ring(api.isFlashed([p.id]))}`}>
                <Thumb page={p} plays={api.plays} />
                <Link
                  href={api.canEdit ? api.editHref(p.id) : api.presentHref(p.id)}
                  draggable={false}
                  aria-label={`Page ${api.numberOf(p.id)}, ${title}`}
                  className={cover}
                />
              </div>
              <CardFoot n={String(api.numberOf(p.id))} title={title}>
                {api.canEdit && (
                  <MoreMenu
                    menuKey={`step:${p.id}`}
                    api={api}
                    title={title}
                    run={one}
                    whole={false}
                    deleteLabel="Delete this step"
                    lead={
                      <>
                        <MenuItem icon="✏️" href={api.editHref(p.id)}>Edit</MenuItem>
                        <MenuItem icon="▶" href={api.presentHref(p.id)}>Present from here</MenuItem>
                      </>
                    }
                  />
                )}
              </CardFoot>
            </div>
          )
        })}
      </div>
      {api.canEdit && (
        <p className="text-xs text-gray-500 mt-4">
          The steps come from the Playboard: change the play there and save, and these pages follow.
        </p>
      )}
    </div>
  )
}
