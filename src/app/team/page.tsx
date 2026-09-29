import Link from 'next/link'
import { Fragment } from 'react'
import { redirect } from 'next/navigation'
import { mayReadTeamCalendar } from '@/lib/calendarGate'
import { listCalendarItems } from '@/lib/calendarData'
import { addDaysYmd, ymdOf, zonedToUtc } from '@/lib/zoned'
import { UpcomingList } from '@/components/calendar/UpcomingList'
import { TeamHubShell } from '@/components/team/TeamHubShell'
import { shownPanels, type PlayerPanelKey } from '@/lib/playerWarRoom'
import { pickQuote, playerPriorities, quoteShelf, readPlayerWarRoomConfig, todaysPlayerPlans } from '@/lib/playerWarRoomData'
import { levelOf } from '@/lib/priorityLevels'
import { DEFAULT_START, clockAt, formatMinutes, runningClock, tagFor, totalMinutes } from '@/lib/planner'
import { teamLabel } from '@/lib/teams'

export const metadata = { title: 'Team Hub' }
export const dynamic = 'force-dynamic'

/**
 * The players' War Room: the quote, today's practice, the week ahead, what the
 * team is working on and who leads it — laid out the way the head coach built
 * it in Admin → Team Hub. Nothing here can be changed from this side.
 */
export default async function TeamWarRoomPage() {
  if (!(await mayReadTeamCalendar())) redirect('/team/login')

  // Dynamic (force-dynamic) server render — today is the point here.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const today = ymdOf(now)
  const w = await readPlayerWarRoomConfig()
  const panels = shownPanels(w)
  const has = (k: PlayerPanelKey) => panels.includes(k)

  const [shelf, plans, week, priorities] = await Promise.all([
    has('quote') ? quoteShelf() : null,
    has('today') ? todaysPlayerPlans(w, today) : [],
    has('week')
      ? listCalendarItems({ from: zonedToUtc(today, '00:00'), to: zonedToUtc(addDaysYmd(today, 7), '00:00'), surface: 'team' })
      : [],
    has('priorities') ? playerPriorities(w) : [],
  ])
  const quote = shelf ? pickQuote(w, shelf, today) : null
  const coming = week.filter((i) => +new Date(i.endsAt) > now)
  const leaders = w.leaders.filter((l) => l.title.trim() || l.who.trim())

  const body: Record<PlayerPanelKey, React.ReactNode> = {
    quote: quote ? (
      <section
        className="rounded-2xl p-6 sm:p-8 text-white shadow-sm lg:col-span-2"
        style={{ background: 'linear-gradient(135deg, #004D2E 0%, #00693E 55%, #7A1F2B 130%)' }}
      >
        <p className="text-xl sm:text-2xl font-black leading-snug">&ldquo;{quote.line}&rdquo;</p>
        {quote.who && <p className="mt-3 text-sm font-bold text-white/75">— {quote.who}</p>}
      </section>
    ) : null,

    today: (
      <Panel icon="📋" title="Today’s practice">
        {plans.length === 0 ? (
          <p className="text-sm text-gray-500">No practice posted for today.</p>
        ) : (
          <div className="space-y-5">
            {plans.map((p) => (
              <div key={p.id}>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h3 className="font-black">{p.title}</h3>
                  {w.planTeams.length > 1 && (
                    <span className="text-[0.65rem] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {teamLabel(p.team)}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mb-2">
                  {clockAt(p.start_time ?? DEFAULT_START, 0)} · {formatMinutes(totalMinutes(p.blocks))}
                  {p.summary ? ` · ${p.summary}` : ''}
                </p>
                <ol className="space-y-1.5">
                  {p.blocks.map((b, i) => (
                    <li key={b.id} className="flex items-center gap-3 text-sm">
                      <span className="w-16 shrink-0 text-xs font-black tabular-nums" style={{ color: tagFor(b.tag).color }}>
                        {clockAt(p.start_time ?? DEFAULT_START, runningClock(p.blocks)[i])}
                      </span>
                      <span className="flex-1 min-w-0">{b.title || 'Untitled'}</span>
                      <span className="text-xs text-gray-400 tabular-nums">{b.minutes}m</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </Panel>
    ),

    week: (
      <Panel icon="🗓" title="The week ahead" more={{ href: '/team/calendar', label: 'Calendar →' }}>
        <UpcomingList items={coming} today={today} compact empty="Nothing on the calendar this week." />
      </Panel>
    ),

    priorities: (
      <Panel icon="🎯" title="What we’re working on">
        {priorities.every((l) => l.items.length === 0) ? (
          <p className="text-sm text-gray-500">Nothing on the list right now.</p>
        ) : (
          <div className="space-y-4">
            {priorities
              .filter((l) => l.items.length > 0)
              .map((l) => (
                <div key={l.id}>
                  <h3 className="text-xs font-black uppercase tracking-wide text-gray-500 mb-1.5">{l.name}</h3>
                  <ul className="space-y-1.5">
                    {l.items.map((i) => {
                      const lv = levelOf(i.level)
                      return (
                        <li key={i.id} className="flex items-start gap-2.5 text-sm">
                          <span
                            className="mt-0.5 shrink-0 text-[0.6rem] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full text-white"
                            style={{ background: lv.color }}
                          >
                            {lv.label}
                          </span>
                          <span className="min-w-0">{i.body}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
          </div>
        )}
      </Panel>
    ),

    leaders: (
      <Panel icon="🦅" title="Leadership">
        {leaders.length === 0 ? (
          <p className="text-sm text-gray-500">Leadership roles will be posted here.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {leaders.map((l) => (
              <li key={l.id} className="rounded-xl border px-4 py-3" style={{ borderColor: 'var(--border)' }}>
                <div className="text-xs font-black uppercase tracking-wide text-[var(--gh-maroon)]">{l.title || 'Leader'}</div>
                {l.who && <div className="font-bold mt-0.5">{l.who}</div>}
                {l.duties && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{l.duties}</p>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    ),
  }

  return (
    <TeamHubShell tab="war-room">
      {panels.length === 0 ? (
        <p className="card p-6 text-sm text-gray-500">The coaches are setting this up.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 items-start">
          {panels.map((k) => (
            <Fragment key={k}>{body[k]}</Fragment>
          ))}
        </div>
      )}
    </TeamHubShell>
  )
}

function Panel({
  icon,
  title,
  more,
  children,
}: {
  icon: string
  title: string
  more?: { href: string; label: string }
  children: React.ReactNode
}) {
  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="font-black">
          <span aria-hidden className="mr-1.5">{icon}</span>
          {title}
        </h2>
        {more && (
          <Link href={more.href} className="text-sm font-bold text-[var(--gh-green)]">
            {more.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}
