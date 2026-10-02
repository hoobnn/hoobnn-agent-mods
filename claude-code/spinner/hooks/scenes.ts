// The pixel scenes, four rows (8 px) tall: a far layer drifting slowly, a
// middle one, the ground scrolling at speed, and the theme's hero in front,
// acting out what the turn does (thinking, running a tool, asking, writing).
import { canvas, cells, draw, frame, mod, noise, plot, put } from './cells'
import type { Canvas, Grid } from './cells'
import type { Act } from './themes'

export const SCENE_ROWS = 4
const H = SCENE_ROWS * 2

// ---- layers -------------------------------------------------------------------

/** Stars as small glyphs over the cells (finer than a pixel): only where nothing is drawn. */
function glyphStars(g: Grid, t: number, count: number, speed: number, glyphs: readonly string[], colors: readonly string[], seed = 0): void {
  const w = g[0]!.length
  for (let i = 0; i < count; i++) {
    const x = mod(Math.floor(noise(i + seed) * w * 3) - Math.floor(t * speed * (0.5 + noise(i + seed + 7))), w)
    const row = Math.floor(noise(i + seed + 3) * g.length)
    const cell = g[row]![x]!
    if (cell.ch !== ' ') continue
    const twinkle = mod(t + i * 5, 24)
    put(g, x, row, twinkle < 2 ? glyphs[1] ?? glyphs[0]! : glyphs[0]!, { c: colors[i % colors.length], d: twinkle >= 2 })
  }
}

/** A ridge of hills, filled from its crest down to `base`, scrolling at `speed`. */
function ridge(cv: Canvas, t: number, base: number, height: number, speed: number, color: string, seed: number): void {
  const off = t * speed
  for (let x = 0; x < cv.w; x++) {
    const u = x + off
    const h = height * (0.55 + 0.3 * Math.sin(u * 0.09 + seed) + 0.15 * Math.sin(u * 0.23 + seed * 2))
    for (let y = Math.round(base - h); y <= base; y++) plot(cv, x, y, color)
  }
}

/** The ground's top row: `colors` in a pattern that scrolls at `speed`. */
function ground(cv: Canvas, t: number, y: number, speed: number, colors: readonly string[]): void {
  const off = Math.floor(t * speed)
  for (let x = 0; x < cv.w; x++) plot(cv, x, y, colors[mod(Math.floor((x + off) / 2), colors.length)]!)
}

/** Clouds: soft lumps drifting at `speed`. */
function clouds(cv: Canvas, t: number, count: number, speed: number, color: string, maxY: number, seed: number): void {
  const LUMP = ['.CCC..', 'CCCCCC']
  for (let i = 0; i < count; i++) {
    const x = mod(Math.floor(noise(i + seed) * (cv.w + 8)) - Math.floor(t * speed), cv.w + 8) - 6
    draw(cv, x, Math.floor(noise(i + seed + 1) * maxY), LUMP, { C: color })
  }
}

/** Where a hero strolls: in from the left, a stop mid-way to work, then out. */
function stroll(t: number, w: number, width: number, stop: number): { x: number; isWalking: boolean } {
  const lap = w + width
  const p = mod(t, lap + stop)
  const mid = Math.floor(lap / 2)
  if (p < mid) return { x: p - width, isWalking: true }
  if (p < mid + stop) return { x: mid - width, isWalking: false }
  return { x: p - stop - width, isWalking: true }
}

// ---- clawd: Claude's mascot at his workbench ------------------------------------

const CLAUDE = '#d77757'
const CLAWD = {
  stand: ['..LLOOOOOOOO..', '..OOEOOOOEOO..', '..OOEOOOOEOO..', 'OOOOOOOOOOOOOO', '..OOOOOOOOOO..', '..DDDDDDDDDD..', '...D.D..D.D...'],
  step: ['..LLOOOOOOOO..', '..OOEOOOOEOO..', '..OOEOOOOEOO..', 'OOOOOOOOOOOOOO', '..OOOOOOOOOO..', '..DDDDDDDDDD..', '..D.D....D.D..'],
  blink: ['..LLOOOOOOOO..', '..OOOOOOOOOO..', '..OOEOOOOEOO..', 'OOOOOOOOOOOOOO', '..OOOOOOOOOO..', '..DDDDDDDDDD..', '...D.D..D.D...'],
  work: ['..LLOOOOOOOO..', '..OOEOOOOEOO..', '..OOEOOOOEOO..', '.OOOOOOOOOOOOO', 'O.OOOOOOOOOO.O', '..DDDDDDDDDD..', '...D.D..D.D...'],
}
const CLAWD_COLORS = { O: CLAUDE, L: '#eb9b80', D: '#b05d42', E: '#2b1d18' }
const BLOCK_COLORS = ['#7aa2f7', '#9ece6a', '#e0af68', '#bb9af7', '#7dcfff']
const SPIN = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢']

