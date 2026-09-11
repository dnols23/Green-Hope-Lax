import Link from 'next/link'
import { redirect } from 'next/navigation'
import { currentPlayer } from '@/lib/playerAccess'
import { latestDrillSet } from '@/lib/drillSets'
import { createServiceClient } from '@/lib/supabase-server'
import { EVAL_CATEGORIES, readRating, tierFor, type Evaluation } from '@/lib/evaluations'
import { drillCategoryLabel, positionGroup, POSITION_LABELS } from '@/lib/prescribe'
import { listPlans } from '@/lib/plans'
import { runningClock, tagFor, clockAt, formatMinutes, totalMinutes } from '@/lib/planner'
import { FalconHead } from '@/components/Logo'
import { TEAM_TIME_ZONE } from '@/lib/format'

export const metadata = { title: 'My work', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TEAM_TIME_ZONE }).format(new Date())
}

/**
 * A player's own page: what a coach said, what to work on, and today's plan.
 *
 * Reached by following an invite link, which is also how it knows who is
 * looking. Anyone who got in with the shared team password sees the team feed
 * instead — this page is nobody in particular without a link.
 */
export default async function MyWorkPage() {
  const player = await currentPlayer()
  if (!player) redirect('/team')

  const svc = createServiceClient()
  const [{ data: evalRows }, set, plans] = await Promise.all([
    svc
      .from('evaluations')
      .select('*')
      .eq('player_id', player.id)
      .order('updated_at', { ascending: false }),
    latestDrillSet(player.id),
    listPlans(),
  ])
  const evals = (evalRows ?? []) as Evaluation[]

  // Every coach's rating, averaged per skill — one picture rather than three.
  const skills = EVAL_CATEGORIES.map((c) => {
    const scores = evals
      .map((e) => readRating(e.ratings?.[c.key])?.score)
      .filter((v): v is number => typeof v === 'number' && v > 0)
    const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
    return { ...c, average }
  })
  const rated = skills.filter((s) => s.average !== null)

  const today = todayIso()
  const todaysPlan = plans.find((p) => p.publish_players && p.plan_date === today)

  const byFocus = new Map<string, typeof set extends null ? never : NonNullable<typeof set>['items']>()
  for (const item of set?.items ?? []) {
    if (!byFocus.has(item.focusKey)) byFocus.set(item.focusKey, [])
    byFocus.get(item.focusKey)!.push(item)
  }

  return (
    <>
      <header className="text-white print:hidden" style={{ background: 'var(--gh-green-dk)' }}>
        <div className="max-w-screen-md mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/team" className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center bg-white rounded-lg px-1.5 py-1">
              <FalconHead size={26} />
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-black">My work</span>
              <span className="text-[0.6rem] tracking-widest" style={{ color: '#f3c9cd' }}>
                GREEN HOPE FALCONS
              </span>
            </span>
          </Link>
          <Link href="/team" className="text-xs text-white/70 hover:text-white">Team feed →</Link>
        </div>
      </header>

      <div className="max-w-screen-md mx-auto px-4 py-8 space-y-8">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="page-title mb-1">{player.name}</h1>
            <p className="text-gray-500 text-sm">
              {[player.number ? `#${player.number}` : null, POSITION_LABELS[positionGroup(player.position)], player.class_year]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <a href="/team/me/print" className="btn btn-ghost print:hidden">Print this</a>
        </div>

        {/* ── Today ── */}
        {todaysPlan && (
          <section className="card p-5 print:hidden">
            <div className="section-label">Today</div>
            <h2 className="font-black text-lg mb-1">{todaysPlan.title}</h2>
            <p className="text-sm text-gray-500 mb-3">
              {formatMinutes(totalMinutes(todaysPlan.blocks))}
              {todaysPlan.summary ? ` · ${todaysPlan.summary}` : ''}
            </p>
            <ol className="space-y-1.5">
              {todaysPlan.blocks.map((b, i) => (
                <li key={b.id} className="flex items-center gap-3 text-sm">
                  <span
                    className="w-16 shrink-0 text-xs font-black tabular-nums"
                    style={{ color: tagFor(b.tag).color }}
                  >
                    {clockAt('16:00', runningClock(todaysPlan.blocks)[i])}
                  </span>
                  <span className="flex-1">{b.title || 'Untitled'}</span>
                  <span className="text-xs text-gray-400 tabular-nums">{b.minutes}m</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* ── The drill set ── */}
        <section>
          <div className="section-label">Your work</div>
          <h2 className="page-title mb-4">What to get after</h2>

          {!set ? (
            <div className="card p-6 text-sm text-gray-600">
              Nothing prescribed yet. Once your coaches have finished your evaluation, your drills
              show up here.
            </div>
          ) : (
            <div className="space-y-4">
              {set.focus.map((f) => {
                const items = byFocus.get(f.key) ?? []
                if (items.length === 0) return null
                const tier = tierFor(f.score)
                return (
                  <div key={f.key} className="card p-5">
                    <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                      <h3 className="font-black">{f.label}</h3>
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: tier.soft, color: tier.ink }}
                      >
                        {f.kind === 'keep' ? 'Strength — keep it' : f.kind === 'fix' ? 'Work on this first' : 'Sharpen this'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{items[0].reason}</p>
                    <ul className="space-y-2">
                      {items.map((item) => (
                        <li key={item.drillId} className="flex items-start gap-3">
                          <span className="text-xs font-black tabular-nums shrink-0 mt-0.5" style={{ color: 'var(--gh-green)' }}>
                            {item.repsPerWeek}×
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="font-semibold text-sm block">{item.name}</span>
                            <span className="text-xs text-gray-400">{drillCategoryLabel(item.category)} · {item.repsPerWeek} times a week</span>
                          </span>
                          {item.link && (
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-bold shrink-0"
                              style={{ color: 'var(--gh-green)' }}
                            >
                              Watch ↗
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── The evaluation ── */}
        <section>
          <div className="section-label">From your coaches</div>
          <h2 className="page-title mb-4">Where you are</h2>
          {rated.length === 0 ? (
            <div className="card p-6 text-sm text-gray-600">
              Your evaluation isn&rsquo;t finished yet.
            </div>
          ) : (
            <div className="card p-5 space-y-4">
              {[...new Set(rated.map((s) => s.section))].map((section) => (
                <div key={section}>
                  <div className="text-[0.65rem] font-black tracking-[0.18em] uppercase text-gray-400 mb-2">
                    {section}
                  </div>
                  <div className="space-y-2">
                    {rated
                      .filter((s) => s.section === section)
                      .map((s) => {
                        const tier = tierFor(s.average!)
                        return (
                          <div key={s.key} className="flex items-center gap-3">
                            <span className="text-sm w-44 shrink-0">{s.label}</span>
                            <span className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                              <span
                                className="block h-full rounded-full"
                                style={{ width: `${s.average}%`, background: tier.color }}
                              />
                            </span>
                            <span className="text-xs font-black tabular-nums w-8 text-right" style={{ color: tier.color }}>
                              {s.average}
                            </span>
                          </div>
                        )
                      })}
                  </div>
                </div>
              ))}
              <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">
                Every coach who rated you, averaged. Ask any of them what a number means — that is
                what it is for.
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
