// A scouting report on an opponent.
//
// Pure, so the editor, the save and the War Room agree on the shape. It lives
// in the plan's `details` column (0042), like a game plan's decisions do.

export interface ScoutField {
  key: string
  label: string
  placeholder: string
}

export interface ScoutSection {
  key: string
  title: string
  icon: string
  fields: ScoutField[]
}

/** The questions, section by section. Each gets an answer box. */
export const SCOUT_SECTIONS: ScoutSection[] = [
  {
    key: 'who',
    title: 'Who they are',
    icon: '📋',
    fields: [
      { key: 'record', label: 'Record and results', placeholder: '8–3. Beat Apex 9–7, lost to Panther Creek 12–5' },
      { key: 'style', label: 'How they play', placeholder: 'Slow it down, ride hard, lean on their LSM' },
    ],
  },
  {
    key: 'offense',
    title: 'Their offense',
    icon: '⚔️',
    fields: [
      { key: 'off_set', label: 'The set they start in', placeholder: '2-3-1, runs a 1-4-1 on the man-up' },
      { key: 'off_init', label: 'Who initiates, and from where', placeholder: '#12 from X, #7 top-right lefty' },
      { key: 'off_break', label: 'What they go to when it breaks down', placeholder: 'Picks up top, 2-man game on the wing' },
      { key: 'off_manup', label: 'Man-up look', placeholder: '3-3, skip to the crease' },
    ],
  },
  {
    key: 'defense',
    title: 'Their defense',
    icon: '🛡️',
    fields: [
      { key: 'def_scheme', label: 'Man or zone, and when they switch', placeholder: 'Man; zone after a timeout' },
      { key: 'def_slide', label: 'How they slide', placeholder: 'Adjacent, crease comes late' },
      { key: 'def_cover', label: 'Their best cover', placeholder: '#22 LSM, takes our best middie' },
      { key: 'def_mandown', label: 'Man-down look', placeholder: 'Box and one' },
    ],
  },
  {
    key: 'transition',
    title: 'Ride and clear',
    icon: '🔁',
    fields: [
      { key: 'ride', label: 'How they ride', placeholder: '10-man after goals, goalie ride on the whistle' },
      { key: 'clear', label: 'How they clear, and who carries it', placeholder: 'Goalie to the D on the wing, #40 carries' },
      { key: 'beatable', label: 'Where they are beatable', placeholder: 'Middle of the field after a save' },
    ],
  },
  {
    key: 'faceoff',
    title: 'Face-off and the goalie',
    icon: '🥅',
    fields: [
      { key: 'fogo', label: 'Their FOGO', placeholder: 'Clamp, goes forward; wings crash early' },
      { key: 'goalie', label: 'Their goalie', placeholder: 'Weak off-stick high, slow to clear' },
    ],
  },
]

export const SCOUT_POSITIONS = ['A', 'M', 'D', 'LSM', 'SSDM', 'FO', 'G'] as const

export interface ScoutPlayer {
  id: string
  number: string
  name: string
  position: string
  notes: string
}

export interface ScoutLink {
  id: string
  label: string
  url: string
}

export interface ScoutDetails {
  kind: 'scout'
  opponent: string
  gameId: string | null
  answers: Record<string, string>
  players: ScoutPlayer[]
  keys: string[]
  links: ScoutLink[]
}

const FIELD_KEYS = SCOUT_SECTIONS.flatMap((s) => s.fields.map((f) => f.key))
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
const rid = (v: unknown, fallback: string) => (typeof v === 'string' && v ? v.slice(0, 40) : fallback)

export function scoutStarter(input: { opponent?: string; gameId?: string | null } = {}): ScoutDetails {
  return {
    kind: 'scout',
    opponent: input.opponent ?? '',
    gameId: input.gameId ?? null,
    answers: {},
    players: [],
    keys: ['', '', ''],
    links: [],
  }
}

