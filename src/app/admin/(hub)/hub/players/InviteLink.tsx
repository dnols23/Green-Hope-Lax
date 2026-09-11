'use client'
import { useState } from 'react'

/** The link a coach actually sends. Copying it is the whole job. */
export function InviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url)
        } catch {
          // Clipboard refused (an insecure context, usually) — the link is still
          // on screen to copy by hand.
        }
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="text-xs font-bold"
      style={{ color: 'var(--gh-green)' }}
      title={url}
    >
      {copied ? 'Copied ✓' : 'Copy invite link'}
    </button>
  )
}
