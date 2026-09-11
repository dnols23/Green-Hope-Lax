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
    label: 'Barton College Playday',
    href: '/barton-playday',
    headline: 'Barton College Playday — Wilson, NC',
    detail: 'Sat, Dec 5 · Morning games · Returners only · $50 per player',
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
