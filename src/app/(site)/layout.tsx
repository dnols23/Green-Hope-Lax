import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { getPageSettings } from '@/lib/queries'

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const pages = await getPageSettings()
  const hidden = pages.filter((p) => !p.is_published).map((p) => p.href)
  return (
    <div className="min-h-full flex flex-col">
      <Nav hidden={hidden} />
      <main className="flex-1 pt-16">{children}</main>
      <Footer />
    </div>
  )
}
