import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSection } from '@/lib/permissions'
import { createServiceClient } from '@/lib/supabase-server'
import { latestDrillSet } from '@/lib/drillSets'
import { listAssignments, equipmentReady } from '@/lib/equipment'
import { categoriesFor, readRating, ratingsAverage, tierFor, type Evaluation } from '@/lib/evaluations'
import { withTeam } from '@/lib/teams'
import { POSITION_LABELS, positionGroup } from '@/lib/positions'
import { TEAM_LABELS, type Player } from '@/lib/types'
import { formatShortDate } from '@/lib/format'
import { returnEquipment, savePlayerBasics, savePlayerContact } from '@/lib/actions'
import { ImageField } from '@/components/admin/ImageField'
import { contactsReady, firstCall, getContact, PREFERRED_OPTIONS } from '@/lib/playerContacts'
import { listHubAccounts } from '@/lib/hubAccounts'
import { PARENT_QUESTIONS, PLAYER_FAVORITES, PLAYER_GOALS, type Answers, type HubQuestion } from '@/lib/hubQuestions'
import { drillCategoryLabel } from '@/lib/prescribe'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data } = await createServiceClient().from('players').select('name').eq('id', id).maybeSingle()
  return { title: (data as { name?: string } | null)?.name ?? 'Player' }
}

const FOCUS_KIND = { fix: 'Work on this first', sharpen: 'Sharpen this', keep: 'Strength — keep it' } as const

/**
 * One player, everything the coaches know about him — laid out the way the
 * Team 91 Power Bank's staff player page is: who he is across the top with
 * everything you'd do to him as buttons, then his evaluation, his drill set
 * and his family each as a section that opens and closes, so a coach reaches
 * the one he came for without scrolling past the others.
 *
 * Coach-only. His own page at /team/me shows him his evaluation and drill set.
 */
