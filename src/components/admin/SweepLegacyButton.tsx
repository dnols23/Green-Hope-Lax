'use client'
import { useTransition } from 'react'

// Files stragglers that came in on an older build into their proper collection.
export function SweepLegacyButton({
  count,
  action,
}: {
  count: number
  action: () => Promise<void>
}) {
  const [pending, startTransition] = useTransition()
  return (
    <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between flex-wrap gap-3">
      <p className="text-sm text-amber-900">
        <span className="font-bold">
          {count} submission{count === 1 ? '' : 's'} still filed the old way.
        </span>{' '}
        {count === 1 ? 'It' : 'They'} came in before this update and{' '}
        {count === 1 ? 'is' : 'are'} sitting in the wrong tab.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => action())}
        className="btn btn-maroon text-sm disabled:opacity-50"
      >
        {pending ? 'Filing…' : 'File them correctly'}
      </button>
    </div>
  )
}
