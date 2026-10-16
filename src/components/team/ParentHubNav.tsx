'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/** The Parent Hub's menu: the calendar and the Film Room, which pulses while there's film to see. */
export function ParentHubNav({ fresh }: { fresh: number }) {
  const path = usePathname()
  const tabs = [
    { href: '/parents', label: 'Calendar', on: !path.startsWith('/parents/film') },
    { href: '/parents/film', label: 'Film Room', on: path.startsWith('/parents/film') },
  ]
  return (
    <nav className="max-w-screen-xl mx-auto px-4 flex gap-1" aria-label="Parent Hub">
      {tabs.map((t) => {
        const pulse = t.href === '/parents/film' && fresh > 0 && !t.on
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.on ? 'page' : undefined}
            className={`px-4 py-2.5 text-sm font-bold rounded-t-lg transition-colors inline-flex items-center ${pulse ? 'film-new' : ''}`}
            style={t.on ? { background: 'var(--surface-2)', color: 'var(--gh-green)' } : { color: 'rgba(255,255,255,.75)' }}
          >
            {t.label}
            {pulse && (
              <span className="film-new-count" aria-label={`${fresh} new`}>
                {fresh}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
