// Emailing the coaching staff when the week changes: a practice plan posted,
// something added to or taken off the schedule. Server only.
//
// Who gets it: every coach with a real inbox on file (Coach Access), on the
// side of the program it's about, except whoever made the change — and
// except anyone who has said in the calendar they're out at that time. Each
// kind can be switched off in Admin → Notifications. Never throws: the change
// is saved either way.

import { createServiceClient } from './supabase-server'
import { sendEmail } from './email'
import { listStaff, staffMailbox } from './staff'
import { readNotifySettings } from './notify'
import { isEventOn } from './notifyEvents'
import { expandAvailability, readAvailability } from './calendarData'
import { TEAM_TIME_ZONE } from './format'

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
 * The coaches to tell: a real inbox, on this side of the program, not the one
 * who made the change, and not out at that time.
 */
async function staffToTell(a: { team: 'varsity' | 'jv' | 'program'; actorEmail: string | null; start: Date | null; end: Date | null }) {
  const actor = (a.actorEmail ?? '').toLowerCase()
  const staff = (await listStaff()).filter(
    (s) => s.email.toLowerCase() !== actor && (a.team === 'program' || s.team === 'all' || s.team === a.team) && staffMailbox(s)
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
  return staff.filter((s) => !out.has(s.email.toLowerCase()))
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

/** A practice plan is ready: posted with a date and its drills. */
export async function emailPracticePosted(a: {
  planId: string
  team: 'varsity' | 'jv'
  title: string
  start: Date
  minutes: number
  blocks: string[]
  actor: { email: string | null; name: string }
}): Promise<number> {
  try {
    const end = new Date(a.start.getTime() + Math.max(30, a.minutes) * 60_000)
    const who = await staffToTell({ team: a.team, actorEmail: a.actor.email, start: a.start, end })
    if (!who.length) return 0
    const team = a.team === 'jv' ? 'JV' : 'Varsity'
    const when = whenLabel(a.start)
    return await send(
      'practice-posted',
      who,
      `${team} practice posted: ${when}`,
      card({
        kicker: 'Practice plan',
        title: `${a.actor.name} posted ${team} practice`,
        lines: [`${a.title} — ${when}`, `${a.minutes} minutes`],
        list: a.blocks.slice(0, 14),
        button: { label: 'Open the plan', href: `/admin/planner/${a.planId}?team=${a.team}` },
      })
    )
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
