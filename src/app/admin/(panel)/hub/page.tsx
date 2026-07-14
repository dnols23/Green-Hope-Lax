import Link from 'next/link'
import { getCurrentCoach } from '@/lib/coach'

export const metadata = { title: 'Coaches Hub' }

export default async function CoachesHub() {
  const coach = await getCurrentCoach()
  const isHead = coach?.role === 'head'

  const cards = [
    { href: '/admin/hub/evaluate', emoji: '📝', title: 'Evaluate a player', desc: 'Rate a player across skill categories and add notes.', accent: 'var(--gh-green)' },
    { href: '/admin/hub/mine', emoji: '📋', title: 'My evaluations', desc: 'Review and update the evaluations you’ve submitted.', accent: 'var(--gh-green)' },
    ...(isHead
      ? [{ href: '/admin/hub/board', emoji: '📊', title: 'Team evaluation board', desc: 'Compiled scores from every coach — head coach only.', accent: 'var(--gh-maroon)' }]
      : []),
  ]

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <h1 className="text-xl font-black">Coaches Hub</h1>
        {coach && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full border"
            style={isHead
              ? { background: '#fde8ea', color: 'var(--gh-maroon)', borderColor: '#f3c9cd' }
              : { background: '#dcfce7', color: '#15803d', borderColor: '#86efac' }}>
            {isHead ? '★ Head Coach' : 'Assistant Coach'} · {coach.name}
          </span>
        )}
      </div>
      <p className="text-gray-500 text-sm mb-6">
        Player evaluations. Assistant coaches submit their own; the head coach sees the compiled board.
      </p>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="card p-5 hover:shadow-md transition-shadow">
            <div className="text-3xl">{c.emoji}</div>
            <div className="font-black text-lg mt-2" style={{ color: c.accent }}>{c.title}</div>
            <div className="text-sm text-gray-500 mt-1">{c.desc}</div>
          </Link>
        ))}
      </div>

      {!isHead && (
        <p className="text-xs text-gray-400 mt-6">
          The compiled team board is visible to the head coach only.
        </p>
      )}
    </div>
  )
}
