// Frame tables and scenes, shared by the hooks module and both surface modules
// (sprite.tsx draws the spinner's mascot, stage.tsx the band). Pure:
// everything here is a function of the theme, the tick and the width.
import { blank, canvas, cells, draw, frame, hsl, mod, noise, padTo, plot, put, textWidth } from './cells'
import type { Grid, Style } from './cells'

export * from './cells'

export const THEME_NAMES = [
  'clawd',
  'thunder',
  'chomp',
  'sparky',
  'bluecat',
  'nyan',
  'cat',
  'bunny',
  'sakura',
  'mecha',
  'neon',
  'dino',
  'ocean',
  'matrix',
] as const
export type ThemeName = (typeof THEME_NAMES)[number]

export type Mode = 'requesting' | 'responding' | 'thinking' | 'tool-input' | 'tool-use'
export type Pose = 'think' | 'tool' | 'say' | 'wait'
/** What the turn is doing, as the band's companion tells it. */
export type Act = 'think' | 'tool' | 'ask' | 'say' | 'wait'
export type Finale = 'answer' | 'aborted' | 'error'
/** The companion's mood between turns. */
export type Mood = 'hello' | 'ready' | 'aborted' | 'error' | 'sleep'

export type Theme = {
  name: ThemeName
  /** The mascot's color, and a second one for its props. */
  color: string
  accent: string
  /** Frames of the mascot beside the spinner's word, by what the turn is doing. */
  sprite: Record<Pose, string[]>
  /** Each character of the mascot in its own color, cycling. */
  isRainbow?: boolean
  happy: string
  sad: string
  dead: string
  sleep: string
  /** Particles of the finale's burst, and their colors. */
  confetti: string[]
  palette: string[]
  /** Rows the scene takes in the band. */
  rows: number
  /** The band's scene while a turn runs: `rows` rows of `w` cells. */
  scene: (t: number, w: number, act: Act) => Grid
}

/** Milliseconds per frame: the mascot's, the band's, the companion's between turns. */
export const SPRITE_MS = 140
export const STAGE_MS = 100
export const IDLE_MS = 400
/** How long the finale stays after a turn ends. */
export const FINALE_MS = 3000

export function poseOf(mode: string): Pose {
  if (mode === 'thinking' || mode === 'think') return 'think'
  if (mode === 'tool-use' || mode === 'tool-input' || mode === 'tool') return 'tool'
  if (mode === 'responding' || mode === 'say') return 'say'
  return 'wait'
}

export function isThemeName(name: unknown): name is ThemeName {
  return typeof name === 'string' && (THEME_NAMES as readonly string[]).includes(name)
}

/** A theme drawn from `seed`, for the `random` choice. */
export function pickRandom(seed: number): ThemeName {
  return THEME_NAMES[Math.floor(noise(seed) * THEME_NAMES.length)]!
}

// ---- scenes --------------------------------------------------------------

function catScene(t: number, w: number): Grid {
  const g = blank(w, 2)
  for (let x = 0; x < w; x++) {
    const n = noise(x + 1000 * Math.floor((x + t) / w))
    if (mod(x + t, 7) === 0) put(g, x, 1, n < 0.5 ? '˙' : ',', { c: '#7fb069', d: true })
  }
  const lap = w + 8
  const cx = mod(Math.floor(t * 0.6), lap) - 6
  put(g, cx, 1, 'ᓚᘏᗢ', { c: frame(['#ffb3c6', '#ffc8dd'], t >> 1), b: true })
  put(g, cx + 5, 1, frame(['◐', '◓', '◑', '◒'], t), { c: '#ffd166' })
  // Hearts float up behind the cat and fade.
  for (let i = 0; i < 3; i++) {
    const age = mod(t + i * 5, 15)
    if (age < 10) put(g, cx - 2 - Math.floor(age / 3), 0, age < 6 ? '♡' : '·', { c: '#ff8fab', d: age >= 6 })
  }
  if (mod(t, 40) < 20) put(g, cx + 3, 0, frame(['♪', '♫'], t >> 2), { c: '#cdb4db' })
  return g
}

function bunnyScene(t: number, w: number): Grid {
  const g = blank(w, 2)
  for (let x = 0; x < w; x++) {
    if (mod(x * 7 + 3, 11) === 0) put(g, x, 1, '"', { c: '#80b918', d: true })
  }
  const lap = w + 11
  const bx = mod(Math.floor(t * 0.5), lap) - 11
  // Carrots ahead of the bunny; the ones it has passed are eaten.
  for (let x = 6; x < w; x += 13) {
    if (x > bx + 9 || bx < -6) put(g, x, 1, 'ɣ', { c: '#ff9f1c', b: true })
  }
  const isUp = mod(t, 6) < 3
  put(g, bx, isUp ? 0 : 1, isUp ? '૮ ˶ᵔ ᵕ ᵔ˶ ა' : '૮ ˶• ᴗ •˶ ა', { c: '#f8f9fa', b: true })
  if (!isUp) put(g, bx - 2, 1, '⁎', { c: '#adb5bd', d: true })
  return g
}

