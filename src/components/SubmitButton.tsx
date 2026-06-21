'use client'
import { useFormStatus } from 'react-dom'

export function SubmitButton({
  children,
  pendingText = 'Submitting…',
  className = 'btn btn-primary w-full',
}: {
  children: React.ReactNode
  pendingText?: string
  className?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-60`}>
      {pending ? pendingText : children}
    </button>
  )
}
