'use client'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { savePlaybookSettings } from '@/lib/playbookActions'
import type { PlaybookSettings } from '@/lib/playbook'
import type { Team } from '@/lib/teams'
import { MOVE_TARGETS, type SectionKey } from './deck'

/**
 * The deck screen's small menus: ＋ New, the ⚙︎ settings, a card's ⋯ and the
 * section list they share.
 *
 * One menu is open at a time, and which one lives in the deck — so opening a
 * card's ⋯ shuts the ＋ New menu without either knowing about the other.
 */

/** A dropdown under (or over) whatever sits in the same `relative` box. */
export function Popover({
  open,
  onClose,
  up = false,
  align = 'right',
  wide = false,
  label,
  children,
}: {
  open: boolean
  onClose: () => void
  up?: boolean
  align?: 'left' | 'right'
  wide?: boolean
  label: string
  children: ReactNode
}) {
  if (!open) return null
  /* On a phone it is a sheet along the bottom, in reach of a thumb and never
     hanging off the side of the screen; from sm up, a dropdown by its button. */
  const place = up
    ? 'sm:bottom-full sm:mb-2'
    : 'sm:bottom-auto sm:top-full sm:mt-2'
  return (
    <>
      {/* A click anywhere else closes it, without doing whatever was under it. */}
      <div className="fixed inset-0 z-40 bg-black/25 sm:bg-transparent" aria-hidden onClick={onClose} />
      <div
        role="menu"
        aria-label={label}
        className={`fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] max-h-[75dvh] overflow-y-auto sm:absolute sm:inset-x-auto sm:max-h-none sm:overflow-visible ${
          align === 'right' ? 'sm:right-0' : 'sm:left-0'
        } ${place} ${wide ? 'sm:w-72' : 'sm:w-60'} z-50 card shadow-lg py-1.5 text-sm text-left font-normal`}
      >
        {children}
      </div>
    </>
  )
}

const itemCls =
  'w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 focus-visible:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent'

export function MenuItem({
  icon,
  children,
  hint,
  onClick,
  href,
  danger = false,
  disabled = false,
}: {
  icon?: ReactNode
  children: ReactNode
  hint?: string
  onClick?: () => void
  href?: string
  danger?: boolean
  disabled?: boolean
}) {
  const body = (
    <>
      {icon !== undefined && <span aria-hidden className="w-5 text-center shrink-0">{icon}</span>}
      <span className="min-w-0">
        <span className={`block font-semibold ${danger ? 'text-red-700' : ''}`}>{children}</span>
        {hint && <span className="block text-xs text-gray-400 leading-snug">{hint}</span>}
      </span>
    </>
  )
  if (href) {
    return (
      <Link role="menuitem" href={href} className={itemCls}>
        {body}
      </Link>
    )
  }
  return (
    <button type="button" role="menuitem" onClick={onClick} disabled={disabled} className={itemCls}>
      {body}
    </button>
  )
}

export function MenuRule() {
  return <div className="my-1.5 border-t border-[var(--border)]" />
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-3 pt-1 pb-1.5 text-xs text-gray-400">{children}</div>
}

/** Every section, the current one ticked: the "Move to section" list. */
export function SectionList({
  current,
  onPick,
}: {
  /** Undefined when the pages picked sit in different sections. */
  current: SectionKey | undefined
  onPick: (s: SectionKey) => void
}) {
  return (
    <>
      {MOVE_TARGETS.map((t) => (
        <MenuItem
          key={t.key ?? 'unsorted'}
          icon={current === t.key ? '✓' : ''}
          disabled={current === t.key}
          onClick={() => onPick(t.key)}
        >
          {t.label}
        </MenuItem>
      ))}
    </>
  )
}

export type NewKind = 'field' | 'field-half' | 'words' | 'picture'

/**
 * Everything a new page can start as. The kinds make a blank page and open it;
 * the Library brings a play already drawn; the Playboard is where a new one is
 * drawn in the first place.
 */
export function NewMenuItems({
  sectionName,
  onCreate,
  onLibrary,
}: {
  sectionName: string
  onCreate: (kind: NewKind) => void
  onLibrary: () => void
}) {
  return (
    <>
      <MenuLabel>New page in {sectionName}</MenuLabel>
      <MenuItem icon="🥍" onClick={() => onCreate('field')}>Field page</MenuItem>
      <MenuItem icon="🥅" onClick={() => onCreate('field-half')}>Half-field page</MenuItem>
      <MenuItem icon="✍️" onClick={() => onCreate('words')}>Words page</MenuItem>
      <MenuItem icon="🖼" onClick={() => onCreate('picture')}>Picture page</MenuItem>
      <MenuRule />
      <MenuItem icon="📚" onClick={onLibrary} hint="A play you’ve already saved">From the Library…</MenuItem>
      <MenuItem icon="✏️" href="/admin/playboard" hint="Then add it to the playbook from there">
        Draw a new one on the Playboard
      </MenuItem>
    </>
  )
}

/** Who can read the deck, in a few words. */
export function readersLabel(s: PlaybookSettings): string {
  if (s.publishCoaches && s.publishPlayers) return 'Staff and players can read it'
  if (s.publishCoaches) return 'The staff can read it'
  if (s.publishPlayers) return 'Players can read it'
  return 'Only you can see it'
}

/** The deck's name and who may read it — the old settings card, folded away. */
export function SettingsForm({
  team,
  settings,
  onSaved,
}: {
  team: Team
  settings: PlaybookSettings
  onSaved: () => void
}) {
  return (
    <form
      action={async (data) => {
        await savePlaybookSettings(data)
        onSaved()
      }}
      className="px-3 py-2 space-y-3"
    >
      <input type="hidden" name="team" value={team} />
      <div>
        <label className="field-label" htmlFor="playbook-title">What it&rsquo;s called</label>
        <input id="playbook-title" name="title" defaultValue={settings.title} className="field !py-1.5" />
      </div>
      <fieldset className="space-y-2">
        <legend className="field-label">Who can read it</legend>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="publish_coaches" defaultChecked={settings.publishCoaches} className="accent-[var(--gh-green)]" />
          The rest of the staff
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="publish_players" defaultChecked={settings.publishPlayers} className="accent-[var(--gh-green)]" />
          Players, in the Team Hub
        </label>
      </fieldset>
      <p className="text-xs text-gray-400 leading-snug">
        Half-installed in a player&rsquo;s hands is worse than not there at all — so both start off.
      </p>
      <button type="submit" className="btn btn-primary !py-1.5 text-sm w-full">Save</button>
    </form>
  )
}