function sakuraScene(t: number, w: number): Grid {
  const g = blank(w, 2)
  const pinks = ['#ffb7c5', '#ff8fab', '#fb6f92', '#ffc2d1', '#ffe5ec']
  const count = Math.max(6, Math.floor(w / 5))
  const gust = Math.sin(t * 0.05) * 0.4
  for (let i = 0; i < count; i++) {
    const speed = 0.25 + noise(i) * 0.45 + gust
    const x = mod(noise(i + 7) * w - t * speed + Math.sin(t * 0.2 + i) * 1.5, w)
    const y = mod(Math.floor(t * (0.05 + noise(i + 3) * 0.08) + i), 2)
    put(g, x, y, frame(['✿', '❀', '❁', '✾', '·'], i + (t >> 3)), { c: frame(pinks, i) })
  }
  const walker = mod(Math.floor(t * 0.2), w + 12) - 10
  put(g, walker, 1, frame(['(˶ᵔ ᵕ ᵔ˶)', '(˶ᵔ ᵕ ᵔ˶)~'], t >> 3), { c: '#ffafcc', b: true })
  return g
}

function mechaScene(t: number, w: number): Grid {
  const g = blank(w, 2)
  const cycle = 36
  const phase = mod(t, cycle)
  const score = Math.floor(t / cycle)
  const rx = 2
  put(g, rx - 2, 1, frame(['≋', '≈', '∼'], t), { c: frame(['#ff9f1c', '#ffbf69', '#ff595e'], t) })
  put(g, rx, 1, frame(['[◉_◉]', '[◉_◉]', '[◎_◎]'], t >> 1), { c: '#4cc9f0', b: true })
  const near = rx + 9
  const tx = Math.max(near, Math.round(w - 2 - phase * 2))
  if (tx > near) {
    put(g, tx, 1, frame(['◇', '◆'], t >> 1), { c: '#f72585' })
  } else {
    const boom = phase - Math.ceil((w - 2 - near) / 2)
    if (boom < 3) put(g, rx + 5, 1, '━'.repeat(Math.max(0, tx - rx - 5)), { c: '#4cc9f0', b: true })
    if (boom >= 2 && boom < 8) put(g, tx - (boom > 4 ? 1 : 0), 1, boom > 4 ? '· ✶ ·' : '✶', { c: '#ffd60a', b: true })
  }
  // A radar sweep and a target counter across the top.
  const sweep = mod(t, Math.max(1, w - 14))
  put(g, 0, 0, '▕', { c: '#4361ee', d: true })
  for (let x = 1; x < w - 13; x++) {
    const dist = sweep - x
    if (dist >= 0 && dist < 6) put(g, x, 0, '▔▁▂▃▅▇'[5 - dist]!, { c: '#4cc9f0', d: dist > 2 })
  }
  put(g, w - 12, 0, `TGT ${String(score).padStart(4, '0')}`, { c: '#4361ee', b: true })
  return g
}

function neonScene(t: number, w: number): Grid {
  const g = blank(w, 2)
  const blocks = ' ▁▂▃▄▅▆▇█'
  for (let x = 0; x < w; x++) {
    const v = (Math.sin(x * 0.33 + t * 0.35) + Math.sin(x * 0.11 - t * 0.21) + 2) / 4
    const h = Math.round(v * 16)
    const c = hsl(mod(x * 7 + t * 9, 360), 0.95, 0.62)
    put(g, x, 1, blocks[Math.min(8, h)]!, { c })
    if (h > 8) put(g, x, 0, blocks[h - 8]!, { c })
  }
  return g
}

function dinoScene(t: number, w: number): Grid {
  const g = blank(w, 2)
  const rx = 4
  const body = 'ᕕ(ᐛ)ᕗ'
  for (let x = 0; x < w; x++) {
    if (mod(x + t, 9) === 0) put(g, x, 1, '_', { c: '#6c757d', d: true })
  }
  for (let x = 0; x < w; x += 23) {
    put(g, mod(x - Math.floor(t * 0.3), w + 6) - 3, 0, '~~', { c: '#adb5bd', d: true })
  }
  // A cactus every 20 cells or so; the runner jumps the ones in reach.
  let isAirborne = false
  const first = Math.floor((t - rx - 10) / 20)
  for (let k = Math.max(0, first); k * 20 < t + w; k++) {
    const x = k * 20 + Math.floor(noise(k) * 10) + 30 - t
    if (x < 0 || x >= w) continue
    put(g, x, 1, 'ψ', { c: '#2a9d8f', b: true })
    if (x >= rx - 1 && x <= rx + textWidth(body) + 1) isAirborne = true
  }
  put(g, rx, isAirborne ? 0 : 1, isAirborne ? 'ᕕ(ᐛ)ᕗ' : frame(['ᕕ(ᐛ)ᕗ', 'ᕕ( ᐛ)ᕗ'], t >> 1), { c: '#e9c46a', b: true })
  put(g, w - 9, 0, `HI ${String(t).padStart(5, '0')}`, { c: '#adb5bd' })
  return g
}

function oceanScene(t: number, w: number): Grid {
  const g = blank(w, 2)
  for (let x = 0; x < w; x++) {
    put(g, x, 0, mod(x + Math.floor(t / 2), 6) < 3 ? '~' : '≈', { c: '#48cae4', d: mod(x - t, 5) !== 0 })
  }
  const fx = mod(Math.floor(t * 0.5), w + 10) - 8
  put(g, fx, 1, frame(['><(((º>', '><(((°>'], t >> 2), { c: '#ffb703', b: true })
  const sx = w - 1 - mod(Math.floor(t * 0.8), w + 5)
  put(g, sx, 1, '<><', { c: '#fb8500' })
  for (let i = 0; i < 3; i++) {
    const age = mod(t + i * 4, 12)
    const bx = fx + 8 + (i % 2)
    if (age < 4) put(g, bx, 1, 'o', { c: '#caf0f8', d: true })
    else if (age < 8) put(g, bx + 1, 0, '°', { c: '#caf0f8' })
  }
  return g
}

