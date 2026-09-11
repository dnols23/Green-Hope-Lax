'use client'
import { useState, useSyncExternalStore } from 'react'

const ORDER_KEY = 'gh-warroom-order-v1'
const ORDER_EVENT = 'gh-warroom-order-changed'

function readOrder(): string {
  try { return localStorage.getItem(ORDER_KEY) ?? '' } catch { return '' }
}
function subscribe(onChange: () => void) {
  window.addEventListener(ORDER_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(ORDER_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

export interface Panel {
  key: string
  title: string
  body: React.ReactNode
}

/**
 * The War Room's panels, in this coach's own order.
 *
 * Same grip as the sidebar: drag a panel's handle and it moves. The order is
 * kept in that coach's browser — the head coach wants today's plan first, the
 * goalie coach wants the schedule.
 */
export function WarRoomPanels({ panels }: { panels: Panel[] }) {
  const [dragKey, setDragKey] = useState<string | null>(null)
  const savedJson = useSyncExternalStore(subscribe, readOrder, () => '')

  let saved: string[] = []
  try { saved = savedJson ? (JSON.parse(savedJson) as string[]) : [] } catch { saved = [] }

  const byKey = new Map(panels.map((p) => [p.key, p]))
  const ordered: Panel[] = []
  for (const key of saved) {
    const found = byKey.get(key)
    if (found) { ordered.push(found); byKey.delete(key) }
  }
  const shown = [...ordered, ...byKey.values()]

  function persist(next: Panel[]) {
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(next.map((p) => p.key))) } catch {}
    window.dispatchEvent(new Event(ORDER_EVENT))
  }

  function dropOn(targetKey: string) {
    if (!dragKey || dragKey === targetKey) return
    const moved = shown.find((p) => p.key === dragKey)
    if (!moved) return
    const next = shown.filter((p) => p.key !== dragKey)
    next.splice(next.findIndex((p) => p.key === targetKey), 0, moved)
    persist(next)
    setDragKey(null)
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {shown.map((p) => (
        <section
          key={p.key}
          draggable
          onDragStart={() => setDragKey(p.key)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => dropOn(p.key)}
          onDragEnd={() => setDragKey(null)}
          className="card p-4"
          style={{ opacity: dragKey === p.key ? 0.4 : 1 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="cursor-grab select-none text-gray-300 text-sm" title="Drag to move this panel">☰</span>
            <h2 className="font-black text-gray-700 text-sm tracking-wide uppercase">{p.title}</h2>
          </div>
          {p.body}
        </section>
      ))}
    </div>
  )
}
