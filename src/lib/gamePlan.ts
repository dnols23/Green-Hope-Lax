// A game plan: how we are going to play one opponent.
//
// Not a practice with a different name. A practice is a clock of blocks; a game
// plan is a set of decisions — the offense, the defense, the ride, the clear,
// the specials; who starts where; what each coach owns on the day — and the
// game-day schedule that gets everyone from arrival to the opening faceoff.
//
// Stored whole in plans.details (0042). Pure and forgiving: an older or half-
// saved plan reads back as the parts that still make sense, never an error.

import { newId } from './planner'

// ── Systems ──────────────────────────────────────────────────────────────────

/** One decision about how we play: what we are in, and what to know about it. */
export interface GameSystem {
  /** offense | defense | ride | clear | manUp | manDown | faceoff */
  key: SystemKey
  /** The call, as the staff would say it — "2-3-1, pop from X", "Adjacent slide". */
  call: string
  /** What the players need to know about it for this opponent. */
  notes: string
  /** A saved play from the Library that shows it, if there is one. */
  playId: string | null
}

export type SystemKey = 'offense' | 'defense' | 'ride' | 'clear' | 'manUp' | 'manDown' | 'faceoff'

export const SYSTEM_SLOTS: { key: SystemKey; label: string; icon: string; placeholder: string; suggestions: string[] }[] = [
  {
    key: 'offense',
    label: 'Offense',
    icon: '⚔️',
    placeholder: 'e.g. 2-3-1, dodge from X',
    suggestions: ['2-3-1', '1-4-1', '2-2-2', '1-3-2', '3-3', 'Motion', 'Circle', 'Pick-and-roll up top'],
  },
  {
    key: 'defense',
    label: 'Defense',
    icon: '🛡',
    placeholder: 'e.g. Man, adjacent slide',
    suggestions: ['Man, adjacent slide', 'Man, crease slide', 'Man, no slide (hold)', 'Backer zone', 'Short-stick zone', 'Hot/two'],
  },
  {
    key: 'ride',
    label: 'Ride',
    icon: '🏃',
    placeholder: 'e.g. 10-man ride',
    suggestions: ['10-man ride', '4-3 ride', 'Deny the goalie outlet', 'Fall back to the box', 'Pinch the sideline'],
  },
  {
    key: 'clear',
    label: 'Clear',
    icon: '↗️',
    placeholder: 'e.g. 4-3 clear',
    suggestions: ['4-3 clear', 'Banana clear', 'Goalie outlet up the wing', 'Box clear', 'Rolling clear'],
  },
  {
    key: 'manUp',
    label: 'Man-up',
    icon: '➕',
    placeholder: 'e.g. 3-3, skip to the back side',
    suggestions: ['3-3', '1-3-2', '2-3-1', '4-2', 'Skip to the back side'],
  },
  {
    key: 'manDown',
    label: 'Man-down',
    icon: '➖',
    placeholder: 'e.g. Box and one, rotate',
    suggestions: ['Box and one', 'Rotate', 'Backer', 'Ace to crease'],
  },
  {
    key: 'faceoff',
    label: 'Faceoff',
    icon: '🥍',
    placeholder: 'e.g. Clamp and pop to the right wing',
    suggestions: ['Clamp', 'Rake', 'Plunger', 'Win it forward to the wing', 'Wings crash the ball'],
  },
]

export function systemLabel(key: SystemKey): string {
  return SYSTEM_SLOTS.find((s) => s.key === key)?.label ?? key
}

// ── Starting lineup ──────────────────────────────────────────────────────────

/** A spot in the starting lineup, and who is in it (a roster player's id). */
export interface LineupSpot {
  slot: string
  playerId: string | null
}

