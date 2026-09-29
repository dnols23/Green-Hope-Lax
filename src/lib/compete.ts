// Making a drill a competition, and keeping the score.
//
// A practice where nothing is being won is a practice at three-quarter speed.
// Every block can carry a way of scoring it, the score goes on the block, and
// the plan adds them all up — so at the end of practice somebody has won it.
//
// Pure: the planner and the server both read this.

export interface CompFormat {
  key: string
  label: string
  /** One sentence: what it is. Shown wherever one is being picked. */
  summary: string
  /** How it runs, said the way a coach says it on the field. */
  how: string
  /** What it needs set up — cones, stations, a clock. */
  setup?: string | null
  /** Why we run it and what good looks like. */
  why?: string | null
  link?: string | null
  link_label?: string | null
  board?: import('./planner').Board | null
  /** Shipped with the site (and maybe changed by the staff), or one of their own. */
  builtIn?: boolean
  /** A built-in the staff has changed. */
  edited?: boolean
  /**
   * The drill categories it suits. A format listed here is offered for those
   * drills first; anything marked 'any' fits whatever is on the plan.
   */
  fits: string[] | 'any'
}

export const COMP_FORMATS: CompFormat[] = [
  { key: 'first-to', summary: 'A race to ten points between the two sides.', label: 'First to ten', fits: ['shooting', 'groundballs', 'faceoff', 'dodging'],
    how: 'First side to ten takes it. Call it out loud every time it changes.' },
  { key: 'win-rep', summary: 'Every rep is worth a point; most points wins.', label: 'Win the rep', fits: 'any',
    how: 'A point for every rep won. Most points when the clock goes is the winner.' },
  { key: 'streak', summary: 'Three clean reps in a row wins, and a miss resets you.', label: 'Three in a row', fits: ['stickwork', 'shooting', 'groundballs'],
    how: 'Three clean in a row wins it. One miss and that side is back to zero.' },
  { key: 'one-life', summary: 'One mistake and you are out until one player is left.', label: 'One life', fits: ['stickwork', 'shooting', 'footwork'],
    how: 'A miss and you are out. Last man standing scores for his side.' },
  { key: 'beat-clock', summary: 'Both sides race the same set against the clock.', label: 'Beat the clock', fits: ['stickwork', 'footwork', 'conditioning', 'transition'],
    how: 'Whichever side finishes the set first takes it. Time them both.' },
  { key: 'loser-runs', summary: 'Any drill, with the losing side paying for it.', label: 'Loser runs', fits: 'any',
    how: 'Losing side runs the width at the whistle. Winner gets the water break first.' },
  { key: 'goalie-game', summary: 'Offense scores on goals, defense scores on saves.', label: "Goalie's game", fits: ['shooting', 'offense', 'sixes', 'goalie', 'specialoffense'],
    how: 'Every save is a point for the defense, every goal a point for the offense.' },
  { key: 'golden', summary: 'Tied at the end means next goal wins.', label: 'Golden goal', fits: ['offense', 'defense', 'sixes', 'transition', 'mandown'],
    how: 'Play it level, then the next one wins it. Nobody leaves on a tie.' },
  { key: 'tax', summary: 'Drops cost points, so clean hands win.', label: 'Drop tax', fits: ['stickwork', 'groundballs', 'transition', 'ridecrear'],
    how: 'Every drop costs that side a point. You can finish on a negative.' },
  { key: 'ladder', summary: 'Winners move up a station and losers move down.', label: 'Ladder', fits: ['dodging', 'individualdefense', 'faceoff', 'groundballs'],
    how: 'Winner moves up a station, loser moves down. Top station at the end takes it.' },
  { key: 'stops', summary: 'The defense has to get three stops in a row.', label: 'Three stops', fits: ['defense', 'individualdefense', 'dmid', 'mandown', 'ridecrear'],
    how: 'Three stops in a row and the defense wins the round. A goal resets it.' },
  { key: 'clear-count', summary: 'Clears against the ride, point for point.', label: 'Clear it or lose it', fits: ['ridecrear', 'transition', 'goalie'],
    how: 'A point for every clear that gets over the line, one to the ride for every one that does not.' },
  { key: 'weak-hand', summary: 'Weak-hand reps count double.', label: 'Weak hand only', fits: ['stickwork', 'shooting', 'dodging', 'groundballs'],
    how: 'Weak hand counts double. Strong hand counts one. Announce it before the first rep.' },
  { key: 'call-it', summary: 'Call your corner first and it counts double.', label: 'Call your shot', fits: ['shooting', 'specialoffense'],
    how: 'Call the corner before you shoot. Called and made is two, made without calling is one.' },
  { key: 'timed-ladder', summary: 'Most reps in sixty seconds wins.', label: 'Sixty seconds', fits: ['conditioning', 'strength', 'footwork', 'groundballs'],
    how: 'Sixty seconds a side, count the reps, highest number wins.' },
  { key: 'silent', summary: 'Offense plays without talking, then the defense has to talk twice as much.', label: 'Silent rep', fits: ['offense', 'sixes', 'transition', 'defense'],
    how: 'No talking on offense. Every finished possession without a word is a point — then swap it, and the defense has to talk twice as loud.' },
]

