// Volunteer sign-ups for games: reading, keeping each game's sheet in step
// with the head coach's lists, and the emails. Server only.
//
// Each game's sign-up is an ordinary sign-up sheet with game_id set. Every
// upcoming game has one, made from the list for its team and home or away;
// once he changes a game's positions by hand it is that game's own (custom)
// and the lists leave it alone.

import { createServiceClient } from './supabase-server'
import { sendEmail } from './email'
import { TEAM_TIME_ZONE } from './format'
import { addDaysYmd, ymdOf, zonedToUtc } from './zoned'
import {
  VOLUNTEER_KEY,
  gameTitle,
  parseVolunteerSettings,
  type GameSignup,
  type Position,
  type VolLevel,
  type VolunteerSettings,
} from './gameVolunteerModel'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.greenhopelacrosse.com'
const NO_ID = '00000000-0000-0000-0000-000000000000'
const ids = (list: string[]) => (list.length ? list : [NO_ID])

// ── Settings ─────────────────────────────────────────────────────────────────

export async function readVolunteerSettings(): Promise<VolunteerSettings> {
  try {
    const { data } = await createServiceClient().from('app_settings').select('value').eq('key', VOLUNTEER_KEY).maybeSingle()
    return parseVolunteerSettings(data?.value ?? null)
  } catch {
    return parseVolunteerSettings(null)
  }
}

export async function writeVolunteerSettings(next: VolunteerSettings): Promise<boolean> {
  const { error } = await createServiceClient()
    .from('app_settings')
    .upsert({ key: VOLUNTEER_KEY, value: JSON.stringify(next) }, { onConflict: 'key' })
  return !error
}

// ── Games ────────────────────────────────────────────────────────────────────

export interface GameRow {
  id: string
  level: string | null
  home_away: string | null
  opponent: string | null
  game_date: string
  location: string | null
}

const GAME_COLS = 'id, level, home_away, opponent, game_date, location'
const levelOf = (g: Pick<GameRow, 'level'>): VolLevel => (g.level === 'jv' ? 'jv' : 'varsity')

export function listFor(s: VolunteerSettings, g: Pick<GameRow, 'level' | 'home_away'>): Position[] {
  const lists = s.lists[levelOf(g)]
  return g.home_away === 'home' ? lists.home : lists.away
}

/** The boys' games still to come (or under way). */
async function upcomingGames(): Promise<GameRow[]> {
  const { data } = await createServiceClient()
    .from('games')
    .select(GAME_COLS)
    .eq('gender', 'boys')
    .gte('game_date', new Date(Date.now() - 6 * 3_600_000).toISOString())
    .order('game_date', { ascending: true })
  return (data ?? []) as GameRow[]
}

async function getGame(id: string): Promise<GameRow | null> {
  const { data } = await createServiceClient().from('games').select(`${GAME_COLS}, gender`).eq('id', id).maybeSingle()
  const g = data as (GameRow & { gender?: string }) | null
  return g && g.gender !== 'girls' ? g : null
}

// ── Keeping a sheet in step ──────────────────────────────────────────────────

interface Dropped {
  name: string
  email: string | null
  position: string
  game: GameRow
}

type SlotRow = { id: string; label: string; needed: number; detail: string | null; sort_order: number }
type ClaimRow = { id: string; slot_id: string; parent_id: string | null; name: string; email: string | null; note: string | null; reminded_at: string | null; created_at: string }

/**
 * Make a sheet's positions these: same names kept (with whoever took them),
 * new ones added, the rest taken off. Who was on a position that came off is
 * handed back, to be told. With `dry`, nothing is written.
 */
