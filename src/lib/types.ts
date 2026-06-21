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

export type TeamPostCategory =
  | 'announcement' | 'practice' | 'game' | 'forms' | 'event' | 'gear' | 'general'

export interface TeamPost {
  id: string
  title: string
  body: string
  category: TeamPostCategory
  pinned: boolean
  event_date: string | null
  attachments: string | null
  author: string
  published: boolean
  created_at: string
  updated_at: string
}

export const TEAM_CATEGORY_META: Record<TeamPostCategory, { label: string; emoji: string; cls: string }> = {
  announcement: { label: 'Announcement', emoji: '📣', cls: 'cat-announcement' },
  practice:     { label: 'Practice',     emoji: '🥍', cls: 'cat-practice' },
  game:         { label: 'Game',         emoji: '🏆', cls: 'cat-game' },
  forms:        { label: 'Forms',        emoji: '📄', cls: 'cat-forms' },
  event:        { label: 'Event',        emoji: '📅', cls: 'cat-event' },
  gear:         { label: 'Gear',         emoji: '🎒', cls: 'cat-gear' },
  general:      { label: 'General',      emoji: '💬', cls: 'cat-general' },
}

// Parse the "Label | https://url" (one per line) attachments field.
export function parseAttachments(raw: string | null): { label: string; url: string }[] {
  if (!raw) return []
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf('|')
      if (i === -1) return { label: line, url: line }
      return { label: line.slice(0, i).trim(), url: line.slice(i + 1).trim() }
    })
    .filter((a) => a.url)
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
