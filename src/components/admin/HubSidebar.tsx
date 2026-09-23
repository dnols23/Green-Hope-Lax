'use client'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState, useSyncExternalStore } from 'react'
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

/* Which heading sits above which. Kept in this browser like the rest of the
   coach's own arrangement: a JV coach wants JV at the top, the head coach
   wants varsity, and neither is anybody else's business. */
const GROUP_KEY = 'gh-hub-groups-v1'
const GROUP_EVENT = 'gh-hub-groups-changed'

/* Opening and shutting the phone drawer from elsewhere — the walk-round needs
   it open before it can point at anything in it. */
export const DRAWER_EVENT = 'gh-hub-drawer'

function readGroups(): string {
  try { return localStorage.getItem(GROUP_KEY) ?? '' } catch { return '' }
}
function subscribeToGroups(onChange: () => void) {
  window.addEventListener(GROUP_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(GROUP_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

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
export function HubSidebar({ links, noFold = [] }: { links: HubLink[]; noFold?: string[] }) {
  /* Reading the query string suspends, and the sidebar is the first thing on
     the page — so it renders without the team marked and settles a beat later
     rather than holding everything up. */
  return (
    <Suspense fallback={<Rail links={links} team="varsity" noFold={noFold} />}>
      <SidebarWithTeam links={links} noFold={noFold} />
    </Suspense>
  )
}

function SidebarWithTeam({ links, noFold }: { links: HubLink[]; noFold: string[] }) {
  const team = useSearchParams().get('team') === 'jv' ? 'jv' : 'varsity'
  return <Rail links={links} team={team} noFold={noFold} />
}

function Rail({
  links,
  team,
  noFold,
}: {
  links: HubLink[]
  team: string
  /**
   * Headings that don't fold. A coach who works one side of the program has
   * one team heading, and a fold on the only thing there is to look at is a
   * way to hide your own tools from yourself.
   */
  noFold: string[]
}) {
  const pathname = usePathname()
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [drawer, setDrawer] = useState(false)

  // Escape shuts it, and so does the walk-round when it asks.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawer(false) }
    const onAsk = (e: Event) => setDrawer((e as CustomEvent<boolean>).detail === true)
    window.addEventListener('keydown', onKey)
    window.addEventListener(DRAWER_EVENT, onAsk)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(DRAWER_EVENT, onAsk)
    }
  }, [])

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

  /* Then this coach's own order for the headings, with anything new falling in
     where the server put it. */
  const groupJson = useSyncExternalStore(subscribeToGroups, readGroups, () => '')
  let groupOrder: string[] = []
  try { groupOrder = groupJson ? (JSON.parse(groupJson) as string[]) : [] } catch { groupOrder = [] }
  if (groupOrder.length) {
    const byName = new Map(groups.map((g) => [g.name, g]))
    const sorted: typeof groups = []
    for (const name of groupOrder) {
      const found = byName.get(name)
      if (found) { sorted.push(found); byName.delete(name) }
    }
    groups.length = 0
    groups.push(...sorted, ...byName.values())
  }

  function moveGroup(name: string, by: number) {
    const names = groups.map((g) => g.name)
    const from = names.indexOf(name)
    const to = from + by
    if (from < 0 || to < 0 || to >= names.length) return
    names.splice(to, 0, names.splice(from, 1)[0])
    try { localStorage.setItem(GROUP_KEY, JSON.stringify(names)) } catch {}
    window.dispatchEvent(new Event(GROUP_EVENT))
  }

  /* On a phone the rail is a drawer.
   *
   * Stacked above the page it was twenty rows of navigation between a coach
   * and the thing he opened the app for, so he scrolled past his own tools to
   * reach his War Room. Now the War Room is the first thing on the screen and
   * the tools are one tap to the left. On anything wider it is the rail it
   * always was. */
  const here = shown.find((l) => isActive(l.href))

  return (
    <>
      <div className="md:hidden w-full flex items-center gap-2">
        <button
          type="button"
          onClick={() => setDrawer(true)}
          aria-expanded={drawer}
          className="btn btn-ghost !py-1.5 text-sm shrink-0"
        >
          <span aria-hidden className="mr-1.5">☰</span> Tools
        </button>
        {here && (
          <span className="text-sm font-bold text-gray-500 truncate">
            <span aria-hidden className="mr-1">{here.icon}</span>
            {here.group === 'Program' ? here.label : `${here.group} ${here.label}`}
          </span>
        )}
      </div>

      {drawer && (
        <div
          className="md:hidden fixed inset-0 z-[60]"
          style={{ background: 'rgba(17,24,39,0.5)' }}
          onClick={() => setDrawer(false)}
          aria-hidden
        />
      )}

      <nav
        data-tour="sidebar"
        aria-label="Coaching tools"
        className={`shrink-0 md:w-56 md:static md:translate-x-0 md:z-auto md:overflow-visible md:p-0 md:bg-transparent
          fixed inset-y-0 left-0 z-[61] w-72 max-w-[85vw] overflow-y-auto p-3 transition-transform duration-200
          ${drawer ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'var(--surface, #fff)' }}
      >
      <div className="card p-2 space-y-1">
        {groups.map((group) => {
          const fixed = noFold.includes(group.name)
          const isShut = !fixed && folded.includes(group.name)
          const hasOpenPage = group.items.some((l) => isActive(l.href))
          const heading = (
            <span className="text-[0.65rem] font-black tracking-[0.18em] uppercase text-gray-400">
              {group.name}
            </span>
          )
          const first = groups[0]?.name === group.name
          const last = groups[groups.length - 1]?.name === group.name
          /* Up and down on the heading itself: a whole section moves, rather
             than dragging five rows one at a time. */
          const nudgeGroup = (
            <span className="ml-auto hidden group-hover/head:flex items-center">
              <button
                type="button"
                aria-label={`Move ${group.name} up`}
                disabled={first}
                onClick={(e) => { e.stopPropagation(); moveGroup(group.name, -1) }}
                className="px-1 text-xs text-gray-400 hover:text-gray-700 disabled:opacity-25"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move ${group.name} down`}
                disabled={last}
                onClick={(e) => { e.stopPropagation(); moveGroup(group.name, 1) }}
                className="px-1 text-xs text-gray-400 hover:text-gray-700 disabled:opacity-25"
              >
                ↓
              </button>
            </span>
          )
          return (
            <div key={group.name} className="group/head">
              {fixed ? (
                <div className="flex items-center gap-1.5 px-2 py-1.5">{heading}{nudgeGroup}</div>
              ) : (
                /* The arrows sit beside the fold button, not inside it: a
                   button inside a button isn't allowed in HTML, so the server's
                   page came apart in the browser and React had to redraw the
                   whole hub on every load. */
                <div className="flex items-center rounded-lg hover:bg-gray-50">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.name)}
                  aria-expanded={!isShut}
                  className="flex-1 min-w-0 flex items-center gap-1.5 px-2 py-1.5 text-left rounded-lg"
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
                  {heading}
                  {isShut && hasOpenPage && (
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: 'var(--gh-green)' }}
                      aria-label="You are on a page in here"
                    />
                  )}
                </button>
                {nudgeGroup}
                </div>
              )}

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
                          // Going somewhere shuts the drawer, so what you asked
                          // for is what fills the screen.
                          onClick={() => setDrawer(false)}
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
        <p className="text-[0.7rem] text-gray-400">
        Drag ☰ to reorder. ↑↓ on a heading moves the whole section.
      </p>
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
    </>
  )
}
