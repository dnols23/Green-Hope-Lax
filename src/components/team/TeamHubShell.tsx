import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'
import { FalconHead } from '@/components/Logo'
import { teamLogout } from '@/lib/actions'

const TABS = [
  { key: 'war-room', label: 'War Room', href: '/team' },
  { key: 'calendar', label: 'Calendar', href: '/team/calendar' },
] as const

/** The Team Hub's header and its one menu: the War Room and the calendar. */
export function TeamHubShell({ tab, children }: { tab: (typeof TABS)[number]['key']; children: React.ReactNode }) {
  return (
    <>
      <header className="text-white" style={{ background: '#004D2E' }}>
        <div className="max-w-screen-xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <Link href="/team" className="flex items-center gap-2.5 min-w-0">
            <span className="inline-flex items-center justify-center bg-white rounded-lg px-1.5 py-1 shrink-0">
              <FalconHead size={26} />
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-black">Team Hub</span>
              <span className="text-[0.6rem] tracking-widest" style={{ color: '#f3c9cd' }}>GREEN HOPE FALCONS</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <form action={teamLogout}>
              <button type="submit" className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded transition-colors">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav className="max-w-screen-xl mx-auto px-4 flex gap-1" aria-label="Team Hub">
          {TABS.map((t) => {
            const on = t.key === tab
            return (
              <Link
                key={t.key}
                href={t.href}
                aria-current={on ? 'page' : undefined}
                className="px-4 py-2.5 text-sm font-bold rounded-t-lg transition-colors"
                style={on ? { background: 'var(--surface-2)', color: 'var(--gh-green)' } : { color: 'rgba(255,255,255,.75)' }}
              >
                {t.label}
              </Link>
            )
          })}
        </nav>
      </header>
      <div className="max-w-screen-xl mx-auto px-4 py-5">{children}</div>
    </>
  )
}
