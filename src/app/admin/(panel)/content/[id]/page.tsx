import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSection } from '@/lib/permissions'
import {
  getItem,
  listContentPlayers,
  listDrillOptions,
  listGameOptions,
  listSeries,
  listSnippets,
  readVoiceSettings,
  settleVideo,
  signedAudio,
} from '@/lib/contentData'
import { toEtInput } from '@/lib/content'
import { ContentTabs } from '../ContentTabs'
import { ItemEditor } from './ItemEditor'

export const metadata = { title: 'Instagram · Video' }
export const dynamic = 'force-dynamic'

export default async function ContentItemPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSection('social')
  const { id } = await params
  const item = await getItem(id)
  if (!item) notFound()

  const [series, snippets, players, games, drills, voices, vo, sfx, video] = await Promise.all([
    listSeries(),
    listSnippets(),
    listContentPlayers(),
    listGameOptions(),
    listDrillOptions(),
    readVoiceSettings(),
    signedAudio(item.vo_audio_url, `voiceover-${item.id.slice(0, 8)}.mp3`),
    signedAudio(item.sfx_audio_url, `sfx-${item.id.slice(0, 8)}.mp3`),
    settleVideo(item),
  ])

  return (
    <div className="space-y-4">
      <div>
        <ContentTabs active={null} />
        <Link href="/admin/content" className="text-sm font-bold text-[var(--gh-green)]">← Board</Link>
      </div>
      <ItemEditor
        key={item.id}
        item={item}
        publishInput={toEtInput(item.publish_at)}
        series={series}
        snippets={snippets}
        players={players}
        games={games}
        drills={drills}
        voices={voices.voices}
        voiceKeySet={voices.keySet}
        voAudio={vo}
        sfxAudio={sfx}
        video={video}
      />
    </div>
  )
}
