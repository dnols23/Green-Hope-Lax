import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSection } from '@/lib/permissions'
import { createServiceClient } from '@/lib/supabase-server'
import { latestDrillSet } from '@/lib/drillSets'
import { listAssignments, equipmentReady } from '@/lib/equipment'
import { listPlayerAccess } from '@/lib/playerAccess'
import { categoriesFor, readRating, ratingsAverage, tierFor, type Evaluation } from '@/lib/evaluations'
import { POSITION_LABELS, positionGroup } from '@/lib/positions'
import { TEAM_LABELS, type Player } from '@/lib/types'
import { formatShortDate } from '@/lib/format'
import { createPlayerInvite, returnEquipment, revokePlayerInvite } from '@/lib/actions'
import { InviteLink } from '../InviteLink'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data } = await createServiceClient().from('players').select('name').eq('id', id).maybeSingle()
  return { title: (data as { name?: string } | null)?.name ?? 'Player' }
}

/**
 * One player, everything the coaches know about him.
 *
 * Coach-only — a player's own page at /team/me shows him his evaluation and his
 * drill set; this shows the staff all of it at once, including the parts he
 * never sees.
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
  const [set, access, hasEquipment] = await Promise.all([
    latestDrillSet(id),
    listPlayerAccess(),
    equipmentReady(),
  ])
  const kit = hasEquipment ? await listAssignments({ playerId: id, includeReturned: true }) : []
  const out = kit.filter((k) => !k.returned_at)
  const returned = kit.filter((k) => k.returned_at)

  const token = access[player.id] ?? null
  const live = !!token && !token.revokedAt
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://greenhopelacrosse.com'

  const position = positionGroup(evals[0]?.position ?? player.position)
  const categories = categoriesFor(evals[0]?.position ?? player.position)

  // One picture from however many coaches have filed one.
  const overall = evals.map((e) => e.overall).filter((n): n is number => typeof n === 'number')
  const overallAvg = overall.length ? Math.round(overall.reduce((a, b) => a + b, 0) / overall.length) : null

  const skills = categories
    .map((c) => {
      const scores = evals
        .map((e) => readRating(e.ratings?.[c.key])?.score)
        .filter((v): v is number => typeof v === 'number')
      return {
        ...c,
        average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      }
    })
    .filter((s) => s.average !== null)

  const strongest = [...skills].sort((a, b) => (b.average ?? 0) - (a.average ?? 0)).slice(0, 3)
  const weakest = [...skills].sort((a, b) => (a.average ?? 0) - (b.average ?? 0)).slice(0, 3)

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/admin/hub/players" className="text-sm font-bold text-[var(--gh-green)]">← All players</Link>

      {/* ── Who he is ── */}
      <div className="card p-5 flex flex-wrap items-center gap-4">
        <span
          className="shrink-0 w-14 h-14 rounded-full flex items-center justify-center font-black text-white text-lg"
          style={{ background: 'var(--gh-green)' }}
        >
          {player.number ?? '–'}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black leading-tight">{player.name}</h1>
          <p className="text-sm text-gray-500">
            {[
              POSITION_LABELS[position],
              player.class_year && `Class of ${player.class_year}`,
              TEAM_LABELS[player.team] ?? player.team,
              player.height,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        {overallAvg !== null && (
          <div className="text-center">
            <div className="text-3xl font-black" style={{ color: tierFor(overallAvg).color }}>{overallAvg}</div>
            <div className="text-[0.65rem] font-bold uppercase tracking-wide text-gray-400">
              Overall · {evals.length} eval{evals.length === 1 ? '' : 's'}
            </div>
          </div>
        )}
      </div>

      {/* ── Evaluations ── */}
      <section className="card p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-bold text-gray-700">Evaluations</h2>
          <Link href={`/admin/hub/evaluate/${player.id}`} className="btn btn-ghost !py-1.5 text-sm">
            Evaluate him
          </Link>
        </div>

        {evals.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nobody has evaluated him yet. Everything else on this page starts there.
          </p>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <div className="section-label mb-1">Strongest</div>
                <ul className="text-sm space-y-0.5">
                  {strongest.map((s) => (
                    <li key={s.key} className="flex justify-between gap-2">
                      <span className="text-gray-600 truncate">{s.label}</span>
                      <span className="font-bold tabular-nums">{s.average}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="section-label mb-1">Needs work</div>
                <ul className="text-sm space-y-0.5">
                  {weakest.map((s) => (
                    <li key={s.key} className="flex justify-between gap-2">
                      <span className="text-gray-600 truncate">{s.label}</span>
                      <span className="font-bold tabular-nums" style={{ color: 'var(--gh-maroon)' }}>{s.average}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-2">
              {evals.map((e) => (
                <details key={e.id} className="rounded-lg border border-gray-200 px-3 py-2">
                  <summary className="cursor-pointer text-sm font-semibold flex items-center gap-2">
                    {e.evaluator_name || e.evaluator_email}
                    <span className="text-xs font-normal text-gray-400">
                      {e.updated_at ? formatShortDate(e.updated_at) : ''}
                    </span>
                    <span className="ml-auto font-black" style={{ color: 'var(--gh-green)' }}>
                      {e.overall ?? ratingsAverage(e.ratings) ?? '—'}
                    </span>
                  </summary>
                  <div className="mt-2 text-sm space-y-1">
                    {e.playing_time && (
                      <p><span className="text-gray-400">Playing time:</span> <b>{e.playing_time}</b></p>
                    )}
                    {e.strengths && <p><span className="text-gray-400">Strengths:</span> {e.strengths}</p>}
                    {e.areas_to_improve && <p><span className="text-gray-400">Improve:</span> {e.areas_to_improve}</p>}
                    {e.notes && <p className="text-gray-600">{e.notes}</p>}
                  </div>
                </details>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ── Drill set ── */}
      <section className="card p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-bold text-gray-700">Drill set</h2>
          <Link href="/admin/hub/players" className="text-sm font-semibold text-[var(--gh-green)]">
            Generate from the players list →
          </Link>
        </div>
        {!set ? (
          <p className="text-sm text-gray-500">
            No drill set yet. Once he has an evaluation, generate one and it appears here and on
            his own page.
          </p>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-2">
              {set.items.length} drills · built {formatShortDate(set.createdAt)}
              {set.createdBy ? ` by ${set.createdBy}` : ''}
            </p>
            <ul className="text-sm space-y-1">
              {set.items.map((item) => (
                <li key={item.drillId} className="flex flex-wrap items-baseline gap-2">
                  <span className="font-semibold">{item.name}</span>
                  <span className="text-xs text-gray-400">{item.focusLabel}</span>
                  <span className="text-xs text-gray-400">· {item.repsPerWeek}× a week</span>
                  {item.link && (
                    <a href={item.link} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-bold" style={{ color: 'var(--gh-green)' }}>
                      video ↗
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* ── Equipment ── */}
      <section className="card p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-bold text-gray-700">Equipment out</h2>
          <Link href="/admin/inventory" className="text-sm font-semibold text-[var(--gh-green)]">
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
      </section>

      {/* ── Stats ── */}
      <section className="card p-5">
        <h2 className="font-bold text-gray-700 mb-1">Stats</h2>
        <p className="text-sm text-gray-500">
          Per-player stats aren&rsquo;t kept yet — the site records program and season records at{' '}
          <Link href="/admin/record-books" className="font-semibold text-[var(--gh-green)]">Record Books</Link>.
          When you want goals, assists, ground balls and save percentage by game, this is where they
          land.
        </p>
      </section>

      {/* ── Analytics ── */}
      <section className="card p-5">
        <h2 className="font-bold text-gray-700 mb-1">Analytics</h2>
        <p className="text-sm text-gray-500">
          Reserved. Once there are stats and more than one evaluation per season, this holds the
          things you can only see over time: which skills moved since the last evaluation, minutes
          against results, shooting by spot on the field.
        </p>
      </section>

      {/* ── His own access ── */}
      <section className="card p-5">
        <div className="flex items-center justify-between gap-3 mb-1">
          <h2 className="font-bold text-gray-700">His link</h2>
          <Link
            href={`/admin/hub/players/${player.id}/view`}
            className="text-sm font-semibold text-[var(--gh-green)]"
          >
            See it as he does →
          </Link>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          One link, his alone. It signs him in to his evaluation, his drill set and the day&rsquo;s
          plan when you publish one — no password for him to lose.
        </p>
        {live ? (
          <div className="flex items-center gap-4">
            <InviteLink url={`${site}/team/join/${token!.token}`} />
            <span className="text-xs text-gray-400">
              {token?.lastSeenAt ? `opened ${formatShortDate(token.lastSeenAt)}` : 'not opened yet'}
            </span>
            <form action={revokePlayerInvite} className="ml-auto">
              <input type="hidden" name="player_id" value={player.id} />
              <button type="submit" className="text-xs font-bold text-gray-400 hover:text-red-700">
                Revoke
              </button>
            </form>
          </div>
        ) : (
          <form action={createPlayerInvite}>
            <input type="hidden" name="player_id" value={player.id} />
            <button type="submit" className="btn btn-ghost !py-1.5 text-sm">
              {token ? 'Make a new link' : 'Make his link'}
            </button>
          </form>
        )}
      </section>
    </div>
  )
}
