import { requireTeam } from '@/lib/permissions'
import { canSee, isSandboxed } from '@/lib/sections'
import { createServiceClient } from '@/lib/supabase-server'
import { listRosters, rosterMembers } from '@/lib/rosters'
import { depthKey, readDepthChart } from '@/lib/depthChart'
import { teamLabel } from '@/lib/teams'
import { DepthClient } from './DepthClient'

export const metadata = { title: 'Depth Chart' }
export const dynamic = 'force-dynamic'

/** Who is first, second and third at every spot — varsity and JV, each its own. */
export default async function DepthChartPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { viewer, team, canWrite } = await requireTeam('depth', (await searchParams).team)
  const [{ data }, rosters] = await Promise.all([
    createServiceClient().from('app_settings').select('value').eq('key', depthKey(team)).maybeSingle(),
    listRosters(),
  ])
  const chart = readDepthChart((data as { value?: unknown } | null)?.value)
  // A roster that has since been archived still shows, so the chart keeps its players.
  const all = chart.rosterId && !rosters.some((r) => r.id === chart.rosterId)
    ? [...rosters, ...(await listRosters(true)).filter((r) => r.id === chart.rosterId)]
    : rosters
  const players = chart.rosterId ? await rosterMembers(chart.rosterId) : []
  const write = canWrite && !isSandboxed(viewer)

  return (
    <DepthClient
      key={`${team}:${chart.rosterId ?? ''}`}
      team={team}
      title={`${teamLabel(team)} depth chart`}
      initial={chart}
      rosters={all.map((r) => ({ id: r.id, name: r.name, count: r.memberCount }))}
      players={players.map((p) => ({
        id: p.id,
        name: p.name,
        // Numbers and grad years can come back as numbers; the chart edits them as text.
        number: p.number == null ? null : String(p.number),
        position: p.position,
        class_year: p.class_year == null ? null : String(p.class_year),
      }))}
      canWrite={write}
      canEditRoster={write && canSee(viewer, 'rosters')}
    />
  )
}