/** The ten on the field at the opening faceoff, then the specialists. */
export const LINEUP_SLOTS: { slot: string; label: string; group: 'Attack' | 'Midfield' | 'Defense' | 'Goalie' | 'Specialists' }[] = [
  { slot: 'A1', label: 'Attack', group: 'Attack' },
  { slot: 'A2', label: 'Attack', group: 'Attack' },
  { slot: 'A3', label: 'Attack', group: 'Attack' },
  { slot: 'M1', label: 'Midfield', group: 'Midfield' },
  { slot: 'M2', label: 'Midfield', group: 'Midfield' },
  { slot: 'M3', label: 'Midfield', group: 'Midfield' },
  { slot: 'D1', label: 'Defense', group: 'Defense' },
  { slot: 'D2', label: 'Defense', group: 'Defense' },
  { slot: 'D3', label: 'Defense', group: 'Defense' },
  { slot: 'G', label: 'Goalie', group: 'Goalie' },
  { slot: 'FO', label: 'Faceoff', group: 'Specialists' },
  { slot: 'LSM', label: 'LSM', group: 'Specialists' },
  { slot: 'SSDM', label: 'SSDM', group: 'Specialists' },
]

// ── Coaches ──────────────────────────────────────────────────────────────────

/** What one coach owns on game day. */
export interface CoachDuty {
  id: string
  /** Staff name, as the Coach Access page has it. Empty until someone is picked. */
  coach: string
  /** The job — "Head coach", "Defensive coordinator", "Box". */
  role: string
  /** What that means today — the calls they make, who they watch, what they track. */
  duties: string
}

/** A staff's usual split, to fill in names against rather than start from nothing. */
export const DUTY_PRESET: { role: string; duties: string }[] = [
  { role: 'Head coach', duties: 'Offensive calls, timeouts, talks to the officials, final say on subs.' },
  { role: 'Defensive coordinator', duties: 'Defensive calls and slides, matchups on their best dodgers, goalie communication.' },
  { role: 'Box / substitutions', duties: 'Runs the box: middie lines, penalties and releases, who goes in on the whistle.' },
  { role: 'Faceoff & wings', duties: 'Faceoff matchups and adjustments, wing play, tracks FO wins and losses.' },
  { role: 'Stats & film', duties: 'Shots, saves, turnovers and ground balls; makes sure the game is filmed.' },
]

// ── Game day schedule ────────────────────────────────────────────────────────

/**
 * One step of game day.
 *
 * Before the game, a step happens a number of minutes before the opening
 * faceoff (`at` is negative, 0 is the faceoff), so the whole day moves with the
 * game time. Halftime and after the game are steps without a clock.
 */
export interface GameDayStep {
  id: string
  phase: 'pre' | 'half' | 'post'
  /** Minutes from the opening faceoff; negative before it. Only for 'pre'. */
  at: number
  title: string
  /** What the players are doing. */
  players: string
  /** What the coaches are doing. */
  coaches: string
  /** The coach responsible for this step, if one is. */
  lead: string
  /** How it went — kept for next time. */
  review: string
}

