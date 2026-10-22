'use server'

import { getViewer } from './permissions'
import { listStaff } from './staff'
import { currentParent } from './parentAccess'
import { claimSlot, releaseClaim } from './signupSheets'
import { notifyCoaches } from './notify'
import { emailShell, row } from './email'
import {
  applyLists,
  emailSignedUp,
  gameOfSlot,
  gameWhen,
  getGameSignup,
  readVolunteerSettings,
  remindGameNow,
  setGamePositions,
  writeVolunteerSettings,
} from './gameVolunteers'
import {
  cleanPositions,
  gameTitle,
  parseVolunteerSettings,
  seesLevel,
  type GameSignup,
  type Position,
  type VolunteerSettings,
} from './gameVolunteerModel'

/**
 * Volunteer sign-ups for games.
 *
 * The head coach sets the positions — for every game at once, or one game by
 * hand. A coach he has chosen sees his team's sign-ups. A parent signed in to
 * the Parent Hub takes and lets go of spots, once he has opened them up.
 */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; confirm?: number }

const idOf = (v: unknown) => (typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v) ? v : null)

async function owner() {
  const v = await getViewer()
  return v?.isOwner ? v : null
}

/** Whoever comes off a position, in a sentence for the confirm. */
const dropWarning = (n: number) =>
  `${n} ${n === 1 ? 'parent is' : 'parents are'} signed up for a position you’re taking off. They’ll be emailed that it changed.`

// ── The head coach ──────────────────────────────────────────────────────────

export async function loadVolunteerSetup(): Promise<Result<{ settings: VolunteerSettings; coaches: { email: string; name: string }[] }>> {
  const v = await owner()
  if (!v) return { ok: false, error: 'Only the head coach sets up volunteers.' }
  const [settings, staff] = await Promise.all([readVolunteerSettings(), listStaff()])
  return {
    ok: true,
    settings,
    coaches: staff.filter((s) => !s.isOwner).map((s) => ({ email: s.email.toLowerCase(), name: s.name || s.email })),
  }
}

/**
 * Save the lists, who sees sign-ups and whether parents can. Every game that
 * follows the lists picks the change up. Taking a position off that parents
 * are signed up for asks first (`confirm`).
 */
export async function saveVolunteerSetup(input: { settings: VolunteerSettings; confirm?: boolean }): Promise<Result<{ games: number }>> {
  const v = await owner()
  if (!v) return { ok: false, error: 'Only the head coach sets up volunteers.' }
  const next = parseVolunteerSettings(input.settings)
  const before = await readVolunteerSettings()
  const listsChanged = JSON.stringify(before.lists) !== JSON.stringify(next.lists)
  if (listsChanged && !input.confirm) {
    const { dropped } = await applyLists(next, true)
    if (dropped.length) return { ok: false, error: dropWarning(dropped.length), confirm: dropped.length }
  }
  if (!(await writeVolunteerSettings(next))) return { ok: false, error: 'Could not save. Try again.' }
  // Every upcoming game gets its sign-up (the first save makes them).
  const { games } = await applyLists(next)
  return { ok: true, games }
}

/** One game's sign-up, for a coach who sees that team's. With emails. */
export async function loadGameVolunteers(gameId: string): Promise<Result<{ signup: GameSignup; isOwner: boolean; open: boolean }>> {
  const v = await getViewer()
  const id = idOf(gameId)
  if (!v || !id) return { ok: false, error: 'Sign in again.' }
  const [settings, signup] = await Promise.all([readVolunteerSettings(), getGameSignup(id, { emails: true })])
  if (!signup) return { ok: false, error: 'That game is gone.' }
  if (!v.isOwner && !seesLevel(settings.viewers[v.email.toLowerCase()] ?? 'none', signup.level))
    return { ok: false, error: 'This team’s sign-ups aren’t shared with you.' }
  return { ok: true, signup, isOwner: v.isOwner, open: settings.open }
}

