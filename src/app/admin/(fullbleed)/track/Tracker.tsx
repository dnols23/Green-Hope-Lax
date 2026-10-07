'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import {
  MAX_PERIOD,
  SITUATIONS,
  SITUATION_LABELS,
  describeEvent,
  fmtRate,
  periodLabel,
  playerLabel,
  readStatEvent,
  teamLines,
  type Situation,
  type StatEvent,
  type StatGame,
  type StatPlayer,
} from '@/lib/stats'
import { addStatEvent, deleteStatEvent, deleteStatEventByKey, finishStatGame, reopenStatGame, updateStatEvent } from '@/lib/statsActions'
import { withTeam } from '@/lib/teams'
import {
  EMPTY_DRAFT,
  OUR_BUTTONS,
  THEIR_BUTTONS,
  buildEvent,
  creditOf,
  defaultGoalie,
  faceoffMen,
  sameStat,
  tidyEvent,
  toInput,
  type Draft,
  type PadButton,
} from './pad'
import { EditSheet } from './EditSheet'
import { FOCUS, FlowSheet, GoalieSheet } from './Pickers'
import { Sheet } from './Sheet'

/**
 * The live tracker: one screen, held in one hand on the sideline.
 *
 * Every tap shows up at once and is sent in the background. The sideline has
 * bad signal, so a stat that doesn't reach the server stays on the screen
 * (and on this phone, through a reload) marked as not saved, and is sent again
 * when the signal comes back. Nothing a coach taps is ever silently lost.
 *
 * The page is never reloaded per tap: the score and the strip are worked out
 * here, from the same stat math the box score uses, over the local log.
 */

/** One line of the log as this screen holds it. */
interface Entry {
  /** Stable for the life of the screen, saved or not. */
  key: string
  /** The stat as the coach means it. */
  event: StatEvent
  /** The stat as the server holds it; null until it first saves. */
  saved: StatEvent | null
  /** Taken out by the coach; gone for good once the server agrees. */
  removed: boolean
  status: 'ok' | 'saving' | 'failed'
  error: string | null
  /** Failed for want of signal, so it is tried again by itself. */
  retry: boolean
}

type Flow =
  | { kind: 'log'; button: PadButton; step: number; draft: Draft }
  | { kind: 'goalie' }
  | { kind: 'edit'; key: string }
  | { kind: 'finish' }

type Notice =
  | { kind: 'logged'; key: string; suggest: Situation | null }
  | { kind: 'removed'; event: StatEvent }

// ── Kept on this phone ──────────────────────────────────────────────────────
// What hasn't reached the server yet, plus the goalie and the situation, per
// game. Only for getting through a reload or a dead battery mid-game; the
// server is the record.

const keepKey = (gameId: string) => `gh-track-v1:${gameId}`

interface Kept {
  goalie?: unknown
  situation?: unknown
  pending?: unknown
}

function readKept(gameId: string): Kept {
  try {
    const v = JSON.parse(localStorage.getItem(keepKey(gameId)) ?? 'null') as unknown
    return v && typeof v === 'object' ? (v as Kept) : {}
  } catch {
    return {}
  }
}

const asEvent = (v: unknown) => (v && typeof v === 'object' ? readStatEvent(v as Record<string, unknown>) : null)

/** The server's log, with whatever this phone still owed it laid back on top. */
function restore(gameId: string, events: StatEvent[], kept: Kept, landed: Set<string>): Entry[] {
  const out: Entry[] = events.map((e) => ({ key: e.id, event: e, saved: e, removed: false, status: 'ok', error: null, retry: false }))
  const pending = Array.isArray(kept.pending) ? (kept.pending as Record<string, unknown>[]) : []
  for (const k of pending) {
    const event = asEvent(k?.event)
    if (!event || event.game_id !== gameId) continue
    const saved = asEvent(k.saved)
    if (saved) {
      // A change or a removal that hadn't gone through. Gone from the server
      // since (another phone took it out): nothing left to do.
      const at = out.findIndex((o) => o.saved?.id === saved.id)
      if (at < 0) continue
      const removed = k.removed === true
      if (!removed && sameStat(event, out[at].event)) continue
      out[at] = { ...out[at], event, removed, status: 'failed', error: removed ? 'Not removed yet.' : 'Change not saved yet.', retry: true }
    } else if (k.removed !== true) {
      // Never confirmed. If it was still on its way when the page closed it
      // may have landed: sent again under the same key, the server hands back
      // the one it already has rather than logging it twice.
      const key = typeof k.key === 'string' ? k.key : event.id
      // It did land before the page closed: it is already in the server's log above.
      if (landed.has(key)) continue
      out.push({ key, event, saved: null, removed: false, status: 'failed', error: 'Didn’t save yet.', retry: true })
    }
  }
  return out
}

