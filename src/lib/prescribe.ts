// Turning a coach's evaluation into one player's drill set.
//
// Pure: no database, no clock. The coach generates a set, we store what was
// prescribed, and the player's page shows that — rather than recomputing under
// them every time they open it.

import { EVAL_CATEGORIES, readRating, type Evaluation } from './evaluations'
import { DRILL_CATEGORIES, type Drill } from './drills'

export type PositionGroup = 'attack' | 'midfield' | 'defense' | 'lsm' | 'goalie' | 'fogo'

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

/**
 * Where the work lives for each rated skill, in order of preference.
 *
 * A weak category is answered by the drill categories that actually train it —
 * "Throwing, weak hand" is wall work and stick work, not a 6v6 rep — and the
 * position adjusts it: a goalie's ground balls are not an attackman's.
 */
const SKILL_TO_DRILLS: Record<string, string[]> = {
  catching:     ['stickwork', 'warmup'],
  throw_strong: ['stickwork', 'shooting'],
  throw_weak:   ['stickwork', 'warmup'],
  groundballs:  ['groundballs', 'footwork'],
  protection:   ['stickwork', 'dodging'],

  dodging:  ['dodging', 'footwork'],
  shooting: ['shooting'],
  offball:  ['offense', 'sixes'],
  feeding:  ['offense', 'stickwork'],

  onball:   ['individualdefense', 'footwork'],
  footwork: ['footwork', 'individualdefense'],
  slides:   ['defense', 'sixes'],
  checks:   ['individualdefense'],

  speed:    ['footwork', 'conditioning', 'strength'],
  strength: ['strength', 'conditioning'],
  motor:    ['conditioning', 'strength'],

  iq:           ['mental', 'planning', 'offense'],
  coachability: ['mental'],
  team:         ['leadership', 'mental'],
  compete:      ['mental', 'conditioning'],
}

/**
 * Position work, used to break ties within a skill rather than to replace it.
 *
 * A weak weak-hand is answered by stick work whoever you are; being an attackman
 * decides which stick work. The exception is the two positions whose whole
 * training is position-specific — a goalie's catching work is goalie work, not
 * partner passing.
 */
const POSITION_FIRST: Record<PositionGroup, string[]> = {
  attack: ['dodging', 'shooting', 'offense'],
  midfield: ['dodging', 'shooting', 'transition'],
  defense: ['individualdefense', 'defense', 'footwork'],
  lsm: ['individualdefense', 'dmid', 'groundballs'],
  goalie: ['goalie'],
  fogo: ['faceoff', 'groundballs'],
}

export interface FocusArea {
  key: string
  label: string
  score: number
  /** 'fix' for the weakest work, 'sharpen' in the middle, 'keep' for a strength. */
  kind: 'fix' | 'sharpen' | 'keep'
}

export interface DrillSetItem {
  drillId: string
  name: string
  category: string
  link: string | null
  /** Which focus area it answers. */
  focusKey: string
  focusLabel: string
  reason: string
  repsPerWeek: number
}

export interface DrillSet {
  focus: FocusArea[]
  items: DrillSetItem[]
  position: PositionGroup
  /** Skills the bank has nothing for — said out loud rather than left silent. */
  uncovered: string[]
}

const MAX_FOCUS = 3
const DRILLS_PER_FOCUS = 2

function band(score: number): 'fix' | 'sharpen' | 'keep' {
  if (score < 34) return 'fix'
  if (score < 67) return 'sharpen'
  return 'keep'
}

function reasonFor(focus: FocusArea, position: PositionGroup): string {
  const label = focus.label.toLowerCase()
  const pos = POSITION_LABELS[position].toLowerCase()
  if (focus.kind === 'fix') {
    return `Your ${label} is the first thing holding you back right now. Ten minutes of this, most days, moves it faster than anything else you could do.`
  }
  if (focus.kind === 'sharpen') {
    return `Your ${label} is solid. This is the work that turns solid into the thing a ${pos} gets picked for.`
  }
  return `Your ${label} is already a strength. Keep it sharp — this is maintenance, not repair.`
}

/** The skills this player was actually rated on, best first. */
export function ratedSkills(evaluation: Evaluation): { key: string; label: string; score: number }[] {
  return EVAL_CATEGORIES.map((c) => {
    const rating = readRating(evaluation.ratings?.[c.key])
    return { key: c.key, label: c.label, score: rating?.score ?? 0 }
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
}

/**
 * Build the set: the weakest few skills to fix, one strength to keep, and the
 * drills from the bank that answer them.
 */
export function buildDrillSet(
  evaluation: Evaluation,
  drills: Drill[],
  position: PositionGroup
): DrillSet {
  const rated = ratedSkills(evaluation)
  if (rated.length === 0) return { focus: [], items: [], position, uncovered: [] }

  const weakest = [...rated].reverse().slice(0, MAX_FOCUS)
  const strongest = rated[0]

  const focus: FocusArea[] = weakest.map((r) => ({
    key: r.key,
    label: r.label,
    score: r.score,
    kind: band(r.score),
  }))
  // A player who is good at everything still gets work; a player who is good at
  // nothing does not need telling twice.
  if (strongest && !focus.some((f) => f.key === strongest.key) && strongest.score >= 34) {
    focus.push({ key: strongest.key, label: strongest.label, score: strongest.score, kind: 'keep' })
  }

  const used = new Set<string>()
  const items: DrillSetItem[] = []
  const uncovered: string[] = []

  for (const area of focus) {
    const positionFirst = position === 'goalie' || position === 'fogo'
    const skillCats = SKILL_TO_DRILLS[area.key] ?? []
    const posCats = POSITION_FIRST[position] ?? []
    const preferred = [...new Set(positionFirst ? [...posCats, ...skillCats] : [...skillCats, ...posCats])]

    /* Category order is the prescription; inside a category, a coach's favourite
       comes first and a drill a player can actually watch beats one they can only
       read the name of. */
    const ranked = preferred.flatMap((cat) =>
      drills
        .filter((d) => d.category === cat && !used.has(d.id))
        .sort((a, b) => {
          const fav = Number(b.is_favorite) - Number(a.is_favorite)
          if (fav) return fav
          return Number(Boolean(b.link)) - Number(Boolean(a.link))
        })
    )

    const picked = ranked.slice(0, DRILLS_PER_FOCUS)
    if (picked.length === 0) {
      uncovered.push(area.label)
      continue
    }
    for (const d of picked) {
      used.add(d.id)
      items.push({
        drillId: d.id,
        name: d.name,
        category: d.category,
        link: d.link,
        focusKey: area.key,
        focusLabel: area.label,
        reason: reasonFor(area, position),
        repsPerWeek: area.kind === 'fix' ? 4 : area.kind === 'sharpen' ? 3 : 2,
      })
    }
  }

  return { focus, items, position, uncovered }
}

/** The label for a drill's category, for the player's page. */
export function drillCategoryLabel(key: string): string {
  return DRILL_CATEGORIES.find((c) => c.key === key)?.label ?? 'Skill work'
}