function matrixScene(t: number, w: number): Grid {
  const g = blank(w, 2)
  const glyphs = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ0123456789ﾊﾋﾌﾍﾎ'
  for (let x = 0; x < w; x++) {
    const speed = 1 + Math.floor(noise(x) * 3)
    const head = mod(Math.floor(t / speed) + Math.floor(noise(x + 50) * 20), 14)
    for (let y = 0; y < 2; y++) {
      const age = head - y
      if (age < 0 || age > 6) continue
      const ch = glyphs[Math.floor(noise(x * 31 + y + Math.floor(t / 3)) * glyphs.length)]!
      put(g, x, y, ch, age === 0 ? { c: '#d8f3dc', b: true } : { c: age < 3 ? '#52b788' : '#2d6a4f', d: age >= 3 })
    }
  }
  return g
}

// ---- the newer scenes: Claude's mascot and pixel art --------------------

const CLAUDE = '#d77757'

// Clawd as Claude Code's own welcome screen draws him, and his poses.
const CLAWD = {
  front: [' ▐▛███▜▌ ', '▝▜█████▛▘', '  ▘▘ ▝▝  '],
  step: [' ▐▛███▜▌ ', '▝▜█████▛▘', '  ▝▘ ▘▝  '],
  blink: [' ▐█████▌ ', '▝▜█████▛▘', '  ▘▘ ▝▝  '],
  look: [' ▐▛███▛█ ', '▝▜██████▀', ' ▝▝   ▝▝ '],
}

function clawdScene(t: number, w: number, act: Act): Grid {
  const g = blank(w, 3)
  for (let x = 0; x < w; x++) {
    if (noise(x * 3 + 1) < 0.06) put(g, x, mod(x, 2), mod(t + x * 7, 40) < 3 ? '✻' : '·', { c: '#5c4b45', d: true })
  }
  // He strolls across, stopping halfway to work; then strolls on.
  const lap = w + 10
  const p = mod(t, lap + 40)
  const pause = Math.floor(lap / 2)
  const x = p < pause ? p - 10 : p < pause + 40 ? pause - 10 : p - 50
  const isWalking = p < pause || p >= pause + 40
  const pose = isWalking ? (mod(t, 4) < 2 ? CLAWD.front : CLAWD.step) : mod(t, 30) === 0 ? CLAWD.blink : mod(t, 60) > 45 ? CLAWD.look : CLAWD.front
  pose.forEach((row, y) => put(g, x, y, row, { c: CLAUDE }))
  const side = x + 10
  if (act === 'tool') {
    put(g, side, 2, '▭▭', { c: '#9a8c98' })
    put(g, side, 1, frame(['⌁ ', ' ⌁', '⁘ '], t), { c: '#f4a261', b: true })
  } else if (act === 'ask') {
    put(g, side, 0, mod(t, 8) < 6 ? '?' : ' ', { c: '#ffd166', b: true })
  } else if (act === 'say') {
    put(g, side, 1, frame(['✎ ', '✎·', '✎··'], t >> 1), { c: '#e9b49a' })
  } else {
    put(g, side, 0, frame(['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'], t), { c: CLAUDE, b: true })
  }
  return g
}

const JET = ['AA.....', 'FBBWWBC', 'AA.....']
const FOE = [
  ['.RR.', 'RYYR', 'R..R'],
  ['.RR.', 'RYYR', '.RR.'],
]

function thunderScene(t: number, w: number, act: Act): Grid {
  const cv = canvas(w, 3)
  for (let i = 0; i < w / 3; i++) {
    const speed = 1 + (i % 3)
    plot(cv, mod(noise(i) * w * 4 - t * speed, w), Math.floor(noise(i + 5) * 6), speed === 3 ? '#8d99ae' : '#3d405b')
  }
  // Foe k flies in at tick k * GAP and is shot down where it is fated to be.
  const GAP = act === 'tool' ? 7 : 10
  const SPEED = 0.8
  const travel = (w + 4) / SPEED
  const foes: { x: number; y: number; isAlive: boolean; age: number }[] = []
  let kills = Math.max(0, Math.floor((t - travel) / GAP))
  for (let k = kills; k <= Math.floor(t / GAP); k++) {
    const y = 1 + Math.floor(noise(k) * 3)
    const killX = w * (0.35 + noise(k + 11) * 0.45)
    const x = w + 2 - (t - k * GAP) * SPEED
    const deadAt = k * GAP + (w + 2 - killX) / SPEED
    if (deadAt <= t) kills++
    if (x > killX) foes.push({ x, y, isAlive: true, age: 0 })
    else if (t - deadAt < 5) foes.push({ x: killX, y, isAlive: false, age: t - deadAt })
  }
  const target = foes.filter(f => f.isAlive).sort((a, b) => a.x - b.x)[0]
  const py = target ? target.y : 2
  for (let f = t - mod(t, 3); f > t - w / 3; f -= 3) {
    const bx = 8 + (t - f) * 3
    if (target && bx >= target.x) continue
    plot(cv, bx, py + 1, '#ffd60a')
    plot(cv, bx + 1, py + 1, '#fff3b0')
  }
  draw(cv, 1, py, JET, { A: '#4cc9f0', B: '#90e0ef', W: '#ffffff', C: '#4361ee', F: mod(t, 2) ? '#ff9f1c' : '#ffd60a' })
  for (const foe of foes) {
    if (foe.isAlive) {
      draw(cv, foe.x, foe.y, frame(FOE, t >> 1), { R: '#f72585', Y: '#ffd60a' })
    } else {
      const r = foe.age
      const color = frame(['#ffffff', '#ffd60a', '#ff9f1c', '#e85d04', '#9d0208'], r)
      for (let a = 0; a < 8; a++) plot(cv, foe.x + 1 + Math.cos(a * 0.785) * r * 1.4, foe.y + 1 + Math.sin(a * 0.785) * r * 0.8, color)
    }
  }
  const g = cells(cv)
  const score = `SCORE ${String(kills * 100).padStart(6, '0')}`
  put(g, w - score.length - 1, 0, score, { c: '#fca311', b: true })
  return g
}