async function syncSlots(sheetId: string, game: GameRow, positions: Position[], dry = false): Promise<Dropped[]> {
  const svc = createServiceClient()
  const { data: slotData } = await svc.from('signup_slots').select('id, label, needed, detail, sort_order').eq('sheet_id', sheetId)
  const slots = (slotData ?? []) as SlotRow[]
  const want = new Map(positions.map((p, i) => [p.label.toLowerCase(), { ...p, sort_order: i }]))
  const gone = slots.filter((s) => !want.has(s.label.toLowerCase()))

  let dropped: Dropped[] = []
  if (gone.length) {
    const { data: claims } = await svc.from('signup_claims').select('name, email, slot_id').in('slot_id', gone.map((s) => s.id))
    dropped = ((claims ?? []) as { name: string; email: string | null; slot_id: string }[]).map((c) => ({
      name: c.name,
      email: c.email,
      position: gone.find((s) => s.id === c.slot_id)?.label ?? '',
      game,
    }))
  }
  if (dry) return dropped

  if (gone.length) await svc.from('signup_slots').delete().in('id', gone.map((s) => s.id))
  for (const s of slots) {
    const w = want.get(s.label.toLowerCase())
    if (!w) continue
    if (w.needed !== s.needed || w.detail !== s.detail || w.sort_order !== s.sort_order || w.label !== s.label)
      await svc.from('signup_slots').update({ label: w.label, needed: w.needed, detail: w.detail, sort_order: w.sort_order }).eq('id', s.id)
  }
  const have = new Set(slots.map((s) => s.label.toLowerCase()))
  const add = [...want.values()].filter((w) => !have.has(w.label.toLowerCase()))
  if (add.length)
    await svc
      .from('signup_slots')
      .insert(add.map((w) => ({ sheet_id: sheetId, label: w.label, needed: w.needed, detail: w.detail, sort_order: w.sort_order })))
  return dropped
}

type SheetRow = { id: string; game_id: string; custom: boolean }

async function sheetsFor(gameIds: string[]): Promise<SheetRow[]> {
  const { data } = await createServiceClient().from('signup_sheets').select('id, game_id, custom').in('game_id', ids(gameIds))
  return (data ?? []) as SheetRow[]
}

/** A game's sheet, made from the lists if it has none yet. */
async function ensureSheet(game: GameRow, settings: VolunteerSettings): Promise<SheetRow | null> {
  const [found] = await sheetsFor([game.id])
  if (found) return found
  const { data, error } = await createServiceClient()
    .from('signup_sheets')
    .insert({ title: gameTitle(game), event_date: game.game_date, location: game.location, game_id: game.id, created_by: 'Coaches' })
    .select('id, game_id, custom')
    .maybeSingle()
  if (error || !data) {
    // Two at once: the other one made it.
    const [again] = await sheetsFor([game.id])
    return again ?? null
  }
  await syncSlots(String((data as SheetRow).id), game, listFor(settings, game))
  return data as SheetRow
}

/**
 * A game just added or changed: it gets its sign-up, and one that follows the
 * lists picks up the right one (home or away may have changed). Never throws.
 */
export async function ensureGameSignup(gameId: string): Promise<void> {
  try {
    const game = await getGame(gameId)
    if (!game || Date.parse(game.game_date) < Date.now() - 6 * 3_600_000) return
    const settings = await readVolunteerSettings()
    const sheet = await ensureSheet(game, settings)
    if (sheet && !sheet.custom) await tellDropped(await syncSlots(sheet.id, game, listFor(settings, game)))
  } catch (err) {
    console.error('[gameVolunteers] ensure', err)
  }
}

/**
 * Bring every upcoming game that follows the lists up to date with them.
 * With `dry`, only says who would come off a position that is going.
 */
export async function applyLists(settings: VolunteerSettings, dry = false): Promise<{ games: number; dropped: Dropped[] }> {
  const games = await upcomingGames()
  const sheets = new Map((await sheetsFor(games.map((g) => g.id))).map((s) => [s.game_id, s]))
  const dropped: Dropped[] = []
  let count = 0
  for (const g of games) {
    const sheet = sheets.get(g.id)
    if (sheet?.custom) continue
    if (!sheet) {
      if (!dry) await ensureSheet(g, settings)
      count++
      continue
    }
    dropped.push(...(await syncSlots(sheet.id, g, listFor(settings, g), dry)))
    count++
  }
  if (!dry) await tellDropped(dropped)
  return { games: count, dropped }
}

