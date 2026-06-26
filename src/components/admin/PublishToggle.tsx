'use client'
import { useState, useTransition } from 'react'
import { setVisibility } from '@/lib/actions'
import type { VisibilityEntity } from '@/lib/types'

// One-click live/hidden switch used on every content admin page. Optimistically
// flips so the button updates instantly, then persists via the server action.
export function PublishToggle({
  entity,
  id,
  live,
}: {
  entity: VisibilityEntity
  id: string
  live: boolean
}) {
  const [on, setOn] = useState(live)
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      title={on ? 'Live on the public site — click to hide' : 'Hidden — click to make it live'}
      aria-pressed={on}
      onClick={() => {
        const next = !on
        setOn(next)
        startTransition(async () => {
          try {
            await setVisibility(entity, id, next)
          } catch {
            setOn(!next) // revert on failure
          }
        })
      }}
      className="text-xs font-bold px-2.5 py-1 rounded-full border transition-colors disabled:opacity-50"
      style={
        on
          ? { background: '#dcfce7', color: '#15803d', borderColor: '#86efac' }
          : { background: '#f3f4f6', color: '#6b7280', borderColor: '#d1d5db' }
      }
    >
      {on ? '● Live' : '○ Hidden'}
    </button>
  )
}
