import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Team Hub | Green Hope Falcons Lacrosse',
  robots: { index: false, follow: false }, // private area — keep out of search
}

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  // app-theme: the Coaches Hub's light and dark palette, so the moon button works here too.
  return <div className="app-theme min-h-screen" style={{ background: 'var(--surface-2)' }}>{children}</div>
}
