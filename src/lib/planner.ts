// The Planner: practice plans, game plans and coaching notes.
//
// Pure — the editor is a client component and shares every one of these with the
// server. Nothing here reads cookies or the database.

import { readComp, type BlockComp } from './compete'
import { newId, readBoard, readClip, type Board, type BoardClip } from './board'

export type PlanKind = 'practice' | 'game' | 'note' | 'scout'

export const PLAN_KINDS: { key: PlanKind; label: string; plural: string; icon: string; blurb: string }[] = [
  { key: 'practice', label: 'Practice plan', plural: 'Practices', icon: '🥍', blurb: 'A session broken into timed blocks.' },
  { key: 'game', label: 'Game plan', plural: 'Games', icon: '🏟', blurb: 'Matchups, situations and what we run.' },
  { key: 'scout', label: 'Scout', plural: 'Scouts', icon: '🔭', blurb: 'Who we play next, and how they play.' },
  { key: 'note', label: 'Note', plural: 'Notes', icon: '📝', blurb: 'Anything that isn’t a plan yet.' },
]

/** What a block is for. Colours the block and totals the day by category. */
export interface BlockTag {
  key: string
  label: string
  color: string
}

export const BLOCK_TAGS: BlockTag[] = [
  { key: 'warmup',      label: 'Warm-up',       color: '#A9C6B4' },
  { key: 'individual',  label: 'Individual',    color: '#00693E' },
  { key: 'unit',        label: 'Unit',          color: '#0E7A50' },
  { key: 'team',        label: 'Team',          color: '#7A1F2B' },
  { key: 'specials',    label: 'Special teams', color: '#B4823A' },
  { key: 'conditioning',label: 'Conditioning',  color: '#3D6B52' },
  { key: 'install',     label: 'Install',       color: '#2F5D8C' },
  { key: 'water',       label: 'Water / reset', color: '#9AA39D' },
]

export function tagFor(key: string | undefined): BlockTag {
  return BLOCK_TAGS.find((t) => t.key === key) ?? BLOCK_TAGS[0]
}

// ── The field board ─────────────────────────────────────────────────────────

// The board's data and its reader live in ./board, which has no imports so the
// same rules can be checked outside the app. Everything in it is re-exported
// here, where the rest of the app has always imported it from.
export * from './board'

/** Who is in this block, and what they are doing in it. */
export interface BlockAssignment {
  playerId: string
  /** Free text — "1st middie", "crease", "wing" — whatever the block needs. */
  role: string
}

export interface PlanBlock {
  id: string
  title: string
  minutes: number
  tag: string
  notes: string
  board?: Board | null
  /** The take, when the play on this block came out of the Library recorded. */
  clip?: BoardClip | null
  /** A screenshot pulled in from the Library, shown instead of a field. */
  shotUrl?: string | null
  /**
   * Runs at the same time as the block above it.
   *
   * A split block is two halves of one slot: the defense at one end with one
   * coach, the offense at the other with another. The clock does not advance
   * between them — the session moves on when the longer half is done.
   */
  parallel?: boolean
  /** The drill from the bank this block is running, if any. */
  drillId?: string | null
  /** A link carried over from that drill, so the block stands on its own. */
  link?: string | null
  /** The coach running it. */
  coach?: string | null
  /** Players in this block. Empty means the whole squad. */
  players?: BlockAssignment[]
  /** How this block is being won, and the score. See lib/compete. */
  comp?: BlockComp | null
  /** How it went — written after the session, kept for the next time it is run. */
  review?: string
}

