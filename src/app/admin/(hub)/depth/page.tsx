import { requireTeam } from '@/lib/permissions'
import { canSee, canTeam, isSandboxed } from '@/lib/sections'
import { createServiceClient } from '@/lib/supabase-server'
import { listRosters, rosterMembers } from '@/lib/rosters'
import { ROSTER_TEAMS_KEY, depthKey, readDepthChart, readRosterTeams, type DepthChart } from '@/lib/depthChart'
import type { Team } from '@/lib/teams'
import { DepthBoard, type TeamSide } from './DepthBoard'

export const metadata = { title: 'Depth Chart' }
export const dynamic = 'force-dynamic'

const TEAMS: Team[] = ['varsity', 'jv']

/**
 * Who is first, second and third at every spot — varsity and JV on one board,
 * so a player can be dragged up or down a level as easily as along a line.
 */
export default async function DepthChartPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { viewer, team: first } = await requireTeam('depth', (await searchParams).team)
  const svc = createServiceClient()
  const read = async (t: Team) => {
    const { data } = await svc.from('app_settings').select('value').eq('key', depthKey(t)).maybeSingle()
    return readDepthChart((data as { value?: unknown } | null)?.value)
  }
  const [varsity, jv, live, { data: rt }] = await Promise.all([
    read('varsity'),
    read('jv'),
    listRosters(),
    svc.from('app_settings').select('value').eq('key', ROSTER_TEAMS_KEY).maybeSingle(),
  ])
  const owner = readRosterTeams((rt as { value?: unknown } | null)?.value)
  const charts: Record<Team, DepthChart> = { varsity, jv }
  /* A roster is varsity's or JV's, never both. A chart pointing at the other
     team's roster — or both charts at one roster nobody has claimed yet — has
     no roster until one is picked. */
  const clash = !!varsity.rosterId && varsity.rosterId === jv.rosterId && !owner[varsity.rosterId]
  for (const t of TEAMS) {
    const id = charts[t].rosterId
    if (id && ((owner[id] && owner[id] !== t) || clash)) charts[t] = { ...charts[t], rosterId: null }
  }
  // A roster archived since still shows, so a chart keeps its players.
  const used = TEAMS.map((t) => charts[t].rosterId).filter((id): id is string => !!id)
  const rosters = used.every((id) => live.some((r) => r.id === id))
    ? live
    : [...live, ...(await listRosters(true)).filter((r) => used.includes(r.id) && !live.some((l) => l.id === r.id))]

  const { data: everyone } = await svc.from('players').select('id, name, number, position, class_year, team').order('name')
  const sandboxed = isSandboxed(viewer)
  const sides: TeamSide[] = await Promise.all(
    TEAMS.map(async (t) => {
      const write = canTeam(viewer, t) && !sandboxed
      const members = charts[t].rosterId ? await rosterMembers(charts[t].rosterId!) : []
      return {
        team: t,
        chart: charts[t],
        players: members.map((p) => ({
          id: p.id,
          name: p.name,
          // Numbers and grad years can come back as numbers; the chart edits them as text.
          number: p.number == null ? null : String(p.number),
          position: p.position,
          class_year: p.class_year == null ? null : String(p.class_year),
        })),
        // This team's rosters, and ones no team has claimed that the other chart isn't using.
        rosters: rosters
          .filter((r) => owner[r.id] === t || (!owner[r.id] && (clash || charts[TEAMS.find((x) => x !== t)!].rosterId !== r.id)))
          .map((r) => ({ id: r.id, name: r.name, count: r.memberCount, mine: owner[r.id] === t })),
        note: clash && t === 'varsity' ? `Both charts were on “${rosters.find((r) => r.id === varsity.rosterId)?.name ?? 'one roster'}”. Pick which team it belongs to — each roster is varsity’s or JV’s.` : null,
        canWrite: write,
        canEditRoster: write && canSee(viewer, 'rosters'),
      }
    }),
  )

  return (
    <DepthBoard
      key={TEAMS.map((t) => charts[t].rosterId ?? '').join(':')}
      sides={sides}
      canMoveTeams={sides.every((s) => s.canEditRoster)}
      everyone={((everyone ?? []) as { id: string; name: string; number: unknown; position: string | null; class_year: unknown; team: string }[]).map((p) => ({
        id: p.id,
        name: p.name,
        number: p.number == null ? null : String(p.number),
        position: p.position,
        class_year: p.class_year == null ? null : String(p.class_year),
        team: p.team,
      }))}
      first={first}
    />
  )
}
