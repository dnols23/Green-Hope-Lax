// The calendar's vocabulary.
//
// Pure — no server imports — so the calendar screen, the War Room, the Team Hub,
// the Parent Hub and the public schedule all describe the same things in the
// same words. The server half (reading, filtering by audience, writing) is
// calendarData.ts; the date arithmetic is calendarMath.ts.

// ── Who may see something ────────────────────────────────────────────────────

/**
 * Who an event is for. Coaches always see everything; this says who else does.
 *
 *   coaches   the staff and nobody else
 *   team      the staff and the players (Team Hub)
 *   parents   the staff and the parents (Parent Hub)
 *   public    everybody — the public schedule, the Team Hub, the Parent Hub
 */
export type CalAudience = 'coaches' | 'team' | 'parents' | 'public'

export const CAL_AUDIENCES: { key: CalAudience; label: string; hint: string }[] = [
  { key: 'coaches', label: 'Coaches only', hint: 'The staff. Nobody else sees it.' },
  { key: 'team', label: 'Coaches & players', hint: 'Shows in the Team Hub.' },
  { key: 'parents', label: 'Coaches & parents', hint: 'Shows in the Parent Hub.' },
  { key: 'public', label: 'Everyone', hint: 'Public schedule, Team Hub and Parent Hub.' },
]

export function isCalAudience(v: unknown): v is CalAudience {
  return v === 'coaches' || v === 'team' || v === 'parents' || v === 'public'
}

/** Where something is being looked at. */
export type CalSurface = 'coach' | 'team' | 'parents' | 'public'

/** The event audiences each surface may show. */
export const SURFACE_SEES: Record<CalSurface, CalAudience[]> = {
  coach: ['coaches', 'team', 'parents', 'public'],
  team: ['team', 'public'],
  parents: ['parents', 'public'],
  public: ['public'],
}

export function audienceLabel(a: CalAudience): string {
  return CAL_AUDIENCES.find((x) => x.key === a)?.label ?? 'Coaches only'
}

// ── What something is ────────────────────────────────────────────────────────

export type CalEventKind =
  | 'event'
  | 'meeting'
  | 'practice'
  | 'travel'
  | 'film'
  | 'social'
  | 'fundraiser'
  | 'deadline'
  | 'open'

export const CAL_EVENT_KINDS: { key: CalEventKind; label: string; icon: string }[] = [
  { key: 'event', label: 'Event', icon: '📌' },
  { key: 'practice', label: 'Practice', icon: '🥍' },
  { key: 'meeting', label: 'Meeting', icon: '🗣' },
  { key: 'film', label: 'Film', icon: '🎬' },
  { key: 'travel', label: 'Travel', icon: '🚌' },
  { key: 'social', label: 'Team social', icon: '🍕' },
  { key: 'fundraiser', label: 'Fundraiser', icon: '💵' },
  { key: 'deadline', label: 'Deadline', icon: '⏰' },
  // A field or gym nobody has booked — where an off-season workout can go.
  { key: 'open', label: 'Open field', icon: '🟩' },
]

export function isCalEventKind(v: unknown): v is CalEventKind {
  return CAL_EVENT_KINDS.some((k) => k.key === v)
}

/** A calendar team: one of the two squads, or the program as a whole. */
export type CalTeam = 'varsity' | 'jv' | 'program'

export const CAL_TEAMS: { key: CalTeam; label: string }[] = [
  { key: 'varsity', label: 'Varsity' },
  { key: 'jv', label: 'JV' },
  { key: 'program', label: 'Program' },
]

export function isCalTeam(v: unknown): v is CalTeam {
  return v === 'varsity' || v === 'jv' || v === 'program'
}

// ── The rows ─────────────────────────────────────────────────────────────────

/** Something put on the calendar by a head coach. Times are ISO strings. */
export interface CalEvent {
  id: string
  team: CalTeam
  title: string
  kind: CalEventKind
  startsAt: string
  /** Exclusive. For an all-day event, midnight after the last day. */
  endsAt: string
  allDay: boolean
  location: string | null
  notes: string | null
  audience: CalAudience
  createdBy: string | null
}

