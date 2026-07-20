import type { Metadata } from 'next'
import Link from 'next/link'
import { InterestForm } from '@/components/InterestForm'

export const metadata: Metadata = {
  title: 'Join the Green Machine',
  description:
    'West Cary Green Machine — middle school boys lacrosse (grades 6–8) in the South Wake Lacrosse Conference, the Green Hope / Green Level feeder program.',
}

// Spring league registration runs through LeagueApps (Team 91 Carolina).
const LEAGUEAPPS = {
  register: 'https://team91carolina.leagueapps.com/registration/init?bid=5080050&redirectToGroupAccReg=true',
  league: 'https://team91carolina.leagueapps.com/leagues/lacrosse/5080050-west-cary-green-machine---spring-league-registration',
}

const DETAILS = [
  { label: 'Who', value: 'Boys in grades 6–8 in the West Cary / Morrisville area (Green Hope & Green Level). No previous experience required.' },
  { label: 'What you get', value: '6 league games, weekly practices, and a league jersey.' },
  { label: 'Season', value: 'Spring 2026, in the South Wake Lacrosse Conference (SWLC) Middle School Boys League. Registration is open now.' },
  { label: 'Cost', value: 'No cost to participate. There’s an optional online league fundraiser to help support SWLC.' },
  { label: 'Team app', value: 'TeamSnap is used for rosters, practice & game schedules, and league updates.' },
]

const GEAR = ['Helmet', 'Shoulder pads', 'Arm pads', 'Gloves', 'Stick', 'Mouth guard', 'Cleats / running shoes']

export default function JoinGreenMachinePage() {
  return (
    <div className="relative max-w-2xl mx-auto px-4 py-10">
      {/* Transparent Green Machine logo as a faint page-background watermark */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-no-repeat bg-center opacity-[0.07]"
        style={{ backgroundImage: "url('/logos/green-machine.png')", backgroundSize: 'min(1360px, 175vw)' }}
      />
      <div className="section-label">West Cary Green Machine · Middle school</div>
      <h1 className="page-title mb-2">Join the Green Machine</h1>
      <p className="text-gray-600 mb-8">
        The West Cary Green Machine is the middle school boys lacrosse team for the Green Hope /
        Green Level area, playing in the South Wake Lacrosse Conference (SWLC). It’s where future
        Falcons learn the game and get ready to play for Green Hope — new players welcome.
      </p>

      {/* ── Spring league registration (LeagueApps) ── */}
      <div className="card p-6 mb-6" style={{ borderLeft: '4px solid var(--gh-maroon)' }}>
        <div className="section-label">Spring 2026 · Registration open · Free to play</div>
        <h2 className="font-black text-lg mt-1 mb-1">Register for the Green Machine Spring League</h2>
        <p className="text-sm text-gray-600 mb-4">
          The Green Machine plays in the South Wake Lacrosse Conference middle school boys
          league. Registration runs through LeagueApps (Team 91 Carolina) — the button below
          takes you straight to sign-up.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <a href={LEAGUEAPPS.register} target="_blank" rel="noopener noreferrer" className="btn btn-maroon">
            Register Now ↗
          </a>
          <a
            href={LEAGUEAPPS.league}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-bold"
            style={{ color: 'var(--gh-green)' }}
          >
            League details on LeagueApps ↗
          </a>
        </div>
      </div>

      <div className="card p-6 mb-6">
        <h2 className="font-black text-lg mb-4">Program details</h2>
        <dl className="space-y-3">
          {DETAILS.map((d) => (
            <div key={d.label} className="grid sm:grid-cols-[8rem_1fr] gap-1 sm:gap-3">
              <dt className="text-xs font-bold uppercase tracking-wide text-gray-400 sm:pt-0.5">{d.label}</dt>
              <dd className="text-sm text-gray-700">{d.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="card p-6 mb-8">
        <h2 className="font-black text-lg mb-1">Gear to bring</h2>
        <p className="text-sm text-gray-500 mb-3">Players provide their own equipment:</p>
        <ul className="flex flex-wrap gap-2">
          {GEAR.map((g) => (
            <li key={g} className="text-sm font-semibold rounded-full px-3 py-1" style={{ background: '#ecfdf5', color: 'var(--gh-green-dk)' }}>
              {g}
            </li>
          ))}
        </ul>
      </div>

      <h2 className="font-black text-xl mb-1">Not ready to register? Let us know</h2>
      <p className="text-gray-600 mb-4 text-sm">
        Have questions first? Fill out the form and a coach will follow up with registration
        help and dates. League questions can also go to{' '}
        <a href="mailto:info@southwakelax.com" className="font-semibold" style={{ color: 'var(--gh-green)' }}>info@southwakelax.com</a>.
      </p>
      <InterestForm level="middle" />

      <p className="text-sm text-gray-500 mt-6 text-center">
        Looking for the high school program instead?{' '}
        <Link href="/join" className="font-semibold" style={{ color: 'var(--gh-green)' }}>Join the high school team →</Link>
      </p>
    </div>
  )
}
