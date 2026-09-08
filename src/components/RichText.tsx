import { linkify } from '@/lib/linkify'

/**
 * A plain-text body with any pasted links made clickable.
 *
 * Bodies are typed into a textarea, so this is the only place a link can come
 * from — no HTML is ever rendered, the text is escaped by React as usual.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      {linkify(text).map((piece, i) =>
        typeof piece === 'string' ? (
          piece
        ) : (
          <a
            key={i}
            href={piece.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline break-words"
            style={{ color: 'var(--gh-green)' }}
          >
            {piece.label}
          </a>
        )
      )}
    </div>
  )
}
