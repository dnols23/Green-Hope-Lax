// Emailing people when a clip is sent to them. Server only.
//
// One heads-up per person, the first time a clip reaches them — sending the
// same clip again to someone who already has it doesn't email them twice.
// Addresses go in bcc, so nobody sees who else got it.

import { createServiceClient } from './supabase-server'
import { sendEmail } from './email'
import { listStaff, staffMailbox } from './staff'
import type { Share, ViewerKind } from './clipShare'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.greenhopelacrosse.com'
const WATCH: Record<ViewerKind, string> = {
  coach: '/admin/film/watch',
  player: '/team/film',
  parent: '/parents/film',
}

interface Mailbox {
  kind: ViewerKind
  email: string
}

/** Everyone these share lines reach who has an inbox, keyed by who they are. */
async function mailboxesFor(shares: Share[], senderEmail: string): Promise<Map<string, Mailbox>> {
  const out = new Map<string, Mailbox>()
  if (!shares.length) return out
  const svc = createServiceClient()
  const wants = new Set(shares.map((s) => s.target))
  const needPlayers = ['all_players', 'varsity_players', 'jv_players', 'player'].some((t) => wants.has(t as Share['target']))
  const needParents = wants.has('all_parents') || wants.has('parent')
  const [staff, players, accounts, parents] = await Promise.all([
    wants.has('all_coaches') || wants.has('coach') ? listStaff() : Promise.resolve([]),
    needPlayers ? svc.from('players').select('id, team, is_active') : Promise.resolve({ data: [] }),
    needPlayers ? svc.from('hub_accounts').select('player_id, email').eq('kind', 'player') : Promise.resolve({ data: [] }),
    needParents ? svc.from('parents').select('id, email') : Promise.resolve({ data: [] }),
  ])
  const accountOf = new Map(
    ((accounts.data ?? []) as { player_id: string | null; email: string | null }[])
      .filter((a) => a.player_id && a.email)
      .map((a) => [String(a.player_id), String(a.email)])
  )
  const playerRows = (players.data ?? []) as { id: string; team: string | null; is_active: boolean | null }[]
  const parentRows = (parents.data ?? []) as { id: string; email: string | null }[]
  const sender = senderEmail.toLowerCase()

  const addCoach = (email: string) => {
    if (email.toLowerCase() === sender) return
    const rec = staff.find((s) => s.email.toLowerCase() === email.toLowerCase())
    const box = rec ? staffMailbox(rec) : null
    if (box) out.set(`coach:${rec!.email.toLowerCase()}`, { kind: 'coach', email: box })
  }
  const addPlayer = (id: string) => {
    const email = accountOf.get(id)
    if (email) out.set(`player:${id}`, { kind: 'player', email })
  }
  const addParent = (id: string) => {
    const email = parentRows.find((p) => p.id === id)?.email
    if (email) out.set(`parent:${id}`, { kind: 'parent', email })
  }

  for (const s of shares) {
    if (s.target === 'all_coaches') staff.forEach((r) => addCoach(r.email))
    else if (s.target === 'coach') addCoach(s.targetId)
    else if (s.target === 'all_players' || s.target === 'varsity_players' || s.target === 'jv_players') {
      const team = s.target === 'varsity_players' ? 'boys_varsity' : s.target === 'jv_players' ? 'boys_jv' : null
      playerRows.filter((p) => p.is_active !== false && (!team || p.team === team)).forEach((p) => addPlayer(String(p.id)))
    } else if (s.target === 'player') addPlayer(s.targetId)
    else if (s.target === 'all_parents') parentRows.forEach((p) => addParent(String(p.id)))
    else if (s.target === 'parent') addParent(s.targetId)
  }
  return out
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function html(kind: ViewerKind, a: { coachName: string; clipName: string; notes: string | null; prompt: string | null }) {
  const link = `${SITE}${WATCH[kind]}`
  return `<!doctype html><html><body style="margin:0;background:#f6f7f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#141414">
<div style="max-width:520px;margin:0 auto;padding:24px 16px">
  <div style="background:#004D2E;color:#fff;border-radius:14px 14px 0 0;padding:18px 22px">
    <div style="font-size:11px;letter-spacing:.2em;font-weight:800;color:#f3c9cd">GREEN HOPE LACROSSE · FILM ROOM</div>
    <div style="font-size:20px;font-weight:900;margin-top:6px">${esc(a.coachName)} sent you a clip</div>
  </div>
  <div style="background:#fff;border:1px solid #e3e6e3;border-top:0;border-radius:0 0 14px 14px;padding:22px">
    <div style="font-size:18px;font-weight:800">${esc(a.clipName)}</div>
    ${a.notes ? `<p style="margin:12px 0 0;line-height:1.55;white-space:pre-wrap">${esc(a.notes)}</p>` : ''}
    ${a.prompt ? `<div style="margin-top:14px;padding:12px 14px;border-left:4px solid #228b22;background:#eef6ee;border-radius:8px;font-weight:700">${esc(a.coachName)} asks: ${esc(a.prompt)}</div>` : ''}
    <a href="${link}" style="display:inline-block;margin-top:20px;background:#0e7a50;color:#fff;text-decoration:none;font-weight:800;padding:12px 22px;border-radius:10px">▶ Watch it</a>
    <p style="margin:16px 0 0;font-size:12px;color:#6b7280">It's waiting in your Film Room${a.prompt ? ' — answer right under the video' : ''}.</p>
  </div>
</div></body></html>`
}

/**
 * Email everyone newly reached by a clip. `kept` is who already had it before
 * this send, so they aren't emailed again. Returns how many were emailed.
 * Never throws: the clip is sent either way.
 */
export async function emailClipSent(a: {
  added: Share[]
  kept: Share[]
  sender: { email: string; name: string }
  clipName: string
  notes: string | null
  prompt: string | null
}): Promise<number> {
  try {
    if (!a.added.length) return 0
    const [now, before] = await Promise.all([
      mailboxesFor([...a.added, ...a.kept], a.sender.email),
      mailboxesFor(a.kept, a.sender.email),
    ])
    const fresh = [...now.entries()].filter(([k]) => !before.has(k)).map(([, m]) => m)
    if (!fresh.length) return 0
    const coachName = /^coach\b/i.test(a.sender.name) ? a.sender.name : `Coach ${a.sender.name}`
    const subject = `${coachName} sent you a clip: ${a.clipName}`
    let sent = 0
    for (const kind of ['coach', 'player', 'parent'] as ViewerKind[]) {
      const emails = [...new Set(fresh.filter((m) => m.kind === kind).map((m) => m.email.toLowerCase()))]
      // Resend takes 50 addresses a message; stay well under.
      for (let i = 0; i < emails.length; i += 40) {
        const bcc = emails.slice(i, i + 40)
        if (await sendEmail({ bcc, subject, html: html(kind, { coachName, clipName: a.clipName, notes: a.notes, prompt: a.prompt }) }))
          sent += bcc.length
      }
    }
    return sent
  } catch (err) {
    console.error('[clipEmail] failed:', err)
    return 0
  }
}