export default async function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireSection('hub')
  const { id } = await params

  const svc = createServiceClient()
  const [{ data: playerRow }, { data: evalRows }] = await Promise.all([
    svc.from('players').select('*').eq('id', id).maybeSingle(),
    svc.from('evaluations').select('*').eq('player_id', id).order('updated_at', { ascending: false }),
  ])
  const player = playerRow as Player | null
  if (!player) notFound()

  const evals = (evalRows ?? []) as Evaluation[]
  const [set, hasEquipment, hasContacts, accounts] = await Promise.all([
    latestDrillSet(id),
    equipmentReady(),
    contactsReady(),
    listHubAccounts(),
  ])
  const kit = hasEquipment ? await listAssignments({ playerId: id, includeReturned: true }) : []
  const contact = hasContacts ? await getContact(id) : null
  const call = firstCall(contact)
  const out = kit.filter((k) => !k.returned_at)
  const returned = kit.filter((k) => k.returned_at)

  // Who signed up for him: his own Team Hub account, and every parent who named him.
  const own = (accounts ?? []).find((a) => a.kind === 'player' && a.playerId === id) ?? null
  const parents = (accounts ?? []).filter((a) => a.kind === 'parent' && a.playerIds.includes(id))


  const latest = evals[0] ?? null
  const position = positionGroup(latest?.position ?? player.position)
  const categories = categoriesFor(latest?.position ?? player.position)

  // One picture from however many coaches have filed one.
  const overall = evals.map((e) => e.overall).filter((n): n is number => typeof n === 'number')
  const overallAvg = overall.length ? Math.round(overall.reduce((a, b) => a + b, 0) / overall.length) : null

  // The latest evaluation's own ratings, skill by skill, grouped as the sheet groups them.
  const bars = (e: Evaluation) =>
    categories
      .map((c) => ({ ...c, score: readRating(e.ratings?.[c.key])?.score ?? null }))
      .filter((c): c is typeof c & { score: number } => typeof c.score === 'number')
  const latestBars = latest ? bars(latest) : []
  const sections = [...new Set(latestBars.map((b) => b.section))]

  // Everyone the staff might need to reach, from the coaches' own record and from the Parent Hub.
  type Person = { name: string; role: string; phone?: string | null; email?: string | null; emergency?: boolean; source: string }
  const people: Person[] = []
  if (contact?.guardian_name || contact?.guardian_phone || contact?.guardian_email)
    people.push({ name: contact.guardian_name || 'Guardian', role: 'Guardian', phone: contact.guardian_phone, email: contact.guardian_email, source: 'Coaches' })
  if (contact?.guardian2_name || contact?.guardian2_phone || contact?.guardian2_email)
    people.push({ name: contact.guardian2_name || 'Second guardian', role: 'Guardian', phone: contact.guardian2_phone, email: contact.guardian2_email, source: 'Coaches' })
  if (contact?.emergency_name || contact?.emergency_phone)
    people.push({ name: contact.emergency_name || 'Emergency contact', role: contact.emergency_relation || 'Emergency', phone: contact.emergency_phone, emergency: true, source: 'Coaches' })
  for (const a of parents) {
    const c = a.contacts
    people.push({ name: a.name, role: c.relationship || 'Parent', phone: a.phone, email: a.email, source: 'Parent Hub' })
    if (c.guardian2_name || c.guardian2_phone || c.guardian2_email)
      people.push({ name: c.guardian2_name || 'Second guardian', role: c.guardian2_relationship || 'Guardian', phone: c.guardian2_phone, email: c.guardian2_email, source: 'Parent Hub' })
    if (c.emergency_name || c.emergency_phone)
      people.push({ name: c.emergency_name || 'Emergency contact', role: c.emergency_relation || 'Emergency', phone: c.emergency_phone, emergency: true, source: 'Parent Hub' })
  }
  // The same person from both places once, not twice.
  const seen = new Set<string>()
  const family = people.filter((p) => {
    const k = `${p.name.toLowerCase()}|${(p.phone ?? '').replace(/\D/g, '')}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  const playerReach = [contact?.player_phone || own?.phone, contact?.player_email || own?.email].filter(Boolean) as string[]

  const evalPill = latest
    ? `${latest.overall ?? ratingsAverage(latest.ratings) ?? '—'} · ${latest.evaluator_name || latest.evaluator_email} · ${formatShortDate(latest.updated_at)}`
    : 'None yet'

  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/admin/hub/players" className="text-sm font-bold text-[var(--gh-green)]">← All players</Link>

      {/* ── Who he is, and everything you'd do to him ── */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-4">
          {player.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={player.photo_url}
              alt={player.name}
              className="shrink-0 w-16 h-16 rounded-full object-cover border border-gray-200"
            />
          ) : (
            <span
              className="shrink-0 w-16 h-16 rounded-full flex items-center justify-center font-black text-white text-xl"
              style={{ background: 'var(--gh-green)' }}
            >
              {player.number ?? '–'}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-black leading-tight">{player.name}</h1>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <span className="badge" style={{ background: '#fde8ea', color: 'var(--gh-maroon)' }}>
                {TEAM_LABELS[player.team] ?? player.team}
              </span>
              <span className="badge badge-sched">{POSITION_LABELS[position]}</span>
              {player.number && <span className="badge badge-sched">#{player.number}</span>}
              {player.class_year && <span className="badge badge-sched">Class of {player.class_year}</span>}
              {player.height && <span className="badge badge-sched">{player.height}</span>}
            </div>
          </div>
          {overallAvg !== null && (
            <div className="text-center">
              <div className="text-3xl font-black" style={{ color: tierFor(overallAvg).color }}>{overallAvg}</div>
              <div className="text-[0.65rem] font-bold uppercase tracking-wide text-gray-400">
                {tierFor(overallAvg).label}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <Link href={`/admin/hub/evaluate/${player.id}`} className="btn btn-primary !py-1.5 text-sm">Evaluation</Link>
          <a href={`/admin/player-print/${player.id}?part=eval`} target="_blank" className="btn btn-ghost !py-1.5 text-sm">Print eval</a>
          <a href={`/admin/player-print/${player.id}?part=set`} target="_blank" className="btn btn-ghost !py-1.5 text-sm">Print drill set</a>
          <a href="#details" className="btn btn-ghost !py-1.5 text-sm">Edit details</a>
          <Link href={`/admin/hub/players/${player.id}/view`} className="btn btn-ghost !py-1.5 text-sm">His view</Link>
        </div>
      </div>

      {call && (
        <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: '#F3C9CD', background: '#FDF3F4' }}>
          <span className="font-bold" style={{ color: 'var(--gh-maroon)' }}>Call first:</span>{' '}
          {call.name ? `${call.name} (${call.who})` : call.who} —{' '}
          <a href={`tel:${call.phone.replace(/[^\d+]/g, '')}`} className="font-bold underline">
            {call.phone}
          </a>
        </div>
      )}

      {/* ── In his own words ── */}
      {own && (
        <Tile title="In His Own Words" pill={`Signed up ${formatShortDate(own.createdAt)}`}>
          <AnswerList questions={[...PLAYER_GOALS, ...PLAYER_FAVORITES]} answers={own.answers} />
          {own.conductAgreedAt && (
            <p className="text-xs text-gray-400 mt-3">
              Code of conduct signed by {own.conductSignedName} · {formatShortDate(own.conductAgreedAt)}
            </p>
          )}
        </Tile>
      )}

      {/* ── Latest coach evaluation ── */}
      <Tile title="Latest Coach Evaluation" pill={evalPill} gold={!!latest} open>
        {!latest ? (
          <p className="text-sm text-gray-500">
            Nobody has evaluated him yet.{' '}
            <Link href={`/admin/hub/evaluate/${player.id}`} className="font-bold text-[var(--gh-green)]">Evaluate him →</Link>
          </p>
        ) : (
          <>
            <div className="text-sm space-y-1 mb-4">
              {latest.playing_time && <p><span className="text-gray-400">Playing time:</span> <b>{latest.playing_time}</b></p>}
              {latest.strengths && <p><span className="text-gray-400">Strengths:</span> {latest.strengths}</p>}
              {latest.areas_to_improve && <p><span className="text-gray-400">Work on:</span> {latest.areas_to_improve}</p>}
              {latest.notes && <p className="text-gray-600 whitespace-pre-wrap">{latest.notes}</p>}
            </div>
            <div className="space-y-4">
              {sections.map((section) => (
                <div key={section}>
                  <div className="text-[0.65rem] font-black uppercase tracking-[0.15em] text-gray-400 mb-1.5">{section}</div>
                  <div className="space-y-2">
                    {latestBars
                      .filter((b) => b.section === section)
                      .map((b) => (
                        <div key={b.key}>
                          <div className="flex justify-between gap-2 text-sm">
                            <span className="truncate">{b.label}</span>
                            <span className="text-gray-500 tabular-nums shrink-0">
                              {b.score} · {tierFor(b.score).label}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-100 border border-gray-200 overflow-hidden mt-0.5">
                            <div className="h-full rounded-full" style={{ width: `${b.score}%`, background: tierFor(b.score).color }} />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
            {evals.length > 1 && (
              <details className="mt-5 border-t border-gray-100 pt-3">
                <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.15em] text-gray-400">
                  Earlier evaluations ({evals.length - 1})
                </summary>
                <div className="space-y-2 mt-2">
                  {evals.slice(1).map((e) => (
                    <details key={e.id} className="rounded-lg border border-gray-200 px-3 py-2">
                      <summary className="cursor-pointer text-sm font-semibold flex items-center gap-2">
                        {e.evaluator_name || e.evaluator_email}
                        <span className="text-xs font-normal text-gray-400">{e.updated_at ? formatShortDate(e.updated_at) : ''}</span>
                        <span className="ml-auto font-black" style={{ color: 'var(--gh-green)' }}>
                          {e.overall ?? ratingsAverage(e.ratings) ?? '—'}
                        </span>
                      </summary>
                      <div className="mt-2 text-sm space-y-1">
                        {e.playing_time && <p><span className="text-gray-400">Playing time:</span> <b>{e.playing_time}</b></p>}
                        {e.strengths && <p><span className="text-gray-400">Strengths:</span> {e.strengths}</p>}
                        {e.areas_to_improve && <p><span className="text-gray-400">Work on:</span> {e.areas_to_improve}</p>}
                        {e.notes && <p className="text-gray-600">{e.notes}</p>}
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </Tile>

      {/* ── Drill set ── */}
      <Tile title="Drill Set" pill={set ? `${set.items.length} drills · ${formatShortDate(set.createdAt)}` : 'None yet'} open>
        {!set ? (
          <p className="text-sm text-gray-500">
            No drill set yet. Once he has an evaluation,{' '}
            <Link href="/admin/hub/players" className="font-bold text-[var(--gh-green)]">generate one from the players list →</Link>
          </p>
        ) : (
          <div className="space-y-4">
            {set.focus.map((f) => {
              const items = set.items.filter((i) => i.focusKey === f.key)
              if (!items.length) return null
              return (
                <div key={f.key}>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <h3 className="font-bold">{f.label}</h3>
                    <span className="text-xs font-bold" style={{ color: f.kind === 'keep' ? 'var(--gh-green)' : 'var(--gh-maroon)' }}>
                      {FOCUS_KIND[f.kind]}
                    </span>
                  </div>
                  <ul className="mt-1.5 divide-y divide-gray-100 rounded-lg border border-gray-200">
                    {items.map((item) => (
                      <li key={item.drillId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                        <span className="font-semibold">{item.name}</span>
                        <span className="text-xs text-gray-400">{drillCategoryLabel(item.category)}</span>
                        <span className="text-xs text-gray-500 ml-auto tabular-nums">{item.repsPerWeek}× a week</span>
                        {item.link && (
                          <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-[var(--gh-green)]">
                            Watch ↗
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
            <p className="text-xs text-gray-400">
              Built {formatShortDate(set.createdAt)}{set.createdBy ? ` by ${set.createdBy}` : ''}.{' '}
              <Link href="/admin/hub/players" className="font-semibold text-[var(--gh-green)]">Regenerate from the players list</Link>
            </p>
          </div>
        )}
      </Tile>

      {/* ── Family & contacts ── */}
      <Tile title="Family & Contacts" pill={family.length + (playerReach.length ? 1 : 0) ? `${family.length + (playerReach.length ? 1 : 0)} on file` : 'None yet'} open={family.length > 0}>
        {family.length === 0 && playerReach.length === 0 ? (
          <p className="text-sm text-gray-500">
            No family contacts yet. Parents add theirs when they sign up for the Parent Hub, or add them below.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {family.map((p, i) => (
              <li key={i} className="py-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <b>{p.name}</b>
                  <span className="badge badge-sched">{p.role}</span>
                  {p.emergency && <span className="badge" style={{ background: '#fde8ea', color: 'var(--gh-maroon)' }}>Emergency</span>}
                  <span className="text-[0.65rem] text-gray-400 ml-auto">{p.source}</span>
                </div>
                <div className="text-sm text-gray-600 mt-0.5 flex flex-wrap gap-x-3">
                  {p.phone && <a href={`tel:${p.phone.replace(/[^\d+]/g, '')}`} className="font-semibold text-[var(--gh-green)]">{p.phone}</a>}
                  {p.email && <a href={`mailto:${p.email}`} className="text-[var(--gh-green)] break-all">{p.email}</a>}
                  {!p.phone && !p.email && <span className="text-gray-400">No details yet</span>}
                </div>
              </li>
            ))}
            {playerReach.length > 0 && (
              <li className="py-2.5">
                <div className="flex items-center gap-1.5"><b>{player.name}</b><span className="badge badge-sched">Player</span></div>
                <div className="text-sm mt-0.5 flex flex-wrap gap-x-3">
                  {playerReach.map((r) =>
                    r.includes('@') ? (
                      <a key={r} href={`mailto:${r}`} className="text-[var(--gh-green)] break-all">{r}</a>
                    ) : (
                      <a key={r} href={`tel:${r.replace(/[^\d+]/g, '')}`} className="font-semibold text-[var(--gh-green)]">{r}</a>
                    ),
                  )}
                </div>
              </li>
            )}
          </ul>
        )}
        {(contact?.notes || parents.some((a) => a.answers.medical || a.contacts.address)) && (
          <div className="mt-3 rounded-lg border px-3 py-2 text-sm space-y-1" style={{ borderColor: '#F3C9CD', background: '#FDF3F4' }}>
            {contact?.notes && <p><span className="font-bold" style={{ color: 'var(--gh-maroon)' }}>Staff note:</span> {contact.notes}</p>}
            {parents.map((a) => (
              <div key={a.id}>
                {a.answers.medical && <p><span className="font-bold" style={{ color: 'var(--gh-maroon)' }}>Medical (from {a.name}):</span> {String(a.answers.medical)}</p>}
                {a.contacts.address && <p><span className="font-bold text-gray-500">Address:</span> {a.contacts.address}</p>}
              </div>
            ))}
          </div>
        )}
        {parents.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.15em] text-gray-400">What the parents told us</summary>
            <div className="mt-2 space-y-3">
              {parents.map((a) => (
                <div key={a.id}>
                  <div className="text-sm font-bold mb-1">{a.name}</div>
                  <AnswerList questions={PARENT_QUESTIONS} answers={a.answers} />
                </div>
              ))}
            </div>
          </details>
        )}
        <details className="mt-3 border-t border-gray-100 pt-3">
          <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.15em] text-gray-400">Edit the coaches&rsquo; contact record</summary>
          <div className="mt-3">
            {!hasContacts ? (
              <p className="text-sm text-gray-500">
                Run <code className="font-mono text-xs">0028_player_contacts.sql</code> in Supabase to start keeping these.
              </p>
            ) : (
          <form action={savePlayerContact} className="space-y-4">
            <input type="hidden" name="id" value={player.id} />

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="field-label">His email</label>
                <input name="player_email" type="email" defaultValue={contact?.player_email ?? ''} className="field" />
              </div>
              <div>
                <label className="field-label">His phone</label>
                <input name="player_phone" type="tel" defaultValue={contact?.player_phone ?? ''} className="field" />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="field-label">Guardian</label>
                <input name="guardian_name" defaultValue={contact?.guardian_name ?? ''} className="field" />
              </div>
              <div>
                <label className="field-label">Email</label>
                <input name="guardian_email" type="email" defaultValue={contact?.guardian_email ?? ''} className="field" />
              </div>
              <div>
                <label className="field-label">Phone</label>
                <input name="guardian_phone" type="tel" defaultValue={contact?.guardian_phone ?? ''} className="field" />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="field-label">Second guardian</label>
                <input name="guardian2_name" defaultValue={contact?.guardian2_name ?? ''} className="field" />
              </div>
              <div>
                <label className="field-label">Email</label>
                <input name="guardian2_email" type="email" defaultValue={contact?.guardian2_email ?? ''} className="field" />
              </div>
              <div>
                <label className="field-label">Phone</label>
                <input name="guardian2_phone" type="tel" defaultValue={contact?.guardian2_phone ?? ''} className="field" />
              </div>
            </div>

            <div className="rounded-lg border border-[#F3C9CD] bg-[#FDF3F4] p-3">
              <div className="section-label mb-2" style={{ color: 'var(--gh-maroon)' }}>
                Emergency
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="field-label">Who</label>
                  <input name="emergency_name" defaultValue={contact?.emergency_name ?? ''} className="field" />
                </div>
                <div>
                  <label className="field-label">Phone</label>
                  <input name="emergency_phone" type="tel" defaultValue={contact?.emergency_phone ?? ''} className="field" />
                </div>
                <div>
                  <label className="field-label">Relation</label>
                  <input name="emergency_relation" defaultValue={contact?.emergency_relation ?? ''} className="field"
                    placeholder="Mother, uncle, neighbour…" />
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="field-label">Call this one first</label>
                <select name="preferred" defaultValue={contact?.preferred ?? 'emergency'} className="field">
                  {PREFERRED_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Anything the staff should know</label>
                <input name="notes" defaultValue={contact?.notes ?? ''} className="field"
                  placeholder="Allergies, asthma inhaler, rides home with…" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button type="submit" className="btn btn-primary">Save contacts</button>
              {contact?.updated_at && (
                <span className="text-xs text-gray-400">
                  Last changed {formatShortDate(contact.updated_at)}
                  {contact.updated_by ? ` by ${contact.updated_by}` : ''}
                </span>
              )}
            </div>
          </form>
            )}
          </div>
        </details>
      </Tile>

      {/* ── Equipment ── */}
      <Tile title="Equipment" pill={out.length ? `${out.length} out` : 'Nothing out'}>
        <div className="flex justify-end mb-2">
          {/* His own team's shed, not whichever one you were last on. */}
          <Link
            href={withTeam('/admin/inventory', player.team === 'boys_jv' ? 'jv' : 'varsity')}
            className="text-sm font-semibold text-[var(--gh-green)]"
          >
            Sign something out →
          </Link>
        </div>
        {!hasEquipment ? (
          <p className="text-sm text-gray-500">
            Run <code className="font-mono text-xs">0025_equipment_signout.sql</code> in Supabase to
            start signing gear out to players.
          </p>
        ) : out.length === 0 ? (
          <p className="text-sm text-gray-500">He has nothing of ours.</p>
        ) : (
          <ul className="space-y-2">
            {out.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">
                  {k.quantity > 1 ? `${k.quantity}× ` : ''}{k.item_name}
                </span>
                {k.size && <span className="text-xs text-gray-400">size {k.size}</span>}
                <span className="text-xs text-gray-400">out {formatShortDate(k.out_at)}</span>
                {k.due_at && (
                  <span className="text-xs font-bold" style={{ color: 'var(--gh-maroon)' }}>
                    due {formatShortDate(k.due_at)}
                  </span>
                )}
                <form action={returnEquipment} className="ml-auto">
                  <input type="hidden" name="id" value={k.id} />
                  <input type="hidden" name="player_id" value={player.id} />
                  <button type="submit" className="text-xs font-bold text-[var(--gh-green)]">
                    Returned
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {returned.length > 0 && (
          <details className="mt-3">
            <summary className="text-xs text-gray-400 cursor-pointer">
              {returned.length} returned earlier
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-gray-500">
              {returned.map((k) => (
                <li key={k.id}>
                  {k.item_name} — back {formatShortDate(k.returned_at!)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Tile>

      {/* ── Photo & roster details ── */}
      <Tile id="details" title="Player Details" pill="Shown on the public roster">
        <form action={savePlayerBasics} className="space-y-4">
          <input type="hidden" name="id" value={player.id} />
          <ImageField name="photo_url" defaultValue={player.photo_url} folder="players" label="Photo" />
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="field-label">Number</label>
              <input name="number" defaultValue={player.number ?? ''} className="field" />
            </div>
            <div>
              <label className="field-label">Position</label>
              <input name="position" defaultValue={player.position ?? ''} className="field"
                placeholder="Attack, Midfield, LSM, Goalie…" />
            </div>
            <div>
              <label className="field-label">Class year</label>
              <input name="class_year" defaultValue={player.class_year ?? ''} className="field" placeholder="2028" />
            </div>
            <div>
              <label className="field-label">Height</label>
              <input name="height" defaultValue={player.height ?? ''} className="field" placeholder="6'0&quot;" />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label">Hometown</label>
              <input name="hometown" defaultValue={player.hometown ?? ''} className="field" />
            </div>
          </div>
          <button type="submit" className="btn btn-primary">Save details</button>
        </form>
      </Tile>

      {/* ── Who has joined: he and his parents get in with the team's join code. ── */}
      <Tile title="Team Hub & Parent Hub" pill={own ? 'Joined' : 'Not joined yet'}>
        <ul className="text-sm space-y-1.5">
          <li>
            <b>{player.name}</b> —{' '}
            {own ? (
              <>
                joined {formatShortDate(own.createdAt)} as <span className="break-all">{own.email}</span>
                {own.lastSeenAt ? ` · last in ${formatShortDate(own.lastSeenAt)}` : ''}
              </>
            ) : (
              <span className="text-gray-500">hasn&rsquo;t joined the Team Hub yet</span>
            )}
          </li>
          {parents.map((a) => (
            <li key={a.id}>
              <b>{a.name}</b> — joined the Parent Hub {formatShortDate(a.createdAt)}
            </li>
          ))}
          {parents.length === 0 && <li className="text-gray-500">No parent has joined the Parent Hub for him yet.</li>}
        </ul>
        <p className="text-xs text-gray-400 mt-3">
          Players and parents join with the team&rsquo;s join code — set on{' '}
          <Link href="/admin/team" className="font-semibold text-[var(--gh-green)]">Team Hub</Link>.
        </p>
      </Tile>
    </div>
  )
}

/** A section of the page that opens and closes; the heading is the control. */
function Tile({
  id,
  title,
  pill,
  gold,
  open,
  children,
}: {
  id?: string
  title: string
  pill?: string
  gold?: boolean
  open?: boolean
  children: React.ReactNode
}) {
  return (
    <section id={id} className="card scroll-mt-24 overflow-hidden">
      <details open={open} className="group/tile">
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden flex flex-wrap items-center gap-2 px-5 py-4 hover:bg-gray-50">
          <h2 className="font-black text-gray-800">{title}</h2>
          {pill && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={gold ? { background: '#F7E4E7', color: 'var(--gh-maroon)' } : { background: 'var(--color-gray-100, #f3f4f6)', color: 'var(--color-gray-600, #4b5563)' }}
            >
              {pill}
            </span>
          )}
          <span aria-hidden className="ml-auto text-xl leading-none text-gray-400 transition-transform group-open/tile:rotate-90">›</span>
        </summary>
        <div className="px-5 pb-5">{children}</div>
      </details>
    </section>
  )
}

/** The answers someone gave at sign-up, question by question; blanks left out. */
function AnswerList({ questions, answers }: { questions: HubQuestion[]; answers: Answers }) {
  const given = questions
    .map((q) => ({ q, a: answers[q.key] }))
    .filter(({ a }) => (Array.isArray(a) ? a.length > 0 : !!a && String(a).trim()))
  if (!given.length) return <p className="text-sm text-gray-400">Nothing filled in.</p>
  return (
    <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
      {given.map(({ q, a }) => (
        <div key={q.key} className={q.kind === 'long' ? 'sm:col-span-2' : ''}>
          <dt className="text-xs text-gray-400">{q.label}</dt>
          <dd className="whitespace-pre-wrap">{Array.isArray(a) ? a.join(', ') : a}</dd>
        </div>
      ))}
    </dl>
  )
}
