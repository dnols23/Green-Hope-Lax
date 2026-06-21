import { createClient, createServiceClient } from './supabase-server'
import type { Game, Player, Coach, NewsPost, ProgramGender, TeamGroup, TeamPost, TeamMember } from './types'

// All public-site reads live here. They use the anon (RLS-respecting) client, so
// they only ever return data the public is allowed to see.

export async function getGames(gender?: ProgramGender): Promise<Game[]> {
  const supabase = await createClient()
  let q = supabase.from('games').select('*').order('game_date', { ascending: true })
  if (gender) q = q.eq('gender', gender)
  const { data } = await q
  return (data as Game[]) ?? []
}

// The next not-yet-final game, optionally for one program.
export async function getNextGame(gender?: ProgramGender): Promise<Game | null> {
  const supabase = await createClient()
  let q = supabase
    .from('games')
    .select('*')
    .eq('status', 'scheduled')
    .gte('game_date', new Date().toISOString())
    .order('game_date', { ascending: true })
    .limit(1)
  if (gender) q = q.eq('gender', gender)
  const { data } = await q
  return (data?.[0] as Game) ?? null
}

export async function getPlayers(team?: TeamGroup): Promise<Player[]> {
  const supabase = await createClient()
  let q = supabase
    .from('players')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (team) q = q.eq('team', team)
  const { data } = await q
  return (data as Player[]) ?? []
}

export async function getCoaches(): Promise<Coach[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('coaches')
    .select('*')
    .order('sort_order', { ascending: true })
  return (data as Coach[]) ?? []
}

export async function getNews(limit?: number): Promise<NewsPost[]> {
  const supabase = await createClient()
  let q = supabase
    .from('news_posts')
    .select('*')
    .eq('published', true)
    .order('published_at', { ascending: false })
  if (limit) q = q.limit(limit)
  const { data } = await q
  return (data as NewsPost[]) ?? []
}

// ── Team Hub (private) ─────────────────────────────────────────────────────────
// team_posts is locked down (RLS, no public policies) — read via the service
// client on the server, only after the team password gate has been passed.
export async function getTeamPosts(includeUnpublished = false): Promise<TeamPost[]> {
  const supabase = createServiceClient()
  let q = supabase
    .from('team_posts')
    .select('*')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  if (!includeUnpublished) q = q.eq('published', true)
  const { data } = await q
  return (data as TeamPost[]) ?? []
}

// Registered team members (contact list) — admin only, service-role read.
export async function getTeamMembers(): Promise<TeamMember[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('team_members')
    .select('*')
    .order('created_at', { ascending: false })
  return (data as TeamMember[]) ?? []
}

export async function getNewsBySlug(slug: string): Promise<NewsPost | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('news_posts')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle()
  return (data as NewsPost) ?? null
}
