import { notFound } from 'next/navigation'
import { createClient } from './supabase-server'
import { readStaff, hasOwner } from './staff'
import { canSee, type Viewer } from './sections'

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

export { SECTIONS, GRANTABLE, canSee, visibleSections } from './sections'
export type { AdminSection, Viewer, StaffRole } from './sections'

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
      bootstrap,
    }
  }

  return {
    email,
    name: record.name,
    role: record.role,
    isOwner: record.isOwner || bootstrap,
    permissions: record.permissions,
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

export async function requireOwner(): Promise<Viewer> {
  const viewer = await getViewer()
  if (!viewer?.isOwner) notFound()
  return viewer
}
