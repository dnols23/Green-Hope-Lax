import Link from 'next/link'
import { getNextGame, getNews } from '@/lib/queries'
import { NextGameCard } from '@/components/NextGameCard'
import { formatDate } from '@/lib/format'

export default async function HomePage() {
  const [nextGame, news] = await Promise.all([getNextGame(), getNews(3)])

  return (
    <>
      {/* ── Hero ── */}
      <section className="hero-gradient text-white relative overflow-hidden">
        {/* Falcon mark as a faint background watermark */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-no-repeat bg-center opacity-[0.12]"
          style={{ backgroundImage: "url('/logos/falcon-head-white.png')", backgroundSize: 'min(900px, 120vw)' }}
        />
        <div className="relative max-w-screen-xl mx-auto px-4 py-20 sm:py-28 flex flex-col items-center text-center">
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-none">
            GREEN HOPE FALCONS
          </h1>
          <p className="mt-3 text-lg sm:text-2xl font-bold tracking-wide" style={{ color: '#f3c9cd' }}>
            LACROSSE
          </p>
          <p className="mt-5 max-w-xl text-white/70">
            One program. One family. Building Falcons lacrosse in Cary, North Carolina —
            on the field and in the classroom.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Link href="/join" className="btn btn-maroon">Join Green Hope Lacrosse</Link>
            <Link href="/join/green-machine" className="btn btn-maroon">Join the Green Machine</Link>
          </div>
        </div>
      </section>

      {/* ── Next game ── */}
      <section className="max-w-screen-xl mx-auto px-4 -mt-10 relative z-10">
        <NextGameCard game={nextGame} />
      </section>

      {/* ── Quick links ── */}
      <section className="max-w-screen-xl mx-auto px-4 mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: '/schedule', title: 'Schedule & Results', desc: 'Games, scores, and locations.' },
          { href: '/stats', title: 'Stats', desc: 'Season records, computed from the schedule.' },
          { href: '/roster', title: 'Roster', desc: 'Varsity and JV rosters.' },
          { href: '/join', title: 'Join Green Hope Lacrosse', desc: 'New or experienced — start here.' },
        ].map((c) => (
          <Link key={c.href} href={c.href} className="card p-5 hover:shadow-md transition-shadow group">
            <div className="font-black text-lg group-hover:text-[var(--gh-green)] transition-colors">{c.title}</div>
            <p className="text-sm text-gray-500 mt-1">{c.desc}</p>
            <span className="inline-block mt-3 text-sm font-bold" style={{ color: 'var(--gh-maroon)' }}>
              View →
            </span>
          </Link>
        ))}
      </section>

      {/* ── Latest news ── */}
      <section className="max-w-screen-xl mx-auto px-4 mt-16">
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="section-label">From the program</div>
            <h2 className="page-title">Latest News</h2>
          </div>
          <Link href="/news" className="text-sm font-bold" style={{ color: 'var(--gh-green)' }}>
            All news →
          </Link>
        </div>

        {news.length === 0 ? (
          <p className="text-gray-500">No announcements yet.</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-3">
            {news.map((post) => (
              <Link key={post.id} href={`/news/${post.slug}`} className="card p-5 hover:shadow-md transition-shadow">
                <div className="text-xs font-semibold text-gray-400">{formatDate(post.published_at, { weekday: undefined, year: 'numeric' })}</div>
                <h3 className="font-bold text-lg mt-1 leading-snug">{post.title}</h3>
                <p className="text-sm text-gray-500 mt-2 line-clamp-3">{post.body}</p>
                <span className="inline-block mt-3 text-sm font-bold" style={{ color: 'var(--gh-maroon)' }}>Read more →</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="h-8" />
    </>
  )
}
