// Emailing the coaching staff when the week changes: a practice plan posted,
// something added to or taken off the schedule. Server only.
//
// Who gets it: every coach with a real inbox on file (Coach Access), on the
// side of the program it's about — except anyone who has said in the
// calendar they're out at that time. Whoever made the change gets a copy. Each
// kind can be switched off in Admin → Notifications. Never throws: the change
// is saved either way.

import { createServiceClient } from './supabase-server'
import { sendEmail } from './email'
import { listStaff, staffMailbox } from './staff'
import { readNotifySettings } from './notify'
import { isEventOn } from './notifyEvents'
import { expandAvailability, readAvailability } from './calendarData'
import { TEAM_TIME_ZONE } from './format'
import { clockAt, runningClock, tagFor, totalMinutes, type PlanBlock } from './planner'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.greenhopelacrosse.com'

export type StaffNotice = 'practice-posted' | 'schedule-change'

export function whenLabel(start: Date | string, allDay = false): string {
  const d = new Date(start)
  if (isNaN(+d)) return ''
  const day = d.toLocaleDateString('en-US', { timeZone: TEAM_TIME_ZONE, weekday: 'short', month: 'short', day: 'numeric' })
  if (allDay) return day
  const time = d.toLocaleTimeString('en-US', { timeZone: TEAM_TIME_ZONE, hour: 'numeric', minute: '2-digit' })
  return `${day} · ${time}`
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function card(a: { kicker: string; title: string; lines: string[]; list?: string[]; button?: { label: string; href: string } }) {
  return `<!doctype html><html><body style="margin:0;background:#f6f7f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#141414">
<div style="max-width:520px;margin:0 auto;padding:24px 16px">
  <div style="background:#004D2E;color:#fff;border-radius:14px 14px 0 0;padding:18px 22px">
    <div style="font-size:11px;letter-spacing:.2em;font-weight:800;color:#f3c9cd">GREEN HOPE LACROSSE · ${esc(a.kicker.toUpperCase())}</div>
    <div style="font-size:20px;font-weight:900;margin-top:6px">${esc(a.title)}</div>
  </div>
  <div style="background:#fff;border:1px solid #e3e6e3;border-top:0;border-radius:0 0 14px 14px;padding:22px">
    ${a.lines.map((l, i) => `<p style="margin:${i ? '6px' : '0'} 0 0;line-height:1.5;${i ? 'color:#4b5563' : 'font-weight:700'}">${esc(l)}</p>`).join('')}
    ${a.list && a.list.length ? `<ul style="margin:14px 0 0;padding-left:18px;line-height:1.6;color:#374151">${a.list.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
    ${a.button ? `<a href="${SITE}${a.button.href}" style="display:inline-block;margin-top:20px;background:#0e7a50;color:#fff;text-decoration:none;font-weight:800;padding:12px 22px;border-radius:10px">${esc(a.button.label)}</a>` : ''}
    <p style="margin:18px 0 0;font-size:11px;color:#9ca3af">You get these as a Green Hope coach. Mark yourself out in the calendar and you won’t get them for that time.</p>
  </div>
</div></body></html>`
}

/**
 * The coaches to tell: a real inbox, on this side of the program, and not out
 * at that time — plus whoever made the change, as a copy.
 */
async function staffToTell(a: { team: 'varsity' | 'jv' | 'program'; actorEmail: string | null; start: Date | null; end: Date | null }) {
  // Whoever made the change gets a copy too, whatever the calendar says.
  const actor = (a.actorEmail ?? '').toLowerCase()
  const staff = (await listStaff()).filter(
    (s) => (s.email.toLowerCase() === actor || a.team === 'program' || s.team === 'all' || s.team === a.team) && staffMailbox(s)
  )
  if (!staff.length || !a.start) return staff
  const end = a.end && a.end > a.start ? a.end : new Date(a.start.getTime() + 2 * 3_600_000)
  const { data } = await createServiceClient()
    .from('coach_availability')
    .select('*')
    .eq('status', 'unavailable')
    .in('coach_email', staff.map((s) => s.email.toLowerCase()))
  const out = new Set<string>()
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const av = readAvailability(row)
    if (expandAvailability(av, a.start, end).length) out.add(av.coachEmail.toLowerCase())
  }
  return staff.filter((s) => s.email.toLowerCase() === actor || !out.has(s.email.toLowerCase()))
}

async function send(event: StaffNotice, who: Awaited<ReturnType<typeof staffToTell>>, subject: string, html: string) {
  const settings = await readNotifySettings()
  if (!isEventOn(settings, event)) return 0
  const bcc = [...new Set(who.map((s) => staffMailbox(s)!.toLowerCase()))]
  let sent = 0
  for (let i = 0; i < bcc.length; i += 40) {
    if (await sendEmail({ bcc: bcc.slice(i, i + 40), subject, html })) sent += bcc.slice(i, i + 40).length
  }
  return sent
}

interface DrillRow {
  id: string
  name: string
  description: string | null
  setup: string | null
  context: string | null
  variations: string | null
  equipment: string | null
  link: string | null
}

const para = (t: string, style = 'margin:6px 0 0;color:#374151;font-size:14px;line-height:1.5') =>
  `<p style="${style};white-space:pre-wrap">${esc(t)}</p>`
const labelled = (label: string, t: string | null | undefined) =>
  t && t.trim() ? para(`${label}: ${t.trim()}`, 'margin:6px 0 0;color:#374151;font-size:14px;line-height:1.5') : ''

/** One drill from the bank, written out so it can be coached from a phone. */
function drillHtml(d: DrillRow, note: string | null, lead: boolean) {
  return `<div style="margin-top:8px;${lead ? '' : 'padding-top:8px;border-top:1px dashed #e3e6e3;'}">
    <div style="font-weight:800;font-size:14px">🥍 ${esc(d.name)}</div>
    ${note && note.trim() ? para(note.trim(), 'margin:4px 0 0;color:#141414;font-size:14px;line-height:1.5;font-weight:600') : ''}
    ${d.description ? para(d.description) : ''}
    ${labelled('Setup', d.setup)}
    ${labelled('Coaching points', d.context)}
    ${labelled('Equipment', d.equipment)}
    ${labelled('Variations', d.variations)}
    ${d.link ? `<a href="${esc(d.link)}" style="display:inline-block;margin-top:6px;color:#0e7a50;font-weight:700;font-size:13px">Watch it ↗</a>` : ''}
  </div>`
}

/** The whole practice, block by block, as the email's body. */
async function practiceHtml(a: { title: string; when: string; start: string; summary: string | null; blocks: PlanBlock[] }) {
  const svc = createServiceClient()
  const drillIds = [...new Set(a.blocks.flatMap((b) => [b.drillId, ...(b.extraDrills ?? [])]).filter((x): x is string => !!x))]
  const playerIds = [...new Set(a.blocks.flatMap((b) => (b.players ?? []).map((p) => p.playerId)))]
  const [drillRes, playerRes] = await Promise.all([
    drillIds.length
      ? svc.from('drills').select('id, name, description, setup, context, variations, equipment, link').in('id', drillIds)
      : Promise.resolve({ data: [] }),
    playerIds.length ? svc.from('players').select('id, name, number').in('id', playerIds) : Promise.resolve({ data: [] }),
  ])
  const drills = new Map(((drillRes.data ?? []) as DrillRow[]).map((d) => [d.id, d]))
  const players = new Map(((playerRes.data ?? []) as { id: string; name: string; number: string | number | null }[]).map((p) => [p.id, p]))
  const clock = runningClock(a.blocks)

  const rows = a.blocks
    .map((b, i) => {
      const tag = tagFor(b.tag)
      const at = clockAt(a.start, clock[i]) ?? ''
      const first = b.drillId ? drills.get(b.drillId) : undefined
      const extras = (b.extraDrills ?? []).map((id) => drills.get(id)).filter((d): d is DrillRow => !!d)
      const who = (b.players ?? [])
        .map((p) => {
          const pl = players.get(p.playerId)
          if (!pl) return null
          return `${pl.number != null && pl.number !== '' ? `#${pl.number} ` : ''}${pl.name}${p.role ? ` (${p.role})` : ''}`
        })
        .filter(Boolean)
      return `<div style="margin-top:12px;border:1px solid #e3e6e3;border-left:5px solid ${tag.color};border-radius:10px;padding:12px 14px;background:#fff">
    <div style="font-size:12px;font-weight:800;color:#6b7280;letter-spacing:.04em">${esc(at)}${b.parallel ? ' · SAME TIME AS ABOVE' : ''} · ${b.minutes} MIN · ${esc(tag.label.toUpperCase())}</div>
    <div style="font-size:16px;font-weight:900;margin-top:3px">${esc(b.title || first?.name || 'Untitled')}</div>
    ${b.coach ? para(/^coach\b/i.test(b.coach.trim()) ? b.coach.trim() : `Coach ${b.coach.trim()}`, 'margin:4px 0 0;color:#0e7a50;font-size:13px;font-weight:700') : ''}
    ${first ? drillHtml(first, b.notes, true) : b.notes?.trim() ? para(b.notes.trim(), 'margin:6px 0 0;color:#141414;font-size:14px;line-height:1.5') : ''}
    ${extras.map((d) => drillHtml(d, b.drillNotes?.[d.id] ?? null, false)).join('')}
    ${!first && b.link ? `<a href="${esc(b.link)}" style="display:inline-block;margin-top:6px;color:#0e7a50;font-weight:700;font-size:13px">Watch it ↗</a>` : ''}
    ${who.length ? para(`Players: ${who.join(', ')}`, 'margin:8px 0 0;color:#4b5563;font-size:13px') : ''}
  </div>`
    })
    .join('')

  return `<!doctype html><html><body style="margin:0;background:#f6f7f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#141414">
<div style="max-width:520px;margin:0 auto;padding:0 16px 24px">
  ${a.summary && a.summary.trim() ? `<div style="background:#fff;border:1px solid #e3e6e3;border-radius:12px;padding:12px 14px;margin-bottom:4px"><div style="font-size:11px;letter-spacing:.15em;font-weight:800;color:#6b7280">TODAY’S FOCUS</div>${para(a.summary.trim(), 'margin:4px 0 0;font-size:14px;line-height:1.5')}</div>` : ''}
  ${rows}
</div></body></html>`
}

/** A practice plan published: the whole practice, ready to coach from. */
export async function emailPracticePosted(a: {
  planId: string
  team: 'varsity' | 'jv'
  title: string
  start: Date
  /** "16:00" — the clock every block runs off. */
  startHm: string
  summary: string | null
  blocks: PlanBlock[]
  /** Published before: this is the update. */
  updated?: boolean
  actor: { email: string | null; name: string }
}): Promise<number> {
  try {
    const minutes = totalMinutes(a.blocks)
    const end = new Date(a.start.getTime() + Math.max(30, minutes) * 60_000)
    const who = await staffToTell({ team: a.team, actorEmail: a.actor.email, start: a.start, end })
    if (!who.length) return 0
    const team = a.team === 'jv' ? 'JV' : 'Varsity'
    const when = whenLabel(a.start)
    const head = card({
      kicker: 'Practice plan',
      title: `${a.actor.name} ${a.updated ? 'updated' : 'posted'} ${team} practice`,
      lines: [`${a.title} — ${when}`, `${minutes} minutes · ends ${clockAt(a.startHm, minutes) ?? ''}`],
      button: { label: 'Open the plan', href: `/admin/planner/${a.planId}?team=${a.team}` },
    })
    // The card on top, then every block written out under it.
    const body = await practiceHtml({ title: a.title, when, start: a.startHm, summary: a.summary, blocks: a.blocks })
    const html = head.replace('</body></html>', '') + body.replace(/^[\s\S]*?<body[^>]*>/, '')
    return await send('practice-posted', who, `${team} practice ${a.updated ? 'updated' : 'posted'}: ${when}`, html)
  } catch (err) {
    console.error('[staffNotify] practice', err)
    return 0
  }
}

/** Something went onto, or came off, the schedule. */
export async function emailScheduleChange(a: {
  change: 'added' | 'removed'
  what: string
  team: 'varsity' | 'jv' | 'program'
  start: Date
  end?: Date | null
  allDay?: boolean
  detail?: string | null
  actor: { email: string | null; name: string }
}): Promise<number> {
  try {
    const who = await staffToTell({ team: a.team, actorEmail: a.actor.email, start: a.start, end: a.end ?? null })
    if (!who.length) return 0
    const when = whenLabel(a.start, a.allDay)
    const verb = a.change === 'added' ? 'Added to' : 'Removed from'
    const team = a.team === 'jv' ? 'JV · ' : a.team === 'varsity' ? 'Varsity · ' : ''
    return await send(
      'schedule-change',
      who,
      `${verb} the schedule: ${a.what} — ${when}`,
      card({
        kicker: 'Schedule',
        title: `${verb} the schedule`,
        lines: [`${a.what}`, `${team}${when}`, ...(a.detail ? [a.detail] : []), `by ${a.actor.name}`],
        button: { label: 'Open the calendar', href: '/admin/calendar' },
      })
    )
  } catch (err) {
    console.error('[staffNotify] schedule', err)
    return 0
  }
}
