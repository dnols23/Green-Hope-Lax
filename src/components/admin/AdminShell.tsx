import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase-server'
import { getViewer, visibleSections } from '@/lib/permissions'
import { isPageOn } from '@/lib/pages'
import { AdminMenu } from './AdminMenu'

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
      <AdminMenu links={links} tier={tier} />

      {/* A full-bleed page takes whatever height the bar leaves, measured rather
          than assumed, so nothing hangs off the bottom of the screen. */}
      {fullBleed ? (
        <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 py-6 w-full">{children}</div>
      )}
    </div>
  )
}
