import type { CalTeam } from './calendarModel'

// What each calendar shares, and with whom.
//
// Pure, so the settings panel and the server agree on the shape. The owner
// decides, per calendar (varsity, JV, program), whether it is published to the
// Coaches Hub, the Team Hub and the Parent Hub, and which parts go there. An
// event's own "who sees this" still applies on top — this can only narrow it.

export const CALENDAR_SHARE_KEY = 'calendar_share'

export type ShareHub = 'coaches' | 'team' | 'parents'
export type ShareLayer = 'games' | 'practices' | 'events'

export const SHARE_HUBS: { key: ShareHub; label: string }[] = [
  { key: 'coaches', label: 'Coaches Hub' },
  { key: 'team', label: 'Team Hub' },
  { key: 'parents', label: 'Parent Hub' },
]

export const SHARE_LAYERS: { key: ShareLayer; label: string }[] = [
  { key: 'games', label: 'Games' },
  { key: 'practices', label: 'Practices' },
  { key: 'events', label: 'Events' },
]

export const SHARE_CALENDARS: { key: CalTeam; label: string; layers: ShareLayer[] }[] = [
  { key: 'varsity', label: 'Varsity', layers: ['games', 'practices', 'events'] },
  { key: 'jv', label: 'JV', layers: ['games', 'practices', 'events'] },
  // The program's own calendar carries events only; games and practices belong to a team.
  { key: 'program', label: 'Program', layers: ['events'] },
]

export interface HubShare {
  on: boolean
  layers: ShareLayer[]
}

export type CalendarShare = Record<CalTeam, Record<ShareHub, HubShare>>

const HUB_DEFAULTS: Record<ShareHub, HubShare> = {
  coaches: { on: true, layers: ['games', 'practices', 'events'] },
  team: { on: true, layers: ['games', 'practices', 'events'] },
  // Parents get the games and the events; practice plans stay with the team.
  parents: { on: true, layers: ['games', 'events'] },
}

export function defaultCalendarShare(): CalendarShare {
  const out = {} as CalendarShare
  for (const c of SHARE_CALENDARS) {
    out[c.key] = {} as Record<ShareHub, HubShare>
    for (const h of SHARE_HUBS) out[c.key][h.key] = { ...HUB_DEFAULTS[h.key], layers: [...HUB_DEFAULTS[h.key].layers] }
  }
  return out
}

const isLayer = (v: unknown): v is ShareLayer => v === 'games' || v === 'practices' || v === 'events'

export function parseCalendarShare(value: unknown): CalendarShare {
  const out = defaultCalendarShare()
  let raw: unknown = value
  if (typeof value === 'string') {
    try {
      raw = JSON.parse(value)
    } catch {
      return out
    }
  }
  if (!raw || typeof raw !== 'object') return out
  const r = raw as Record<string, Record<string, { on?: unknown; layers?: unknown }>>
  for (const c of SHARE_CALENDARS) {
    for (const h of SHARE_HUBS) {
      const got = r[c.key]?.[h.key]
      if (!got) continue
      if (typeof got.on === 'boolean') out[c.key][h.key].on = got.on
      if (Array.isArray(got.layers)) out[c.key][h.key].layers = got.layers.filter(isLayer)
    }
  }
  return out
}

/** May this part of this calendar be shown in this hub? */
export function shares(share: CalendarShare, team: CalTeam, hub: ShareHub, layer: ShareLayer): boolean {
  const s = share[team]?.[hub]
  return !!s && s.on && s.layers.includes(layer)
}
