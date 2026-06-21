import Link from 'next/link'
import { redirect } from 'next/navigation'
import { logout } from '@/lib/actions'
import { createClient, createServiceClient } from '@/lib/supabase-server'
import { FalconHead } from '@/components/Logo'

const ADMIN_LINKS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/team', label: 'Team Hub' },
  { href: '/admin/members', label: 'Members' },
  { href: '/admin/submissions', label: 'Submissions' },
  { href: '/admin/schedule', label: 'Schedule' },
  { href: '/admin/roster', label: 'Roster' },
  { href: '/admin/coaches', label: 'Coaches' },
  { href: '/admin/news', label: 'News' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Force first-login password reset for coaches flagged with must_reset.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const svc = createServiceClient()
    const { data: flag } = await svc
      .from('app_settings')
      .select('key')
      .eq('key', `must_reset:${user.id}`)
      .maybeSingle()
    if (flag) redirect('/admin/reset-password')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="text-white" style={{ background: 'var(--gh-green-dk)' }}>
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="flex items-center gap-2 font-black">
              <FalconHead size={28} /> Falcons <span className="text-white/50 font-normal text-sm">Admin</span>
            </Link>
            <nav className="hidden md:flex gap-1">
              {ADMIN_LINKS.map(({ href, label }) => (
                <Link key={href} href={href} className="px-3 py-1.5 text-sm font-semibold text-white/75 hover:text-white hover:bg-white/10 rounded transition-colors">
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" target="_blank" className="text-xs text-white/60 hover:text-white">View site ↗</Link>
            <form action={logout}>
              <button type="submit" className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded transition-colors">Sign out</button>
            </form>
          </div>
        </div>
        {/* Mobile nav */}
        <div className="md:hidden overflow-x-auto" style={{ background: 'var(--gh-green-darker)' }}>
          <div className="flex gap-1 px-3 py-2 min-w-max">
            {ADMIN_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} className="px-3 py-1.5 text-xs font-semibold text-white/75 hover:text-white hover:bg-white/10 rounded whitespace-nowrap">
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">{children}</div>
    </div>
  )
}
