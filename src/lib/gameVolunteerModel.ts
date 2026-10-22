// Volunteer sign-ups for games: the words and shapes. Pure — the setup card,
// the parents' pop-up and the server all read it.

export type VolLevel = 'varsity' | 'jv'
/** Which teams' sign-ups a coach sees on his calendar. */
export type VolSee = 'none' | 'varsity' | 'jv' | 'all'

/** One job at a game: "Scorebook", one person, "at the table". */
export interface Position {
  label: string
  needed: number
  detail: string | null
}

export interface VolunteerSettings {
  /** Parents see the sign-ups. Off while the positions are still being worked out. */
  open: boolean
  /** The positions every game starts with, by team and by home or away. */
  lists: Record<VolLevel, { home: Position[]; away: Position[] }>
  /** Coaches (by login email) who see sign-ups on their calendar. The owner always sees them all. */
  viewers: Record<string, VolSee>
}

export const VOLUNTEER_KEY = 'game_volunteers'

const HOME: Position[] = [
  { label: 'Scorebook', needed: 1, detail: 'Keep the official book at the table' },
  { label: 'Game clock', needed: 1, detail: 'Run the clock and scoreboard' },
  { label: 'Post-game snacks', needed: 1, detail: 'Something for the team after the game' },
]
const AWAY: Position[] = [{ label: 'Post-game snacks', needed: 1, detail: 'Something for the team after the game' }]

export const DEFAULT_VOLUNTEERS: VolunteerSettings = {
  open: false,
  lists: { varsity: { home: HOME, away: AWAY }, jv: { home: HOME, away: AWAY } },
  viewers: {},
}

/** Tidy a list: named, 1–50 people each, no job twice, at most 30. */
export function cleanPositions(list: unknown): Position[] {
  if (!Array.isArray(list)) return []
  const seen = new Set<string>()
  const out: Position[] = []
  for (const p of list) {
    const o = (p ?? {}) as Record<string, unknown>
    const label = String(o.label ?? '').trim().slice(0, 60)
    const key = label.toLowerCase()
    if (!label || seen.has(key)) continue
    seen.add(key)
    const n = Math.round(Number(o.needed))
    out.push({
      label,
      needed: Number.isFinite(n) ? Math.min(50, Math.max(1, n)) : 1,
      detail: String(o.detail ?? '').trim().slice(0, 200) || null,
    })
    if (out.length >= 30) break
  }
  return out
}

const isSee = (v: unknown): v is VolSee => v === 'none' || v === 'varsity' || v === 'jv' || v === 'all'

export function parseVolunteerSettings(raw: unknown): VolunteerSettings {
  let o: Record<string, unknown> = {}
  try {
    o = (typeof raw === 'string' ? JSON.parse(raw) : raw ?? {}) as Record<string, unknown>
  } catch {
    o = {}
  }
  const lists = (o.lists ?? {}) as Record<string, Record<string, unknown> | undefined>
  const pick = (level: VolLevel, venue: 'home' | 'away') =>
    Array.isArray(lists[level]?.[venue]) ? cleanPositions(lists[level]![venue]) : DEFAULT_VOLUNTEERS.lists[level][venue]
  const viewers: Record<string, VolSee> = {}
  for (const [email, see] of Object.entries((o.viewers ?? {}) as Record<string, unknown>)) {
    if (isSee(see) && see !== 'none') viewers[email.toLowerCase()] = see
  }
  return {
    open: o.open === true,
    lists: {
      varsity: { home: pick('varsity', 'home'), away: pick('varsity', 'away') },
      jv: { home: pick('jv', 'home'), away: pick('jv', 'away') },
    },
    viewers,
  }
}

/** Whether a coach's setting covers a team's game. */
export function seesLevel(see: VolSee, level: VolLevel): boolean {
  return see === 'all' || see === level
}

/** A game's sign-up, as the pop-up and the coach's list draw it. */
export interface GameSignup {
  gameId: string
  sheetId: string
  /** "Varsity vs Holly Springs" */
  title: string
  startsAt: string
  location: string | null
  level: VolLevel
  homeAway: string
  /** Changed by hand for this game, rather than following the list. */
  custom: boolean
  positions: {
    id: string
    label: string
    detail: string | null
    needed: number
    people: { id: string; name: string; note: string | null; mine: boolean; email?: string | null }[]
  }[]
}

export function gameTitle(g: { level: string | null; home_away: string | null; opponent: string | null }): string {
  const team = g.level === 'jv' ? 'JV' : 'Varsity'
  return `${team} ${g.home_away === 'away' ? '@' : 'vs'} ${String(g.opponent ?? '').trim()}`.trim()
}

/** Spots still open across a sign-up. */
export function spotsOpen(s: Pick<GameSignup, 'positions'>): number {
  return s.positions.reduce((n, p) => n + Math.max(0, p.needed - p.people.length), 0)
}
