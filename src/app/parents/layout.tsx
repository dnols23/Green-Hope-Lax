import type { Metadata } from 'next'
import Link from 'next/link'
import { FalconHead } from '@/components/Logo'

export const metadata: Metadata = {
  title: 'Parent Hub | Green Hope Falcons Lacrosse',
  robots: { index: false, follow: false }, // private area — keep out of search
}

export default function ParentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--surface-2)' }}>
      <header className="shadow-sm" style={{ background: 'var(--gh-green-dk)' }}>
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-3">
          <Link href="/parents" className="flex items-center gap-2.5">
            <FalconHead size={36} />
            <span className="flex flex-col leading-none">
              <span className="text-white font-black tracking-tight">GREEN HOPE</span>
              <span className="font-black text-[0.6rem] tracking-[0.25em]" style={{ color: '#f3c9cd' }}>
                PARENT HUB
              </span>
            </span>
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
