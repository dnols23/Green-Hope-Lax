// The head coach's end-of-season review of a coach.
//
// Deliberately a separate thing from a player evaluation. A player is rated by
// the whole staff and the staff reads the result together; a coach is reviewed
// by the head coach alone, once, when the season is over. So the questions are
// different, the wording of the scale is different, and only one person ever
// opens it.
//
// Pure — no server imports — so the form components can use it too.

import { SCALE, TIERS, RATING_GRADIENT, readRating, type SkillRating, type Tier } from './evaluations'

export { SCALE, RATING_GRADIENT, readRating }
export type { SkillRating }

/**
 * The same three bands and the same brand colours as a player's scale, said in
 * the language you would use about a coach. "HS Starter" means nothing about a
 * man running the defense.
 */
export const COACH_TIERS: Tier[] = [
  { key: 'work',     label: 'Needs work', min: 0,  color: TIERS[0].color, soft: TIERS[0].soft, ink: TIERS[0].ink },
  { key: 'solid',    label: 'Solid',      min: 34, color: TIERS[1].color, soft: TIERS[1].soft, ink: TIERS[1].ink },
  { key: 'standout', label: 'Standout',   min: 67, color: TIERS[2].color, soft: TIERS[2].soft, ink: TIERS[2].ink },
]

export function coachTierFor(score: number | null | undefined): Tier {
  if (score == null) return COACH_TIERS[0]
  let match = COACH_TIERS[0]
  for (const t of COACH_TIERS) if (score >= t.min) match = t
  return match
}

export interface ReviewCategory {
  key: string
  label: string
  section: string
  /** The one line that says what a high score here actually means. */
  hint: string
}

/**
 * What a high school lacrosse staff is actually judged on — grouped so the form
 * reads as four short conversations rather than one long interrogation.
 */
export const REVIEW_CATEGORIES: ReviewCategory[] = [
  { section: 'On the field', key: 'knowledge', label: 'Knowledge of the game',
    hint: 'Knows his phase of the game cold and keeps learning it.' },
  { section: 'On the field', key: 'teaching', label: 'Teaching & correction',
    hint: 'Players leave his station understanding what to fix and how.' },
  { section: 'On the field', key: 'practice', label: 'Running a practice block',
    hint: 'His group starts on time, moves, and gets through the work.' },
  { section: 'On the field', key: 'gameday', label: 'Game day',
    hint: 'Useful on the sideline — adjustments, substitutions, a clear head.' },
  { section: 'On the field', key: 'prep', label: 'Scouting & preparation',
    hint: 'Comes in having done the work on the opponent and on his own unit.' },

  { section: 'With the players', key: 'development', label: 'Player development',
    hint: 'His players are measurably better in May than they were in February.' },
  { section: 'With the players', key: 'trust', label: 'Relationships & trust',
    hint: 'Players go to him. He knows more than their position.' },
  { section: 'With the players', key: 'standard', label: 'Holds the standard',
    hint: 'Corrects the small things without being asked to.' },
  { section: 'With the players', key: 'clarity', label: 'Clear with players',
    hint: 'Says it once, plainly, and the team knows where they stand.' },

  { section: 'With the staff', key: 'reliability', label: 'Reliability',
    hint: 'There, on time, all season — practice, games, the unglamorous days.' },
  { section: 'With the staff', key: 'organization', label: 'Preparation & organization',
    hint: 'Ready before the whistle. Nothing waits on him.' },
  { section: 'With the staff', key: 'collaboration', label: 'Works with the staff',
    hint: 'Pulls the same direction, even on a call he would have made differently.' },
  { section: 'With the staff', key: 'feedback', label: 'Takes feedback',
    hint: 'Told something hard, he uses it rather than defends against it.' },
  { section: 'With the staff', key: 'initiative', label: 'Initiative',
    hint: 'Sees the job and does it without being handed it.' },

  { section: 'The program', key: 'conduct', label: 'Conduct — officials & opponents',
    hint: 'How he behaves when it is going badly is how the program looks.' },
  { section: 'The program', key: 'parents', label: 'Parent communication',
    hint: 'Handles a hard conversation without it landing back on you.' },
  { section: 'The program', key: 'offseason', label: 'Off-season commitment',
    hint: 'Fall ball, the weight room, summer — present when nobody has to be.' },
]

export const REVIEW_SECTIONS: string[] = [...new Set(REVIEW_CATEGORIES.map((c) => c.section))]

/** Where a coach stands for next season. The reason this form exists. */
export const STANDING_OPTIONS = [
  'Returning — same role',
  'Returning — bigger role',
  'Returning — changes needed',
  'Undecided',
  'Not returning',
] as const
export type Standing = (typeof STANDING_OPTIONS)[number]

/** Returning in some form, so the list can show it green. */
export function standingIsGood(s: string | null | undefined): boolean {
  return typeof s === 'string' && s.startsWith('Returning')
}

export type ReviewStatus = 'draft' | 'final'

export interface CoachReview {
  id: string
  coach_email: string
  coach_name: string
  season: string
  ratings: Record<string, unknown>
  overall: number | null
  strengths: string | null
  areas_to_improve: string | null
  standing: string | null
  notes: string | null
  status: ReviewStatus
  reviewer_email: string | null
  created_at: string
  updated_at: string
}

/** Mean of every category actually scored, 0 when none were. */
export function reviewAverage(ratings: Record<string, unknown> | null | undefined): number {
  if (!ratings) return 0
  const scores = Object.values(ratings)
    .map(readRating)
    .filter((r): r is SkillRating => r !== null)
    .map((r) => r.score)
  if (!scores.length) return 0
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

/** The one number for a review: the overall if it was set, else the mean. */
export function reviewScore(r: CoachReview): number {
  if (r.overall && r.overall > 0) return r.overall
  return Math.round(reviewAverage(r.ratings) * 10) / 10
}

/**
 * The season a review belongs to, written the way a coach says it.
 *
 * A lacrosse season runs across the new year, so "2026" is the spring that ends
 * in 2026. Anything from July onward is already working toward the next one.
 */
export function currentSeason(now: Date): string {
  const year = now.getFullYear()
  return String(now.getMonth() >= 6 ? year + 1 : year)
}

export function seasonChoices(now: Date): string[] {
  const current = Number(currentSeason(now))
  return [current + 1, current, current - 1, current - 2].map(String)
}