const PAC = [
  ['.YYY.', 'YYY..', 'YY...', 'YYY..', '.YYY.'],
  ['.YYY.', 'YYYY.', 'YYY..', 'YYYY.', '.YYY.'],
  ['.YYY.', 'YYYYY', 'YYYYY', 'YYYYY', '.YYY.'],
  ['.YYY.', 'YYYY.', 'YYY..', 'YYYY.', '.YYY.'],
]
const GHOST = [
  ['.GGG.', 'GWGWG', 'GGGGG', 'GGGGG', 'G.G.G'],
  ['.GGG.', 'GWGWG', 'GGGGG', 'GGGGG', '.G.G.'],
]

function chompScene(t: number, w: number): Grid {
  const cv = canvas(w, 3)
  for (let x = 0; x < w; x++) plot(cv, x, 5, mod(x, 2) ? '#1d3557' : '#14213d')
  const lap = w + 40
  const px = mod(t, lap) - 6
  const pellet = Math.floor(w * 0.55)
  for (let x = 4; x < w; x += 4) if (x > px + 4 && Math.abs(x - pellet) > 2) plot(cv, x, 2, '#ffd6a5')
  if (pellet > px + 4 && mod(t, 6) < 4) draw(cv, pellet - 1, 1, ['PP', 'PP'], { P: '#ffd6a5' })
  const isScared = px >= pellet
  const colors = ['#ff595e', '#ffafcc', '#00f5d4', '#ff9f1c']
  colors.forEach((color, i) => {
    const gx = px - 9 - i * 7
    const body = isScared ? (mod(t, 8) < 6 || px < pellet + 20 ? '#3a0ca3' : '#ffffff') : color
    draw(cv, gx, 0, frame(GHOST, (t >> 1) + i), { G: body, W: isScared ? '#ffd6a5' : '#ffffff' })
  })
  draw(cv, px, 0, frame(PAC, t), { Y: '#ffd60a' })
  return cells(cv)
}

const MOUSE = [
  ['K......K', 'YY....YY', '.YYYYYY.', 'YKYYYYKY', 'RYYKKYYR', '.YY..YY.'],
  ['K......K', 'YY....YY', '.YYYYYY.', 'YKYYYYKY', 'RYYKKYYR', 'YY....YY'],
]
const TAIL = ['...YYYY', '....YY.', '...YY..', '..YYYY.', '...YY..', '..YY...']

function sparkyScene(t: number, w: number, act: Act): Grid {
  const cv = canvas(w, 3)
  const lap = w + 8
  const x = mod(Math.floor(t * 0.5), lap) - 8
  draw(cv, x - 7, 0, TAIL, { Y: '#d4a017' })
  const cheek = mod(t, 6) < 3 && act === 'tool' ? '#fff3b0' : '#e63946'
  draw(cv, x, 0, frame(MOUSE, t >> 1), { K: '#1b1b1b', Y: '#ffd60a', R: cheek })
  // Thunderbolts strike ahead now and then; often while a tool runs.
  const every = act === 'tool' ? 12 : 30
  const strike = mod(t, every)
  if (strike < 3) {
    const bx = Math.floor(noise(Math.floor(t / every)) * (w - 10)) + 5
    const bolt = ['..Y', '.YY', 'YY.', '.YY', 'YY.', 'Y..']
    draw(cv, bx, 0, bolt, { Y: strike === 0 ? '#ffffff' : '#ffd60a' })
  }
  const g = cells(cv)
  if (act === 'tool' && mod(t, 4) < 2) put(g, x + 9, 0, 'ϟ', { c: '#ffd60a', b: true })
  return g
}

const ROBOCAT = [
  ['..PPPPP..', '.BBBBBBB.', 'BBWWBWWBB', 'BWKWRWKWB', 'BBWWWWWBB', '.BRRYRRB.'],
  ['....P....', '.BBBBBBB.', 'BBWWBWWBB', 'BWKWRWKWB', 'BBWWWWWBB', '.BRRYRRB.'],
]
const GADGETS = ['#ff8fab', '#ffd60a', '#80ffdb', '#c77dff', '#f4a261']

