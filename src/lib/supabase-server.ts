import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { connection } from 'next/server'

// Anon client bound to the request cookies — respects RLS, knows the logged-in
// admin (if any). Use for all normal reads and authenticated admin writes.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — safe to ignore
          }
        },
      },
    }
  )
}

// Anon client with no session at all — the site as a stranger sees it.
//
// "View site" has to mean the real site. The cookie-bound client above carries
// a signed-in coach's session, and the database hands an authenticated reader
// rows a visitor never gets (a hidden coach, an unpublished award), so a public
// page read through it can quietly differ from the one everybody else loads.
// Public pages read through this instead, and the only way to see more is to
// go to /admin.
export async function createPublicClient() {
  // These pages used to render per request only because reading cookies made
  // them do so. Dropping the cookies would quietly turn them into build-time
  // pages, so say out loud that they still wait for a real request.
  await connection()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll() { return [] }, setAll() {} },
    }
  )
}

// Service-role client — BYPASSES RLS. Server-only. Used so form submissions are
// written reliably and the coach-notify email always has the data it needs.
// Never import this into a client component.
export function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll() { return [] }, setAll() {} },
    }
  )
}
