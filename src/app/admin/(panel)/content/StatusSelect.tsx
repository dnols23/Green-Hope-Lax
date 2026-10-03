'use client'

import { useState, useTransition } from 'react'
import { setContentStatus } from '@/lib/contentActions'
import { CONTENT_STATUSES, STATUS_LABELS, type ContentStatus } from '@/lib/content'

/** A video's status, saved the moment it changes. Refused moves say why. */
export function StatusSelect({ id, status }: { id: string; status: ContentStatus }) {
  const [value, setValue] = useState(status)
  const [error, setError] = useState<string | null>(null)
  const [saving, start] = useTransition()
  return (
    <div>
      <select
        value={value}
        disabled={saving}
        aria-label="Status"
        onChange={(e) => {
          const next = e.target.value as ContentStatus
          const prev = value
          setValue(next)
          setError(null)
          start(async () => {
            const r = await setContentStatus(id, next)
            if (!r.ok) {
              setValue(prev)
              setError(r.error)
            }
          })
        }}
        className="field !py-1 !px-2 text-xs w-full"
      >
        {CONTENT_STATUSES.map((s) => (
          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
        ))}
      </select>
      {error && (
        <p className="text-xs font-semibold text-red-700 mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
