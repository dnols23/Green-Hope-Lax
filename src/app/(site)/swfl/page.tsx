import type { Metadata } from 'next'
import { SwflForm } from '@/components/SwflForm'
import { SignupStatusBadge } from '@/components/SignupStatusBadge'
import { assertPageVisible } from '@/lib/pages'
import { readSignupStatus } from '@/lib/signupSettings'
import { SIGNUP_STATUS_META, statusOf } from '@/lib/signups'

export const metadata: Metadata = {
  title: 'SWFL Fall League — Sign Up to Play',
  description:
    'Sign up to play fall lacrosse with Green Hope in the South Wake Fall High School League at Seymour Park. Six Monday nights, 6–9 PM, Aug 17 – Sep 28.',
}

const VENMO = {
  handle: '@DanNolan21',
  payUrl: 'https://venmo.com/DanNolan21?txn=pay&amount=75&note=SWFL%20Fall%20League',
}

// The league's own slate, as the SWFL office publishes it. Green Hope plays as
// the Firebirds, so that is the row a parent is scanning for — it gets the
// green. Weeks 1–3 are not listed here because the league's sheet for those
// nights isn't to hand; the dates stay so the season still reads whole.
const US = 'Firebirds'

interface Game { time: string; a: string; b: string }
interface Week { wk: string; date: string; iso: string; games: Game[]; note?: string; off?: boolean }

const WEEKS: Week[] = [
  { wk: 'Wk 1', date: 'Mon, Aug 17', iso: '2026-08-17', games: [], note: 'Played' },
  { wk: 'Wk 2', date: 'Mon, Aug 24', iso: '2026-08-24', games: [], note: 'Played' },
  { wk: 'Wk 3', date: 'Mon, Aug 31', iso: '2026-08-31', games: [], note: 'Played' },
  {
    wk: '—', date: 'Mon, Sep 7', iso: '2026-09-07', games: [],
    note: 'Labor Day — no games', off: true,
  },
  {
    wk: 'Wk 4', date: 'Mon, Sep 14', iso: '2026-09-14',
    games: [
      { time: '6:00 PM', a: 'Boys on the Boat', b: 'Swamp Dawgs' },
      { time: '7:00 PM', a: 'Firebirds',        b: 'Red Creek' },
      { time: '8:00 PM', a: 'A-Town',           b: 'Revolution Senior' },
    ],
  },
  {
    wk: 'Wk 5', date: 'Mon, Sep 21', iso: '2026-09-21',
    games: [
      { time: '6:00 PM', a: 'Firebirds',        b: 'Revolution Senior' },
      { time: '7:00 PM', a: 'Boys on the Boat', b: 'A-Town' },
      { time: '8:00 PM', a: 'Red Creek',        b: 'Swamp Dawgs' },
    ],
  },
  {
    wk: 'Wk 6', date: 'Mon, Sep 28', iso: '2026-09-28',
    games: [
      { time: '6:00 PM', a: 'Revolution Senior', b: 'Swamp Dawgs' },
      { time: '7:00 PM', a: 'Red Creek',         b: 'Boys on the Boat' },
      { time: '8:00 PM', a: 'A-Town',            b: 'Firebirds' },
    ],
  },
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

const KEY = 'swfl'

export default async function SwflPage() {
  await assertPageVisible(KEY)
  const status = statusOf(await readSignupStatus(), KEY)
  // Nights already played are dimmed, so the next one is what the eye lands on.
  const today = new Date().toISOString().slice(0, 10)
  const { accepting, closedNote } = SIGNUP_STATUS_META[status]
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
            our high school club against other South Wake schools.
          </p>
          <div className="mt-6 flex justify-center">
            <SignupStatusBadge signupKey={KEY} status={status} />
          </div>
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
          <p className="text-gray-600 mb-6">
            Every game is at Seymour Park, Field 1. Green Hope plays as the{' '}
            <strong>Firebirds</strong> — that is the green line each week.
          </p>
          <div className="space-y-3">
            {WEEKS.map((w) => {
              const past = w.iso < today
              return (
                <div key={w.iso} className={`card overflow-hidden ${w.off || past ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-4 px-5 py-3 border-b border-[var(--border)]">
                    <span
                      className="w-12 shrink-0 text-xs font-black tracking-wide uppercase"
                      style={{ color: w.off ? undefined : 'var(--gh-maroon)' }}
                    >
                      {w.wk}
                    </span>
                    <span className={`font-bold ${w.off ? 'line-through' : ''}`}>{w.date}</span>
                    {w.note && <span className="ml-auto text-xs text-gray-500">{w.note}</span>}
                  </div>
                  {w.games.length > 0 && (
                    <div className="divide-y divide-[var(--border)]">
                      {w.games.map((g) => {
                        const ours = g.a === US || g.b === US
                        return (
                          <div
                            key={g.time}
                            className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-sm"
                            style={ours ? { background: '#DFEFE7' } : undefined}
                          >
                            <span className="w-20 shrink-0 text-gray-500">{g.time}</span>
                            <span className={ours ? 'font-black' : 'font-semibold'}>
                              {g.a} <span className="font-normal text-gray-400">vs</span> {g.b}
                            </span>
                            {ours && (
                              <span className="ml-auto text-[0.65rem] font-black tracking-wide uppercase"
                                style={{ color: 'var(--gh-green)' }}>
                                Green Hope
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
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
          {accepting ? (
            <>
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
            </>
          ) : (
            <div className="card p-6" style={{ borderLeft: '4px solid var(--gh-maroon)' }}>
              <p className="text-gray-600">{closedNote}</p>
            </div>
          )}
        </section>

        <div className="h-8" />
      </div>
    </>
  )
}
