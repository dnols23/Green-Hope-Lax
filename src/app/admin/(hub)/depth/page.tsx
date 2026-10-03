import { requireTeam } from '@/lib/permissions'
import { canSee, canTeam, isSandboxed } from '@/lib/sections'
import { createServiceClient } from '@/lib/supabase-server'
import { listRosters, rosterMembers } from '@/lib/rosters'
import { depthKey, readDepthChart, type DepthChart } from '@/lib/depthChart'
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
  const [varsity, jv, live] = await Promise.all([read('varsity'), read('jv'), listRosters()])
  const charts: Record<Team, DepthChart> = { varsity, jv }
  // A roster archived since still shows, so a chart keeps its players.
  const used = TEAMS.map((t) => charts[t].rosterId).filter((id): id is string => !!id)
  const rosters = used.every((id) => live.some((r) => r.id === id))
    ? live
    : [...live, ...(await listRosters(true)).filter((r) => used.includes(r.id) && !live.some((l) => l.id === r.id))]

  // One roster for both teams: each side is the players on it whose team is that side.
  const shared = !!charts.varsity.rosterId && charts.varsity.rosterId === charts.jv.rosterId
  const onSide = (t: Team, team: string) => !shared || (t === 'jv' ? team === 'boys_jv' : team !== 'boys_jv')
  const { data: everyone } = await svc.from('players').select('id, name, number, position, class_year, team').order('name')
  const sandboxed = isSandboxed(viewer)
  const sides: TeamSide[] = await Promise.all(
    TEAMS.map(async (t) => {
      const write = canTeam(viewer, t) && !sandboxed
      const members = charts[t].rosterId ? await rosterMembers(charts[t].rosterId!) : []
      return {
        team: t,
        chart: charts[t],
        players: members.filter((p) => onSide(t, p.team)).map((p) => ({
          id: p.id,
          name: p.name,
          // Numbers and grad years can come back as numbers; the chart edits them as text.
          number: p.number == null ? null : String(p.number),
          position: p.position,
          class_year: p.class_year == null ? null : String(p.class_year),
        })),
        canWrite: write,
        canEditRoster: write && canSee(viewer, 'rosters'),
      }
    }),
  )

  return (
    <DepthBoard
      key={TEAMS.map((t) => charts[t].rosterId ?? '').join(':')}
      sides={sides}
      rosters={rosters.map((r) => ({ id: r.id, name: r.name, count: r.memberCount }))}
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
