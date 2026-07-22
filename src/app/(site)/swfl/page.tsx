import type { Metadata } from 'next'
import { SwflForm } from '@/components/SwflForm'
import { assertPageVisible } from '@/lib/pages'

export const metadata: Metadata = {
  title: 'SWFL Fall League — Sign Up to Play',
  description:
    'Sign up to play fall lacrosse with Green Hope in the South Wake Fall High School League at Seymour Park. Six Monday nights, 6–9 PM, Aug 17 – Sep 28.',
}

const VENMO = {
  handle: '@DanNolan21',
  payUrl: 'https://venmo.com/DanNolan21?txn=pay&amount=75&note=SWFL%20Fall%20League',
}

const WEEKS = [
  { wk: 'Wk 1', date: 'Mon, Aug 17', note: '6:00–9:00 PM' },
  { wk: 'Wk 2', date: 'Mon, Aug 24', note: '6:00–9:00 PM' },
  { wk: 'Wk 3', date: 'Mon, Aug 31', note: '6:00–9:00 PM' },
  { wk: '—', date: 'Mon, Sep 7', note: 'Labor Day — no games', off: true },
  { wk: 'Wk 4', date: 'Mon, Sep 14', note: '6:00–9:00 PM' },
  { wk: 'Wk 5', date: 'Mon, Sep 21', note: '6:00–9:00 PM' },
  { wk: 'Wk 6', date: 'Mon, Sep 28', note: '6:00–9:00 PM' },
]

const FACTS = [
  { label: 'When', value: 'Mondays, 6–9 PM', desc: 'Six game nights, Aug 17 – Sep 28' },
  { label: 'Where', value: 'Seymour Park', desc: 'All games at one field — no travel' },
  { label: 'Who', value: 'Falcons players', desc: 'We compete as the Green Hope high school club' },
  { label: 'Cost', value: '$75 per player', desc: `Paid via Venmo ${VENMO.handle}` },
]

const NOTES = [
  {
    title: 'High school club format',
    desc: 'Teams from schools around South Wake, each playing as their high school’s club. Fun first, but real games.',
  },
  {
    title: 'Light / dark reversibles',
    desc: 'Games are played in reversible pinnies (numbers not needed). Gear details come from the coaches after you sign up.',
  },
  {
    title: 'Monday nights only',
    desc: 'One night a week, 6–9 PM. No games Labor Day week, so it fits around everything else this fall.',
  },
]

export default async function SwflPage() {
  await assertPageVisible('swfl')
  return (
    <>
      {/* ── Header ── */}
      <section className="hero-gradient text-white">
        <div className="max-w-screen-xl mx-auto px-4 py-14 sm:py-20 text-center">
          <div className="section-label" style={{ color: '#f3c9cd' }}>
            Falcons Fall Ball · Fall 2026
          </div>
          <h1 className="mt-2 text-3xl sm:text-5xl font-black tracking-tight leading-none">
            SOUTH WAKE FALL
            <br />
            HIGH SCHOOL LEAGUE
          </h1>
          <p className="mt-5 max-w-2xl mx-auto text-white/75">
            Green Hope is playing six Monday nights at Seymour Park this fall — competing as
            our high school club against other South Wake schools. Sign up below to play.
          </p>
        </div>
      </section>

      <div className="max-w-screen-xl mx-auto px-4">
        {/* ── At a glance ── */}
        <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FACTS.map((f) => (
            <div key={f.label} className="card p-5">
              <div className="section-label">{f.label}</div>
              <div className="font-black text-lg mt-1">{f.value}</div>
              <p className="text-sm text-gray-500 mt-1">{f.desc}</p>
            </div>
          ))}
        </section>

        {/* ── Game nights ── */}
        <section className="mt-14 max-w-3xl">
          <div className="section-label">2026 game nights</div>
          <h2 className="page-title mb-2">Six Mondays This Fall</h2>
          <p className="text-gray-600 mb-6">All games run 6:00–9:00 PM at Seymour Park.</p>
          <div className="card overflow-hidden">
            {WEEKS.map((w) => (
              <div
                key={w.date}
                className={`flex items-center gap-5 px-5 py-3 border-b border-[var(--border)] last:border-b-0 ${w.off ? 'text-gray-400' : ''}`}
              >
                <span
                  className="w-12 shrink-0 text-xs font-black tracking-wide uppercase"
                  style={{ color: w.off ? undefined : 'var(--gh-maroon)' }}
                >
                  {w.wk}
                </span>
                <span className={`w-36 shrink-0 ${w.off ? 'line-through' : 'font-bold'}`}>{w.date}</span>
                <span className="text-sm text-gray-500">{w.note}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Good to know ── */}
        <section className="mt-14 max-w-3xl">
          <div className="section-label">Good to know</div>
          <h2 className="page-title mb-6">How the League Works</h2>
          <div className="space-y-3">
            {NOTES.map((n) => (
              <div key={n.title} className="card p-5 flex gap-4 items-baseline">
                <span className="font-black" style={{ color: 'var(--gh-maroon)' }}>✓</span>
                <div>
                  <div className="font-bold">{n.title}</div>
                  <p className="text-sm text-gray-500 mt-0.5">{n.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Signup ── */}
        <section id="signup" className="mt-14 max-w-2xl scroll-mt-24">
          <div className="section-label">Fall 2026</div>
          <h2 className="page-title mb-2">Sign Up to Play</h2>
          <p className="text-gray-600 mb-6">
            Two quick steps: tell us who&rsquo;s playing, then pay the $75 player fee via Venmo.
            The coaches will follow up with rosters, gear, and game-night details.
          </p>
          <SwflForm />

          {/* ── Step 2: player fee ── */}
          <div className="card p-6 mt-6" style={{ borderLeft: '4px solid var(--gh-maroon)' }}>
            <div className="section-label">Step 2 · League fee</div>
            <h3 className="font-black text-lg mt-1 mb-1">Pay the $75 player fee on Venmo</h3>
            <p className="text-sm text-gray-600 mb-4">
              Send $75 to <span className="font-bold">{VENMO.handle}</span> and put the
              player&rsquo;s name in the note so we can match your payment to the signup.
            </p>
            <a href={VENMO.payUrl} target="_blank" rel="noopener noreferrer" className="btn btn-maroon">
              Pay $75 on Venmo ↗
            </a>
          </div>
        </section>

        <div className="h-8" />
      </div>
    </>
  )
}
