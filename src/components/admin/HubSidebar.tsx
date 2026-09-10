'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useSyncExternalStore } from 'react'

export interface HubLink {
  key: string
  label: string
  href: string
  icon: string
}

const ORDER_KEY = 'gh-hub-order-v1'
const ORDER_EVENT = 'gh-hub-order-changed'

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
  const pathname = usePathname()
  const [dragKey, setDragKey] = useState<string | null>(null)

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

  const isActive = (href: string) =>
    pathname === href || (href !== '/admin/hub' && pathname.startsWith(`${href}/`))

  return (
    <nav className="w-full md:w-56 shrink-0">
      <div className="card p-2">
        <div className="px-2 py-1.5 text-[0.65rem] font-black tracking-[0.18em] uppercase text-gray-400">
          Coaching
        </div>
        <ul className="flex flex-col gap-0.5">
          {shown.map((l) => {
            const on = isActive(l.href)
            return (
              <li
                key={l.key}
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
      </div>
      <p className="text-[0.7rem] text-gray-400 mt-2 px-1">Drag ☰ to put these in your own order.</p>
    </nav>
  )
}
