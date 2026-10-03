import { requireSection } from '@/lib/permissions'
import { listContentPlayers, type ContentPlayer } from '@/lib/contentData'
import { setMediaCleared } from '@/lib/contentActions'
import { ContentTabs } from '../ContentTabs'

export const metadata = { title: 'Instagram · Media Releases' }
export const dynamic = 'force-dynamic'

const TEAMS: { key: string; label: string }[] = [
  { key: 'boys_varsity', label: 'Varsity' },
  { key: 'boys_jv', label: 'JV' },
  { key: 'girls', label: 'Girls' },
]

export default async function MediaReleasesPage() {
  await requireSection('social')
  const players = await listContentPlayers()
  const active = players.filter((p) => p.is_active)
  const rest = players.filter((p) => !p.is_active)
  const cleared = active.filter((p) => p.media_cleared).length

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <ContentTabs active="media" />
        <h1 className="text-xl font-black mb-1">Media Releases</h1>
        <p className="text-gray-500 text-sm">
          <b className="text-gray-800">{cleared} of {active.length}</b> active players cleared. A video featuring anyone not
          cleared can’t be marked Ready or Posted.
        </p>
      </div>

      {TEAMS.map((t) => {
        const list = active.filter((p) => p.team === t.key)
        if (!list.length) return null
        return (
          <section key={t.key} className="card p-4">
            <h2 className="font-bold text-gray-700 mb-2">
              {t.label} <span className="font-normal text-xs text-gray-400">{list.filter((p) => p.media_cleared).length}/{list.length} cleared</span>
            </h2>
            <PlayerRows list={list} />
          </section>
        )
      })}

      {rest.length > 0 && (
        <details className="card p-4">
          <summary className="cursor-pointer list-none font-bold text-gray-700">
            Not on the active roster <span className="font-normal text-xs text-gray-400">{rest.length}</span>
          </summary>
          <div className="mt-2">
            <PlayerRows list={rest} />
          </div>
        </details>
      )}
    </div>
  )
}

function PlayerRows({ list }: { list: ContentPlayer[] }) {
  return (
    <ul className="divide-y divide-gray-100">
      {list.map((p) => (
        <li key={p.id} className="py-2 flex items-center gap-3">
          <span className="flex-1 min-w-0 text-sm font-semibold truncate">
            {p.number ? <span className="text-gray-400 font-normal">#{p.number} </span> : null}
            {p.name}
          </span>
          <form action={setMediaCleared}>
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="cleared" value={p.media_cleared ? 'false' : 'true'} />
            <button
              type="submit"
              aria-pressed={p.media_cleared}
              title={p.media_cleared ? 'Tap to mark not cleared' : 'Tap to mark cleared'}
              className={`text-xs font-bold px-3 min-h-8 rounded-full ${
                p.media_cleared ? 'bg-[#DFEFE7] text-[#00512F]' : 'bg-red-100 text-red-700'
              }`}
            >
              {p.media_cleared ? '✓ Cleared' : 'Not cleared'}
            </button>
          </form>
        </li>
      ))}
    </ul>
  )
}