function bluecatScene(t: number, w: number, act: Act): Grid {
  const cv = canvas(w, 3)
  for (let i = 0; i < 4; i++) {
    const cx = mod(Math.floor(noise(i) * w) - Math.floor(t * 0.3), w + 8) - 4
    draw(cv, cx, 1 + (i % 3), ['.WW.', 'WWWW'], { W: '#2b2d42' })
  }
  const lap = w + 9
  const x = mod(Math.floor(t * 0.4), lap) - 9
  // Gadgets tumble out of the pocket while a tool runs.
  if (act === 'tool') {
    for (let i = 0; i < 4; i++) {
      const age = mod(t + i * 5, 20)
      plot(cv, x - 1 - age, 3 + Math.round(Math.sin(age * 0.6 + i)), frame(GADGETS, i + (Math.floor(t / 20) % 5)))
      plot(cv, x - 3 - age, 3 + Math.round(Math.sin(age * 0.6 + i)), frame(GADGETS, i + (Math.floor(t / 20) % 5)))
    }
  }
  draw(cv, x, 0, frame(ROBOCAT, t), { P: '#d4a373', B: '#0096c7', W: '#ffffff', K: '#1b1b1b', R: '#e63946', Y: '#ffd60a' })
  return cells(cv)
}

const NYAN = ['TTTTTT.....', 'TPPSPTG..G.', 'TPSPPTGGGG.', 'TPPPSTGKGKG', 'TTTTTTGGGG.', '.L..L..L.L.']
const RAINBOW = ['#ff0000', '#ff9900', '#ffff00', '#33ff00', '#0099ff', '#6633ff']

function nyanScene(t: number, w: number): Grid {
  const cv = canvas(w, 3)
  const x = Math.floor(w * 0.45) + Math.round(Math.sin(t * 0.15) * 3)
  for (let i = 0; i < 6; i++) {
    const sx = mod(Math.floor(noise(i + 40) * w) - t * 2, w)
    if (sx > x + 11) {
      const twinkle = mod(t + i, 4)
      plot(cv, sx, Math.floor(noise(i + 3) * 6), twinkle < 2 ? '#ffffff' : '#8d99ae')
      if (twinkle === 1) {
        plot(cv, sx - 1, Math.floor(noise(i + 3) * 6), '#8d99ae')
        plot(cv, sx + 1, Math.floor(noise(i + 3) * 6), '#8d99ae')
      }
    }
  }
  for (let tx = 0; tx < x + 1; tx++) {
    const wave = mod(Math.floor((tx - t) / 4), 2)
    for (let y = 0; y < 6; y++) plot(cv, tx, y + wave - 0, RAINBOW[y]!)
  }
  draw(cv, x, 0, NYAN.map((row, j) => (j === 5 ? (mod(t, 2) ? row : row.replace(/L\.\.L/g, '.L.L.').slice(0, row.length)) : row)), {
    T: '#ffcc99',
    P: '#ff99cc',
    S: '#ff3399',
    G: '#999999',
    K: '#1b1b1b',
    L: '#999999',
  })
  return cells(cv)
}

// ---- themes --------------------------------------------------------------