/** One game's positions, set by hand — or handed back to the lists. */
export async function setGamePositions(
  gameId: string,
  positions: Position[] | 'lists',
  dry = false,
): Promise<{ ok: boolean; dropped: Dropped[] }> {
  const game = await getGame(gameId)
  if (!game) return { ok: false, dropped: [] }
  const settings = await readVolunteerSettings()
  const sheet = await ensureSheet(game, settings)
  if (!sheet) return { ok: false, dropped: [] }
  const list = positions === 'lists' ? listFor(settings, game) : positions
  const dropped = await syncSlots(sheet.id, game, list, dry)
  if (!dry) {
    await createServiceClient().from('signup_sheets').update({ custom: positions !== 'lists' }).eq('id', sheet.id)
    await tellDropped(dropped)
  }
  return { ok: true, dropped }
}

// ── Reading ──────────────────────────────────────────────────────────────────

export interface VolunteerCount {
  filled: number
  needed: number
}

/** Spots taken of spots needed, for each of these games that has any positions. */
export async function volunteerCounts(gameIds: string[]): Promise<Map<string, VolunteerCount>> {
  const out = new Map<string, VolunteerCount>()
  if (!gameIds.length) return out
  const svc = createServiceClient()
  const sheets = await sheetsFor(gameIds)
  if (!sheets.length) return out
  const { data: slotData } = await svc.from('signup_slots').select('id, sheet_id, needed').in('sheet_id', sheets.map((s) => s.id))
  const slots = (slotData ?? []) as { id: string; sheet_id: string; needed: number }[]
  const { data: claimData } = await svc.from('signup_claims').select('slot_id').in('slot_id', ids(slots.map((s) => s.id)))
  const taken = new Map<string, number>()
  for (const c of (claimData ?? []) as { slot_id: string }[]) taken.set(c.slot_id, (taken.get(c.slot_id) ?? 0) + 1)
  const gameOf = new Map(sheets.map((s) => [s.id, s.game_id]))
  for (const s of slots) {
    const g = gameOf.get(s.sheet_id)
    if (!g) continue
    const cur = out.get(g) ?? { filled: 0, needed: 0 }
    cur.needed += s.needed
    cur.filled += Math.min(s.needed, taken.get(s.id) ?? 0)
    out.set(g, cur)
  }
  return out
}

/**
 * A game's sign-up: its positions and who has each. Emails only for coaches;
 * `parentId` marks a parent's own spots.
 */
export async function getGameSignup(gameId: string, opts: { parentId?: string | null; emails?: boolean } = {}): Promise<GameSignup | null> {
  const game = await getGame(gameId)
  if (!game) return null
  const sheet = await ensureSheet(game, await readVolunteerSettings())
  if (!sheet) return null
  const svc = createServiceClient()
  const { data: slotData } = await svc
    .from('signup_slots')
    .select('id, label, needed, detail, sort_order')
    .eq('sheet_id', sheet.id)
    .order('sort_order', { ascending: true })
  const slots = (slotData ?? []) as SlotRow[]
  const { data: claimData } = await svc
    .from('signup_claims')
    .select('*')
    .in('slot_id', ids(slots.map((s) => s.id)))
    .order('created_at', { ascending: true })
  const claims = (claimData ?? []) as ClaimRow[]
  return {
    gameId: game.id,
    sheetId: sheet.id,
    title: gameTitle(game),
    startsAt: new Date(game.game_date).toISOString(),
    location: game.location,
    level: levelOf(game),
    homeAway: game.home_away ?? 'home',
    custom: sheet.custom,
    positions: slots.map((s) => ({
      id: s.id,
      label: s.label,
      detail: s.detail,
      needed: s.needed,
      people: claims
        .filter((c) => c.slot_id === s.id)
        .map((c) => ({
          id: c.id,
          name: c.name,
          note: c.note,
          mine: !!opts.parentId && c.parent_id === opts.parentId,
          ...(opts.emails ? { email: c.email } : {}),
        })),
    })),
  }
}

