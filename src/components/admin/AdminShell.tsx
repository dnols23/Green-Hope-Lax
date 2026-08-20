import Link from 'next/link'
import { redirect } from 'next/navigation'
import { logout } from '@/lib/actions'
import { createClient, createServiceClient } from '@/lib/supabase-server'
import { getViewer, visibleSections } from '@/lib/permissions'
import { isPageOn } from '@/lib/pages'
import { FalconHead } from '@/components/Logo'

/**
 * The admin chrome: green menu bar across the top, then the page.
 *
 * Most pages want the usual centred column, so the (panel) layout wraps them in
 * one. The Film Room wants the whole width — a max-width container would box the
 * board into the middle of the screen — so the (fullbleed) layout renders its
 * children straight under the bar instead. Both get the same menu and the same
 * first-login password check.
 */
export async function AdminShell({
  children,
  fullBleed = false,
}: {
  children: React.ReactNode
  fullBleed?: boolean
}) {
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

  // Nav is built from what this viewer may actually open. Pages enforce the same
  // rule themselves via requireSection, so hiding a link is presentation only —
  // typing the URL still gets a 404.
  const viewer = await getViewer()
  // Film Room can be switched off for coaches in Admin → Pages; the page itself
  // 404s either way, this just stops advertising a door that's shut.
  const filmOn = await isPageOn('film-coaches')
  const links = visibleSections(viewer).filter((s) => s.key !== 'film' || filmOn)
  const tier = viewer?.isOwner ? 'Admin' : 'Coaches'

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="text-white shrink-0" style={{ background: 'var(--gh-green-dk)' }}>
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="flex items-center gap-2 font-black">
              <FalconHead size={28} /> Falcons <span className="text-white/50 font-normal text-sm">{tier}</span>
            </Link>
            <nav className="hidden md:flex gap-1">
              {links.map(({ href, label }) => (
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
            {links.map(({ href, label }) => (
              <Link key={href} href={href} className="px-3 py-1.5 text-xs font-semibold text-white/75 hover:text-white hover:bg-white/10 rounded whitespace-nowrap">
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* A full-bleed page takes whatever height the bar leaves — no magic numbers,
          so the taller mobile menu doesn't push it off the bottom. */}
      {fullBleed ? (
        <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 py-6 w-full">{children}</div>
      )}
    </div>
  )
}
