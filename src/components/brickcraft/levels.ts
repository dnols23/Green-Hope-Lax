// Level layouts. One character per brick slot, 11 slots per row:
//   .  empty        1  green (1 hit)    2  maroon (2 hits)
//   3  steel (3 hits)                   #  solid wall (never breaks)
// A level is cleared when every *breakable* brick is gone, so '#' can be used
// freely as an obstacle without making a board impossible.

export type Level = {
  name: string
  /** Ball speed multiplier for the level. */
  tempo: number
  rows: string[]
}

export const LEVELS: Level[] = [
  {
    name: 'Warmups',
    tempo: 1,
    rows: [
      '11111111111',
      '11111111111',
      '.222222222.',
    ],
  },
  {
    name: 'Chevron',
    tempo: 1.06,
    rows: [
      '2.........2',
      '12.......21',
      '112.....211',
      '1112...2111',
      '.111212111.',
    ],
  },
  {
    name: 'Fast Break',
    tempo: 1.12,
    rows: [
      '333.....333',
      '22222.22222',
      '11111111111',
      '..2.2.2.2..',
    ],
  },
  {
    name: 'The Crease',
    tempo: 1.18,
    rows: [
      '....333....',
      '..3322233..',
      '.221111122.',
      '11.......11',
      '1.........1',
    ],
  },
  {
    name: 'The Cage',
    tempo: 1.24,
    rows: [
      '#111111111#',
      '#.2222222.#',
      '#11.....11#',
      '..#33333#..',
    ],
  },
  {
    name: 'Championship',
    tempo: 1.32,
    rows: [
      '33333333333',
      '22222222222',
      '2#2#2#2#2#2',
      '11111111111',
      '.111111111.',
      '..2.2.2.2..',
    ],
  },
]