/** Whatever was stored, as a report — unknown keys dropped, lengths capped. */
export function readScout(raw: unknown): ScoutDetails {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const answersRaw = r.answers && typeof r.answers === 'object' ? (r.answers as Record<string, unknown>) : {}
  const answers: Record<string, string> = {}
  for (const k of FIELD_KEYS) {
    const v = text(answersRaw[k], 2000)
    if (v) answers[k] = v
  }
  const players = (Array.isArray(r.players) ? r.players : []).slice(0, 30).map((p, i) => {
    const o = (p ?? {}) as Record<string, unknown>
    return {
      id: rid(o.id, `sp${i}`),
      number: text(o.number, 4),
      name: text(o.name, 80),
      position: text(o.position, 8),
      notes: text(o.notes, 400),
    }
  })
  const keys = (Array.isArray(r.keys) ? r.keys : []).slice(0, 8).map((k) => text(k, 300))
  const links = (Array.isArray(r.links) ? r.links : []).slice(0, 12).map((l, i) => {
    const o = (l ?? {}) as Record<string, unknown>
    return { id: rid(o.id, `sl${i}`), label: text(o.label, 80), url: text(o.url, 500) }
  })
  return {
    kind: 'scout',
    opponent: text(r.opponent, 120),
    gameId: typeof r.gameId === 'string' && r.gameId ? r.gameId.slice(0, 64) : null,
    answers,
    players,
    keys: keys.length ? keys : ['', '', ''],
    links,
  }
}

export const isScoutDetails = (raw: unknown) =>
  !!raw && typeof raw === 'object' && (raw as Record<string, unknown>).kind === 'scout'

/** "9 of 15 answered · 3 players" — for lists. */
export function describeScout(d: ScoutDetails): string {
  const answered = FIELD_KEYS.filter((k) => d.answers[k]?.trim()).length
  const players = d.players.filter((p) => p.name.trim() || p.number.trim()).length
  const bits = [`${answered} of ${FIELD_KEYS.length} answered`]
  if (players) bits.push(`${players} ${players === 1 ? 'player' : 'players'} to know`)
  return bits.join(' · ')
}

/* Scouts made before this page opened as a checklist of these prompts. Those
   are the questions above now, so they are dropped from what the scout still
   carries — anything a coach actually wrote there stays, as notes. */
const OLD_PROMPTS = new Set([
  'Who they are',
  'Record and who they have beaten',
  'Their two or three best players, by number',
  'Anybody we have to know by name',
  'Their offense',
  'The set they start in',
  'Who initiates, and from where',
  'What they go to when it breaks down',
  'Man-up look',
  'Their defense',
  'Man or zone, and when they switch',
  'How they slide — adjacent, crease, hot',
  'Who their best cover is',
  'Man-down look',
  'Ride and clear',
  'How they ride',
  'How they clear, and who carries it',
  'Where they are beatable',
  'Face-off and the goalie',
  'Their FOGO — hands, counters, wing play',
  'Their goalie — where he is beatable, how he clears',
  'Keys to the game',
])

export function withoutOldPrompts<B extends { kind: string }>(blocks: B[]): B[] {
  return blocks.flatMap((b, i) => {
    const o = b as unknown as {
      kind: string
      text?: string
      done?: boolean
      indent?: number
      details?: unknown
      items?: { text: string; done: boolean }[]
    }
    if (o.kind === 'heading' && OLD_PROMPTS.has((o.text ?? '').trim())) return []
    /* The old checklist reads back as one to-do per item now. A prompt nobody
       ticked goes, as it did — unless something was tucked under it or it was
       given details since, which would make it something a coach wrote. */
    if (o.kind === 'todo' && !o.done && !o.details && OLD_PROMPTS.has((o.text ?? '').trim())) {
      const next = blocks[i + 1] as unknown as { indent?: number } | undefined
      if ((next?.indent ?? 0) <= (o.indent ?? 0)) return []
    }
    if (o.kind === 'list' && o.items) {
      const items = o.items.filter((i) => i.done || (i.text.trim() && !OLD_PROMPTS.has(i.text.trim())))
      return items.length ? [{ ...b, items } as B] : []
    }
    return [b]
  })
}
