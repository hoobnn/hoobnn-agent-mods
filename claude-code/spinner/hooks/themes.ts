// Frame tables and scenes, shared by the hooks module and both surface modules
// (sprite.tsx draws the spinner's mascot, stage.tsx the band's scene). Pure:
// everything here is a function of the theme, the tick and the width.

export const THEME_NAMES = ['cat', 'bunny', 'sakura', 'mecha', 'neon', 'dino', 'ocean', 'matrix'] as const
export type ThemeName = (typeof THEME_NAMES)[number]

export type Mode = 'requesting' | 'responding' | 'thinking' | 'tool-input' | 'tool-use'
export type Pose = 'think' | 'tool' | 'say' | 'wait'
export type Finale = 'answer' | 'aborted' | 'error'

export type Style = { c?: string; b?: boolean; d?: boolean }
export type Cell = Style & { ch: string }
export type Seg = Style & { text: string }
export type Grid = Cell[][]

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
  /** Particles of the finale's burst, and their colors. */
  confetti: string[]
  palette: string[]
  /** The band's scene while a turn runs: STAGE_ROWS rows of `w` cells. */
  scene: (t: number, w: number) => Grid
}

export const STAGE_ROWS = 2
/** Milliseconds per frame: the mascot's, the band's. */
export const SPRITE_MS = 140
export const STAGE_MS = 100
/** How long the finale stays after a turn ends. */
export const FINALE_MS = 3000

export function poseOf(mode: string): Pose {
  if (mode === 'thinking') return 'think'
  if (mode === 'tool-use' || mode === 'tool-input') return 'tool'
  if (mode === 'responding') return 'say'
  return 'wait'
}

export function isThemeName(name: unknown): name is ThemeName {
  return typeof name === 'string' && (THEME_NAMES as readonly string[]).includes(name)
}

// ---- cells ---------------------------------------------------------------

/** Cells a code point takes: CJK, fullwidth forms and emoji two, the rest one. */
function cpWidth(cp: number): number {
  if (cp < 0x1100) return 1
  if (
    (cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1faff) ||
    (cp >= 0x20000 && cp <= 0x3fffd)
  ) {
    return 2
  }
  return 1
}

export function textWidth(text: string): number {
  let w = 0
  for (const ch of text) w += cpWidth(ch.codePointAt(0)!)
  return w
}

/** `text` padded with spaces to `w` cells. */
export function padTo(text: string, w: number): string {
  return text + ' '.repeat(Math.max(0, w - textWidth(text)))
}

export function blank(w: number, h = STAGE_ROWS): Grid {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => ({ ch: ' ' })))
}

/** Writes `text` at column `x` of row `y`, clipped to the grid; a wide character takes two cells. */
export function put(g: Grid, x: number, y: number, text: string, style: Style = {}): void {
  const row = g[y]
  if (!row) return
  let col = Math.round(x)
  for (const ch of text) {
    const w = cpWidth(ch.codePointAt(0)!)
    if (col >= 0 && col + w <= row.length) {
      // A wide character left half-covered would shift the rest of the row.
      if (row[col]!.ch === '' && col > 0) row[col - 1] = { ch: ' ' }
      row[col] = { ch, ...style }
      if (w === 2) row[col + 1] = { ch: '' }
      else if (col + 1 < row.length && row[col + 1]!.ch === '') row[col + 1] = { ch: ' ' }
    }
    col += w
  }
}

/** A row as runs of one style each, what a Text per run draws. */
export function segments(row: Cell[]): Seg[] {
  const out: Seg[] = []
  for (const cell of row) {
    // The right half of a wide character: drawn by its left half.
    if (cell.ch === '') continue
    const last = out[out.length - 1]
    if (last && last.c === cell.c && !!last.b === !!cell.b && !!last.d === !!cell.d) last.text += cell.ch
    else out.push({ text: cell.ch, c: cell.c, b: cell.b || undefined, d: cell.d || undefined })
  }
  return out
}

// ---- numbers -------------------------------------------------------------

/** A fixed pseudo-random number in [0, 1) for each `n`. */
export function noise(n: number): number {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453
  return s - Math.floor(s)
}

const mod = (n: number, m: number) => ((n % m) + m) % m

