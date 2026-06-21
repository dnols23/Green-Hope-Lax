import type { Game } from '@/lib/types'
import { formatDate, formatTime, homeAwayLabel } from '@/lib/format'

export function NextGameCard({ game }: { game: Game | null }) {
  if (!game) {
    return (
      <div className="card p-6 text-center">
        <div className="section-label mb-1">Next Game</div>
        <p className="text-gray-500 text-sm mt-2">No upcoming games scheduled yet. Check back soon!</p>
      </div>
    )
  }
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-2 text-white text-xs font-black tracking-widest" style={{ background: 'var(--gh-maroon)' }}>
        NEXT GAME
      </div>
      <div className="p-6">
        <div className="text-3xl font-black tracking-tight">
          <span style={{ color: 'var(--gh-green)' }}>Falcons</span>{' '}
          <span className="text-gray-400 text-xl font-bold">{homeAwayLabel(game)}</span>{' '}
          {game.opponent}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
          <span className="font-semibold">{formatDate(game.game_date, { weekday: 'long' })}</span>
          <span>{formatTime(game.game_date)}</span>
          {game.location && <span>📍 {game.location}</span>}
          {game.is_conference && <span className="badge badge-conf">Conference</span>}
        </div>
      </div>
    </div>
  )
}
