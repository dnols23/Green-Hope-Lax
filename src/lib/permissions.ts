import { notFound } from 'next/navigation'
import { createClient } from './supabase-server'
import { readStaff, hasOwner } from './staff'
import { canSee, canTeam, teamFor, teamScope, type Viewer } from './sections'
import type { Team } from './teams'

// ── The three ways in ────────────────────────────────────────────────────────
//   Parents & players  the Team Hub shared code (see teamAuth.ts)
//   Coaches            sign in at /staff, reach only what the owner ticked
//   Owner              /admin, reaches everything and curates the coaches
//
// URL prefix is deliberately NOT the security boundary: coaches and the owner
// share one management app, and a coach can be granted any section. The boundary
// is requireSection(), which every admin page calls.
//
// Server-only — reads cookies and the database. Client components that just need
// the section list should import from ./sections instead.

export { SECTIONS, GRANTABLE, STAFF_TEAMS, STAFF_ROLES, runsATeam, canSee, visibleSections, teamScope, teamsFor, canTeam, teamFor } from './sections'
export type { AdminSection, Viewer, StaffRole, StaffTeam } from './sections'

export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null
  const email = user.email.toLowerCase()

  const [record, ownerExists] = await Promise.all([readStaff(email), hasOwner()])

  // Nobody has been made owner yet, so whoever signs in stands in as one —
  // otherwise the first sign-in would be locked out of the very screen that
  // grants ownership. Ends the moment a real owner is saved.
  const bootstrap = !ownerExists

  if (!record) {
    const guess = email.split('@')[0].replace(/^hc/i, '').replace(/[._-]+/g, ' ').trim() || email
    return {
      email,
      name: guess.replace(/\b\w/g, (c) => c.toUpperCase()),
      role: 'assistant',
      isOwner: bootstrap,
      permissions: [],
      team: 'all',
      bootstrap,
    }
  }

  return {
    email,
    name: record.name,
    role: record.role,
    isOwner: record.isOwner || bootstrap,
    permissions: record.permissions,
    // The owner runs the whole program; nobody can pen them into one half.
    team: record.isOwner || bootstrap ? 'all' : record.team,
    bootstrap,
  }
}

/**
 * Page guard. Every admin page calls this with its section key; anyone without
 * it gets a 404 rather than a redirect, so the page's existence isn't leaked.
 */
export async function requireSection(key: string): Promise<Viewer> {
  const viewer = await getViewer()
  if (!canSee(viewer, key)) notFound()
  return viewer as Viewer
}

/**
 * Guard for a page two grants can reach: the full-team one, or the JV-only one.
 * Returns the viewer plus which scope applies, so the page can limit a JV coach
 * to their own team rather than hiding the page entirely.
 */
export async function requireTeamScope(
  fullKey: string,
  jvKey: string
): Promise<{ viewer: Viewer; scope: 'jv' | 'all' }> {
  const viewer = await getViewer()
  const scope = teamScope(viewer, fullKey, jvKey)
  if (scope === 'none') notFound()
  return { viewer: viewer as Viewer, scope }
}

/**
 * A team-scoped page. Returns the team it should actually open on, and whether
 * the coach is locked to it — so the page can leave out the "other team →"
 * switch rather than offering a door that won't open.
 */
export async function requireTeam(
  key: string,
  asked: unknown
): Promise<{ viewer: Viewer; team: Team; locked: boolean; canWrite: boolean }> {
  const viewer = await requireSection(key)
  const team = teamFor(viewer, asked)
  return {
    viewer,
    team,
    /* Nothing is locked any more — both sides are open to look at. Kept so the
       pages that read it carry on working; it is always false. */
    locked: false,
    /** Whether he may change what he is looking at. */
    canWrite: canTeam(viewer, team),
  }
}

/** Guard for an action that writes to one team's side of the program. */
export async function mayWriteTeam(viewer: Viewer | null, team: Team): Promise<boolean> {
  return canTeam(viewer, team)
}

export async function requireOwner(): Promise<Viewer> {
  const viewer = await getViewer()
  if (!viewer?.isOwner) notFound()
  return viewer
}
