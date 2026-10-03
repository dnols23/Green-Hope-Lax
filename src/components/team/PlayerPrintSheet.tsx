import { latestDrillSet } from '@/lib/drillSets'
import { createServiceClient } from '@/lib/supabase-server'
import { EVAL_CATEGORIES, readRating, tierFor, type Evaluation } from '@/lib/evaluations'
import { drillCategoryLabel } from '@/lib/prescribe'
import { looksLikeYear, positionLabel } from '@/lib/positions'
import { PrintButton } from '@/components/PrintButton'
import type { Player } from '@/lib/types'

/**
 * The page a player prints and takes to the wall — his drill set, where he
 * stands, and the links written out. The coaches print the same sheet from his
 * profile, either half on its own.
 *
 * Deliberately plain: black on white, one page if the set is small, and the
 * links written out as text at the bottom because a printed hyperlink is a dead
 * hyperlink. The bars stay — a kid reads a bar faster than a number — but they
 * print as outlines rather than solid ink.
 */
export async function PlayerPrintSheet({ player, part = 'all' }: { player: Player; part?: 'all' | 'eval' | 'set' }) {
  const showSet = part !== 'eval'
  const showEval = part !== 'set'
  const svc = createServiceClient()
  const [{ data: evalRows }, set] = await Promise.all([
    svc.from('evaluations').select('*').eq('player_id', player.id),
    latestDrillSet(player.id),
  ])
  const evals = (evalRows ?? []) as Evaluation[]

  const skills = EVAL_CATEGORIES.map((c) => {
    const scores = evals
      .map((e) => readRating(e.ratings?.[c.key])?.score)
      .filter((v): v is number => typeof v === 'number' && v > 0)
    return {
      ...c,
      average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    }
  }).filter((s) => s.average !== null)

  const links = (set?.items ?? []).filter((i) => i.link)

  return (
    <div className="print-sheet">
      <PrintButton />

      <header className="print-head">
        <div>
          <h1>{player.name}</h1>
          <p>
            {[player.number ? `#${player.number}` : null, positionLabel(player.position), looksLikeYear(player.class_year) ? player.class_year : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="print-brand">
          <strong>GREEN HOPE</strong>
          <span>FALCONS LACROSSE</span>
        </div>
      </header>

      {showSet && (
      <section>
        <h2>My work</h2>
        {!set || set.items.length === 0 ? (
          <p>No drills prescribed yet.</p>
        ) : (
          set.focus.map((f) => {
            const items = set.items.filter((i) => i.focusKey === f.key)
            if (!items.length) return null
            return (
              <div key={f.key} className="print-focus">
                <h3>
                  {f.label}
                  <span>{f.kind === 'keep' ? 'strength — keep it' : f.kind === 'fix' ? 'work on this first' : 'sharpen this'}</span>
                </h3>
                <p className="print-reason">{items[0].reason}</p>
                <table>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.drillId}>
                        <td className="w-8">{item.repsPerWeek}×</td>
                        <td>
                          <strong>{item.name}</strong>
                          <span> — {drillCategoryLabel(item.category)}</span>
                          {item.link && <sup> [{links.findIndex((l) => l.drillId === item.drillId) + 1}]</sup>}
                        </td>
                        <td className="print-box" aria-hidden>
                          {'▢ '.repeat(Math.min(item.repsPerWeek, 5))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })
        )}
      </section>
      )}

      {showEval && skills.length > 0 && (
        <section className={showSet ? 'print-break' : undefined}>
          <h2>Where I am</h2>
          {[...new Set(skills.map((s) => s.section))].map((section) => (
            <div key={section} className="print-section">
              <h3>{section}</h3>
              {skills
                .filter((s) => s.section === section)
                .map((s) => (
                  <div key={s.key} className="print-row">
                    <span className="print-label">{s.label}</span>
                    <span className="print-bar">
                      <span style={{ width: `${s.average}%`, background: tierFor(s.average!).color }} />
                    </span>
                    <span className="print-score">{s.average}</span>
                  </div>
                ))}
            </div>
          ))}
          <p className="print-note">
            Averaged across every coach who rated me. A number is a starting point for a
            conversation, not a verdict.
          </p>
        </section>
      )}

      {showSet && links.length > 0 && (
        <section>
          <h2>Where to watch</h2>
          <ol className="print-links">
            {links.map((l) => (
              <li key={l.drillId}>
                <strong>{l.name}</strong>
                <br />
                {l.link}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
