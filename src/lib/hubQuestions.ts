// What players and parents are asked when they sign up for their hub.
//
// Pure, so the sign-up screens and the coaches' view of the answers agree on
// the questions and their wording.

export interface HubQuestion {
  key: string
  label: string
  kind: 'text' | 'long' | 'multi' | 'choice'
  options?: string[]
  required?: boolean
  placeholder?: string
}

/** The fun part: who the player is. */
export const PLAYER_FAVORITES: HubQuestion[] = [
  { key: 'nickname', label: 'What do you go by?', kind: 'text' },
  { key: 'fav_player', label: 'Favorite lacrosse player', kind: 'text' },
  { key: 'fav_team', label: 'Favorite team (any sport)', kind: 'text' },
  { key: 'fav_position', label: 'Favorite position to play', kind: 'text' },
  { key: 'fav_drill', label: 'Favorite drill', kind: 'text' },
  { key: 'walkup_song', label: 'Pump-up song', kind: 'text' },
  { key: 'pregame_meal', label: 'Pre-game meal', kind: 'text' },
  { key: 'outside', label: 'What you do when you’re not playing lacrosse', kind: 'text' },
]

/** The serious part: what the player wants out of the season. */
export const PLAYER_GOALS: HubQuestion[] = [
  { key: 'goal_season', label: 'Your #1 goal for this season', kind: 'long', required: true },
  { key: 'goal_improve', label: 'The part of your game you most want to improve', kind: 'long', required: true },
  { key: 'goal_future', label: 'Where you want lacrosse to take you after high school', kind: 'long' },
  {
    key: 'coached',
    label: 'How you like to be coached',
    kind: 'choice',
    options: ['Tell me straight, in the moment', 'Pull me aside after', 'Show me on film', 'A mix'],
  },
  { key: 'know', label: 'Anything your coaches should know about you', kind: 'long' },
]

export const PARENT_HELP = [
  'Team parent',
  'Concessions',
  'Fundraising',
  'Photos / video',
  'Carpools',
  'Senior night / banquet',
  'Game-day setup',
]

/** A few quick ones for parents. */
export const PARENT_QUESTIONS: HubQuestion[] = [
  { key: 'help', label: 'Would you help with any of these?', kind: 'multi', options: PARENT_HELP },
  { key: 'skills', label: 'A job, business or skill that could help the program', kind: 'long', placeholder: 'Sponsorship, printing, medical, photography…' },
  { key: 'medical', label: 'Anything medical the coaches should know about your player', kind: 'long', placeholder: 'Allergies, inhaler, past concussions…' },
  { key: 'experience', label: 'How long has your player played lacrosse?', kind: 'text' },
  { key: 'other', label: 'Anything else', kind: 'long' },
]

/** Where the athletics code of conduct and the acknowledgement form live. */
export const DEFAULT_ACK_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSfkY_aQyiWZElRfSro9E2HWf9NJ42w-FOIdhGb7wLZkjWIn6g/viewform'

export type Answers = Record<string, string | string[]>

/** Only the known questions, trimmed — nothing else a browser sends is kept. */
export function cleanAnswers(raw: unknown, questions: HubQuestion[]): Answers {
  const out: Answers = {}
  if (!raw || typeof raw !== 'object') return out
  const r = raw as Record<string, unknown>
  for (const q of questions) {
    const v = r[q.key]
    if (q.kind === 'multi') {
      if (Array.isArray(v)) {
        const picked = v.map(String).filter((x) => q.options?.includes(x))
        if (picked.length) out[q.key] = picked
      }
    } else if (typeof v === 'string' && v.trim()) {
      out[q.key] = v.trim().slice(0, q.kind === 'long' ? 2000 : 200)
    }
  }
  return out
}

export function missingRequired(answers: Answers, questions: HubQuestion[]): HubQuestion | null {
  return questions.find((q) => q.required && !answers[q.key]) ?? null
}
