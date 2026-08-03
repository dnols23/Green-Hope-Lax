'use client'
import { useTransition } from 'react'
import type { PlayerCollection } from '@/lib/types'

const OPTIONS: { value: PlayerCollection; label: string }[] = [
  { value: 'swfl', label: 'SWFL Fall League' },
  { value: 'high_school', label: 'High School Interest' },
  { value: 'green_machine', label: 'Green Machine' },
]

// Re-files a submission that came in on the wrong form. Server action does the
// table move; this is just the picker.
export function MoveSubmission({
  id,
  current,
  action,
}: {
  id: string
  current: PlayerCollection
  action: (id: string, from: PlayerCollection, to: PlayerCollection) => Promise<void>
}) {
  const [pending, startTransition] = useTransition()
  return (
    <select
      aria-label="Move to another collection"
      disabled={pending}
      value={current}
      onChange={(e) => {
        const to = e.target.value as PlayerCollection
        if (to === current) return
        startTransition(() => action(id, current, to))
      }}
      className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white text-gray-600 hover:border-gray-300 disabled:opacity-50"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {pending && o.value === current ? 'Moving…' : o.label}
        </option>
      ))}
    </select>
  )
}
