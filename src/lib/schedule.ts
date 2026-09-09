// Who a game is for.
//
// Pure — no server imports — so the admin form, the Team Hub and the public
// schedule all describe the same three choices in the same words.

export type GameAudience = 'public' | 'team' | 'coaches'

export interface AudienceOption {
  key: GameAudience
  label: string
  /** What marking a game this way actually does, in plain words. */
  description: string
}

export const GAME_AUDIENCES: AudienceOption[] = [
  {
    key: 'public',
    label: 'Everyone',
    description: 'Public schedule, the Team Hub, and here.',
  },
  {
    key: 'team',
    label: 'Players & parents',
    description: 'The Team Hub and here. Not on the public site.',
  },
  {
    key: 'coaches',
    label: 'Coaches only',
    description: 'Only this admin. Nobody else sees it.',
  },
]

/** The audiences each surface may show, widest first. */
export const VISIBLE_TO: Record<'public' | 'team' | 'admin', GameAudience[]> = {
  public: ['public'],
  team: ['public', 'team'],
  admin: ['public', 'team', 'coaches'],
}

export function audienceLabel(value: string | null | undefined): string {
  return GAME_AUDIENCES.find((a) => a.key === value)?.label ?? 'Everyone'
}

/** Anything unrecognised — or missing, before the migration runs — is public. */
export function normalizeAudience(value: unknown): GameAudience {
  return value === 'team' || value === 'coaches' ? value : 'public'
}
