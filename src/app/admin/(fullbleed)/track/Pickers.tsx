'use client'
import { useState } from 'react'
import { PENALTY_MINUTES, playerLabel, type StatPlayer } from '@/lib/stats'
import { lastName, looksLike, type Draft, type PadButton } from './pad'
import { Sheet } from './Sheet'

/** Keyboard focus that shows on a green button as well as a white one. */
export const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900'

export function minutesLabel(m: number): string {
  return m === 0.5 ? '½' : m === 1.5 ? '1½' : String(m)
}

/**
 * Jersey numbers, big. A coach finds a player by the number on his back, so
 * the number is the button and the last name is only there to be sure.
 * Active players only until "Show everyone" is tapped.
 */
export function PlayerGrid({
  players,
  onPick,
  none,
  noneProminent = false,
  exclude = null,
  first,
  selected = null,
}: {
  players: StatPlayer[]
  onPick: (id: string | null) => void
  /** The "no player" choice's label; left out where a player is required. */
  none?: string
  /** "Unassisted" is the most common answer, so it is the big button. */
  noneProminent?: boolean
  /** A player who can't be picked here (the shooter, on the assist step). */
  exclude?: string | null
  /** Players offered ahead of everyone (the faceoff men, the goalies). */
  first?: { label: string; ids: string[] }
  selected?: string | null
}) {
  const [everyone, setEveryone] = useState(false)
  const pool = players.filter((p) => p.id !== exclude)
  const shown = everyone ? pool : pool.filter((p) => p.is_active || p.id === selected)
  const hidden = pool.length - shown.length
  const topLabel = first?.label ?? ''
  const top = first ? first.ids.map((id) => pool.find((p) => p.id === id)).filter((p): p is StatPlayer => !!p) : []

  const key = (p: StatPlayer, where: string) => (
    <button
      key={`${where}-${p.id}`}
      type="button"
      onClick={() => onPick(p.id)}
      aria-label={playerLabel(p)}
      aria-pressed={selected ? p.id === selected : undefined}
      className={`h-16 min-w-0 rounded-xl border flex flex-col items-center justify-center px-1 touch-manipulation select-none active:scale-[0.97] transition-transform ${FOCUS} ${
        p.id === selected ? 'bg-gray-900 text-white border-gray-900' : 'bg-white hover:bg-gray-50'
      } ${p.is_active ? '' : 'opacity-70'}`}
      style={p.id === selected ? undefined : { borderColor: 'var(--border)' }}
    >
      {p.number ? (
        <span className="text-2xl font-black tabular-nums leading-none">{p.number}</span>
      ) : (
        <span className="text-sm font-black leading-tight truncate max-w-full">{lastName(p)}</span>
      )}
      {p.number && <span className={`mt-1 text-[11px] leading-none truncate max-w-full ${p.id === selected ? 'text-white/80' : 'text-gray-500'}`}>{lastName(p)}</span>}
    </button>
  )

  return (
    <div className="space-y-3">
      {none != null && (
        <button
          type="button"
          onClick={() => onPick(null)}
          className={`w-full rounded-xl font-bold touch-manipulation ${FOCUS} ${
            noneProminent ? 'h-14 text-base text-white' : 'h-11 text-sm border text-gray-600 bg-white hover:bg-gray-50'
          }`}
          style={noneProminent ? { background: 'var(--gh-green)' } : { borderColor: 'var(--border)' }}
        >
          {none}
        </button>
      )}
      {top.length > 0 && (
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-gray-400 mb-1.5">{topLabel}</p>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">{top.map((p) => key(p, 'top'))}</div>
        </div>
      )}
      <div>
        {top.length > 0 && <p className="text-[11px] font-black uppercase tracking-[0.14em] text-gray-400 mb-1.5">Everyone</p>}
        {shown.length ? (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">{shown.map((p) => key(p, 'all'))}</div>
        ) : (
          <p className="text-sm text-gray-500 py-3 text-center">No players on this roster yet.</p>
        )}
      </div>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setEveryone(true)}
          className={`w-full h-11 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 ${FOCUS}`}
        >
          Show everyone ({hidden} not active)
        </button>
      )}
    </div>
  )
}