export function clawdScene(t: number, w: number, act: Act): Grid {
  const cv = canvas(w, SCENE_ROWS)
  // A plank floor scrolling under his feet.
  ground(cv, t, 7, 0.5, ['#6b4f43', '#5a4238', '#6b4f43', '#7a5a4c', '#5a4238'])
  const { x, isWalking } = stroll(t, w, 16, act === 'tool' ? 60 : 40)
  const bench = x + 15
  // While a tool runs, code blocks stack up on the bench beside him and slide away.
  if (!isWalking && act === 'tool') {
    for (let i = 0; i < 4; i++) {
      const age = mod(t - i * 6, 24)
      const bx = bench + 2 + Math.floor(age / 2)
      draw(cv, bx, 5 - (i % 2), ['BBB'], { B: BLOCK_COLORS[(i + Math.floor(t / 24)) % BLOCK_COLORS.length]! })
    }
    draw(cv, bench, 6, ['TTTTTTTT'], { T: '#6b4f43' })
  }
  const blink = mod(t, 30) < 2
  const art = isWalking ? (mod(t, 4) < 2 ? CLAWD.stand : CLAWD.step) : blink ? CLAWD.blink : act === 'tool' && mod(t, 4) < 2 ? CLAWD.work : CLAWD.stand
  const bob = isWalking && mod(t, 4) < 2 ? 0 : 1
  draw(cv, x, bob, art, CLAWD_COLORS)
  const g = cells(cv)
  glyphStars(g, t, Math.floor(w / 4), 0.05, ['·', '✻'], ['#8a6a5c', '#a97c68', '#6b5248'], 3)
  if (!isWalking) {
    const above = x + 15
    if (act === 'think') put(g, above, 0, frame(SPIN, t), { c: CLAUDE, b: true })
    else if (act === 'ask') put(g, above, 0, mod(t, 8) < 6 ? '?' : ' ', { c: '#ffd166', b: true })
    else if (act === 'say') put(g, above, 0, frame(['✎', '✎·', '✎··', '✎···'], t >> 1), { c: '#e9b49a' })
    else if (act === 'tool') put(g, above, 0, frame(['⁘', '✦', '·', '✶'], t), { c: '#f4a261', b: true })
  }
  return g
}

// ---- thunder: a side-scrolling shoot-em-up ------------------------------------

const JET = ['..AA........', '.FBBBBWW....', 'FFBBBBBBBBC.', '.FBBBBBB....', '..AA........']
const FOE = [
  ['.RRRR.', 'RYRRYR', 'RRRRRR', 'R.RR.R', '.R..R.'],
  ['.RRRR.', 'RYRRYR', 'RRRRRR', 'R.RR.R', 'R....R'],
]
const SAUCER = [['..PP..', '.PPPP.', 'PWPWPW', '.PPPP.'], ['..PP..', '.PPPP.', 'WPWPWP', '.PPPP.']]

