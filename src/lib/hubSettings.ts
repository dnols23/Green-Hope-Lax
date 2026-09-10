import { createServiceClient } from './supabase-server'
import { HUB_MODES_KEY, parseModesOff } from './hubModes'

/**
 * Modes the head coach has switched off for the staff.
 *
 * Never throws: this runs in a layout wrapping every coaching page, and a
 * settings read failing is not a reason for a coach to meet an error page —
 * every mode on is the right answer when we cannot tell.
 */
export async function readModesOff(): Promise<string[]> {
  try {
    const svc = createServiceClient()
    const { data } = await svc
      .from('app_settings')
      .select('value')
      .eq('key', HUB_MODES_KEY)
      .maybeSingle()
    return parseModesOff(data?.value as string | undefined)
  } catch {
    return []
  }
}
