import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'
import { getTeamPosts, getGames } from '@/lib/queries'
import { shares } from '@/lib/calendarShare'
import { teamLogout } from '@/lib/actions'
import { TeamFeed } from '@/components/TeamFeed'
import { FalconHead } from '@/components/Logo'
import { formatDate, formatTime } from '@/lib/format'
import { TEAM_CATEGORY_META } from '@/lib/types'
import { isPageOn } from '@/lib/pages'
import { getSettings } from '@/lib/playbookData'
import { TEAMS } from '@/lib/teams'
import { getPageSettings } from '@/lib/queries'
import { currentPlayer } from '@/lib/playerAccess'
import { calendarReady, listCalendarItems, readCalendarShare } from '@/lib/calendarData'
import { mayReadTeamCalendar } from '@/lib/calendarGate'
import { addDaysYmd, ymdOf, zonedToUtc } from '@/lib/zoned'
import { UpcomingList } from '@/components/calendar/UpcomingList'

export const dynamic = 'force-dynamic'

export default async function TeamHubPage() {
  // Film Room can be switched off for the Team Hub in Admin → Pages.
  const filmOn = await isPageOn('film-team')
  /* The playbook card only appears once a deck is actually published — a link
     to "nothing published yet" is worse than no link. */
  const playbookOn = (
    await Promise.all(TEAMS.map((t) => getSettings(t.key)))
  ).some((s) => s.publishPlayers)
  /* The quick links are built from the same switches as the public nav. A page
     turned off in Admin → Pages 404s on the way in, so offering a link to it
     here was offering a dead button. */
  const pages = await getPageSettings()
  const linkOn = (key: string) => {
    const page = pages.find((p) => p.key === key)
    return page ? page.is_published : true
  }
  const quickLinks = [
    { key: 'schedule',  href: '/schedule',  label: 'Schedule & Results' },
    { key: 'roster',    href: '/roster',    label: 'Roster' },
    { key: 'resources', href: '/resources', label: 'Forms & Resources' },
    { key: 'coaches',   href: '/coaches',   label: 'Coaches & Staff' },
    { key: 'contact',   href: '/contact',   label: 'Contact a Coach' },
  ].filter((l) => linkOn(l.key))
  const posts = await getTeamPosts()
  // Whoever followed their own invite link gets a way back to their own work.
  const me = await currentPlayer()
  // Games marked for everyone or for players and parents — coaches-only ones stay
  // in the admin.
  // …and only from the calendars the head coach shares with the Team Hub.
  const [allGames, share] = await Promise.all([getGames(undefined, 'team'), readCalendarShare()])
  const games = allGames.filter((g) => shares(share, g.level === 'jv' ? 'jv' : 'varsity', 'team', 'games'))
  // Dynamic (force-dynamic) server render — current time is intentional here.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const nextGames = games
    .filter((g) => +new Date(g.game_date) >= now && g.status !== 'final')
    .slice(0, 5)
  /* What the coaches put on the calendar for players. Games are left out — they
     have their own card just above — and nothing shows until the calendar is
     switched on and we are sure who is looking. */
  const todayYmd = ymdOf(now)
  const showCalendar = (await calendarReady()) && (await mayReadTeamCalendar())
  const comingUp = showCalendar
    ? (
        await listCalendarItems({
          from: zonedToUtc(todayYmd, '00:00'),
          to: zonedToUtc(addDaysYmd(todayYmd, 60), '00:00'),
          surface: 'team',
        })
      ).filter((i) => i.source !== 'game' && +new Date(i.endsAt) > now)
    : []
  const upcoming = posts
    .filter((p) => p.event_date && +new Date(p.event_date) >= now)
    .sort((a, b) => +new Date(a.event_date!) - +new Date(b.event_date!))
    .slice(0, 5)

  return (
    <>
      {/* Header */}
      <header className="text-white" style={{ background: '#004D2E' }}>
        <div className="max-w-screen-lg mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/team" className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center bg-white rounded-lg px-1.5 py-1">
              <FalconHead size={26} />
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-black">Team Hub</span>
              <span className="text-[0.6rem] tracking-widest" style={{ color: '#f3c9cd' }}>GREEN HOPE FALCONS</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/" className="text-xs text-white/70 hover:text-white">Main site ↗</Link>
            <form action={teamLogout}>
              <button type="submit" className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded transition-colors">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="max-w-screen-lg mx-auto px-4 py-8 grid gap-8 lg:grid-cols-[1fr_300px]">
        {/* Feed */}
        <div>
          <div className="section-label">Team feed</div>
          <h1 className="page-title mb-5">Latest from the coaches</h1>
          <TeamFeed posts={posts} />
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {me && (
            <section className="card p-5" style={{ borderLeft: '4px solid var(--gh-maroon)' }}>
              <h2 className="font-black mb-1">🥍 {me.name.split(' ')[0]}&rsquo;s work</h2>
              <p className="text-sm text-gray-500 mb-3">
                Your evaluation, your drills, and today&rsquo;s plan if the coaches have posted it.
              </p>
              <Link href="/team/me" className="btn btn-maroon w-full">Open my work</Link>
            </section>
          )}
          <section className="card p-5">
            <h2 className="font-black mb-3">🥍 Next games</h2>
            {nextGames.length === 0 ? (
              <p className="text-sm text-gray-500">No games scheduled yet.</p>
            ) : (
              <ul className="space-y-3">
                {nextGames.map((g) => (
                  <li key={g.id} className="text-sm">
                    <div className="font-semibold leading-snug">
                      {g.home_away === 'away' ? '@' : 'vs'} {g.opponent}
                    </div>
                    <div className="text-gray-500">
                      {formatDate(g.game_date)} · {formatTime(g.game_date)}
                      {g.location ? ` · ${g.location}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {showCalendar && (
            <section className="card p-5">
              <h2 className="font-black mb-3">🗓 Coming up</h2>
              <UpcomingList
                items={comingUp}
                today={todayYmd}
                compact
                limit={5}
                empty="Nothing else on the calendar right now."
              />
              <Link href="/team/calendar" className="btn btn-ghost w-full mt-4">
                Full calendar
              </Link>
            </section>
          )}

          <section className="card p-5">
            <h2 className="font-black mb-3">📅 Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-gray-500">Nothing scheduled yet.</p>
            ) : (
              <ul className="space-y-3">
                {upcoming.map((p) => (
                  <li key={p.id} className="text-sm">
                    <div className="font-semibold leading-snug">{TEAM_CATEGORY_META[p.category].emoji} {p.title}</div>
                    <div className="text-gray-500">{formatDate(p.event_date!)} · {formatTime(p.event_date!)}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <h2 className="font-black mb-3">🎬 Film room</h2>
            <p className="text-sm text-gray-500 mb-3">
              Watch game film side-by-side, control playback frame-by-frame, and mark clips
              on the multi-panel video board.
            </p>
            {filmOn && <Link href="/team/video" className="btn btn-primary w-full">Open the Film Room</Link>}
          </section>

          {playbookOn && (
            <section className="card p-5">
              <h2 className="font-black mb-3">📘 Playbook</h2>
              <p className="text-sm text-gray-500 mb-3">
                What we run, in the order we install it — every play drawn up, with the reads and
                the coaching points beside it.
              </p>
              <Link href="/team/playbook" className="btn btn-primary w-full">Open the playbook</Link>
            </section>
          )}

          <section className="card p-5">
            <h2 className="font-black mb-3">🔗 Quick links</h2>
            <ul className="space-y-2 text-sm">
              {quickLinks.map((l) => (
                <li key={l.key}>
                  <Link href={l.href} className="font-semibold" style={{ color: 'var(--gh-green)' }}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            {quickLinks.length === 0 && (
              <p className="text-sm text-gray-400">Pages are switched off in Admin &rarr; Pages.</p>
            )}
          </section>
        </aside>
      </div>
    </>
  )
}
