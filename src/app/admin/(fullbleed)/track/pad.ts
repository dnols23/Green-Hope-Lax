// The tracker's buttons, and the one event each of them logs.
//
// Pure, so the whole mapping from "what the coach tapped" to "what goes in the
// log" sits in one table that can be read against the table in lib/stats.ts.
// Every button is exactly one event shape; the steps are only what the coach
// still has to say about it (who, how it ended, how long).

import { SHOT_LABELS, type Situation, type StatEvent, type StatKind, type StatPlayer, type StatSide } from '@/lib/stats'
import type { StatInput } from '@/lib/statsActions'
import { positionsFor } from '@/lib/depthChart'

/** What the sheet asks, in order, before the stat is logged. */
export type Step = 'player' | 'assist' | 'result' | 'minutes'

export interface Choice {
  value: string
  label: string
}

export interface PadButton {
  id: string
  /** Big text on the button. */
  label: string
  /** Small text under it, where the label alone could be misread. */
  hint?: string
  /** What a screen reader says. */
  aria: string
  /** Which half of the pad it sits in: our play, or theirs. */
  group: 'us' | 'them'
  side: StatSide
  kind: StatKind
  /** The result, when the button decides it; null when the coach picks it. */
  result: string | null
  steps: Step[]
  /** The result step's options. */
  choices?: Choice[]
  /** The player step's question. */
  ask?: string
  /** What "no player" is called on the player step. */
  none?: string
  /** Their shots go on the goalie in the cage, without asking. */
  goalie?: boolean
  /** Faceoff men go first on the player step. */
  faceoff?: boolean
  /** A solid button: the goals. */
  solid?: boolean
  /** Two columns wide on the four-column pad. */
  wide?: boolean
}

const shotChoices = (results: ('saved' | 'missed' | 'blocked' | 'post')[]): Choice[] =>
  results.map((r) => ({ value: r, label: SHOT_LABELS[r] }))

/** Our half, in pad order: scoring, possession, then the clears. */
export const OUR_BUTTONS: PadButton[] = [
  {
    id: 'goal', label: 'Goal', aria: 'Our goal', group: 'us', side: 'us', kind: 'shot', result: 'goal',
    steps: ['player', 'assist'], ask: 'Who scored?', none: 'Not sure', solid: true,
  },
  {
    id: 'shot', label: 'Shot', hint: 'no goal', aria: 'Our shot, no goal', group: 'us', side: 'us', kind: 'shot', result: null,
    steps: ['player', 'result'], choices: shotChoices(['saved', 'missed', 'blocked', 'post']), ask: 'Who shot?', none: 'Not sure',
  },
  {
    id: 'gb', label: 'Ground ball', aria: 'Our ground ball', group: 'us', side: 'us', kind: 'ground_ball', result: null,
    steps: ['player'], ask: 'Who picked it up?', none: 'Not sure',
  },
  {
    id: 'ct', label: 'Caused turnover', aria: 'We caused a turnover', group: 'us', side: 'them', kind: 'turnover', result: 'caused',
    steps: ['player'], ask: 'Who caused it?', none: 'No one / team',
  },
  {
    id: 'fo-won', label: 'Faceoff won', aria: 'Faceoff won', group: 'us', side: 'us', kind: 'faceoff', result: 'won',
    steps: ['player'], ask: 'Who won it?', none: 'Not sure', faceoff: true,
  },
  {
    id: 'fo-lost', label: 'Faceoff lost', aria: 'Faceoff lost', group: 'us', side: 'us', kind: 'faceoff', result: 'lost',
    steps: ['player'], ask: 'Who took it?', none: 'Not sure', faceoff: true,
  },
  {
    id: 'to', label: 'Turnover', aria: 'Our turnover', group: 'us', side: 'us', kind: 'turnover', result: null,
    steps: ['player', 'result'],
    choices: [
      { value: 'unforced', label: 'Unforced' },
      { value: 'caused', label: 'Forced by them' },
    ],
    ask: 'Who turned it over?', none: 'Not sure',
  },
  {
    id: 'pen', label: 'Penalty', aria: 'Our penalty', group: 'us', side: 'us', kind: 'penalty', result: null,
    steps: ['player', 'minutes'], ask: 'Who took it?', none: 'Not sure',
  },
  { id: 'clear-ok', label: 'Clear ✓', aria: 'Our clear, success', group: 'us', side: 'us', kind: 'clear', result: 'success', steps: [], wide: true },
  { id: 'clear-fail', label: 'Clear ✗', aria: 'Our clear, failed', group: 'us', side: 'us', kind: 'clear', result: 'fail', steps: [], wide: true },
]

