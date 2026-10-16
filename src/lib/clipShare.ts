// Who a clip is sent to, and who is watching. Pure, so the send popup, the
// Film Room feeds and the server agree.

export type ShareGroup = 'all_coaches' | 'all_players' | 'varsity_players' | 'jv_players' | 'all_parents'
export type SharePerson = 'coach' | 'player' | 'parent'
export type ShareTarget = ShareGroup | SharePerson

export const SHARE_GROUPS: { key: ShareGroup; label: string; icon: string }[] = [
  { key: 'all_players', label: 'All players', icon: '🥍' },
  { key: 'varsity_players', label: 'Varsity players', icon: 'V' },
  { key: 'jv_players', label: 'JV players', icon: 'JV' },
  { key: 'all_coaches', label: 'All coaches', icon: '🧢' },
  { key: 'all_parents', label: 'All parents', icon: '👪' },
]

export const isShareGroup = (v: unknown): v is ShareGroup => SHARE_GROUPS.some((g) => g.key === v)
export const isSharePerson = (v: unknown): v is SharePerson => v === 'coach' || v === 'player' || v === 'parent'

/** One line of who a clip went to: a group, or a person by id. */
export interface Share {
  target: ShareTarget
  /** '' for a group; an email for a coach; a uuid for a player or parent. */
  targetId: string
}

/** Someone a clip can be sent to by name. */
export interface Recipient {
  kind: SharePerson
  id: string
  name: string
  /** "#12 · Varsity", "Coach", "Parent of Danny" — told apart in the picker. */
  detail: string
}

export type ViewerKind = 'coach' | 'player' | 'parent'

/** Whoever is watching, as the Film Room knows them. */
export interface FilmViewer {
  kind: ViewerKind
  /** 'coach:<email>', 'player:<uuid>', 'parent:<uuid>'. */
  key: string
  id: string
  name: string
  /** A player's team, which decides the Varsity/JV groups. */
  team: 'varsity' | 'jv' | null
}

export const viewerKey = (kind: ViewerKind, id: string) => `${kind}:${kind === 'coach' ? id.toLowerCase() : id}`

/** The share lines that reach this viewer — what to ask the database for. */
export function sharesFor(v: Pick<FilmViewer, 'kind' | 'id' | 'team'>): Share[] {
  if (v.kind === 'coach') return [{ target: 'all_coaches', targetId: '' }, { target: 'coach', targetId: v.id.toLowerCase() }]
  if (v.kind === 'parent') return [{ target: 'all_parents', targetId: '' }, { target: 'parent', targetId: v.id }]
  return [
    { target: 'all_players', targetId: '' },
    ...(v.team === 'varsity' ? [{ target: 'varsity_players' as const, targetId: '' }] : []),
    ...(v.team === 'jv' ? [{ target: 'jv_players' as const, targetId: '' }] : []),
    { target: 'player', targetId: v.id },
  ]
}

export function reaches(share: Share, v: Pick<FilmViewer, 'kind' | 'id' | 'team'>): boolean {
  return sharesFor(v).some((s) => s.target === share.target && s.targetId === share.targetId)
}

/** "All players", or the person's name. */
export function shareLabel(s: Share, people: Recipient[]): string {
  const group = SHARE_GROUPS.find((g) => g.key === s.target)
  if (group) return group.label
  return people.find((p) => p.kind === s.target && p.id === s.targetId)?.name ?? 'Someone'
}

/** "All players + 2 more" — short enough for a clip card. */
export function shareSummary(shares: Share[], people: Recipient[]): string {
  if (!shares.length) return ''
  const groups = shares.filter((s) => isShareGroup(s.target))
  const first = groups[0] ?? shares[0]
  const rest = shares.length - 1
  return `${shareLabel(first, people)}${rest ? ` + ${rest} more` : ''}`
}