export const THEMES: Record<ThemeName, Theme> = {
  cat: {
    name: 'cat',
    rows: 2,
    sleep: '(=－ω－=) zZ',
    color: '#ffb3c6',
    accent: '#ffd166',
    sprite: {
      think: ['(=^･ω･^=)   ', '(=^･ω･^=) ? ', '(=^-ω-^=) ? ', '(=^･ω･^=) ?!'],
      tool: ['ฅ(=^･ω･^=) ', ' (=^･ω･^=)ฅ', 'ฅ(=^･ω･^=)ฅ'],
      say: ['(=^･ω･^=)ﾉ ♪', '(=^･ω･^=)ﾉ  ♫', '(=^▽^=)ﾉ ♪'],
      wait: ['(=^･ω･^=) .  ', '(=^･ω･^=) .. ', '(=^･ω･^=) ...'],
    },
    happy: '(=^▽^=)ﾉ',
    sad: '(=；ω；=)',
    dead: '(=×ω×=)',
    confetti: ['✿', '♡', '*', '·', '✦'],
    palette: ['#ffb3c6', '#ffd166', '#cdb4db', '#a2d2ff', '#ff8fab'],
    scene: catScene,
  },
  bunny: {
    name: 'bunny',
    rows: 2,
    sleep: '૮ ˶- ᴗ -˶ ა zZ',
    color: '#f1faee',
    accent: '#ff9f1c',
    sprite: {
      think: ['૮ ˶• ᴗ •˶ ა  ', '૮ ˶- ᴗ -˶ ა ?', '૮ ˶• ᴗ •˶ ა ?'],
      tool: ['૮ ˶ᵔ ᵕ ᵔ˶ ა ɣ', '૮ ˶ᵔ ᵕ ᵔ˶ აɣ ', '૮ ˶ᵔ ᵕ ᵔ˶ ა  '],
      say: ['૮ ˶ᵔ ᵕ ᵔ˶ ა ♪', '૮ ˶ᵔ ᵕ ᵔ˶ ა ♫'],
      wait: ['૮ ˶• ᴗ •˶ ა .  ', '૮ ˶• ᴗ •˶ ა .. ', '૮ ˶• ᴗ •˶ ა ...'],
    },
    happy: '૮ ˶ᵔ ᵕ ᵔ˶ ა',
    sad: '૮ ˶; ﹏ ;˶ ა',
    dead: '૮ ˶x ﹏ x˶ ა',
    confetti: ['ɣ', '*', '·', '✦', '"'],
    palette: ['#ff9f1c', '#80b918', '#f1faee', '#ffbf69'],
    scene: bunnyScene,
  },
  sakura: {
    name: 'sakura',
    rows: 2,
    sleep: '(˶- ᵕ -˶) zZ',
    color: '#ff8fab',
    accent: '#ffc2d1',
    sprite: {
      think: ['✿ (˶ᵔ ᵕ ᵔ˶)', '❀ (˶ᵔ ᵕ ᵔ˶)?', '❁ (˶- ᵕ -˶)?'],
      tool: ['✿ (˶•ᴗ•˶)و ', '❀ (˶•ᴗ•˶)و✧'],
      say: ['✿ (˶ᵔ ᵕ ᵔ˶) ♪', '❀ (˶ᵔ ᵕ ᵔ˶) ♫'],
      wait: ['✿ (˶ᵔ ᵕ ᵔ˶) .  ', '❀ (˶ᵔ ᵕ ᵔ˶) .. ', '❁ (˶ᵔ ᵕ ᵔ˶) ...'],
    },
    happy: '(˶ᵔ ᵕ ᵔ˶)✿',
    sad: '(˶; ᴗ ;˶)',
    dead: '(˶x ᴗ x˶)',
    confetti: ['✿', '❀', '❁', '✾', '·'],
    palette: ['#ffb7c5', '#ff8fab', '#fb6f92', '#ffe5ec'],
    scene: sakuraScene,
  },
  mecha: {
    name: 'mecha',
    rows: 2,
    sleep: '[-_-] zZ',
    color: '#4cc9f0',
    accent: '#f72585',
    sprite: {
      think: ['[◉_◉] ▖', '[◉_◉] ▘', '[◉_◉] ▝', '[◉_◉] ▗'],
      tool: ['[◉_◉]⊃━   ', '[◉_◉]⊃━━  ', '[◉_◉]⊃━━━☆'],
      say: ['[◕‿◕] ▸  ', '[◕‿◕] ▸▸ ', '[◕‿◕] ▸▸▸'],
      wait: ['[○_○] ·  ', '[◎_◎] ·· ', '[◉_◉] ···'],
    },
    happy: '[◕‿◕]b',
    sad: '[╥_╥]',
    dead: '[×_×]',
    confetti: ['✶', '✦', '+', '·', '◆'],
    palette: ['#4cc9f0', '#f72585', '#ffd60a', '#4361ee'],
    scene: mechaScene,
  },
  neon: {
    name: 'neon',
    rows: 2,
    sleep: '◢◤ zZ',
    color: '#f72585',
    accent: '#4cc9f0',
    isRainbow: true,
    sprite: {
      think: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'].map(c => `${c} ◢◤◢◤`),
      tool: ['▰▱▱▱▱', '▰▰▱▱▱', '▱▰▰▱▱', '▱▱▰▰▱', '▱▱▱▰▰', '▱▱▱▱▰'],
      say: ['▁▃▅▇▅▃', '▃▅▇▅▃▁', '▅▇▅▃▁▃', '▇▅▃▁▃▅', '▅▃▁▃▅▇', '▃▁▃▅▇▅'],
      wait: ['◐ ◆', '◓ ◇', '◑ ◆', '◒ ◇'],
    },
    happy: '✦ ◢◤ ✦',
    sad: '▁▁▁',
    dead: '✕ ◢◤ ✕',
    confetti: ['✦', '✧', '+', '·', '◆'],
    palette: ['#f72585', '#b5179e', '#7209b7', '#4cc9f0', '#ffd60a'],
    scene: neonScene,
  },
  dino: {
    name: 'dino',
    rows: 2,
    sleep: 'ᕕ(-ᐛ-)ᕗ zZ',
    color: '#e9c46a',
    accent: '#2a9d8f',
    sprite: {
      think: ['ᕕ(ᐛ)ᕗ   ', 'ᕕ(ᐛ)ᕗ ? ', 'ᕕ( ᐛ)ᕗ ?'],
      tool: ['ᕕ(ᐛ)ᕗ  ψ', 'ᕕ(ᐛ)ᕗ ψ ', ' ᕕ(ᐛ)ᕗψ '],
      say: ['ᕕ(ᐛ)ᕗ ε=', 'ᕕ(ᐛ)ᕗε=ε='],
      wait: ['ᕕ(ᐛ)ᕗ .  ', 'ᕕ(ᐛ)ᕗ .. ', 'ᕕ(ᐛ)ᕗ ...'],
    },
    happy: 'ヽ(ᐛ)ノ',
    sad: '(ᐛ；)',
    dead: '(×ᐛ×)',
    confetti: ['ψ', '*', '+', '·', '✦'],
    palette: ['#e9c46a', '#2a9d8f', '#f4a261', '#e76f51'],
    scene: dinoScene,
  },
  ocean: {
    name: 'ocean',
    rows: 2,
    sleep: '><(((-> zZ',
    color: '#ffb703',
    accent: '#48cae4',
    sprite: {
      think: ['><(((º>   ', '><(((º> o ', '><(((º>  °'],
      tool: ['><(((º>~  ', '><(((º>≈≈ ', '><(((º>~≈~'],
      say: ['><(((º> ♪', '><(((º>  ♫'],
      wait: ['><(((º> .  ', '><(((º> .. ', '><(((º> ...'],
    },
    happy: '><(((º> ♪',
    sad: '><(((;>',
    dead: '><(((×>',
    confetti: ['°', 'o', '~', '≈', '·'],
    palette: ['#48cae4', '#caf0f8', '#ffb703', '#fb8500'],
    scene: oceanScene,
  },
  matrix: {
    name: 'matrix',
    rows: 2,
    sleep: '⟦IDLE⟧',
    color: '#52b788',
    accent: '#d8f3dc',
    sprite: {
      think: ['ｱ1ｳ0', '1ｳ0ｶ', 'ｳ0ｶ1', '0ｶ1ｱ'].map(s => `⟦${s}⟧`),
      tool: ['⟦▓▒░ ⟧', '⟦ ▓▒░⟧', '⟦░ ▓▒⟧', '⟦▒░ ▓⟧'],
      say: ['⟦>_  ⟧', '⟦>_▌ ⟧', '⟦>__▌⟧'],
      wait: ['⟦·   ⟧', '⟦··  ⟧', '⟦··· ⟧'],
    },
    happy: '⟦ OK ⟧',
    sad: '⟦ ^C ⟧',
    dead: '⟦ERR!⟧',
    confetti: ['ｱ', '0', '1', 'ﾊ', '·'],
    palette: ['#52b788', '#d8f3dc', '#2d6a4f', '#95d5b2'],
    scene: matrixScene,
  },  clawd: {
    name: 'clawd',
    rows: 3,
    color: CLAUDE,
    accent: '#e9b49a',
    sprite: {
      think: ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'].map(s => `▐▛█▜▌ ${s}`),
      tool: ['▐▛█▜▌▭▭', '▐▛█▜▌▬▭', '▐▛█▜▌▭▬'],
      say: ['▐▛█▜▌ ✎  ', '▐▛█▜▌ ✎· ', '▐▛█▜▌ ✎··'],
      wait: ['▐▛█▜▌ .  ', '▐▛█▜▌ .. ', '▐▛█▜▌ ...'],
    },
    happy: '▐▛█▜▌ ✻',
    sad: '▐▀█▀▌',
    dead: '▐x█x▌',
    sleep: '▐▄█▄▌ zZ',
    confetti: ['✻', '✶', '✳', '·', '✢'],
    palette: [CLAUDE, '#e9b49a', '#f5e6d3', '#c15f3c'],
    scene: clawdScene,
  },
  thunder: {
    name: 'thunder',
    rows: 3,
    color: '#4cc9f0',
    accent: '#ffd60a',
    sprite: {
      think: ['=▷ ·    ', '=▷  ·   ', '=▷   ·  ', '=▷    · '],
      tool: ['=▷━   ◆', '=▷ ━  ◆', '=▷  ━ ◆', '=▷    ✶'],
      say: ['=▷ ⁘ ⁘ ', '=▷⁘ ⁘ ⁘'],
      wait: ['=▷ .  ', '=▷ .. ', '=▷ ...'],
    },
    happy: '=▷ ✶✶✶',
    sad: '=▷ ...',
    dead: '=▷ ✕',
    sleep: '=▷ zZ',
    confetti: ['✶', '✦', '+', '·', '◆'],
    palette: ['#4cc9f0', '#ffd60a', '#f72585', '#ff9f1c'],
    scene: thunderScene,
  },
  chomp: {
    name: 'chomp',
    rows: 3,
    color: '#ffd60a',
    accent: '#ff595e',
    sprite: {
      think: ['ᗧ • • •', '● • • •'],
      tool: ['ᗧ•••  ᗣ', '●••  ᗣ ', 'ᗧ•  ᗣ  ', '● ᗣ    '],
      say: ['ᗧ ♪ ', '●  ♫'],
      wait: ['ᗧ .  ', '● .. ', 'ᗧ ...'],
    },
    happy: 'ᗧ ᗣᗣᗣ',
    sad: 'ᗣ ᗧ',
    dead: '✕ᗧ✕',
    sleep: 'ᗧ zZ',
    confetti: ['•', '●', '·', 'ᗣ', '+'],
    palette: ['#ffd60a', '#ff595e', '#ffafcc', '#00f5d4', '#ff9f1c'],
    scene: chompScene,
  },
  sparky: {
    name: 'sparky',
    rows: 3,
    color: '#ffd60a',
    accent: '#e63946',
    sprite: {
      think: ['ϟ(•ᴥ•)  ', 'ϟ(•ᴥ•) ?', ' (•ᴥ•)ϟ?'],
      tool: ['ϟϟ(>ᴥ<)ϟϟ', ' ϟ(>ᴥ<)ϟ '],
      say: ['(•ᴥ•)ﾉϟ ', '(•ᴥ•)ﾉ ϟ'],
      wait: ['(•ᴥ•) .  ', '(•ᴥ•) .. ', '(•ᴥ•) ...'],
    },
    happy: 'ϟ(^ᴥ^)ϟ',
    sad: '(;ᴥ;)',
    dead: '(×ᴥ×)',
    sleep: '(-ᴥ-) zZ',
    confetti: ['ϟ', '✦', '*', '·', '+'],
    palette: ['#ffd60a', '#e63946', '#fff3b0', '#c68b59'],
    scene: sparkyScene,
  },
  bluecat: {
    name: 'bluecat',
    rows: 3,
    color: '#00b4d8',
    accent: '#e63946',
    sprite: {
      think: ['⊂(◉‿◉)つ  ', '⊂(◉‿◉)つ ?', '⊂(◔‿◔)つ ?'],
      tool: ['⊂(◉‿◉)つ✦  ', '⊂(◉‿◉)つ ✧ ', '⊂(◉‿◉)つ  ✦'],
      say: ['⊂(◕‿◕)つ ♪', '⊂(◕‿◕)つ ♫'],
      wait: ['⊂(◉‿◉)つ .  ', '⊂(◉‿◉)つ .. ', '⊂(◉‿◉)つ ...'],
    },
    happy: '⊂(◕‿◕)つ',
    sad: '⊂(╥﹏╥)つ',
    dead: '⊂(×﹏×)つ',
    sleep: '⊂(－‿－)つ zZ',
    confetti: ['✦', '✧', '●', '·', '+'],
    palette: ['#00b4d8', '#e63946', '#ffd60a', '#ffffff'],
    scene: bluecatScene,
  },
  nyan: {
    name: 'nyan',
    rows: 3,
    color: '#ff99cc',
    accent: '#999999',
    isRainbow: true,
    sprite: {
      think: ['~=[,,_,,]:3', '=~[,,_,,]:3'],
      tool: ['~=[,,_,,]:3 *', '=~[,,_,,]:3 +'],
      say: ['~=[,,o,,]:3', '=~[,,_,,]:3'],
      wait: ['~=[,,_,,]:3 .  ', '=~[,,_,,]:3 .. ', '~=[,,_,,]:3 ...'],
    },
    happy: '~=[,,^,,]:3',
    sad: '~=[,,;,,]:3',
    dead: '~=[,,x,,]:3',
    sleep: '~=[,,-,,]:3 zZ',
    confetti: ['*', '+', '·', '✦', '✧'],
    palette: RAINBOW,
    scene: nyanScene,
  },
}

