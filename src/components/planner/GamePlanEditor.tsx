'use client'
import { useActionState, useState, useTransition, type FormEvent } from 'react'
import NumberField from '@/components/NumberField'
import { savePlan } from '@/lib/actions'
import type { FormState } from '@/lib/actions'
import type { Board, Plan } from '@/lib/planner'
import {
  DUTY_PRESET,
  LINEUP_SLOTS,
  SYSTEM_SLOTS,
  gameDayPreset,
  orderedSchedule,
  readGamePlan,
  stepClock,
  stepWhen,
  type CoachDuty,
  type GameDayStep,
  type GamePlanDetails,
  type GameSystem,
  type SystemKey,
} from '@/lib/gamePlan'
import { newId } from '@/lib/planner'
import { FieldBoard } from './FieldBoard'
import type { PlayerOption, RosterOption } from './PlanEditor'

const EMPTY: FormState = { ok: true }

/** A saved play off the Library shelf, enough to pick it and show it. */
export interface PlayOption {
  id: string
  name: string
  board: Board
}

/** A game off the schedule, already put into the team's time zone by the page. */
export interface GameOption {
  id: string
  opponent: string
  homeAway: 'home' | 'away' | 'neutral'
  location: string | null
  /** YYYY-MM-DD, Eastern. */
  ymd: string
  /** HH:MM, Eastern — the faceoff. */
  hm: string
  /** "Fri, Sep 26 · 7:00 PM", for reading. */
  when: string
}

const GROUPS = ['Attack', 'Midfield', 'Defense', 'Goalie', 'Specialists'] as const

const PHASES: { key: GameDayStep['phase']; label: string }[] = [
  { key: 'pre', label: 'Before the game' },
  { key: 'half', label: 'Halftime' },
  { key: 'post', label: 'After the game' },
]

const vsAt = (g: Pick<GameOption, 'homeAway'>) => (g.homeAway === 'away' ? '@' : 'vs')

/**
 * Writing a game plan.
 *
 * A practice is a clock of blocks. A game plan is a set of decisions — what we
 * are in on offense, defense, the ride and the clear, who starts where, what
 * each coach owns — and the game day that gets everyone from the bus to the
 * opening faceoff. So it gets its own page rather than the practice editor with
 * a different label on it.
 *
 * It saves through the same savePlan as everything else. The decisions travel
 * as one `details` field; the plan's own columns (title, date, faceoff as the
 * start time, roster, publish switches) go as they always have.
 */