export function thunderScene(t: number, w: number, act: Act): Grid {
  const cv = canvas(w, SCENE_ROWS)
  // Three layers of stars streaming past.
  for (let layer = 1; layer < 3; layer++) {
    const speed = [0.5, 1, 2][layer]!
    const color = ['#2b2d42', '#3d405b', '#8d99ae'][layer]!
    for (let i = 0; i < w / (layer === 2 ? 14 : 9); i++) {
      const y = Math.floor(noise(i * 3 + layer) * H)
      const x = mod(Math.floor(noise(i + layer * 50) * w * 2 - t * speed), w)
      plot(cv, x, y, color)
      if (layer === 2) plot(cv, x + 1, y, color)
    }
  }
  // Foe k flies in at tick k * GAP and is shot down where it is fated to be.
  const GAP = act === 'tool' ? 9 : 14
  const SPEED = act === 'ask' ? 0.3 : 0.9
  const travel = (w + 8) / SPEED
  const foes: { x: number; y: number; k: number; isAlive: boolean; age: number }[] = []
  let kills = Math.max(0, Math.floor((t - travel) / GAP))
  for (let k = kills; k <= Math.floor(t / GAP); k++) {
    const y = 2 + Math.floor(noise(k) * 2)
    const killX = w * (0.35 + noise(k + 11) * 0.4)
    const x = w + 2 - (t - k * GAP) * SPEED
    const deadAt = k * GAP + (w + 2 - killX) / SPEED
    if (deadAt <= t) kills++
    if (x > killX) foes.push({ x, y, k, isAlive: true, age: 0 })
    else if (t - deadAt < 6) foes.push({ x: killX, y, k, isAlive: false, age: t - deadAt })
  }
  const target = foes.filter(f => f.isAlive).sort((a, b) => a.x - b.x)[0]
  const jy = target ? Math.max(0, Math.min(3, target.y - 0)) : 1 + Math.round(Math.sin(t * 0.2))
  // Shots: a stream toward the nearest foe.
  if (act !== 'ask') {
    for (let f = t - mod(t, 2); f > t - w / 4; f -= 2) {
      const bx = 12 + (t - f) * 4
      if (target && bx >= target.x) continue
      plot(cv, bx, jy + 2, '#ffd60a')
      plot(cv, bx + 1, jy + 2, '#fff3b0')
    }
  }
  const flame = frame(['#ff9f1c', '#ffd60a', '#ff6b35'], t)
  draw(cv, 1, jy, JET, { A: '#4361ee', B: '#4cc9f0', W: '#e0fbfc', C: '#f72585', F: flame })
  plot(cv, 0, jy + 2, mod(t, 2) ? '#ffd60a' : '#ff6b35')
  for (const foe of foes) {
    if (foe.isAlive) {
      if (foe.k % 3 === 2) draw(cv, foe.x, foe.y, frame(SAUCER, t >> 1), { P: '#9d4edd', W: '#80ffdb' })
      else draw(cv, foe.x, foe.y, frame(FOE, t >> 1), { R: '#f72585', Y: '#ffd60a' })
    } else {
      const r = foe.age
      const color = frame(['#ffffff', '#fff3b0', '#ffd60a', '#ff9f1c', '#e85d04', '#9d0208'], r)
      for (let a = 0; a < 10; a++) plot(cv, foe.x + 3 + Math.cos(a * 0.628) * r * 1.6, foe.y + 2 + Math.sin(a * 0.628) * r * 0.8, color)
      if (r < 2) draw(cv, foe.x + 2, foe.y + 1, ['WW', 'WW'], { W: '#ffffff' })
    }
  }
  const g = cells(cv)
  glyphStars(g, t, Math.floor(w / 4), 0.5, ['·', '✦'], ['#5c677d', '#8d99ae'], 21)
  const score = `SCORE ${String(kills * 100).padStart(6, '0')}`
  put(g, w - score.length - 1, 0, score, { c: '#fca311', b: true })
  if (act === 'ask' && mod(t, 8) < 5) put(g, 14, 0, '! READY?', { c: '#ffd166', b: true })
  return g
}

// ---- chomp: the dot-eater in its maze ------------------------------------------

const PAC = [
  ['.YYYYY.', 'YYYYYYY', 'YYYY...', 'YYYY...', 'YYYYYYY', '.YYYYY.'],
  ['.YYYYY.', 'YYYYYYY', 'YYYYYY.', 'YYYYYY.', 'YYYYYYY', '.YYYYY.'],
  ['.YYYYY.', 'YYYYYYY', 'YYYYYYY', 'YYYYYYY', 'YYYYYYY', '.YYYYY.'],
  ['.YYYYY.', 'YYYYYYY', 'YYYYYY.', 'YYYYYY.', 'YYYYYYY', '.YYYYY.'],
]
const GHOST = [
  ['.GGGGG.', 'GWWGWWG', 'GWKGWKG', 'GGGGGGG', 'GGGGGGG', 'G.GG.GG'],
  ['.GGGGG.', 'GWWGWWG', 'GWKGWKG', 'GGGGGGG', 'GGGGGGG', 'GG.G.GG'],
]
const SCARED = [
  ['.BBBBB.', 'BBBBBBB', 'BWBBBWB', 'BBBBBBB', 'BPBPBPB', 'B.BB.BB'],
  ['.BBBBB.', 'BBBBBBB', 'BWBBBWB', 'BBBBBBB', 'BPBPBPB', 'BB.B.BB'],
]

