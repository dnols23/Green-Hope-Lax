import { notFound } from 'next/navigation'
import { requireOwner } from '@/lib/permissions'
import { listPlays } from '@/lib/plays'
import { listShots } from '@/lib/library'
import { getPage } from '@/lib/playbookData'
import { PageEditor } from './PageEditor'

export const metadata = { title: 'Playbook page' }
export const dynamic = 'force-dynamic'

export default async function PlaybookPageEditor({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner()
  const { id } = await params
  const page = await getPage(id)
  if (!page) notFound()

  const [plays, shots] = await Promise.all([listPlays(), listShots()])

  return (
    <PageEditor
      page={page}
      plays={plays.map((p) => ({ id: p.id, name: p.name, board: p.board }))}
      shots={shots.map((s) => ({ id: s.id, title: s.title, url: s.url }))}
    />
  )
}
