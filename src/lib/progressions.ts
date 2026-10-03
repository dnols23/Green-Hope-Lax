// Positional progressions: drills from the bank in a set order — a development
// routine for one position. Pure, so the bank, the planner and the server all
// read one the same way.

import { DEPTH_POSITIONS } from './depthChart'
import { categoryFor, type Drill } from './drills'
import { emptyBlock, newId, type PlanBlock } from './planner'

export interface ProgressionStep {
  drillId: string
  minutes: number
  /** What to coach in this step of the routine. */
  note: string
}

export interface Progression {
  id: string
  name: string
  /** A depth-chart position key, or 'all' for everyone. */
  position: string
  notes: string | null
  steps: ProgressionStep[]
  sort_order: number
}

export const PROGRESSION_POSITIONS: { key: string; label: string }[] = [
  ...DEPTH_POSITIONS.map((p) => ({ key: p.key, label: p.label })),
  { key: 'all', label: 'Everyone' },
]

export const positionName = (key: string) => PROGRESSION_POSITIONS.find((p) => p.key === key)?.label ?? 'Everyone'

/** The most drills one progression holds — what a plan block can carry. */
export const MAX_STEPS = 12

export function readSteps(raw: unknown): ProgressionStep[] {
  return (Array.isArray(raw) ? raw : [])
    .map((s) => (s ?? {}) as Record<string, unknown>)
    .filter((s) => typeof s.drillId === 'string' && !!s.drillId)
    .slice(0, MAX_STEPS)
    .map((s) => ({
      drillId: String(s.drillId),
      minutes: Math.max(0, Math.min(120, Math.round(Number(s.minutes) || 0))),
      note: typeof s.note === 'string' ? s.note.slice(0, 1000) : '',
    }))
}

export function readProgression(row: Record<string, unknown>): Progression {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    position: PROGRESSION_POSITIONS.some((p) => p.key === row.position) ? String(row.position) : 'all',
    notes: typeof row.notes === 'string' && row.notes.trim() ? row.notes : null,
    steps: readSteps(row.steps),
    sort_order: Number(row.sort_order) || 0,
  }
}

export const progressionMinutes = (p: Pick<Progression, 'steps'>) => p.steps.reduce((n, s) => n + s.minutes, 0)

/**
 * A progression as one practice block: its drills in order, each step's
 * minutes and coaching point as that drill's note for the day.
 */
export function progressionBlock(p: Progression, drills: Drill[], parallel = false): PlanBlock {
  const steps = p.steps.filter((s) => drills.some((d) => d.id === s.drillId))
  const first = drills.find((d) => d.id === steps[0]?.drillId)
  const say = (s: ProgressionStep) => [s.minutes ? `${s.minutes} min` : '', s.note.trim()].filter(Boolean).join(' · ')
  // Notes go by drill, so a drill run twice keeps both of its steps' notes.
  const drillNotes: Record<string, string> = {}
  for (const s of steps.slice(1)) {
    const line = say(s)
    if (line) drillNotes[s.drillId] = drillNotes[s.drillId] ? `${drillNotes[s.drillId]}; then ${line}` : line
  }
  return {
    ...emptyBlock(),
    id: newId('b'),
    title: `${positionName(p.position)}: ${p.name}`,
    minutes: progressionMinutes({ steps }) || 10,
    tag: first ? categoryFor(first.category).tag : 'individual',
    parallel,
    drillId: steps[0]?.drillId ?? null,
    extraDrills: steps.slice(1).map((s) => s.drillId),
    link: first?.link ?? null,
    notes: steps[0] ? say(steps[0]) : '',
    drillNotes,
  }
}