export function hsl(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = mod(n + h / 30, 12)
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(v * 255).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

export function frame<T>(frames: readonly T[], t: number): T {
  return frames[mod(t, frames.length)]!
}

// ---- scenes --------------------------------------------------------------

function catScene(t: number, w: number): Grid {
  const g = blank(w)
  for (let x = 0; x < w; x++) {
    const n = noise(x + 1000 * Math.floor((x + t) / w))
    if (mod(x + t, 7) === 0) put(g, x, 1, n < 0.5 ? '˙' : ',', { c: '#7fb069', d: true })
  }
  const lap = w + 16
  const cx = mod(Math.floor(t * 0.6), lap) - 12
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
  const g = blank(w)
  for (let x = 0; x < w; x++) {
    if (mod(x * 7 + 3, 11) === 0) put(g, x, 1, '"', { c: '#80b918', d: true })
  }
  const lap = w + 14
  const bx = mod(Math.floor(t * 0.5), lap) - 10
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
  const g = blank(w)
  const pinks = ['#ffb7c5', '#ff8fab', '#fb6f92', '#ffc2d1', '#ffe5ec']
  const count = Math.max(6, Math.floor(w / 5))
  const gust = Math.sin(t * 0.05) * 0.4
  for (let i = 0; i < count; i++) {
    const speed = 0.25 + noise(i) * 0.45 + gust
    const x = mod(noise(i + 7) * w - t * speed + Math.sin(t * 0.2 + i) * 1.5, w)
    const y = mod(Math.floor(t * (0.05 + noise(i + 3) * 0.08) + i), STAGE_ROWS)
    put(g, x, y, frame(['✿', '❀', '❁', '✾', '·'], i + (t >> 3)), { c: frame(pinks, i) })
  }
  const walker = mod(Math.floor(t * 0.2), w + 12) - 10
  put(g, walker, 1, frame(['(˶ᵔ ᵕ ᵔ˶)', '(˶ᵔ ᵕ ᵔ˶)~'], t >> 3), { c: '#ffafcc', b: true })
  return g
}

function mechaScene(t: number, w: number): Grid {
  const g = blank(w)
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
  const g = blank(w)
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
  const g = blank(w)
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
  const g = blank(w)
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
  const g = blank(w)
  const glyphs = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ0123456789ﾊﾋﾌﾍﾎ'
  for (let x = 0; x < w; x++) {
    const speed = 1 + Math.floor(noise(x) * 3)
    const head = mod(Math.floor(t / speed) + Math.floor(noise(x + 50) * 20), 14)
    for (let y = 0; y < STAGE_ROWS; y++) {
      const age = head - y
      if (age < 0 || age > 6) continue
      const ch = glyphs[Math.floor(noise(x * 31 + y + Math.floor(t / 3)) * glyphs.length)]!
      put(g, x, y, ch, age === 0 ? { c: '#d8f3dc', b: true } : { c: age < 3 ? '#52b788' : '#2d6a4f', d: age >= 3 })
    }
  }
  return g
}

// ---- themes --------------------------------------------------------------

export const THEMES: Record<ThemeName, Theme> = {
  cat: {
    name: 'cat',
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
  },
}

export function themeOf(name: unknown): Theme {
  return isThemeName(name) ? THEMES[name] : THEMES.cat
}

// ---- finale --------------------------------------------------------------

/** After a turn: a burst of the theme's confetti around its mascot and the label. */
export function finaleScene(theme: Theme, kind: Finale, label: string, t: number, w: number): Grid {
  const g = blank(w)
  const face = kind === 'answer' ? theme.happy : kind === 'aborted' ? theme.sad : theme.dead
  const text = `${face}  ${label}`
  const tw = textWidth(text)
  const cx = Math.floor(w / 2)
  const left = Math.max(0, cx - Math.floor(tw / 2))

  if (kind === 'answer') {
    const count = Math.min(40, Math.max(12, Math.floor(w / 3)))
    for (let i = 0; i < count; i++) {
      const dir = noise(i) < 0.5 ? -1 : 1
      const speed = 0.8 + noise(i + 9) * 2.2
      const reach = Math.min(t, 18) * speed
      const x = cx + dir * (tw / 2 + reach + noise(i + 4) * 3)
      const y = noise(i + 2) < 0.5 ? 0 : 1
      const isFading = t > 18 + noise(i + 6) * 8
      put(g, x, y, frame(theme.confetti, i + (t >> 2)), { c: frame(theme.palette, i), d: isFading })
    }
  } else if (kind === 'aborted') {
    for (let x = 0; x < w; x += 4) put(g, mod(x + (t >> 1), w), mod(x, 2), '·', { c: '#6c757d', d: true })
  } else {
    for (let x = 0; x < w; x++) if (noise(x + t) < 0.08) put(g, x, mod(x, 2), frame(['▚', '▞', '░'], x + t), { c: '#e63946', d: true })
  }

  const style: Style = kind === 'answer' ? { c: theme.color, b: true } : kind === 'aborted' ? { c: '#adb5bd' } : { c: '#e63946', b: true }
  const flicker = kind === 'error' && mod(t, 6) === 0
  put(g, left - 1, 1, ' '.repeat(tw + 2))
  if (!flicker) put(g, left, 1, text, style)
  return g
}
