import Link from 'next/link'

/**
 * A player's name, anywhere it appears, going to the one page about him.
 *
 * Every list had a name and a different next step — evaluate him, invite him,
 * edit his roster row — and none of them was "tell me about this kid". One
 * destination, reached the way people already try: by clicking the name.
 */
export function PlayerLink({
  id,
  name,
  number,
  className = '',
}: {
  id: string
  name: string
  number?: number | string | null
  className?: string
}) {
  return (
    <Link
      href={`/admin/hub/players/${id}`}
      className={`font-semibold hover:underline decoration-[var(--gh-green)] decoration-2 underline-offset-2 ${className}`}
    >
      {number ? <span className="text-gray-400 mr-1">#{number}</span> : null}
      {name}
    </Link>
  )
}