let made = 0
/** A key for a stat that has no id from the server yet; also its one-time name on the server (client_key). */
const newKey = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `local-${crypto.randomUUID()}`
    : `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${(made++).toString(36)}`

/** A tap this soon after the last one is the same finger bouncing, not a new stat. */
const BOUNCE_MS = 300

export default function Tracker({
  game,
  events,
  savedKeys,
  players,
  canWrite,
  backHref,
}: {
  game: StatGame
  events: StatEvent[]
  /** The tracker keys of stats already on the server, so a kept one that landed isn't shown twice. */
  savedKeys: string[]
  players: StatPlayer[]
  canWrite: boolean
  backHref: string
}) {
  const router = useRouter()
  const pmap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])

  const [start] = useState(() => {
    const kept = canWrite ? readKept(game.id) : {}
    const entries = canWrite ? restore(game.id, events, kept, new Set(savedKeys)) : []
    const live = entries.filter((e) => !e.removed).map((e) => e.event)
    const keptGoalie = typeof kept.goalie === 'string' && pmap.has(kept.goalie) ? kept.goalie : null
    return {
      entries,
      // Where the last stat was logged, so a reload mid-game lands on the right quarter.
      period: live.length ? live[live.length - 1].period : 1,
      situation: SITUATIONS.includes(kept.situation as Situation) ? (kept.situation as Situation) : 'even',
      goalie: keptGoalie ?? defaultGoalie(live, players),
    }
  })

  const [entries, setEntries] = useState<Entry[]>(start.entries)
  // The same list, for the async work to read the latest of: a save that
  // lands needs to know whether the coach undid it while it was on its way.
  const store = useRef<Entry[]>(start.entries)
  const inflight = useRef(new Set<string>())
  const lastTap = useRef(0)

  const [period, setPeriod] = useState(start.period)
  const [situation, setSituation] = useState<Situation>(start.situation)
  const [goalie, setGoalie] = useState<string | null>(start.goalie)
  const [flow, setFlow] = useState<Flow | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [final, setFinal] = useState(game.status === 'final')
  const [busy, setBusy] = useState<'finish' | 'reopen' | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  // A coach who can only look gets the server's log as it stands, refreshed
  // below; one who tracks gets his own, which leads the server.
  const readOnlyEntries = useMemo<Entry[]>(
    () => events.map((e) => ({ key: e.id, event: e, saved: e, removed: false, status: 'ok', error: null, retry: false })),
    [events],
  )
  const list = canWrite ? entries : readOnlyEntries
  const isFinal = canWrite ? final : game.status === 'final'
  const tracking = canWrite && !isFinal

  // ── Keeping the log in step with the server ──────────────────────────────

  function commit(next: Entry[]) {
    store.current = next
    setEntries(next)
  }
  function patch(key: string, p: Partial<Entry> | ((e: Entry) => Partial<Entry>)) {
    commit(store.current.map((e) => (e.key === key ? { ...e, ...(typeof p === 'function' ? p(e) : p) } : e)))
  }
  function drop(key: string) {
    commit(store.current.filter((e) => e.key !== key))
  }
  const find = (key: string) => store.current.find((e) => e.key === key)

  /**
   * Bring one stat's server copy in line with the screen: add it, change it
   * or delete it, then look again in case the coach changed it meanwhile.
   * One run per stat at a time; a change made mid-run is picked up by the
   * run already going.
   */
  async function sync(key: string) {
    if (inflight.current.has(key)) return
    inflight.current.add(key)
    try {
      for (;;) {
        const e = find(key)
        if (!e) return
        if (!e.saved) {
          if (e.removed) return drop(key)
          patch(key, { status: 'saving', error: null })
          const sent = e.event
          // The key travels with it, so a retry after a lost reply can't log it twice.
          const res = await addStatEvent({ ...toInput(sent), clientKey: key })
          if (!res.ok) return patch(key, { status: 'failed', error: res.error, retry: false })
          if (!find(key)) {
            // Thrown away while it was on its way: don't leave it on the server.
            await deleteStatEvent(res.event.id)
            return
          }
          patch(key, (now) => ({ saved: res.event, event: sameStat(now.event, sent) ? res.event : now.event }))
        } else if (e.removed) {
          patch(key, { status: 'saving', error: null })
          const res = await deleteStatEvent(e.saved.id)
          if (!res.ok) return patch(key, { status: 'failed', error: res.error, retry: false })
          return drop(key)
        } else if (!sameStat(e.event, e.saved)) {
          patch(key, { status: 'saving', error: null })
          const sent = e.event
          const res = await updateStatEvent(e.saved.id, toInput(sent))
          if (!res.ok) return patch(key, { status: 'failed', error: res.error, retry: false })
          patch(key, (now) => ({ saved: res.event, event: sameStat(now.event, sent) ? res.event : now.event }))
        } else {
          return patch(key, { status: 'ok', error: null, retry: false })
        }
      }
    } catch {
      // The request never came back: no signal, most likely.
      patch(key, { status: 'failed', error: 'No signal. It will keep trying.', retry: true })
    } finally {
      inflight.current.delete(key)
    }
  }

  function retryAll() {
    for (const e of store.current) if (e.status === 'failed') void sync(e.key)
  }

  // Whatever failed for want of signal goes again: shortly after the page
  // opens, whenever the phone says it is back online, and every so often
  // regardless (a phone on one bar still says it is online).
  const retryQuietly = useEffectEvent(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    for (const e of store.current) if (e.status === 'failed' && e.retry) void sync(e.key)
  })
  useEffect(() => {
    if (!canWrite) return
    const go = () => retryQuietly()
    const soon = window.setTimeout(go, 1500)
    const every = window.setInterval(go, 15000)
    window.addEventListener('online', go)
    return () => {
      window.clearTimeout(soon)
      window.clearInterval(every)
      window.removeEventListener('online', go)
    }
  }, [canWrite])

  // Anything not yet on the server, kept on this phone in case the page closes.
  useEffect(() => {
    if (!canWrite) return
    const pending = entries
      .filter((e) => e.status !== 'ok' || e.removed || !e.saved || !sameStat(e.event, e.saved))
      .map((e) => ({ key: e.key, event: e.event, saved: e.saved, removed: e.removed, status: e.status }))
    try {
      localStorage.setItem(keepKey(game.id), JSON.stringify({ goalie, situation, pending }))
    } catch {
      // Private browsing or a full disk: the screen still works, it just can't survive a reload.
    }
  }, [entries, goalie, situation, canWrite, game.id])

  // Someone only watching sees it move: the log is fetched again every so often.
  useEffect(() => {
    if (canWrite) return
    const every = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, 20000)
    return () => window.clearInterval(every)
  }, [canWrite, router])

  // ── Taps ─────────────────────────────────────────────────────────────────

  /** False for a second tap that follows the first too closely to be meant. */
  function fresh(): boolean {
    const now = performance.now()
    if (now - lastTap.current < BOUNCE_MS) return false
    lastTap.current = now
    return true
  }

  function log(b: PadButton, d: Draft) {
    const key = newKey()
    const event = buildEvent(b, d, { key, gameId: game.id, period, situation, goalie, now: new Date().toISOString() })
    commit([...store.current, { key, event, saved: null, removed: false, status: 'saving', error: null, retry: false }])
    // After a penalty, offer the matching situation rather than switching it
    // behind the coach's back.
    setNotice({ kind: 'logged', key, suggest: b.kind === 'penalty' ? (b.side === 'us' ? 'man_down' : 'man_up') : null })
    void sync(key)
  }

  function press(b: PadButton) {
    if (!fresh()) return
    if (!b.steps.length) log(b, EMPTY_DRAFT)
    else setFlow({ kind: 'log', button: b, step: 0, draft: EMPTY_DRAFT })
  }

  function answer(p: Partial<Draft>) {
    if (flow?.kind !== 'log' || !fresh()) return
    const draft = { ...flow.draft, ...p }
    if (flow.step + 1 < flow.button.steps.length) {
      setFlow({ ...flow, step: flow.step + 1, draft })
    } else {
      setFlow(null)
      log(flow.button, draft)
    }
  }

  function remove(key: string) {
    const e = find(key)
    if (!e) return
    setNotice({ kind: 'removed', event: e.event })
    if (!e.saved && e.status !== 'saving') {
      // Never confirmed, but it may have landed before the reply was lost:
      // take it back by its key too (nothing there is fine).
      if (e.retry) void deleteStatEventByKey(game.id, key).catch(() => {})
      return drop(key)
    }
    patch(key, { removed: true })
    void sync(key)
  }

  function undo() {
    if (!fresh()) return
    const last = [...store.current].reverse().find((e) => !e.removed)
    if (last) remove(last.key)
  }

  /** An undone stat, logged again as it was. */
  function putBack(was: StatEvent) {
    if (!fresh()) return
    const key = newKey()
    const event = { ...was, id: key, created_at: new Date().toISOString() }
    commit([...store.current, { key, event, saved: null, removed: false, status: 'saving', error: null, retry: false }])
    setNotice({ kind: 'logged', key, suggest: null })
    void sync(key)
  }

  /** Give up on what didn't go through: an unsaved stat goes, a change or removal is reverted. */
  function discard(key: string) {
    const e = find(key)
    if (!e) return
    if (!e.saved) {
      if (e.retry) void deleteStatEventByKey(game.id, key).catch(() => {})
      drop(key)
    } else patch(key, { event: e.saved, removed: false, status: 'ok', error: null, retry: false })
  }

  function saveEdit(key: string, event: StatEvent) {
    setFlow(null)
    patch(key, { event: tidyEvent(event), removed: false })
    void sync(key)
  }

  async function finish() {
    setBusy('finish')
    setProblem(null)
    try {
      const r = await finishStatGame(game.id)
      if (!r.ok) {
        setProblem(r.error)
        setBusy(null)
        return
      }
      router.push(boxHref)
    } catch {
      setProblem('No signal. Try again in a moment.')
      setBusy(null)
    }
  }

  async function reopen() {
    setBusy('reopen')
    setProblem(null)
    try {
      const r = await reopenStatGame(game.id)
      if (r.ok) setFinal(false)
      else setProblem(r.error)
    } catch {
      setProblem('No signal. Try again in a moment.')
    }
    setBusy(null)
  }

  // ── What the screen shows ────────────────────────────────────────────────

  const counted = useMemo(() => list.filter((e) => !e.removed), [list])
  const lines = useMemo(() => teamLines(counted.map((e) => e.event)), [counted])
  const faceoffIds = useMemo(() => faceoffMen(counted.map((e) => e.event), players), [counted, players])
  const us = lines.us.goals
  const them = lines.them.goals

  // The score after each goal, for the log.
  const scoreAfter = useMemo(() => {
    const m = new Map<string, string>()
    let f = 0
    let a = 0
    for (const e of counted) {
      if (e.event.kind !== 'shot' || e.event.result !== 'goal') continue
      if (e.event.side === 'us') f++
      else a++
      m.set(e.key, `${f}–${a}`)
    }
    return m
  }, [counted])

  // Newest first, in period groups (latest period on top).
  const groups = useMemo(() => {
    const rows = list.filter((e) => !e.removed || e.status === 'failed').reverse()
    const by = new Map<number, Entry[]>()
    for (const e of rows) {
      const g = by.get(e.event.period) ?? []
      g.push(e)
      by.set(e.event.period, g)
    }
    return [...by.entries()].sort((a, b) => b[0] - a[0])
  }, [list])

  const failed = list.filter((e) => e.status === 'failed').length
  const unsynced = list.some((e) => e.status !== 'ok' || e.removed || !e.saved)
  const maxLogged = counted.reduce((m, e) => Math.max(m, e.event.period), 1)
  const lastPeriod = Math.min(MAX_PERIOD, Math.max(5, period, maxLogged))
  const periods = Array.from({ length: lastPeriod }, (_, i) => i + 1)
  const goaliePlayer = goalie ? pmap.get(goalie) : undefined
  const opp = game.opponent || 'Opponent'
  const describe = (e: StatEvent) => describeEvent(e, pmap)
  const boxHref = withTeam(`/admin/stats/${game.id}`, game.level)

  const tint =
    tracking && situation === 'man_up'
      ? 'color-mix(in srgb, var(--gh-green) 14%, var(--surface))'
      : tracking && situation === 'man_down'
        ? 'color-mix(in srgb, var(--gh-maroon) 14%, var(--surface))'
        : 'var(--surface)'

  const logged = notice?.kind === 'logged' ? list.find((e) => e.key === notice.key) : undefined
  const suggest = notice?.kind === 'logged' && notice.suggest && notice.suggest !== situation && logged && !logged.removed ? notice.suggest : null

  const editing = flow?.kind === 'edit' ? list.find((e) => e.key === flow.key) : undefined

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* ── Score, period, situation ── */}
      <header className="flex-none border-b px-3 pt-1.5 pb-2 space-y-2 transition-colors" style={{ borderColor: 'var(--border)', background: tint }}>
        <div className="flex items-center gap-1">
          <Link
            href={backHref}
            aria-label="Back to games"
            className={`w-11 h-11 -ml-1 flex-none inline-flex items-center justify-center rounded-full text-xl text-gray-600 hover:bg-gray-100 ${FOCUS}`}
          >
            ←
          </Link>
          <div className="flex-1 min-w-0 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2" role="group" aria-label={`Score: Green Hope ${us}, ${opp} ${them}`}>
            <div className="min-w-0 text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.14em] truncate" style={{ color: 'var(--gh-green)' }}>
                Green Hope
              </div>
              <div className="text-4xl font-black tabular-nums leading-none" aria-hidden>
                {us}
              </div>
            </div>
            <div className="text-2xl font-black text-gray-300 leading-none pb-1" aria-hidden>
              –
            </div>
            <div className="min-w-0 text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.14em] truncate" style={{ color: 'var(--gh-maroon)' }}>
                {opp}
              </div>
              <div className="text-4xl font-black tabular-nums leading-none" aria-hidden>
                {them}
              </div>
            </div>
          </div>
          {isFinal ? (
            <span className="badge badge-sched flex-none w-[4.5rem] justify-center">Final</span>
          ) : canWrite ? (
            <button
              type="button"
              onClick={() => setFlow({ kind: 'finish' })}
              className={`flex-none w-[4.5rem] h-10 rounded-full border text-xs font-bold text-gray-600 bg-white hover:bg-gray-50 ${FOCUS}`}
              style={{ borderColor: 'var(--border)' }}
            >
              Finish
            </button>
          ) : (
            <span className="flex-none w-[4.5rem]" aria-hidden />
          )}
        </div>

        {tracking && (
          <>
            <div className="flex gap-1" role="group" aria-label="Period">
              {periods.map((p) => {
                const on = p === period
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPeriod(p)}
                    className={`flex-1 min-w-0 h-10 rounded-lg text-sm font-black tabular-nums border touch-manipulation ${FOCUS} ${
                      on ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                    style={on ? undefined : { borderColor: 'var(--border)' }}
                  >
                    {periodLabel(p)}
                  </button>
                )
              })}
              {lastPeriod < MAX_PERIOD && (
                <button
                  type="button"
                  onClick={() => setPeriod(lastPeriod + 1)}
                  aria-label={`Add ${periodLabel(lastPeriod + 1)}`}
                  className={`flex-none w-10 h-10 rounded-lg border text-lg font-bold text-gray-400 bg-white hover:bg-gray-50 ${FOCUS}`}
                  style={{ borderColor: 'var(--border)' }}
                >
                  +
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <div className="flex-1 min-w-0 grid grid-cols-3 gap-0.5 rounded-xl border p-0.5 bg-white" style={{ borderColor: 'var(--border)' }} role="group" aria-label="Situation">
                {SITUATIONS.map((s) => {
                  const on = s === situation
                  const bg = s === 'man_up' ? 'var(--gh-green)' : s === 'man_down' ? 'var(--gh-maroon)' : undefined
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setSituation(s)}
                      className={`h-10 min-w-0 rounded-lg text-[13px] font-bold truncate px-1 touch-manipulation ${FOCUS} ${
                        on ? (bg ? 'text-white' : 'bg-gray-900 text-white') : 'text-gray-500 hover:bg-gray-50'
                      }`}
                      style={on && bg ? { background: bg } : undefined}
                    >
                      {SITUATION_LABELS[s]}
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={() => setFlow({ kind: 'goalie' })}
                aria-label={`In goal: ${goaliePlayer ? playerLabel(goaliePlayer) : 'not set'}. Change`}
                className={`flex-none min-w-[4.5rem] h-11 px-2.5 rounded-xl border text-left leading-tight ${FOCUS} ${
                  goalie ? 'bg-white hover:bg-gray-50' : 'bg-amber-50 border-amber-300'
                }`}
                style={goalie ? { borderColor: 'var(--border)' } : undefined}
              >
                <span className="block text-[9px] font-black uppercase tracking-[0.12em] text-gray-400">In goal</span>
                <span className="block text-sm font-black truncate max-w-[5rem]">
                  {goaliePlayer ? (goaliePlayer.number ? `#${goaliePlayer.number}` : goaliePlayer.name.split(' ').pop()) : goalie ? '?' : 'Set'}
                </span>
              </button>
            </div>
          </>
        )}
      </header>

      {/* ── The pad, and the log beside it on a laptop ── */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain lg:overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-[minmax(0,1fr)]">
        <section className="lg:overflow-y-auto px-3 py-3" aria-label="Log a stat">
          <div className="max-w-3xl mx-auto space-y-3">
            <Strip lines={lines} opp={opp} />

            {canWrite && failed > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 flex items-center gap-3" role="status">
                <p className="flex-1 min-w-0 text-sm text-red-800">
                  <b>
                    {failed} {failed === 1 ? 'stat hasn’t' : 'stats haven’t'} saved.
                  </b>{' '}
                  Kept on this phone until they do.
                </p>
                <button type="button" onClick={retryAll} className={`btn btn-ghost h-10 flex-none ${FOCUS}`}>
                  Retry
                </button>
              </div>
            )}

            {!canWrite && (
              <p className="rounded-xl border px-3 py-2 text-sm text-gray-600 bg-white" style={{ borderColor: 'var(--border)' }}>
                You can watch this game but not log stats for the {game.level === 'jv' ? 'JV' : 'varsity'} team. It updates every 20 seconds.
              </p>
            )}

            {isFinal && (
              <div className="card p-5 text-center space-y-3">
                <p className="section-label">Final</p>
                <p className="text-sm text-gray-600">
                  Green Hope {us}, {opp} {them}.{canWrite ? ' Reopen it to add or fix stats.' : ''}
                </p>
                {problem && busy === null && flow === null && <p className="text-sm text-red-700">{problem}</p>}
                <div className="flex flex-wrap justify-center gap-2">
                  {canWrite && (
                    <button type="button" onClick={reopen} disabled={busy === 'reopen'} className={`btn btn-primary h-12 disabled:opacity-60 ${FOCUS}`}>
                      {busy === 'reopen' ? 'Reopening…' : 'Reopen to add stats'}
                    </button>
                  )}
                  <Link href={boxHref} className={`btn btn-ghost h-12 ${FOCUS}`}>
                    Box score
                  </Link>
                </div>
              </div>
            )}

            {tracking && (
              <>
                <Pad title="Green Hope" color="var(--gh-green)" buttons={OUR_BUTTONS} onPress={press} />
                <Pad title={opp} color="var(--gh-maroon)" buttons={THEIR_BUTTONS} onPress={press} />
              </>
            )}
          </div>
        </section>

        <section className="lg:overflow-y-auto lg:border-l px-3 pb-6 lg:py-3" style={{ borderColor: 'var(--border)' }} aria-label="Game log">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="section-label">Log</h2>
              <span className="text-xs text-gray-400">
                {counted.length} {counted.length === 1 ? 'stat' : 'stats'}
              </span>
            </div>
            {groups.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">
                {tracking ? 'Nothing logged yet. Every tap shows up here, newest first.' : 'Nothing logged yet.'}
              </p>
            ) : (
              <div className="space-y-3">
                {groups.map(([p, rows]) => (
                  <div key={p}>
                    <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-gray-400 py-1">{periodLabel(p)}</h3>
                    <ol className="card overflow-hidden divide-y divide-gray-100">
                      {rows.map((e) => (
                        <LogRow
                          key={e.key}
                          entry={e}
                          text={describe(e.event)}
                          score={scoreAfter.get(e.key)}
                          editable={tracking}
                          onEdit={() => setFlow({ kind: 'edit', key: e.key })}
                          onRemove={() => remove(e.key)}
                          onRetry={() => void sync(e.key)}
                          onDiscard={() => discard(e.key)}
                        />
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── What just happened, and Undo ── */}
      {tracking && (
        <footer
          className="flex-none border-t bg-white px-3 pt-2 flex items-center gap-2"
          style={{ borderColor: 'var(--border)', paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
          <div className="flex-1 min-w-0 text-sm leading-snug" aria-live="polite">
            {notice?.kind === 'logged' && logged && !logged.removed ? (
              <span key={notice.key} className={`line-clamp-2 ${logged.status === 'failed' ? 'text-red-700' : ''}`}>
                <span className="font-black">{logged.status === 'failed' ? 'Didn’t save: ' : 'Logged: '}</span>
                {describe(logged.event)}
                {logged.status === 'saving' && <span className="text-gray-400" aria-hidden> · saving…</span>}
                {logged.status === 'ok' && <span style={{ color: 'var(--gh-green)' }} aria-hidden> ✓</span>}
              </span>
            ) : notice?.kind === 'removed' ? (
              <span key={`removed-${notice.event.id}`} className="line-clamp-2">
                <span className="font-black">Removed: </span>
                {describe(notice.event)}
              </span>
            ) : (
              <span className="text-gray-400">Tap a stat to log it.</span>
            )}
          </div>
          {suggest && (
            <button
              type="button"
              onClick={() => {
                setSituation(suggest)
                if (notice?.kind === 'logged') setNotice({ ...notice, suggest: null })
              }}
              className={`flex-none h-12 px-3 rounded-xl text-sm font-bold text-white ${FOCUS}`}
              style={{ background: suggest === 'man_up' ? 'var(--gh-green)' : 'var(--gh-maroon)' }}
            >
              Go {SITUATION_LABELS[suggest].toLowerCase()}
            </button>
          )}
          {notice?.kind === 'removed' && (
            <button type="button" onClick={() => putBack(notice.event)} className={`btn btn-ghost flex-none h-12 ${FOCUS}`}>
              Put back
            </button>
          )}
          <button
            type="button"
            onClick={undo}
            disabled={!counted.length}
            aria-label={counted.length ? `Undo: ${describe(counted[counted.length - 1].event)}` : 'Undo'}
            className={`flex-none h-12 px-5 rounded-xl bg-gray-900 text-white text-base font-black touch-manipulation disabled:opacity-30 ${FOCUS}`}
          >
            Undo
          </button>
        </footer>
      )}

      {/* ── Sheets ── */}
      {flow?.kind === 'log' && (
        <FlowSheet
          // A fresh sheet per step, so focus starts at the top of each question.
          key={flow.step}
          button={flow.button}
          step={flow.step}
          draft={flow.draft}
          players={players}
          faceoffIds={faceoffIds}
          onAnswer={answer}
          onBack={() => setFlow({ ...flow, step: Math.max(0, flow.step - 1) })}
          onClose={() => setFlow(null)}
        />
      )}
      {flow?.kind === 'goalie' && (
        <GoalieSheet
          players={players}
          goalie={goalie}
          onPick={(id) => {
            setGoalie(id)
            setFlow(null)
          }}
          onClose={() => setFlow(null)}
        />
      )}
      {flow?.kind === 'edit' && editing && (
        <EditSheet
          key={editing.key}
          event={editing.event}
          players={players}
          error={editing.status === 'failed' ? editing.error : null}
          onSave={(ev) => saveEdit(editing.key, ev)}
          onRemove={() => {
            setFlow(null)
            remove(editing.key)
          }}
          onClose={() => setFlow(null)}
        />
      )}
      {flow?.kind === 'finish' && (
        <Sheet title="Finish the game?" onClose={() => (busy ? undefined : setFlow(null))}>
          <div className="py-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3 text-center">
            <div className="min-w-0">
              <div className="text-[11px] font-black uppercase tracking-[0.14em] truncate" style={{ color: 'var(--gh-green)' }}>
                Green Hope
              </div>
              <div className="text-5xl font-black tabular-nums leading-none">{us}</div>
            </div>
            <div className="text-3xl font-black text-gray-300 pb-1">–</div>
            <div className="min-w-0">
              <div className="text-[11px] font-black uppercase tracking-[0.14em] truncate" style={{ color: 'var(--gh-maroon)' }}>
                {opp}
              </div>
              <div className="text-5xl font-black tabular-nums leading-none">{them}</div>
            </div>
          </div>
          <p className="text-sm text-gray-600 text-center">
            This marks the game final and puts {us}–{them} on the schedule. You can reopen it later to add anything missed.
          </p>
          {!counted.length && (
            <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Nothing has been logged yet. Log the game first; finishing an empty one would put 0–0 on the schedule.
            </p>
          )}
          {unsynced && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 flex items-center gap-3">
              <p className="flex-1 min-w-0">
                {failed ? 'Some stats haven’t saved yet. Get them saved first so the final score is right.' : 'Saving the last stats…'}
              </p>
              {failed > 0 && (
                <button type="button" onClick={retryAll} className={`btn btn-ghost h-10 flex-none ${FOCUS}`}>
                  Retry
                </button>
              )}
            </div>
          )}
          {problem && <p className="mt-3 text-sm text-red-700 text-center">{problem}</p>}
          <div className="mt-5 grid gap-2">
            <button type="button" onClick={finish} disabled={unsynced || !counted.length || busy !== null} className={`btn btn-primary h-14 text-base disabled:opacity-50 ${FOCUS}`}>
              {busy === 'finish' ? 'Finishing…' : `Finish: ${us}–${them}`}
            </button>
            <button type="button" onClick={() => setFlow(null)} disabled={busy !== null} className={`btn btn-ghost h-12 ${FOCUS}`}>
              Keep tracking
            </button>
          </div>
        </Sheet>
      )}
    </div>
  )
}

// ── Pieces ──────────────────────────────────────────────────────────────────

/** One half of the pad: four big buttons across, ours in green, theirs plain. */
function Pad({ title, color, buttons, onPress }: { title: string; color: string; buttons: PadButton[]; onPress: (b: PadButton) => void }) {
  return (
    <div>
      <h2 className="text-[11px] font-black uppercase tracking-[0.16em] mb-1.5 truncate" style={{ color }}>
        {title}
      </h2>
      <div className="grid grid-cols-4 gap-2">
        {buttons.map((b) => {
          const style: React.CSSProperties = b.solid
            ? { background: color, borderColor: color, color: '#fff' }
            : b.group === 'us'
              ? {
                  background: 'color-mix(in srgb, var(--gh-green) 9%, var(--surface))',
                  borderColor: 'color-mix(in srgb, var(--gh-green) 35%, var(--border))',
                }
              : { background: 'var(--surface)', borderColor: 'var(--border)' }
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => onPress(b)}
              aria-label={b.aria}
              className={`${b.wide ? 'col-span-2' : ''} min-h-[60px] min-w-0 rounded-xl border px-1 py-1.5 flex flex-col items-center justify-center text-center leading-tight select-none touch-manipulation active:scale-[0.96] transition-transform ${FOCUS}`}
              style={style}
            >
              <span className={`font-black ${b.solid ? 'text-lg' : 'text-[13px] sm:text-sm'}`}>{b.label}</span>
              {b.hint && <span className={`text-[10px] mt-0.5 ${b.solid ? 'text-white/80' : 'text-gray-500'}`}>{b.hint}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** The running numbers, small, us first. */
function Strip({ lines, opp }: { lines: ReturnType<typeof teamLines>; opp: string }) {
  const { us, them } = lines
  const cells: { label: string; value: string; said: string }[] = [
    { label: 'Shots', value: `${us.shots}–${them.shots}`, said: `Shots: Green Hope ${us.shots}, ${opp} ${them.shots}` },
    { label: 'SOG', value: `${us.shotsOnGoal}–${them.shotsOnGoal}`, said: `Shots on goal: Green Hope ${us.shotsOnGoal}, ${opp} ${them.shotsOnGoal}` },
    { label: 'GB', value: `${us.groundBalls}–${them.groundBalls}`, said: `Ground balls: Green Hope ${us.groundBalls}, ${opp} ${them.groundBalls}` },
    { label: 'FO', value: `${us.faceoffs.made}–${them.faceoffs.made}`, said: `Faceoffs: won ${us.faceoffs.made}, lost ${them.faceoffs.made}` },
    { label: 'TO', value: `${us.turnovers}–${them.turnovers}`, said: `Turnovers: Green Hope ${us.turnovers}, ${opp} ${them.turnovers}` },
    { label: 'Clears', value: fmtRate(us.clears), said: `Our clears: ${us.clears.made} of ${us.clears.att}` },
    { label: 'Saves', value: `${us.saving.made}–${them.saving.made}`, said: `Saves: Green Hope ${us.saving.made}, ${opp} ${them.saving.made}` },
  ]
  return (
    <dl className="grid grid-cols-7 rounded-xl border bg-white divide-x divide-gray-100 overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      {cells.map((c) => (
        <div key={c.label} className="min-w-0 py-1.5 text-center">
          <dt className="text-[9px] font-black uppercase tracking-wide text-gray-400 truncate">{c.label}</dt>
          <dd className="text-[13px] font-black tabular-nums truncate">
            <span aria-hidden>{c.value}</span>
            <span className="sr-only">{c.said}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** One stat in the log: tap to fix it, × to take it out; or, if it didn't save, retry or let it go. */
function LogRow({
  entry,
  text,
  score,
  editable,
  onEdit,
  onRemove,
  onRetry,
  onDiscard,
}: {
  entry: Entry
  text: string
  score: string | undefined
  editable: boolean
  onEdit: () => void
  onRemove: () => void
  onRetry: () => void
  onDiscard: () => void
}) {
  const failed = entry.status === 'failed'
  const body = (
    <>
      <span className={`block text-sm ${entry.removed ? 'line-through text-gray-400' : ''} ${score ? 'font-bold' : ''}`}>{text}</span>
      {entry.status === 'saving' && <span className="block text-[11px] text-gray-400">Saving…</span>}
      {failed && <span className="block text-[11px] text-red-700">{entry.error ?? 'Didn’t save.'}</span>}
      {editable && !entry.removed && <span className="sr-only">Tap to fix it.</span>}
    </>
  )
  return (
    <li className={`flex items-stretch min-h-12 ${failed ? 'bg-red-50' : ''}`}>
      <span className="w-1 flex-none" style={{ background: creditOf(entry.event) === 'us' ? 'var(--gh-green)' : 'var(--gh-maroon)' }} aria-hidden />
      {editable && !entry.removed ? (
        <button type="button" onClick={onEdit} className={`flex-1 min-w-0 text-left px-3 py-2 hover:bg-gray-50 ${FOCUS}`}>
          {body}
        </button>
      ) : (
        <div className="flex-1 min-w-0 px-3 py-2">{body}</div>
      )}
      {score && (
        <span className="flex-none self-center text-xs font-black tabular-nums text-gray-500 px-1">
          <span aria-hidden>{score}</span>
          <span className="sr-only">Score after it: {score}</span>
        </span>
      )}
      {editable && failed ? (
        <span className="flex-none flex items-center gap-1 pr-2">
          <button type="button" onClick={onRetry} className={`h-9 px-3 rounded-lg text-xs font-bold text-white ${FOCUS}`} style={{ background: 'var(--gh-green)' }}>
            Retry
          </button>
          <button type="button" onClick={onDiscard} className={`h-9 px-2 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-100 ${FOCUS}`}>
            {!entry.saved ? 'Discard' : entry.removed ? 'Keep' : 'Revert'}
          </button>
        </span>
      ) : editable ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove: ${text}`}
          className={`flex-none w-12 text-xl text-gray-300 hover:text-gray-600 hover:bg-gray-50 ${FOCUS}`}
        >
          ×
        </button>
      ) : null}
    </li>
  )
}
