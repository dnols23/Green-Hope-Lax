// Shared shapes for the BrickCraft game. The engine owns all of these and
// mutates them in place each frame — nothing here is React state.

/** Brick material. `solid` is a wall: it never breaks and never counts toward
 *  clearing the level. */
export type BrickKind = 'green' | 'maroon' | 'steel' | 'solid'

export type Brick = {
  x: number
  y: number
  w: number
  h: number
  kind: BrickKind
  /** Hits left. `solid` bricks keep this at Infinity. */
  hp: number
  points: number
  alive: boolean
  /** Seconds left on the "just got hit" flash, for rendering only. */
  flash: number
}

export type PowerKind = 'wide' | 'multi' | 'slow' | 'life'

export type Power = {
  x: number
  y: number
  vy: number
  kind: PowerKind
}

export type Ball = {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  /** Riding the stick head, waiting for the player to launch. */
  stuck: boolean
  trail: { x: number; y: number }[]
}

export type Paddle = {
  /** Center of the stick head. */
  x: number
  y: number
  w: number
  h: number
}

export type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

export type Phase =
  | 'ready' // ball on the stick, waiting for a launch
  | 'playing'
  | 'paused'
  | 'levelup' // level cleared, waiting to move on
  | 'gameover'
  | 'victory' // every level cleared

export type Game = {
  phase: Phase
  score: number
  lives: number
  levelIndex: number
  /** Seconds since the game started — effect timers are compared against it. */
  time: number
  speed: number
  bricks: Brick[]
  balls: Ball[]
  powers: Power[]
  particles: Particle[]
  paddle: Paddle
  /** Absolute `time` each effect runs out at. 0 means inactive. */
  wideUntil: number
  slowUntil: number
  /** Short banner shown over the field when a power-up lands. */
  toast: { text: string; until: number } | null
  reducedMotion: boolean
}

/** What happened during a frame, so the UI can react without diffing state. */
export type FrameEvents = {
  lostLife: boolean
  cleared: boolean
  ended: boolean
}
