'use client'

import { useState } from 'react'

/** Every address in a list, copied at once — ready to paste into an email's To: line. */
export function CopyEmails({ emails, label }: { emails: string[]; label: string }) {
  const [done, setDone] = useState(false)
  const list = [...new Set(emails.map((e) => e.trim()).filter(Boolean))]
  if (!list.length) return null
  return (
    <button
      type="button"
      className="btn btn-ghost !py-1.5 text-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(list.join(', '))
          setDone(true)
          setTimeout(() => setDone(false), 2000)
        } catch {
          window.prompt('Copy these:', list.join(', '))
        }
      }}
    >
      {done ? `✓ Copied ${list.length}` : `${label} (${list.length})`}
    </button>
  )
}
