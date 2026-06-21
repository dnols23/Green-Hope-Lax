import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex flex-col">
      <Nav />
      <main className="flex-1 pt-16">{children}</main>
      <Footer />
    </div>
  )
}