/** The game a sign-up position belongs to. */
export async function gameOfSlot(slotId: string): Promise<GameRow | null> {
  const svc = createServiceClient()
  const { data: slot } = await svc.from('signup_slots').select('sheet_id').eq('id', slotId).maybeSingle()
  if (!slot) return null
  const { data: sheet } = await svc.from('signup_sheets').select('game_id').eq('id', (slot as { sheet_id: string }).sheet_id).maybeSingle()
  const gameId = (sheet as { game_id: string | null } | null)?.game_id
  return gameId ? getGame(gameId) : null
}

// ── Email ────────────────────────────────────────────────────────────────────

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** "Wed, Mar 3 · 6:30 PM" on the team's clock. */
export function gameWhen(iso: string): string {
  const d = new Date(iso)
  const day = d.toLocaleDateString('en-US', { timeZone: TEAM_TIME_ZONE, weekday: 'short', month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { timeZone: TEAM_TIME_ZONE, hour: 'numeric', minute: '2-digit' })
  return `${day} · ${time}`
}

/** The Parent Hub calendar, open on the game's day. */
export const hubLink = (iso: string) => `${SITE}/parents?view=agenda&date=${ymdOf(new Date(iso))}`

function card(a: { kicker: string; title: string; intro: string; rows: { head: string; lines: string[] }[]; link: string; foot: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f6f7f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#141414">
<div style="max-width:520px;margin:0 auto;padding:24px 16px">
  <div style="background:#004D2E;color:#fff;border-radius:14px 14px 0 0;padding:18px 22px">
    <div style="font-size:11px;letter-spacing:.2em;font-weight:800;color:#f3c9cd">GREEN HOPE LACROSSE · ${esc(a.kicker.toUpperCase())}</div>
    <div style="font-size:20px;font-weight:900;margin-top:6px">${esc(a.title)}</div>
  </div>
  <div style="background:#fff;border:1px solid #e3e6e3;border-top:0;border-radius:0 0 14px 14px;padding:22px">
    <p style="margin:0;line-height:1.5">${esc(a.intro)}</p>
    ${a.rows
      .map(
        (r) => `<div style="margin-top:14px;padding:12px 14px;border-left:4px solid #228b22;background:#eef6ee;border-radius:8px">
      <div style="font-weight:800">${esc(r.head)}</div>
      ${r.lines.map((l) => `<div style="margin-top:3px;color:#374151;font-size:14px">${esc(l)}</div>`).join('')}
    </div>`,
      )
      .join('')}
    <a href="${a.link}" style="display:inline-block;margin-top:20px;background:#0e7a50;color:#fff;text-decoration:none;font-weight:800;padding:12px 22px;border-radius:10px">Open the Parent Hub</a>
    <p style="margin:16px 0 0;font-size:12px;color:#6b7280">${esc(a.foot)}</p>
  </div>
</div></body></html>`
}

const spotLines = (g: GameRow, note?: string | null) =>
  [gameWhen(g.game_date), g.location ?? (g.home_away === 'away' ? 'Away' : null), note ? `Your note: ${note}` : null].filter(
    (l): l is string => !!l,
  )

/** The volunteer's own copy, the moment they sign up. */
export async function emailSignedUp(a: { to: string; name: string; position: string; note: string | null; game: GameRow }) {
  return sendEmail({
    to: a.to,
    subject: `You're signed up: ${a.position} — ${gameTitle(a.game)}`,
    html: card({
      kicker: 'Game volunteers',
      title: 'Thanks — you’re signed up',
      intro: `${a.name.split(' ')[0]}, here’s what you said you’d do:`,
      rows: [{ head: `${a.position} · ${gameTitle(a.game)}`, lines: spotLines(a.game, a.note) }],
      link: hubLink(a.game.game_date),
      foot: 'We’ll email you a reminder the day before. Can’t make it after all? Tap the game in the Parent Hub calendar and let the spot go.',
    }),
  })
}

