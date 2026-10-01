import type { Metadata } from 'next'
import { EventSignupForm } from '@/components/EventSignupForm'
import { SignupStatusBadge } from '@/components/SignupStatusBadge'
import { assertPageVisible } from '@/lib/pages'
import { readSignupStatus } from '@/lib/signupSettings'
import { SIGNUP_EVENTS, SIGNUP_STATUS_META, statusOf } from '@/lib/signups'

export const metadata: Metadata = {
  title: 'Firebirds Winter Events — Sign Up',
  description:
    'Barton College Playday (Sat, Dec 5) and the Trey Ennis Memorial Tournament (Dec 12–13). $50 per event, $100 for both.',
}

// The page keeps its old address, so links already sent out still land here.
const KEY = 'barton-playday'
const { events: EVENTS, each: EACH, all: ALL } = SIGNUP_EVENTS[KEY]
const VENMO = {
  handle: '@dannolan21',
  payUrl: 'https://venmo.com/dannolan21?txn=pay&amount=100&note=Firebirds%20Barton%20%2B%20Trey%20Ennis',
}

const EVENT_CARDS = [
  {
    label: 'Barton College Playday',
    when: 'Saturday, December 5',
    where: 'Barton College · Wilson, NC',
    lines: ['Morning games', 'Schedule goes out as soon as Barton releases it'],
  },
  {
    label: 'Trey Ennis Memorial Tournament',
    when: 'Saturday–Sunday, December 12–13',
    where: 'C.E. Jordan High School · Durham, NC',
    lines: ['3 games Saturday (8am–6pm), 1–3 games Sunday (8am–4pm)', 'Backup weekend: December 19–20'],
  },
]

export default async function WinterEventsPage() {
  await assertPageVisible(KEY)
  const status = statusOf(await readSignupStatus(), KEY)
  const { accepting, closedNote } = SIGNUP_STATUS_META[status]

  return (
    <>
      {/* ── Header ── */}
      <section className="hero-gradient text-white">
        <div className="max-w-screen-xl mx-auto px-4 py-14 sm:py-20 text-center">
          <div className="section-label" style={{ color: '#f3c9cd' }}>
            Firebirds · December 2026
          </div>
          <h1 className="mt-2 text-3xl sm:text-5xl font-black tracking-tight leading-none">
            BARTON PLAYDAY
            <br />+ TREY ENNIS
          </h1>
          <p className="mt-5 max-w-2xl mx-auto text-white/75">
            Two more events, one sign-up. Tick the event(s) your player can attend — ${EACH} for
            one, ${ALL} for both.
          </p>
          <div className="mt-6 flex justify-center">
            <SignupStatusBadge signupKey={KEY} status={status} />
          </div>
        </div>
      </section>

      <div className="max-w-screen-xl mx-auto px-4">
        {/* ── The two events ── */}
        <section className="mt-10 grid gap-4 md:grid-cols-2">
          {EVENT_CARDS.map((e) => (
            <div key={e.label} className="card p-5">
              <div className="section-label">{e.when}</div>
              <div className="font-black text-lg mt-1">{e.label}</div>
              <p className="text-sm font-semibold text-gray-700 mt-0.5">{e.where}</p>
              <ul className="mt-2 space-y-0.5">
                {e.lines.map((l) => (
                  <li key={l} className="text-sm text-gray-500">{l}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {/* ── Good to know ── */}
        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="card p-5">
            <div className="section-label">Cost</div>
            <div className="font-black text-lg mt-1">${EACH} one event · ${ALL} both</div>
            <p className="text-sm text-gray-500 mt-1">Venmo {VENMO.handle} with the player&rsquo;s name in the note.</p>
          </div>
          <div className="card p-5">
            <div className="section-label">Getting there</div>
            <div className="font-black text-lg mt-1">45 minutes early</div>
            <p className="text-sm text-gray-500 mt-1">No team travel — families get players to both events.</p>
          </div>
          <div className="card p-5">
            <div className="section-label">Trey Ennis</div>
            <div className="font-black text-lg mt-1">Lacrosse for Leukemia</div>
            <p className="text-sm text-gray-500 mt-1">
              In memory of Trey Ennis, #14 for Jordan, benefiting the Duke and UNC pediatric bone
              marrow transplant programs. We&rsquo;ve played it many times — always a great weekend.
            </p>
          </div>
        </section>

        {/* ── Signup ── */}
        <section id="signup" className="mt-14 max-w-2xl scroll-mt-24">
          <div className="section-label">Firebirds · December 2026</div>
          <h2 className="page-title mb-2">Sign Up to Play</h2>

          {accepting ? (
            <>
              <p className="text-gray-600 mb-6">
                Tick the event(s), tell us who is playing, then pay on Venmo — ${EACH} for one
                event, ${ALL} for both.
              </p>
              <EventSignupForm
                event={KEY}
                events={EVENTS}
                venmoHandle={VENMO.handle}
                venmoUrl={VENMO.payUrl}
                amount={ALL}
                followUp="Schedules go out by email as soon as each event releases them. Players get themselves there and are on the field 45 minutes before the first game."
              />
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
