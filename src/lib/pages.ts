import { notFound } from 'next/navigation'
import { getPageSettings } from './queries'

// Guard a public page: if an admin has toggled it Hidden in /admin → Pages,
// return a 404 so the page can't be reached by direct URL either. Pages with no
// settings row (not seeded) default to visible.
export async function assertPageVisible(key: string): Promise<void> {
  const pages = await getPageSettings()
  const page = pages.find((p) => p.key === key)
  if (page && !page.is_published) notFound()
}
