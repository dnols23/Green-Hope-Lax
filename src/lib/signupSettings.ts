import { createServiceClient } from './supabase-server'
import { SIGNUP_STATUS_KEY, parseSignupStatus, type SignupStatus } from './signups'

/**
 * Which sign-ups are open, closed, or already underway.
 *
 * Stored as one app_settings row so a coach can flip a sign-up closed the night
 * it fills up without anybody deploying anything. A database that isn't
 * reachable (a build, a fresh clone) falls back to the defaults in the list.
 */
export async function readSignupStatus(): Promise<Record<string, SignupStatus>> {
  try {
    const { data } = await createServiceClient()
      .from('app_settings')
      .select('value')
      .eq('key', SIGNUP_STATUS_KEY)
      .maybeSingle()
    return parseSignupStatus(data?.value as string | undefined)
  } catch {
    return {}
  }
}
