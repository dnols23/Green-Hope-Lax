import Link from 'next/link'
import { getCurrentCoach } from '@/lib/coach'
import { createServiceClient } from '@/lib/supabase-server'
import { getViewer, canSee } from '@/lib/permissions'
import { readModesOff } from '@/lib/hubSettings'
import { HUB_MODES, isModeOn } from '@/lib/hubModes'
import { saveHubModes } from '@/lib/actions'

export const metadata = { title: 'Coaches Hub' }

export default async function CoachesHub() {
  const coach = await getCurrentCoach()
  const isHead = coach?.role === 'head'
  const viewer = await getViewer()
  const isOwner = viewer?.isOwner ?? false
  const modesOff = await readModesOff()

  // Evaluations save into their own table. If it isn't there, saving fails
  // silently — a coach fills in a whole evaluation and loses it — so say so up
  // front rather than letting them find out the hard way.
  const svc = createServiceClient()
  const { error: evalError } = await svc.from('evaluations').select('id').limit(1)

  const groups: { title: string; items: { href: string; emoji: string; title: string; desc: string }[] }[] = [
    {
      title: 'Evaluating',
      items: [
        { href: '/admin/hub/evaluate', emoji: '📝', title: 'Evaluate a player', desc: 'Rate a player across every skill and leave notes.' },
        { href: '/admin/hub/mine', emoji: '📋', title: 'My evaluations', desc: 'Review and update what you’ve submitted.' },
        ...(isHead
          ? [{ href: '/admin/hub/board', emoji: '📊', title: 'Team evaluation board', desc: 'Every coach’s scores compiled into a heat map.' }]
          : []),
      ],
    },
    {
      title: 'Squads',
      items: [
        { href: '/admin/rosters', emoji: '🥍', title: 'Rosters', desc: 'Build and name your own lists — tryouts, fall ball, a season squad.' },
        ...(canSee(viewer, 'schedule')
          ? [{ href: '/admin/schedule', emoji: '📅', title: 'Schedule', desc: 'Games and results, each one marked for the public, the team, or just coaches.' }]
          : []),
        { href: '/admin/film', emoji: '🎬', title: 'Film Room', desc: 'Watch game film side by side and cut clips for the team.' },
        ...(canSee(viewer, 'inventory') || canSee(viewer, 'inventory-jv')
          ? [{ href: '/admin/inventory', emoji: '📦', title: 'Inventory', desc: 'What gear you have, what went out, and what came back.' }]
          : []),
      ],
    },
    // Coaches are managed in Admin → Coach Access, which owns both who they are
    // and what they can reach. The Hub used to carry a second, separate screen
    // for the same thing; keeping it meant two lists that disagreed.
    ...(isOwner
      ? [{
          title: 'Staff',
          items: [
            { href: '/admin/access', emoji: '👥', title: 'Coach Access', desc: 'Add coaches, set their pages, and choose who sees the compiled board.' },
          ],
        }]
      : []),
  ]

  return (
    <div>
      {evalError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-4">
          <p className="text-sm text-amber-900 font-bold mb-1">Evaluations aren&rsquo;t switched on yet.</p>
          <p className="text-sm text-amber-900">
            The evaluations table hasn&rsquo;t been created in the database, so anything filled in
            here would be lost when saved. Run{' '}
            <code>supabase/migrations/0009_coaches_hub.sql</code> in the Supabase SQL editor to turn
            it on. Nothing else on the site is affected.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <h1 className="text-xl font-black">Coaches Hub</h1>
        {coach && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full border"
            style={isHead
              ? { background: '#fde8ea', color: 'var(--gh-maroon)', borderColor: '#f3c9cd' }
              : { background: '#dcfce7', color: '#15803d', borderColor: '#86efac' }}>
            {isHead ? '★ Head Coach' : 'Assistant Coach'} · {coach.name}
          </span>
        )}
      </div>
      <p className="text-gray-500 text-sm mb-6">
        Player evaluations. Assistant coaches submit their own; the head coach sees the compiled board.
      </p>

      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g.title}>
            <div className="section-label mb-2">{g.title}</div>
            <div className="card divide-y">
              {g.items.map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--surface-2)] transition-colors first:rounded-t-xl last:rounded-b-xl"
                >
                  <span className="text-xl shrink-0">{c.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-bold block leading-tight">{c.title}</span>
                    <span className="text-sm text-gray-500 block">{c.desc}</span>
                  </span>
                  <span className="text-gray-300 shrink-0">›</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      {!isHead && (
        <p className="text-xs text-gray-400 mt-6">
          The compiled team board is visible to the head coach only.
        </p>
      )}
      {isOwner && (
        <details className="card p-4 mt-8">
          <summary className="cursor-pointer list-none font-bold text-gray-700 flex items-center gap-2">
            <span className="caret text-sm">▸</span> Modes in the hub
            <span className="font-normal text-xs text-gray-400">head coach only</span>
          </summary>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500 mb-3">
              What the sidebar carries for your staff. Switching a mode off hides it for everyone —
              a coach still only sees the ones their own access allows, and each coach can drag
              theirs into whatever order they like.
            </p>
            <form action={saveHubModes} className="space-y-2">
              <div className="divide-y border rounded-lg" style={{ borderColor: '#e5e7eb' }}>
                {HUB_MODES.map((m) => (
                  <label key={m.key} className="flex items-center gap-3 p-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name={`mode:${m.key}`}
                      defaultChecked={isModeOn(modesOff, m.key)}
                      disabled={m.fixed}
                      className="w-4 h-4 accent-[var(--gh-green)]"
                    />
                    <span aria-hidden>{m.icon}</span>
                    <span className="font-semibold text-sm">{m.label}</span>
                    {m.fixed && <span className="text-xs text-gray-400">always on</span>}
                  </label>
                ))}
              </div>
              <button type="submit" className="btn btn-primary">Save modes</button>
            </form>
          </div>
        </details>
      )}
    </div>
  )
}
