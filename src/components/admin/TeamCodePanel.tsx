'use client'
import { useState } from 'react'

// Shows the current Team Hub code so a coach can read it out or paste it into a
// join email. `code` is null for a password set before the code was recorded —
// only its hash exists then, and a hash can't be turned back into the password.
export function TeamCodePanel({ code, joinUrl }: { code: string | null; joinUrl: string }) {
  const [shown, setShown] = useState(true)
  const [copied, setCopied] = useState<'code' | 'steps' | null>(null)

  const steps = code
    ? `Falcons Team Hub — how to get in

1. Go to ${joinUrl}
2. Enter the team password: ${code}
3. Add your name, email, and phone so the coaches can reach you.

Inside you'll find practice times, game details, forms, and announcements from
the coaching staff. The same password works for every Falcons family — please
keep it within our program.`
    : ''

  async function copy(text: string, which: 'code' | 'steps') {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(which)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setCopied(null)
    }
  }

  if (!code) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-4">
        <p className="text-sm text-amber-900">
          <span className="font-bold">The current password can&rsquo;t be shown yet.</span> It was
          saved as a one-way hash, which can&rsquo;t be turned back into the original. Set a new
          password below and it will appear here — with copyable join instructions — from then on.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 mb-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="field-label mb-1">Current password</div>
          <code className="text-lg font-bold tracking-wide" style={{ color: 'var(--gh-green-dk)' }}>
            {shown ? code : '•'.repeat(Math.max(code.length, 8))}
          </code>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => setShown((s) => !s)} className="btn btn-ghost text-xs">
            {shown ? 'Hide' : 'Show'}
          </button>
          <button type="button" onClick={() => copy(code, 'code')} className="btn btn-ghost text-xs">
            {copied === 'code' ? 'Copied' : 'Copy password'}
          </button>
          <button type="button" onClick={() => copy(steps, 'steps')} className="btn btn-primary text-xs">
            {copied === 'steps' ? 'Copied' : 'Copy join instructions'}
          </button>
        </div>
      </div>
      <details className="mt-3">
        <summary className="text-xs text-gray-500 cursor-pointer">Preview join instructions</summary>
        <pre className="mt-2 text-xs text-gray-600 whitespace-pre-wrap font-sans">{steps}</pre>
      </details>
    </div>
  )
}
