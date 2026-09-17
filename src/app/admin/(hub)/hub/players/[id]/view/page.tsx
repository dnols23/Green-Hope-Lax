import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSection } from '@/lib/permissions'
import { createServiceClient } from '@/lib/supabase-server'
import { PlayerWork } from '@/components/team/PlayerWork'
import type { Player } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data } = await createServiceClient().from('players').select('name').eq('id', id).maybeSingle()
  const name = (data as { name?: string } | null)?.name
  return { title: name ? `${name} — his view` : 'Player view' }
}

/** What he sees when he follows his link, without having to borrow his phone. */
export default async function PlayerViewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSection('hub')
  const { id } = await params
  const { data } = await createServiceClient().from('players').select('*').eq('id', id).maybeSingle()
  const player = data as Player | null
  if (!player) notFound()

  return (
    <div className="-m-4 sm:-m-6">
      <div className="px-4 pt-4">
        <Link href={`/admin/hub/players/${player.id}`} className="text-sm font-bold text-[var(--gh-green)]">
          ← Back to his profile
        </Link>
      </div>
      <PlayerWork player={player} preview />
    </div>
  )
}
