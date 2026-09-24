import Link from 'next/link'
import { getCurrentCoach } from '@/lib/coach'
import { createServiceClient } from '@/lib/supabase-server'
import { getViewer, teamFor } from '@/lib/permissions'
import { readModesOff } from '@/lib/hubSettings'
import { HUB_MODES, isModeOn } from '@/lib/hubModes'
import { saveHubModes, createPlan, addPriorityAction } from '@/lib/actions'
import { listPlans, plannerReady } from '@/lib/plans'
import { getGames } from '@/lib/queries'
import { DEFAULT_START, formatMinutes, runningClock, tagFor, totalMinutes, clockAt } from '@/lib/planner'
import { loadWall } from '@/lib/wallData'
import { WallPanel } from '@/components/wall/WallPanel'
import { listPriorities, prioritiesReady, PRIORITY_LEVELS, DEFAULT_LEVEL } from '@/lib/priorities'
import { canTeam } from '@/lib/sections'
import { formatDate, formatShortDate, formatTime, TEAM_TIME_ZONE } from '@/lib/format'
import { teamLabel, withTeam, type Team } from '@/lib/teams'
import { listCalendarItems } from '@/lib/calendarData'
import { audienceLabel, colorFor, type CalItem } from '@/lib/calendarModel'
import { addDaysYmd, hmOf, ymdOf, zoneParts, zonedToUtc } from '@/lib/zoned'
import { WarRoomPanels, type Panel } from './WarRoomPanels'
import { PriorityRow } from './PriorityRow'

export const metadata = { title: 'War Room' }
export const dynamic = 'force-dynamic'

/** Today where the team is, not where the server is. */
function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TEAM_TIME_ZONE }).format(new Date())
}

// ── The week ahead ───────────────────────────────────────────────────────────
//
// Two panels read the calendar: what is on it this week, and which coaches
// have said they can't be there. One read covers both, split here, so the War
// Room costs one trip to the calendar however much is on it.

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEK_LINES = 10
/** Open priorities shown in the War Room, worst first; the rest are counted. */
const PRIORITY_LINES = 6

/** "Tue" for a calendar date, with no time zone to trip over. */
function weekdayOf(ymd: string): string {
  return WEEKDAY[new Date(`${ymd}T12:00:00Z`).getUTCDay()]
}

/** "4", "4:30" — the clock without the AM/PM, which the caller decides on. */
function clockOf(iso: string): { text: string; ap: 'AM' | 'PM' } {
  const z = zoneParts(iso)
  return {
    text: `${z.h % 12 || 12}${z.mi ? `:${String(z.mi).padStart(2, '0')}` : ''}`,
    ap: z.h < 12 ? 'AM' : 'PM',
  }
}

/** "4–6 PM", or "11 AM–1 PM" when it crosses noon. */
function clockRange(startIso: string, endIso: string): string {
  const a = clockOf(startIso)
  const b = clockOf(endIso)
  return a.ap === b.ap ? `${a.text}–${b.text} ${b.ap}` : `${a.text} ${a.ap}–${b.text} ${b.ap}`
}

/**
 * The last calendar day something covers. Ends are exclusive, so an all-day
 * block ending at midnight — or a late one that runs to exactly midnight —
 * belongs to the day before.
 */
function lastDayOf(item: CalItem): string {
  const endYmd = ymdOf(item.endsAt)
  return item.allDay || hmOf(item.endsAt) === '00:00' ? addDaysYmd(endYmd, -1) : endYmd
}

/**
 * The week's games, practices and events, a day at a time. Something that
 * started before today — a tournament weekend already under way — files under
 * today, since today is when it matters.
 */
function byDay(items: CalItem[], today: string): { ymd: string; items: CalItem[] }[] {
  const days = new Map<string, CalItem[]>()
  for (const item of items) {
    const start = ymdOf(item.startsAt)
    const ymd = start < today ? today : start
    days.set(ymd, [...(days.get(ymd) ?? []), item])
  }
  return [...days.keys()].sort().map((ymd) => ({ ymd, items: days.get(ymd) ?? [] }))
}

/**
 * The first `limit` lines of the week, and a count of the rest. Ten lines is a
 * phone screen; whatever is left over is counted rather than dropped silently.
 */
