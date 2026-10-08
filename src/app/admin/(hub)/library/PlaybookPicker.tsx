'use client'
import Link from 'next/link'
import { useState } from 'react'
import { PLAYBOOK_SECTIONS, isPlaybookSection, sectionLabel, type PlaybookSection } from '@/lib/playbook'
import type { PlaybookSpot } from '@/lib/playbookData'
import { isTeam, teamLabel, withTeam, type Team } from '@/lib/teams'
import { Popover } from './Popover'

/**
 * Putting a play in the playbook: which team's, and which section.
 *
 * One control for the Playboard and the Library alike. Where the play already
 * is shows as a link to its page; the button offers the decks it isn't in yet.
 * The last team and section picked are remembered on this device, because a
 * coach drawing the offense on a Sunday is drawing a lot of offense.
 */

const LAST = 'gh-playbook-pick-v1'

interface LastPick {
  team: Team
  section: PlaybookSection
}

function lastPick(): Partial<LastPick> {
  try {
    const raw = JSON.parse(localStorage.getItem(LAST) ?? 'null') as Partial<LastPick> | null
    return {
      team: isTeam(raw?.team) ? raw.team : undefined,
      section: isPlaybookSection(raw?.section) ? raw.section : undefined,
    }
  } catch {
    return {}
  }
}

function keepPick(pick: LastPick) {
  try {
    localStorage.setItem(LAST, JSON.stringify(pick))
  } catch {
    // Not remembering is fine.
  }
}

/** "Varsity · Offense", or just "Varsity" for a page not sorted yet. */
export function spotLabel(s: PlaybookSpot): string {
  return s.section ? `${teamLabel(s.team)} · ${sectionLabel(s.section)}` : teamLabel(s.team)
}

/** One spot per team: the first page it is on there (a progression's step 1). Duplicates dropped. */
export function teamSpots(spots: PlaybookSpot[]): PlaybookSpot[] {
  const out: PlaybookSpot[] = []
  for (const s of spots) if (!out.some((x) => x.team === s.team)) out.push(s)
  return out
}

/** Where a play is in the playbook, as a link to its page. */
export function SpotLink({ spot, size = 'sm' }: { spot: PlaybookSpot; size?: 'sm' | 'md' }) {
  return (
    <Link
      href={withTeam(`/admin/playbook/${spot.pageId}`, spot.team)}
      title={`Open its page in the ${teamLabel(spot.team)} playbook`}
      className={
        size === 'md'
          ? 'btn btn-ghost !py-1.5 text-sm whitespace-nowrap'
          : 'inline-flex items-center text-xs font-bold rounded-full px-2.5 py-1 border whitespace-nowrap'
      }
      style={{ color: 'var(--gh-green)', borderColor: 'var(--gh-green)', background: size === 'md' ? undefined : '#eef6f1' }}
    >
      ✓ {spotLabel(spot)} ↗
    </Link>
  )
}

export function PlaybookPicker({
  teams,
  spots,
  onAdd,
  blocked,
  steps = 0,
  size = 'sm',
  showSpots = true,
  hint,
}: {
  /** The decks this coach may add to. Empty: there is nothing to pick. */
  teams: Team[]
  /** Where the play already is. */
  spots: PlaybookSpot[]
  /** Put it in. Resolves to what went wrong, or null when it's in. */
  onAdd: (team: Team, section: PlaybookSection) => Promise<string | null>
  /** Why it can't go in yet ("Name the play first"). */
  blocked?: string | null
  /** How many steps, when the play is a progression. */
  steps?: number
  /** md sits in a toolbar of buttons; sm sits on a card. */
  size?: 'sm' | 'md'
  /** Show where it already is (off when the card shows that itself). */
  showSpots?: boolean
  /** A word beside the links, e.g. that Update keeps the pages current. */
  hint?: string
}) {
  const [open, setOpen] = useState(false)
  const [team, setTeam] = useState<Team | null>(null)
  const [section, setSection] = useState<PlaybookSection>('offense')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const placed = teamSpots(spots)
  // Only the decks it isn't in yet: adding again would just find the page it has.
  const left = teams.filter((t) => !placed.some((s) => s.team === t))
  const picked: Team | null = team && left.includes(team) ? team : left[0] ?? null

  function show() {
    const last = lastPick()
    setTeam(last.team && left.includes(last.team) ? last.team : left[0] ?? null)
    setSection(last.section ?? 'offense')
    setError(null)
    setOpen(true)
  }

  async function add() {
    if (!picked || blocked || busy) return
    setBusy(true)
    setError(null)
    keepPick({ team: picked, section })
    const failed = await onAdd(picked, section)
    setBusy(false)
    if (failed) setError(failed)
    else setOpen(false)
  }

  const trigger =
    placed.length === 0 ? '📘 Playbook' : left.length === 1 ? `＋ ${teamLabel(left[0])}` : '＋ Playbook'

  return (
    <span className="relative inline-flex flex-wrap items-center gap-1.5">
      {showSpots && placed.map((s) => <SpotLink key={s.team} spot={s} size={size} />)}
      {hint && placed.length > 0 && <span className="text-xs text-gray-400">{hint}</span>}
      {left.length > 0 && (
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : show())}
          aria-expanded={open}
          aria-haspopup="dialog"
          title={placed.length ? `Add it to the ${left.map(teamLabel).join(' or ')} playbook too` : 'Put it in a playbook'}
          className={
            size === 'md'
              ? 'btn btn-ghost !py-1.5 text-sm whitespace-nowrap'
              : 'inline-flex items-center text-xs font-bold rounded-full px-2.5 py-1 border border-gray-200 text-gray-700 hover:border-gray-400 whitespace-nowrap'
          }
        >
          {trigger} <span className="text-gray-400 ml-0.5">▾</span>
        </button>
      )}

      <Popover open={open} onClose={() => setOpen(false)} label="Add to the playbook">
        <div className="p-3 space-y-3">
          <p className="font-black text-sm">Add to the playbook</p>

          {left.length > 1 && (
            <div>
              <span className="field-label">Team</span>
              <div className="grid grid-cols-2 gap-1.5">
                {left.map((t) => (
                  <Chip key={t} on={picked === t} onClick={() => setTeam(t)}>
                    {teamLabel(t)}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          <div>
            <span className="field-label">Section</span>
            <div className="flex flex-wrap gap-1.5">
              {PLAYBOOK_SECTIONS.map((s) => (
                <Chip key={s.key} on={section === s.key} onClick={() => setSection(s.key)}>
                  <span aria-hidden className="mr-1">{s.icon}</span>
                  {s.label}
                </Chip>
              ))}
            </div>
          </div>

          {steps > 1 && (
            <p className="text-xs text-gray-500">All {steps} steps go in, a page each, in order.</p>
          )}
          {blocked && <p className="text-xs font-semibold text-amber-700">{blocked}</p>}
          {error && (
            <p className="text-xs font-semibold text-red-700" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={add}
            disabled={!picked || !!blocked || busy}
            className="btn btn-primary w-full !py-2 text-sm disabled:opacity-50"
          >
            {busy ? 'Adding…' : picked ? `Add to ${teamLabel(picked)} · ${sectionLabel(section)}` : 'Add'}
          </button>
        </div>
      </Popover>
    </span>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="min-h-9 px-3 rounded-full border text-sm font-semibold transition"
      style={
        on
          ? { borderColor: 'var(--gh-green)', background: '#eef6f1', color: 'var(--gh-green)' }
          : { borderColor: '#e5e7eb', color: '#4b5563' }
      }
    >
      {children}
    </button>
  )
}