export function themeOf(name: unknown): Theme {
  return isThemeName(name) ? THEMES[name] : THEMES.clawd
}

// ---- finale --------------------------------------------------------------

/** After a turn: a burst of the theme's confetti around its mascot and the label. */
export function finaleScene(theme: Theme, kind: Finale, label: string, t: number, w: number): Grid {
  const rows = theme.rows
  const g = blank(w, rows)
  const face = kind === 'answer' ? theme.happy : kind === 'aborted' ? theme.sad : theme.dead
  const text = `${face}  ${label}`
  const tw = textWidth(text)
  const cx = Math.floor(w / 2)
  const left = Math.max(0, cx - Math.floor(tw / 2))
  const mid = Math.floor(rows / 2)

  if (kind === 'answer') {
    const count = Math.min(40 * rows / 2, Math.max(12, Math.floor((w / 3) * rows / 2)))
    for (let i = 0; i < count; i++) {
      const dir = noise(i) < 0.5 ? -1 : 1
      const speed = 0.8 + noise(i + 9) * 2.2
      const reach = Math.min(t, 18) * speed
      const x = cx + dir * (tw / 2 + reach + noise(i + 4) * 3)
      const y = Math.floor(noise(i + 2) * rows)
      const isFading = t > 18 + noise(i + 6) * 8
      put(g, x, y, frame(theme.confetti, i + (t >> 2)), { c: frame(theme.palette, i), d: isFading })
    }
  } else if (kind === 'aborted') {
    for (let x = 0; x < w; x += 4) put(g, mod(x + (t >> 1), w), mod(x, rows), '·', { c: '#6c757d', d: true })
  } else {
    for (let x = 0; x < w; x++) if (noise(x + t) < 0.08) put(g, x, mod(x, rows), frame(['▚', '▞', '░'], x + t), { c: '#e63946', d: true })
  }

  const style: Style = kind === 'answer' ? { c: theme.color, b: true } : kind === 'aborted' ? { c: '#adb5bd' } : { c: '#e63946', b: true }
  const flicker = kind === 'error' && mod(t, 6) === 0
  put(g, left - 1, mid, ' '.repeat(tw + 2))
  if (!flicker) put(g, left, mid, text, style)
  return g
}

