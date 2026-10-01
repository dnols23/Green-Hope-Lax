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
const venmo = (amount: number, note: string) =>
  `https://venmo.com/dannolan21?txn=pay&amount=${amount}&note=${encodeURIComponent(note)}`
const VENMO = {
  handle: '@dannolan21',
  payUrl: venmo(ALL, 'Firebirds Barton + Trey Ennis'),
}
const PAY = [
  { label: 'Both events', amount: ALL, url: venmo(ALL, 'Firebirds Barton + Trey Ennis - PLAYER NAME') },
  { label: 'One event', amount: EACH, url: venmo(EACH, 'Firebirds - EVENT - PLAYER NAME') },
]

// From the school to each event: a tap opens turn-by-turn in Google or Apple Maps.
const FROM = 'Green Hope High School, 2500 Carpenter Upchurch Rd, Cary, NC 27519'
const DRIVES = [
  {
    label: 'Barton College',
    when: 'Sat, Dec 5',
    to: 'Barton College, Wilson, NC 27893',
    route: 'I-40 E → US-64/264 E into Wilson',
    time: 'About 1 hr 10 min · 65 mi',
  },
  {
    label: 'C.E. Jordan High School',
    when: 'Dec 12–13',
    to: '6806 Garrett Road, Durham, NC 27707',
    route: 'NC-55 N → I-40 W → US-15/501 N → Garrett Rd',
    time: 'About 30 min · 22 mi',
  },
]
const google = (to: string) =>
  `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(FROM)}&destination=${encodeURIComponent(to)}&travelmode=driving`
const apple = (to: string) => `https://maps.apple.com/?saddr=${encodeURIComponent(FROM)}&daddr=${encodeURIComponent(to)}&dirflg=d`

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

        {/* ── Signup, with paying and getting there beside it ── */}
        <section id="signup" className="mt-14 scroll-mt-24">
          <div className="section-label">Firebirds · December 2026</div>
          <h2 className="page-title mb-2">Sign Up to Play</h2>
          <p className="text-gray-600 mb-6 max-w-2xl">
            Tick the event(s), tell us who is playing, then pay on Venmo — ${EACH} for one event,
            ${ALL} for both.
          </p>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_1fr] items-start">
            {/* Paying comes first on a phone, beside the form on a laptop. */}
            <aside className="lg:col-start-2 lg:row-start-1">
              <div className="card p-6" style={{ borderTop: '4px solid var(--gh-maroon)' }}>
                <div className="section-label">Step 2 · Pay</div>
                <h3 className="font-black text-xl mt-1">Venmo {VENMO.handle}</h3>
                <ul className="mt-3 space-y-1 text-sm">
                  <li className="flex justify-between"><span>Both events</span><span className="font-black">${ALL}</span></li>
                  <li className="flex justify-between"><span>One event</span><span className="font-black">${EACH}</span></li>
                </ul>
                <div className="mt-4 grid gap-2">
                  {PAY.map((p) => (
                    <a
                      key={p.label}
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`btn ${p.amount === ALL ? 'btn-maroon' : 'btn-ghost'} justify-center`}
                    >
                      Pay ${p.amount} · {p.label} ↗
                    </a>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  Put the player&rsquo;s name — and which event, if just one — in the Venmo note so we
                  can match it to the sign-up.
                </p>
              </div>
            </aside>

            <div className="lg:col-start-1 lg:row-start-1 lg:row-span-2 min-w-0">
              {accepting ? (
                <EventSignupForm
                  event={KEY}
                  events={EVENTS}
                  venmoHandle={VENMO.handle}
                  venmoUrl={VENMO.payUrl}
                  amount={ALL}
                  followUp="Schedules go out by email as soon as each event releases them. Players get themselves there and are on the field 45 minutes before the first game."
                />
              ) : (
                <div className="card p-6" style={{ borderLeft: '4px solid var(--gh-maroon)' }}>
                  <p className="text-gray-600">{closedNote}</p>
                </div>
              )}
            </div>

            <aside className="lg:col-start-2 lg:row-start-2">
              <div className="card p-6">
                <div className="section-label">Getting there</div>
                <h3 className="font-black text-lg mt-1">From Green Hope High School</h3>
                <div className="mt-3 divide-y divide-gray-100">
                  {DRIVES.map((d) => (
                    <div key={d.label} className="py-3 first:pt-0 last:pb-0">
                      <div className="font-bold">
                        {d.label} <span className="font-normal text-xs text-gray-400">{d.when}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5">{d.route}</p>
                      <p className="text-xs text-gray-400">{d.time}</p>
                      <div className="flex gap-3 mt-1.5 text-sm font-bold">
                        <a href={google(d.to)} target="_blank" rel="noopener noreferrer" className="text-[var(--gh-green)]">
                          Google Maps ↗
                        </a>
                        <a href={apple(d.to)} target="_blank" rel="noopener noreferrer" className="text-[var(--gh-green)]">
                          Apple Maps ↗
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-3">Be on the field 45 minutes before the first game.</p>
              </div>
            </aside>
          </div>
        </section>

        <div className="h-8" />
      </div>
    </>
  )
}
