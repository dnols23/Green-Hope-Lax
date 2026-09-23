import { cookies } from 'next/headers'
import { createClient } from './supabase-server'
import { TEAM_COOKIE, teamCookieToken } from './teamAuth'
import { currentPlayer } from './playerAccess'
import { currentParent } from './parentAccess'

/**
 * Who is actually allowed to read the Team Hub and Parent Hub calendars.
 *
 * Server-only. The proxy keeps strangers out of /team and /parents, but it runs
 * on the edge and only checks that a player's or parent's cookie is *there* —
 * it cannot look the token up. That is fine for a sign-up sheet. The calendar
 * carries things a head coach chose to show to players only or to parents only,
 * so before a hub draws any of it, check the cookie really belongs to somebody:
 * the team password's own token, a player or parent whose link is still live,
 * or a signed-in coach looking at what the families see.
 */

async function signedInCoach(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return !!user
}

/** True for anyone the Team Hub calendar may be shown to. */
export async function mayReadTeamCalendar(): Promise<boolean> {
  const token = (await cookies()).get(TEAM_COOKIE)?.value
  if (token && token === (await teamCookieToken())) return true
  if (await currentPlayer()) return true
  return signedInCoach()
}

/** True for anyone the Parent Hub calendar may be shown to. */
export async function mayReadParentCalendar(): Promise<boolean> {
  if (await currentParent()) return true
  return signedInCoach()
}
