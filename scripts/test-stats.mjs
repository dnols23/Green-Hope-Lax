// The stat math, checked: node --test scripts/test-stats.mjs  (npm run test:stats)
//
// A small game built by hand with every number worked out on paper first,
// then the edge cases that would put a wrong number in front of a coach
// (nothing tracked, nothing attempted, overtime, penalties stacking up), and
// finally a whole made-up season from scripts/stats-fixture.mjs, where the
// totals have to agree with each other however the games went.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  readStatEvent,
  statProblem,
  rate,
  fmtPct,
  fmtRate,
  teamLines,
  periodLines,
  playerLines,
  summarizeGame,
  recordOf,
  filterGames,
  aggregate,
  metricValue,
  metricNumber,
  fmtMetric,
  metricSeries,
  insights,
  playerLabel,
  byJersey,
  describeEvent,
  periodLabel,
  seasonOf,
  statSeasons,
  pickSeason,
  gamesInSeason,
  METRICS,
  GAME_FILTERS,
  STAT_KINDS,
  KIND_RESULTS,
} from '../src/lib/stats.ts'
import { makeSeason, inputOf } from './stats-fixture.mjs'

// ── Building events ─────────────────────────────────────────────────────────

let nextSeq = 1
/** An event as the database would hand it back, read the way the app reads it. */
function ev(game, period, side, kind, result = null, extra = {}) {
  const row = {
    id: `e${nextSeq}`,
    game_id: game,
    seq: nextSeq++,
    period,
    side,
    kind,
    result,
    player_id: null,
    assist_id: null,
    situation: 'even',
    penalty_minutes: null,
    created_at: '2027-03-01T23:00:00+00:00',
    ...extra,
  }
  const e = readStatEvent(row)
  assert.ok(e, `fixture event should read: ${JSON.stringify(row)}`)
  return e
}

const game = (id, over = {}) => ({
  id,
  game_date: '2027-03-01T23:00:00+00:00',
  opponent: `Opp ${id}`,
  home_away: 'home',
  level: 'varsity',
  is_conference: true,
  status: 'final',
  team_score: null,
  opp_score: null,
  ...over,
})

// Our players in the hand-built game.
const A1 = 'a1', A2 = 'a2', M1 = 'm1', FO = 'fo', D1 = 'd1', G1 = 'g1'

/**
 * The hand-built game. Numbers in the comments are the event's place in the
 * game; every expected value below was counted from this list by hand.
 */
function handGame(id = 'G') {
  const s = (p, res, extra) => ev(id, p, 'us', 'shot', res, extra)
  const t = (p, res, extra) => ev(id, p, 'them', 'shot', res, extra)
  return [
    // Q1
    ev(id, 1, 'us', 'faceoff', 'won', { player_id: FO }), // 1
    ev(id, 1, 'us', 'ground_ball', null, { player_id: FO }), // 2
    s(1, 'goal', { player_id: A1, assist_id: A2 }), // 3
    ev(id, 1, 'us', 'faceoff', 'lost', { player_id: FO }), // 4
    ev(id, 1, 'them', 'ground_ball'), // 5
    t(1, 'saved', { player_id: G1 }), // 6
    ev(id, 1, 'us', 'clear', 'success'), // 7
    s(1, 'saved', { player_id: A2 }), // 8
    ev(id, 1, 'them', 'clear', 'success'), // 9
    t(1, 'goal', { player_id: G1 }), // 10
    ev(id, 1, 'us', 'faceoff', 'won', { player_id: FO }), // 11
    ev(id, 1, 'us', 'turnover', 'caused', { player_id: A1 }), // 12
    ev(id, 1, 'them', 'ground_ball'), // 13
    // Q2
    ev(id, 2, 'us', 'faceoff', 'lost', { player_id: M1 }), // 14
    ev(id, 2, 'them', 'penalty', null, { penalty_minutes: 1 }), // 15
    s(2, 'goal', { player_id: A1, situation: 'man_up' }), // 16 unassisted EMO
    ev(id, 2, 'us', 'faceoff', 'won', { player_id: FO }), // 17
    s(2, 'missed', { player_id: M1 }), // 18
    s(2, 'post', { player_id: A2 }), // 19
    s(2, 'blocked', { player_id: A1 }), // 20
    ev(id, 2, 'us', 'ground_ball', null, { player_id: D1 }), // 21
    ev(id, 2, 'them', 'turnover', 'caused', { player_id: D1 }), // 22
    ev(id, 2, 'us', 'ground_ball', null, { player_id: D1 }), // 23
    ev(id, 2, 'us', 'clear', 'fail'), // 24
    ev(id, 2, 'us', 'turnover', 'unforced', { player_id: M1 }), // 25
    // Q3
    ev(id, 3, 'us', 'faceoff', 'lost', { player_id: FO }), // 26
    ev(id, 3, 'us', 'penalty', null, { player_id: D1, penalty_minutes: 1.5 }), // 27
    t(3, 'goal', { player_id: G1, situation: 'man_down' }), // 28 their EMO goal
    ev(id, 3, 'us', 'faceoff', 'won', { player_id: FO }), // 29
    ev(id, 3, 'us', 'penalty', null, { player_id: M1, penalty_minutes: 0.5 }), // 30
    t(3, 'saved', { player_id: G1, situation: 'man_down' }), // 31 killed
    ev(id, 3, 'them', 'clear', 'fail'), // 32 good ride
    s(3, 'goal', { player_id: M1, assist_id: A1 }), // 33
    ev(id, 3, 'us', 'faceoff', 'lost', { player_id: FO }), // 34
    ev(id, 3, 'them', 'turnover', 'unforced'), // 35
    ev(id, 3, 'us', 'clear', 'success'), // 36
    // Q4
    ev(id, 4, 'us', 'faceoff', 'won', { player_id: FO }), // 37
    s(4, 'saved', { player_id: A1 }), // 38
    ev(id, 4, 'them', 'clear', 'success'), // 39
    t(4, 'missed', { player_id: G1 }), // 40
    t(4, 'goal'), // 41 nobody in the cage noted
    ev(id, 4, 'them', 'penalty', null, { penalty_minutes: 2 }), // 42
    ev(id, 4, 'them', 'penalty', null, { penalty_minutes: 0.5 }), // 43 two of theirs at once
    s(4, 'goal', { player_id: A2, assist_id: M1, situation: 'man_up' }), // 44
    // OT
    ev(id, 5, 'us', 'faceoff', 'won', { player_id: FO }), // 45
    s(5, 'goal', { player_id: A1, assist_id: A2 }), // 46 the winner
  ]
}

