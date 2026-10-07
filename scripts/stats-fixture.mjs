// A made-up but believable season of tracked games, for scripts/test-stats.mjs.
//
// Plays each game out possession by possession — faceoffs at the start of
// every quarter and after every goal, clears and rides, shots that are saved,
// missed, blocked or hit the pipe, ground balls, turnovers (some caused),
// penalties with man-up and man-down play, and sudden-victory overtime — and
// logs it exactly as the tracker would. Every event it writes passes the same
// rules the server action enforces (statProblem in src/lib/stats.ts), so the
// numbers the tests check are numbers the real app could produce.
//
// Seeded: the same seed always plays the same season.

/** Mulberry32: small, fast, and the same in every Node. */
export function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const OPPONENTS = [
  'Panther Creek', 'Cary', 'Apex', 'Middle Creek', 'Holly Springs', 'Green Level',
  'Apex Friendship', 'Athens Drive', 'Leesville Road', 'Cardinal Gibbons', 'Broughton', 'Wakefield',
  'Heritage', 'Millbrook', 'Sanderson', 'Enloe',
]

// Who's on the roster, by what they do. Numbers are text, as in the players table.
const ROSTER = [
  ['Attack', ['1', '3', '7', '11', '22']],
  ['Midfield', ['2', '5', '8', '10', '14', '17', '19', '24']],
  ['FOGO', ['9', '27']],
  ['LSM', ['35', '41']],
  ['Defense', ['12', '30', '33', '44', '45']],
  ['Goalie', ['0', '31']],
]
const FIRST = ['Jack', 'Liam', 'Owen', 'Cole', 'Luke', 'Ryan', 'Ben', 'Will', 'Sam', 'Nate', 'Max', 'Eli', 'Gavin', 'Tyler', 'Drew', 'Reid']
const LAST = ['Smith', 'Carter', 'Hughes', 'Price', 'Bennett', 'Ward', 'Foster', 'Hayes', 'Reed', 'Cook', 'Bell', 'Murphy', 'Brooks', 'Gray', 'Kelly', 'Sutton']

const PENALTY_TIMES = [0.5, 0.5, 1, 1, 1, 1, 1.5, 2, 3]
const QUARTER_SECONDS = 12 * 60
const OT_SECONDS = 4 * 60
const LAST_PERIOD = 8

/**
 * A season: `games` tracked, final varsity games, every event for both sides,
 * and the roster. Options:
 *   seed              which season (default 2027)
 *   games             how many (default 12)
 *   unknownShooters   now and then log one of our shots with no shooter, as
 *                     a coach does when he missed who it was (default true)
 *   start             the first game day, YYYY-MM-DD (default 2027-02-23)
 */
