// The depth chart: who is first, second and third at every spot, for varsity
// and for JV.
//
// Pure: the shape, the positions and the reading of what was stored. Each team
// keeps one under its own app_settings key, so there is no SQL to run.

import type { Team } from './teams'

export const depthKey = (team: Team) => `depth_chart:${team}`

export interface DepthPosition {
  key: string
  label: string
  /** How many start; the rest are depth. */
  starters: number
  /** Midfield runs in lines: the list breaks every `starters` names. */
  lines?: boolean
}

export const DEPTH_POSITIONS: DepthPosition[] = [
  { key: 'attack', label: 'Attack', starters: 3 },
  { key: 'midfield', label: 'Midfield', starters: 3, lines: true },
  { key: 'fogo', label: 'Faceoff', starters: 1 },
  { key: 'lsm', label: 'LSM', starters: 1 },
  { key: 'ssdm', label: 'SSDM', starters: 2 },
  { key: 'defense', label: 'Defense', starters: 3 },
  { key: 'goalie', label: 'Goalie', starters: 1 },
]

export interface DepthChart {
  rosterId: string | null
  /** Each position's players, best first. A player can be on more than one. */
  slots: Record<string, string[]>
}

export function emptyChart(): DepthChart {
  return { rosterId: null, slots: Object.fromEntries(DEPTH_POSITIONS.map((p) => [p.key, []])) }
}

export function readDepthChart(raw: unknown): DepthChart {
  const chart = emptyChart()
  let r: Record<string, unknown> = {}
  try {
    r = (typeof raw === 'string' ? JSON.parse(raw) : raw ?? {}) as Record<string, unknown>
  } catch {
    return chart
  }
  if (typeof r.rosterId === 'string' && r.rosterId) chart.rosterId = r.rosterId.slice(0, 80)
  const slots = (r.slots ?? {}) as Record<string, unknown>
  for (const p of DEPTH_POSITIONS) {
    const list = slots[p.key]
    chart.slots[p.key] = Array.isArray(list)
      ? [...new Set(list.filter((x): x is string => typeof x === 'string' && !!x))].slice(0, 40)
      : []
  }
  return chart
}

/** "1st line", "2nd line" … for the midfield; "Starters" / "Depth" for the rest. */
export function tierLabel(pos: DepthPosition, index: number): string | null {
  if (pos.lines) {
    if (index % pos.starters !== 0) return null
    const n = index / pos.starters + 1
    return `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'} line`
  }
  if (index === 0) return pos.starters > 1 ? 'Starters' : 'Starter'
  if (index === pos.starters) return 'Depth'
  return null
}

/** Where a roster's position says a player goes: "A", "Attack", "M/LSM", "FOGO". */
export function positionsFor(raw: string | null | undefined): string[] {
  const out: string[] = []
  for (const part of String(raw ?? '').toUpperCase().split(/[\/,&+]| OR /)) {
    const p = part.trim().replace(/\./g, '')
    if (!p) continue
    const key =
      /^(A|ATT|ATTACK|ATTACKMAN)$/.test(p) ? 'attack'
      : /^(FO|FOGO|FACEOFF|FACE-OFF|FACE OFF)$/.test(p) ? 'fogo'
      : /^(LSM|LONG STICK MIDDIE|LONGSTICK)$/.test(p) ? 'lsm'
      : /^(SSDM|DM|D-MID|DMID|DEFENSIVE MID|DEFENSIVE MIDFIELD)$/.test(p) ? 'ssdm'
      : /^(M|MF|MID|MIDDIE|MIDFIELD|MIDFIELDER|OM)$/.test(p) ? 'midfield'
      : /^(D|DEF|DEFENSE|DEFENCE|DEFENSEMAN|DEFENDER|POLE)$/.test(p) ? 'defense'
      : /^(G|GK|GOALIE|GOALKEEPER|GOALTENDER)$/.test(p) ? 'goalie'
      : null
    if (key && !out.includes(key)) out.push(key)
  }
  return out
}

/**
 * Pull a roster in: everyone not yet on the chart goes in at the bottom of the
 * position their roster entry names. Who is already placed stays where they are.
 */
export function fillFromRoster(
  chart: DepthChart,
  players: { id: string; position: string | null }[],
): { chart: DepthChart; placed: number } {
  const onChart = new Set(Object.values(chart.slots).flat())
  const slots = Object.fromEntries(Object.entries(chart.slots).map(([k, v]) => [k, [...v]]))
  let placed = 0
  for (const p of players) {
    if (onChart.has(p.id)) continue
    const where = positionsFor(p.position)
    if (!where.length) continue
    for (const key of where) slots[key]?.push(p.id)
    placed++
  }
  return { chart: { ...chart, slots }, placed }
}
