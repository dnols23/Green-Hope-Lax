import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { TEAM_COOKIE, teamCookieToken } from './lib/teamAuth'

// Protects /admin/* — redirects to login when not authenticated, and away from
// the login page when already signed in. (Next.js 16 renamed middleware → proxy.)
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const path = request.nextUrl.pathname

  // ── Admin area (coach) — Supabase auth ──
  const isAdminRoute = path.startsWith('/admin')
  const isAdminLogin = path === '/admin/login'
  if (isAdminRoute) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!isAdminLogin && !user) {
      const url = request.nextUrl.clone(); url.pathname = '/admin/login'
      return NextResponse.redirect(url)
    }
    if (isAdminLogin && user) {
      const url = request.nextUrl.clone(); url.pathname = '/admin'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // ── Team Hub (parents/players) — shared password cookie. A signed-in
  // coach (Supabase admin) gets in too, without registering. ──
  const isTeamRoute = path.startsWith('/team')
  const isTeamLogin = path === '/team/login'
  if (isTeamRoute) {
    const token = request.cookies.get(TEAM_COOKIE)?.value
    let valid = !!token && token === (await teamCookieToken())
    if (!valid) {
      const { data: { user } } = await supabase.auth.getUser()
      valid = !!user
    }
    if (!isTeamLogin && !valid) {
      const url = request.nextUrl.clone(); url.pathname = '/team/login'
      return NextResponse.redirect(url)
    }
    if (isTeamLogin && valid) {
      const url = request.nextUrl.clone(); url.pathname = '/team'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/admin/:path*', '/team/:path*'],
}