/** A format by key, from the staff's list when given, else the built-ins. */
export function formatOf(key: string | null | undefined, list: CompFormat[] = COMP_FORMATS): CompFormat | null {
  return list.find((f) => f.key === key) ?? null
}

/** A key for a competition the staff adds: letters, numbers and dashes. */
export const isCompKey = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9][a-z0-9-]{0,39}$/.test(v)

/**
 * A small, stable hash. Same seed, same number, every time and everywhere —
 * so the competition a coach saw on Sunday is the one on the field on Monday.
 */
function hash(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

/**
 * Pick a way to compete at this drill.
 *
 * Formats that suit the drill come first, so a shooting drill gets "call your
 * shot" rather than "clear it or lose it" — but everything that fits anything
 * stays in the hat, because the same competition at every practice stops being
 * a competition.
 */
export function rollComp(
  seed: string,
  category: string | null | undefined,
  nonce = 0,
  list: CompFormat[] = COMP_FORMATS,
): CompFormat {
  const cat = category ?? ''
  const suited = list.filter((f) => f.fits !== 'any' && f.fits.includes(cat))
  const general = list.filter((f) => f.fits === 'any')
  const pool = suited.length ? [...suited, ...general] : list.length ? list : COMP_FORMATS
  return pool[hash(`${seed}:${nonce}`) % pool.length]
}

// ── Keeping the score ────────────────────────────────────────────────────────

export const DEFAULT_SIDES = ['Blue', 'White']

/** What a block records: which competition, and the score so far. */
export interface BlockComp {
  /** A key from COMP_FORMATS, or '' for a competition the coach wrote himself. */
  key: string
  /** His own wording, when he has some. Shown instead of the format's. */
  own?: string
  /** One number per side, in the plan's own order. */
  scores: number[]
}

export function readComp(raw: unknown, sideCount: number): BlockComp | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const key = typeof o.key === 'string' ? o.key : ''
  const own = typeof o.own === 'string' && o.own.trim() ? o.own : undefined
  if (!key && !own) return null
  const raws = Array.isArray(o.scores) ? o.scores : []
  const scores = Array.from({ length: Math.max(1, sideCount) }, (_, i) => {
    const n = Number(raws[i])
    return Number.isFinite(n) ? Math.round(n) : 0
  })
  return { key, own, scores }
}

/** A competition kept on a drill because it worked, to run again. */
export interface SavedComp {
  id: string
  /** A key from COMP_FORMATS, or '' for one the coach wrote himself. */
  key: string
  own?: string
  savedAt: string
}

export const MAX_SAVED_COMPS = 20

/** What a drill has saved, cleaned: known formats or his own words, nothing else. */
export function readSavedComps(raw: unknown): SavedComp[] {
  const list = Array.isArray(raw) ? raw : []
  const out: SavedComp[] = []
  for (const [i, r] of list.entries()) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const key = isCompKey(o.key) ? o.key : ''
    const own = typeof o.own === 'string' && o.own.trim() ? o.own.trim().slice(0, 200) : undefined
    if (!key && !own) continue
    out.push({
      id: typeof o.id === 'string' && o.id ? o.id.slice(0, 40) : `c${i}`,
      key,
      ...(own ? { own } : {}),
      savedAt: typeof o.savedAt === 'string' ? o.savedAt.slice(0, 40) : '',
    })
    if (out.length >= MAX_SAVED_COMPS) break
  }
  return out
}

/** The same competition, whatever the score. */
export const sameComp = (a: { key: string; own?: string }, b: { key: string; own?: string }) =>
  a.key === b.key && (a.own ?? '').trim() === (b.own ?? '').trim()

export function readSides(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...DEFAULT_SIDES]
  const names = raw.map((s) => String(s ?? '').trim()).filter(Boolean).slice(0, 4)
  return names.length >= 2 ? names : [...DEFAULT_SIDES]
}

/** The practice so far: one total per side. */
export function tally(comps: (BlockComp | null | undefined)[], sideCount: number): number[] {
  const out = Array.from({ length: Math.max(1, sideCount) }, () => 0)
  for (const c of comps) {
    if (!c) continue
    c.scores.forEach((n, i) => {
      if (i < out.length) out[i] += Number(n) || 0
    })
  }
  return out
}

/** Who is winning, or null when it is level or nothing has been scored. */
export function leaderOf(totals: number[]): number | null {
  const best = Math.max(...totals)
  if (best <= 0) return null
  const winners = totals.filter((n) => n === best)
  return winners.length === 1 ? totals.indexOf(best) : null
}