function capLines(
  days: { ymd: string; items: CalItem[] }[],
  limit: number,
): { days: { ymd: string; items: CalItem[] }[]; more: number } {
  const kept: { ymd: string; items: CalItem[] }[] = []
  let left = limit
  let more = 0
  for (const d of days) {
    const items = d.items.slice(0, Math.max(0, left))
    left -= items.length
    more += d.items.length - items.length
    if (items.length) kept.push({ ymd: d.ymd, items })
  }
  return { days: kept, more }
}

/**
 * One stretch of a coach being out, as short as it can be said: "Tue 4–6 PM",
 * "Thu all day", "Fri–Sun all day". Clipped to the week, so a coach out for a
 * fortnight reads as out from here on rather than listing a date nobody asked
 * about.
 */
function outLabel(item: CalItem, today: string, lastDay: string): string {
  const startYmd = ymdOf(item.startsAt)
  const from = startYmd < today ? today : startYmd
  const through = lastDayOf(item)
  const day = (ymd: string) => (ymd === today ? 'Today' : weekdayOf(ymd))

  if (item.allDay) {
    if (from === through) return `${day(from)} all day`
    if (through > lastDay) return from === today ? 'all week' : `${day(from)} on`
    return `${day(from)}–${weekdayOf(through)} all day`
  }
  if (startYmd === through) return `${day(startYmd)} ${clockRange(item.startsAt, item.endsAt)}`
  // Timed and running over more than one day: say both ends.
  if (through > lastDay) return from === today ? 'all week' : `${day(from)} on`
  const b = clockOf(item.endsAt)
  const back = `${through === today ? 'today' : weekdayOf(through)} ${b.text} ${b.ap}`
  if (startYmd < today) return `until ${back}`
  const a = clockOf(item.startsAt)
  return `${day(startYmd)} ${a.text} ${a.ap} – ${back}`
}

/** The out-blocks, one line per coach, in the order they are first missing. */
function whoIsOut(items: CalItem[]): { email: string; name: string; blocks: CalItem[] }[] {
  const coaches = new Map<string, { email: string; name: string; blocks: CalItem[] }>()
  for (const item of items) {
    const email = (item.coachEmail ?? '').toLowerCase()
    const name = item.coachName?.trim() || email.split('@')[0] || 'A coach'
    const found = coaches.get(email)
    if (found) found.blocks.push(item)
    else coaches.set(email, { email, name, blocks: [item] })
  }
  return [...coaches.values()]
}

/** Which War Room an item belongs on: its own team's, or both for the program. */
function onThisSide(item: CalItem, team: Team): boolean {
  return item.team === 'program' || item.team === team
}

