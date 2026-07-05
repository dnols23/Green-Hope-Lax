// Shared team-access gate (one password for all parents/players).
// Used by both the server actions (Node) and the proxy (edge) — relies only on
// the Web Crypto API, which exists in both runtimes.

const PEPPER = 'gh-falcons-v1'
export const TEAM_COOKIE = 'gh_team'

async function sha256hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Hash a team password for storage / comparison (stored in app_settings).
export function hashTeamPassword(pw: string): Promise<string> {
  return sha256hex(`${pw}:${PEPPER}`)
}

// Opaque session token placed in the cookie once the password checks out.
// Derived from the server-only service role key, so it can't be forged client-side.
export function teamCookieToken(): Promise<string> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'unset'
  return sha256hex(`team-session:${secret}:${PEPPER}`)
}

// Guard for API route handlers (the proxy only covers /admin and /team pages).
export async function isTeamRequest(req: { cookies: { get(name: string): { value: string } | undefined } }): Promise<boolean> {
  const token = req.cookies.get(TEAM_COOKIE)?.value
  return !!token && token === (await teamCookieToken())
}
