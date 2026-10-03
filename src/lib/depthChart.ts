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
  /** The order the position cards show in, as the coach slid them. */
  order?: string[]
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
  if (Array.isArray(r.order)) chart.order = orderPositions(r.order).map((p) => p.key)
  return chart
}

/** The positions in the coach's order: the saved ones first, any new ones after. */
export function orderPositions(saved: unknown): DepthPosition[] {
  const keys = Array.isArray(saved) ? saved.filter((k): k is string => typeof k === 'string') : []
  const picked = [...new Set(keys)].map((k) => DEPTH_POSITIONS.find((p) => p.key === k)).filter((p): p is DepthPosition => !!p)
  return [...picked, ...DEPTH_POSITIONS.filter((p) => !picked.includes(p))]
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

/** Only players who are still on the roster. */
export function pruneChart(chart: DepthChart, ids: Set<string>): DepthChart {
  return {
    ...chart,
    slots: Object.fromEntries(DEPTH_POSITIONS.map((p) => [p.key, (chart.slots[p.key] ?? []).filter((id) => ids.has(id))])),
  }
}

/** The bench: on the roster, at no spot. Dropping there takes a player off the spot he came from. */
export const BENCH = 'bench'

/**
 * One drag, inside one team's chart: off the spot he was at (unless he came
 * from the bench) and in at the new one (unless he went to the bench). A
 * player already at the spot he is dropped on just moves within it.
 */
export function moveOnChart(
  chart: DepthChart,
  from: { zone: string; index: number; playerId: string },
  to: { zone: string; index: number },
): DepthChart {
  const slots = { ...chart.slots }
  let at = to.index
  if (from.zone !== BENCH) {
    const list = [...(slots[from.zone] ?? [])]
    if (list[from.index] === from.playerId) list.splice(from.index, 1)
    slots[from.zone] = list
    if (to.zone === from.zone && from.index < at) at--
  }
  if (to.zone !== BENCH) {
    const list = [...(slots[to.zone] ?? [])]
    const dup = list.indexOf(from.playerId)
    if (dup >= 0) {
      list.splice(dup, 1)
      if (dup < at) at--
    }
    list.splice(Math.max(0, Math.min(at, list.length)), 0, from.playerId)
    slots[to.zone] = list
  }
  return { ...chart, slots }
}

/** Off every spot on a chart — he has gone to the other team. */
export function dropFromChart(chart: DepthChart, playerId: string): DepthChart {
  return { ...chart, slots: Object.fromEntries(Object.entries(chart.slots).map(([k, v]) => [k, v.filter((id) => id !== playerId)])) }
}

// ── Which team a roster is for ───────────────────────────────────────────────

/** rosterId → the team it belongs to, kept in app_settings. No SQL. */
export const ROSTER_TEAMS_KEY = 'roster_teams'

export function readRosterTeams(raw: unknown): Record<string, Team> {
  let r: Record<string, unknown> = {}
  try {
    r = (typeof raw === 'string' ? JSON.parse(raw) : raw ?? {}) as Record<string, unknown>
  } catch {
    return {}
  }
  const out: Record<string, Team> = {}
  for (const [k, v] of Object.entries(r)) if (v === 'varsity' || v === 'jv') out[k] = v
  return out
}

/** Every position empty: everyone back on the bench. The roster stays. */
export function clearChart(chart: DepthChart): DepthChart {
  return { ...chart, slots: Object.fromEntries(DEPTH_POSITIONS.map((p) => [p.key, []])) }
}
