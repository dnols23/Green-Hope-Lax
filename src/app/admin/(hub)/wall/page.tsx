import { requireSection } from '@/lib/permissions'
import { loadWall } from '@/lib/wallData'
import { ymdOf } from '@/lib/zoned'
import { WallClient } from '@/components/wall/WallClient'

export const metadata = { title: 'On the Wall' }
export const dynamic = 'force-dynamic'

/**
 * On the Wall — the quote library and its playlists.
 *
 * Every coach can add quotes, heart them and make playlists; a shared playlist
 * plays on anybody's War Room wall, a private one only on its maker's. Only the
 * coach who made a playlist, or the head of the program, can change it.
 */
export default async function WallPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const viewer = await requireSection('wall')
  const sp = await searchParams
  const list = typeof sp.list === 'string' ? sp.list : null
  const lib = await loadWall(viewer)
  return <WallClient lib={lib} today={ymdOf(new Date())} initial={list} />
}
