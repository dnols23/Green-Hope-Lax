import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase-server'
import { joinLinkValid } from '@/lib/joinLinks'
import { listPlayerAccess } from '@/lib/playerAccess'
import { PlayerJoinForm } from '@/components/team/PlayerJoinForm'
import { FalconHead } from '@/components/Logo'
import type { Player } from '@/lib/types'

export const metadata = { title: 'Join the Team Hub', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/**
 * One link for the whole squad.
 *
 * He picks himself off the roster instead of typing a name: a free-text name on
 * a shared link is a stranger's way in, and it spells "Cayden" four ways by
 * Thursday. Once he picks, the link he gets is his own, so everything after
 * this knows exactly who is looking.
 */
export default async function PlayerJoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!(await joinLinkValid('player', token))) notFound()

  const svc = createServiceClient()
  const [{ data: rows }, access] = await Promise.all([
    svc.from('players').select('*').eq('is_active', true).order('name'),
    listPlayerAccess(),
  ])
  const players = (rows ?? []) as Player[]

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: 'var(--surface-2)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <FalconHead size={52} className="mx-auto mb-3" />
          <h1 className="text-2xl font-black">Falcons Team Hub</h1>
          <p className="text-gray-600 mt-1">
            Find your name. You will stay signed in on this phone, and everything the coaches put
            up for you is behind it.
          </p>
        </div>
        <PlayerJoinForm
          token={token}
          players={players.map((p) => ({
            id: p.id,
            name: p.name,
            number: p.number,
            claimed: !!access[p.id] && !access[p.id].revokedAt && !!access[p.id].lastSeenAt,
          }))}
        />
      </div>
    </div>
  )
}