/** A standard game day, from arrival to after the handshake line. A start, not a rule. */
export const GAMEDAY_PRESET: Omit<GameDayStep, 'id' | 'lead' | 'review'>[] = [
  { phase: 'pre', at: -120, title: 'Arrive', players: 'Dressed in team gear, check in with the captains, phones in bags.', coaches: 'Head count. Check the injury list with the trainer. Confirm the bus or ride home.' },
  { phase: 'pre', at: -105, title: 'Tape, treatment and gear check', players: 'Trainer for tape and treatment. Helmets, sticks and pads checked — spare shafts and heads in the bag.', coaches: 'Equipment check. Confirm the roster and numbers with the scorebook.' },
  { phase: 'pre', at: -90, title: 'Team meeting', players: 'Locker room, phones away.', coaches: 'Head coach walks through the game plan and the keys to the game.' },
  { phase: 'pre', at: -75, title: 'Position meetings', players: 'By position: attack, midfield, defense, goalies, faceoff.', coaches: 'Each coach with their group — matchups, slides, clears, their tendencies from the scout.' },
  { phase: 'pre', at: -60, title: 'Walk the field', players: 'Walk it in uniform. Wind, sun, the surface, the goals.', coaches: 'Check the field, the goals and the clock. Meet the officials and the table.' },
  { phase: 'pre', at: -45, title: 'Dynamic warm-up', players: 'Team stretch and dynamic warm-up, led by the captains.', coaches: 'Watch who is moving well and who isn’t.' },
  { phase: 'pre', at: -35, title: 'Stick work and line drills', players: 'Partner passing, line drills, ground balls.', coaches: 'Keep the pace up. Loud and sharp.' },
  { phase: 'pre', at: -25, title: 'Shooting and goalie warm-up', players: 'Goalies warmed up properly first, then shooting lines.', coaches: 'Goalie coach runs the goalie warm-up. Nobody shoots at a cold goalie.' },
  { phase: 'pre', at: -15, title: 'Walkthrough: 6v6, ride and clear', players: 'Walk the offense, the defense, the ride and the clear at game speed.', coaches: 'Each coordinator runs their unit. Last looks at the matchups.' },
  { phase: 'pre', at: -8, title: 'Final instructions', players: 'Sideline, helmets off, eyes up.', coaches: 'Starters announced. Box coach confirms the starters with the table. Head coach’s last word.' },
  { phase: 'pre', at: -4, title: 'Captains and coin toss', players: 'Captains with the head coach at midfield.', coaches: 'Head coach and captains meet the officials.' },
  { phase: 'pre', at: -2, title: 'Anthem and line up', players: 'On the line, still.', coaches: 'On the sideline with the team.' },
  { phase: 'pre', at: 0, title: 'Opening faceoff', players: 'Starters on the field.', coaches: 'Box set. Stats running. Film rolling.' },
  { phase: 'half', at: 0, title: 'Halftime', players: 'Water, sit by unit, listen.', coaches: 'Coordinators meet for a minute first, then two minutes each with their unit. One or two adjustments, not ten.' },
  { phase: 'post', at: 0, title: 'After the game', players: 'Handshake line. Team huddle. Clean the sideline — leave it better than we found it.', coaches: 'Stats checked and saved. Film uploaded. Notes on what to take to Monday’s practice.' },
]

// ── The whole plan ───────────────────────────────────────────────────────────

export interface GamePlanDetails {
  /** The game this plan is for, from the schedule. */
  gameId: string | null
  opponent: string
  /** Three or four things that decide the game. */
  keys: string[]
  systems: GameSystem[]
  lineup: LineupSpot[]
  duties: CoachDuty[]
  schedule: GameDayStep[]
}

export const EMPTY_GAME_PLAN: GamePlanDetails = {
  gameId: null,
  opponent: '',
  keys: [],
  systems: [],
  lineup: [],
  duties: [],
  schedule: [],
}

/** A new game plan: every system, lineup slot and preset duty ready to fill, and the standard game day. */
export function gamePlanStarter(opts: { opponent?: string; gameId?: string | null } = {}): GamePlanDetails {
  return {
    gameId: opts.gameId ?? null,
    opponent: opts.opponent ?? '',
    keys: ['', '', ''],
    systems: SYSTEM_SLOTS.map((s) => ({ key: s.key, call: '', notes: '', playId: null })),
    lineup: LINEUP_SLOTS.map((l) => ({ slot: l.slot, playerId: null })),
    duties: DUTY_PRESET.map((d) => ({ id: newId('d'), coach: '', role: d.role, duties: d.duties })),
    schedule: gameDayPreset(),
  }
}

export function gameDayPreset(): GameDayStep[] {
  return GAMEDAY_PRESET.map((s) => ({ ...s, id: newId('s'), lead: '', review: '' }))
}

const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '')

/**
 * A stored game plan, kept honest.
 *
 * Systems come back in the standard order with any missing ones filled in
 * empty, so the editor always has every slot to show. Unknown fields are
 * dropped rather than trusted.
 */
