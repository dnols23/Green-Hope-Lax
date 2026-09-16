// Turning a coach's evaluation into one player's drill set.
//
// Pure: no database, no clock. The coach generates a set, we store what was
// prescribed, and the player's page shows that — rather than recomputing under
// them every time they open it.

import { EVAL_CATEGORIES, readRating, type Evaluation } from './evaluations'
import { DRILL_CATEGORIES, isHomework, type Drill } from './drills'
import { POSITION_LABELS, positionGroup, type PositionGroup } from './positions'

// Re-exported so the screens that already ask prescribe for these keep working.
export { POSITION_LABELS, positionGroup }
export type { PositionGroup }

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

  // A goalie's work is goalie work. The bank's goalie section is deep enough
  // that each of these lands somewhere real, and clearing is its own category.
  gk_arc:   ['goalie', 'footwork'],
  gk_hands: ['goalie', 'stickwork'],
  gk_read:  ['goalie'],
  gk_clear: ['ridecrear', 'goalie'],

  fo_clamp: ['faceoff'],
  fo_exit:  ['faceoff', 'groundballs'],
  fo_wing:  ['groundballs', 'faceoff'],
  fo_after: ['faceoff', 'footwork'],

  speed:    ['footwork', 'conditioning', 'strength'],
  strength: ['strength', 'conditioning'],
  motor:    ['conditioning', 'strength'],

  /* Lacrosse IQ, coachability, team-first, competitiveness — and a goalie
     running his defense — are deliberately absent. Nothing in a drill bank
     fixes them, and mapping them anywhere sent a kid an ESPN story about a
     Tottenham midfielder as his homework. They still show on his evaluation,
     and they are what a coach talks to him about. */
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
  /** Wall, on your own, or with a friend — never anything else. */
  setting?: string
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
    // A skill nobody scored is absent; a skill scored zero is a rating, and the
    // worst one there is. Reading them as the same thing hid the players who
    // most needed the work.
    return rating ? { key: c.key, label: c.label, score: rating.score } : null
  })
    .filter((r): r is { key: string; label: string; score: number } => r !== null)
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
  // Callers pass a group key, but a stray roster string ("Goalie / GK") must
  // not take the page down — it reads as the position it plainly is.
  position = POSITION_LABELS[position] ? position : positionGroup(position)

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
    const skillCats = SKILL_TO_DRILLS[area.key]
    /* A skill with no drill categories behind it is not drillable at all — the
       intangibles. Falling through to the position's categories would answer
       "Lacrosse IQ" with a dodging drill, which is worse than answering
       nothing. */
    if (!skillCats) {
      uncovered.push(area.label)
      continue
    }
    const positionFirst = position === 'goalie' || position === 'fogo'
    const posCats = POSITION_FIRST[position] ?? []
    const preferred = [...new Set(positionFirst ? [...posCats, ...skillCats] : [...skillCats, ...posCats])]

    /* Category order is the prescription; inside a category, a coach's favourite
       comes first and a drill a player can actually watch beats one they can only
       read the name of. */
    /* Only work a player can actually do on their own. A team install or a film
       breakdown is a fine drill and a terrible piece of homework — those stay in
       the plan, where a coach runs them. */
    const ranked = preferred.flatMap((cat) =>
      drills
        .filter((d) => d.category === cat && !used.has(d.id) && isHomework(d.setting))
        .sort((a, b) => {
          const fav = Number(b.is_favorite) - Number(a.is_favorite)
          if (fav) return fav
          return Number(Boolean(b.link)) - Number(Boolean(a.link))
        })
    )

    const picked = ranked.slice(0, DRILLS_PER_FOCUS)
    if (picked.length === 0) {
      // Named rather than dropped: a coach can see the gap and fill the bank.
      uncovered.push(area.label)
      continue
    }
    for (const d of picked) {
      used.add(d.id)
      items.push({
        drillId: d.id,
        name: d.name,
        category: d.category,
        setting: d.setting,
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
