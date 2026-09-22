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
  /** One line, said the way a coach says it on the field. */
  how: string
  /**
   * The drill categories it suits. A format listed here is offered for those
   * drills first; anything marked 'any' fits whatever is on the plan.
   */
  fits: string[] | 'any'
}

export const COMP_FORMATS: CompFormat[] = [
  { key: 'first-to', label: 'First to ten', fits: ['shooting', 'groundballs', 'faceoff', 'dodging'],
    how: 'First side to ten takes it. Call it out loud every time it changes.' },
  { key: 'win-rep', label: 'Win the rep', fits: 'any',
    how: 'A point for every rep won. Most points when the clock goes is the winner.' },
  { key: 'streak', label: 'Three in a row', fits: ['stickwork', 'shooting', 'groundballs'],
    how: 'Three clean in a row wins it. One miss and that side is back to zero.' },
  { key: 'one-life', label: 'One life', fits: ['stickwork', 'shooting', 'footwork'],
    how: 'A miss and you are out. Last man standing scores for his side.' },
  { key: 'beat-clock', label: 'Beat the clock', fits: ['stickwork', 'footwork', 'conditioning', 'transition'],
    how: 'Whichever side finishes the set first takes it. Time them both.' },
  { key: 'loser-runs', label: 'Loser runs', fits: 'any',
    how: 'Losing side runs the width at the whistle. Winner gets the water break first.' },
  { key: 'goalie-game', label: "Goalie's game", fits: ['shooting', 'offense', 'sixes', 'goalie', 'specialoffense'],
    how: 'Every save is a point for the defense, every goal a point for the offense.' },
  { key: 'golden', label: 'Golden goal', fits: ['offense', 'defense', 'sixes', 'transition', 'mandown'],
    how: 'Play it level, then the next one wins it. Nobody leaves on a tie.' },
  { key: 'tax', label: 'Drop tax', fits: ['stickwork', 'groundballs', 'transition', 'ridecrear'],
    how: 'Every drop costs that side a point. You can finish on a negative.' },
  { key: 'ladder', label: 'Ladder', fits: ['dodging', 'individualdefense', 'faceoff', 'groundballs'],
    how: 'Winner moves up a station, loser moves down. Top station at the end takes it.' },
  { key: 'stops', label: 'Three stops', fits: ['defense', 'individualdefense', 'dmid', 'mandown', 'ridecrear'],
    how: 'Three stops in a row and the defense wins the round. A goal resets it.' },
  { key: 'clear-count', label: 'Clear it or lose it', fits: ['ridecrear', 'transition', 'goalie'],
    how: 'A point for every clear that gets over the line, one to the ride for every one that does not.' },
  { key: 'weak-hand', label: 'Weak hand only', fits: ['stickwork', 'shooting', 'dodging', 'groundballs'],
    how: 'Weak hand counts double. Strong hand counts one. Announce it before the first rep.' },
  { key: 'call-it', label: 'Call your shot', fits: ['shooting', 'specialoffense'],
    how: 'Call the corner before you shoot. Called and made is two, made without calling is one.' },
  { key: 'timed-ladder', label: 'Sixty seconds', fits: ['conditioning', 'strength', 'footwork', 'groundballs'],
    how: 'Sixty seconds a side, count the reps, highest number wins.' },
  { key: 'silent', label: 'Silent rep', fits: ['offense', 'sixes', 'transition', 'defense'],
    how: 'No talking on offense. Every finished possession without a word is a point — then swap it, and the defense has to talk twice as loud.' },
]

export function formatOf(key: string | null | undefined): CompFormat | null {
  return COMP_FORMATS.find((f) => f.key === key) ?? null
}

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
export function rollComp(seed: string, category: string | null | undefined, nonce = 0): CompFormat {
  const cat = category ?? ''
  const suited = COMP_FORMATS.filter((f) => f.fits !== 'any' && f.fits.includes(cat))
  const general = COMP_FORMATS.filter((f) => f.fits === 'any')
  const pool = suited.length ? [...suited, ...general] : COMP_FORMATS
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
