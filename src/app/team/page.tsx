import Link from 'next/link'
import { getTeamPosts } from '@/lib/queries'
import { teamLogout } from '@/lib/actions'
import { TeamFeed } from '@/components/TeamFeed'
import { FalconHead } from '@/components/Logo'
import { formatDate, formatTime } from '@/lib/format'
import { TEAM_CATEGORY_META } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function TeamHubPage() {
  const posts = await getTeamPosts()
  // Dynamic (force-dynamic) server render — current time is intentional here.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const upcoming = posts
    .filter((p) => p.event_date && +new Date(p.event_date) >= now)
    .sort((a, b) => +new Date(a.event_date!) - +new Date(b.event_date!))
    .slice(0, 5)

  return (
    <>
      {/* Header */}
      <header className="text-white" style={{ background: 'var(--gh-green-dk)' }}>
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
            <Link href="/team/video" className="btn btn-primary w-full">Open the Film Room</Link>
          </section>

          <section className="card p-5">
            <h2 className="font-black mb-3">🔗 Quick links</h2>
            <ul className="space-y-2 text-sm">
              <li><Link href="/schedule" className="font-semibold" style={{ color: 'var(--gh-green)' }}>Schedule &amp; Results</Link></li>
              <li><Link href="/roster" className="font-semibold" style={{ color: 'var(--gh-green)' }}>Roster</Link></li>
              <li><Link href="/resources" className="font-semibold" style={{ color: 'var(--gh-green)' }}>Forms &amp; Resources</Link></li>
              <li><Link href="/coaches" className="font-semibold" style={{ color: 'var(--gh-green)' }}>Coaches &amp; Staff</Link></li>
              <li><Link href="/contact" className="font-semibold" style={{ color: 'var(--gh-green)' }}>Contact a Coach</Link></li>
            </ul>
          </section>
        </aside>
      </div>
    </>
  )
}
