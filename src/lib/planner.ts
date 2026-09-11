// The Planner: practice plans, game plans and coaching notes.
//
// Pure — the editor is a client component and shares every one of these with the
// server. Nothing here reads cookies or the database.

export type PlanKind = 'practice' | 'game' | 'note'

export const PLAN_KINDS: { key: PlanKind; label: string; plural: string; icon: string; blurb: string }[] = [
  { key: 'practice', label: 'Practice plan', plural: 'Practices', icon: '🥍', blurb: 'A session broken into timed blocks.' },
  { key: 'game', label: 'Game plan', plural: 'Games', icon: '🏟', blurb: 'Matchups, situations and what we run.' },
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

/** A men's field, in yards. Everything on a board is stored in these units. */
export const FIELD = {
  length: 110,
  width: 60,
  goalLineFromEnd: 15,
  creaseRadius: 3,
  restrainingFromGoalLine: 20,
  wingFromCenter: 10,
  boxDepth: 20,
}

export type TokenKind = 'offense' | 'defense' | 'goalie' | 'cone' | 'ball' | 'coach'

export const TOKEN_KINDS: { key: TokenKind; label: string; fill: string; ink: string }[] = [
  { key: 'offense', label: 'Offense',  fill: '#00693E', ink: '#ffffff' },
  { key: 'defense', label: 'Defense',  fill: '#7A1F2B', ink: '#ffffff' },
  { key: 'goalie',  label: 'Goalie',   fill: '#B4823A', ink: '#ffffff' },
  { key: 'coach',   label: 'Coach',    fill: '#2F5D8C', ink: '#ffffff' },
  { key: 'cone',    label: 'Cone',     fill: '#E4863A', ink: '#3b1d05' },
  { key: 'ball',    label: 'Ball',     fill: '#f5f5f5', ink: '#17222e' },
]

export function tokenStyle(kind: TokenKind) {
  return TOKEN_KINDS.find((t) => t.key === kind) ?? TOKEN_KINDS[0]
}

export interface BoardToken {
  id: string
  kind: TokenKind
  /** Yards from the left end line / top sideline. */
  x: number
  y: number
  /** Jersey number or initials — whatever fits in a disc. */
  label: string
  /** The player this token stands for, when it came off a roster. */
  playerId?: string
}

export type PathKind = 'run' | 'pass' | 'shot' | 'screen'

export const PATH_KINDS: { key: PathKind; label: string; dash: string; color: string }[] = [
  { key: 'run',    label: 'Run',    dash: '',      color: '#17222e' },
  { key: 'pass',   label: 'Pass',   dash: '3 2',   color: '#2F5D8C' },
  { key: 'shot',   label: 'Shot',   dash: '6 2',   color: '#7A1F2B' },
  { key: 'screen', label: 'Pick',   dash: '1 2',   color: '#B4823A' },
]

export function pathStyle(kind: PathKind) {
  return PATH_KINDS.find((p) => p.key === kind) ?? PATH_KINDS[0]
}

export interface BoardPath {
  id: string
  kind: PathKind
  /** At least two points, in field yards. */
  points: { x: number; y: number }[]
}

export interface Board {
  tokens: BoardToken[]
  paths: BoardPath[]
}

export const EMPTY_BOARD: Board = { tokens: [], paths: [] }

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
  /** The drill from the bank this block is running, if any. */
  drillId?: string | null
  /** A link carried over from that drill, so the block stands on its own. */
  link?: string | null
  /** The coach running it. */
  coach?: string | null
  /** Players in this block. Empty means the whole squad. */
  players?: BlockAssignment[]
}

export interface Plan {
  id: string
  kind: PlanKind
  title: string
  plan_date: string | null
  season: string | null
  summary: string | null
  blocks: PlanBlock[]
  roster_id: string | null
  is_template: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
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
  for (const b of blocks) {
    out.push(total)
    total += Math.max(0, Number(b.minutes) || 0)
  }
  return out
}

export function totalMinutes(blocks: PlanBlock[]): number {
  return blocks.reduce((sum, b) => sum + Math.max(0, Number(b.minutes) || 0), 0)
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
      drillId: typeof b.drillId === 'string' ? b.drillId : null,
      link: typeof b.link === 'string' && b.link.trim() ? b.link.trim() : null,
      coach: typeof b.coach === 'string' && b.coach.trim() ? b.coach.trim() : null,
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

export function readBoard(raw: unknown): Board | null {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as Partial<Board>
  const tokens = Array.isArray(b.tokens)
    ? b.tokens.map((t) => {
        const tok = (t ?? {}) as Partial<BoardToken>
        return {
          id: typeof tok.id === 'string' ? tok.id : newId('t'),
          kind: (TOKEN_KINDS.some((k) => k.key === tok.kind) ? tok.kind : 'offense') as TokenKind,
          x: Number(tok.x) || 0,
          y: Number(tok.y) || 0,
          label: typeof tok.label === 'string' ? tok.label : '',
          playerId: typeof tok.playerId === 'string' ? tok.playerId : undefined,
        }
      })
    : []
  const paths = Array.isArray(b.paths)
    ? b.paths
        .map((p) => {
          const path = (p ?? {}) as Partial<BoardPath>
          const points = Array.isArray(path.points)
            ? path.points.map((pt) => ({ x: Number(pt?.x) || 0, y: Number(pt?.y) || 0 }))
            : []
          return {
            id: typeof path.id === 'string' ? path.id : newId('p'),
            kind: (PATH_KINDS.some((k) => k.key === path.kind) ? path.kind : 'run') as PathKind,
            points,
          }
        })
        .filter((p) => p.points.length >= 2)
    : []
  if (!tokens.length && !paths.length) return null
  return { tokens, paths }
}
