import { NextResponse, type NextRequest } from 'next/server'
import { PLAYER_COOKIE } from '@/lib/playerAccess.edge'
import { playerForToken, touchPlayerToken } from '@/lib/playerAccess'
import { TEAM_COOKIE, teamCookieToken } from '@/lib/teamAuth'

/**
 * Following an invite link.
 *
 * The link is the sign-in: no password to forget, nothing for a coach to
 * administer. It sets two cookies — one saying which player this is, one for the
 * Team Hub itself, so a player who only ever gets the link still sees the team
 * feed. A dead or revoked token lands on the ordinary team login rather than an
 * error page, because the most likely holder of a bad link is a confused parent.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const player = await playerForToken(token)

  if (!player) {
    return NextResponse.redirect(new URL('/team/login?invite=expired', _req.url))
  }

  await touchPlayerToken(token)

  const res = NextResponse.redirect(new URL('/team/me', _req.url))
  const year = 60 * 60 * 24 * 365
  res.cookies.set(PLAYER_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: year,
    path: '/',
  })
  res.cookies.set(TEAM_COOKIE, await teamCookieToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: year,
    path: '/',
  })
  return res
}