export default async function WarRoom({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  /* Which staff's week this is. It rides in the URL so the two can be open side
     by side, and so a link to a JV plan lands on the JV side without anybody
     switching first. */
  const coach = await getCurrentCoach()
  const viewer = await getViewer()
  /* A coach kept to one side of the program gets that side, whatever the
     address bar says. */
  const team = teamFor(viewer, (await searchParams).team)
  // Both War Rooms are open to every coach, so the other one is always a tap away.
  const locked = false
  const isOwner = viewer?.isOwner ?? false
  const modesOff = await readModesOff()
  const today = todayIso()

  /* The next seven days off the calendar, availability included, started now
     so it reads alongside everything below rather than after it. A calendar
     that can't be read leaves the two panels empty; it never takes the War
     Room down with it. */
  const lastDay = addDaysYmd(today, 6)
  const weekAhead = listCalendarItems({
    surface: 'coach',
    viewer,
    from: zonedToUtc(today, '00:00'),
    to: zonedToUtc(addDaysYmd(today, 7), '00:00'),
    withAvailability: true,
  }).catch(() => [] as CalItem[])

  const svc = createServiceClient()
  const { error: evalError } = await svc.from('evaluations').select('id').limit(1)

  const hasPlanner = await plannerReady()
  const plans = hasPlanner ? await listPlans(team) : []
  const todaysPlan = plans.find((p) => p.kind === 'practice' && p.plan_date === today)
  const nextPractice = plans.find((p) => p.kind === 'practice' && p.plan_date && p.plan_date > today)
  const gamePlans = plans.filter((p) => p.kind === 'game').slice(0, 3)

  const games = await getGames(undefined, 'admin', team)
  const upcoming = games
    .filter((g) => g.game_date >= today && g.status !== 'final')
    .slice(0, 4)
  const gamesToday = games.filter((g) => g.game_date.slice(0, 10) === today)
  /* Who we play next, and the scout for them if somebody has started one — a
     scout is a plan of its own kind, dated to the game. */
  const nextGame = upcoming[0] ?? null
  const scout = nextGame
    ? plans.find((p) => p.kind === 'scout' && p.plan_date === nextGame.game_date.slice(0, 10)) ?? null
    : null

  /* The wall and the priorities load alongside each other. Neither can take
     the War Room down: a table that isn't there yet reads as empty. */
  const [wall, hasPriorities] = await Promise.all([loadWall(viewer), prioritiesReady()])
  const priorityLists = hasPriorities ? await listPriorities(team) : []
  const mayWritePriorities = canTeam(viewer, team)
  const openPriorities = priorityLists
    .flatMap((l) => l.items.filter((i) => !i.done).map((i) => ({ ...i, listName: l.name })))
    .sort((a, b) => b.level - a.level || a.createdAt.localeCompare(b.createdAt))
  const shownPriorities = openPriorities.slice(0, PRIORITY_LINES)
  const levelCounts = PRIORITY_LEVELS.slice()
    .reverse()
    .map((l) => ({ ...l, n: openPriorities.filter((i) => i.level === l.level).length }))
    .filter((l) => l.n > 0)

  const calendar = await weekAhead
  const thisWeek = calendar.filter((i) => i.source !== 'availability' && onThisSide(i, team))
  const out = whoIsOut(calendar.filter((i) => i.source === 'availability' && i.kind === 'unavailable'))
  const { days: shownDays, more: moreThisWeek } = capLines(byDay(thisWeek, today), WEEK_LINES)
  const me = viewer?.email.toLowerCase() ?? ''

  const planPanel = (title: string, plan: typeof todaysPlan) => {
    if (!plan) {
      return (
        <p className="text-sm text-gray-500">
          Nothing yet.{' '}
          <Link href={withTeam('/admin/planner', team)} className="font-semibold text-[var(--gh-green)]">Write one →</Link>
        </p>
      )
    }
    const clock = runningClock(plan.blocks)
    return (
      <div>
        <Link href={withTeam(`/admin/planner/${plan.id}`, team)} className="font-bold hover:underline">{plan.title}</Link>
        <div className="text-xs text-gray-500 mb-2">
          {formatMinutes(totalMinutes(plan.blocks))} · {plan.blocks.length} blocks
          {plan.plan_date && title !== 'Today’s plan' ? ` · ${formatShortDate(plan.plan_date)}` : ''}
        </div>
        <ol className="space-y-1">
          {plan.blocks.slice(0, 8).map((b, i) => (
            <li key={b.id} className="flex items-center gap-2 text-sm">
              <span className="w-14 shrink-0 text-xs font-black tabular-nums" style={{ color: tagFor(b.tag).color }}>
                {clockAt(plan.start_time ?? DEFAULT_START, clock[i])}
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
      key: 'week',
      title: 'This week',
      body: (
        <div>
          {shownDays.length === 0 ? (
            <p className="text-sm text-gray-500">
              A clear week — no games, practices or events in the next seven days. Put the next one
              on the calendar and the whole staff sees it.
            </p>
          ) : (
            <div className="space-y-3">
              {shownDays.map((d) => (
                <div key={d.ymd}>
                  <Link
                    href={`/admin/calendar?view=day&date=${d.ymd}`}
                    className="block text-xs font-black uppercase tracking-wide mb-1 hover:underline"
                    style={{ color: d.ymd === today ? 'var(--gh-green)' : 'var(--color-gray-500, #6b7280)' }}
                  >
                    {d.ymd === today
                      ? `Today · ${weekdayOf(d.ymd)}`
                      : formatDate(`${d.ymd}T12:00:00Z`, { weekday: 'long' })}
                  </Link>
                  <ul className="space-y-1">
                    {d.items.map((item) => {
                      const dot = colorFor(item)
                      const title = item.title || 'Untitled'
                      return (
                        <li key={item.key} className="flex items-center gap-2 text-sm min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: dot.bg, border: `1px solid ${dot.border}` }}
                            aria-hidden
                          />
                          <span className="w-16 shrink-0 text-xs font-bold tabular-nums text-gray-500">
                            {item.allDay ? 'All day' : formatTime(item.startsAt)}
                          </span>
                          {/* w-0, not just min-w-0: the War Room's grid sizes its
                              column to the widest thing in it, and a long title
                              pushed every card off the side of a phone. */}
                          {item.href ? (
                            <Link href={item.href} className="truncate flex-1 w-0 font-semibold hover:underline">
                              {title}
                            </Link>
                          ) : (
                            <span className="truncate flex-1 w-0 font-semibold">{title}</span>
                          )}
                          {/* Who else can see it — the head coach's check that the
                              parents' meeting really did go to the parents. */}
                          {item.source === 'event' && (
                            <span className="text-[0.65rem] font-bold uppercase text-gray-400 shrink-0">
                              {item.audience === 'coaches' ? 'staff' : audienceLabel(item.audience).replace('Coaches & ', '')}
                            </span>
                          )}
                          {item.result && (
                            <span className="text-xs text-gray-400 tabular-nums shrink-0">{item.result}</span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
              {moreThisWeek > 0 && <p className="text-xs text-gray-400">+{moreThisWeek} more</p>}
            </div>
          )}
          <Link href="/admin/calendar" className="inline-block mt-3 text-sm font-semibold text-[var(--gh-green)]">
            Open the calendar →
          </Link>
        </div>
      ),
    },
    {
      key: 'out',
      title: 'Who’s out',
      body: (
        <div>
          {out.length === 0 ? (
            <p className="text-sm text-gray-500">Everyone&rsquo;s available this week.</p>
          ) : (
            <ul className="space-y-1.5">
              {out.map((c) => (
                <li key={c.email || c.name} className="text-sm flex gap-2">
                  <span
                    className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: '#fde8ea', border: '1px solid #f3b8bf' }}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="font-semibold">{c.email === me ? 'You' : c.name}</span>
                    <span className="text-gray-500">
                      {' — '}
                      {c.blocks.map((b) => outLabel(b, today, lastDay)).join(', ')}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/admin/calendar?view=week"
            className="inline-block mt-3 text-sm font-semibold text-[var(--gh-green)]"
          >
            Set your availability →
          </Link>
        </div>
      ),
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
            <Link href={withTeam('/admin/planner', team)} className="font-semibold text-[var(--gh-green)]">Start one →</Link>
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
      key: 'scout',
      title: nextGame ? 'Next opponent' : 'Scouting',
      body: !nextGame ? (
        <p className="text-sm text-gray-500">
          Nothing on the schedule to scout yet.
        </p>
      ) : (
        <div className="text-sm">
          <div className="font-bold text-base leading-tight">
            {nextGame.home_away === 'away' ? '@' : 'vs'} {nextGame.opponent}
          </div>
          <div className="text-gray-500">
            {formatShortDate(nextGame.game_date)} · {formatTime(nextGame.game_date)}
            {nextGame.location ? ` · ${nextGame.location}` : ''}
            {nextGame.is_conference ? ' · conference' : ''}
          </div>
          <div className="mt-2">
            {scout ? (
              <Link href={withTeam(`/admin/planner/${scout.id}`, team)} className="font-semibold hover:underline">
                🔭 {scout.title} →
              </Link>
            ) : (
              /* No scout yet, so the button makes one already named and dated
                 for this opponent — the scouting starts on the next screen,
                 not after ten seconds of filling in a form. */
              <form action={createPlan}>
                <input type="hidden" name="kind" value="scout" />
                <input type="hidden" name="team" value={team} />
                <input type="hidden" name="title" value={`Scout — ${nextGame.opponent}`} />
                <input type="hidden" name="plan_date" value={nextGame.game_date.slice(0, 10)} />
                <button type="submit" className="font-semibold hover:underline" style={{ color: 'var(--gh-green)' }}>
                  🔭 Scout them →
                </button>
              </form>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'priorities',
      title: 'Priorities',
      body: !hasPriorities ? (
        <p className="text-sm text-gray-500">
          Run <code>supabase/migrations/0030_priorities.sql</code> to keep the staff&rsquo;s list of what needs work here.
        </p>
      ) : (
        <div>
          {levelCounts.length > 0 && (
            <p className="text-xs text-gray-500 mb-2">
              {levelCounts.map((l, i) => (
                <span key={l.level}>
                  {i > 0 && ' · '}
                  <span className="font-bold" style={{ color: l.level >= 3 ? '#b42318' : undefined }}>
                    {l.n} {l.label}
                  </span>
                </span>
              ))}{' '}
              open across {priorityLists.length} list{priorityLists.length === 1 ? '' : 's'}
            </p>
          )}
          {shownPriorities.length === 0 ? (
            <p className="text-sm text-gray-500">
              {priorityLists.length === 0
                ? 'No lists yet. Start one — offense, defense, rides, clears — and what the staff notices lands here.'
                : 'Nothing open. Everything the staff flagged has been dealt with.'}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {shownPriorities.map((item) => (
                <PriorityRow
                  key={item.id}
                  item={{ id: item.id, body: item.body, level: item.level, listId: item.listId, listName: item.listName }}
                  lists={priorityLists.map((l) => ({ id: l.id, name: l.name }))}
                  canWrite={mayWritePriorities}
                />
              ))}
            </ul>
          )}
          {openPriorities.length > shownPriorities.length && (
            <p className="text-xs text-gray-400 mt-1">+{openPriorities.length - shownPriorities.length} more</p>
          )}
          {mayWritePriorities && priorityLists.length > 0 && (
            /* The thirty-second capture: something went wrong at practice, it
               goes on the list without leaving the War Room. */
            <details className="mt-3 group">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--gh-green)] list-none">+ Add a priority</summary>
              <form action={addPriorityAction} className="mt-2 space-y-2">
                <input
                  name="body"
                  required
                  maxLength={300}
                  placeholder="e.g. Slides late off the ball carrier"
                  aria-label="What needs work"
                  className="field !py-1.5 text-sm"
                />
                <div className="flex gap-2">
                  <select name="listId" aria-label="Which list" className="field !py-1.5 text-sm min-w-0 flex-1">
                    {priorityLists.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                  <select name="level" defaultValue={DEFAULT_LEVEL} aria-label="How urgent" className="field !py-1.5 text-sm !w-auto">
                    {PRIORITY_LEVELS.slice().reverse().map((l) => (
                      <option key={l.level} value={l.level}>{l.label}</option>
                    ))}
                  </select>
                  <button type="submit" className="btn btn-primary !py-1.5 !px-3 text-sm">Add</button>
                </div>
              </form>
            </details>
          )}
          <Link
            href={withTeam('/admin/priorities', team)}
            className="inline-block mt-2 text-sm font-semibold text-[var(--gh-green)]"
          >
            All priorities →
          </Link>
        </div>
      ),
    },
    {
      key: 'wall',
      title: 'On the wall',
      body: <WallPanel lib={wall} today={today} />,
    },
  ]

  return (
    <div>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <h1 className="text-xl font-black">
          {team === 'varsity' ? 'War Room' : `${teamLabel(team)} War Room`}
        </h1>
        {/* The other staff's week, one tap away — the same screen, their plans.
            Left out for a coach who only works one side. */}
        {!locked && (
          <Link
            href={withTeam('/admin/hub', team === 'varsity' ? 'jv' : 'varsity')}
            className="text-xs font-bold px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 hover:border-[var(--gh-green)] hover:text-[var(--gh-green)]"
          >
            {team === 'varsity' ? 'JV' : 'Varsity'} →
          </Link>
        )}
        {coach && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: '#fde8ea', color: 'var(--gh-maroon)' }}
          >
            {coach.role === 'head'
              ? '★ Head Coach'
              : coach.role === 'jv-head'
                ? '★ JV Head Coach'
                : 'Coach'}{' '}
            · {coach.name}
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
              <div className="divide-y border rounded-lg" style={{ borderColor: 'var(--color-gray-200, #e5e7eb)' }}>
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
