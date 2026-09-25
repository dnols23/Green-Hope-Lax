import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { FalconHead } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { PARENT_COOKIE } from '@/lib/parentAccess.edge'
import { signOutParent } from '@/lib/hubAccountActions'

export const metadata: Metadata = {
  title: 'Parent Hub | Green Hope Falcons Lacrosse',
  robots: { index: false, follow: false }, // private area — keep out of search
}

export default async function ParentsLayout({ children }: { children: React.ReactNode }) {
  const signedIn = !!(await cookies()).get(PARENT_COOKIE)?.value
  return (
    <div className="app-theme min-h-screen" style={{ background: 'var(--surface-2)' }}>
      <header className="shadow-sm" style={{ background: '#004D2E' }}>
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
          <ThemeToggle className="ml-auto" />
          {signedIn && (
            <form action={signOutParent}>
              <button type="submit" className="text-xs font-bold text-white/70 hover:text-white">
                Sign out
              </button>
            </form>
          )}
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
