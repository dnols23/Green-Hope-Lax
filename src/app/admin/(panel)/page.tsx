import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * The front door, which nobody stays at.
 *
 * A coach signs in to coach, so everybody lands in the War Room — the head
 * coach included. The site's own numbers moved to /admin/dashboard, which is a
 * menu item rather than the thing in your face every morning.
 *
 * It redirects here rather than at the sign-in button so it catches every way
 * in at once: signing in, finishing a first-time password, and being bounced
 * back off the login page while already signed in.
 */
export default function AdminFrontDoor() {
  redirect('/admin/hub')
}
