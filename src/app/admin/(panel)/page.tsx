import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'

async function counts() {
  const supabase = await createClient()
  const tables = ['swfl_signups', 'interest_form_submissions', 'contact_submissions', 'players', 'games', 'news_posts', 'coaches', 'products'] as const
  const entries = await Promise.all(
    tables.map(async (t) => {
      const { count } = await supabase.from(t).select('*', { count: 'exact', head: true })
      return [t, count ?? 0] as const
    })
  )
  return Object.fromEntries(entries) as Record<(typeof tables)[number], number>
}

export default async function AdminDashboard() {
  const c = await counts()
  const cards = [
    { href: '/admin/submissions?tab=swfl', label: 'Fall league signups', value: c.swfl_signups, accent: 'var(--gh-maroon)' },
    { href: '/admin/submissions?tab=high_school', label: 'Interest submissions', value: c.interest_form_submissions, accent: 'var(--gh-maroon)' },
    { href: '/admin/submissions?tab=contact', label: 'Contact messages', value: c.contact_submissions, accent: 'var(--gh-maroon)' },
    { href: '/admin/roster', label: 'Players', value: c.players, accent: 'var(--gh-green)' },
    { href: '/admin/schedule', label: 'Games', value: c.games, accent: 'var(--gh-green)' },
    { href: '/admin/news', label: 'News posts', value: c.news_posts, accent: 'var(--gh-green)' },
    { href: '/admin/coaches', label: 'Coaches', value: c.coaches, accent: 'var(--gh-green)' },
    { href: '/admin/shop', label: 'Store products', value: c.products, accent: 'var(--gh-maroon)' },
  ]
  return (
    <div>
      <h1 className="text-xl font-black mb-1">Dashboard</h1>
      <p className="text-gray-500 text-sm mb-6">Manage the Falcons lacrosse site.</p>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        {cards.map((card, i) => (
          <Link key={i} href={card.href} className="card p-5 hover:shadow-md transition-shadow">
            <div className="text-3xl font-black" style={{ color: card.accent }}>{card.value}</div>
            <div className="text-sm text-gray-500 mt-1">{card.label}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
