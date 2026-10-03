import { notFound } from 'next/navigation'
import { requireSection } from '@/lib/permissions'
import { createServiceClient } from '@/lib/supabase-server'
import { PlayerPrintSheet } from '@/components/team/PlayerPrintSheet'
import type { Player } from '@/lib/types'

export const metadata = { title: 'Print', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/** A player's evaluation or drill set on paper, printed from his profile. */
export default async function CoachPrintPlayer({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireSection('hub')
  const { id } = await params
  const { part } = await searchParams
  const { data } = await createServiceClient().from('players').select('*').eq('id', id).maybeSingle()
  const player = data as Player | null
  if (!player) notFound()
  return <PlayerPrintSheet player={player} part={part === 'eval' || part === 'set' ? part : 'all'} />
}