/** Change one game's positions by hand, or (`'lists'`) put it back on the lists. */
export async function saveGamePositions(input: {
  gameId: string
  positions: Position[] | 'lists'
  confirm?: boolean
}): Promise<Result<{ signup: GameSignup }>> {
  if (!(await owner())) return { ok: false, error: 'Only the head coach changes positions.' }
  const id = idOf(input.gameId)
  if (!id) return { ok: false, error: 'That game is gone.' }
  const positions = input.positions === 'lists' ? 'lists' : cleanPositions(input.positions)
  if (!input.confirm) {
    const { dropped } = await setGamePositions(id, positions, true)
    if (dropped.length) return { ok: false, error: dropWarning(dropped.length), confirm: dropped.length }
  }
  const { ok } = await setGamePositions(id, positions)
  const signup = ok ? await getGameSignup(id, { emails: true }) : null
  return signup ? { ok: true, signup } : { ok: false, error: 'Could not save. Try again.' }
}

export async function remindVolunteers(gameId: string): Promise<Result<{ sent: number }>> {
  if (!(await owner())) return { ok: false, error: 'Only the head coach sends reminders.' }
  const id = idOf(gameId)
  if (!id) return { ok: false, error: 'That game is gone.' }
  return { ok: true, sent: await remindGameNow(id) }
}

// ── Parents ─────────────────────────────────────────────────────────────────

/** A game's sign-up for the Parent Hub pop-up. Coaches may look; only parents sign up. */
export async function openGameSignup(gameId: string): Promise<Result<{ signup: GameSignup; signedIn: boolean }>> {
  const id = idOf(gameId)
  if (!id) return { ok: false, error: 'That game is gone.' }
  const [parent, viewer, settings] = await Promise.all([currentParent(), getViewer(), readVolunteerSettings()])
  if (!parent && !viewer) return { ok: false, error: 'Sign in to the Parent Hub first.' }
  if (!settings.open && !viewer) return { ok: false, error: 'Volunteer sign-ups aren’t open yet.' }
  const signup = await getGameSignup(id, { parentId: parent?.id ?? null })
  return signup ? { ok: true, signup, signedIn: !!parent } : { ok: false, error: 'That game is gone.' }
}

export async function takeGameSpot(input: { gameId: string; slotId: string; note?: string }): Promise<Result<{ signup: GameSignup }>> {
  const parent = await currentParent()
  if (!parent) return { ok: false, error: 'Sign in to the Parent Hub first.' }
  if (!(await readVolunteerSettings()).open) return { ok: false, error: 'Volunteer sign-ups aren’t open yet.' }
  const slotId = idOf(input.slotId)
  const game = slotId ? await gameOfSlot(slotId) : null
  if (!slotId || !game || game.id !== input.gameId) return { ok: false, error: 'That spot is no longer on the sign-up.' }
  if (Date.parse(game.game_date) < Date.now()) return { ok: false, error: 'This game has already started.' }

  const note = String(input.note ?? '').trim().slice(0, 200) || null
  const res = await claimSlot({ slotId, parentId: parent.id, name: parent.name, email: parent.email, note })
  if (!res.ok) return { ok: false, error: res.error ?? 'Could not sign you up.' }

  const signup = await getGameSignup(game.id, { parentId: parent.id })
  const position = signup?.positions.find((p) => p.id === slotId)?.label ?? 'Volunteer'
  await Promise.all([
    parent.email ? emailSignedUp({ to: parent.email, name: parent.name, position, note, game }) : null,
    notifyCoaches({
      event: 'signup-claim',
      subject: `${parent.name} signed up: ${position} — ${gameTitle(game)}`,
      replyTo: parent.email ?? undefined,
      html: emailShell(
        'Game volunteer',
        row('Game', `${gameTitle(game)} · ${gameWhen(game.game_date)}`) +
          row('Spot', position) +
          row('Parent', parent.name) +
          row('Email', parent.email) +
          row('Phone', parent.phone) +
          row('Note', note),
      ),
    }),
  ])
  return signup ? { ok: true, signup } : { ok: false, error: 'Signed up — reopen the game to see it.' }
}

export async function dropGameSpot(input: { gameId: string; claimId: string }): Promise<Result<{ signup: GameSignup }>> {
  const parent = await currentParent()
  if (!parent) return { ok: false, error: 'Sign in to the Parent Hub first.' }
  const claimId = idOf(input.claimId)
  const gameId = idOf(input.gameId)
  if (!claimId || !gameId) return { ok: false, error: 'That spot is gone.' }
  await releaseClaim(claimId, parent.id)
  const signup = await getGameSignup(gameId, { parentId: parent.id })
  return signup ? { ok: true, signup } : { ok: false, error: 'That game is gone.' }
}
