import Link from 'next/link'
import { getCurrentCoach } from '@/lib/coach'
import { createServiceClient } from '@/lib/supabase-server'
import { getViewer, canSee } from '@/lib/permissions'
import { readModesOff } from '@/lib/hubSettings'
import { HUB_MODES, isModeOn } from '@/lib/hubModes'
import { saveHubModes } from '@/lib/actions'
import { listPlans, plannerReady } from '@/lib/plans'
import { getGames } from '@/lib/queries'
import { formatMinutes, runningClock, tagFor, totalMinutes, clockAt } from '@/lib/planner'
import { quoteOfTheDay } from '@/lib/warRoom'
import { formatDate, formatShortDate, formatTime, TEAM_TIME_ZONE } from '@/lib/format'
import { WarRoomPanels, type Panel } from './WarRoomPanels'

export const metadata = { title: 'War Room' }
export const dynamic = 'force-dynamic'

/** Today where the team is, not where the server is. */
function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TEAM_TIME_ZONE }).format(new Date())
}

export default async function WarRoom() {
  const coach = await getCurrentCoach()
  const viewer = await getViewer()
  const isOwner = viewer?.isOwner ?? false
  const isHead = coach?.role === 'head' || isOwner
  const modesOff = await readModesOff()
  const today = todayIso()

  const svc = createServiceClient()
  const { error: evalError } = await svc.from('evaluations').select('id').limit(1)

  const hasPlanner = await plannerReady()
  const plans = hasPlanner ? await listPlans() : []
  const todaysPlan = plans.find((p) => p.kind === 'practice' && p.plan_date === today)
  const nextPractice = plans.find((p) => p.kind === 'practice' && p.plan_date && p.plan_date > today)
  const gamePlans = plans.filter((p) => p.kind === 'game').slice(0, 3)

  const games = await getGames(undefined, 'admin')
  const upcoming = games
    .filter((g) => g.game_date >= today && g.status !== 'final')
    .slice(0, 4)
  const gamesToday = games.filter((g) => g.game_date.slice(0, 10) === today)

  const quote = quoteOfTheDay(today)

  const planPanel = (title: string, plan: typeof todaysPlan) => {
    if (!plan) {
      return (
        <p className="text-sm text-gray-500">
          Nothing yet.{' '}
          <Link href="/admin/planner" className="font-semibold text-[var(--gh-green)]">Write one →</Link>
        </p>
      )
    }
    const clock = runningClock(plan.blocks)
    return (
      <div>
        <Link href={`/admin/planner/${plan.id}`} className="font-bold hover:underline">{plan.title}</Link>
        <div className="text-xs text-gray-500 mb-2">
          {formatMinutes(totalMinutes(plan.blocks))} · {plan.blocks.length} blocks
          {plan.plan_date && title !== 'Today’s plan' ? ` · ${formatShortDate(plan.plan_date)}` : ''}
        </div>
        <ol className="space-y-1">
          {plan.blocks.slice(0, 8).map((b, i) => (
            <li key={b.id} className="flex items-center gap-2 text-sm">
              <span className="w-14 shrink-0 text-xs font-black tabular-nums" style={{ color: tagFor(b.tag).color }}>
                {clockAt('16:00', clock[i])}
              </span>
              <span className="truncate flex-1">{b.title || 'Untitled'}</span>
              <span className="text-xs text-gray-400 tabular-nums shrink-0">{b.minutes}m</span>
            </li>
          ))}
        </ol>
        {plan.blocks.length > 8 && (
          <p className="text-xs text-gray-400 mt-1">+{plan.blocks.length - 8} more</p>
        )}
      </div>
    )
  }

  const panels: Panel[] = [
    {
      key: 'today',
      title: gamesToday.length ? 'Today — game day' : 'Today’s plan',
      body: planPanel('Today’s plan', todaysPlan ?? undefined),
    },
    {
      key: 'schedule',
      title: 'Next up',
      body:
        upcoming.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing on the schedule.</p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((g) => (
              <li key={g.id} className="text-sm">
                <div className="font-semibold">
                  {g.home_away === 'away' ? '@' : 'vs'} {g.opponent}
                  {g.audience && g.audience !== 'public' && (
                    <span className="ml-2 text-[0.65rem] font-bold uppercase text-gray-400">
                      {g.audience === 'team' ? 'team only' : 'coaches only'}
                    </span>
                  )}
                </div>
                <div className="text-gray-500 text-xs">
                  {formatDate(g.game_date)} · {formatTime(g.game_date)}
                  {g.location ? ` · ${g.location}` : ''}
                </div>
              </li>
            ))}
          </ul>
        ),
    },
    {
      key: 'next-practice',
      title: 'Next practice',
      body: planPanel('Next practice', nextPractice ?? undefined),
    },
    {
      key: 'gameplans',
      title: 'Game plans',
      body:
        gamePlans.length === 0 ? (
          <p className="text-sm text-gray-500">
            None written.{' '}
            <Link href="/admin/planner" className="font-semibold text-[var(--gh-green)]">Start one →</Link>
          </p>
        ) : (
          <ul className="space-y-1">
            {gamePlans.map((p) => (
              <li key={p.id} className="text-sm">
                <Link href={`/admin/planner/${p.id}`} className="font-semibold hover:underline">{p.title}</Link>
                <span className="text-xs text-gray-400 ml-2">
                  {p.plan_date ? formatShortDate(p.plan_date) : 'no date'}
                </span>
              </li>
            ))}
          </ul>
        ),
    },
    {
      key: 'coaching',
      title: 'Coaching',
      body: (
        <ul className="space-y-1.5 text-sm">
          <li><Link href="/admin/hub/evaluate" className="font-semibold hover:underline">📝 Evaluate a player</Link></li>
          <li><Link href="/admin/hub/mine" className="font-semibold hover:underline">📋 My evaluations</Link></li>
          {isHead && <li><Link href="/admin/hub/board" className="font-semibold hover:underline">📊 Team evaluation board</Link></li>}
          {canSee(viewer, 'drills') && <li><Link href="/admin/drills" className="font-semibold hover:underline">📓 Drill bank</Link></li>}
          {canSee(viewer, 'rosters') && <li><Link href="/admin/rosters" className="font-semibold hover:underline">🥍 Rosters</Link></li>}
          {isOwner && <li><Link href="/admin/access" className="font-semibold hover:underline">👥 Coach access</Link></li>}
        </ul>
      ),
    },
    {
      key: 'wall',
      title: 'On the wall',
      body: (
        <blockquote>
          <p className="text-base font-semibold leading-snug">&ldquo;{quote.line}&rdquo;</p>
          {quote.who && <footer className="text-xs text-gray-500 mt-1">— {quote.who}</footer>}
        </blockquote>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <h1 className="text-xl font-black">War Room</h1>
        {coach && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: '#fde8ea', color: 'var(--gh-maroon)' }}
          >
            {coach.role === 'head' ? '★ Head Coach' : 'Coach'} · {coach.name}
          </span>
        )}
      </div>
      <p className="text-gray-500 text-sm mb-4">
        {formatDate(`${today}T12:00:00`, { weekday: 'long', year: 'numeric' })} — the day in one screen.
        Drag a panel by its grip to put it where you want it.
      </p>

      {evalError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-4">
          <p className="text-sm text-amber-900 font-bold mb-1">Evaluations aren&rsquo;t switched on yet.</p>
          <p className="text-sm text-amber-900">
            Run <code>supabase/migrations/0009_coaches_hub.sql</code> in the Supabase SQL editor to
            turn them on. Nothing else is affected.
          </p>
        </div>
      )}
      {!hasPlanner && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-4">
          <p className="text-sm text-amber-900 font-bold mb-1">The planner isn&rsquo;t switched on yet.</p>
          <p className="text-sm text-amber-900">
            Run <code>supabase/migrations/0017_planner.sql</code> and{' '}
            <code>0018_drills.sql</code> to fill these panels.
          </p>
        </div>
      )}

      <WarRoomPanels panels={panels} />

      {isOwner && (
        <details className="card p-4 mt-6">
          <summary className="cursor-pointer list-none font-bold text-gray-700 flex items-center gap-2">
            <span className="caret text-sm">▸</span> Modes in the hub
            <span className="font-normal text-xs text-gray-400">head coach only</span>
          </summary>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500 mb-3">
              What the sidebar carries for your staff. Switching a mode off hides it for everyone — a
              coach still only sees the ones their own access allows, and each coach can drag theirs
              into whatever order they like.
            </p>
            <form action={saveHubModes} className="space-y-2">
              <div className="divide-y border rounded-lg" style={{ borderColor: '#e5e7eb' }}>
                {HUB_MODES.map((m) => (
                  <label key={m.key} className="flex items-center gap-3 p-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name={`mode:${m.key}`}
                      defaultChecked={isModeOn(modesOff, m.key)}
                      disabled={m.fixed}
                      className="w-4 h-4 accent-[var(--gh-green)]"
                    />
                    <span aria-hidden>{m.icon}</span>
                    <span className="font-semibold text-sm">{m.label}</span>
                    {m.fixed && <span className="text-xs text-gray-400">always on</span>}
                  </label>
                ))}
              </div>
              <button type="submit" className="btn btn-primary">Save modes</button>
            </form>
          </div>
        </details>
      )}
    </div>
  )
}
