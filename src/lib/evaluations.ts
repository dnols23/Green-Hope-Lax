// Player-evaluation config + types for the Coaches Hub.
//
// Scored 0–100 on a slider rather than 1–5 buttons: coaches think in "he's a
// solid high-school starter, not quite there yet", and a wide scale records that
// shading instead of flattening it into whole numbers. The three tiers below are
// what the numbers mean, and they colour the slider, the badges and the board.

import { POSITION_LABELS, positionGroup, type PositionGroup } from './positions'

export const SCALE = { min: 0, max: 100 }

export interface Tier {
  key: string
  label: string
  /** Lowest score in this tier. */
  min: number
  /** Strong colour — slider track, board cells. */
  color: string
  /** Tinted background for badges. */
  soft: string
  /** Readable text colour on `soft`. */
  ink: string
}

// Green Hope's own palette carries the meaning, start to finish: a pale tint of
// the program green for developing, full forest green for a high-school starter,
// maroon at the top end. No colour here is from outside the brand.
export const TIERS: Tier[] = [
  { key: 'developing', label: 'Developing',       min: 0,  color: '#A9C6B4', soft: '#EAF2ED', ink: '#3D6B52' },
  { key: 'starter',    label: 'HS Starter',       min: 34, color: '#00693E', soft: '#DFEFE7', ink: '#00512F' },
  { key: 'collegiate', label: 'Collegiate Level', min: 67, color: '#7A1F2B', soft: '#F7E4E7', ink: '#7A1F2B' },
]

export function tierFor(score: number | null | undefined): Tier {
  if (score == null) return TIERS[0]
  let match = TIERS[0]
  for (const t of TIERS) if (score >= t.min) match = t
  return match
}

/** The slider track: one continuous run from pale through green into maroon. */
export const RATING_GRADIENT =
  `linear-gradient(90deg, #F2F7F4 0%, ${TIERS[0].color} 22%, ${TIERS[1].color} 55%, ${TIERS[2].color} 88%, #5C1721 100%)`

export interface EvalCategory {
  key: string
  label: string
  section: string
  /**
   * Who gets asked about this. Absent means everybody.
   *
   * A goalie was being scored on dodging and finishing and never once on
   * whether he can stop a ball, which made his evaluation both unfair and
   * useless — and gave the drill engine nothing about his actual job to work
   * with.
   */
  positions?: PositionGroup[]
}

const FIELD: PositionGroup[] = ['attack', 'midfield', 'defense', 'lsm', 'fogo']
const OFFENSE: PositionGroup[] = ['attack', 'midfield']
const DEFENDERS: PositionGroup[] = ['defense', 'lsm', 'midfield']

// Grouped so a long form reads as a few short lists instead of one wall.
export const EVAL_CATEGORIES: EvalCategory[] = [
  { section: 'Stick Skills', key: 'catching',    label: 'Catching' },
  { section: 'Stick Skills', key: 'throw_strong', label: 'Throwing — strong hand' },
  { section: 'Stick Skills', key: 'throw_weak',   label: 'Throwing — weak hand' },
  { section: 'Stick Skills', key: 'groundballs',  label: 'Ground balls' },
  { section: 'Stick Skills', key: 'protection',   label: 'Cradling & stick protection', positions: FIELD },

  { section: 'Offense', key: 'dodging',  label: 'Dodging & 1v1',        positions: [...OFFENSE, 'fogo'] },
  { section: 'Offense', key: 'shooting', label: 'Shooting & finishing', positions: [...OFFENSE, 'fogo'] },
  { section: 'Offense', key: 'offball',  label: 'Off-ball movement',    positions: OFFENSE },
  { section: 'Offense', key: 'feeding',  label: 'Feeding & vision',     positions: OFFENSE },

  { section: 'Defense', key: 'onball',   label: 'On-ball defense',          positions: DEFENDERS },
  { section: 'Defense', key: 'footwork', label: 'Footwork & positioning',   positions: [...DEFENDERS, 'attack', 'fogo'] },
  { section: 'Defense', key: 'slides',   label: 'Slides & communication',   positions: [...DEFENDERS, 'goalie'] },
  { section: 'Defense', key: 'checks',   label: 'Takeaways & checks',       positions: [...DEFENDERS, 'fogo'] },

  // Goalie — the job nobody else on the field does.
  { section: 'Goalkeeping', key: 'gk_arc',     label: 'Arc & positioning',       positions: ['goalie'] },
  { section: 'Goalkeeping', key: 'gk_hands',   label: 'Hands & saves',           positions: ['goalie'] },
  { section: 'Goalkeeping', key: 'gk_read',    label: 'Reading the shooter',     positions: ['goalie'] },
  { section: 'Goalkeeping', key: 'gk_clear',   label: 'Clearing & outlet pass',  positions: ['goalie'] },
  { section: 'Goalkeeping', key: 'gk_command', label: 'Running the defense',     positions: ['goalie'] },

  // Face-off — likewise.
  { section: 'Face-off', key: 'fo_clamp', label: 'Clamp & hand speed',      positions: ['fogo'] },
  { section: 'Face-off', key: 'fo_exit',  label: 'Exit & counters',         positions: ['fogo'] },
  { section: 'Face-off', key: 'fo_wing',  label: 'Wing play & scrapping',   positions: ['fogo'] },
  { section: 'Face-off', key: 'fo_after', label: 'Play after the whistle',  positions: ['fogo'] },

  { section: 'Athleticism', key: 'speed',    label: 'Speed & acceleration' },
  { section: 'Athleticism', key: 'strength', label: 'Strength & physicality' },
  { section: 'Athleticism', key: 'motor',    label: 'Endurance & motor' },

  { section: 'Intangibles', key: 'iq',           label: 'Lacrosse IQ' },
  { section: 'Intangibles', key: 'coachability', label: 'Coachability' },
  { section: 'Intangibles', key: 'team',         label: 'Team-first & leadership' },
  { section: 'Intangibles', key: 'compete',      label: 'Competitiveness' },
]

