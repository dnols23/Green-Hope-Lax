'use client'

/**
 * A drill's link, inside the row that opens the drill.
 *
 * It has to swallow the click, or opening the video also toggles the row open
 * behind it. That one handler is why this is a client component: an event
 * handler on an element rendered by a server component is not a style choice,
 * it throws — which is how the whole Drill Bank went down the moment the bank
 * had a drill with a link in it.
 */
export function DrillLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="text-xs font-bold ml-auto"
      style={{ color: 'var(--gh-green)' }}
    >
      {label} ↗
    </a>
  )
}
