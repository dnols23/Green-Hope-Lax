'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition, type PointerEvent as ReactPointerEvent } from 'react'
import {
  BENCH,
  DEPTH_POSITIONS,
  clearChart,
  dropFromChart,
  fillFromRoster,
  moveOnChart,
  pruneChart,
  tierLabel,
  type DepthChart,
} from '@/lib/depthChart'
import { depthAddToTeam, depthCreateRoster, depthMoveTeam, depthRemoveFromRoster, depthUseRoster, saveDepthChart, type DepthPlayer } from '@/lib/depthActions'
import type { Team } from '@/lib/teams'
import { RosterPanel } from './DepthRoster'

const NEW_ROSTER = '__new__'
const TEAM_NAME: Record<Team, string> = { varsity: 'Varsity', jv: 'JV' }
const other = (t: Team): Team => (t === 'varsity' ? 'jv' : 'varsity')

/** Anyone in the program, and the team he's down as. */
export type ProgramPlayer = DepthPlayer & { team: string }
const TEAM_GROUP: Record<string, string> = { boys_varsity: 'Varsity', boys_jv: 'JV', girls: 'Girls' }

type RosterOption = { id: string; name: string; count: number; mine: boolean }

export interface TeamSide {
  team: Team
  chart: DepthChart
  players: DepthPlayer[]
  canWrite: boolean
  canEditRoster: boolean
  /** The rosters this team's chart may run off: its own, and unclaimed ones. */
  rosters: RosterOption[]
  /** Anything about the roster the coach needs to sort out first. */
  note: string | null
}

type Spot = { team: Team; zone: string; index: number }
type Src = Spot & { playerId: string }
type Drag = { src: Src; x: number; y: number; offX: number; offY: number; w: number; target: Spot | null }
type Pending = { src: Src; x0: number; y0: number; offX: number; offY: number; w: number; touch: boolean }

/**
 * The depth chart, both teams on one board. Pick a player up and drop him
 * anywhere: up or down a spot, onto another position, onto the bench, or over
 * to the other team — which moves him up to varsity or down to JV.
 *
 * Pointer events throughout, so a finger works as well as a mouse: on a phone
 * drag by the ☰, or hold a name for a moment and then drag. Tapping a name
 * opens the same moves as buttons.
 */
