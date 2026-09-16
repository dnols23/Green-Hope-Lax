import Link from 'next/link'
import type { Player } from '@/lib/types'

// Says, unmissably, that this is not the coach's own page. Without it a coach
// reads a player's evaluation on screen and has no way to tell whether they are
// looking at the real thing or a stand-in.
export function PreviewBanner({ player, back = '/admin/team' }: { player: Player; back?: string }) {
  return (
    <div
      className="text-white text-sm print:hidden"
      style={{ background: 'var(--gh-maroon)' }}
    >
      <div className="max-w-screen-lg mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span>
          👁 You are seeing this as <strong>{player.name}</strong> sees it. Nothing you do here
          is recorded against {player.name.split(' ')[0]}.
        </span>
        <Link href={back} className="font-bold underline underline-offset-2 whitespace-nowrap">
          Back to the editor
        </Link>
      </div>
    </div>
  )
}
