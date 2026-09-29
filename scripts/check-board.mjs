// Checks the field board's reader: node --experimental-strip-types scripts/check-board.mjs
//
// Every stored board goes through readBoard, so this is the one place the
// promise "a board saved before the new tools still opens as it was" can be
// held to — and where a forged or bloated board has to be cut back to size.

import assert from 'node:assert/strict'
import { readBoard, readClip, BOARD_LIMITS, boardIsBlank, boardItemCount, pathLook } from '../src/lib/board.ts'

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log('ok -', name)
}

const json = (v) => JSON.parse(JSON.stringify(v))

// A board exactly as the old editor saved it: discs, freehand lines of every
// kind with their per-line overrides, words, and a view.
const OLD = {
  tokens: [
    { id: 't_a1', kind: 'offense', x: 20.5, y: 30, label: 'A' },
    { id: 't_c1', kind: 'cone', x: 40, y: 12.3, label: '' },
    { id: 't_p1', kind: 'defense', x: 50, y: 40, label: '27', playerId: 'pl_9', color: '#123456' },
    { id: 't_b1', kind: 'ball', x: 55.1, y: 30.2, label: '' },
    { id: 't_g1', kind: 'goalie', x: 15, y: 30, label: 'G' },
    { id: 't_co', kind: 'coach', x: 60, y: 5, label: 'HC' },
  ],
  paths: [
    { id: 'p_r', kind: 'run', points: [{ x: 1, y: 2 }, { x: 3.5, y: 4 }, { x: 6, y: 7 }] },
    { id: 'p_p', kind: 'pass', points: [{ x: 10, y: 10 }, { x: 20, y: 20 }], color: '#ffffff', width: 1.2, dash: '0.8 1.6', startCap: 'dot', endCap: 'square' },
    { id: 'p_s', kind: 'shot', points: [{ x: 30, y: 30 }, { x: 15, y: 30 }] },
    { id: 'p_k', kind: 'screen', points: [{ x: 40, y: 40 }, { x: 42, y: 41 }], endCap: 'none' },
  ],
  texts: [
    { id: 'x_1', x: 55, y: 24, text: 'Call it', size: 4, color: '#17222e', bold: true, italic: false, underline: true, font: 'serif', align: 'start' },
    { id: 'x_2', x: 10, y: 5, text: 'Two\nlines', size: 3, color: '#ffffff', bold: false, italic: true, underline: false },
  ],
  view: { half: 'right', turn: 90 },
}

check('an old board reads back exactly as it was saved', () => {
  const out = readBoard(json(OLD))
  assert.deepEqual(json(out), json(OLD))
  // And again: reading is idempotent, so a board saved from the editor and
  // opened again is the same board.
  assert.deepEqual(json(readBoard(json(out))), json(out))
})

check('an old board without texts or view reads as before', () => {
  const b = { tokens: [{ id: 't_1', kind: 'offense', x: 1, y: 2, label: 'M' }], paths: [] }
  assert.deepEqual(json(readBoard(b)), { tokens: [{ id: 't_1', kind: 'offense', x: 1, y: 2, label: 'M' }], paths: [], texts: [] })
})

check('old lines keep drawing the way their kind always did', () => {
  const b = readBoard(json(OLD))
  const look = pathLook(b.paths[3])
  assert.equal(look.endCap, 'none')
  assert.equal(pathLook(b.paths[0]).endCap, 'arrow')
  assert.equal(pathLook(b.paths[0]).curve, false)
  assert.equal(pathLook(b.paths[0]).pattern, undefined)
  assert.equal(pathLook(b.paths[0]).lineCap, 'round')
  assert.equal(pathLook(b.paths[0]).opacity, 1)
})

check('an empty board is no board, as before', () => {
  assert.equal(readBoard({ tokens: [], paths: [], texts: [] }), null)
  assert.equal(readBoard(null), null)
  assert.equal(readBoard('board'), null)
  assert.equal(readBoard(42), null)
  assert.equal(boardIsBlank(null), true)
  assert.equal(boardIsBlank({ tokens: [], paths: [], shapes: [] }), true)
  assert.equal(boardIsBlank({ tokens: [], paths: [], view: { half: 'left' } }), false)
})