/** One of a few big answers: how a shot ended, forced or unforced. */
function BigChoices({ choices, onPick }: { choices: { value: string; label: string }[]; onPick: (v: string) => void }) {
  return (
    <div className={`grid gap-2 ${choices.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {choices.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => onPick(c.value)}
          className={`h-16 rounded-xl border bg-white hover:bg-gray-50 text-lg font-black touch-manipulation active:scale-[0.97] transition-transform ${FOCUS}`}
          style={{ borderColor: 'var(--border)' }}
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}

/**
 * The steps between a tap on the pad and the stat going in the log: who, then
 * (for a goal) who fed him, (for a shot) how it ended, (for a penalty) how
 * long. Every answer moves straight on; the last one logs it.
 */
export function FlowSheet({
  button,
  step,
  draft,
  players,
  faceoffIds,
  onAnswer,
  onBack,
  onClose,
}: {
  button: PadButton
  step: number
  draft: Draft
  players: StatPlayer[]
  faceoffIds: string[]
  onAnswer: (patch: Partial<Draft>) => void
  onBack: () => void
  onClose: () => void
}) {
  const at = button.steps[step]
  const byId = (id: string | null) => (id ? players.find((p) => p.id === id) : undefined)
  const shooter = byId(draft.playerId)
  const whose = button.group === 'them' ? 'Their ' + button.label.toLowerCase() : button.label

  // What has been said so far, so the coach can see the stat taking shape.
  const sofar = [whose.replace(/ [✓✗]$/, ''), step > 0 && button.steps[0] === 'player' ? (shooter ? playerLabel(shooter, true) : button.none) : null]
    .filter(Boolean)
    .join(' · ')

  const title =
    at === 'player'
      ? button.ask
      : at === 'assist'
        ? 'Assisted by?'
        : at === 'minutes'
          ? 'How long?'
          : button.kind === 'turnover'
            ? 'Forced or unforced?'
            : 'How did it end?'

  return (
    <Sheet
      onClose={onClose}
      back={step > 0 ? onBack : undefined}
      title={
        <>
          <span className="block text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: button.group === 'us' ? 'var(--gh-green)' : 'var(--gh-maroon)' }}>
            {sofar}
          </span>
          {title}
        </>
      }
    >
      {at === 'player' && (
        <PlayerGrid
          players={players}
          none={button.none}
          first={button.faceoff && faceoffIds.length ? { label: 'Taking faceoffs', ids: faceoffIds } : undefined}
          onPick={(id) => onAnswer({ playerId: id })}
        />
      )}
      {at === 'assist' && (
        <PlayerGrid
          players={players}
          none="Unassisted"
          noneProminent
          exclude={draft.playerId}
          onPick={(id) => onAnswer({ assistId: id })}
        />
      )}
      {at === 'result' && button.choices && <BigChoices choices={button.choices} onPick={(v) => onAnswer({ result: v })} />}
      {at === 'minutes' && (
        <div className="grid grid-cols-5 gap-2">
          {PENALTY_MINUTES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onAnswer({ minutes: m })}
              aria-label={`${m} minute${m === 1 ? '' : 's'}`}
              className={`h-16 rounded-xl border flex flex-col items-center justify-center touch-manipulation active:scale-[0.97] transition-transform ${FOCUS} ${
                m === 1 ? 'text-white' : 'bg-white hover:bg-gray-50'
              }`}
              style={m === 1 ? { background: 'var(--gh-green)', borderColor: 'var(--gh-green)' } : { borderColor: 'var(--border)' }}
            >
              <span className="text-xl font-black leading-none">{minutesLabel(m)}</span>
              <span className={`text-[10px] mt-1 ${m === 1 ? 'text-white/80' : 'text-gray-500'}`}>min</span>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  )
}

/** "Who's in goal?" — set once, used for every one of their shots after. */
export function GoalieSheet({
  players,
  goalie,
  onPick,
  onClose,
}: {
  players: StatPlayer[]
  goalie: string | null
  onPick: (id: string | null) => void
  onClose: () => void
}) {
  const goalies = players.filter((p) => p.is_active && looksLike(p, 'goalie')).map((p) => p.id)
  return (
    <Sheet onClose={onClose} title="Who’s in goal?">
      <p className="text-sm text-gray-500 mb-3">Their shots and goals go on him until you change it.</p>
      <PlayerGrid
        players={players}
        selected={goalie}
        none="No one / not sure"
        first={goalies.length ? { label: 'Goalies', ids: goalies } : undefined}
        onPick={onPick}
      />
    </Sheet>
  )
}
