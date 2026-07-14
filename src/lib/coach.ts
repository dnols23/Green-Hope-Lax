import { notFound } from 'next/navigation'
import { createClient, createServiceClient } from './supabase-server'
import type { CoachAccount, CoachRole } from './evaluations'

// Who is the signed-in coach, and are they Head or Assistant? Coach identity is
// their Supabase auth email (the synthetic `<username>@ghfalcons.local`). Role
// comes from coach_accounts; a coach with no row is treated as an assistant.

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

  const svc = createServiceClient()
  const { data } = await svc.from('coach_accounts').select('*').eq('email', email).maybeSingle()
  if (data) {
    const acct = data as CoachAccount
    return { email, name: acct.display_name, role: acct.role }
  }
  // No account row yet — default to assistant; derive a friendly name from the login.
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
