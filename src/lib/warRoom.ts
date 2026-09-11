// Lines worth putting in front of a team, kept with the code rather than in a
// table: they don't change with the season and nobody needs to edit them from a
// phone at 3:30.

export const WALL_QUOTES: { line: string; who?: string }[] = [
  { line: 'The ball finds energy.' },
  { line: 'Defensively, do not let the ball find energy.' },
  { line: 'A little bit of knowledge is more dangerous than complete ignorance.' },
  { line: 'Pressure is what you are feeling when you don’t know what’s going on.' },
  { line: 'We don’t run around or away from anything. We run to the fight.', who: 'Mike Tomlin' },
  { line: 'If you can’t play together, then I’m afraid you can’t play at all.' },
  { line: 'We tend to forget: all good things take time.', who: 'John Wooden' },
  { line: 'Keep it simple, stupid.' },
  { line: 'This game is played on a five inch field, right between your ears.' },
  { line: 'There is something magical about the sport of lacrosse when it’s collaborative.' },
  { line: 'Stay ready, so you don’t have to get ready.' },
  { line: 'Every now and then you get a guy with all the right stuff. There aren’t many guys like that — you gotta make them like that.', who: 'Nick Saban' },
  { line: 'The more you prepare, the more you’ve done it, the more ready you’ll be in a game environment.', who: 'Rome Odunze' },
  { line: 'You shouldn’t take a shot you haven’t taken 1000 times in practice.', who: 'Kobe Bryant' },
  { line: 'Invest, grow and improve.' },
  { line: 'Grit: the ability and willingness to do any and all things necessary, regardless of circumstance.', who: 'Coach Ben Herbert' },
  { line: 'Humble and hungry.' },
  { line: 'We are not building strength. We are making them harder to break.' },
  { line: 'You have to change from doubter to believer.' },
  { line: 'It’s amazing how much can be accomplished if no one cares who gets the credit.' },
  { line: 'You gotta bait the hook.', who: 'Greg Maddux' },
  { line: 'Everyone can work harder than they think they can. Everybody’s a little better than they think they are.', who: 'Mike Leach' },
  { line: 'One word for all situations.', who: 'Bill Belichick' },
]

/**
 * The same line all day for everyone in the building, a different one tomorrow.
 * Keyed off the date so the whole staff sees the same quote without storing it.
 */
export function quoteOfTheDay(isoDate: string) {
  let hash = 0
  for (const ch of isoDate) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return WALL_QUOTES[hash % WALL_QUOTES.length]
}
