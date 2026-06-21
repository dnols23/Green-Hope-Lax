// Database row types — mirror supabase/migrations/0001_init.sql.

export type TeamGroup = 'boys_varsity' | 'boys_jv' | 'girls'
export type ProgramGender = 'boys' | 'girls'
export type HomeAway = 'home' | 'away' | 'neutral'
export type GameStatus = 'scheduled' | 'final' | 'postponed' | 'canceled'
export type ExperienceLevel = 'new' | 'some' | 'experienced'

export interface Player {
  id: string
  team: TeamGroup
  name: string
  number: string | null
  position: string | null
  class_year: string | null
  height: string | null
  hometown: string | null
  bio: string | null
  photo_url: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface Game {
  id: string
  gender: ProgramGender
  game_date: string
  opponent: string
  home_away: HomeAway
  location: string | null
  status: GameStatus
  team_score: number | null
  opp_score: number | null
  is_conference: boolean
  notes: string | null
  created_at: string
}

export interface Coach {
  id: string
  name: string
  role: string
  program: ProgramGender | null
  email: string | null
  phone: string | null
  bio: string | null
  photo_url: string | null
  sort_order: number
  created_at: string
}

export interface NewsPost {
  id: string
  title: string
  slug: string
  body: string
  image_url: string | null
  published: boolean
  published_at: string
  created_at: string
}

export interface InterestSubmission {
  id: string
  player_first: string
  player_last: string
  grad_year: string | null
  parent_name: string
  parent_email: string
  parent_phone: string
  player_email: string | null
  experience: ExperienceLevel
  program: ProgramGender
  notes: string | null
  created_at: string
}

export interface ContactSubmission {
  id: string
  name: string
  email: string
  message: string
  created_at: string
}

// ── Display helpers ────────────────────────────────────────────────────────────
export const TEAM_LABELS: Record<TeamGroup, string> = {
  boys_varsity: 'Boys Varsity',
  boys_jv: 'Boys JV',
  girls: 'Girls',
}

export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  new: 'New to lacrosse',
  some: 'Some experience',
  experienced: 'Experienced',
}
