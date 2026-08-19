import { notFound } from 'next/navigation'
import { createClient, createServiceClient } from './supabase-server'
import type { CoachAccount, CoachRole } from './evaluations'
import { readStaff } from './staff'

// Who is the signed-in coach, and are they Head or Assistant? Coach identity is
// their Supabase auth email (the synthetic `<username>@ghfalcons.local`).
//
// The role comes from the staff record the owner edits in Coach Access. The old
// coach_accounts table is still consulted for anyone set up before that page
// existed, so nobody loses their Head role mid-season; the owner is always Head,
// since they run the program.

export interface CurrentCoach {
  email: string
  name: string
  role: CoachRole
}

export async function getCurrentCoach(): Promise<CurrentCoach | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null
  const email = user.email.toLowerCase()

  // What the owner set on Coach Access wins.
  const record = await readStaff(email)
  if (record) {
    return {
      email,
      name: record.name,
      role: record.isOwner ? 'head' : record.role,
    }
  }

  // Set up before Coach Access existed — fall back to the original table.
  const svc = createServiceClient()
  const { data } = await svc.from('coach_accounts').select('*').eq('email', email).maybeSingle()
  if (data) {
    const acct = data as CoachAccount
    return { email, name: acct.display_name, role: acct.role }
  }

  // Nothing recorded anywhere — default to assistant; derive a name from the login.
  const name = email.split('@')[0].replace(/^hc/i, '').replace(/[._-]+/g, ' ').trim() || email
  return { email, name: titleCase(name), role: 'assistant' }
}

// Guard for Head-Coach-only pages/actions. Renders 404 for anyone else.
export async function requireHeadCoach(): Promise<CurrentCoach> {
  const coach = await getCurrentCoach()
  if (!coach || coach.role !== 'head') notFound()
  return coach
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}
