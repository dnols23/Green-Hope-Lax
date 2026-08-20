import { requireSection } from '@/lib/permissions'
import { assertPageVisible } from '@/lib/pages'
import { Library } from '@/components/videoboard/Library'

export const metadata = { title: 'Film Library' }

// The team library, inside the admin panel so coaches keep the menu bar. Full
// width like the board it belongs to — see the (fullbleed) layout.
export default async function AdminFilmLibrary() {
  await requireSection('film')
  // Turned off for coaches in Admin → Pages.
  await assertPageVisible('film-coaches')
  return (
    <div className="flex-1 flex flex-col" style={{ background: '#0b0d0c' }}>
      <Library basePath="/admin/film" />
    </div>
  )
}
