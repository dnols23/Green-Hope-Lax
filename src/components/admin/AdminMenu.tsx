'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { logout } from '@/lib/actions'
import { FalconHead } from '@/components/Logo'
import { SECTION_GROUPS, type AdminSection } from '@/lib/sections'

/**
 * The admin menu: brand, the page you're on, and everything else behind one
 * button.
 *
 * There are close to twenty sections once a full set of permissions is granted,
 * which no top bar can hold — they used to wrap into a second row and collide
 * with the logo. Grouping them under one menu keeps the bar the same height
 * however many sections get added later.
 */
/**
 * Back, forward, and the way home.
 *
 * Saved to a home screen the site runs without Safari's chrome, so there is no
 * back button at all — and a coach moving film → plan → roster → film was
 * paying two taps through the menu for every step. These are the same three
 * moves, in the bar, on every admin page.
 */
function WorkflowNav({ onHub, showHub }: { onHub: () => void; showHub: boolean }) {
  const router = useRouter()
  const arrow = 'p-1.5 rounded-lg transition-colors hover:bg-white/20'

  return (
    <div className="flex items-center gap-1 shrink-0">
      <button type="button" onClick={() => router.back()} aria-label="Back" title="Back"
        className={arrow} style={{ background: 'rgba(255,255,255,0.12)' }}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button type="button" onClick={() => router.forward()} aria-label="Forward" title="Forward"
        className={arrow} style={{ background: 'rgba(255,255,255,0.12)' }}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {showHub && (
        <Link
          href="/admin/hub"
          onClick={onHub}
          title="Back to the Coaches Hub"
          className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors hover:bg-white/20"
          style={{ background: 'rgba(255,255,255,0.12)' }}
        >
          <span aria-hidden>↩</span> Hub
        </Link>
      )}
    </div>
  )
}

export function AdminMenu({ links, tier }: { links: AdminSection[]; tier: string }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Longest matching href wins, so /admin/film/library lights up Film Room and
  // /admin never lights up everything.
  const active = links
    .filter((s) => pathname === s.href || pathname.startsWith(`${s.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const groups = SECTION_GROUPS.map((g) => ({
    name: g,
    items: links.filter((s) => s.group === g),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="relative shrink-0 text-white" style={{ background: 'var(--gh-green-dk)' }}>
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <WorkflowNav onHub={() => setOpen(false)} showHub={pathname !== '/admin/hub'} />
          <Link href="/admin" className="flex items-center gap-2 font-black shrink-0" onClick={() => setOpen(false)}>
            <FalconHead size={28} />
            <span className="hidden sm:inline">
              Falcons <span className="text-white/50 font-normal text-sm">{tier}</span>
            </span>
          </Link>
          {/* On a phone the arrows, the Hub and the menu are the whole bar; the
              page name would be squeezed to "Drill …" for no gain, and the
              page's own heading is an inch below it. */}
          {active && (
            <span className="hidden sm:flex items-center gap-3 min-w-0">
              <span className="text-white/25" aria-hidden>
                /
              </span>
              <span className="text-sm font-semibold text-white/80 truncate">{active.label}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href="/" target="_blank" className="hidden sm:inline text-xs text-white/60 hover:text-white">
            View site ↗
          </Link>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="admin-menu"
            className="flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: 'rgba(255,255,255,0.12)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {open ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
            Menu
          </button>
        </div>
      </div>

      {open && (
        <>
          {/* Catches the click that closes the menu without covering the bar. */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
            style={{ background: 'rgba(0,0,0,0.35)' }}
          />
          <div
            id="admin-menu"
            className="absolute inset-x-0 top-full z-50 border-t shadow-xl"
            style={{ background: 'var(--gh-green-darker)', borderColor: 'rgba(255,255,255,0.12)' }}
          >
            <div className="max-w-7xl mx-auto px-4 py-4 grid gap-x-6 gap-y-4 grid-cols-2 md:grid-cols-4">
              {groups.map((g) => (
                <div key={g.name}>
                  <div className="text-[0.65rem] font-black tracking-[0.18em] uppercase text-white/40 mb-1.5">
                    {g.name}
                  </div>
                  <div className="flex flex-col">
                    {g.items.map((s) => {
                      const isActive = active?.href === s.href
                      return (
                        <Link
                          key={s.key}
                          href={s.href}
                          onClick={() => setOpen(false)}
                          className="px-2 py-1.5 rounded text-sm font-semibold"
                          style={{
                            color: isActive ? '#fff' : 'rgba(255,255,255,0.72)',
                            background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                          }}
                        >
                          {s.label}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div
              className="border-t"
              style={{ borderColor: 'rgba(255,255,255,0.12)' }}
            >
              <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
                <Link
                  href="/"
                  target="_blank"
                  onClick={() => setOpen(false)}
                  className="text-xs font-semibold text-white/60 hover:text-white"
                >
                  View site ↗
                </Link>
                <form action={logout}>
                  <button
                    type="submit"
                    className="text-xs font-semibold px-3 py-1.5 rounded transition-colors"
                    style={{ background: 'rgba(255,255,255,0.12)' }}
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