export function makeSeason({ seed = 2027, games: count = 12, unknownShooters = true, start = '2027-02-23' } = {}) {
  const rand = seeded(seed)
  const pick = (xs) => xs[Math.floor(rand() * xs.length)]
  const chance = (p) => rand() < p
  const hex = (n) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join('')
  const uuid = () => `${hex(8)}-${hex(4)}-4${hex(3)}-${pick(['8', '9', 'a', 'b'])}${hex(3)}-${hex(12)}`

  // ── The roster ──
  const players = []
  const by = {}
  for (const [position, numbers] of ROSTER) {
    by[position] = []
    for (const number of numbers) {
      const p = { id: uuid(), name: `${pick(FIRST)} ${pick(LAST)}`, number, position, is_active: true }
      players.push(p)
      by[position].push(p)
    }
  }
  // Who shoots, weighted: attack most, then the middies, the odd pole goal.
  const shooters = [
    ...by.Attack.flatMap((p, i) => Array(i < 3 ? 6 : 2).fill(p)),
    ...by.Midfield.flatMap((p, i) => Array(i < 4 ? 3 : 1).fill(p)),
    ...by.LSM,
    by.FOGO[0],
  ]
  const feeders = [...by.Attack, ...by.Attack, ...by.Midfield]
  const defenders = [...by.Defense, ...by.LSM, ...by.Midfield.slice(4)]
  const anyField = [...by.Attack, ...by.Midfield, ...by.Defense, ...by.LSM, ...by.FOGO]

  // ── The schedule ──
  const opponents = [...OPPONENTS].sort(() => rand() - 0.5).slice(0, count)
  const [y, m, d] = start.split('-').map(Number)
  const gamesOut = []
  const events = []
  let seq = 1000
  let clock = Date.UTC(y, m - 1, d, 23, 0) // 6pm Eastern in winter, 7pm once DST starts

  for (let gi = 0; gi < count; gi++) {
    const gameId = uuid()
    const day = new Date(clock)
    clock += (chance(0.5) ? 3 : 4) * 86400000
    const game = {
      id: gameId,
      game_date: day.toISOString().replace('.000Z', '+00:00'),
      opponent: opponents[gi],
      home_away: gi === 5 ? 'neutral' : gi % 2 === 0 ? 'home' : 'away',
      level: 'varsity',
      is_conference: gi >= 3 && gi !== 7,
      status: 'final',
      team_score: 0,
      opp_score: 0,
    }

    // How this matchup goes: faceoff edge, how well each side shoots, clears and holds the ball.
    const edge = rand() * 0.5 - 0.22
    const side = {
      us: { finish: 0.3 + edge * 0.4, clear: 0.84 + edge * 0.15, keep: 0.72 + edge * 0.2 },
      them: { finish: 0.3 - edge * 0.4, clear: 0.84 - edge * 0.15, keep: 0.72 - edge * 0.2 },
    }
    const foWin = 0.5 + edge * 0.6
    const fogo = chance(0.85) ? by.FOGO[0] : by.FOGO[1]
    let goalie = by.Goalie[0]
    const score = { us: 0, them: 0 }
    const other = (s) => (s === 'us' ? 'them' : 'us')

    // Man-up: who has the extra man, for how many more possessions.
    let up = null
    let upLeft = 0
    const situation = () => (up === 'us' ? 'man_up' : up === 'them' ? 'man_down' : 'even')

    let period = 1
    const log = (e) => {
      events.push({
        id: uuid(),
        game_id: gameId,
        seq: seq++,
        period,
        side: e.side,
        kind: e.kind,
        result: e.result ?? null,
        player_id: e.player_id ?? null,
        assist_id: e.assist_id ?? null,
        situation: e.situation ?? 'even',
        penalty_minutes: e.penalty_minutes ?? null,
        created_at: new Date(Date.parse(game.game_date) + (seq % 100000) * 15000).toISOString(),
      })
    }

    const faceoff = () => {
      const won = chance(foWin)
      log({ side: 'us', kind: 'faceoff', result: won ? 'won' : 'lost', player_id: (chance(0.9) ? fogo : pick(by.Midfield)).id })
      if (chance(0.7)) {
        if (won) log({ side: 'us', kind: 'ground_ball', player_id: (chance(0.6) ? fogo : pick(by.Midfield)).id })
        else log({ side: 'them', kind: 'ground_ball' })
      }
      return won ? 'us' : 'them'
    }

    const ground = (s) => (s === 'us' ? log({ side: 'us', kind: 'ground_ball', player_id: pick(anyField).id }) : log({ side: 'them', kind: 'ground_ball' }))

    const turnover = (s) => {
      const caused = chance(0.5)
      if (s === 'us') log({ side: 'us', kind: 'turnover', result: caused ? 'caused' : 'unforced', player_id: pick(anyField).id })
      // Their turnover: credit our defender when one forced it (and the tracker caught who).
      else log({ side: 'them', kind: 'turnover', result: caused ? 'caused' : 'unforced', player_id: caused && chance(0.85) ? pick(defenders).id : null })
      if (caused && chance(0.6)) ground(other(s))
    }

    const penalty = (s) => {
      const minutes = pick(PENALTY_TIMES)
      if (s === 'us') log({ side: 'us', kind: 'penalty', player_id: pick([...defenders, ...by.Midfield]).id, penalty_minutes: minutes })
      else log({ side: 'them', kind: 'penalty', penalty_minutes: minutes })
      up = other(s)
      upLeft = minutes >= 1 ? 2 : 1
    }

    /** One trip down the field for side s. Returns who has it next, and whether that's after a goal. */
    const possession = (s, mustClear) => {
      const o = other(s)
      if (mustClear) {
        const ok = chance(side[s].clear)
        log({ side: s, kind: 'clear', result: ok ? 'success' : 'fail' })
        if (!ok) {
          turnover(s)
          return { next: o, goal: false, clear: false }
        }
      }
      // A loose ball in the settled offense, scooped by whoever keeps it.
      if (chance(0.45)) ground(s)
      const r = rand()
      if (r < 0.05) {
        // The defense fouls and the offense keeps it, a man up.
        penalty(o)
        return { next: s, goal: false, clear: false }
      }
      if (r < 0.08) {
        penalty(s)
        return { next: o, goal: false, clear: true }
      }
      if (r < 0.08 + (1 - side[s].keep) * 0.9) {
        turnover(s)
        return { next: o, goal: false, clear: true }
      }
      // Shots until it goes in, the goalie has it, or it's lost.
      for (let tries = 0; tries < 4; tries++) {
        const boost = up === s ? 0.2 : up === o ? -0.08 : 0
        const p = rand()
        const goal = side[s].finish + boost
        const result =
          p < goal ? 'goal' : p < goal + 0.26 ? 'saved' : p < goal + 0.26 + 0.33 ? 'missed' : p < goal + 0.26 + 0.33 + 0.08 ? 'blocked' : 'post'
        if (s === 'us') {
          const shooter = unknownShooters && chance(0.03) ? null : pick(shooters)
          let assist = null
          if (result === 'goal' && chance(0.55)) {
            const a = pick(feeders)
            if (a !== shooter) assist = a
          }
          log({ side: 'us', kind: 'shot', result, player_id: shooter?.id ?? null, assist_id: assist?.id ?? null, situation: situation() })
        } else {
          // Our goalie in the cage, unless the tracker didn't note him.
          log({ side: 'them', kind: 'shot', result, player_id: chance(0.97) ? goalie.id : null, situation: situation() })
        }
        if (result === 'goal') {
          score[s]++
          // A goal releases the man in the box.
          if (up === s) {
            up = null
            upLeft = 0
          }
          return { next: null, goal: true, clear: false }
        }
        if (result === 'saved') return { next: o, goal: false, clear: true }
        if (result === 'blocked') {
          const keep = chance(0.5)
          ground(keep ? s : o)
          if (!keep) return { next: o, goal: false, clear: true }
          continue
        }
        // Missed or off the pipe: backed up, or it goes the other way.
        if (chance(0.5)) {
          if (chance(0.4)) ground(s)
          continue
        }
        if (chance(0.5)) ground(o)
        return { next: o, goal: false, clear: true }
      }
      return { next: o, goal: false, clear: true }
    }

    // ── Play it ──
    for (; period <= LAST_PERIOD; period++) {
      const ot = period > 4
      if (ot && score.us !== score.them) break
      if (period === 4 && Math.abs(score.us - score.them) >= 8) goalie = by.Goalie[1]
      let left = ot ? OT_SECONDS : QUARTER_SECONDS
      let ball = faceoff()
      let clear = false
      let decided = false
      // In the last overtime there is no clock: somebody has to score.
      while (left > 0 || (period === LAST_PERIOD && score.us === score.them)) {
        const res = possession(ball, clear)
        left -= 25 + Math.floor(rand() * 50)
        if (up && --upLeft <= 0) up = null
        if (res.goal) {
          if (ot) {
            decided = true
            break
          }
          if (left <= 0) break
          ball = faceoff()
          clear = false
        } else {
          ball = res.next
          clear = res.clear
        }
      }
      up = null
      if (decided) break
    }

    game.team_score = score.us
    game.opp_score = score.them
    gamesOut.push(game)
  }

  return { games: gamesOut, events, players }
}

/** An event as the tracker would send it to addStatEvent. */
export function inputOf(e) {
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
