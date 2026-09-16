import { requireSection } from '@/lib/permissions'
import { PlayboardClient } from './PlayboardClient'

export const metadata = { title: 'Playboard' }

export default async function PlayboardPage() {
  await requireSection('playboard')
  return <PlayboardClient />
}
