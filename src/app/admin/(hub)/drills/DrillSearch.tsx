'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Search the drill bank as you type: by name, and by anything written on the
 * drill — setup, how it runs, why, equipment. Works over the list the page
 * already drew, so the drills' own forms are untouched.
 */
export function DrillSearch({ listId }: { listId: string }) {
  const [q, setQ] = useState('')
  const [shown, setShown] = useState<number | null>(null)
  const input = useRef<HTMLInputElement>(null)

  /** Hide what doesn't match, open the groups that do, and count. */
  function search(next: string) {
    setQ(next)
    const root = document.getElementById(listId)
    if (!root) return
    const words = next.toLowerCase().split(/\s+/).filter(Boolean)
    let count = 0
    root.querySelectorAll<HTMLElement>('[data-drill-group]').forEach((group) => {
      let inGroup = 0
      group.querySelectorAll<HTMLElement>('[data-drill]').forEach((row) => {
        const hit = words.every((w) => (row.dataset.drill ?? '').includes(w))
        row.hidden = !hit
        if (hit) inGroup++
      })
      group.hidden = inGroup === 0
      if (words.length && inGroup) (group as HTMLDetailsElement).open = true
      count += inGroup
    })
    setShown(words.length ? count : null)
  }

  // "/" jumps to the search, the way it does on most sites.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.key === '/' && !(t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) {
        e.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="sticky top-0 z-10 -mx-1 px-1 py-2" style={{ background: 'var(--surface-2)' }}>
      <div className="relative">
        <svg aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
        </svg>
        <input
          ref={input}
          type="search"
          value={q}
          onChange={(e) => search(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') search('')
          }}
          placeholder="Search drills"
          aria-label="Search drills"
          className="field !pl-9"
        />
      </div>
      {shown !== null && (
        <p className="text-xs text-gray-500 mt-1.5" role="status">
          {shown === 0 ? 'No drills match.' : `${shown} ${shown === 1 ? 'drill' : 'drills'}`}
        </p>
      )}
    </div>
  )
}
