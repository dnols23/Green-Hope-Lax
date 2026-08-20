import { requireSection } from '@/lib/permissions'
import { Library } from '@/components/videoboard/Library'

export const metadata = { title: 'Film Library' }

// The team library, inside the admin panel so coaches keep the menu bar.
export default async function AdminFilmLibrary() {
  await requireSection('film')
  return (
    <div className="-mx-4 -my-6" style={{ background: '#0b0d0c', minHeight: 'calc(100svh - 4.25rem)' }}>
      <Library basePath="/admin/film" />
    </div>
  )
}