export function GamePlanEditor({
  plan,
  rosters,
  playersByRoster,
  coaches,
  plays = [],
  games = [],
  canWrite = true,
}: {
  plan: Plan
  rosters: RosterOption[]
  playersByRoster: Record<string, PlayerOption[]>
  coaches: string[]
  plays?: PlayOption[]
  games?: GameOption[]
  canWrite?: boolean
}) {
  const [state, save, saving] = useActionState(savePlan, EMPTY)
  const [, startSave] = useTransition()
  /* Saved by hand rather than as the form's action: React empties a form once
     its action finishes, which put every dropdown back where the page started —
     the game, the roster and the starters all looked wiped after a save. */
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startSave(() => save(data))
  }
  const [title, setTitle] = useState(plan.title)
  const [date, setDate] = useState(plan.plan_date ?? '')
  // The faceoff. Every step of game day is timed back from it.
  const [faceoff, setFaceoff] = useState(plan.start_time ?? '')
  const [summary, setSummary] = useState(plan.summary ?? '')
  const [rosterId, setRosterId] = useState(plan.roster_id ?? '')
  const [toPlayers, setToPlayers] = useState(plan.publish_players)
  const [toCoaches, setToCoaches] = useState(plan.publish_coaches)
  /* The schedule is kept in time order, but only re-sorted when a coach
     finishes with a box — a row jumping away mid-keystroke loses the cursor. */
  const [gp, setGp] = useState<GamePlanDetails>(() => {
    const read = readGamePlan(plan.details)
    return { ...read, schedule: orderedSchedule(read.schedule) }
  })
  const [openSystem, setOpenSystem] = useState<SystemKey | null>(null)
  const [openStep, setOpenStep] = useState<string | null>(null)

  const squad = playersByRoster[rosterId] ?? []
  const game = games.find((g) => g.id === gp.gameId) ?? null
  const staffList = 'gp-staff'

  const playerLabel = (id: string) => {
    const here = squad.find((x) => x.id === id)
    // A starter picked from another roster keeps their name, marked as such.
    const p = here ?? Object.values(playersByRoster).flat().find((x) => x.id === id)
    if (!p) return 'Not on this roster'
    return `${p.number ? `#${p.number} ` : ''}${p.name}${here ? '' : ' (other roster)'}`
  }

  // ── Header ──────────────────────────────────────────────────────────────────

  /** Linking a game fills in who, when and what time, which is why you link one. */
  function linkGame(id: string) {
    const g = games.find((x) => x.id === id)
    if (!g) {
      setGp((d) => ({ ...d, gameId: null }))
      return
    }
    setGp((d) => ({ ...d, gameId: g.id, opponent: g.opponent }))
    setDate(g.ymd)
    setFaceoff(g.hm)
    // A plan still called what "New" named it takes the game's name.
    if (!title.trim() || title === 'New game plan') setTitle(`${vsAt(g)} ${g.opponent}`)
  }

  // ── Systems ─────────────────────────────────────────────────────────────────

  const patchSystem = (key: SystemKey, next: Partial<GameSystem>) =>
    setGp((d) => ({ ...d, systems: d.systems.map((s) => (s.key === key ? { ...s, ...next } : s)) }))

  // ── Lineup ──────────────────────────────────────────────────────────────────

  const setSpot = (slot: string, playerId: string) =>
    setGp((d) => ({
      ...d,
      lineup: d.lineup.map((l) => (l.slot === slot ? { ...l, playerId: playerId || null } : l)),
    }))
  /** Where each player is already written in, so a second pick can say so. */
  const slotsOf = new Map<string, string[]>()
  for (const l of gp.lineup) {
    if (!l.playerId) continue
    slotsOf.set(l.playerId, [...(slotsOf.get(l.playerId) ?? []), l.slot])
  }
  const starters = gp.lineup.filter((l) => l.playerId).length

  // ── Coaches ─────────────────────────────────────────────────────────────────

  const patchDuty = (id: string, next: Partial<CoachDuty>) =>
    setGp((d) => ({ ...d, duties: d.duties.map((x) => (x.id === id ? { ...x, ...next } : x)) }))

  function resetDuties() {
    const written = gp.duties.some((x) => x.coach.trim() || x.role.trim() || x.duties.trim())
    if (written && !window.confirm('Replace the coaches’ jobs with the usual split?')) return
    setGp((d) => ({
      ...d,
      duties: DUTY_PRESET.map((p) => ({ id: newId('d'), coach: '', role: p.role, duties: p.duties })),
    }))
  }

  // ── Game day ────────────────────────────────────────────────────────────────

  const patchStep = (id: string, next: Partial<GameDayStep>) =>
    setGp((d) => ({ ...d, schedule: d.schedule.map((s) => (s.id === id ? { ...s, ...next } : s)) }))
  const sortSteps = () => setGp((d) => ({ ...d, schedule: orderedSchedule(d.schedule) }))

  /** A neighbour in the same part of the day, or null — nothing moves across halftime. */
  function neighbour(id: string, by: number): number | null {
    const i = gp.schedule.findIndex((s) => s.id === id)
    const j = i + by
    if (i < 0 || j < 0 || j >= gp.schedule.length) return null
    return gp.schedule[j].phase === gp.schedule[i].phase ? j : null
  }

  /* Before the game, order is time, so moving a step up means it takes the
     earlier time and the one above takes its time. After that, order is just
     order. */
  function moveStep(id: string, by: number) {
    setGp((d) => {
      const i = d.schedule.findIndex((s) => s.id === id)
      const j = i + by
      if (i < 0 || j < 0 || j >= d.schedule.length || d.schedule[i].phase !== d.schedule[j].phase) return d
      const next = [...d.schedule]
      const a = next[i]
      const b = next[j]
      next[i] = a.phase === 'pre' ? { ...b, at: a.at } : b
      next[j] = a.phase === 'pre' ? { ...a, at: b.at } : a
      return { ...d, schedule: next }
    })
  }

  function addStep() {
    const step: GameDayStep = {
      id: newId('s'),
      phase: 'pre',
      at: -30,
      title: '',
      players: '',
      coaches: '',
      lead: '',
      review: '',
    }
    setGp((d) => ({ ...d, schedule: orderedSchedule([...d.schedule, step]) }))
    setOpenStep(step.id)
  }

  function resetSchedule() {
    if (gp.schedule.length && !window.confirm('Replace this game day with the standard one? Notes on it go too.')) return
    setGp((d) => ({ ...d, schedule: gameDayPreset() }))
    setOpenStep(null)
  }

  const reviewed = gp.schedule.filter((s) => s.review.trim()).length

  return (
    <form onSubmit={submit} className="space-y-3 pb-2">
      {!canWrite && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-900 font-bold">
            The {plan.team === 'varsity' ? 'varsity' : 'JV'} staff&rsquo;s plan. Changes here won&rsquo;t save.
          </p>
        </div>
      )}
      <input type="hidden" name="id" value={plan.id} />
      <input type="hidden" name="season" value={plan.season ?? ''} />
      <input type="hidden" name="content" value="[]" />
      {/* Game plans made before this page were block lists. They ride along
          untouched, so nothing anyone wrote is lost on a save. */}
      <input type="hidden" name="blocks" value={JSON.stringify(plan.blocks)} />
      <input type="hidden" name="sides" value={JSON.stringify(plan.sides ?? [])} />
      <input type="hidden" name="details" value={JSON.stringify(gp)} />
      <datalist id={staffList}>
        {coaches.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {/* ── The game ── */}
      <div className="card p-4">
        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="field !text-lg !font-black !py-2 mb-3"
          aria-label="Title"
          required
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="col-span-2">
            <label className="field-label" htmlFor="gp-opponent">Opponent</label>
            <input
              id="gp-opponent"
              value={gp.opponent}
              onChange={(e) => setGp((d) => ({ ...d, opponent: e.target.value }))}
              className="field !py-1.5"
            />
          </div>
          <div className="col-span-2">
            <label className="field-label" htmlFor="gp-game">Game</label>
            <select
              id="gp-game"
              value={gp.gameId ?? ''}
              onChange={(e) => linkGame(e.target.value)}
              className="field !py-1.5"
            >
              <option value="">Not linked</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {vsAt(g)} {g.opponent} · {g.when}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="gp-date">Date</label>
            <input
              id="gp-date"
              type="date"
              name="plan_date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="field !py-1.5"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="gp-faceoff">Faceoff</label>
            <input
              id="gp-faceoff"
              type="time"
              name="start_time"
              value={faceoff}
              onChange={(e) => setFaceoff(e.target.value)}
              className="field !py-1.5"
            />
          </div>
          <div className="col-span-2">
            <label className="field-label" htmlFor="gp-roster">Roster</label>
            <select
              id="gp-roster"
              name="roster_id"
              value={rosterId}
              onChange={(e) => setRosterId(e.target.value)}
              className="field !py-1.5"
            >
              <option value="">No roster</option>
              {rosters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({(playersByRoster[r.id] ?? []).length})
                  {r.is_archived ? ' · put away' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-4">
            <label className="field-label" htmlFor="gp-summary">The plan in a sentence</label>
            <input
              id="gp-summary"
              name="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="field !py-1.5"
              placeholder="e.g. Slow it down, win the ground balls, make their 22 go left"
            />
          </div>
        </div>
        {game && (game.hm !== faceoff || game.ymd !== date) && (
          <button
            type="button"
            onClick={() => {
              setFaceoff(game.hm)
              setDate(game.ymd)
            }}
            className="mt-2 text-xs font-bold text-amber-800 underline"
          >
            The game has moved — use its date and time
          </button>
        )}
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
        <h2 className="section-label mb-2">Keys to the game</h2>
        <ol className="space-y-2">
          {gp.keys.map((k, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="text-sm font-black tabular-nums text-gray-400 w-5 shrink-0">{i + 1}</span>
              <input
                value={k}
                onChange={(e) =>
                  setGp((d) => ({ ...d, keys: d.keys.map((x, n) => (n === i ? e.target.value : x)) }))
                }
                className="field !py-1.5 flex-1 min-w-0"
                aria-label={`Key ${i + 1}`}
              />
              <button
                type="button"
                onClick={() => setGp((d) => ({ ...d, keys: d.keys.filter((_, n) => n !== i) }))}
                className="shrink-0 w-9 h-9 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                aria-label={`Remove key ${i + 1}`}
              >
                ×
              </button>
            </li>
          ))}
        </ol>
        {gp.keys.length < 6 && (
          <button
            type="button"
            onClick={() => setGp((d) => ({ ...d, keys: [...d.keys, ''] }))}
            className="btn btn-ghost !py-1.5 text-sm mt-2"
          >
            Add a key
          </button>
        )}
      </section>

      {/* ── Systems ── */}
      <section className="card p-4">
        <h2 className="section-label mb-2">What we&rsquo;re in</h2>
        <div className="divide-y divide-gray-100">
          {SYSTEM_SLOTS.map((slot) => {
            const sys = gp.systems.find((s) => s.key === slot.key)
            if (!sys) return null
            const open = openSystem === slot.key
            const play = plays.find((p) => p.id === sys.playId) ?? null
            const listId = `gp-sys-${slot.key}`
            return (
              <div key={slot.key} className="py-2 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <label htmlFor={`${listId}-call`} className="w-24 shrink-0 text-sm font-bold text-gray-700 truncate">
                    <span aria-hidden className="mr-1">{slot.icon}</span>
                    {slot.label}
                  </label>
                  <input
                    id={`${listId}-call`}
                    list={listId}
                    value={sys.call}
                    onChange={(e) => patchSystem(slot.key, { call: e.target.value })}
                    placeholder={slot.placeholder}
                    className="field !py-1.5 flex-1 min-w-0"
                  />
                  <datalist id={listId}>
                    {slot.suggestions.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                  <button
                    type="button"
                    onClick={() => setOpenSystem(open ? null : slot.key)}
                    aria-expanded={open}
                    className="shrink-0 min-h-9 px-2 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-100"
                    title="Notes and a play"
                  >
                    {sys.notes.trim() || play ? (
                      <span style={{ color: 'var(--gh-green)' }}>{play ? '▦' : '✎'}</span>
                    ) : null}{' '}
                    {open ? '▾' : '▸'}
                  </button>
                </div>

                {open && (
                  <div className="mt-2 space-y-2 sm:pl-[6.5rem]">
                    <div className="flex gap-1.5 flex-wrap">
                      {slot.suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => patchSystem(slot.key, { call: s })}
                          className="text-xs font-semibold rounded-full border px-2.5 min-h-9"
                          style={
                            sys.call === s
                              ? { borderColor: 'var(--gh-green)', color: 'var(--gh-green)' }
                              : { borderColor: 'var(--border)', color: 'var(--text-muted)' }
                          }
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={sys.notes}
                      onChange={(e) => patchSystem(slot.key, { notes: e.target.value })}
                      rows={2}
                      placeholder="Notes"
                      className="field !py-1.5 text-sm"
                      aria-label={`${slot.label} notes`}
                    />
                    {plays.length > 0 && (
                      <select
                        value={sys.playId ?? ''}
                        onChange={(e) => patchSystem(slot.key, { playId: e.target.value || null })}
                        className="field !py-1.5 text-sm"
                        aria-label={`${slot.label} play from the Library`}
                      >
                        <option value="">No play from the Library</option>
                        {plays.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                        {sys.playId && !play && <option value={sys.playId}>A play no longer in the Library</option>}
                      </select>
                    )}
                    {play && (
                      <div className="max-w-sm">
                        <FieldBoard board={play.board} readOnly title={play.name} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Starting lineup ── */}
      <section className="card p-4">
        <div className="flex items-baseline gap-2 mb-2">
          <h2 className="section-label">Starting lineup</h2>
          <span className="text-xs text-gray-400 tabular-nums">
            {starters} of {gp.lineup.length} set
          </span>
        </div>
        {!rosterId ? (
          <p className="text-sm text-gray-500">Pick a roster above.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3">
            {GROUPS.map((group) => (
              <div key={group}>
                <div className="text-xs font-bold text-gray-500 mb-1">{group}</div>
                <div className="space-y-1.5">
                  {LINEUP_SLOTS.filter((l) => l.group === group).map((l) => {
                    const spot = gp.lineup.find((x) => x.slot === l.slot)
                    const picked = spot?.playerId ?? ''
                    const elsewhere = picked ? (slotsOf.get(picked) ?? []).filter((s) => s !== l.slot) : []
                    return (
                      <div key={l.slot}>
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor={`gp-slot-${l.slot}`}
                            className="w-11 shrink-0 text-xs font-black tabular-nums text-gray-500"
                          >
                            {l.slot}
                          </label>
                          <select
                            id={`gp-slot-${l.slot}`}
                            value={picked}
                            onChange={(e) => setSpot(l.slot, e.target.value)}
                            className="field !py-1.5 flex-1 min-w-0 text-sm"
                          >
                            <option value="">—</option>
                            {squad.map((p) => {
                              const at = (slotsOf.get(p.id) ?? []).filter((s) => s !== l.slot)
                              return (
                                <option key={p.id} value={p.id}>
                                  {p.number ? `#${p.number} ` : ''}
                                  {p.name}
                                  {at.length ? ` · ${at.join(', ')}` : ''}
                                </option>
                              )
                            })}
                            {picked && !squad.some((p) => p.id === picked) && (
                              <option value={picked}>{playerLabel(picked)}</option>
                            )}
                          </select>
                        </div>
                        {elsewhere.length > 0 && (
                          <p className="text-[0.7rem] font-bold text-amber-800 pl-[3.25rem] mt-0.5">
                            Also at {elsewhere.join(', ')}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Coaches ── */}
      <section className="card p-4">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <h2 className="section-label">Coaches</h2>
          <button
            type="button"
            onClick={resetDuties}
            className="ml-auto text-xs font-bold text-gray-400 hover:text-gray-700 min-h-9"
          >
            {gp.duties.length ? 'Reset to the usual split' : 'Use the usual split'}
          </button>
        </div>
        <div className="space-y-2">
          {gp.duties.map((d) => (
            <div key={d.id} className="rounded-lg border border-gray-100 p-2.5">
              <div className="flex items-center gap-2">
                <div className="grid sm:grid-cols-2 gap-2 flex-1 min-w-0">
                  <input
                    list={staffList}
                    value={d.coach}
                    onChange={(e) => patchDuty(d.id, { coach: e.target.value })}
                    placeholder="Coach"
                    className="field !py-1.5 text-sm min-w-0"
                    aria-label="Coach"
                  />
                  <input
                    value={d.role}
                    onChange={(e) => patchDuty(d.id, { role: e.target.value })}
                    placeholder="Role"
                    className="field !py-1.5 text-sm min-w-0 font-semibold"
                    aria-label="Role"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setGp((x) => ({ ...x, duties: x.duties.filter((y) => y.id !== d.id) }))}
                  className="shrink-0 w-9 h-9 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  aria-label={`Remove ${d.role || 'this coach'}`}
                >
                  ×
                </button>
              </div>
              <textarea
                value={d.duties}
                onChange={(e) => patchDuty(d.id, { duties: e.target.value })}
                rows={2}
                placeholder="Duties"
                className="field !py-1.5 text-sm mt-2"
                aria-label={`${d.role || 'Coach'} duties`}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setGp((x) => ({ ...x, duties: [...x.duties, { id: newId('d'), coach: '', role: '', duties: '' }] }))
          }
          className="btn btn-ghost !py-1.5 text-sm mt-2"
        >
          Add a coach
        </button>
      </section>

      {/* ── Game day ── */}
      <section className="card p-4">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <h2 className="section-label">Game day</h2>
          {reviewed > 0 && <span className="text-xs text-gray-400">{reviewed} with notes</span>}
          {gp.schedule.length > 0 && (
            <button
              type="button"
              onClick={resetSchedule}
              className="ml-auto text-xs font-bold text-gray-400 hover:text-gray-700 min-h-9"
            >
              Reset to the standard game day
            </button>
          )}
        </div>

        {gp.schedule.length === 0 ? (
          <button type="button" onClick={resetSchedule} className="btn btn-primary !py-1.5 text-sm">
            Start from the standard game day
          </button>
        ) : (
          <div className="space-y-1.5">
            {gp.schedule.map((s, i) => {
              const open = openStep === s.id
              const clock = stepClock(faceoff || null, s)
              const newPhase = i === 0 || gp.schedule[i - 1].phase !== s.phase
              return (
                <div key={s.id}>
                  {newPhase && s.phase !== 'pre' && <div className="h-px my-2" style={{ background: 'var(--border)' }} />}
                  <div
                    className="rounded-lg border"
                    style={{
                      borderColor: 'var(--border)',
                      borderLeft: `4px solid ${s.at === 0 && s.phase === 'pre' ? 'var(--gh-maroon)' : 'var(--gh-green)'}`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenStep(open ? null : s.id)}
                      aria-expanded={open}
                      className="w-full flex items-center gap-2 p-2.5 text-left min-h-11"
                    >
                      <span className="w-[4.6rem] shrink-0 leading-tight">
                        <span className="block text-xs font-black tabular-nums" style={{ color: 'var(--gh-green)' }}>
                          {clock ?? stepWhen(s)}
                        </span>
                        {clock && <span className="block text-[0.65rem] text-gray-400">{stepWhen(s)}</span>}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {s.title || <span className="text-gray-400 font-normal">Untitled step</span>}
                        </span>
                        {s.lead && <span className="block truncate text-[0.7rem] text-gray-500">{s.lead}</span>}
                      </span>
                      {s.review.trim() && (
                        <span
                          className="text-[0.65rem] font-bold rounded-full px-1.5 py-px shrink-0 border"
                          style={{ color: 'var(--gh-green)', borderColor: 'var(--gh-green)' }}
                          title="Has notes on how it went"
                        >
                          Notes
                        </span>
                      )}
                      <span className="text-gray-400 text-xs shrink-0">{open ? '▾' : '▸'}</span>
                    </button>

                    {open && (
                      <div className="px-2.5 pb-2.5 pt-2.5 space-y-2 border-t border-gray-100">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="col-span-2">
                            <label className="field-label" htmlFor={`gp-step-${s.id}`}>Step</label>
                            <input
                              id={`gp-step-${s.id}`}
                              value={s.title}
                              onChange={(e) => patchStep(s.id, { title: e.target.value })}
                              className="field !py-1.5"
                            />
                          </div>
                          <div>
                            <label className="field-label" htmlFor={`gp-phase-${s.id}`}>When</label>
                            <select
                              id={`gp-phase-${s.id}`}
                              value={s.phase}
                              onChange={(e) => {
                                const phase = e.target.value as GameDayStep['phase']
                                setGp((d) => ({
                                  ...d,
                                  schedule: orderedSchedule(
                                    d.schedule.map((x) =>
                                      x.id === s.id ? { ...x, phase, at: phase === 'pre' ? x.at : 0 } : x
                                    )
                                  ),
                                }))
                              }}
                              className="field !py-1.5"
                            >
                              {PHASES.map((p) => (
                                <option key={p.key} value={p.key}>{p.label}</option>
                              ))}
                            </select>
                          </div>
                          {s.phase === 'pre' && (
                            <div>
                              <label className="field-label" htmlFor={`gp-at-${s.id}`}>Min before</label>
                              <NumberField
                                id={`gp-at-${s.id}`}
                                value={-s.at || 0}
                                onValue={(n) => patchStep(s.id, { at: n ? -n : 0 })}
                                onBlur={sortSteps}
                                min={0}
                                max={600}
                                integer
                                className="field !py-1.5"
                              />
                            </div>
                          )}
                          <div className="col-span-2">
                            <label className="field-label" htmlFor={`gp-players-${s.id}`}>Players</label>
                            <textarea
                              id={`gp-players-${s.id}`}
                              value={s.players}
                              onChange={(e) => patchStep(s.id, { players: e.target.value })}
                              rows={2}
                              className="field !py-1.5 text-sm"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="field-label" htmlFor={`gp-coaches-${s.id}`}>Coaches</label>
                            <textarea
                              id={`gp-coaches-${s.id}`}
                              value={s.coaches}
                              onChange={(e) => patchStep(s.id, { coaches: e.target.value })}
                              rows={2}
                              className="field !py-1.5 text-sm"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="field-label" htmlFor={`gp-lead-${s.id}`}>Lead</label>
                            <select
                              id={`gp-lead-${s.id}`}
                              value={s.lead}
                              onChange={(e) => patchStep(s.id, { lead: e.target.value })}
                              className="field !py-1.5"
                            >
                              <option value="">No one</option>
                              {coaches.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                              {s.lead && !coaches.includes(s.lead) && <option value={s.lead}>{s.lead}</option>}
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => moveStep(s.id, -1)}
                            disabled={neighbour(s.id, -1) === null}
                            className="btn btn-ghost !px-3 !py-1.5 text-sm disabled:opacity-40"
                            aria-label="Move up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveStep(s.id, 1)}
                            disabled={neighbour(s.id, 1) === null}
                            className="btn btn-ghost !px-3 !py-1.5 text-sm disabled:opacity-40"
                            aria-label="Move down"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setGp((d) => ({ ...d, schedule: d.schedule.filter((x) => x.id !== s.id) }))
                              setOpenStep(null)
                            }}
                            className="ml-auto text-xs font-bold text-red-600 hover:text-red-800 min-h-9 px-2"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )}

                    {/* After the game: what worked and what to change next
                        time. Here on the step itself, open or shut, so the
                        whole day can be written up without opening each one. */}
                    <details className="group border-t border-gray-100">
                      <summary className="cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden px-2.5 py-2 min-h-9 flex items-center gap-2 text-xs font-bold text-gray-500">
                        <span className="text-gray-400 transition-transform group-open:rotate-90">▸</span>
                        <span className="shrink-0">How it went</span>
                        {s.review.trim() && (
                          <span className="font-normal text-gray-400 truncate min-w-0">
                            {s.review.trim().split('\n')[0]}
                          </span>
                        )}
                      </summary>
                      <div className="px-2.5 pb-2.5">
                        <textarea
                          value={s.review}
                          onChange={(e) => patchStep(s.id, { review: e.target.value })}
                          rows={3}
                          placeholder="On time? What would you change next game?"
                          className="field !py-1.5 text-sm"
                          aria-label={`How ${s.title || 'this step'} went`}
                        />
                      </div>
                    </details>
                  </div>
                </div>
              )
            })}
            <button type="button" onClick={addStep} className="btn btn-ghost !py-1.5 text-sm mt-1">
              Add a step
            </button>
          </div>
        )}
      </section>

      {/* ── From the old plan ── */}
      {plan.blocks.length > 0 && (
        <details className="card group">
          <summary className="cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden p-4 min-h-9 flex items-center gap-2">
            <span className="text-gray-400 transition-transform group-open:rotate-90">▸</span>
            <span className="section-label">From the old plan</span>
            <span className="text-xs text-gray-400">{plan.blocks.length}</span>
          </summary>
          <ol className="px-4 pb-4 space-y-2">
            {plan.blocks.map((b) => (
              <li key={b.id} className="text-sm">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold flex-1 min-w-0">{b.title || 'Untitled block'}</span>
                  {b.minutes > 0 && <span className="text-xs tabular-nums text-gray-400 shrink-0">{b.minutes}m</span>}
                </div>
                {b.notes && <p className="text-gray-600 whitespace-pre-line">{b.notes}</p>}
                {b.review?.trim() && (
                  <p className="text-gray-500 whitespace-pre-line text-xs mt-0.5">How it went: {b.review}</p>
                )}
              </li>
            ))}
          </ol>
        </details>
      )}

      {/* ── Save ── */}
      <div
        className="sticky bottom-0 z-20 rounded-xl border p-3 shadow-[0_-4px_24px_rgba(0,0,0,.08)]"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
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
          <button
            type="submit"
            disabled={saving || !canWrite}
            title={canWrite ? undefined : 'This is the other team’s plan.'}
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
