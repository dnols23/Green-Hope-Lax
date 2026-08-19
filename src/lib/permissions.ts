import { notFound } from 'next/navigation'
import { createClient, createServiceClient } from './supabase-server'
import { canSee, type StaffRole, type Viewer } from './sections'

// ── The three tiers ──────────────────────────────────────────────────────────
//   Team Hub   parents & players, one shared code (see teamAuth.ts)
//   Coach      signs in at /staff, reaches only the sections ticked for them
//   Owner      the program owner: every section, plus managing coaches
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

  const svc = createServiceClient()
  const [{ data: row }, { count: owners }] = await Promise.all([
    svc.from('coach_accounts').select('*').eq('email', email).maybeSingle(),
    svc.from('coach_accounts').select('email', { count: 'exact', head: true }).eq('is_owner', true),
  ])

  // Nobody is an owner yet — the first sign-in after this ships would otherwise
  // be locked out of the very screen that grants ownership. Stand in as owner
  // until a real one is named.
  const bootstrap = (owners ?? 0) === 0

  if (!row) {
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

  const acct = row as {
    display_name: string
    role: StaffRole
    is_owner: boolean
    permissions: unknown
  }
  return {
    email,
    name: acct.display_name,
    role: acct.role,
    isOwner: acct.is_owner || bootstrap,
    permissions: Array.isArray(acct.permissions) ? (acct.permissions as string[]) : [],
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
