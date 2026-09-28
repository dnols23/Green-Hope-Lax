'use client'
import { useActionState, useState, useTransition, type FormEvent } from 'react'
import { savePlan } from '@/lib/actions'
import type { FormState } from '@/lib/actions'
import { newId, type Plan } from '@/lib/planner'
import { readNoteBlocks, type NoteBlock } from '@/lib/noteBlocks'
import {
  SCOUT_POSITIONS,
  SCOUT_SECTIONS,
  readScout,
  withoutOldPrompts,
  type ScoutDetails,
  type ScoutLink,
  type ScoutPlayer,
} from '@/lib/scout'
import { NoteEditor } from './NoteEditor'
import type { GameOption } from './GamePlanEditor'

const EMPTY: FormState = { ok: true }

const vsAt = (g: Pick<GameOption, 'homeAway'>) => (g.homeAway === 'away' ? '@' : 'vs')
const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim())

/**
 * Writing a scouting report.
 *
 * Every question gets a box to answer it in, the players to know get a table,
 * and the keys to the game are the short list the staff takes into the week.
 * Diagrams and anything else go in the notes at the bottom. The report travels
 * as the plan's `details`; the notes as its `content`, as a note's do.
 */
export function ScoutEditor({
  plan,
  games = [],
  canWrite = true,
}: {
  plan: Plan
  games?: GameOption[]
  canWrite?: boolean
}) {
  const [state, save, saving] = useActionState(savePlan, EMPTY)
  const [, startSave] = useTransition()
  // Saved by hand so React doesn't reset the form's fields after the action.
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startSave(() => save(data))
  }
  const [title, setTitle] = useState(plan.title)
  const [date, setDate] = useState(plan.plan_date ?? '')
  const [toPlayers, setToPlayers] = useState(plan.publish_players)
  const [toCoaches, setToCoaches] = useState(plan.publish_coaches)
  const [sc, setSc] = useState<ScoutDetails>(() => {
    const read = readScout(plan.details)
    // A scout from before this page has no opponent saved; its title had it.
    if (!read.opponent) read.opponent = plan.title.replace(/^scout\s*[—–-]\s*/i, '').replace(/^new scout$/i, '')
    return read
  })
  const [notes, setNotes] = useState<NoteBlock[]>(() => withoutOldPrompts(readNoteBlocks(plan.content)))

  const game = games.find((g) => g.id === sc.gameId) ?? null

  function linkGame(id: string) {
    const g = games.find((x) => x.id === id)
    if (!g) {
      setSc((d) => ({ ...d, gameId: null }))
      return
    }
    setSc((d) => ({ ...d, gameId: g.id, opponent: g.opponent }))
    setDate(g.ymd)
    if (!title.trim() || title === 'New scout') setTitle(`Scout — ${g.opponent}`)
  }

  const answer = (key: string, v: string) => setSc((d) => ({ ...d, answers: { ...d.answers, [key]: v } }))

  const patchPlayer = (id: string, next: Partial<ScoutPlayer>) =>
    setSc((d) => ({ ...d, players: d.players.map((p) => (p.id === id ? { ...p, ...next } : p)) }))
  const addPlayer = () =>
    setSc((d) => ({
      ...d,
      players: [...d.players, { id: newId('sp'), number: '', name: '', position: '', notes: '' }],
    }))

  const patchLink = (id: string, next: Partial<ScoutLink>) =>
    setSc((d) => ({ ...d, links: d.links.map((l) => (l.id === id ? { ...l, ...next } : l)) }))
  const addLink = () => setSc((d) => ({ ...d, links: [...d.links, { id: newId('sl'), label: '', url: '' }] }))

  const removeBtn = 'shrink-0 w-9 h-9 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100'

  return (
    <form onSubmit={submit} className="space-y-3 pb-2">
      {!canWrite && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-900 font-bold">
            The {plan.team === 'varsity' ? 'varsity' : 'JV'} staff&rsquo;s scout. Changes here won&rsquo;t save.
          </p>
        </div>
      )}
      <input type="hidden" name="id" value={plan.id} />
      <input type="hidden" name="season" value={plan.season ?? ''} />
      <input type="hidden" name="blocks" value={JSON.stringify(plan.blocks)} />
      <input type="hidden" name="sides" value={JSON.stringify(plan.sides ?? [])} />
      <input type="hidden" name="summary" value={plan.summary ?? ''} />
      <input type="hidden" name="roster_id" value={plan.roster_id ?? ''} />
      <input type="hidden" name="start_time" value={plan.start_time ?? ''} />
      <input type="hidden" name="content" value={JSON.stringify(notes)} />
      <input type="hidden" name="details" value={JSON.stringify(sc)} />

      {/* ── Who ── */}
      <div className="card p-4">
        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="field !text-lg !font-black !py-2 mb-3"
          aria-label="Title"
          required
        />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <div className="col-span-2">
            <label className="field-label" htmlFor="sc-opponent">Opponent</label>
            <input
              id="sc-opponent"
              value={sc.opponent}
              onChange={(e) => setSc((d) => ({ ...d, opponent: e.target.value }))}
              className="field !py-1.5"
            />
          </div>
          <div className="col-span-2">
            <label className="field-label" htmlFor="sc-game">Game</label>
            <select id="sc-game" value={sc.gameId ?? ''} onChange={(e) => linkGame(e.target.value)} className="field !py-1.5">
              <option value="">Not linked</option>
              {game === null && sc.gameId && <option value={sc.gameId}>A game no longer on the schedule</option>}
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {vsAt(g)} {g.opponent} · {g.when}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="field-label" htmlFor="sc-date">Date</label>
            <input
              id="sc-date"
              type="date"
              name="plan_date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="field !py-1.5"
            />
          </div>
        </div>
        {game && (
          <p className="text-xs text-gray-500 mt-2">
            <span className="font-bold text-gray-700">
              {vsAt(game)} {game.opponent}
            </span>
            {' · '}
            {game.when}
            {game.location ? ` · ${game.location}` : ''}
          </p>
        )}
      </div>

      {/* ── Keys to the game ── */}
      <section className="card p-4">
        <h2 className="section-label mb-2">🔑 Keys to the game</h2>
        <ol className="space-y-2">
          {sc.keys.map((k, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="text-sm font-black tabular-nums text-gray-400 w-5 shrink-0">{i + 1}</span>
              <input
                value={k}
                onChange={(e) => setSc((d) => ({ ...d, keys: d.keys.map((x, n) => (n === i ? e.target.value : x)) }))}
                className="field !py-1.5 flex-1 min-w-0"
                aria-label={`Key ${i + 1}`}
              />
              <button
                type="button"
                onClick={() => setSc((d) => ({ ...d, keys: d.keys.filter((_, n) => n !== i) }))}
                className={removeBtn}
                aria-label={`Remove key ${i + 1}`}
              >
                ×
              </button>
            </li>
          ))}
        </ol>
        {sc.keys.length < 8 && (
          <button type="button" onClick={() => setSc((d) => ({ ...d, keys: [...d.keys, ''] }))} className="btn btn-ghost !py-1.5 text-sm mt-2">
            Add a key
          </button>
        )}
      </section>

      {/* ── The questions ── */}
      {SCOUT_SECTIONS.map((s) => (
        <section key={s.key} className="card p-4">
          <h2 className="section-label mb-2">
            <span aria-hidden className="mr-1">{s.icon}</span>
            {s.title}
          </h2>
          <div className="space-y-3">
            {s.fields.map((f) => (
              <div key={f.key}>
                <label htmlFor={`sc-${f.key}`} className="field-label">{f.label}</label>
                <textarea
                  id={`sc-${f.key}`}
                  value={sc.answers[f.key] ?? ''}
                  onChange={(e) => answer(f.key, e.target.value)}
                  rows={2}
                  placeholder={f.placeholder}
                  className="field !py-1.5 text-sm"
                />
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* ── Players to know ── */}
      <section className="card p-4">
        <h2 className="section-label mb-2">⭐ Players to know</h2>
        {sc.players.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {sc.players.map((p) => (
              <li key={p.id} className="py-2 first:pt-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    value={p.number}
                    onChange={(e) => patchPlayer(p.id, { number: e.target.value.replace(/[^0-9]/g, '').slice(0, 3) })}
                    inputMode="numeric"
                    placeholder="#"
                    className="field !py-1.5 !w-14 shrink-0 text-center tabular-nums"
                    aria-label="Number"
                  />
                  <input
                    value={p.name}
                    onChange={(e) => patchPlayer(p.id, { name: e.target.value })}
                    placeholder="Name"
                    className="field !py-1.5 flex-1 min-w-0"
                    aria-label="Name"
                  />
                  <select
                    value={p.position}
                    onChange={(e) => patchPlayer(p.id, { position: e.target.value })}
                    className="field !py-1.5 !w-20 shrink-0"
                    aria-label="Position"
                  >
                    <option value="">Pos</option>
                    {SCOUT_POSITIONS.map((x) => (
                      <option key={x} value={x}>{x}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setSc((d) => ({ ...d, players: d.players.filter((x) => x.id !== p.id) }))}
                    className={removeBtn}
                    aria-label={`Remove ${p.name || 'player'}`}
                  >
                    ×
                  </button>
                </div>
                <textarea
                  value={p.notes}
                  onChange={(e) => patchPlayer(p.id, { notes: e.target.value })}
                  rows={1}
                  placeholder="Righty, dodges from X, rolls back to his strong hand"
                  className="field !py-1.5 text-sm"
                  aria-label={`What to know about ${p.name || 'this player'}`}
                />
              </li>
            ))}
          </ul>
        )}
        {sc.players.length < 30 && (
          <button type="button" onClick={addPlayer} className="btn btn-ghost !py-1.5 text-sm mt-2">
            Add a player
          </button>
        )}
      </section>

      {/* ── Film ── */}
      <section className="card p-4">
        <h2 className="section-label mb-2">🎬 Film and links</h2>
        {sc.links.length > 0 && (
          <ul className="space-y-2">
            {sc.links.map((l) => (
              <li key={l.id} className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <input
                  value={l.label}
                  onChange={(e) => patchLink(l.id, { label: e.target.value })}
                  placeholder="vs Apex, Mar 4"
                  className="field !py-1.5 flex-1 min-w-0 sm:!w-48 sm:flex-none"
                  aria-label="What it is"
                />
                <input
                  value={l.url}
                  onChange={(e) => patchLink(l.id, { url: e.target.value })}
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  className="field !py-1.5 basis-full sm:basis-auto flex-1 min-w-0 order-last sm:order-none"
                  aria-label="Link"
                />
                {isUrl(l.url) && (
                  <a
                    href={l.url.trim()}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 w-9 h-9 rounded-full grid place-items-center text-gray-500 hover:bg-gray-100"
                    aria-label="Open"
                  >
                    ↗
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setSc((d) => ({ ...d, links: d.links.filter((x) => x.id !== l.id) }))}
                  className={removeBtn}
                  aria-label="Remove link"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        {sc.links.length < 12 && (
          <button type="button" onClick={addLink} className="btn btn-ghost !py-1.5 text-sm mt-2">
            Add a link
          </button>
        )}
      </section>

      {/* ── Anything else ── */}
      <section className="card p-4">
        <h2 className="section-label mb-2">📝 Notes and diagrams</h2>
        <NoteEditor blocks={notes} onChange={setNotes} />
      </section>

      {/* ── Save ── */}
      <div
        className="sticky bottom-0 z-20 rounded-xl border p-3 shadow-[0_-4px_24px_rgba(0,0,0,.08)]"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
          {!plan.private && (
            <>
              <label className="flex items-center gap-2 text-sm cursor-pointer min-h-9">
                <input
                  type="checkbox"
                  name="publish_coaches"
                  value="true"
                  checked={toCoaches}
                  onChange={(e) => setToCoaches(e.target.checked)}
                  className="w-4 h-4 accent-[var(--gh-green)]"
                />
                War Room
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer min-h-9">
                <input
                  type="checkbox"
                  name="publish_players"
                  value="true"
                  checked={toPlayers}
                  onChange={(e) => setToPlayers(e.target.checked)}
                  className="w-4 h-4 accent-[var(--gh-green)]"
                />
                Players
              </label>
            </>
          )}
          <button
            type="submit"
            disabled={saving || !canWrite}
            title={canWrite ? undefined : 'This is the other team’s scout.'}
            className="btn btn-primary !py-1.5 ml-auto disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {state.error && <p className="text-sm text-red-700 mt-2">{state.error}</p>}
        {state.ok && state.message && !saving && <p className="text-sm text-green-700 mt-2">{state.message}</p>}
      </div>
    </form>
  )
}