// ---- companion -----------------------------------------------------------

/** What the companion row shows: the turn's act while it runs, else the mood. */
export type PetView = {
  state: Act | Mood
  /** The bubble beside the mascot, already in the person's language. */
  bubble: string
  /** `Lv.3 ♥12`. */
  stats: string
}

const BUBBLE: Partial<Record<Act | Mood, Style>> = {
  ask: { c: '#ffd166', b: true },
  error: { c: '#e63946' },
  aborted: { c: '#adb5bd' },
  sleep: { c: '#6c757d', d: true },
}

/** One row: the mascot in its current mood, its bubble, its level and affection; hearts after a pat. */
export function petRow(theme: Theme, pet: PetView, t: number, w: number, hearts: number): Grid {
  const g = blank(w, 1)
  const s = pet.state
  let face: string
  if (s === 'think' || s === 'tool' || s === 'say' || s === 'wait' || s === 'ask') {
    const frames = theme.sprite[poseOf(s)]
    face = padTo(frame(frames, t), Math.max(...frames.map(textWidth)))
  } else {
    face = s === 'error' ? theme.dead : s === 'aborted' ? theme.sad : s === 'sleep' ? theme.sleep : theme.happy
  }
  const faceStyle = (i: number): Style =>
    theme.isRainbow ? { c: hsl((i * 40 + t * 24) % 360, 0.95, 0.62), b: true } : { c: theme.color, b: true }
  let x = 0
  Array.from(face).forEach((ch, i) => {
    put(g, x, 0, ch, faceStyle(i))
    x += textWidth(ch)
  })
  x += 1
  if (hearts > 0) {
    put(g, x, 0, frame(['♡', '♥', '♡ ♥', '♥ ♡'], hearts), { c: '#ff8fab', b: true })
    x += 4
  }
  if (pet.bubble) put(g, x, 0, `${s === 'ask' ? '❯ ' : '· '}${pet.bubble}`, BUBBLE[s] ?? { c: '#b8b8be' })
  put(g, w - textWidth(pet.stats) - 1, 0, pet.stats, { c: '#6c757d' })
  return g
}
