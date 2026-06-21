import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Team Hub | Green Hope Falcons Lacrosse',
  robots: { index: false, follow: false }, // private area — keep out of search
}

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen" style={{ background: 'var(--surface-2)' }}>{children}</div>
}
