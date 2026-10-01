// The program's sign-ups, and what state each one is in.
//
// Pure — no server imports — so the public pages, the home page callout and the
// admin screen all read one list and can't disagree about whether a sign-up is
// still taking players.

export type SignupStatus = 'open' | 'ongoing' | 'closed'

export const SIGNUP_STATUS_KEY = 'signup_status'

export interface StatusMeta {
  label: string
  /** Green and glowing means "this is happening"; grey means it isn't. */
  live: boolean
  /** Whether the form is still taking entries. */
  accepting: boolean
  /** Shown where the form used to be, once it stops accepting. */
  closedNote: string
}

export const SIGNUP_STATUS_META: Record<SignupStatus, StatusMeta> = {
  open: {
    label: 'Sign-ups open',
    live: true,
    accepting: true,
    closedNote: '',
  },
  ongoing: {
    label: 'Ongoing',
    live: true,
    accepting: false,
    closedNote:
      'Sign-ups are closed — this one is already underway. Talk to a coach if you think you should be on the roster.',
  },
  closed: {
    label: 'Sign-ups closed',
    live: false,
    accepting: false,
    closedNote: 'Sign-ups are closed. Watch the news feed for the next one.',
  },
}

export interface Signup {
  key: string
  /** Name on the admin screen and the home page callout. */
  label: string
  href: string
  /** The one line the home page callout leads with. */
  headline: string
  /** When, where, how much — the line under the headline. */
  detail: string
  /** Overrides the generic status wording, e.g. "League ongoing". */
  ongoingLabel?: string
  /** What it says until the status is changed from here. */
  defaultStatus: SignupStatus
}

export const SIGNUPS: Signup[] = [
  {
    key: 'barton-playday',
    label: 'Barton Playday + Trey Ennis',
    href: '/barton-playday',
    headline: 'Firebirds Winter Events — Barton Playday & Trey Ennis Tournament',
    detail: 'Barton Sat, Dec 5 · Trey Ennis Dec 12–13 · $50 per event, $100 for both',
    defaultStatus: 'open',
  },
  {
    key: 'swfl',
    label: 'SWFL Fall League',
    href: '/swfl',
    headline: 'South Wake Fall High School League at Seymour Park',
    detail: 'Six Monday nights, 6–9 PM · Aug 17 – Sep 28 · $75 per player',
    ongoingLabel: 'League ongoing',
    defaultStatus: 'ongoing',
  },
]

export const SIGNUP_KEYS = SIGNUPS.map((s) => s.key)

export function parseSignupStatus(value: string | null | undefined): Record<string, SignupStatus> {
  const out: Record<string, SignupStatus> = {}
  if (!value) return out
  try {
    const raw = JSON.parse(value) as Record<string, string>
    for (const [key, status] of Object.entries(raw ?? {})) {
      if (SIGNUP_KEYS.includes(key) && status in SIGNUP_STATUS_META) {
        out[key] = status as SignupStatus
      }
    }
  } catch {
    // A settings row we can't read is the same as one that was never written.
  }
  return out
}

export function statusOf(stored: Record<string, SignupStatus>, key: string): SignupStatus {
  return stored[key] ?? SIGNUPS.find((s) => s.key === key)?.defaultStatus ?? 'open'
}

/** What the badge says — "League ongoing" beats a generic "Ongoing". */
export function statusLabel(key: string, status: SignupStatus): string {
  const signup = SIGNUPS.find((s) => s.key === key)
  if (status === 'ongoing' && signup?.ongoingLabel) return signup.ongoingLabel
  return SIGNUP_STATUS_META[status].label
}

// ── Picking events on one sign-up ────────────────────────────────────────────

/** One event a combined sign-up covers. */
export interface SignupEvent {
  key: string
  label: string
  /** "Sat, Dec 5" — the short line beside the tick box. */
  when: string
}

/**
 * Sign-ups that cover more than one event: the player ticks the ones he can
 * make and pays per event. Kept on the signup's notes as "[Events: …]", so it
 * needs no column of its own.
 */
export const SIGNUP_EVENTS: Record<string, { events: SignupEvent[]; each: number; all: number }> = {
  'barton-playday': {
    events: [
      { key: 'barton', label: 'Barton College Playday', when: 'Sat, Dec 5 · Wilson' },
      { key: 'trey-ennis', label: 'Trey Ennis Tournament', when: 'Sat–Sun, Dec 12–13 · Durham' },
    ],
    each: 50,
    all: 100,
  },
}

/** What a player owes for the events he picked. */
export function signupFee(signup: string, picked: number): number {
  const cfg = SIGNUP_EVENTS[signup]
  if (!cfg || picked <= 0) return 0
  return picked >= cfg.events.length ? cfg.all : picked * cfg.each
}

const EVENTS_TAG = /^\[Events: ([^\]]*)\]\s*/

/** The notes with the events written in front. */
export function tagEvents(labels: string[], notes: string | null): string {
  return `[Events: ${labels.join(', ')}]${notes ? ` ${notes}` : ''}`
}

/** Pull the events back out of a signup's notes. */
export function readEvents(notes: string | null): { events: string[]; notes: string | null } {
  const m = (notes ?? '').match(EVENTS_TAG)
  if (!m) return { events: [], notes }
  const rest = (notes ?? '').replace(EVENTS_TAG, '').trim()
  return { events: m[1].split(',').map((s) => s.trim()).filter(Boolean), notes: rest || null }
}