const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg ?? ''} expected ${b}, got ${a}`)
const rateIs = (r, made, att, msg) => {
  assert.equal(r.made, made, `${msg} made`)
  assert.equal(r.att, att, `${msg} att`)
  if (att === 0) assert.equal(r.pct, null, `${msg} pct`)
  else close(r.pct, made / att, `${msg} pct`)
}

// ── The hand-built game ─────────────────────────────────────────────────────

describe('a hand-built game, counted on paper', () => {
  const events = handGame()
  const { us, them } = teamLines(events)

  test('shots, shots on goal, shooting %', () => {
    assert.equal(us.goals, 5)
    assert.equal(us.shots, 10)
    assert.equal(us.shotsOnGoal, 7)
    assert.deepEqual(us.shotResults, { goal: 5, saved: 2, missed: 1, blocked: 1, post: 1 })
    rateIs(us.shooting, 5, 10, 'our shooting')
    rateIs(us.onGoal, 7, 10, 'our SOG %')
    assert.equal(them.goals, 3)
    assert.equal(them.shots, 6)
    assert.equal(them.shotsOnGoal, 5)
    assert.deepEqual(them.shotResults, { goal: 3, saved: 2, missed: 1, blocked: 0, post: 0 })
  })

  test('save % is saves over saves plus goals against', () => {
    rateIs(us.saving, 2, 5, 'our save %')
    assert.equal(us.goalsAgainst, 3)
    rateIs(them.saving, 2, 7, 'their save %')
    assert.equal(them.goalsAgainst, 5)
  })

  test('assists: ours only', () => {
    assert.equal(us.assists, 4)
    assert.equal(them.assists, 0)
  })

  test('faceoffs: a lost one is theirs', () => {
    rateIs(us.faceoffs, 6, 10, 'our FO')
    rateIs(them.faceoffs, 4, 10, 'their FO')
  })

  test('ground balls, turnovers and caused turnovers', () => {
    assert.equal(us.groundBalls, 3)
    assert.equal(them.groundBalls, 2)
    assert.equal(us.turnovers, 2)
    assert.equal(them.turnovers, 2)
    // Our caused turnover is their turnover; theirs is ours. Each counted once.
    assert.equal(us.causedTurnovers, 1)
    assert.equal(them.causedTurnovers, 1)
  })

  test('clearing and riding', () => {
    rateIs(us.clears, 2, 3, 'our clears')
    rateIs(them.clears, 2, 3, 'their clears')
    rateIs(us.rides, 1, 3, 'our rides')
    rateIs(them.rides, 1, 3, 'their rides')
  })

  test('penalties, minutes, man-up and man-down', () => {
    assert.equal(us.penalties, 2)
    assert.equal(us.penaltyMinutes, 2)
    assert.equal(them.penalties, 3)
    assert.equal(them.penaltyMinutes, 3.5)
    rateIs(us.manUp, 2, 3, 'our EMO')
    rateIs(us.manDown, 1, 2, 'our man-down')
    rateIs(them.manUp, 1, 2, 'their EMO')
    rateIs(them.manDown, 1, 3, 'their man-down')
  })

  test('period by period, overtime included', () => {
    const p = periodLines(events)
    assert.deepEqual(
      p.map((l) => [l.period, l.goalsFor, l.goalsAgainst, l.shotsFor, l.shotsAgainst]),
      [
        [1, 1, 1, 2, 2],
        [2, 1, 0, 4, 0],
        [3, 1, 1, 1, 2],
        [4, 1, 1, 2, 2],
        [5, 1, 0, 1, 0],
      ],
    )
    assert.equal(p.reduce((n, l) => n + l.goalsFor, 0), us.goals)
    assert.equal(p.reduce((n, l) => n + l.goalsAgainst, 0), them.goals)
  })

  test('player lines', () => {
    const by = new Map(playerLines(events).map((l) => [l.playerId, l]))
    assert.deepEqual([...by.keys()].sort(), [A1, A2, D1, FO, G1, M1].sort())
    const a1 = by.get(A1)
    assert.equal(a1.goals, 3)
    assert.equal(a1.assists, 1)
    assert.equal(a1.points, 4)
    assert.equal(a1.shots, 5)
    assert.equal(a1.shotsOnGoal, 4)
    rateIs(a1.shooting, 3, 5, 'A1 shooting')
    assert.equal(a1.turnovers, 1)
    assert.equal(a1.manUpGoals, 1)
    assert.equal(a1.games, 1)
    const a2 = by.get(A2)
    assert.deepEqual([a2.goals, a2.assists, a2.points, a2.shots, a2.shotsOnGoal, a2.manUpGoals], [1, 2, 3, 3, 2, 1])
    const m1 = by.get(M1)
    assert.deepEqual([m1.goals, m1.assists, m1.shots, m1.turnovers, m1.penalties, m1.penaltyMinutes], [1, 1, 2, 1, 1, 0.5])
    rateIs(m1.faceoffs, 0, 1, 'M1 FO')
    const fo = by.get(FO)
    rateIs(fo.faceoffs, 6, 9, 'FOGO')
    assert.equal(fo.groundBalls, 1)
    const d1 = by.get(D1)
    assert.deepEqual([d1.groundBalls, d1.causedTurnovers, d1.penalties, d1.penaltyMinutes], [2, 1, 1, 1.5])
    // The goalie: only the shots he was noted in the cage for.
    const g1 = by.get(G1)
    assert.equal(g1.saves, 2)
    assert.equal(g1.goalsAgainst, 2)
    rateIs(g1.saving, 2, 4, 'goalie')
    assert.equal(g1.goals, 0)
    // Every goal had a shooter, so the players add up to the team.
    assert.equal([...by.values()].reduce((n, l) => n + l.goals, 0), us.goals)
    assert.equal([...by.values()].reduce((n, l) => n + l.assists, 0), us.assists)
  })

  test('the game summary', () => {
    const g = summarizeGame(game('G', { team_score: 99, opp_score: 0 }), events)
    assert.equal(g.tracked, true)
    assert.equal(g.eventCount, events.length)
    // Tracked goals win over whatever was typed on the schedule.
    assert.equal(g.goalsFor, 5)
    assert.equal(g.goalsAgainst, 3)
    assert.equal(g.outcome, 'W')
    assert.equal(g.periods.length, 5)
  })

  test('describeEvent', () => {
    const players = new Map([
      [A1, { id: A1, name: 'Jack Smith', number: '7', position: 'Attack', is_active: true }],
      [A2, { id: A2, name: 'Owen Price', number: '22', position: 'Attack', is_active: true }],
      [G1, { id: G1, name: 'Sam Cook', number: '0', position: 'Goalie', is_active: true }],
      [D1, { id: D1, name: 'Eli Ward', number: '33', position: 'Defense', is_active: true }],
    ])
    assert.equal(describeEvent(events[2], players), '#7 J. Smith — Goal (A: #22 O. Price)')
    assert.equal(describeEvent(events[15], players), '#7 J. Smith — Goal · Man-up')
    assert.equal(describeEvent(events[5], players), 'Their shot — saved (#0 S. Cook in goal)')
    assert.equal(describeEvent(events[18], players), '#22 O. Price — Shot, pipe')
    assert.equal(describeEvent(events[21], players), 'Their turnover — caused by #33 E. Ward')
    assert.equal(describeEvent(events[31], players), 'Their clear — failed (good ride)')
    assert.equal(describeEvent(events[26], players), '#33 E. Ward — Penalty, 1.5 min')
    assert.equal(describeEvent(ev('G', 1, 'us', 'faceoff', 'won'), players), 'Faceoff won')
    assert.equal(describeEvent(ev('G', 1, 'us', 'shot', 'missed', { player_id: 'nobody' }), players), 'Unknown — Shot, missed')
  })
})

// ── Edge cases ──────────────────────────────────────────────────────────────

describe('edge cases', () => {
  test('an empty log: zeros, and no percentages at all', () => {
    const { us, them } = teamLines([])
    for (const line of [us, them]) {
      assert.equal(line.goals, 0)
      assert.equal(line.shots, 0)
      for (const k of ['shooting', 'onGoal', 'saving', 'faceoffs', 'clears', 'rides', 'manUp', 'manDown']) {
        rateIs(line[k], 0, 0, k)
        assert.equal(fmtPct(line[k]), '—', k)
      }
    }
    assert.deepEqual(periodLines([]).map((p) => p.period), [1, 2, 3, 4])
    assert.deepEqual(playerLines([]), [])
    assert.deepEqual(insights([], []), [])
    const a = aggregate([], [])
    assert.equal(a.games, 0)
    assert.equal(a.perGame.goalsFor, null)
    assert.equal(metricValue('goalDiff', a), null)
    assert.equal(fmtMetric('goalDiff', metricValue('goalDiff', a)), '—')
  })

  test('rate and the formatters', () => {
    assert.deepEqual(rate(0, 0), { made: 0, att: 0, pct: null })
    assert.deepEqual(rate(3, 4), { made: 3, att: 4, pct: 0.75 })
    assert.equal(fmtPct(rate(0, 0)), '—')
    assert.equal(fmtPct(rate(0, 5)), '0%')
    assert.equal(fmtPct(rate(2, 3)), '67%')
    assert.equal(fmtPct(rate(2, 3), 1), '66.7%')
    assert.equal(fmtPct(null), '—')
    assert.equal(fmtPct(NaN), '—')
    assert.equal(fmtPct(Infinity), '—')
    assert.equal(fmtPct(-0.001), '0%')
    assert.equal(fmtPct(-0.0001, 1), '0.0%')
    assert.equal(fmtRate(rate(8, 13)), '8/13')
  })

  test('fmtMetric: margins signed and rounded evenly, no "-0" or "+-"', () => {
    assert.equal(fmtMetric('goalDiff', 3.5), '+3.5')
    assert.equal(fmtMetric('goalDiff', 3), '+3')
    assert.equal(fmtMetric('goalDiff', -2), '-2')
    assert.equal(fmtMetric('goalDiff', 0), '0')
    assert.equal(fmtMetric('goalDiff', -0), '0')
    assert.equal(fmtMetric('goalDiff', -0.04), '0')
    assert.equal(fmtMetric('goalDiff', 0.04), '0')
    assert.equal(fmtMetric('goalDiff', -0.05), '-0.1')
    assert.equal(fmtMetric('goalDiff', 0.05), '+0.1')
    assert.equal(fmtMetric('gbMargin', 2.25), '+2.3')
    assert.equal(fmtMetric('gbMargin', -2.25), '-2.3')
    assert.equal(fmtMetric('gbMargin', 1.96), '+2')
    assert.equal(fmtMetric('toMargin', 10 / 3), '+3.3')
    assert.equal(fmtMetric('toMargin', NaN), '—')
    assert.equal(fmtMetric('toMargin', Infinity), '—')
    assert.equal(fmtMetric('toMargin', null), '—')
    assert.equal(fmtMetric('shooting', rate(1, 3)), '33%')
    assert.equal(fmtMetric('shooting', rate(0, 0)), '—')
    assert.equal(fmtMetric('shooting', 0.5), '50%')
    for (const v of [-10, -1.55, -0.15, -0.049, 0, 0.049, 0.15, 1.55, 10]) {
      const s = fmtMetric('goalDiff', v)
      assert.doesNotMatch(s, /^\+-|^-0$|^-0\.0$|^\+0$|NaN|Infinity/, `${v} → ${s}`)
      if (v !== 0 && s !== '0') assert.equal(fmtMetric('goalDiff', -v), s.startsWith('+') ? `-${s.slice(1)}` : `+${s.slice(1)}`, `symmetric at ${v}`)
    }
  })

  test('an unassisted goal, and assists that cannot count', () => {
    const e = [
      ev('X', 1, 'us', 'shot', 'goal', { player_id: A1 }),
      // A self-assist and an assist on a save come back from the database stripped.
      ev('X', 1, 'us', 'shot', 'goal', { player_id: A1, assist_id: A1 }),
      ev('X', 1, 'us', 'shot', 'saved', { player_id: A1, assist_id: A2 }),
    ]
    assert.equal(e[1].assist_id, null)
    assert.equal(e[2].assist_id, null)
    const { us } = teamLines(e)
    assert.equal(us.goals, 2)
    assert.equal(us.assists, 0)
    const [a1] = playerLines(e)
    assert.deepEqual([a1.goals, a1.assists, a1.points], [2, 0, 2])
    // Even an event built by hand (not read from the database) can't self-assist.
    const raw = { ...e[0], assist_id: A1 }
    assert.equal(teamLines([raw]).us.assists, 0)
    assert.equal(playerLines([raw])[0].assists, 0)
  })

  test('an assist with no shooter noted still counts for the feeder', () => {
    const e = [ev('X', 1, 'us', 'shot', 'goal', { assist_id: A2 })]
    assert.equal(teamLines(e).us.assists, 1)
    const lines = playerLines(e)
    assert.equal(lines.length, 1)
    assert.deepEqual([lines[0].playerId, lines[0].assists, lines[0].goals], [A2, 1, 0])
  })

  test('their shots with and without our goalie noted', () => {
    const e = [
      ev('X', 1, 'them', 'shot', 'saved', { player_id: G1 }),
      ev('X', 1, 'them', 'shot', 'goal', { player_id: G1 }),
      ev('X', 1, 'them', 'shot', 'saved'),
      ev('X', 1, 'them', 'shot', 'goal'),
      ev('X', 1, 'them', 'shot', 'post', { player_id: G1 }),
      ev('X', 1, 'them', 'shot', 'blocked'),
    ]
    const { us, them } = teamLines(e)
    rateIs(us.saving, 2, 4, 'team save % counts every shot on goal')
    assert.equal(them.shots, 6)
    assert.equal(them.shotsOnGoal, 4)
    const [g] = playerLines(e)
    assert.equal(g.playerId, G1)
    rateIs(g.saving, 1, 2, 'goalie only while noted')
    assert.equal(g.shots, 0)
  })

  test('faceoffs all lost', () => {
    const e = [1, 2, 3, 4, 5].map(() => ev('X', 1, 'us', 'faceoff', 'lost', { player_id: FO }))
    const { us, them } = teamLines(e)
    rateIs(us.faceoffs, 0, 5, 'ours')
    assert.equal(fmtPct(us.faceoffs), '0%')
    rateIs(them.faceoffs, 5, 5, 'theirs')
    rateIs(playerLines(e)[0].faceoffs, 0, 5, 'FOGO')
  })

  test('overtime periods', () => {
    assert.equal(periodLabel(1), 'Q1')
    assert.equal(periodLabel(4), 'Q4')
    assert.equal(periodLabel(5), 'OT')
    assert.equal(periodLabel(6), '2OT')
    assert.equal(periodLabel(8), '4OT')
    const e = [ev('X', 6, 'us', 'shot', 'goal', { player_id: A1 }), ev('X', 5, 'them', 'shot', 'saved')]
    assert.deepEqual(periodLines(e).map((p) => periodLabel(p.period)), ['Q1', 'Q2', 'Q3', 'Q4', 'OT', '2OT'])
    // Out-of-range periods are pulled back into 1–8.
    assert.equal(ev('X', 0, 'us', 'ground_ball').period, 1)
    assert.equal(ev('X', 12, 'us', 'ground_ball').period, 8)
    assert.equal(ev('X', 'abc', 'us', 'ground_ball').period, 1)
  })

  test('man-up and man-down: never negative, never over 100%', () => {
    // Their three man-up goals off one of our penalties (a non-releasable foul).
    const e = [
      ev('X', 1, 'us', 'penalty', null, { player_id: D1, penalty_minutes: 3 }),
      ev('X', 1, 'them', 'shot', 'goal', { situation: 'man_down' }),
      ev('X', 1, 'them', 'shot', 'goal', { situation: 'man_down' }),
      ev('X', 1, 'them', 'shot', 'goal', { situation: 'man_down' }),
      // Our man-up goal with no penalty of theirs logged.
      ev('X', 2, 'us', 'shot', 'goal', { player_id: A1, situation: 'man_up' }),
    ]
    const { us, them } = teamLines(e)
    rateIs(us.manDown, 0, 3, 'our man-down')
    rateIs(them.manUp, 3, 3, 'their EMO')
    rateIs(us.manUp, 1, 1, 'our EMO')
    rateIs(them.manDown, 0, 1, 'their man-down')
    // Shorthanded goals are not man-up goals.
    const sh = teamLines([ev('X', 1, 'us', 'shot', 'goal', { situation: 'man_down' }), ev('X', 1, 'them', 'penalty')])
    rateIs(sh.us.manUp, 0, 1, 'shorthanded is not EMO')
    // Situation is ours: their goal while WE are a man up is theirs shorthanded.
    const theirSh = teamLines([ev('X', 1, 'them', 'shot', 'goal', { situation: 'man_up' }), ev('X', 1, 'us', 'penalty')])
    rateIs(theirSh.us.manDown, 1, 1, 'their shorthanded goal is not a man-down goal against')
  })

  test('multiple penalties and minutes', () => {
    const e = [
      ev('X', 1, 'us', 'penalty', null, { player_id: D1, penalty_minutes: 1 }),
      ev('X', 1, 'us', 'penalty', null, { player_id: D1, penalty_minutes: 0.5 }),
      ev('X', 2, 'us', 'penalty', null, { player_id: M1, penalty_minutes: 3 }),
      ev('X', 2, 'us', 'penalty', null, { player_id: M1 }), // time not noted
      ev('X', 3, 'them', 'penalty', null, { penalty_minutes: '1.5' }), // numeric comes back as text sometimes
      ev('X', 3, 'them', 'shot', 'goal', { situation: 'man_down' }),
    ]
    const { us, them } = teamLines(e)
    assert.equal(us.penalties, 4)
    assert.equal(us.penaltyMinutes, 4.5)
    assert.equal(them.penalties, 1)
    assert.equal(them.penaltyMinutes, 1.5)
    rateIs(us.manDown, 3, 4, 'three of four killed')
    const by = new Map(playerLines(e).map((l) => [l.playerId, l]))
    assert.deepEqual([by.get(D1).penalties, by.get(D1).penaltyMinutes], [2, 1.5])
    assert.deepEqual([by.get(M1).penalties, by.get(M1).penaltyMinutes], [2, 3])
  })

  test('a caused turnover: one turnover, one caused turnover, the defender credited', () => {
    const e = [ev('X', 1, 'them', 'turnover', 'caused', { player_id: D1 })]
    const { us, them } = teamLines(e)
    assert.equal(them.turnovers, 1)
    assert.equal(us.turnovers, 0)
    assert.equal(us.causedTurnovers, 1)
    assert.equal(them.causedTurnovers, 0)
    const [d] = playerLines(e)
    assert.deepEqual([d.playerId, d.causedTurnovers, d.turnovers, d.games], [D1, 1, 0, 1])
    // Ours, caused by them: our turnover, their caused turnover.
    const ours = teamLines([ev('X', 1, 'us', 'turnover', 'caused', { player_id: A1 })])
    assert.equal(ours.us.turnovers, 1)
    assert.equal(ours.us.causedTurnovers, 0)
    assert.equal(ours.them.causedTurnovers, 1)
    // Their unforced turnover with one of ours wrongly attached credits nobody.
    const stray = [ev('X', 1, 'them', 'turnover', 'unforced', { player_id: D1 })]
    assert.equal(teamLines(stray).us.causedTurnovers, 0)
    assert.deepEqual(playerLines(stray), [])
  })

  test('ground balls: theirs never land on one of ours', () => {
    const e = [ev('X', 1, 'them', 'ground_ball', null, { player_id: D1 }), ev('X', 1, 'us', 'ground_ball')]
    const { us, them } = teamLines(e)
    assert.equal(us.groundBalls, 1)
    assert.equal(them.groundBalls, 1)
    assert.deepEqual(playerLines(e), [])
  })
})

// ── Reading rows and checking input ─────────────────────────────────────────

describe('readStatEvent and statProblem', () => {
  const ok = {
    id: 'r1',
    game_id: 'g',
    seq: '41',
    period: 2,
    side: 'us',
    kind: 'shot',
    result: 'goal',
    player_id: A1,
    assist_id: A2,
    situation: 'man_up',
    penalty_minutes: null,
    created_at: '2027-03-01T23:00:00+00:00',
  }

  test('a good row reads as itself', () => {
    const e = readStatEvent(ok)
    assert.deepEqual(e, { ...ok, seq: 41 })
  })

  test('rows that cannot be a stat are dropped', () => {
    const bad = [
      { kind: 'goal' }, // unknown kind
      { kind: undefined },
      { side: 'home' },
      { side: null },
      { result: 'won' }, // not a shot result
      { result: 'scored' },
      { result: null }, // a shot must say how it ended
      { kind: 'faceoff', result: 'saved', assist_id: null },
      { kind: 'faceoff', result: null, assist_id: null },
      { kind: 'faceoff', side: 'them', result: 'won', assist_id: null }, // faceoffs are ours only
      { kind: 'clear', result: 'goal', assist_id: null },
      { kind: 'turnover', result: 'forced', assist_id: null },
      { kind: 'ground_ball', result: 'won', assist_id: null }, // no result for a ground ball
      { kind: 'penalty', result: 'goal', assist_id: null },
      { id: null },
      { game_id: '' },
    ]
    for (const over of bad) assert.equal(readStatEvent({ ...ok, ...over }), null, JSON.stringify(over))
  })

  test('rows are cleaned', () => {
    const gb = readStatEvent({ ...ok, kind: 'ground_ball', result: '', assist_id: null, situation: 'shorthanded', penalty_minutes: 2 })
    assert.equal(gb.result, null)
    assert.equal(gb.situation, 'even')
    assert.equal(gb.penalty_minutes, null) // minutes only on a penalty
    const pen = readStatEvent({ ...ok, kind: 'penalty', result: null, assist_id: null, penalty_minutes: '1.0' })
    assert.equal(pen.penalty_minutes, 1)
    assert.equal(readStatEvent({ ...ok, kind: 'penalty', result: null, assist_id: null, penalty_minutes: 'x' }).penalty_minutes, null)
    assert.equal(readStatEvent({ ...ok, kind: 'penalty', result: null, assist_id: null, penalty_minutes: 12 }).penalty_minutes, null)
    assert.equal(readStatEvent({ ...ok, player_id: 7 }).player_id, null)
    assert.equal(readStatEvent({ ...ok, result: 'saved' }).assist_id, null)
    assert.equal(readStatEvent({ ...ok, side: 'them', assist_id: A2, player_id: G1 }).assist_id, null)
    assert.equal(readStatEvent({ ...ok, seq: null }).seq, 0)
  })

  test('statProblem: every rule the server action applies', () => {
    const base = { side: 'us', kind: 'shot', result: 'goal', playerId: A1, assistId: A2, penaltyMinutes: null }
    assert.equal(statProblem(base), null)
    assert.equal(statProblem({ ...base, kind: 'save' }), 'Unknown stat.')
    assert.equal(statProblem({ ...base, side: 'home' }), 'Whose stat is it?')
    assert.equal(statProblem({ ...base, result: null }), 'Pick how it ended.')
    assert.equal(statProblem({ ...base, result: 'won' }), 'Pick how it ended.')
    assert.equal(statProblem({ ...base, kind: 'ground_ball', assistId: null }), 'That stat has no result.')
    assert.equal(statProblem({ ...base, kind: 'faceoff', side: 'them', result: 'won', assistId: null }), 'Faceoffs are logged from our side.')
    assert.equal(statProblem({ ...base, result: 'saved' }), 'Only our goals have assists.')
    assert.equal(statProblem({ ...base, side: 'them' }), 'Only our goals have assists.')
    assert.equal(statProblem({ ...base, assistId: A1 }), 'A player can’t assist his own goal.')
    const pen = { side: 'us', kind: 'penalty', result: null, playerId: D1, assistId: null }
    for (const m of [null, undefined, 0, 0.5, 1, 1.5, 2, 3, 10]) assert.equal(statProblem({ ...pen, penaltyMinutes: m }), null, String(m))
    for (const m of [-1, 0.25, 11, NaN]) assert.match(statProblem({ ...pen, penaltyMinutes: m }) ?? '', /half minutes/, String(m))
    // Every kind accepts exactly its own results.
    for (const kind of STAT_KINDS) {
      const side = 'us'
      for (const r of KIND_RESULTS[kind]) assert.equal(statProblem({ side, kind, result: r, playerId: null, assistId: null }), null, `${kind} ${r}`)
      if (!KIND_RESULTS[kind].length) assert.equal(statProblem({ side, kind, result: null, playerId: null, assistId: null }), null, kind)
    }
  })
})

// ── Games, records, filters ─────────────────────────────────────────────────

describe('games and seasons', () => {
  const goal = (g, side) => ev(g, 1, side, 'shot', 'goal', side === 'us' ? { player_id: A1 } : {})
  const shots = (g, us, them) => [...Array(us)].map(() => goal(g, 'us')).concat([...Array(them)].map(() => goal(g, 'them')))

  test('summarizeGame: an outcome only once the game is final', () => {
    const e = shots('A', 3, 2)
    assert.equal(summarizeGame(game('A'), e).outcome, 'W')
    assert.equal(summarizeGame(game('A', { status: 'scheduled' }), e).outcome, null)
    assert.equal(summarizeGame(game('A', { status: 'postponed' }), e).outcome, null)
    assert.equal(summarizeGame(game('A', { status: 'canceled' }), e).outcome, null)
    assert.equal(summarizeGame(game('A'), shots('A', 2, 4)).outcome, 'L')
    assert.equal(summarizeGame(game('A'), shots('A', 4, 4)).outcome, 'T')
    // Still shows the running score while being tracked.
    const live = summarizeGame(game('A', { status: 'scheduled' }), e)
    assert.deepEqual([live.goalsFor, live.goalsAgainst], [3, 2])
    // Events from other games don't leak in.
    assert.equal(summarizeGame(game('B'), e).tracked, false)
  })

  test('summarizeGame: an untracked game uses the typed score', () => {
    const g = summarizeGame(game('U', { team_score: 12, opp_score: 7 }), [])
    assert.equal(g.tracked, false)
    assert.deepEqual([g.goalsFor, g.goalsAgainst, g.outcome], [12, 7, 'W'])
    const none = summarizeGame(game('U'), [])
    assert.deepEqual([none.goalsFor, none.goalsAgainst, none.outcome], [null, null, null])
    const future = summarizeGame(game('U', { status: 'scheduled', team_score: 3, opp_score: 1 }), [])
    assert.equal(future.outcome, null)
  })

  test('recordOf', () => {
    const mk = (o) => ({ outcome: o })
    assert.deepEqual(recordOf([mk('W'), mk('W'), mk('L'), mk(null)]), { w: 2, l: 1, t: 0, label: '2-1' })
    assert.deepEqual(recordOf([mk('W'), mk('T'), mk('L')]), { w: 1, l: 1, t: 1, label: '1-1-1' })
    assert.equal(recordOf([]).label, '0-0')
  })

  // Six games, deliberately out of date order.
  const defs = [
    ['g3', '2027-03-10T23:00:00+00:00', 'away', false, 'final', 2, 5],
    ['g1', '2027-03-01T23:00:00+00:00', 'home', true, 'final', 6, 3],
    ['g6', '2027-03-25T23:00:00+00:00', 'home', true, 'scheduled', 1, 0], // being tracked
    ['g2', '2027-03-05T23:00:00+00:00', 'neutral', true, 'final', 4, 4],
    ['g5', '2027-03-20T23:00:00+00:00', 'away', true, 'final', 9, 2],
    ['g4', '2027-03-15T23:00:00+00:00', 'home', false, 'final', 7, 8],
  ]
  const events = defs.flatMap(([id, , , , , u, t]) => shots(id, u, t))
  const untracked = game('g0', { game_date: '2027-02-26T23:00:00+00:00', team_score: 10, opp_score: 1, home_away: 'away', is_conference: true })
  const summaries = [
    ...defs.map(([id, date, ha, conf, status]) => summarizeGame(game(id, { game_date: date, home_away: ha, is_conference: conf, status }), events)),
    summarizeGame(untracked, events),
  ]
  const ids = (gs) => gs.map((g) => g.game.id)

  test('filterGames: tracked games only, oldest first, each filter', () => {
    assert.deepEqual(ids(filterGames(summaries, 'all')), ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'])
    assert.deepEqual(ids(filterGames(summaries, 'conference')), ['g1', 'g2', 'g5', 'g6'])
    assert.deepEqual(ids(filterGames(summaries, 'nonconference')), ['g3', 'g4'])
    assert.deepEqual(ids(filterGames(summaries, 'home')), ['g1', 'g4', 'g6'])
    assert.deepEqual(ids(filterGames(summaries, 'away')), ['g2', 'g3', 'g5'])
    assert.deepEqual(ids(filterGames(summaries, 'wins')), ['g1', 'g5'])
    assert.deepEqual(ids(filterGames(summaries, 'losses')), ['g3', 'g4'])
    assert.deepEqual(ids(filterGames(summaries, 'last5')), ['g2', 'g3', 'g4', 'g5', 'g6'])
    for (const f of GAME_FILTERS) {
      const out = filterGames(summaries, f.key)
      assert.ok(out.every((g) => g.tracked), f.key)
      assert.deepEqual(ids(out), ids([...out].sort((a, b) => a.game.game_date.localeCompare(b.game.game_date))), f.key)
    }
    // Home and away between them are every tracked game.
    assert.equal(filterGames(summaries, 'home').length + filterGames(summaries, 'away').length, filterGames(summaries, 'all').length)
    // The input isn't reordered.
    assert.equal(summaries[0].game.id, 'g3')
  })

  test('aggregate: totals, record and per-game averages', () => {
    const all = filterGames(summaries, 'all')
    const a = aggregate(all, events)
    assert.equal(a.games, 6)
    assert.equal(a.lines.us.goals, 2 + 6 + 1 + 4 + 9 + 7)
    assert.equal(a.lines.them.goals, 5 + 3 + 0 + 4 + 2 + 8)
    assert.equal(a.record.label, '2-2-1')
    close(a.perGame.goalsFor, 29 / 6)
    close(a.perGame.goalsAgainst, 22 / 6)
    close(a.perGame.shots, 29 / 6)
    close(metricNumber('goalDiff', a), 7 / 6)
    assert.equal(fmtMetric('goalDiff', metricValue('goalDiff', a)), '+1.2')
    // An untracked game counts in the record but not in any average.
    const withUntracked = aggregate(summaries, events)
    assert.equal(withUntracked.games, 6)
    close(withUntracked.perGame.goalsFor, 29 / 6)
    assert.equal(withUntracked.record.label, '3-2-1')
    // Only the games asked about.
    const wins = aggregate(filterGames(summaries, 'wins'), events)
    assert.equal(wins.lines.us.goals, 15)
    close(wins.perGame.goalsFor, 7.5)
    assert.equal(wins.players[0].games, 2)
  })

  test('playerLines: games played counts distinct games', () => {
    const e = [
      ev('P1', 1, 'us', 'shot', 'goal', { player_id: A1 }),
      ev('P1', 2, 'us', 'shot', 'missed', { player_id: A1 }),
      ev('P1', 2, 'us', 'ground_ball', null, { player_id: A1 }),
      ev('P2', 1, 'us', 'turnover', 'unforced', { player_id: A1 }),
      ev('P3', 1, 'us', 'shot', 'goal', { player_id: M1, assist_id: A1 }),
    ]
    const by = new Map(playerLines(e).map((l) => [l.playerId, l]))
    assert.equal(by.get(A1).games, 3)
    assert.equal(by.get(M1).games, 1)
    assert.equal(by.get(A1).points, 2)
  })

  test('metricSeries: oldest first, untracked games a gap', () => {
    const s = metricSeries('goalDiff', summaries)
    assert.deepEqual(s.map((p) => p.gameId), ['g0', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6'])
    assert.deepEqual(s.map((p) => p.value), [null, 3, 0, -3, -1, 7, 1])
    assert.equal(s[1].label, 'Opp g1')
    const sh = metricSeries('shooting', summaries)
    assert.equal(sh[0].value, null)
    assert.equal(sh[1].value, 1)
  })

  test('metricValue covers every metric', () => {
    const a = aggregate(filterGames(summaries, 'all'), events)
    for (const m of METRICS) {
      const v = metricValue(m.key, a)
      if (m.kind === 'rate') assert.ok(v && typeof v === 'object' && 'att' in v, m.key)
      else assert.equal(typeof v, 'number', m.key)
      assert.doesNotMatch(fmtMetric(m.key, v), /NaN|Infinity|undefined/, m.key)
    }
  })

  test('seasonOf reads the year on Eastern time', () => {
    assert.equal(seasonOf({ game_date: '2027-03-01T23:00:00+00:00' }), 2027)
    assert.equal(seasonOf({ game_date: '2027-01-01T03:00:00+00:00' }), 2026) // 10pm Dec 31 in Cary
    assert.equal(seasonOf({ game_date: '' }), null)
  })
})

// ── Players ─────────────────────────────────────────────────────────────────

describe('players', () => {
  const p = (id, number, name = id) => ({ id, name, number, position: null, is_active: true })

  test('byJersey: numbers as numbers, then the rest by name', () => {
    const list = [
      p('x', 'A1', 'Zed'),
      p('a', '12'),
      p('b', '7', 'Bo'),
      p('c', '07', 'Cy'),
      p('d', null, 'Al'),
      p('e', '', 'Abe'),
      p('f', '2'),
      p('g', '00'),
      p('h', '0'),
      p('i', ' 3 '),
      p('j', '0x10', 'Hex'),
    ]
    const sorted = [...list].sort(byJersey).map((x) => x.number)
    // No usable number ("", none, "0x10", "A1"): by name — Abe, Al, Hex, Zed.
    assert.deepEqual(sorted, ['00', '0', '2', ' 3 ', '07', '7', '12', '', null, '0x10', 'A1'])
    // Same order whatever order they came in.
    assert.deepEqual([...list].reverse().sort(byJersey).map((x) => x.id), [...list].sort(byJersey).map((x) => x.id))
  })

  test('playerLabel', () => {
    assert.equal(playerLabel(p('a', '12', 'Jack Smith')), '#12 Jack Smith')
    assert.equal(playerLabel(p('a', '12', 'Jack Smith'), true), '#12 J. Smith')
    assert.equal(playerLabel(p('a', null, 'Jack van der Berg'), true), 'J. van der Berg')
    assert.equal(playerLabel(p('a', '12', 'Cher'), true), '#12 Cher')
    assert.equal(playerLabel(p('a', '12', '  ')), '#12')
    assert.equal(playerLabel(p('a', null, '')), 'Unknown')
    assert.equal(playerLabel(null), 'Unknown')
    assert.equal(playerLabel(undefined), 'Unknown')
  })
})

// ── Insights ────────────────────────────────────────────────────────────────

// What should never reach a coach: broken numbers, a sign on nothing ("-0",
// "+0", "-0.0", "-0%"), a doubled sign, or the "—" that stands for no number.
const BAD_TEXT = /NaN|Infinity|undefined|null|\+-|-\+|--|(^|[^\d.])[-+]0(\.0+)?(?![.\d])|—/

describe('insights', () => {
  const sane = (list) => {
    for (const i of list) {
      assert.ok(['good', 'bad', 'neutral'].includes(i.tone), i.text)
      assert.doesNotMatch(i.text, BAD_TEXT, i.text)
      assert.match(i.text, /\.$/, i.text)
      // Any "made/att" quoted has at least the 5 attempts it takes to be talked about.
      for (const [, made, att] of i.text.matchAll(/\((\d+)\/(\d+)\)/g)) {
        assert.ok(Number(att) >= 5, i.text)
        assert.ok(Number(made) <= Number(att), i.text)
      }
    }
  }

  test('a tiny sample says nothing about rates', () => {
    // Five games, one clear, one faceoff and two shots each: every rate under 5 per game.
    const gs = []
    const e = []
    for (let i = 0; i < 2; i++) {
      const id = `t${i}`
      gs.push(game(id, { game_date: `2027-03-0${i + 1}T23:00:00+00:00` }))
      e.push(ev(id, 1, 'us', 'clear', 'fail'), ev(id, 1, 'us', 'faceoff', 'lost'), ev(id, 1, 'us', 'shot', 'missed'), ev(id, 1, 'us', 'shot', 'missed'))
    }
    const list = insights(gs.map((g) => summarizeGame(g, e)), e)
    sane(list)
    assert.deepEqual(list, [])
  })

  test('wins vs losses needs 5 attempts on both sides', () => {
    const gs = []
    const e = []
    // Two wins with one clear attempt each (100%), two losses with plenty.
    const make = (id, date, win, clears) => {
      gs.push(game(id, { game_date: date }))
      e.push(ev(id, 1, 'us', 'shot', 'goal', { player_id: A1 }))
      if (!win) e.push(ev(id, 1, 'them', 'shot', 'goal'), ev(id, 1, 'them', 'shot', 'goal'))
      for (let i = 0; i < clears; i++) e.push(ev(id, 1, 'us', 'clear', i % 2 ? 'success' : 'fail'))
    }
    make('w1', '2027-03-01T23:00:00+00:00', true, 0)
    make('w2', '2027-03-02T23:00:00+00:00', true, 1)
    make('l1', '2027-03-03T23:00:00+00:00', false, 6)
    make('l2', '2027-03-04T23:00:00+00:00', false, 6)
    const list = insights(gs.map((g) => summarizeGame(g, e)), e)
    sane(list)
    assert.ok(!list.some((i) => /wins and losses: Clearing/.test(i.text)), JSON.stringify(list))
  })

  test('trend says "down" when it went down, and "up" when it went up', () => {
    const season = (lateGoals) => {
      const gs = []
      const e = []
      for (let i = 0; i < 6; i++) {
        const id = `s${i}`
        gs.push(game(id, { game_date: `2027-03-1${i}T23:00:00+00:00` }))
        const goals = i >= 3 ? lateGoals : 4
        for (let k = 0; k < 10; k++) e.push(ev(id, 1, 'us', 'shot', k < goals ? 'goal' : 'missed', { player_id: A1 }))
      }
      return insights(gs.map((g) => summarizeGame(g, e)), e)
    }
    const down = season(1)
    sane(down)
    const d = down.find((i) => /^Shooting % over the last 3 games/.test(i.text))
    assert.ok(d, JSON.stringify(down))
    assert.equal(d.text, 'Shooting % over the last 3 games is 10% (3/30), down from 40% in the 3 games before.')
    assert.equal(d.tone, 'bad')
    const up = season(7)
    const u = up.find((i) => /^Shooting % over the last 3 games/.test(i.text))
    assert.equal(u.text, 'Shooting % over the last 3 games is 70% (21/30), up from 40% in the 3 games before.')
    assert.equal(u.tone, 'good')
    // No change worth saying.
    assert.ok(!season(4).some((i) => /last 3 games/.test(i.text)))
  })

  test('the weakest quarter needs a real hole, and untracked games are left out', () => {
    const gs = []
    const e = []
    for (let i = 0; i < 3; i++) {
      const id = `q${i}`
      gs.push(game(id, { game_date: `2027-03-0${i + 1}T23:00:00+00:00` }))
      e.push(ev(id, 3, 'them', 'shot', 'goal'), ev(id, 1, 'us', 'shot', 'goal', { player_id: A1 }))
    }
    gs.push(game('untracked', { team_score: 10, opp_score: 0 }))
    const list = insights(gs.map((g) => summarizeGame(g, e)), e)
    sane(list)
    const q = list.find((i) => /weakest quarter/.test(i.text))
    assert.equal(q.text, 'Q3 is our weakest quarter: outscored 3–0 in it over 3 games.')
    // One goal down in a quarter over three games is noise, not a weakness.
    const small = e.filter((x, i) => !(x.side === 'them' && i > 2))
    assert.ok(!insights(gs.map((g) => summarizeGame(g, small)), small).some((i) => /weakest/.test(i.text)))
  })
})

// ── A whole season ──────────────────────────────────────────────────────────

describe('a made-up season (scripts/stats-fixture.mjs)', () => {
  const SEEDS = [2027, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  const seasons = SEEDS.map((seed) => ({ seed, ...makeSeason({ seed }) }))

  test('it is the same season every time for a seed, and a different one for another', () => {
    const { seed: _seed, ...first } = seasons[0]
    assert.deepEqual(makeSeason({ seed: 2027 }), first)
    assert.notDeepEqual(makeSeason({ seed: 2028 }).events, seasons[0].events)
  })

  test('twelve final games, each tracked, in date order', () => {
    for (const s of seasons) {
      assert.equal(s.games.length, 12)
      assert.ok(s.games.every((g) => g.status === 'final' && g.level === 'varsity'))
      const dates = s.games.map((g) => g.game_date)
      assert.deepEqual(dates, [...dates].sort())
      assert.equal(new Set(s.games.map((g) => g.id)).size, 12)
      for (const g of s.games) assert.ok(s.events.some((e) => e.game_id === g.id))
    }
  })

  test('every event passes the server’s rules and reads back unchanged', () => {
    for (const s of seasons) {
      for (const e of s.events) {
        assert.equal(statProblem(inputOf(e)), null, JSON.stringify(e))
        assert.deepEqual(readStatEvent({ ...e }), e)
        // Players only where the table on StatEvent has one.
        if ((e.kind === 'ground_ball' && e.side === 'them') || e.kind === 'clear' || (e.kind === 'penalty' && e.side === 'them'))
          assert.equal(e.player_id, null, JSON.stringify(e))
        if (e.kind === 'turnover' && e.side === 'them' && e.result === 'unforced') assert.equal(e.player_id, null)
        if (e.kind === 'penalty') assert.ok(e.penalty_minutes != null)
      }
    }
  })

  test('every game: the numbers agree with each other', () => {
    let overtime = 0
    for (const s of seasons) {
      const roster = new Set(s.players.map((p) => p.id))
      for (const g of s.games) {
        const mine = s.events.filter((e) => e.game_id === g.id)
        const sum = summarizeGame(g, mine)
        const { us, them } = sum.lines
        const where = `seed ${s.seed} ${g.opponent}`
        // The schedule score is the tracked score, and lacrosse has no ties after OT here.
        assert.deepEqual([sum.goalsFor, sum.goalsAgainst], [g.team_score, g.opp_score], where)
        assert.notEqual(sum.outcome, 'T', where)
        assert.equal(sum.outcome, g.team_score > g.opp_score ? 'W' : 'L', where)
        for (const [l, o] of [[us, them], [them, us]]) {
          assert.ok(l.goals <= l.shotsOnGoal && l.shotsOnGoal <= l.shots, where)
          assert.equal(l.shots, Object.values(l.shotResults).reduce((a, b) => a + b, 0), where)
          assert.equal(l.goalsAgainst, o.goals, where)
          assert.equal(l.saving.att, o.shotsOnGoal, where)
          assert.equal(l.saving.made + l.goalsAgainst, l.saving.att, where)
          assert.equal(l.rides.att, o.clears.att, where)
          assert.equal(l.rides.made, o.clears.att - o.clears.made, where)
          assert.ok(l.causedTurnovers <= o.turnovers, where)
          assert.equal(l.manUp.att, o.manDown.att, where)
          assert.equal(l.manUp.made + o.manDown.made, l.manUp.att, where)
          assert.ok(l.manUp.att >= o.penalties, where)
          assert.ok(l.manDown.made >= 0 && l.manDown.made <= l.manDown.att, where)
          for (const r of [l.shooting, l.onGoal, l.saving, l.faceoffs, l.clears, l.rides, l.manUp, l.manDown])
            assert.ok(r.pct == null || (r.pct >= 0 && r.pct <= 1 && r.made <= r.att), where)
        }
        assert.equal(us.faceoffs.att, them.faceoffs.att, where)
        assert.equal(us.faceoffs.made + them.faceoffs.made, us.faceoffs.att, where)
        assert.ok(us.assists <= us.goals, where)
        // Faceoffs: one to start each period, one after each goal that left time on the clock.
        const periods = sum.periods.length
        assert.ok(us.faceoffs.att >= periods && us.faceoffs.att <= periods + us.goals + them.goals, where)
        // Periods add up.
        assert.equal(sum.periods.reduce((n, p) => n + p.goalsFor, 0), us.goals, where)
        assert.equal(sum.periods.reduce((n, p) => n + p.goalsAgainst, 0), them.goals, where)
        assert.equal(sum.periods.reduce((n, p) => n + p.shotsFor, 0), us.shots, where)
        assert.equal(sum.periods.reduce((n, p) => n + p.shotsAgainst, 0), them.shots, where)
        if (periods > 4) {
          overtime++
          // Sudden victory: the last period has exactly one goal.
          const last = sum.periods[sum.periods.length - 1]
          assert.equal(last.goalsFor + last.goalsAgainst, 1, where)
        }
        // Players add up to the team (or fall short only by goals with no shooter noted).
        const players = playerLines(mine)
        assert.ok(players.every((p) => roster.has(p.playerId) && p.games === 1), where)
        const total = (k) => players.reduce((n, p) => n + p[k], 0)
        const noShooter = mine.filter((e) => e.kind === 'shot' && e.side === 'us' && e.result === 'goal' && !e.player_id).length
        assert.equal(total('goals') + noShooter, us.goals, where)
        assert.equal(total('assists'), us.assists, where)
        assert.ok(total('shots') <= us.shots, where)
        assert.ok(total('groundBalls') <= us.groundBalls, where)
        assert.equal(total('turnovers'), us.turnovers, where)
        assert.ok(total('causedTurnovers') <= us.causedTurnovers, where)
        assert.equal(total('penalties'), us.penalties, where)
        assert.equal(total('saves') + total('goalsAgainst') <= us.saving.att, true, where)
        assert.equal(players.reduce((n, p) => n + p.faceoffs.att, 0), us.faceoffs.att, where)
        assert.equal(total('manUpGoals'), us.manUp.made - mine.filter((e) => e.kind === 'shot' && e.side === 'us' && e.result === 'goal' && e.situation === 'man_up' && !e.player_id).length, where)
        // Believable for a high school varsity game.
        assert.ok(us.shots >= 8 && us.shots <= 60 && them.shots >= 8 && them.shots <= 60, `${where} shots ${us.shots}/${them.shots}`)
        assert.ok(us.goals + them.goals <= 35, where)
      }
    }
    assert.ok(overtime > 0, 'some season should go to overtime')
  })

  test('the season adds up from its games', () => {
    for (const s of seasons) {
      const sums = s.games.map((g) => summarizeGame(g, s.events))
      const a = aggregate(filterGames(sums, 'all'), s.events)
      assert.equal(a.games, 12)
      for (const k of ['goals', 'shots', 'shotsOnGoal', 'groundBalls', 'turnovers', 'causedTurnovers', 'penalties', 'assists']) {
        assert.equal(a.lines.us[k], sums.reduce((n, g) => n + g.lines.us[k], 0), `seed ${s.seed} us.${k}`)
        assert.equal(a.lines.them[k], sums.reduce((n, g) => n + g.lines.them[k], 0), `seed ${s.seed} them.${k}`)
      }
      close(a.lines.us.penaltyMinutes, sums.reduce((n, g) => n + g.lines.us.penaltyMinutes, 0))
      for (const k of ['faceoffs', 'clears', 'rides', 'saving', 'manUp', 'manDown']) {
        assert.equal(a.lines.us[k].att, sums.reduce((n, g) => n + g.lines.us[k].att, 0), `seed ${s.seed} ${k}.att`)
        assert.equal(a.lines.us[k].made, sums.reduce((n, g) => n + g.lines.us[k].made, 0), `seed ${s.seed} ${k}.made`)
      }
      const rec = recordOf(sums)
      assert.equal(a.record.label, rec.label)
      assert.equal(rec.w + rec.l, 12)
      close(a.perGame.goalsFor, a.lines.us.goals / 12)
      // Season player lines: games played never more than the games.
      for (const p of a.players) assert.ok(p.games >= 1 && p.games <= 12)
      // The filters split the season the way they say.
      const n = (f) => filterGames(sums, f).length
      assert.equal(n('conference') + n('nonconference'), 12)
      assert.equal(n('home') + n('away'), 12)
      assert.equal(n('wins') + n('losses'), 12)
      assert.equal(n('last5'), 5)
      // The trend line is in date order and has a point per game.
      const series = metricSeries('shooting', sums)
      assert.deepEqual(series.map((x) => x.gameId), s.games.map((g) => g.id))
      assert.ok(series.every((x) => x.value != null && x.value >= 0 && x.value <= 1))
    }
  })

  test('without unknown shooters, player goals are exactly the team goals', () => {
    const s = makeSeason({ seed: 99, unknownShooters: false })
    const sums = s.games.map((g) => summarizeGame(g, s.events))
    const a = aggregate(sums, s.events)
    assert.equal(a.players.reduce((n, p) => n + p.goals, 0), a.lines.us.goals)
    assert.equal(a.players.reduce((n, p) => n + p.points, 0), a.lines.us.goals + a.lines.us.assists)
  })

  test('insights on every season: no throw, sane sentences, nothing under the floor', () => {
    let said = 0
    let comparisons = 0
    for (const s of seasons) {
      const sums = s.games.map((g) => summarizeGame(g, s.events))
      for (const f of GAME_FILTERS) {
        const gs = filterGames(sums, f.key)
        const list = insights(gs, s.events)
        said += list.length
        for (const i of list) {
          assert.ok(['good', 'bad', 'neutral'].includes(i.tone), i.text)
          assert.doesNotMatch(i.text, BAD_TEXT, i.text)
          for (const [, made, att] of i.text.matchAll(/\((\d+)\/(\d+)\)/g)) assert.ok(Number(att) >= 5 && Number(made) <= Number(att), i.text)
          // "above"/"below" agrees with the numbers quoted.
          const b = /is (\d+)% \(\d+\/\d+\), (above|below) the (\d+)% we aim for/.exec(i.text)
          if (b) {
            assert.equal(b[2] === 'above', Number(b[1]) > Number(b[3]), i.text)
            assert.equal(i.tone, b[2] === 'above' ? 'good' : 'bad', i.text)
          }
          const t = /is (\d+)% \(\d+\/\d+\), (up|down) from (\d+)%/.exec(i.text)
          if (t) {
            assert.equal(t[2] === 'up', Number(t[1]) > Number(t[3]), i.text)
            assert.equal(i.tone, t[2] === 'up' ? 'good' : 'bad', i.text)
          }
          if (/wins and losses/.test(i.text)) comparisons++
          if (/weakest quarter/.test(i.text)) assert.match(i.text, /^Q[1-4] is our weakest quarter: outscored (\d+)–(\d+) in it over \d+ games\.$/, i.text)
        }
      }
    }
    assert.ok(said > 0)
    assert.ok(comparisons > 0)
  })
})

describe('choosing a season', () => {
  const g26 = game('s26', { game_date: '2026-04-10T22:00:00+00:00' })
  const g27 = game('s27', { game_date: '2027-04-10T22:00:00+00:00' })
  const g28 = game('s28', { game_date: '2028-03-01T22:00:00+00:00', status: 'scheduled' })
  const evs = [ev('s26', 1, 'us', 'ground_ball'), ev('s27', 1, 'us', 'ground_ball')]
  const sums = [g26, g27, g28].map((g) => summarizeGame(g, evs))

  test('seasons on offer are the tracked ones, newest first', () => {
    assert.deepEqual(statSeasons(sums), [2027, 2026])
  })
  test('before anything is tracked, every season with a game is on offer', () => {
    assert.deepEqual(statSeasons([g26, g28].map((g) => summarizeGame(g, []))), [2028, 2026])
  })
  test('pickSeason takes a season on offer, else the newest', () => {
    assert.equal(pickSeason(sums, '2026'), 2026)
    assert.equal(pickSeason(sums, ['2026']), 2026)
    assert.equal(pickSeason(sums, '2028'), 2027) // nothing tracked in 2028
    assert.equal(pickSeason(sums, 'junk'), 2027)
    assert.equal(pickSeason(sums, undefined), 2027)
    assert.equal(pickSeason([], undefined), null)
  })
  test('gamesInSeason keeps one season, or everything for null', () => {
    assert.deepEqual(gamesInSeason(sums, 2026).map((g) => g.game.id), ['s26'])
    assert.equal(gamesInSeason(sums, null).length, 3)
  })
})