export interface Plan {
  id: string
  kind: PlanKind
  title: string
  plan_date: string | null
  season: string | null
  summary: string | null
  blocks: PlanBlock[]
  /** A note's page: sections, checklists, charts and fields. Empty for plans. */
  content: unknown[]
  /** A game plan's decisions and game-day schedule (lib/gamePlan). Empty for the rest. */
  details: unknown
  roster_id: string | null
  is_template: boolean
  /** Varsity or JV — which staff's week this belongs to. */
  team: 'varsity' | 'jv'
  /** The squads this practice is split into, for keeping the score. */
  sides: string[]
  /** 24-hour "HH:MM". The whole plan's clock runs from here. */
  start_time: string | null
  /** On the players' page in the Team Hub. */
  publish_players: boolean
  /** In the coaches' War Room. A plan starts as the author's working document. */
  publish_coaches: boolean
  /** A draft only its author sees (0043) — never in a War Room, the calendar or the Team Hub. */
  private: boolean
  /** When the author sent the draft to the head coaches; null when not sent. */
  review_requested_at: string | null
  /** Shows on the calendar by itself (0046). */
  on_calendar: boolean
  /** The calendar practice this plan was made from, which carries it there (0046). */
  calendar_event_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export function emptyBlock(): PlanBlock {
  return {
    id: newId('b'),
    title: '',
    minutes: 10,
    tag: 'individual',
    notes: '',
    board: null,
    drillId: null,
    link: null,
    coach: null,
    players: [],
  }
}

/** Minutes from the start of the session to the start of each block. */
export function runningClock(blocks: PlanBlock[]): number[] {
  const out: number[] = []
  let total = 0
  let group = 0 // the longest half of the split that is open

  for (const [i, b] of blocks.entries()) {
    const mins = Math.max(0, Number(b.minutes) || 0)
    // A parallel block is the other half of the slot above it, so it starts
    // when that one did. The first block has nothing to run beside.
    if (b.parallel && i > 0) {
      out.push(out[i - 1])
      group = Math.max(group, mins)
      continue
    }
    total += group
    out.push(total)
    group = mins
  }
  return out
}

export function totalMinutes(blocks: PlanBlock[]): number {
  const clock = runningClock(blocks)
  let end = 0
  for (const [i, b] of blocks.entries()) {
    end = Math.max(end, clock[i] + Math.max(0, Number(b.minutes) || 0))
  }
  return end
}

/**
 * The same practice, made to fit the time you actually have.
 *
 * Everything scales by the same factor, so the shape of the session survives —
 * a plan that was half team work is still half team work at seventy minutes.
 * Rounding leaves a minute or two either way; that lands on the longest blocks,
 * because a minute off a twenty is invisible and a minute off a five is the
 * water break.
 *
 * Nothing falls below a minute. A plan with more blocks than there are minutes
 * cannot be made to fit, and comes back as close as it goes rather than as a
 * row of zeroes.
 */
export function fitBlocks(blocks: PlanBlock[], target: number): PlanBlock[] {
  const current = totalMinutes(blocks)
  if (!Number.isFinite(target) || target <= 0 || current <= 0) return blocks

  const factor = target / current
  const out = blocks.map((b) => ({
    ...b,
    minutes: Math.max(1, Math.round((Number(b.minutes) || 0) * factor)),
  }))

  // A block inside a split only moves the clock when it is the longer half, so
  // every adjustment is checked against the total rather than assumed.
  for (let guard = 0; guard < 600; guard++) {
    const now = totalMinutes(out)
    if (now === target) break
    const step = now > target ? -1 : 1
    const longestFirst = out.map((_, i) => i).sort((a, b) => out[b].minutes - out[a].minutes)

    let moved = false
    for (const i of longestFirst) {
      if (step < 0 && out[i].minutes <= 1) continue
      out[i].minutes += step
      if (totalMinutes(out) !== now) {
        moved = true
        break
      }
      out[i].minutes -= step
    }
    if (!moved) break
  }

  return out
}

/** The blocks sharing a slot with this one, this one included. */
export function splitGroup(blocks: PlanBlock[], index: number): number[] {
  let first = index
  while (first > 0 && blocks[first]?.parallel) first--
  const group = [first]
  for (let i = first + 1; i < blocks.length && blocks[i].parallel; i++) group.push(i)
  return group
}

/** Minutes per tag, biggest first — how the session was actually spent. */
export function minutesByTag(blocks: PlanBlock[]): { tag: BlockTag; minutes: number }[] {
  const totals = new Map<string, number>()
  for (const b of blocks) {
    const mins = Math.max(0, Number(b.minutes) || 0)
    if (!mins) continue
    totals.set(b.tag, (totals.get(b.tag) ?? 0) + mins)
  }
  return [...totals.entries()]
    .map(([key, minutes]) => ({ tag: tagFor(key), minutes }))
    .sort((a, b) => b.minutes - a.minutes)
}

/** "1h 45m", or "45m". Blank for nothing. */
export function formatMinutes(mins: number): string {
  if (!mins) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

/** The hour a plan runs from when nobody has said otherwise. */
export const DEFAULT_START = '16:00'

/** A start time we are willing to run a clock off. */
export function readStart(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

/** Minutes between two times of day, the second being the later one. */
export function minutesBetween(start: string, end: string): number | null {
  const a = readStart(start)
  const b = readStart(end)
  if (!a || !b) return null
  const [ah, am] = a.split(':').map(Number)
  const [bh, bm] = b.split(':').map(Number)
  const mins = bh * 60 + bm - (ah * 60 + am)
  // A session that ends before it starts ran past midnight.
  return mins > 0 ? mins : mins + 24 * 60
}

/** Clock time for a block, given a start like "16:00". */
export function clockAt(start: string | null, offsetMins: number): string | null {
  if (!start || !/^\d{1,2}:\d{2}$/.test(start)) return null
  const [h, m] = start.split(':').map(Number)
  const total = h * 60 + m + offsetMins
  const hh = Math.floor(total / 60) % 24
  const mm = total % 60
  const ampm = hh >= 12 ? 'PM' : 'AM'
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`
}

/** Parse whatever came out of the jsonb column into blocks we can trust. */
export function readBlocks(raw: unknown): PlanBlock[] {
  if (!Array.isArray(raw)) return []
  return raw.map((r) => {
    const b = (r ?? {}) as Partial<PlanBlock>
    return {
      id: typeof b.id === 'string' ? b.id : newId('b'),
      title: typeof b.title === 'string' ? b.title : '',
      minutes: Number(b.minutes) || 0,
      tag: typeof b.tag === 'string' ? b.tag : 'individual',
      notes: typeof b.notes === 'string' ? b.notes : '',
      board: readBoard(b.board),
      parallel: b.parallel === true,
      clip: readClip(b.clip),
      shotUrl: readShotUrl(b.shotUrl),
      drillId: typeof b.drillId === 'string' ? b.drillId : null,
      // Four is the most sides a practice can be split into; extra scores go.
      comp: readComp(b.comp, 4),
      link: typeof b.link === 'string' && b.link.trim() ? b.link.trim() : null,
      coach: typeof b.coach === 'string' && b.coach.trim() ? b.coach.trim() : null,
      review: typeof b.review === 'string' ? b.review.slice(0, 4000) : '',
      players: Array.isArray(b.players)
        ? b.players
            .map((a) => {
              const row = (a ?? {}) as Partial<BlockAssignment>
              return {
                playerId: typeof row.playerId === 'string' ? row.playerId : '',
                role: typeof row.role === 'string' ? row.role : '',
              }
            })
            .filter((a) => a.playerId)
        : [],
    }
  })
}

/**
 * A picture pulled in from the Library. Only our own kind of address: a note is
 * rendered on a public-facing page for the team, and a stored javascript: or
 * data: URL is somebody's idea of a joke.
 */
export function readShotUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const url = raw.trim()
  return /^https?:\/\//i.test(url) ? url : null
}
