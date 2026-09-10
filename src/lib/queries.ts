import { createClient, createServiceClient } from './supabase-server'
import { VISIBLE_TO } from './schedule'
import type { Game, Player, Coach, NewsPost, PageSetting, ProgramGender, ProgramStat, TeamGroup, TeamPost, TeamMember, TeamAward, Product } from './types'

// All public-site reads live here. They use the anon (RLS-respecting) client, so
// they only ever return data the public is allowed to see.

/**
 * Games for one surface.
 *
 * A game carries the audience it's for; the public site sees only public ones,
 * the Team Hub sees those plus team-only, the admin sees everything. Before the
 * audience migration has been run the column doesn't exist and the filter would
 * error, so that case falls back to showing everything — which is what every
 * game was before the column existed.
 */
export async function getGames(
  gender?: ProgramGender,
  surface: 'public' | 'team' | 'admin' = 'admin'
): Promise<Game[]> {
  const supabase = await createClient()
  const base = () => {
    let q = supabase.from('games').select('*').order('game_date', { ascending: true })
    if (gender) q = q.eq('gender', gender)
    return q
  }

  if (surface === 'admin') {
    const { data } = await base()
    return (data as Game[]) ?? []
  }

  const { data, error } = await base().in('audience', VISIBLE_TO[surface])
  if (error) {
    const { data: all } = await base()
    return (all as Game[]) ?? []
  }
  return (data as Game[]) ?? []
}

// The next not-yet-final game, optionally for one program.
export async function getNextGame(
  gender?: ProgramGender,
  surface: 'public' | 'team' | 'admin' = 'public'
): Promise<Game | null> {
  const supabase = await createClient()
  const base = () => {
    let q = supabase
      .from('games')
      .select('*')
      .eq('status', 'scheduled')
      .gte('game_date', new Date().toISOString())
      .order('game_date', { ascending: true })
      .limit(1)
    if (gender) q = q.eq('gender', gender)
    return q
  }
  if (surface === 'admin') {
    const { data } = await base()
    return (data?.[0] as Game) ?? null
  }
  // Same fallback as getGames: no column yet means everything is public.
  const { data, error } = await base().in('audience', VISIBLE_TO[surface])
  if (error) {
    const { data: all } = await base()
    return (all?.[0] as Game) ?? null
  }
  return (data?.[0] as Game) ?? null
}

/**
 * Every published roster, each with its own players.
 *
 * More than one can be published at a time — a season squad and an off-season
 * group, say — and the public page shows them as separate lists rather than one
 * merged one. Returns null when the rosters tables aren't installed at all, so
 * callers can fall back to the active flag.
 */
export async function getPublishedRosters(): Promise<
  { id: string; name: string; season: string | null; players: Player[] }[] | null
> {
  const svc = createServiceClient()
  const { data: lists, error } = await svc
    .from('player_lists')
    .select('id, name, season')
    .eq('is_public', true)
    .order('name')
  if (error) return null
  const rows = (lists ?? []) as { id: string; name: string; season: string | null }[]
  if (rows.length === 0) return []

  const { data: members } = await svc
    .from('player_list_members')
    .select('list_id, sort_order, players(*)')
    .in('list_id', rows.map((l) => l.id))
    .order('sort_order')

  const byList = new Map<string, Player[]>()
  for (const m of (members ?? []) as unknown as { list_id: string; players: Player | null }[]) {
    if (!m.players) continue
    if (!byList.has(m.list_id)) byList.set(m.list_id, [])
    byList.get(m.list_id)!.push(m.players)
  }
  return rows.map((l) => ({ ...l, players: byList.get(l.id) ?? [] }))
}

/**
 * Players for the public roster page: the members of the published roster, and
 * nobody else.
 *
 * A roster has to be published to reach the public site. Off-season groups —
 * winter workouts, tournament squads, anyone who hasn't made the team yet —
 * live on their own rosters and stay inside the Coaches Hub and Team Hub, even
 * though their player records are the same records.
 *
 * With nothing published the public page is empty rather than falling back to
 * every active player, which is what used to quietly put next season's names on
 * the public roster.
 */
export async function getPlayers(team?: TeamGroup): Promise<Player[]> {
  const supabase = await createClient()

  const publishedIds = await publishedRosterPlayerIds()

  let q = supabase
    .from('players')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  // null means the rosters tables aren't installed at all; on a site without
  // them the active flag is still the only signal there is.
  if (publishedIds === null) q = q.eq('is_active', true)
  else if (publishedIds.length === 0) return []
  else q = q.in('id', publishedIds)

  if (team) q = q.eq('team', team)
  const { data } = await q
  return (data as Player[]) ?? []
}

/**
 * Player ids on every published roster, or null when no roster is published.
 * Read with the service client because player_lists is coach-only.
 */
async function publishedRosterPlayerIds(): Promise<string[] | null> {
  const svc = createServiceClient()
  const { data: lists, error } = await svc.from('player_lists').select('id').eq('is_public', true)
  // Only a missing table falls back to the active flag. No roster published is
  // an answer, not a gap: the public roster is empty until one is published.
  if (error) return null
  if (!lists || lists.length === 0) return []

  const { data: members } = await svc
    .from('player_list_members')
    .select('player_id')
    .in('list_id', (lists as { id: string }[]).map((l) => l.id))

  return [...new Set(((members ?? []) as { player_id: string }[]).map((m) => m.player_id))]
}

/** Every player, public or not — for the admin and the Coaches Hub. */
export async function getAllPlayers(team?: TeamGroup): Promise<Player[]> {
  const svc = createServiceClient()
  let q = svc
    .from('players')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (team) q = q.eq('team', team)
  const { data } = await q
  return (data as Player[]) ?? []
}

// Page visibility settings (one row per public page). Readable by all; the
// public reads the flags to build the nav, pages read them to guard themselves.
export async function getPageSettings(): Promise<PageSetting[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('page_settings')
    .select('*')
    .order('sort_order', { ascending: true })
  return (data as PageSetting[]) ?? []
}

// All-time / program stat lines for the public /record-books page (published only).
export async function getProgramStats(): Promise<ProgramStat[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('program_stats')
    .select('*')
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  return (data as ProgramStat[]) ?? []
}

export async function getAwards(): Promise<TeamAward[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('team_awards')
    .select('*')
    .order('season', { ascending: false })
    .order('sort_order', { ascending: true })
  return (data as TeamAward[]) ?? []
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

// Team store — published products for the public /shop page.
export async function getProducts(): Promise<Product[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  return (data as Product[]) ?? []
}

// Store-wide shop settings (link to the full vendor store + page intro). Stored
// in the service-role-only app_settings table, so read it server-side.
export async function getShopSettings(): Promise<{ storeUrl: string; intro: string }> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['shop_store_url', 'shop_intro'])
  const map = new Map((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]))
  return {
    storeUrl: map.get('shop_store_url') ?? '',
    intro: map.get('shop_intro') ?? '',
  }
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
