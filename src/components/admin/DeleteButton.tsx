'use client'
import { useTransition } from 'react'

export function DeleteButton({
  id,
  action,
  label = 'Delete',
}: {
  id: string
  action: (id: string) => Promise<void>
  label?: string
}) {
  const [pending, startTransition] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm('Are you sure? This cannot be undone.')) return
        startTransition(() => action(id))
      }}
      className="text-xs font-bold text-red-600 hover:text-red-800 disabled:opacity-50"
    >
      {pending ? '…' : label}
    </button>
  )
}