/** The questions worth asking about this player, in form order. */
export function categoriesFor(position: string | null | undefined): EvalCategory[] {
  const group = positionGroup(position)
  return EVAL_CATEGORIES.filter((c) => !c.positions || c.positions.includes(group))
}

/** The sections that have any question for this player. */
export function sectionsFor(position: string | null | undefined): string[] {
  return [...new Set(categoriesFor(position).map((c) => c.section))]
}

export { POSITION_LABELS, positionGroup }

export const EVAL_SECTIONS: string[] = [...new Set(EVAL_CATEGORIES.map((c) => c.section))]

export const PLAYING_TIME_OPTIONS = ['Varsity Starter', 'Varsity', 'JV', 'Develop'] as const
export type PlayingTime = (typeof PLAYING_TIME_OPTIONS)[number]

export type CoachRole = 'head' | 'jv-head' | 'assistant' | 'jv-assistant'

export interface CoachAccount {
  email: string
  display_name: string
  role: CoachRole
  created_at: string
}

/** One rated skill: the score, plus the optional note a coach leaves beside it. */
export interface SkillRating {
  score: number
  note?: string
}

/**
 * Ratings are stored in the existing `ratings` jsonb column, so per-skill notes
 * needed no schema change. Older rows (from the 1–5 form) stored a bare number;
 * readRating understands both.
 */
export function readRating(raw: unknown): SkillRating | null {
  if (typeof raw === 'number') return { score: raw <= 5 ? raw * 20 : raw }
  if (raw && typeof raw === 'object') {
    const r = raw as { score?: unknown; note?: unknown }
    if (typeof r.score === 'number') {
      return { score: r.score, note: typeof r.note === 'string' ? r.note : undefined }
    }
  }
  return null
}

/** Mean of every skill a coach actually scored, 0 when they scored none. */
export function ratingsAverage(ratings: Record<string, unknown> | null | undefined): number {
  if (!ratings) return 0
  const scores = Object.values(ratings)
    .map(readRating)
    .filter((r): r is SkillRating => r !== null)
    .map((r) => r.score)
  if (!scores.length) return 0
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

export interface Evaluation {
  id: string
  player_id: string
  evaluator_email: string
  evaluator_name: string
  season: string
  position: string | null
  ratings: Record<string, unknown>
  overall: number | null
  strengths: string | null
  areas_to_improve: string | null
  playing_time: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

/** One coach's overall for a player: their own overall, else their skill mean. */
export function evaluationScore(e: Evaluation): number {
  if (e.overall && e.overall > 0) return e.overall
  return ratingsAverage(e.ratings)
}

export interface PlayerScore {
  /** Mean of every coach's overall, rounded to one decimal. 0 when unrated. */
  average: number
  /** How many coaches have submitted one. */
  count: number
}

/** Compile every coach's evaluations into one score per player. */
export function compileScores(evals: Evaluation[]): Map<string, PlayerScore> {
  const byPlayer = new Map<string, number[]>()
  for (const e of evals) {
    const score = evaluationScore(e)
    if (score <= 0) continue
    if (!byPlayer.has(e.player_id)) byPlayer.set(e.player_id, [])
    byPlayer.get(e.player_id)!.push(score)
  }
  const out = new Map<string, PlayerScore>()
  for (const [playerId, scores] of byPlayer) {
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length
    out.set(playerId, { average: Math.round(mean * 10) / 10, count: scores.length })
  }
  return out
}
