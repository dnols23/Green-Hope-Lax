import { requireSection } from '@/lib/permissions'
import { assertPageVisible } from '@/lib/pages'
import { Library } from '@/components/videoboard/Library'

export const metadata = { title: 'Film Library' }

// The team library, inside the admin panel so coaches keep the menu bar.
export default async function AdminFilmLibrary() {
  await requireSection('film')
  // Turned off for coaches in Admin → Pages.
  await assertPageVisible('film-coaches')
  return (
    <div className="-mx-4 -my-6" style={{ background: '#0b0d0c', minHeight: 'calc(100svh - 4.25rem)' }}>
      <Library basePath="/admin/film" />
    </div>
  )
}
