'use client'
import { useState } from 'react'

/**
 * The link, and an email already written around it.
 *
 * A coach pasting a bare URL into a team email writes the same three sentences
 * every season; this hands them over so the job is one click and a send.
 */
export function JoinLinkPanel({ joinUrl }: { joinUrl: string }) {
  const [copied, setCopied] = useState<'link' | 'email' | null>(null)

  const email = `Falcons families —

We've opened a Parent Hub for the program. It's where the sign-up sheets live: who's bringing water, who's driving, who's working the table.

Follow this link once on your phone and you're in — no password to remember:

${joinUrl}

Add your name, your email and your player, and you'll see everything we need hands for. You'll get an email confirming whatever you sign up for.

Go Falcons,
Coach Nolan`

  async function copy(text: string, which: 'link' | 'email') {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(which)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setCopied(null)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <div className="field-label mb-1">Parent Hub link</div>
          <code className="text-sm font-semibold break-all" style={{ color: 'var(--gh-green-dk)' }}>
            {joinUrl}
          </code>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => copy(joinUrl, 'link')} className="btn btn-ghost text-xs">
            {copied === 'link' ? 'Copied' : 'Copy link'}
          </button>
          <button type="button" onClick={() => copy(email, 'email')} className="btn btn-primary text-xs">
            {copied === 'email' ? 'Copied' : 'Copy the whole email'}
          </button>
        </div>
      </div>
      <details className="mt-3">
        <summary className="text-xs text-gray-500 cursor-pointer">Preview the email</summary>
        <pre className="mt-2 text-xs text-gray-600 whitespace-pre-wrap font-sans">{email}</pre>
      </details>
    </div>
  )
}
