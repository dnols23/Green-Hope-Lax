'use client'
import { useCallback, useEffect, useState } from 'react'
import { SlideView, type SlidePlay } from '@/components/playbook/SlideView'
import { isPageKind, type PlaybookPage } from '@/lib/playbook'

/**
 * The playbook on a screen, one page at a time.
 *
 * Arrow keys, a tap on either half, or the buttons. The head coach's notes sit
 * under the page for him and are not rendered at all for anyone else — not
 * hidden with CSS, not sent and concealed: not rendered.
 */
export function Present({
  pages,
  plays,
  title,
  showNotes,
}: {
  pages: PlaybookPage[]
  plays: Record<string, SlidePlay>
  title: string
  showNotes: boolean
}) {
  const [at, setAt] = useState(0)
  const last = pages.length - 1

  const go = useCallback(
    (by: number) => setAt((n) => Math.min(last, Math.max(0, n + by))),
    [last]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); go(1) }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1) }
      if (e.key === 'Home') setAt(0)
      if (e.key === 'End') setAt(last)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, last])

  if (pages.length === 0) {
    return <p className="text-sm text-gray-500">Nothing in the playbook yet.</p>
  }

  const page = pages[at]

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <h1 className="text-lg font-black">{title}</h1>
        <span className="text-xs font-bold text-gray-400 tabular-nums">{at + 1} / {pages.length}</span>
        <span className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => go(-1)} disabled={at === 0}
            className="btn btn-ghost !py-1.5 text-sm disabled:opacity-40">← Back</button>
          <button type="button" onClick={() => go(1)} disabled={at === last}
            className="btn btn-primary !py-1.5 text-sm disabled:opacity-40">Next →</button>
        </span>
      </div>

      <div
        className={`card bg-white overflow-hidden ${isPageKind(page.layout) ? '' : 'p-5 sm:p-8'}`}
        style={{ aspectRatio: '16 / 9' }}
      >
        <SlideView page={page} plays={plays} />
      </div>

      {showNotes && page.notes && (
        <div className="card p-4 mt-3">
          <div className="section-label mb-1">What you say</div>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{page.notes}</p>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-3">Arrow keys, space, Home and End all work.</p>
    </div>
  )
}
