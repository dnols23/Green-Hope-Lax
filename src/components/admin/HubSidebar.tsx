'use client'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useState, useSyncExternalStore } from 'react'
import { TOUR_EVENT, TOUR_KEY } from '@/lib/tour'

export interface HubLink {
  key: string
  label: string
  href: string
  icon: string
  /** Which heading it sits under. */
  group: string
}

const ORDER_KEY = 'gh-hub-order-v1'
const ORDER_EVENT = 'gh-hub-order-changed'
const SHUT_KEY = 'gh-hub-shut-v1'

const SHUT_EVENT = 'gh-hub-shut-changed'

function readShut(): string {
  try { return localStorage.getItem(SHUT_KEY) ?? '' } catch { return '' }
}
function subscribeToShut(onChange: () => void) {
  window.addEventListener(SHUT_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(SHUT_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

function readOrder(): string {
  try { return localStorage.getItem(ORDER_KEY) ?? '' } catch { return '' }
}
function subscribeToOrder(onChange: () => void) {
  window.addEventListener(ORDER_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(ORDER_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

/** Saved order first, then anything new, then drop keys that no longer exist. */
function applyOrder(links: HubLink[], order: string[]): HubLink[] {
  const byKey = new Map(links.map((l) => [l.key, l]))
  const out: HubLink[] = []
  for (const key of order) {
    const found = byKey.get(key)
    if (found) { out.push(found); byKey.delete(key) }
  }
  return [...out, ...byKey.values()]
}

/**
 * The coaching modes, down the side, in this coach's own order.
 *
 * Drag a row by its handle to move it. The order is this coach's — kept in their
 * own browser, not on the site — because the order that suits the head coach in
 * February is not the one that suits the JV coach in August.
 */
export function HubSidebar({ links }: { links: HubLink[] }) {
  /* Reading the query string suspends, and the sidebar is the first thing on
     the page — so it renders without the team marked and settles a beat later
     rather than holding everything up. */
  return (
    <Suspense fallback={<Rail links={links} team="varsity" />}>
      <SidebarWithTeam links={links} />
    </Suspense>
  )
}

function SidebarWithTeam({ links }: { links: HubLink[] }) {
  const team = useSearchParams().get('team') === 'jv' ? 'jv' : 'varsity'
  return <Rail links={links} team={team} />
}

function Rail({ links, team }: { links: HubLink[]; team: string }) {
  const pathname = usePathname()
  const [dragKey, setDragKey] = useState<string | null>(null)
  /* Which headings are folded away, kept in this browser like the order is. A
     coach who never touches JV shuts it once and stops seeing it. Read the same
     way the order is: straight out of the browser, so the server's render and
     the first client one agree and then settle. */
  const shutJson = useSyncExternalStore(subscribeToShut, readShut, () => '')
  let folded: string[] = []
  try { folded = shutJson ? (JSON.parse(shutJson) as string[]) : [] } catch { folded = [] }

  function toggleGroup(group: string) {
    const next = folded.includes(group) ? folded.filter((g) => g !== group) : [...folded, group]
    try {
      localStorage.setItem(SHUT_KEY, JSON.stringify(next))
    } catch {
      // A blocked store just means the groups open again next time.
    }
    window.dispatchEvent(new Event(SHUT_EVENT))
  }

  /* The saved order is read straight out of the browser rather than copied into
     state: the server has no order to render, and this way the first client
     render matches it and then settles. A blocked or empty localStorage simply
     means the order given. */
  const savedJson = useSyncExternalStore(subscribeToOrder, readOrder, () => '')
  let saved: string[] = []
  try { saved = savedJson ? (JSON.parse(savedJson) as string[]) : [] } catch { saved = [] }
  const shown = saved.length ? applyOrder(links, saved) : links

  function persist(next: HubLink[]) {
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(next.map((l) => l.key))) } catch {}
    // Same-tab writes don't raise a storage event, so say so ourselves.
    window.dispatchEvent(new Event(ORDER_EVENT))
  }

  function dropOn(targetKey: string) {
    if (!dragKey || dragKey === targetKey) return
    const next = shown.filter((l) => l.key !== dragKey)
    const moved = shown.find((l) => l.key === dragKey)
    if (!moved) return
    next.splice(next.findIndex((l) => l.key === targetKey), 0, moved)
    persist(next)
    setDragKey(null)
  }

  // Keyboard equivalent, so reordering isn't mouse-only.
  function nudge(key: string, by: number) {
    const from = shown.findIndex((l) => l.key === key)
    const to = from + by
    if (from < 0 || to < 0 || to >= shown.length) return
    const next = [...shown]
    next.splice(to, 0, next.splice(from, 1)[0])
    persist(next)
  }

  /* Two rows can share a path and differ only by team — the two War Rooms do —
     so the team has to be part of what "you are here" means. */
  const isActive = (href: string) => {
    const [path, query = ''] = href.split('?')
    const forTeam = new URLSearchParams(query).get('team') === 'jv' ? 'jv' : 'varsity'
    if (forTeam !== team) return false
    return pathname === path || (path !== '/admin/hub' && pathname.startsWith(`${path}/`))
  }

  // The headings in the order the links arrive in, so the server decides what
  // a coach has rather than this component guessing.
  const groups: { name: string; items: HubLink[] }[] = []
  for (const link of shown) {
    const found = groups.find((g) => g.name === link.group)
    if (found) found.items.push(link)
    else groups.push({ name: link.group, items: [link] })
  }

  return (
    <nav className="w-full md:w-56 shrink-0" data-tour="sidebar">
      <div className="card p-2 space-y-1">
        {groups.map((group) => {
          const isShut = folded.includes(group.name)
          const hasOpenPage = group.items.some((l) => isActive(l.href))
          return (
            <div key={group.name}>
              <button
                type="button"
                onClick={() => toggleGroup(group.name)}
                aria-expanded={!isShut}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left"
              >
                <svg
                  className="w-3 h-3 shrink-0 text-gray-400 transition-transform"
                  style={{ transform: isShut ? undefined : 'rotate(90deg)' }}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-[0.65rem] font-black tracking-[0.18em] uppercase text-gray-400">
                  {group.name}
                </span>
                {isShut && hasOpenPage && (
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: 'var(--gh-green)' }}
                    aria-label="You are on a page in here"
                  />
                )}
              </button>

              {!isShut && (
                <ul className="flex flex-col gap-0.5">
                  {group.items.map((l) => {
                    const on = isActive(l.href)
                    return (
                      <li
                        key={l.key}
                        data-tour-mode={l.key}
                        draggable
                        onDragStart={() => setDragKey(l.key)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => dropOn(l.key)}
                        onDragEnd={() => setDragKey(null)}
                        className="group flex items-center gap-1 rounded-lg"
                        style={{
                          background: on ? 'var(--gh-green)' : 'transparent',
                          opacity: dragKey === l.key ? 0.4 : 1,
                        }}
                      >
                        <span
                          aria-hidden
                          title="Drag to reorder"
                          className="cursor-grab select-none px-1.5 text-sm leading-none"
                          style={{ color: on ? 'rgba(255,255,255,0.6)' : '#c7cdd3' }}
                        >
                          ☰
                        </span>
                        <Link
                          href={l.href}
                          className="flex-1 min-w-0 flex items-center gap-2 py-2 pr-2 text-sm font-semibold rounded-lg"
                          style={{ color: on ? '#fff' : '#374151' }}
                        >
                          <span aria-hidden>{l.icon}</span>
                          <span className="truncate">{l.label}</span>
                        </Link>
                        <span className="hidden group-hover:flex items-center pr-1">
                          <button
                            type="button"
                            aria-label={`Move ${l.label} up`}
                            onClick={() => nudge(l.key, -1)}
                            className="px-1 text-xs"
                            style={{ color: on ? 'rgba(255,255,255,0.7)' : '#9ca3af' }}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            aria-label={`Move ${l.label} down`}
                            onClick={() => nudge(l.key, 1)}
                            className="px-1 text-xs"
                            style={{ color: on ? 'rgba(255,255,255,0.7)' : '#9ca3af' }}
                          >
                            ↓
                          </button>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-2 px-1 flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[0.7rem] text-gray-400">Drag ☰ to put these in your own order.</p>
        {/* The welcome runs itself once. This is how you get it back — to see
            the home-screen directions again, or to walk a new coach round. */}
        <button
          type="button"
          onClick={() => {
            try { localStorage.setItem(`${TOUR_KEY}-replay`, '1') } catch {}
            window.dispatchEvent(new Event(TOUR_EVENT))
          }}
          className="text-[0.7rem] font-bold text-[var(--gh-green)] hover:underline"
        >
          Show me around
        </button>
      </div>
    </nav>
  )
}