/** Everyone who came off a position that was taken off a game. */
async function tellDropped(list: Dropped[]) {
  for (const d of list) {
    if (!d.email) continue
    await sendEmail({
      to: d.email,
      subject: `Change to the ${gameTitle(d.game)} sign-up`,
      html: card({
        kicker: 'Game volunteers',
        title: 'A volunteer spot changed',
        intro: `${d.name.split(' ')[0]}, the coaches took “${d.position}” off this game, so you’re no longer down for it. Thank you for offering.`,
        rows: [{ head: gameTitle(d.game), lines: spotLines(d.game) }],
        link: hubLink(d.game.game_date),
        foot: 'Other spots may still be open — tap the game in the Parent Hub calendar.',
      }),
    })
  }
}

/**
 * Remind volunteers. `gameIds` limits it to those games; `onlyNew` skips
 * anyone already reminded. One email per person, every spot they have in it.
 * Returns how many people were emailed.
 */
async function remind(games: GameRow[], onlyNew: boolean): Promise<number> {
  if (!games.length) return 0
  const svc = createServiceClient()
  const sheets = await sheetsFor(games.map((g) => g.id))
  if (!sheets.length) return 0
  const { data: slotData } = await svc.from('signup_slots').select('id, sheet_id, label').in('sheet_id', sheets.map((s) => s.id))
  const slots = (slotData ?? []) as { id: string; sheet_id: string; label: string }[]
  let q = svc.from('signup_claims').select('*').in('slot_id', ids(slots.map((s) => s.id))).not('email', 'is', null)
  if (onlyNew) q = q.is('reminded_at', null)
  const { data: claimData } = await q
  const claims = (claimData ?? []) as ClaimRow[]

  const byPerson = new Map<string, { name: string; claimIds: string[]; rows: { head: string; lines: string[]; at: string }[] }>()
  for (const c of claims) {
    const slot = slots.find((s) => s.id === c.slot_id)
    const sheet = sheets.find((s) => s.id === slot?.sheet_id)
    const game = games.find((g) => g.id === sheet?.game_id)
    if (!slot || !game || !c.email) continue
    const key = c.email.toLowerCase()
    const cur = byPerson.get(key) ?? { name: c.name, claimIds: [], rows: [] }
    cur.claimIds.push(c.id)
    cur.rows.push({ head: `${slot.label} · ${gameTitle(game)}`, lines: spotLines(game, c.note), at: game.game_date })
    byPerson.set(key, cur)
  }

  let sent = 0
  for (const [email, p] of byPerson) {
    p.rows.sort((a, b) => a.at.localeCompare(b.at))
    const first = p.rows[0]
    const ok = await sendEmail({
      to: email,
      subject: `Reminder: ${p.rows.length > 1 ? `${p.rows.length} volunteer spots` : first.head} — ${gameWhen(first.at)}`,
      html: card({
        kicker: 'Volunteer reminder',
        title: 'See you at the game',
        intro: `${p.name.split(' ')[0]}, a quick reminder — you signed up to help:`,
        rows: p.rows.map(({ head, lines }) => ({ head, lines })),
        link: hubLink(first.at),
        foot: 'Can’t make it now? Tap the game in the Parent Hub calendar and let the spot go, so someone else can take it.',
      }),
    })
    if (!ok) continue
    sent++
    await svc.from('signup_claims').update({ reminded_at: new Date().toISOString() }).in('id', p.claimIds)
  }
  return sent
}

/**
 * The daily run: everyone with a spot at a game from now to the end of
 * tomorrow who hasn't had a reminder yet.
 */
export async function sendDueReminders(): Promise<number> {
  const until = zonedToUtc(addDaysYmd(ymdOf(new Date()), 2), '00:00')
  const { data } = await createServiceClient()
    .from('games')
    .select(GAME_COLS)
    .eq('gender', 'boys')
    .gte('game_date', new Date().toISOString())
    .lt('game_date', until.toISOString())
  return remind((data ?? []) as GameRow[], true)
}

/** The head coach's "remind them now", for one game. */
export async function remindGameNow(gameId: string): Promise<number> {
  const game = await getGame(gameId)
  return game ? remind([game], false) : 0
}