export function DepthBoard({
  sides: initial,
  canMoveTeams,
  everyone: everyoneIn,
  first,
}: {
  sides: TeamSide[]
  canMoveTeams: boolean
  everyone: ProgramPlayer[]
  first: Team
}) {
  const router = useRouter()
  const [charts, setCharts] = useState<Record<Team, DepthChart>>(() => ({
    varsity: initial.find((s) => s.team === 'varsity')!.chart,
    jv: initial.find((s) => s.team === 'jv')!.chart,
  }))
  const [players, setPlayers] = useState<Record<Team, DepthPlayer[]>>(() => ({
    varsity: initial.find((s) => s.team === 'varsity')!.players,
    jv: initial.find((s) => s.team === 'jv')!.players,
  }))
  const side = (t: Team) => initial.find((s) => s.team === t)!
  const [everyone, setEveryone] = useState(everyoneIn)
  const [view, setView] = useState<'both' | Team>('both')
  const [msg, setMsg] = useState('')
  const [saving, start] = useTransition()
  const [drag, setDrag] = useState<Drag | null>(null)
  const [menu, setMenu] = useState<string | null>(null)

  // Live drag bookkeeping, read by the window listeners.
  const pending = useRef<Pending | null>(null)
  const active = useRef<Drag | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const last = useRef({ x: 0, y: 0 })
  const justDropped = useRef(false)
  const latest = useRef({ charts, players })
  useEffect(() => {
    latest.current = { charts, players }
  })

  const ids = (t: Team) => new Set(players[t].map((p) => p.id))

  function saveTeam(t: Team, next: DepthChart) {
    setCharts((c) => ({ ...c, [t]: next }))
    start(async () => {
      const r = await saveDepthChart(t, next)
      setMsg(r.ok ? 'Saved' : r.error)
    })
  }

  /** Every move ends here, whether it came from a drag or a button. */
  function move(src: Src, to: Spot) {
    const { charts: cs, players: ps } = latest.current
    setMenu(null)
    if (src.team === to.team) {
      const pruned = pruneChart(cs[src.team], new Set(ps[src.team].map((p) => p.id)))
      const next = moveOnChart(pruned, src, to)
      if (JSON.stringify(next.slots) !== JSON.stringify(pruned.slots)) saveTeam(src.team, next)
      return
    }
    if (!canMoveTeams) {
      setMsg('Moving players between teams needs both teams and the rosters.')
      return
    }
    const player = ps[src.team].find((p) => p.id === src.playerId)
    if (!player) return
    if (!cs[to.team].rosterId) {
      setMsg(`Pick a ${TEAM_NAME[to.team]} roster first.`)
      return
    }
    const fromChart = dropFromChart(cs[src.team], player.id)
    const toBase = pruneChart(cs[to.team], new Set(ps[to.team].map((p) => p.id)))
    const toChart = to.zone === BENCH ? toBase : moveOnChart(toBase, { zone: BENCH, index: 0, playerId: player.id }, to)
    setCharts((c) => ({ ...c, [src.team]: fromChart, [to.team]: toChart }))
    setPlayers((p) => ({
      ...p,
      [src.team]: p[src.team].filter((x) => x.id !== player.id),
      [to.team]: [...p[to.team], player],
    }))
    start(async () => {
      const r = await depthMoveTeam({ playerId: player.id, from: src.team, to: to.team, fromChart, toChart })
      setMsg(r.ok ? `${player.name} moved to ${TEAM_NAME[to.team]}.` : r.error)
      if (!r.ok) router.refresh()
    })
  }

  /** Someone already in the program, onto this team — off the other side if that's where he was. */
  function addToTeam(t: Team, playerId: string) {
    const { charts: cs, players: ps } = latest.current
    const rosterId = cs[t].rosterId
    const who = everyone.find((p) => p.id === playerId)
    if (!who || !rosterId) return
    const o = other(t)
    const fromOther = ps[o].some((p) => p.id === playerId)
    const player: DepthPlayer = { id: who.id, name: who.name, number: who.number, position: who.position, class_year: who.class_year }
    if (fromOther) {
      const next = dropFromChart(cs[o], playerId)
      setCharts((c) => ({ ...c, [o]: next }))
    }
    setPlayers((p) => ({ ...p, [o]: p[o].filter((x) => x.id !== playerId), [t]: [...p[t].filter((x) => x.id !== playerId), player] }))
    setEveryone((list) => list.map((p) => (p.id === playerId ? { ...p, team: t === 'jv' ? 'boys_jv' : 'boys_varsity' } : p)))
    start(async () => {
      const r = await depthAddToTeam(t, rosterId, playerId)
      if (r.ok && fromOther) await saveDepthChart(o, dropFromChart(cs[o], playerId))
      setMsg(r.ok ? `${who.name} is on ${TEAM_NAME[t]} — he's on the bench.` : r.error)
      if (!r.ok) router.refresh()
    })
  }

  /** Off this team's roster and chart. The player and his evaluations stay. */
  function removeFromTeam(t: Team, playerId: string) {
    const { charts: cs, players: ps } = latest.current
    const rosterId = cs[t].rosterId
    const who = ps[t].find((p) => p.id === playerId)
    if (!who || !rosterId) return
    if (!confirm(`Take ${who.name} off ${TEAM_NAME[t]}? He stays in the program; add him back any time.`)) return
    setMenu(null)
    const next = dropFromChart(cs[t], playerId)
    setCharts((c) => ({ ...c, [t]: next }))
    setPlayers((p) => ({ ...p, [t]: p[t].filter((x) => x.id !== playerId) }))
    start(async () => {
      const r = await depthRemoveFromRoster(t, rosterId, playerId)
      if (r.ok) await saveDepthChart(t, next)
      setMsg(r.ok ? `${who.name} is off ${TEAM_NAME[t]}.` : r.error)
      if (!r.ok) router.refresh()
    })
  }

  /** Where the finger is: which list, and between which two names. */
  function hit(x: number, y: number): Spot | null {
    const zoneEl = document
      .elementsFromPoint(x, y)
      .map((e) => (e as HTMLElement).closest<HTMLElement>('[data-zone]'))
      .find((e): e is HTMLElement => !!e)
    if (!zoneEl) return null
    const [team, zone] = (zoneEl.dataset.zone ?? '').split(':') as [Team, string]
    const rows = [...zoneEl.querySelectorAll<HTMLElement>('[data-row]')]
    let index = rows.length
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect()
      if (y < r.top + r.height / 2) {
        index = i
        break
      }
    }
    return { team, zone, index }
  }

  function begin() {
    const p = pending.current
    if (!p) return
    const d: Drag = { src: p.src, x: last.current.x, y: last.current.y, offX: p.offX, offY: p.offY, w: p.w, target: hit(last.current.x, last.current.y) }
    active.current = d
    pending.current = null
    setMenu(null)
    setDrag(d)
    document.body.style.userSelect = 'none'
    if (p.touch) navigator.vibrate?.(12)
  }

  function end(drop: boolean) {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    pending.current = null
    const d = active.current
    active.current = null
    document.body.style.userSelect = ''
    if (!d) return
    setDrag(null)
    justDropped.current = true
    setTimeout(() => {
      justDropped.current = false
    }, 50)
    if (drop && d.target) move(d.src, d.target)
  }

  function pickUp(e: ReactPointerEvent<HTMLElement>, src: Src, canDrag: boolean) {
    if (!canDrag || e.button > 0) return
    if ((e.target as HTMLElement).closest('button, select, a, input')) return
    const row = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const touch = e.pointerType !== 'mouse'
    pending.current = { src, x0: e.clientX, y0: e.clientY, offX: e.clientX - row.left, offY: e.clientY - row.top, w: row.width, touch }
    last.current = { x: e.clientX, y: e.clientY }
    if (touch) {
      // The ☰ picks up at once; anywhere else on the name, a short hold.
      if ((e.target as HTMLElement).closest('[data-grip]')) begin()
      else timer.current = setTimeout(begin, 260)
    }
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      last.current = { x: e.clientX, y: e.clientY }
      const p = pending.current
      if (p && !active.current) {
        const moved = Math.hypot(e.clientX - p.x0, e.clientY - p.y0)
        if (!p.touch && moved > 4) begin()
        else if (p.touch && moved > 10) end(false) // He's scrolling, not dragging.
        return
      }
      const d = active.current
      if (!d) return
      const next = { ...d, x: e.clientX, y: e.clientY, target: hit(e.clientX, e.clientY) }
      active.current = next
      setDrag(next)
    }
    const onUp = () => end(true)
    const onCancel = () => end(false)
    // While a player is held, the page must not scroll under the finger.
    const onTouchMove = (e: TouchEvent) => {
      if (active.current && e.cancelable) e.preventDefault()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') end(false)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('keydown', onKey)
    }
    // The handlers read everything live through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Near the top or bottom of the screen the page scrolls, so a player can be
  // carried from one end of the board to the other.
  const dragging = !!drag
  useEffect(() => {
    if (!dragging) return
    let raf = 0
    const tick = () => {
      const { y, x } = last.current
      const edge = 80
      const dy = y < edge ? -(edge - y) / 3 : y > innerHeight - edge ? (y - (innerHeight - edge)) / 3 : 0
      if (dy && active.current) {
        window.scrollBy(0, dy)
        const next = { ...active.current, target: hit(x, y) }
        active.current = next
        setDrag(next)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [dragging])

  const shown: Team[] = view === 'both' ? (first === 'jv' ? ['jv', 'varsity'] : ['varsity', 'jv']) : [view]
  const dragged = drag ? players[drag.src.team].find((p) => p.id === drag.src.playerId) : null

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-black">Depth chart</h1>
        <div className="inline-flex rounded-full border p-0.5" style={{ borderColor: 'var(--border)' }} role="group" aria-label="Which team">
          {(['varsity', 'both', 'jv'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`px-3 min-h-8 rounded-full text-sm font-bold ${view === v ? 'bg-gray-900 text-white' : 'text-gray-500'}`}
            >
              {v === 'both' ? 'Both' : TEAM_NAME[v]}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 ml-auto" role="status">
          {saving ? 'Saving…' : msg}
        </span>
      </div>

      <div className={`grid gap-4 items-start ${shown.length === 2 ? 'lg:grid-cols-2' : ''}`}>
        {shown.map((t) => (
          <TeamColumn
            key={t}
            team={t}
            wide={shown.length === 1}
            chart={charts[t]}
            players={players[t]}
            rosters={side(t).rosters}
            note={side(t).note}
            canWrite={side(t).canWrite}
            canEditRoster={side(t).canEditRoster}
            canSend={canMoveTeams}
            drag={drag}
            menu={menu}
            setMenu={(k) => {
              if (!justDropped.current) setMenu(k)
            }}
            pickUp={pickUp}
            move={move}
            saveChart={(next) => saveTeam(t, next)}
            setPlayers={(fn) => setPlayers((p) => ({ ...p, [t]: fn(p[t]) }))}
            setMsg={setMsg}
            onRoster={(id) => {
              const next = { ...charts[t], rosterId: id }
              setCharts((c) => ({ ...c, [t]: next }))
              start(async () => {
                const r = await depthUseRoster(t, id, charts[t])
                setMsg(r.ok ? (id ? `That roster is ${TEAM_NAME[t]}’s now.` : 'Saved') : r.error)
                router.refresh()
              })
            }}
            onClear={() => {
              if (!confirm(`Clear the whole ${TEAM_NAME[t]} depth chart? Everyone goes back to the bench; the roster stays.`)) return
              saveTeam(t, clearChart(charts[t]))
              setMsg(`${TEAM_NAME[t]} chart cleared.`)
            }}
            onNewRoster={(name) =>
              start(async () => {
                const r = await depthCreateRoster(t, name, charts[t])
                setMsg(r.ok ? 'Roster made.' : r.error)
                if (r.ok) router.refresh()
              })
            }
            ids={ids(t)}
            addable={everyone.filter((p) => !ids(t).has(p.id))}
            onAdd={(id) => addToTeam(t, id)}
            onRemove={(id) => removeFromTeam(t, id)}
          />
        ))}
      </div>

      {drag && dragged && (
        <div
          aria-hidden
          className="fixed z-[90] pointer-events-none"
          style={{ left: Math.max(8, Math.min(drag.x - drag.offX, window.innerWidth - drag.w - 8)), top: drag.y - drag.offY, width: drag.w }}
        >
          <div
            className="flex items-center gap-2 rounded-lg border px-2 min-h-10 text-sm shadow-2xl rotate-[1.5deg] scale-[1.03]"
            style={{ background: 'var(--surface, #fff)', borderColor: 'var(--gh-green)' }}
          >
            <span className="px-1 text-gray-400">☰</span>
            <Name p={dragged} />
            {drag.target && drag.target.team !== drag.src.team && (
              <span className="ml-auto text-[0.65rem] font-black uppercase tracking-wide text-[var(--gh-maroon)]">
                → {TEAM_NAME[drag.target.team]}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Name({ p }: { p: DepthPlayer }) {
  return (
    <span className="min-w-0 truncate">
      {p.number && <span className="font-black tabular-nums text-[var(--gh-green)] mr-1.5">#{p.number}</span>}
      <span className="font-semibold">{p.name}</span>
      {p.class_year && <span className="text-xs text-gray-400 ml-1.5">{p.class_year}</span>}
    </span>
  )
}

function TeamColumn({
  team,
  wide,
  chart,
  players,
  rosters,
  note,
  canWrite,
  canEditRoster,
  canSend,
  drag,
  menu,
  setMenu,
  pickUp,
  move,
  saveChart,
  setPlayers,
  setMsg,
  onRoster,
  onNewRoster,
  onClear,
  ids,
  addable,
  onAdd,
  onRemove,
}: {
  team: Team
  wide: boolean
  chart: DepthChart
  players: DepthPlayer[]
  rosters: RosterOption[]
  note: string | null
  canWrite: boolean
  canEditRoster: boolean
  canSend: boolean
  drag: Drag | null
  menu: string | null
  setMenu: (k: string | null) => void
  pickUp: (e: ReactPointerEvent<HTMLElement>, src: Src, canDrag: boolean) => void
  move: (src: Src, to: Spot) => void
  saveChart: (next: DepthChart) => void
  setPlayers: (fn: (list: DepthPlayer[]) => DepthPlayer[]) => void
  setMsg: (m: string) => void
  onRoster: (id: string | null) => void
  onNewRoster: (name: string) => void
  onClear: () => void
  ids: Set<string>
  addable: ProgramPlayer[]
  onAdd: (playerId: string) => void
  onRemove: (playerId: string) => void
}) {
  const [making, setMaking] = useState(false)
  const [rosterName, setRosterName] = useState('')
  const byId = new Map(players.map((p) => [p.id, p]))
  const clean = pruneChart(chart, ids)
  const placed = new Set(Object.values(clean.slots).flat())
  const bench = players.filter((p) => !placed.has(p.id))

  function pullIn() {
    const { chart: next, placed: n } = fillFromRoster(clean, players)
    if (!n) {
      setMsg(bench.length ? 'Nobody left with a position the chart knows — drag them from the bench.' : 'Everyone is already on the chart.')
      return
    }
    saveChart(next)
    setMsg(`Placed ${n} ${n === 1 ? 'player' : 'players'}.`)
  }

  const zoneProps = { team, drag, menu, setMenu, pickUp, move, canWrite, canSend, byId, onRemove: canEditRoster ? onRemove : undefined }
  const groups = ['boys_jv', 'boys_varsity', 'girls']
    .map((g) => ({ g, list: addable.filter((p) => p.team === g) }))
    .concat([{ g: 'other', list: addable.filter((p) => !TEAM_GROUP[p.team]) }])
    .filter((x) => x.list.length)

  return (
    <section className="space-y-3" aria-label={`${TEAM_NAME[team]} depth chart`}>
      <div className="card p-4 space-y-3">
        <div className="flex items-end gap-3 flex-wrap">
          <h2 className="text-lg font-black w-full sm:w-auto sm:mr-2">{TEAM_NAME[team]}</h2>
          <div className="min-w-[12rem] flex-1">
            <label className="field-label" htmlFor={`roster-${team}`}>Roster</label>
            <select
              id={`roster-${team}`}
              value={chart.rosterId ?? ''}
              onChange={(e) => {
                if (e.target.value === NEW_ROSTER) setMaking(true)
                else onRoster(e.target.value || null)
              }}
              disabled={!canWrite}
              className="field !py-1.5"
            >
              <option value="">Pick a {TEAM_NAME[team]} roster…</option>
              {rosters.some((r) => r.mine) && (
                <optgroup label={`${TEAM_NAME[team]} rosters`}>
                  {rosters.filter((r) => r.mine).map((r) => (
                    <option key={r.id} value={r.id}>{r.name} ({r.count})</option>
                  ))}
                </optgroup>
              )}
              {rosters.some((r) => !r.mine) && (
                <optgroup label={`Not on a team yet — picking one makes it ${TEAM_NAME[team]}’s`}>
                  {rosters.filter((r) => !r.mine).map((r) => (
                    <option key={r.id} value={r.id}>{r.name} ({r.count})</option>
                  ))}
                </optgroup>
              )}
              {canEditRoster && <option value={NEW_ROSTER}>＋ New roster…</option>}
            </select>
          </div>
          {canWrite && chart.rosterId && (
            <button type="button" onClick={pullIn} className="btn btn-ghost !py-1.5">
              Pull in roster
            </button>
          )}
          {canWrite && placed.size > 0 && (
            <button type="button" onClick={onClear} className="btn btn-ghost !py-1.5 text-[var(--gh-maroon)]">
              Clear chart
            </button>
          )}
        </div>
        {note && <p className="text-sm font-semibold text-[var(--gh-maroon)]">{note}</p>}
        {canEditRoster && chart.rosterId && addable.length > 0 && (
          <select
            value=""
            onChange={(e) => e.target.value && onAdd(e.target.value)}
            aria-label={`Add a player to ${TEAM_NAME[team]}`}
            className="field !py-1.5"
          >
            <option value="">＋ Add a player to {TEAM_NAME[team]}…</option>
            {groups.map(({ g, list }) => (
              <optgroup key={g} label={g === 'other' ? 'Other' : `${TEAM_GROUP[g]} players`}>
                {list.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.number ? `#${p.number} ` : ''}{p.name}{p.position ? ` · ${p.position}` : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
        {making && (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={rosterName}
              onChange={(e) => setRosterName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onNewRoster(rosterName)
                  setMaking(false)
                }
              }}
              placeholder={team === 'jv' ? 'JV 2027' : 'Varsity 2027'}
              aria-label={`New ${TEAM_NAME[team]} roster name`}
              className="field !py-1.5 flex-1 min-w-[10rem]"
              autoFocus
            />
            <button
              type="button"
              onClick={() => {
                onNewRoster(rosterName)
                setMaking(false)
              }}
              className="btn btn-primary !py-1.5"
            >
              Make roster
            </button>
            <button type="button" onClick={() => setMaking(false)} className="btn btn-ghost !py-1.5">
              Cancel
            </button>
          </div>
        )}
      </div>

      {!chart.rosterId ? (
        <p className="card p-6 text-sm text-gray-500">Pick the roster this depth chart is built from.</p>
      ) : (
        <>
          <div className={`grid gap-3 items-start ${wide ? 'md:grid-cols-2' : ''}`}>
            {DEPTH_POSITIONS.map((pos) => (
              <Zone key={pos.key} {...zoneProps} zone={pos.key} title={pos.label} list={clean.slots[pos.key] ?? []} pos={pos} />
            ))}
            <Zone {...zoneProps} zone={BENCH} title="Bench — not on the chart" list={bench.map((p) => p.id)} pos={null} />
          </div>
          {canEditRoster && (
            <RosterPanel
              team={team}
              rosterId={chart.rosterId}
              players={players}
              onAdded={(p) => setPlayers((list) => [...list, p])}
              onSaved={(p) => setPlayers((list) => list.map((x) => (x.id === p.id ? p : x)))}
              onRemoved={(id) => setPlayers((list) => list.filter((x) => x.id !== id))}
              setMsg={setMsg}
            />
          )}
        </>
      )}
    </section>
  )
}

/** One drop target: a position's ranked list, or the bench. */
function Zone({
  team,
  zone,
  title,
  list,
  pos,
  drag,
  menu,
  setMenu,
  pickUp,
  move,
  canWrite,
  canSend,
  byId,
  onRemove,
}: {
  team: Team
  zone: string
  title: string
  list: string[]
  pos: (typeof DEPTH_POSITIONS)[number] | null
  drag: Drag | null
  menu: string | null
  setMenu: (k: string | null) => void
  pickUp: (e: ReactPointerEvent<HTMLElement>, src: Src, canDrag: boolean) => void
  move: (src: Src, to: Spot) => void
  canWrite: boolean
  canSend: boolean
  byId: Map<string, DepthPlayer>
  onRemove?: (playerId: string) => void
}) {
  const over = drag?.target && drag.target.team === team && drag.target.zone === zone ? drag.target : null
  const bench = zone === BENCH
  return (
    <div
      data-zone={`${team}:${zone}`}
      className={`card p-3 transition-shadow ${over ? 'ring-2 ring-[var(--gh-green)]' : ''} ${bench ? 'border-dashed' : ''}`}
    >
      <h3 className={`font-black mb-2 ${bench ? 'text-sm text-gray-500' : ''}`}>
        {title} <span className="text-xs font-normal text-gray-400">{list.length}</span>
      </h3>
      {list.length === 0 && (
        <p className={`text-sm rounded-lg border border-dashed px-3 py-3 text-center ${over ? 'text-[var(--gh-green)] border-[var(--gh-green)]' : 'text-gray-400'}`} style={over ? undefined : { borderColor: 'var(--border)' }}>
          {canWrite ? 'Drop a player here' : 'Nobody yet.'}
        </p>
      )}
      <ul>
        {list.map((id, i) => {
          const p = byId.get(id)
          if (!p) return null
          const src: Src = { team, zone, index: i, playerId: id }
          const held = drag && drag.src.team === team && drag.src.zone === zone && drag.src.index === i
          const tier = pos ? tierLabel(pos, i) : null
          const starter = pos ? i < pos.starters : false
          const key = `${team}:${zone}:${id}`
          const open = menu === key
          return (
            <li key={id} data-row className="relative pb-1">
              {tier && <div className="text-[0.65rem] font-black uppercase tracking-wide text-gray-400 mt-1.5 mb-1">{tier}</div>}
              {over && over.index === i && <Line />}
              <div
                onPointerDown={(e) => pickUp(e, src, canWrite)}
                onClick={() => canWrite && setMenu(open ? null : key)}
                onContextMenu={(e) => e.preventDefault()}
                className={`flex items-center gap-2 rounded-lg border px-2 min-h-10 text-sm select-none ${canWrite ? 'cursor-grab active:cursor-grabbing' : ''} ${held ? 'opacity-30' : ''}`}
                style={{
                  background: starter ? 'var(--gh-green-50, #ecf6f0)' : 'var(--surface, #fff)',
                  borderColor: open ? 'var(--gh-green)' : 'var(--border)',
                  WebkitTouchCallout: 'none',
                }}
              >
                {canWrite && (
                  <span data-grip className="px-1.5 py-2 -my-1 text-gray-300 leading-none" style={{ touchAction: 'none' }} aria-hidden>
                    ☰
                  </span>
                )}
                {!bench && <span className="w-5 text-xs font-black text-gray-400 tabular-nums">{i + 1}</span>}
                <Name p={p} />
                {bench && p.position && <span className="text-xs text-gray-400 ml-auto">{p.position}</span>}
              </div>
              {over && over.index === list.length && i === list.length - 1 && <Line bottom />}
              {open && canWrite && (
                <div className="mt-1 mb-1.5 rounded-lg border p-2 flex flex-wrap items-center gap-2 text-sm" style={{ borderColor: 'var(--border)' }}>
                  <select
                    value=""
                    onChange={(e) => e.target.value && move(src, { team, zone: e.target.value, index: 99 })}
                    aria-label={`Move ${p.name} to`}
                    className="field !py-1 !w-auto text-sm"
                  >
                    <option value="">Move to…</option>
                    {DEPTH_POSITIONS.filter((d) => d.key !== zone).map((d) => (
                      <option key={d.key} value={d.key}>{d.label}</option>
                    ))}
                  </select>
                  {!bench && i > 0 && (
                    <button type="button" onClick={() => move(src, { team, zone, index: i - 1 })} className="btn btn-ghost !px-2.5 !py-1 text-xs" aria-label={`Move ${p.name} up`}>
                      ↑
                    </button>
                  )}
                  {!bench && i < list.length - 1 && (
                    <button type="button" onClick={() => move(src, { team, zone, index: i + 2 })} className="btn btn-ghost !px-2.5 !py-1 text-xs" aria-label={`Move ${p.name} down`}>
                      ↓
                    </button>
                  )}
                  {canSend && (
                    <button
                      type="button"
                      onClick={() => move(src, { team: other(team), zone, index: 99 })}
                      className="btn btn-ghost !py-1 text-xs"
                    >
                      Send to {TEAM_NAME[other(team)]}
                    </button>
                  )}
                  {!bench && (
                    <button
                      type="button"
                      onClick={() => move(src, { team, zone: BENCH, index: 0 })}
                      className="text-xs font-bold text-gray-400 hover:text-red-700 ml-auto"
                    >
                      Take off {pos?.label}
                    </button>
                  )}
                  {onRemove && (
                    <button
                      type="button"
                      onClick={() => onRemove(id)}
                      className={`text-xs font-bold text-[var(--gh-maroon)] hover:underline ${bench ? 'ml-auto' : ''}`}
                    >
                      Remove from {TEAM_NAME[team]}
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Where he'll land. Drawn over the gap, so nothing jumps while you aim. */
function Line({ bottom = false }: { bottom?: boolean }) {
  return (
    <div
      aria-hidden
      className={`absolute inset-x-0 h-[3px] rounded-full bg-[var(--gh-green)] pointer-events-none z-10 ${bottom ? 'bottom-0' : '-top-0.5'}`}
    />
  )
}