export type AvailabilityStatus = 'available' | 'unavailable'

/** One coach saying when they can or can't be there. */
export interface Availability {
  id: string
  coachEmail: string
  coachName: string
  status: AvailabilityStatus
  startsAt: string
  endsAt: string
  allDay: boolean
  repeatWeekly: boolean
  /** YYYY-MM-DD, inclusive. Null repeats for ever. */
  repeatUntil: string | null
  note: string | null
}

/**
 * Everything the calendar draws, in one shape.
 *
 * Events, games, practice plans and availability all live in different tables
 * and mean different things, but on the grid they are all "a thing from this
 * time to that time, in this colour, that opens to here". The data layer turns
 * each into one of these, so the screen never has to know where a block came
 * from except to decide what clicking it does.
 */
export type CalItemSource = 'event' | 'game' | 'practice' | 'availability'

export interface CalItem {
  /** Unique across sources, e.g. `event:<uuid>`, `game:<uuid>`, `avail:<uuid>:<n>`. */
  key: string
  source: CalItemSource
  /** The row id in its own table. */
  id: string
  title: string
  startsAt: string
  endsAt: string
  allDay: boolean
  team: CalTeam
  audience: CalAudience
  location: string | null
  notes: string | null
  /** event kind, 'game', 'practice', or the availability status. */
  kind: string
  /** Where clicking it goes, when it is not edited in place. */
  href: string | null
  /** Whether the viewer may change it. */
  editable: boolean
  /** Availability only: whose it is. */
  coachEmail?: string
  coachName?: string
  /** Game only: home, away or neutral. */
  homeAway?: string
  /** Game only: set once it is final. */
  result?: string | null
}

// ── Colour ───────────────────────────────────────────────────────────────────

/**
 * What each kind of thing looks like on the grid.
 *
 * Games are maroon because they are the point. Practices are the program green.
 * Everything else gets its own hue so a busy week reads at a glance, and
 * availability is drawn quieter than all of it — it is context, not an event.
 */
export const KIND_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  game: { bg: '#7A1F2B', fg: '#ffffff', border: '#5C1721' },
  practice: { bg: '#00693E', fg: '#ffffff', border: '#00512F' },
  event: { bg: '#2a78d6', fg: '#ffffff', border: '#1f5ea8' },
  meeting: { bg: '#4a3aa7', fg: '#ffffff', border: '#382c80' },
  film: { bg: '#374151', fg: '#ffffff', border: '#1f2937' },
  travel: { bg: '#eb6834', fg: '#ffffff', border: '#c24f20' },
  social: { bg: '#e87ba4', fg: '#3b0a1f', border: '#c75d86' },
  fundraiser: { bg: '#eda100', fg: '#3a2800', border: '#c48400' },
  deadline: { bg: '#e34948', fg: '#ffffff', border: '#b83332' },
  open: { bg: '#dcf2e4', fg: '#00512F', border: '#6fbf8f' },
  unavailable: { bg: '#fde8ea', fg: '#7A1F2B', border: '#f3b8bf' },
  available: { bg: '#e3f4ea', fg: '#00512F', border: '#a9d8bd' },
}

export function colorFor(item: Pick<CalItem, 'source' | 'kind'>) {
  if (item.source === 'game') return KIND_COLORS.game
  if (item.source === 'practice') return KIND_COLORS.practice
  return KIND_COLORS[item.kind] ?? KIND_COLORS.event
}

// ── Views ────────────────────────────────────────────────────────────────────

export type CalView = 'day' | 'week' | 'month' | 'year' | 'agenda'

export const CAL_VIEWS: { key: CalView; label: string; short: string }[] = [
  { key: 'day', label: 'Day', short: 'D' },
  { key: 'week', label: 'Week', short: 'W' },
  { key: 'month', label: 'Month', short: 'M' },
  { key: 'year', label: 'Year', short: 'Y' },
  { key: 'agenda', label: 'Agenda', short: 'A' },
]

export function isCalView(v: unknown): v is CalView {
  return CAL_VIEWS.some((x) => x.key === v)
}

/** How long a game is drawn for, since the schedule only knows when it starts. */
export const GAME_MINUTES = 120