export function chompScene(t: number, w: number, act: Act): Grid {
  const cv = canvas(w, SCENE_ROWS)
  // The maze's walls, double lines top and bottom.
  for (let x = 0; x < w; x++) {
    plot(cv, x, 0, '#2121de')
    plot(cv, x, 7, '#2121de')
  }
  const speed = act === 'tool' ? 1 : act === 'ask' ? 0.25 : 0.6
  const lap = w + 50
  const px = mod(Math.floor(t * speed), lap) - 8
  const pellet = Math.floor(w * 0.55)
  for (let x = 4; x < w; x += 4) if (x > px + 6 && Math.abs(x - pellet) > 2) plot(cv, x, 3, '#ffb8ae')
  if (pellet > px + 6 && mod(t, 6) < 4) draw(cv, pellet - 1, 3, ['PP', 'PP'], { P: '#ffb8ae' })
  const isScared = px >= pellet && px < pellet + 45
  const colors = ['#ff0000', '#ffb8ff', '#00ffff', '#ffb852']
  colors.forEach((color, i) => {
    const gx = px - 11 - i * 9
    const art = isScared ? frame(SCARED, (t >> 1) + i) : frame(GHOST, (t >> 1) + i)
    const flash = isScared && px > pellet + 30 && mod(t, 4) < 2
    draw(cv, gx, 1, art, { G: color, W: '#ffffff', K: '#2121de', B: flash ? '#ffffff' : '#2121de', P: '#ffb8ae' })
  })
  draw(cv, px, 1, frame(PAC, t), { Y: '#ffff00' })
  const g = cells(cv)
  const score = String(Math.max(0, Math.floor(px / 4)) * 10 + Math.floor(mod(t, lap) / lap) * 200).padStart(4, '0')
  put(g, w - score.length - 1, 0, score, { c: '#ffffff', b: true })
  if (act === 'ask' && mod(t, 8) < 5) put(g, Math.max(0, px - 2), 0, 'READY!', { c: '#ffff00', b: true })
  return g
}

// ---- sparky: an electric mouse across a meadow ---------------------------------

const MOUSE = [
  ['K.....K...', 'YY...YY...', '.YYYYYY...', 'YYKYYKYY..', 'RYYYKYYR..', '.YYYYYY...', '.Y.YY.Y...'],
  ['K.....K...', 'YY...YY...', '.YYYYYY...', 'YYKYYKYY..', 'RYYYKYYR..', '.YYYYYY...', 'Y..YY..Y..'],
]
const TAIL = ['...YYY', '..YY..', '.YYYY.', '...YY.', '..BB..']
const BOLT = ['..WW', '.WW.', 'WWWW', '..W.', '.W..', 'W...', 'W...', '....']

export function sparkyScene(t: number, w: number, act: Act): Grid {
  const cv = canvas(w, SCENE_ROWS)
  clouds(cv, t, Math.max(2, Math.floor(w / 25)), 0.15, '#3a4a5c', 2, 4)
  ridge(cv, t, 6, 3, 0.15, '#2d4a3e', 2)
  ground(cv, t, 7, 0.7, ['#4caf50', '#43a047', '#66bb6a', '#4caf50', '#e9c46a'])
  // Every so often (often while a tool runs) a bolt strikes ahead of it.
  const every = act === 'tool' ? 10 : 34
  const strike = mod(t, every)
  const speed = act === 'ask' ? 0.2 : act === 'tool' ? 0.9 : 0.6
  const x = mod(Math.floor(t * speed), w + 18) - 10
  if (strike < 4) {
    const bx = Math.floor(noise(Math.floor(t / every)) * (w - 12)) + 6
    draw(cv, bx, 0, BOLT, { W: strike < 2 ? '#ffffff' : '#ffd60a' })
    if (strike < 2) for (let i = -3; i <= 3; i++) plot(cv, bx + i, 7, '#fff3b0')
  }
  draw(cv, x - 7, 1 + (mod(t, 4) < 2 ? 0 : 1), TAIL, { Y: '#f4c430', B: '#8d6e3f' })
  const cheek = act === 'tool' && mod(t, 4) < 2 ? '#fff3b0' : '#e63946'
  draw(cv, x, mod(t, 4) < 2 ? 0 : 1, frame(MOUSE, t >> 1), { K: '#1b1b1b', Y: '#ffd60a', R: cheek })
  const g = cells(cv)
  if (act === 'tool' && mod(t, 4) < 2) put(g, x + 9, 0, 'ϟ', { c: '#ffd60a', b: true })
  if (act === 'ask' && mod(t, 8) < 6) put(g, x + 9, 0, '?', { c: '#ffd166', b: true })
  return g
}

// ---- bluecat: a robot cat on a bamboo-copter over the rooftops ------------------

const ROBOCAT = [
  ['..PPPPPPP..', '.....p.....', '..BBBBBBB..', '.BBWWBWWBB.', 'BBWKWRWKWBB', 'BBWWWWWWWBB', '.BRRRYRRRB.'],
  ['....PPP....', '.....p.....', '..BBBBBBB..', '.BBWWBWWBB.', 'BBWKWRWKWBB', 'BBWWWWWWWBB', '.BRRRYRRRB.'],
]
const GADGETS = ['#ff8fab', '#ffd60a', '#80ffdb', '#c77dff', '#f4a261']

