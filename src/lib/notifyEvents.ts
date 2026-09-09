// What the site can email you about, and how those choices are stored.
//
// Pure on purpose — no server imports — so the admin screen and the sending code
// share one list. Adding a notification later means adding one entry here and
// calling notifyCoaches with its key.

export interface NotifyEvent {
  key: string
  label: string
  /** Plain-English description of what makes this email arrive. */
  description: string
}

export const NOTIFY_EVENTS: NotifyEvent[] = [
  {
    key: 'interest',
    label: 'Interest forms',
    description: 'Someone fills out Join Green Hope Lacrosse or Join the Green Machine.',
  },
  {
    key: 'swfl',
    label: 'Fall league signups',
    description: 'A player signs up for the South Wake Fall League.',
  },
  {
    key: 'contact',
    label: 'Contact messages',
    description: 'Someone sends a message from the Contact page.',
  },
]

export interface NotifySettings {
  /** Who gets the email. Empty means fall back to the COACH_NOTIFY_EMAIL env var. */
  recipients: string[]
  /** Event keys that are switched off. Anything not listed is on. */
  off: string[]
}

export const EMPTY_SETTINGS: NotifySettings = { recipients: [], off: [] }

export function parseNotifySettings(value: string | null | undefined): NotifySettings {
  if (!value) return EMPTY_SETTINGS
  try {
    const raw = JSON.parse(value) as Partial<NotifySettings>
    return {
      recipients: Array.isArray(raw.recipients) ? raw.recipients.map(String) : [],
      off: Array.isArray(raw.off) ? raw.off.map(String) : [],
    }
  } catch {
    return EMPTY_SETTINGS
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Split a typed list of addresses on commas, spaces or new lines.
 *
 * Returns the good ones and the bad ones separately so the screen can save what
 * works and say exactly which entry it couldn't use.
 */
export function parseRecipients(input: string): { valid: string[]; invalid: string[] } {
  const parts = input
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const valid: string[] = []
  const invalid: string[] = []
  for (const p of parts) {
    if (EMAIL_RE.test(p)) {
      if (!valid.includes(p)) valid.push(p)
    } else {
      invalid.push(p)
    }
  }
  return { valid, invalid }
}

export function isEventOn(settings: NotifySettings, key: string): boolean {
  return !settings.off.includes(key)
}
