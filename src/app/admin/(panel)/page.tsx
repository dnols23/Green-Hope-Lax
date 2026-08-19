import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { getViewer, canSee } from '@/lib/permissions'

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
  const [c, viewer] = await Promise.all([counts(), getViewer()])

  // Each tile names the section it belongs to, so a coach never sees a count for
  // something they can't open — Submissions in particular carries parent contacts.
  const cards = [
    { section: 'submissions', href: '/admin/submissions?tab=swfl', label: 'Fall league signups', value: c.swfl_signups, accent: 'var(--gh-maroon)' },
    { section: 'submissions', href: '/admin/submissions?tab=high_school', label: 'Interest submissions', value: c.interest_form_submissions, accent: 'var(--gh-maroon)' },
    { section: 'submissions', href: '/admin/submissions?tab=contact', label: 'Contact messages', value: c.contact_submissions, accent: 'var(--gh-maroon)' },
    { section: 'roster', href: '/admin/roster', label: 'Players', value: c.players, accent: 'var(--gh-green)' },
    { section: 'schedule', href: '/admin/schedule', label: 'Games', value: c.games, accent: 'var(--gh-green)' },
    { section: 'news', href: '/admin/news', label: 'News posts', value: c.news_posts, accent: 'var(--gh-green)' },
    { section: 'coaches', href: '/admin/coaches', label: 'Coaches', value: c.coaches, accent: 'var(--gh-green)' },
    { section: 'shop', href: '/admin/shop', label: 'Store products', value: c.products, accent: 'var(--gh-maroon)' },
  ].filter((card) => canSee(viewer, card.section))

  const isOwner = viewer?.isOwner ?? false

  return (
    <div>
      <h1 className="text-xl font-black mb-1">{isOwner ? 'Dashboard' : `Welcome, ${viewer?.name ?? 'Coach'}`}</h1>
      <p className="text-gray-500 text-sm mb-6">
        {isOwner
          ? 'Manage the Falcons lacrosse site.'
          : 'Your coaching tools are in the bar above.'}
      </p>

      {cards.length > 0 && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          {cards.map((card, i) => (
            <Link key={i} href={card.href} className="card p-5 hover:shadow-md transition-shadow">
              <div className="text-3xl font-black" style={{ color: card.accent }}>{card.value}</div>
              <div className="text-sm text-gray-500 mt-1">{card.label}</div>
            </Link>
          ))}
        </div>
      )}

      {cards.length === 0 && (
        <div className="card p-6">
          <p className="text-sm text-gray-600">
            Head to the <Link href="/admin/hub" className="font-bold text-[var(--gh-green)]">Coaches Hub</Link> for
            player evaluations, or the <Link href="/team/video" className="font-bold text-[var(--gh-green)]">Film Room</Link> for video.
          </p>
        </div>
      )}
    </div>
  )
}