export function bluecatScene(t: number, w: number, act: Act): Grid {
  const cv = canvas(w, SCENE_ROWS)
  clouds(cv, t, Math.max(2, Math.floor(w / 20)), 0.2, '#2b3a55', 3, 9)
  // Rooftops far below, scrolling past.
  const off = Math.floor(t * 0.4)
  for (let x = 0; x < w; x++) {
    const b = Math.floor((x + off) / 7)
    const h = 1 + Math.floor(noise(b) * 3)
    for (let y = 8 - h; y < 8; y++) plot(cv, x, y, mod(x + off, 7) === 0 ? '#14213d' : '#1f2a44')
    if (h > 1 && noise(b * 3 + y0(x + off)) < 0.25) plot(cv, x, 8 - h + 1, '#ffd166')
  }
  const x = Math.floor(w * 0.3) + Math.round(Math.sin(t * 0.08) * (w * 0.15))
  const y = Math.round(Math.sin(t * 0.25)) + (act === 'ask' ? 1 : 0)
  // Gadgets tumble out of the pocket while a tool runs.
  if (act === 'tool') {
    for (let i = 0; i < 5; i++) {
      const age = mod(t + i * 4, 16)
      plot(cv, x + 5 - age, y + 6 + Math.floor(age / 4), frame(GADGETS, i + Math.floor(t / 16)))
      plot(cv, x + 4 - age, y + 6 + Math.floor(age / 4), frame(GADGETS, i + Math.floor(t / 16)))
    }
  }
  draw(cv, x, y, frame(ROBOCAT, t), { P: '#d4a373', p: '#8d6e3f', B: '#0096c7', W: '#ffffff', K: '#1b1b1b', R: '#e63946', Y: '#ffd60a' })
  const g = cells(cv)
  if (act === 'ask' && mod(t, 8) < 6) put(g, x + 12, 0, '?', { c: '#ffd166', b: true })
  return g
}

/** Which window row of a building lights up. */
function y0(n: number): number {
  return Math.floor(n / 3)
}

// ---- nyan: a pop-tart cat on a rainbow through space ---------------------------

const NYAN = [
  ['.TTTTTTTT.....', 'TPPSPPSPT.G..G', 'TPSPPPPPTGGGGG', 'TPPPPSPPTGKGGK', 'TPSPPPPSTGPGGP', '.TTTTTTTT.GGG.', '..L.L..L.L....'],
  ['.TTTTTTTT.....', 'TPPSPPSPT.G..G', 'TPSPPPPPTGGGGG', 'TPPPPSPPTGKGGK', 'TPSPPPPSTGPGGP', '.TTTTTTTT.GGG.', '.L.L..L.L.....'],
]
const RAINBOW = ['#ff0000', '#ff9900', '#ffff00', '#33ff00', '#0099ff', '#6633ff']
const SPARKLE = [['.W.', 'W.W', '.W.'], ['...', '.W.', '...'], ['W.W', '...', 'W.W']]

export function nyanScene(t: number, w: number, act: Act): Grid {
  const cv = canvas(w, SCENE_ROWS)
  const speed = act === 'tool' ? 3 : act === 'ask' ? 0.5 : 2
  const x = Math.floor(w * 0.45) + Math.round(Math.sin(t * 0.15) * 3)
  for (let i = 0; i < Math.floor(w / 10); i++) {
    const sx = mod(Math.floor(noise(i + 40) * w * 2) - Math.floor(t * speed), w)
    if (sx > x + 14) draw(cv, sx, Math.floor(noise(i + 3) * 6), frame(SPARKLE, t + i), { W: i % 3 ? '#ffffff' : '#ffd6ff' })
  }
  const bob = mod(Math.floor(t / 3), 2)
  for (let tx = 0; tx < x + 1; tx++) {
    const wave = mod(Math.floor((tx - t * speed * 0.5) / 4), 2)
    for (let i = 0; i < 6; i++) plot(cv, tx, i + wave + 1, RAINBOW[i]!)
  }
  draw(cv, x, bob, frame(NYAN, t >> 1), { T: '#ffcc99', P: '#ff99cc', S: '#ff3399', G: '#999999', K: '#1b1b1b', L: '#999999' })
  const g = cells(cv)
  if (act === 'ask' && mod(t, 8) < 6) put(g, x + 15, 0, '?', { c: '#ffd166', b: true })
  return g
}
