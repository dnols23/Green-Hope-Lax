import type { Metadata } from 'next'
import { EventSignupForm } from '@/components/EventSignupForm'
import { SignupStatusBadge } from '@/components/SignupStatusBadge'
import { assertPageVisible } from '@/lib/pages'
import { readSignupStatus } from '@/lib/signupSettings'
import { SIGNUP_STATUS_META, statusOf } from '@/lib/signups'

export const metadata: Metadata = {
  title: 'Barton College Playday — Sign Up',
  description:
    'Green Hope returners play at Barton College on Saturday, December 5. $50 per player, morning games, schedule to follow.',
}

const KEY = 'barton-playday'
const FEE = 50
const VENMO = {
  handle: '@dannolan21',
  payUrl: 'https://venmo.com/dannolan21?txn=pay&amount=50&note=Barton%20Playday',
}

const FACTS = [
  { label: 'When', value: 'Sat, Dec 5', desc: 'Morning games — exact times to follow' },
  { label: 'Where', value: 'Barton College', desc: 'Wilson, NC — get yourself there' },
  { label: 'Who', value: 'Returners only', desc: 'Players who have already played for Green Hope' },
  { label: 'Cost', value: '$50 per player', desc: `Paid via Venmo ${VENMO.handle}` },
]

const NOTES = [
  {
    title: 'Returners only',
    desc: 'This one is for players already in the program. If you are new to Green Hope, sign up through Join the Team instead and we will get you to the right place.',
  },
  {
    title: 'Morning hours — schedule to come',
    desc: 'Barton has not released the schedule yet. Plan on being there in the morning; as soon as we have times, they go out by email and onto the team hub.',
  },
  {
    title: 'Get yourself there, 45 minutes early',
    desc: 'There is no bus and no team travel. Families arrange their own ride to Wilson, and players are on the field at Barton 45 minutes before the first game.',
  },
  {
    title: 'One day, college field',
    desc: 'A December day of real games on a college campus, against teams we do not see in the spring. Good film, good look, good reason to keep a stick in your hands over the winter.',
  },
]

export default async function BartonPlaydayPage() {
  await assertPageVisible(KEY)
  const status = statusOf(await readSignupStatus(), KEY)
  const { accepting, closedNote } = SIGNUP_STATUS_META[status]

  return (
    <>
      {/* ── Header ── */}
      <section className="hero-gradient text-white">
        <div className="max-w-screen-xl mx-auto px-4 py-14 sm:py-20 text-center">
          <div className="section-label" style={{ color: '#f3c9cd' }}>
            Falcons Winter Ball · December 2026
          </div>
          <h1 className="mt-2 text-3xl sm:text-5xl font-black tracking-tight leading-none">
            BARTON COLLEGE
            <br />
            PLAYDAY
          </h1>
          <p className="mt-5 max-w-2xl mx-auto text-white/75">
            Saturday, December 5 at Barton College. Returning Falcons only, $50 a player,
            morning games. Get yourself to Wilson and be there 45 minutes before the first
            game — we send the schedule the moment Barton puts it out.
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

        {/* ── Good to know ── */}
        <section className="mt-14 max-w-3xl">
          <div className="section-label">Good to know</div>
          <h2 className="page-title mb-6">What to Expect</h2>
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
          <div className="section-label">December 5, 2026</div>
          <h2 className="page-title mb-2">Sign Up to Play</h2>

          {accepting ? (
            <>
              <p className="text-gray-600 mb-6">
                Two quick steps: tell us who is playing, then send the ${FEE} player fee on
                Venmo. We send the schedule out as soon as Barton releases it.
              </p>
              <EventSignupForm
                event={KEY}
                venmoHandle={VENMO.handle}
                venmoUrl={VENMO.payUrl}
                amount={FEE}
                followUp="The schedule goes out by email as soon as Barton releases it. Players get themselves to Wilson and are on the field 45 minutes before the first game."
              />

              {/* ── Step 2: player fee ── */}
              <div className="card p-6 mt-6" style={{ borderLeft: '4px solid var(--gh-maroon)' }}>
                <div className="section-label">Step 2 · Player fee</div>
                <h3 className="font-black text-lg mt-1 mb-1">Pay the ${FEE} fee on Venmo</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Send ${FEE} to <span className="font-bold">{VENMO.handle}</span> and put the
                  player&rsquo;s name in the note so we can match the payment to the signup.
                </p>
                <a href={VENMO.payUrl} target="_blank" rel="noopener noreferrer" className="btn btn-maroon">
                  Pay ${FEE} on Venmo ↗
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