// A board using every new field.
const NEW = {
  tokens: [
    { id: 't_n1', kind: 'offense', x: 20, y: 20, label: '1', mark: 'ring', size: 1.5, rot: 45, z: 3, locked: true, group: 'g_1' },
    { id: 't_n2', kind: 'goal', x: 70, y: 30, label: '', rot: 270, z: 7 },
    { id: 't_n3', kind: 'ladder', x: 80, y: 10, label: '', size: 0.8, group: 'g_1' },
    { id: 't_n4', kind: 'defense', x: 22, y: 24, label: 'X1', mark: 'x' },
  ],
  paths: [
    {
      id: 'p_n1', kind: 'run', points: [{ x: 1, y: 1 }, { x: 5, y: 9 }, { x: 12, y: 3 }],
      color: '#FACC15', width: 0.9, dash: '', startCap: 'open', endCap: 'circle', curve: true,
      pattern: 'wavy', opacity: 0.6, lineCap: 'butt', z: 1, locked: true, group: 'g_2',
    },
    { id: 'p_n2', kind: 'pass', points: [{ x: 0, y: 0 }, { x: 9, y: 9 }], pattern: 'zigzag', lineCap: 'square' },
  ],
  texts: [
    { id: 'x_n1', x: 30, y: 30, text: 'Slide!', size: 5, color: '#ffffff', bold: true, italic: true, underline: false, font: 'condensed', align: 'end', bg: '#7A1F2B', bgOpacity: 0.8, rot: 10, z: 12, group: 'g_2' },
  ],
  shapes: [
    { id: 's_1', kind: 'rect', x: 10, y: 10, w: 20, h: 40, fill: '#FACC15', fillOpacity: 0.25, stroke: '#ffffff', strokeWidth: 0.4, dash: '3 2', z: -2 },
    { id: 's_2', kind: 'roundrect', x: 60, y: 5, w: 10, h: 8, radius: 2, rot: 30 },
    { id: 's_3', kind: 'ellipse', x: 40, y: 20, w: 12, h: 12, strokeWidth: 0 },
    { id: 's_4', kind: 'triangle', x: 5, y: 5, w: 6, h: 5, locked: true },
    { id: 's_5', kind: 'diamond', x: 50, y: 50, w: 4, h: 4 },
    { id: 's_6', kind: 'polygon', x: 0, y: 0, w: 10, h: 10, pts: [{ x: 0, y: 0 }, { x: 1, y: 0.2 }, { x: 0.5, y: 1 }] },
  ],
  view: { turn: 180 },
}

check('a board with every new field round-trips unchanged', () => {
  const out = readBoard(json(NEW))
  assert.deepEqual(json(out), json(NEW))
  assert.equal(boardItemCount(out), 13)
})

check('a board of only shapes is a board', () => {
  const out = readBoard({ tokens: [], paths: [], shapes: [{ id: 's', kind: 'ellipse', x: 1, y: 1, w: 3, h: 3 }] })
  assert.ok(out)
  assert.equal(out.shapes.length, 1)
  assert.equal(boardIsBlank(out), false)
})

