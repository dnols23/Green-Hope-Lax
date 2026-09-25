import { ExportCsvButton } from '@/components/admin/ExportCsvButton'
import { formatShortDate } from '@/lib/format'
import { PARENT_QUESTIONS, PLAYER_FAVORITES, PLAYER_GOALS, type HubQuestion } from '@/lib/hubQuestions'
import type { HubAccount } from '@/lib/hubAccounts'

const show = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join(', ') : v ?? '')

function AnswerList({ answers, questions }: { answers: HubAccount['answers']; questions: HubQuestion[] }) {
  const given = questions.filter((q) => show(answers[q.key]))
  if (!given.length) return <p className="text-sm text-gray-400">No answers.</p>
  return (
    <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
      {given.map((q) => (
        <div key={q.key}>
          <dt className="text-xs font-bold text-gray-500">{q.label}</dt>
          <dd className="whitespace-pre-wrap text-gray-900">{show(answers[q.key])}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Everyone who has made a Team Hub or Parent Hub account: the players with
 * their answers and where they stand on the code of conduct, and the parents
 * with every way to reach them.
 */
export function HubAccountsList({ accounts, names }: { accounts: HubAccount[]; names: Record<string, string> }) {
  const players = accounts.filter((a) => a.kind === 'player')
  const parents = accounts.filter((a) => a.kind === 'parent')
  const playerQs = [...PLAYER_FAVORITES, ...PLAYER_GOALS]

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <h2 className="font-black text-lg">Players ({players.length})</h2>
          <ExportCsvButton
            filename="falcons-team-hub-players.csv"
            rows={players.map((p) => ({
              player: p.name,
              email: p.email,
              phone: p.phone ?? '',
              code_of_conduct: p.conductAgreedAt ? `signed ${formatShortDate(p.conductAgreedAt)} (${p.conductSignedName ?? ''})` : 'not signed',
              ...Object.fromEntries(playerQs.map((q) => [q.key, show(p.answers[q.key])])),
              joined: formatShortDate(p.createdAt),
            }))}
          />
        </div>
        {players.length === 0 ? (
          <p className="text-sm text-gray-400">No players yet.</p>
        ) : (
          <div className="space-y-2">
            {players.map((p) => (
              <details key={p.id} className="card p-4">
                <summary className="cursor-pointer flex items-center gap-3 flex-wrap list-none">
                  <span className="font-bold">{p.name}</span>
                  {p.conductAgreedAt ? (
                    <span className="badge" style={{ background: '#e3f4ea', color: '#00512F' }}>✓ Code of conduct</span>
                  ) : (
                    <span className="badge" style={{ background: '#fde8ea', color: 'var(--gh-maroon)' }}>✗ Code of conduct</span>
                  )}
                  <span className="text-xs text-gray-500 ml-auto">{p.email}{p.phone ? ` · ${p.phone}` : ''}</span>
                </summary>
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                  {p.conductAgreedAt && (
                    <p className="text-sm text-gray-600">
                      Signed &ldquo;{p.conductSignedName}&rdquo; on {formatShortDate(p.conductAgreedAt)} — confirm it against the
                      acknowledgement form&rsquo;s responses.
                    </p>
                  )}
                  <AnswerList answers={p.answers} questions={playerQs} />
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <h2 className="font-black text-lg">Parents ({parents.length})</h2>
          <ExportCsvButton
            filename="falcons-parent-hub.csv"
            rows={parents.map((p) => ({
              parent: p.name,
              relationship: p.contacts.relationship ?? '',
              email: p.email,
              phone: p.phone ?? '',
              best_way: p.contacts.preferred ?? '',
              players: p.playerIds.map((id) => names[id] ?? '').join(', '),
              address: p.contacts.address ?? '',
              second_guardian: [p.contacts.guardian2_name, p.contacts.guardian2_relationship].filter(Boolean).join(' · '),
              second_guardian_email: p.contacts.guardian2_email ?? '',
              second_guardian_phone: p.contacts.guardian2_phone ?? '',
              emergency: [p.contacts.emergency_name, p.contacts.emergency_relation].filter(Boolean).join(' · '),
              emergency_phone: p.contacts.emergency_phone ?? '',
              ...Object.fromEntries(PARENT_QUESTIONS.map((q) => [q.key, show(p.answers[q.key])])),
              joined: formatShortDate(p.createdAt),
            }))}
          />
        </div>
        {parents.length === 0 ? (
          <p className="text-sm text-gray-400">No parents yet.</p>
        ) : (
          <div className="space-y-2">
            {parents.map((p) => (
              <details key={p.id} className="card p-4">
                <summary className="cursor-pointer flex items-center gap-3 flex-wrap list-none">
                  <span className="font-bold">{p.name}</span>
                  <span className="text-xs text-gray-500">
                    {[p.contacts.relationship, p.playerIds.map((id) => names[id]).filter(Boolean).join(', ')].filter(Boolean).join(' of ')}
                  </span>
                  <span className="text-xs text-gray-500 ml-auto">{p.email}{p.phone ? ` · ${p.phone}` : ''}</span>
                </summary>
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-3 text-sm">
                  <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                    {[
                      ['Best way to reach', p.contacts.preferred],
                      ['Address', p.contacts.address],
                      ['Second guardian', [p.contacts.guardian2_name, p.contacts.guardian2_relationship, p.contacts.guardian2_phone, p.contacts.guardian2_email].filter(Boolean).join(' · ')],
                      ['Emergency contact', [p.contacts.emergency_name, p.contacts.emergency_relation, p.contacts.emergency_phone].filter(Boolean).join(' · ')],
                    ]
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-xs font-bold text-gray-500">{k}</dt>
                          <dd className="text-gray-900">{v}</dd>
                        </div>
                      ))}
                  </dl>
                  <AnswerList answers={p.answers} questions={PARENT_QUESTIONS} />
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
