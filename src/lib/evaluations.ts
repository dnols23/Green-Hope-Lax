// Player-evaluation config + types for the Coaches Hub.
//
// The category list is the ONE place to change what coaches rate — swap this
// array to match the exact GTO evaluation set and every form/board updates.

export const SCALE = {
  min: 1,
  max: 5,
  labels: {
    1: 'Needs development',
    2: 'Below average',
    3: 'Solid',
    4: 'Strong',
    5: 'Elite',
  } as Record<number, string>,
}

export interface EvalCategory {
  key: string
  label: string
}

// ── The rated skill categories (1–5 each). Edit to match your program. ──
export const EVAL_CATEGORIES: EvalCategory[] = [
  { key: 'athleticism', label: 'Athleticism & Speed' },
  { key: 'stick', label: 'Stick Skills' },
  { key: 'dodging', label: 'Dodging & 1v1' },
  { key: 'shooting', label: 'Shooting & Finishing' },
  { key: 'offball', label: 'Off-ball Movement & IQ' },
  { key: 'defense', label: 'Defense & Footwork' },
  { key: 'groundballs', label: 'Ground Balls' },
  { key: 'motor', label: 'Effort & Motor' },
  { key: 'coachability', label: 'Coachability & Attitude' },
  { key: 'team', label: 'Team-first & Leadership' },
]

export const PLAYING_TIME_OPTIONS = ['Varsity Starter', 'Varsity', 'JV', 'Develop'] as const
export type PlayingTime = (typeof PLAYING_TIME_OPTIONS)[number]

export type CoachRole = 'head' | 'assistant'

export interface CoachAccount {
  email: string
  display_name: string
  role: CoachRole
  created_at: string
}

export interface Evaluation {
  id: string
  player_id: string
  evaluator_email: string
  evaluator_name: string
  season: string
  position: string | null
  ratings: Record<string, number>
  overall: number | null
  strengths: string | null
  areas_to_improve: string | null
  playing_time: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// Average of the filled category ratings (0 if none).
export function ratingsAverage(ratings: Record<string, number>): number {
  const vals = EVAL_CATEGORIES.map((c) => ratings[c.key]).filter((v): v is number => typeof v === 'number' && v > 0)
  if (!vals.length) return 0
  return vals.reduce((a, b) => a + b, 0) / vals.length
}
