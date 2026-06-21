import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://greenhopelacrosse.com'),
  title: {
    default: 'Green Hope Falcons Lacrosse',
    template: '%s | Green Hope Falcons Lacrosse',
  },
  description:
    'Official home of Green Hope High School Falcons lacrosse in Cary, NC — schedule, results, rosters, news, and how to join the team.',
  keywords: ['Green Hope', 'Falcons', 'lacrosse', 'Cary NC', 'NCHSAA', 'high school lacrosse'],
  openGraph: {
    title: 'Green Hope Falcons Lacrosse',
    description: 'Schedule, rosters, news, and how to join the Falcons lacrosse program.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