/** Their half. Their shots land on our goalie in the cage. */
export const THEIR_BUTTONS: PadButton[] = [
  { id: 'ga', label: 'Goal', aria: 'Goal against', group: 'them', side: 'them', kind: 'shot', result: 'goal', steps: [], goalie: true, solid: true },
  { id: 'save', label: 'Save', hint: 'our goalie', aria: 'Their shot, saved by our goalie', group: 'them', side: 'them', kind: 'shot', result: 'saved', steps: [], goalie: true },
  {
    id: 'their-shot', label: 'Shot', hint: 'not on goal', aria: 'Their shot, missed, blocked or pipe', group: 'them', side: 'them',
    kind: 'shot', result: null, steps: ['result'], choices: shotChoices(['missed', 'blocked', 'post']), goalie: true,
  },
  { id: 'their-gb', label: 'Ground ball', aria: 'Their ground ball', group: 'them', side: 'them', kind: 'ground_ball', result: null, steps: [] },
  { id: 'their-clear-ok', label: 'Clear ✓', aria: 'Their clear, success', group: 'them', side: 'them', kind: 'clear', result: 'success', steps: [] },
  { id: 'their-clear-fail', label: 'Clear ✗', hint: 'our ride', aria: 'Their clear failed, good ride', group: 'them', side: 'them', kind: 'clear', result: 'fail', steps: [] },
  { id: 'their-pen', label: 'Penalty', aria: 'Their penalty', group: 'them', side: 'them', kind: 'penalty', result: null, steps: ['minutes'] },
  { id: 'their-to', label: 'Turnover', hint: 'unforced', aria: 'Their unforced turnover', group: 'them', side: 'them', kind: 'turnover', result: 'unforced', steps: [] },
]

/** What the coach has said so far on the way to logging a button. */
export interface Draft {
  playerId: string | null
  assistId: string | null
  result: string | null
  minutes: number | null
}

export const EMPTY_DRAFT: Draft = { playerId: null, assistId: null, result: null, minutes: null }

/** The event a button logs, once every step is answered. */
export function buildEvent(
  b: PadButton,
  d: Draft,
  at: { key: string; gameId: string; period: number; situation: Situation; goalie: string | null; now: string },
): StatEvent {
  const result = b.result ?? d.result
  return {
    id: at.key,
    game_id: at.gameId,
    seq: 0,
    period: at.period,
    side: b.side,
    kind: b.kind,
    result,
    // A player only where the button asked for one (or the goalie, for their shots).
    player_id: b.goalie ? at.goalie : b.steps.includes('player') ? d.playerId : null,
    // Only our goals carry an assist; the server turns anything else away.
    assist_id: b.kind === 'shot' && b.side === 'us' && result === 'goal' && d.assistId !== d.playerId ? d.assistId : null,
    situation: at.situation,
    penalty_minutes: b.kind === 'penalty' ? (d.minutes ?? 1) : null,
    created_at: at.now,
  }
}

/** The event as the server actions take it. */
export function toInput(e: StatEvent): StatInput {
  return {
    gameId: e.game_id,
    period: e.period,
    side: e.side,
    kind: e.kind,
    result: e.result,
    playerId: e.player_id,
    assistId: e.assist_id,
    situation: e.situation,
    penaltyMinutes: e.penalty_minutes,
  }
}

/** Whether two versions of a stat say the same thing (ids and times aside). */
export function sameStat(a: StatEvent, b: StatEvent): boolean {
  return (
    a.period === b.period &&
    a.side === b.side &&
    a.kind === b.kind &&
    a.result === b.result &&
    a.player_id === b.player_id &&
    a.assist_id === b.assist_id &&
    a.situation === b.situation &&
    a.penalty_minutes === b.penalty_minutes
  )
}