check('bad values are cleaned rather than trusted', () => {
  const out = readBoard({
    tokens: [
      { id: 't_bad', kind: 'dragon', x: 'NaN', y: Infinity, label: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', color: 'red; background:url(x)', mark: 'skull', size: 99, rot: 725, z: 1e99, locked: 'yes', group: {} },
      { id: 't_bad', kind: 'cone', x: -1e9, y: 1e9, label: 5 },
    ],
    paths: [
      { id: 'p_x', kind: 'laser', points: [{ x: 1, y: 1 }, { x: 'a', y: null }], color: 'javascript:alert(1)', width: -5, dash: 'url(#evil)', startCap: 'skull', endCap: 'arrow', curve: 'yes', pattern: 'spiral', opacity: 5, lineCap: 'bevel' },
      { id: 'p_one', kind: 'run', points: [{ x: 1, y: 1 }] },
      { id: 'p_wide', kind: 'run', points: [{ x: 1, y: 1 }, { x: 2, y: 2 }], width: 400, opacity: -1 },
    ],
    texts: [
      { id: 'x_bad', x: 1, y: 1, text: 'x'.repeat(50_000), size: 1e6, color: 'expression(alert(1))', font: '"><script>', align: 'justify', bg: 'url(x)', bgOpacity: 7, rot: -90 },
      { id: 'x_blank', x: 1, y: 1, text: '   ', size: 3, color: '#000' },
      { id: 'x_obj', x: 1, y: 1, text: { toString: 'no' }, size: 3, color: '#000' },
    ],
    shapes: [
      { id: 's_bad', kind: 'hexagram', x: 1, y: 1, w: 1, h: 1 },
      { id: 's_poly', kind: 'polygon', x: 1, y: 1, w: 5, h: 5, pts: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
      { id: 's_now', kind: 'rect', x: 1, y: 1 },
      { id: 's_big', kind: 'ellipse', x: 1, y: 1, w: 1e9, h: -4, fill: 'none', stroke: '#zzzzzz', strokeWidth: 50, radius: 1e6, fillOpacity: 2, pts: [{ x: 0, y: 0 }] },
      { id: 's_pts', kind: 'polygon', x: 1, y: 1, w: 5, h: 5, pts: [{ x: -3, y: 9 }, { x: 0.5, y: 'x' }, { x: 1, y: 1 }] },
    ],
    view: { half: 'middle', turn: 45 },
  })
  const [t1, t2] = out.tokens
  assert.equal(t1.kind, 'offense')
  assert.equal(t1.x, 0)
  assert.equal(t1.y, 0) // Infinity is not a position
  assert.equal(t1.label.length, BOARD_LIMITS.label)
  assert.equal(t1.color, undefined)
  assert.equal(t1.mark, undefined)
  assert.equal(t1.size, 5)
  assert.equal(t1.rot, 5)
  assert.equal(t1.z, 1_000_000)
  assert.equal(t1.locked, undefined)
  assert.equal(t1.group, undefined)
  // Two things with one id become two ids.
  assert.notEqual(t2.id, t1.id)
  assert.equal(t2.x, -30)
  assert.equal(t2.y, 90)
  assert.equal(t2.label, '')

  assert.equal(out.paths.length, 2) // the one-point line is dropped
  const [p1, p2] = out.paths
  assert.equal(p1.kind, 'run')
  assert.deepEqual(p1.points[1], { x: 0, y: 0 })
  assert.equal(p1.color, undefined)
  assert.equal(p1.width, undefined)
  assert.equal(p1.dash, undefined)
  assert.equal(p1.startCap, undefined)
  assert.equal(p1.endCap, 'arrow')
  assert.equal(p1.curve, undefined)
  assert.equal(p1.pattern, undefined)
  assert.equal(p1.opacity, 1)
  assert.equal(p1.lineCap, undefined)
  assert.equal(p2.width, 4)
  assert.equal(p2.opacity, 0.05)

  assert.equal(out.texts.length, 1) // blank words, and words that are not words, are dropped
  const [x1] = out.texts
  assert.equal(x1.text.length, BOARD_LIMITS.text)
  assert.equal(x1.size, 12)
  assert.equal(x1.color, '#17222e')
  assert.equal(x1.font, undefined)
  assert.equal(x1.align, undefined)
  assert.equal(x1.bg, undefined)
  assert.equal(x1.bgOpacity, 1)
  assert.equal(x1.rot, 270)

  const ids = out.shapes.map((s) => s.id)
  assert.deepEqual(ids, ['s_big', 's_pts'])
  const big = out.shapes[0]
  assert.equal(big.w, 200)
  assert.equal(big.h, 0.2)
  assert.equal(big.fill, undefined)
  assert.equal(big.stroke, undefined)
  assert.equal(big.strokeWidth, 4)
  assert.equal(big.radius, 50)
  assert.equal(big.fillOpacity, 1)
  assert.equal(big.pts, undefined) // corners are for polygons only
  assert.deepEqual(out.shapes[1].pts, [{ x: 0, y: 1 }, { x: 0.5, y: 0 }, { x: 1, y: 1 }])

  assert.equal(out.view, undefined)
})

check('a board with a blank word only is not a board', () => {
  assert.equal(readBoard({ tokens: [], paths: [], texts: [{ id: 'x', x: 1, y: 1, text: '  ', size: 3, color: '#000' }] }), null)
})

check('an oversized board is cut to the limits', () => {
  const many = (n, f) => Array.from({ length: n }, (_, i) => f(i))
  const pts = many(5000, (i) => ({ x: i % 100, y: i % 50 }))
  const out = readBoard({
    tokens: many(5000, (i) => ({ id: `t${i}`, kind: 'cone', x: i % 100, y: 5, label: '' })),
    paths: many(2000, (i) => ({ id: `p${i}`, kind: 'run', points: pts })),
    texts: many(2000, (i) => ({ id: `x${i}`, x: 1, y: 1, text: 'hi', size: 3, color: '#000' })),
    shapes: many(2000, (i) => ({ id: `s${i}`, kind: 'polygon', x: 1, y: 1, w: 2, h: 2, pts: many(900, () => ({ x: 0.5, y: 0.5 })) })),
  })
  assert.equal(out.tokens.length, BOARD_LIMITS.tokens)
  assert.equal(out.paths.length, BOARD_LIMITS.paths)
  assert.equal(out.paths[0].points.length, BOARD_LIMITS.pointsPerPath)
  assert.equal(out.texts.length, BOARD_LIMITS.texts)
  assert.equal(out.shapes.length, BOARD_LIMITS.shapes)
  assert.equal(out.shapes[0].pts.length, BOARD_LIMITS.polygonPoints)
  const bytes = JSON.stringify(out).length
  assert.ok(bytes < 12_000_000, `a board at every limit is ${bytes} bytes`)
})

check('prototype keys in a stored board do nothing', () => {
  const out = readBoard(JSON.parse('{"tokens":[{"id":"t","kind":"cone","x":1,"y":1,"label":"","__proto__":{"polluted":1}}],"paths":[],"__proto__":{"polluted":1}}'))
  assert.equal({}.polluted, undefined)
  assert.equal(out.tokens[0].polluted, undefined)
})

check('clips still read, frame by frame, through the same reader', () => {
  const clip = readClip({
    frames: [
      { at: 0, board: OLD },
      { at: 100, board: NEW },
      { at: 50, board: NEW }, // time only runs forwards
      { at: 200, board: { tokens: 'no', paths: null } },
    ],
  })
  assert.equal(clip.frames.length, 3)
  assert.deepEqual(json(clip.frames[0].board), json(OLD))
  assert.deepEqual(json(clip.frames[1].board), json(NEW))
  assert.deepEqual(clip.frames[2].board, { tokens: [], paths: [], texts: [] })
  assert.equal(readClip({ frames: [{ at: 0, board: OLD }] }), null)
})

check('a clip cannot be inflated past its budget', () => {
  const heavy = { tokens: [], paths: Array.from({ length: 300 }, (_, i) => ({ id: `p${i}`, kind: 'run', points: Array.from({ length: 1000 }, (_, j) => ({ x: j % 100, y: 1 })) })) }
  const clip = readClip({ frames: Array.from({ length: 600 }, (_, i) => ({ at: i * 10, board: heavy })) })
  assert.ok(clip === null || clip.frames.length < 5, `kept ${clip?.frames.length} heavy frames`)
  const light = readClip({ frames: Array.from({ length: 800 }, (_, i) => ({ at: i * 10, board: OLD })) })
  assert.equal(light.frames.length, 600)
})

console.log(`\n${passed} checks passed`)