export function readGamePlan(raw: unknown): GamePlanDetails {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>

  const storedSystems = Array.isArray(o.systems) ? o.systems : []
  // Every standard system, in order; anything stored under a key this build
  // doesn't know is dropped.
  const systems: GameSystem[] = SYSTEM_SLOTS.map((slot) => {
    const found = storedSystems.find((s) => (s as { key?: unknown })?.key === slot.key) as Record<string, unknown> | undefined
    return {
      key: slot.key,
      call: str(found?.call, 200),
      notes: str(found?.notes),
      playId: typeof found?.playId === 'string' && found.playId ? found.playId : null,
    }
  })

  const storedLineup = Array.isArray(o.lineup) ? o.lineup : []
  const lineup: LineupSpot[] = LINEUP_SLOTS.map((l) => {
    const found = storedLineup.find((s) => (s as { slot?: unknown })?.slot === l.slot) as Record<string, unknown> | undefined
    return { slot: l.slot, playerId: typeof found?.playerId === 'string' && found.playerId ? found.playerId : null }
  })

  const duties: CoachDuty[] = (Array.isArray(o.duties) ? o.duties : [])
    .map((d) => {
      const r = (d ?? {}) as Record<string, unknown>
      return { id: str(r.id, 40) || newId('d'), coach: str(r.coach, 120), role: str(r.role, 120), duties: str(r.duties) }
    })
    .slice(0, 30)

  const schedule: GameDayStep[] = (Array.isArray(o.schedule) ? o.schedule : [])
    .map((s) => {
      const r = (s ?? {}) as Record<string, unknown>
      const phase = r.phase === 'half' || r.phase === 'post' ? r.phase : 'pre'
      const at = Math.round(Number(r.at))
      return {
        id: str(r.id, 40) || newId('s'),
        phase,
        at: Number.isFinite(at) ? Math.max(-600, Math.min(0, at)) : 0,
        title: str(r.title, 200),
        players: str(r.players),
        coaches: str(r.coaches),
        lead: str(r.lead, 120),
        review: str(r.review, 4000),
      } as GameDayStep
    })
    .slice(0, 60)

  return {
    gameId: typeof o.gameId === 'string' && o.gameId ? o.gameId : null,
    opponent: str(o.opponent, 200),
    keys: (Array.isArray(o.keys) ? o.keys : []).map((k) => str(k, 300)).slice(0, 10),
    systems,
    lineup,
    duties,
    schedule,
  }
}

/** Pre-game steps in time order, then halftime, then after the game. */
export function orderedSchedule(steps: GameDayStep[]): GameDayStep[] {
  const rank = { pre: 0, half: 1, post: 2 } as const
  return [...steps].sort((a, b) => rank[a.phase] - rank[b.phase] || (a.phase === 'pre' ? a.at - b.at : 0))
}

/**
 * The clock time of a step, from the faceoff time ("19:00") — "5:00 PM".
 * Null for halftime and after the game, or when there is no faceoff time.
 */
export function stepClock(faceoff: string | null, step: Pick<GameDayStep, 'phase' | 'at'>): string | null {
  if (!faceoff || step.phase !== 'pre') return null
  const m = /^(\d{1,2}):(\d{2})/.exec(faceoff)
  if (!m) return null
  let mins = Number(m[1]) * 60 + Number(m[2]) + step.at
  mins = ((mins % 1440) + 1440) % 1440
  const h = Math.floor(mins / 60)
  const mi = mins % 60
  return `${h % 12 || 12}:${String(mi).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/** "2:00 before" / "Faceoff" / "Halftime" — when a step is, said relative to the game. */
export function stepWhen(step: Pick<GameDayStep, 'phase' | 'at'>): string {
  if (step.phase === 'half') return 'Halftime'
  if (step.phase === 'post') return 'After the game'
  if (step.at === 0) return 'Faceoff'
  const before = -step.at
  const h = Math.floor(before / 60)
  const m = before % 60
  return h ? `${h}:${String(m).padStart(2, '0')} before` : `${m} min before`
}

/** How far along a plan is, for a card: "Offense · Defense · Ride set, 8 of 13 starters". */
export function describeGamePlan(d: GamePlanDetails): string {
  const set = d.systems.filter((s) => s.call.trim()).map((s) => systemLabel(s.key))
  const starters = d.lineup.filter((l) => l.playerId).length
  const parts: string[] = []
  if (set.length) parts.push(`${set.length} of ${d.systems.length} calls set`)
  if (starters) parts.push(`${starters} of ${d.lineup.length} starters`)
  return parts.join(' · ')
}