/**
 * Whose good news an event is, for its colour in the log: a turnover we caused
 * is logged on their side but is ours to be pleased about.
 */
export function creditOf(e: StatEvent): 'us' | 'them' {
  if (e.kind === 'turnover' && e.side === 'them' && e.result === 'caused') return 'us'
  return e.side
}

// ── Editing a logged stat ───────────────────────────────────────────────────

/** Who the player on an event is, in a word, or null when it has none. */
export function playerRole(e: Pick<StatEvent, 'kind' | 'side' | 'result'>): string | null {
  switch (e.kind) {
    case 'shot':
      return e.side === 'us' ? 'Shooter' : 'In goal'
    case 'ground_ball':
      return e.side === 'us' ? 'Picked up by' : null
    case 'faceoff':
      return 'Faceoff man'
    case 'turnover':
      if (e.side === 'us') return 'Turned over by'
      return e.result === 'caused' ? 'Caused by' : null
    case 'penalty':
      return e.side === 'us' ? 'Penalty on' : null
    case 'clear':
      return null
  }
}

/** The results an event can be changed to, worded for its side. */
export function resultChoices(e: Pick<StatEvent, 'kind' | 'side'>): Choice[] {
  switch (e.kind) {
    case 'shot':
      return (['goal', 'saved', 'missed', 'blocked', 'post'] as const).map((r) => ({ value: r, label: SHOT_LABELS[r] }))
    case 'faceoff':
      return [
        { value: 'won', label: 'Won' },
        { value: 'lost', label: 'Lost' },
      ]
    case 'turnover':
      return e.side === 'us'
        ? [
            { value: 'unforced', label: 'Unforced' },
            { value: 'caused', label: 'Forced by them' },
          ]
        : [
            { value: 'caused', label: 'We caused it' },
            { value: 'unforced', label: 'Unforced' },
          ]
    case 'clear':
      return [
        { value: 'success', label: 'Cleared' },
        { value: 'fail', label: e.side === 'us' ? 'Failed' : 'Failed (our ride)' },
      ]
    default:
      return []
  }
}

/**
 * An edited event made consistent before it is sent: no assist unless it is
 * our goal, no player where the table has none (their unforced turnover), and
 * minutes only on a penalty.
 */
export function tidyEvent(e: StatEvent): StatEvent {
  const isOurGoal = e.kind === 'shot' && e.side === 'us' && e.result === 'goal'
  return {
    ...e,
    player_id: playerRole(e) ? e.player_id : null,
    assist_id: isOurGoal && e.assist_id !== e.player_id ? e.assist_id : null,
    penalty_minutes: e.kind === 'penalty' ? (e.penalty_minutes ?? 1) : null,
  }
}

// ── Players ─────────────────────────────────────────────────────────────────

export function lastName(p: StatPlayer): string {
  const parts = p.name.trim().split(/\s+/)
  return parts[parts.length - 1] ?? ''
}

export function looksLike(p: StatPlayer, position: 'goalie' | 'fogo'): boolean {
  return positionsFor(p.position).includes(position)
}

/**
 * Who starts in goal: whoever was in goal for their last shot in this game,
 * else the first active player whose roster position says goalie.
 */
export function defaultGoalie(events: StatEvent[], players: StatPlayer[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]
    if (e.kind === 'shot' && e.side === 'them' && e.player_id) return e.player_id
  }
  return players.find((p) => p.is_active && looksLike(p, 'goalie'))?.id ?? null
}

/**
 * The faceoff men to offer first: whoever took this game's faceoffs, most
 * recent first; before the first faceoff, the roster's faceoff specialists.
 */
export function faceoffMen(events: StatEvent[], players: StatPlayer[]): string[] {
  const out: string[] = []
  for (let i = events.length - 1; i >= 0 && out.length < 3; i--) {
    const e = events[i]
    if (e.kind === 'faceoff' && e.player_id && !out.includes(e.player_id)) out.push(e.player_id)
  }
  if (out.length) return out
  return players.filter((p) => p.is_active && looksLike(p, 'fogo')).slice(0, 3).map((p) => p.id)
}
