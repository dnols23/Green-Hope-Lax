'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { FalconHead } from './Logo'

const LINKS = [
  { href: '/news', label: 'News' },
  { href: '/schedule', label: 'Schedule' },
  { href: '/swfl', label: 'SWFL' },
  { href: '/stats', label: 'Stats' },
  { href: '/record-books', label: 'Record Books' },
  { href: '/roster', label: 'Roster' },
  { href: '/coaches', label: 'Coaches' },
  { href: '/awards', label: 'Awards' },
  { href: '/shop', label: 'Shop' },
  { href: '/resources', label: 'Resources' },
  { href: '/eligibility', label: 'Eligibility' },
  { href: '/contact', label: 'Contact' },
  { href: '/team', label: 'Team Hub' },
]

// `hidden` is the set of hrefs an admin has toggled off in /admin → Pages.
export default function Nav({ hidden = [] }: { hidden?: string[] }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)
  const links = LINKS.filter((l) => !hidden.includes(l.href))

  return (
    <nav className="fixed top-0 inset-x-0 z-50 shadow-sm" style={{ background: 'var(--gh-green-dk)' }}>
      <div className="relative max-w-screen-xl mx-auto px-4 flex items-center h-16 gap-4">
        <Link href="/" className="shrink-0 flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <FalconHead size={40} />
          <span className="flex flex-col leading-none">
            <span className="text-white font-black text-lg tracking-tight">GREEN HOPE</span>
            <span className="font-black text-[0.65rem] tracking-[0.25em]" style={{ color: '#f3c9cd' }}>
              FALCONS LACROSSE
            </span>
          </span>
        </Link>

        {/* One menu at every width. The link list is driven by what's switched
            on in Admin -> Pages, so a bar that fits today overflows the moment
            another page goes live; a menu never does. */}
        <div className="ml-auto flex items-center gap-2">
          {/* Wrapped, because .btn sets its own display and would win over a
              `hidden` utility on the link itself. */}
          <div className="hidden sm:block">
            <Link href="/join" className="btn btn-maroon !py-2 !px-3 text-sm">
              Join Green Hope Lacrosse
            </Link>
          </div>
          <div className="hidden md:block">
            <Link href="/join/green-machine" className="btn btn-maroon !py-2 !px-3 text-sm">
              Join the Green Machine
            </Link>
          </div>
          <button
            className="flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.1)' }}
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
            aria-expanded={open}
            aria-controls="site-menu"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {open ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
            <span className="hidden sm:inline text-white">Menu</span>
          </button>
        </div>
      </div>

      {/* The menu itself: a panel under the button, not a bar of links. The list
          is whatever is switched on in Admin -> Pages, so a row that fits today
          overflows the moment another page goes live. */}
      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-16 z-40 cursor-default"
            style={{ background: 'rgba(0,0,0,0.35)' }}
          />
          <div className="relative max-w-screen-xl mx-auto px-4">
            <div
              id="site-menu"
              className="absolute right-4 left-4 sm:left-auto sm:w-72 top-0 z-50 rounded-b-xl border-t shadow-2xl overflow-hidden"
              style={{ background: 'var(--gh-green-darker)', borderColor: 'rgba(255,255,255,0.1)' }}
            >
              <div className="p-2 flex flex-col gap-0.5 max-h-[70vh] overflow-y-auto">
                {links.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className="px-3 py-2.5 rounded-lg text-sm font-semibold"
                    style={{
                      color: isActive(href) ? '#fff' : 'rgba(255,255,255,0.75)',
                      background: isActive(href) ? 'rgba(255,255,255,0.1)' : 'transparent',
                    }}
                  >
                    {label}
                  </Link>
                ))}

                {/* The Join buttons live in the bar on a wide screen; on a phone
                    there is no room for them there, so they come in here. */}
                <div className="sm:hidden flex flex-col gap-2 mt-2">
                  <Link href="/join" onClick={() => setOpen(false)} className="btn btn-maroon w-full">
                    Join Green Hope Lacrosse
                  </Link>
                  <Link href="/join/green-machine" onClick={() => setOpen(false)} className="btn btn-maroon w-full">
                    Join the Green Machine
                  </Link>
                </div>
                <div className="hidden sm:block md:hidden mt-2">
                  <Link href="/join/green-machine" onClick={() => setOpen(false)} className="btn btn-maroon w-full">
                    Join the Green Machine
                  </Link>
                </div>

                {/* Staff door, last and set apart so it reads as a utility link
                    rather than another section of the site. */}
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="mt-2 pt-3 px-3 pb-1 border-t text-xs font-bold tracking-wide"
                  style={{ borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)' }}
                >
                  Admin
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </nav>
  )
}
