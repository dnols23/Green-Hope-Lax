import { createServiceClient } from './supabase-server'
import { sendEmail } from './email'
import {
  parseNotifySettings,
  isEventOn,
  type NotifySettings,
  EMPTY_SETTINGS,
} from './notifyEvents'

// Coach notifications: who gets told when a form comes in, and about what.
//
// Recipients live in app_settings so they can be changed from Admin →
// Notifications without a redeploy. COACH_NOTIFY_EMAIL still works as the
// fallback, so an existing deployment keeps behaving exactly as it did.

export const NOTIFY_KEY = 'notify_settings'

export async function readNotifySettings(): Promise<NotifySettings> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('app_settings')
    .select('value')
    .eq('key', NOTIFY_KEY)
    .maybeSingle()
  return parseNotifySettings(data?.value as string | undefined)
}

export async function writeNotifySettings(settings: NotifySettings): Promise<void> {
  const svc = createServiceClient()
  await svc
    .from('app_settings')
    .upsert({ key: NOTIFY_KEY, value: JSON.stringify(settings) }, { onConflict: 'key' })
}

function envRecipients(): string[] {
  return (process.env.COACH_NOTIFY_EMAIL ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export interface NotifyStatus {
  /** Resend is wired up: an API key and a from address are both set. */
  connected: boolean
  hasApiKey: boolean
  from: string | null
  recipients: string[]
  /** Where the recipients came from, so the screen can say so. */
  source: 'settings' | 'env' | 'none'
  settings: NotifySettings
}

export async function notifyStatus(): Promise<NotifyStatus> {
  const settings = await readNotifySettings().catch(() => EMPTY_SETTINGS)
  const fromEnv = envRecipients()
  const recipients = settings.recipients.length ? settings.recipients : fromEnv
  const hasApiKey = Boolean(process.env.RESEND_API_KEY)
  const from = process.env.EMAIL_FROM || null
  return {
    connected: hasApiKey && Boolean(from),
    hasApiKey,
    from,
    recipients,
    source: settings.recipients.length ? 'settings' : fromEnv.length ? 'env' : 'none',
    settings,
  }
}

/**
 * Email the coaching staff about something that just happened on the site.
 *
 * Never throws and never blocks the thing that triggered it: a parent's form is
 * already saved by the time this runs, so a missing API key or a Resend outage
 * costs a notification, not a signup.
 */
export async function notifyCoaches(args: {
  event: string
  subject: string
  html: string
  replyTo?: string
}): Promise<boolean> {
  try {
    const status = await notifyStatus()
    if (!isEventOn(status.settings, args.event)) return false
    if (!status.recipients.length) {
      console.warn(`[notify] No recipients set — skipping "${args.event}".`)
      return false
    }
    return await sendEmail({
      to: status.recipients,
      subject: args.subject,
      html: args.html,
      replyTo: args.replyTo,
    })
  } catch (err) {
    console.error('[notify] failed:', err)
    return false
  }
}
