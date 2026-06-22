'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { FalconHead } from './Logo'

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/schedule', label: 'Schedule' },
  { href: '/roster', label: 'Roster' },
  { href: '/coaches', label: 'Coaches' },
  { href: '/awards', label: 'Awards' },
  { href: '/news', label: 'News' },
  { href: '/resources', label: 'Resources' },
  { href: '/contact', label: 'Contact' },
  { href: '/team', label: 'Team Hub' },
]

export default function Nav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <nav className="fixed top-0 inset-x-0 z-50 shadow-sm" style={{ background: 'var(--gh-green-dk)' }}>
      <div className="max-w-screen-xl mx-auto px-4 flex items-center h-16 gap-4">
        <Link href="/" className="shrink-0 flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <FalconHead size={40} />
          <span className="flex flex-col leading-none">
            <span className="text-white font-black text-lg tracking-tight">GREEN HOPE</span>
            <span className="font-black text-[0.65rem] tracking-[0.25em]" style={{ color: '#f3c9cd' }}>
              FALCONS LACROSSE
            </span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden lg:flex items-center gap-1 ml-auto">
          {LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="relative px-3 py-2 text-sm font-semibold transition-colors"
              style={{ color: isActive(href) ? '#fff' : 'rgba(255,255,255,0.7)' }}
            >
              {label}
              {isActive(href) && (
                <span className="absolute left-3 right-3 -bottom-px h-0.5" style={{ background: '#f3c9cd' }} />
              )}
            </Link>
          ))}
          <Link href="/join" className="btn btn-maroon ml-2 !py-2 !px-4 text-sm">
            Join the Team
          </Link>
        </div>

        {/* Mobile burger */}
        <button
          className="lg:hidden ml-auto p-2 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.1)' }}
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="lg:hidden border-t px-4 py-3 flex flex-col gap-1" style={{ background: 'var(--gh-green-darker)', borderColor: 'rgba(255,255,255,0.1)' }}>
          {LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="px-3 py-2.5 rounded-lg text-sm font-semibold"
              style={{
                color: isActive(href) ? '#fff' : 'rgba(255,255,255,0.7)',
                background: isActive(href) ? 'rgba(255,255,255,0.1)' : 'transparent',
              }}
            >
              {label}
            </Link>
          ))}
          <Link href="/join" onClick={() => setOpen(false)} className="btn btn-maroon mt-2">
            Join the Team
          </Link>
        </div>
      )}
    </nav>
  )
}
