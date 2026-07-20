import Link from 'next/link'
import { getNews } from '@/lib/queries'
import { formatDate } from '@/lib/format'

export default async function HomePage() {
  const news = await getNews(3)

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

      {/* ── SWFL callout ── */}
      <section className="max-w-screen-xl mx-auto px-4 mt-8">
        <Link
          href="/swfl"
          className="card p-5 sm:p-6 flex flex-wrap items-center gap-4 hover:shadow-md transition-shadow"
          style={{ borderLeft: '4px solid var(--gh-maroon)' }}
        >
          <div className="flex-1 min-w-60">
            <div className="section-label">Falcons Fall Ball · Sign-ups open</div>
            <div className="font-black text-lg sm:text-xl mt-1">
              South Wake Fall High School League at Seymour Park
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Six Monday nights, 6–9 PM · Aug 17 – Sep 28 · $50 per player
            </p>
          </div>
          <span className="btn btn-maroon">Sign up to play</span>
        </Link>
      </section>

      {/* ── Latest news ── */}
      <section className="max-w-screen-xl mx-auto px-4 mt-12">
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
                <div className="text-xs font-semibold text-gray-500">{formatDate(post.published_at, { weekday: undefined, year: 'numeric' })}</div>
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
