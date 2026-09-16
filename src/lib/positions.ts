// What a player actually plays, and nothing else.
//
// Its own module because both the evaluation form and the drill engine need it,
// and neither should have to import the other to ask.

export type PositionGroup = 'attack' | 'midfield' | 'defense' | 'lsm' | 'goalie' | 'fogo'

export const POSITION_GROUPS: PositionGroup[] = ['attack', 'midfield', 'defense', 'lsm', 'goalie', 'fogo']

export const POSITION_LABELS: Record<PositionGroup, string> = {
  attack: 'Attack',
  midfield: 'Midfield',
  defense: 'Defense',
  lsm: 'LSM / D-mid',
  goalie: 'Goalie',
  fogo: 'Face-off',
}

/** Read the position a coach typed on the roster. Free text, so be generous. */
export function positionGroup(position: string | null | undefined): PositionGroup {
  const p = String(position ?? '').toLowerCase()
  if (/goal|gk|keeper/.test(p)) return 'goalie'
  if (/fogo|face|fo\b/.test(p)) return 'fogo'
  if (/lsm|long ?stick|ssdm|d-?mid|dmid/.test(p)) return 'lsm'
  if (/def|close d|pole/.test(p)) return 'defense'
  // Checked before attack: plenty of players are listed "Midfield / Attack",
  // and a midfielder who also plays attack trains as a midfielder.
  if (/mid/.test(p)) return 'midfield'
  if (/att|x\b/.test(p)) return 'attack'
  return 'midfield'
}
