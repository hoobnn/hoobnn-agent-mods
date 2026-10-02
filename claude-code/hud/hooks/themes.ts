// Themes: a palette laid over claude-hud's colors, the glyphs it writes, and
// what the mod does to the drawn spans (separators, powerline segments,
// gradient bars, an anime mascot). Pure; register.tsx applies them.
//
// Width rules every theme keeps, since claude-hud fits its rows before the
// span effects run: a separator is no wider than ` │ `; glyphs are free to
// be wider (claude-hud measures them), but emoji are default-presentation
// ones only (no U+FE0F, which the renderer misjudges). Nerd Font glyphs
// (Private Use Area) stay in the `nerd` and `powerline` themes.
import type { HudLine, Span } from '../types'
import type { HudColorOverrides, HudConfig } from './hud/config.js'
import { DEFAULT_CONFIG } from './hud/config.js'
import type { Glyphs } from './hud/render/theme.js'

type Palette = Partial<HudColorOverrides>

/** How the mascot feels, from the session's gauges. */
export type Mood = 'calm' | 'busy' | 'worried' | 'panic' | 'out'

export type Theme = {
  name: string
  /** A few of its glyphs, for `/hud theme`'s list. */
  sample: string
  /** Shown only with a Nerd Font. */
  isNerdFont?: boolean
  palette: Palette
  glyphs: Partial<Glyphs>
  /** What ` │ ` and ` | ` between elements become, with its color. */
  separator?: { text: string; color?: string }
  /** The extras row: the summary's glyph and the colors of its parts. */
  extras?: { summary?: string; warning?: string; summaryColor?: string; forecastColor?: string; weekColor?: string; warningColor?: string }
  /** Each segment of a row on its own background, joined by `cap`. */
  powerline?: { backgrounds: string[]; cap: string }
  /** Filled bar cells (and the model badge) colored along this gradient. */
  gradient?: string[]
  /** A face in the extras row for each mood. */
  mascot?: Record<Mood, string>
}

const NO_EFFECTS = { palette: {}, glyphs: {} }

// Nerd Font symbols (Private Use Area), as escapes so an editor cannot drop them.
const NERD_GLYPHS: Partial<Glyphs> = {
  model: '\u{f06a9}', // nf-md-robot
  modelOpen: '',
  modelClose: '',
  project: '\uf07b', // nf-fa-folder
  gitOpen: '\ue725 ', // nf-dev-git_branch
  gitClose: '',
  worktree: '\uf1bb', // nf-fa-tree
  ahead: '⇡',
  behind: '⇣',
  duration: '\uf017', // nf-fa-clock_o
  running: '\uf110', // nf-fa-spinner
  done: '\uf00c', // nf-fa-check
  todo: '\uf0da', // nf-fa-caret_right
  warning: '\uf071', // nf-fa-warning
  pace: '\uf062', // nf-fa-arrow_up
  context: '\u{f035b}', // nf-md-memory
  usage: '\uf0e7', // nf-fa-bolt
  weekly: '\uf073', // nf-fa-calendar
  promptCache: '\uf1c0', // nf-fa-database
  cost: '\uf155', // nf-fa-dollar
}

export const THEMES: Theme[] = [
  { name: 'classic', sample: '[Opus] git:( ) ◐ ✓', ...NO_EFFECTS },
  {
    name: 'neon',
    sample: '⬢ ◈ ▰▱ ❯',
    palette: {
      model: '#00e5ff', project: '#ff2bd6', git: '#7a5cff', gitBranch: '#00e5ff', label: '#5c6b8a',
      context: '#39ff14', usage: '#00b3ff', warning: '#ffe600', usageWarning: '#ff7ae0', critical: '#ff1744',
      custom: '#ff9e00', barFilled: '▰', barEmpty: '▱',
    },
    glyphs: {
      model: '⬢', modelOpen: '', modelClose: '', project: '◆', gitOpen: '⎇ ', gitClose: '', worktree: '⧉',
      running: '◌', done: '◉', todo: '▶', context: '◈', usage: '⚡', weekly: '◷', promptCache: '◎', cost: '¤', duration: '◷',
    },
    separator: { text: ' ❯ ', color: '#7a5cff' },
    extras: { summary: '⌁', summaryColor: '#00e5ff', forecastColor: '#ff2bd6', weekColor: '#39ff14', warningColor: '#ffe600' },
  },
  {
    name: 'rainbow',
    sample: '✦ █▓▒ 🌈',
    palette: {
      model: '#ff5f6d', project: '#ffc371', git: '#a18cd1', gitBranch: '#7ee8fa', label: '#9a9a9a',
      context: '#38ef7d', usage: '#4facfe', warning: '#f9d423', usageWarning: '#f857a6', critical: '#ff0844', custom: '#fbc2eb',
    },
    glyphs: { model: '🌈', modelOpen: '', modelClose: '', project: '◉', gitOpen: '✧ ', gitClose: '', context: '✺', usage: '✹', weekly: '✷' },
    separator: { text: ' ✦ ', color: '#f857a6' },
    gradient: ['#ff0844', '#ff7a00', '#f9d423', '#38ef7d', '#00c6ff', '#7f5cff', '#f857a6'],
    extras: { summary: '✎', summaryColor: '#7ee8fa', forecastColor: '#f857a6', weekColor: '#f9d423' },
  },
  {
    name: 'emoji',
    sample: '🤖 📂 🌿 🧠 ⚡ ✅',
    palette: {},
    glyphs: {
      model: '🤖', modelOpen: '', modelClose: '', project: '📂', gitOpen: '🌿 ', gitClose: '', worktree: '🌳',
      ahead: '🔼', behind: '🔽', duration: '⌛', running: '⏳', done: '✅', todo: '👉', warning: '🚨', pace: '🔺',
      context: '🧠', usage: '⚡', weekly: '📅', promptCache: '💾', cost: '💰',
    },
    separator: { text: ' · ' },
    extras: { summary: '📝', warning: '🚨' },
  },
  {
    name: 'sakura',
    sample: '🌸 ✿✿· 💗 (◕‿◕)♡',
    palette: {
      model: '#ff8fab', project: '#c3a6ff', git: '#ffb3c6', gitBranch: '#ff8fab', label: '#b8a1b0',
      context: '#ffafcc', usage: '#cdb4db', warning: '#ffd166', usageWarning: '#f15bb5', critical: '#ef476f',
      custom: '#a2d2ff', barFilled: '✿', barEmpty: '·',
    },
    glyphs: {
      model: '🌸', modelOpen: '', modelClose: '', project: '🎀', gitOpen: '🍡 ', gitClose: '', running: '♪', done: '✿',
      todo: '♡', warning: '⚠', context: '💗', usage: '🍬', weekly: '🌙', promptCache: '🍵', duration: '⏰', cost: '🪙',
    },
    separator: { text: ' ✿ ', color: '#ffc8dd' },
    extras: { summary: '💌', summaryColor: '#ff8fab', forecastColor: '#c3a6ff', weekColor: '#ffafcc', warningColor: '#ef476f' },
    mascot: { calm: '(◕‿◕)♡', busy: '(๑•̀ㅂ•́)و✧', worried: '(・_・;)', panic: '(╥﹏╥)', out: '(×﹏×)' },
  },
  {
    name: 'kawaii',
    sample: '☆ ♪ ฅ^•ω•^ฅ',
    palette: {
      model: '#ffb5e8', project: '#b5deff', git: '#c5a3ff', gitBranch: '#ffccf9', label: '#a79aa8',
      context: '#aff8db', usage: '#b5b9ff', warning: '#fff5ba', usageWarning: '#ff9cee', critical: '#ff6f91',
      barFilled: '●', barEmpty: '○',
    },
    glyphs: {
      model: '☆', modelOpen: '「', modelClose: '」', project: '♬', gitOpen: '⌇ ', gitClose: '', running: '♪', done: '☆',
      todo: '→', context: 'ฅ', usage: '★', weekly: '☾',
    },
    separator: { text: ' ♡ ', color: '#ffccf9' },
    extras: { summary: '✐', summaryColor: '#ffb5e8', forecastColor: '#c5a3ff', weekColor: '#aff8db', warningColor: '#ff6f91' },
    mascot: { calm: 'ฅ^•ω•^ฅ', busy: '(ฅ`ω´ฅ)', worried: '(=ↀωↀ=)', panic: '(=ﾟДﾟ=)', out: '(=xωx=)' },
  },
  {
    name: 'mecha',
    sample: '◢◤ ▮▯ [•_•]',
    palette: {
      model: '#9b5cff', project: '#4cff00', git: '#ff7a00', gitBranch: '#4cff00', label: '#6c5f8d',
      context: '#4cff00', usage: '#ff7a00', warning: '#ffd400', usageWarning: '#ff7a00', critical: '#ff2a2a',
      custom: '#9b5cff', barFilled: '▮', barEmpty: '▯',
    },
    glyphs: {
      model: '◢', modelOpen: 'UNIT·', modelClose: '◤', project: '▣', gitOpen: '⌬ ', gitClose: '', running: '▶', done: '■',
      todo: '▷', warning: '◬', context: 'SYNC', usage: 'PWR', weekly: 'CORE', promptCache: 'LCL', duration: 'T+',
    },
    separator: { text: ' ┃ ', color: '#ff7a00' },
    extras: { summary: '◥', summaryColor: '#4cff00', forecastColor: '#ff7a00', weekColor: '#9b5cff', warningColor: '#ff2a2a' },
    mascot: { calm: '[•_•]', busy: '[ò_ó]ﾉ', worried: '[°_°;]', panic: '[◉Д◉]', out: '[×_×]' },
  },
  {
    name: 'shonen',
    sample: '🔥 🍥 💥 (ง •̀_•́)ง',
    palette: {
      model: '#ff4500', project: '#ffd700', git: '#ff8c00', gitBranch: '#ffd700', label: '#9c7b6b',
      context: '#ffb300', usage: '#ff6d00', warning: '#ffea00', usageWarning: '#ff3d00', critical: '#d50000',
      barFilled: '▰', barEmpty: '▱',
    },
    glyphs: {
      model: '🔥', modelOpen: '', modelClose: '', project: '⭐', gitOpen: '🍥 ', gitClose: '', running: '💥', done: '✊',
      todo: '➤', warning: '⚠', context: '🌀', usage: '💪', weekly: '🏯',
    },
    separator: { text: ' ➤ ', color: '#ff8c00' },
    gradient: ['#ffd700', '#ff8c00', '#ff4500', '#d50000'],
    extras: { summary: '📜', summaryColor: '#ffd700', forecastColor: '#ff6d00', weekColor: '#ffb300', warningColor: '#d50000' },
    mascot: { calm: '(ง •̀_•́)ง', busy: '٩(ˊᗜˋ*)و', worried: '(ಠ_ಠ)', panic: 'ヽ(`Д´)ﾉ', out: '(✖╭╮✖)' },
  },
  {
    name: 'tokyo-night',
    sample: '❖ ◆ │ ●○',
    palette: {
      model: '#7aa2f7', project: '#bb9af7', git: '#9ece6a', gitBranch: '#7dcfff', label: '#565f89',
      context: '#9ece6a', usage: '#7aa2f7', warning: '#e0af68', usageWarning: '#bb9af7', critical: '#f7768e', custom: '#ff9e64',
    },
    glyphs: { model: '❖', modelOpen: '', modelClose: '', project: '◆', gitOpen: '⑂ ', gitClose: '', running: '◔', done: '●' },
    separator: { text: ' │ ', color: '#3b4261' },
    extras: { summaryColor: '#7dcfff', forecastColor: '#bb9af7', weekColor: '#7aa2f7', warningColor: '#e0af68' },
  },
  {
    name: 'matrix',
    sample: '> ▮▯ ┊ 0x',
    palette: {
      model: '#00ff41', project: '#00ff41', git: '#008f11', gitBranch: '#00ff41', label: '#0d5c1d',
      context: '#00ff41', usage: '#00c732', warning: '#c8ff00', usageWarning: '#c8ff00', critical: '#ff3b3b',
      custom: '#008f11', barFilled: '▮', barEmpty: '▯',
    },
    glyphs: { model: '>', modelOpen: '', modelClose: '_', project: '~/', gitOpen: '@', gitClose: '', running: '»', done: '+', todo: '>' },
    separator: { text: ' ┊ ', color: '#0d5c1d' },
    extras: { summary: '#', summaryColor: '#00ff41', forecastColor: '#c8ff00', weekColor: '#00c732', warningColor: '#c8ff00' },
  },
  {
    name: 'nerd',
    sample: '\u{f06a9} \uf07b \ue725 \u{f035b} \uf0e7 \ue0b1',
    isNerdFont: true,
    palette: { model: '#89b4fa', project: '#f9e2af', git: '#f38ba8', gitBranch: '#a6e3a1', context: '#a6e3a1', usage: '#89dceb' },
    glyphs: NERD_GLYPHS,
    separator: { text: ' \ue0b1 ', color: '#585b70' },
    extras: { summary: '\uf044', warning: '\uf071' },
  },
  {
    name: 'powerline',
    sample: '\u{f06a9} \ue0b0 \ue725 \ue0b0 \u{f035b}',
    isNerdFont: true,
    palette: {
      model: '#89b4fa', project: '#f9e2af', git: '#f5c2e7', gitBranch: '#a6e3a1', label: '#a6adc8',
      context: '#a6e3a1', usage: '#89dceb', warning: '#f9e2af', usageWarning: '#fab387', critical: '#f38ba8',
    },
    glyphs: NERD_GLYPHS,
    powerline: { backgrounds: ['#313244', '#45475a', '#1e1e2e'], cap: '\ue0b0' },
    extras: { summary: '\uf044', warning: '\uf071' },
  },
]

export const THEME_NAMES = THEMES.map(t => t.name)

export function findTheme(name: unknown): Theme | undefined {
  return typeof name === 'string' ? THEMES.find(t => t.name === name.trim().toLowerCase()) : undefined
}

/**
 * The theme's palette over claude-hud's colors. A color the person set in
 * claude-hud's own config (anything off its default) stays theirs.
 */
export function applyPalette(config: HudConfig, theme: Theme): HudConfig {
  const colors: Record<string, unknown> = { ...config.colors }
  const defaults: Record<string, unknown> = { ...DEFAULT_CONFIG.colors }
  for (const [key, value] of Object.entries(theme.palette)) {
    if (colors[key] === defaults[key]) colors[key] = value
  }
  return { ...config, colors: colors as unknown as HudColorOverrides }
}

/** The mascot's mood: out of quota, then how full the context is, then whether a tool runs. */
export function moodOf(contextPercent: number | null | undefined, usagePercent: number | null | undefined, isBusy: boolean): Mood {
  if ((usagePercent ?? 0) >= 100) return 'out'
  const ctx = contextPercent ?? 0
  if (ctx >= 85) return 'panic'
  if (ctx >= 70 || (usagePercent ?? 0) >= 90) return 'worried'
  return isBusy ? 'busy' : 'calm'
}

const SEPARATOR = /^ [│|] $/

/** claude-hud's separators (dimSeparators splits them into spans of their own) become the theme's. */
function themeSeparators(row: HudLine, sep: NonNullable<Theme['separator']>): HudLine {
  return row.map(span => (SEPARATOR.test(span.text) ? { text: sep.text, ...(sep.color ? { color: sep.color } : { dimColor: true }) } : span))
}

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** The color at `t` (0-1) along the gradient's stops. */
export function gradientAt(stops: string[], t: number): string {
  if (stops.length === 1) return stops[0]!
  const at = Math.min(1, Math.max(0, t)) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(at))
  const [a, b] = [hexToRgb(stops[i]!), hexToRgb(stops[i + 1]!)]
  const f = at - i
  return `#${a.map((c, k) => Math.round(c + (b[k]! - c) * f).toString(16).padStart(2, '0')).join('')}`
}

/**
 * Filled bar cells in the context or usage color, and the model badge, colored
 * along the gradient. Warning and critical bars keep their color.
 */
function gradientSpans(row: HudLine, theme: Theme, stops: string[]): HudLine {
  const filled = theme.palette.barFilled ?? DEFAULT_CONFIG.colors.barFilled
  const empty = theme.palette.barEmpty ?? DEFAULT_CONFIG.colors.barEmpty
  const calm = new Set([theme.palette.context, theme.palette.usage].filter(Boolean))
  const out: HudLine = []
  row.forEach((span, i) => {
    const chars = [...span.text]
    const isBar = chars.length > 0 && chars.every(c => c === filled) && calm.has(span.color as string)
    const isModel = i === 0 && span.color === theme.palette.model && chars.length > 1
    if (!isBar && !isModel) {
      out.push(span)
      return
    }
    const next = row[i + 1]
    const width = isBar ? chars.length + (next && [...next.text].every(c => c === empty) ? [...next.text].length : 0) : chars.length
    chars.forEach((c, k) => out.push({ ...span, text: c, color: gradientAt(stops, width > 1 ? k / (width - 1) : 0) }))
  })
  return out
}

/**
 * Each separator-delimited segment on its own background, joined by the cap
 * (fg the left background, bg the right), ending in a cap. A separator
 * (` │ `, 3 cells) becomes ` ` ` ` (3 cells); the row grows by 2 cells.
 */
function powerlineSpans(row: HudLine, pl: NonNullable<Theme['powerline']>): HudLine {
  // A rule (the dim ─── line between the HUD's parts) stays as it is.
  if (row.every(span => /^[─\s]*$/.test(span.text))) return row
  const segments: HudLine[] = [[]]
  for (const span of row) {
    if (SEPARATOR.test(span.text)) segments.push([])
    else segments[segments.length - 1]!.push(span)
  }
  const kept = segments.filter(s => s.length > 0)
  const out: HudLine = []
  kept.forEach((segment, i) => {
    const bg = pl.backgrounds[i % pl.backgrounds.length]!
    const on = (s: Span): Span => ({ ...s, backgroundColor: bg })
    out.push(on({ text: ' ' }), ...segment.map(on), on({ text: ' ' }))
    const nextBg = i + 1 < kept.length ? pl.backgrounds[(i + 1) % pl.backgrounds.length] : undefined
    out.push(nextBg ? { text: pl.cap, color: bg, backgroundColor: nextBg } : { text: pl.cap, color: bg })
  })
  return out
}

/** Cells the span effects add to a row, so claude-hud and the extras row fit in what is left. */
export function themeOverhead(theme: Theme): number {
  return theme.powerline ? 2 : 0
}

/** The theme's span effects over every drawn row. */
export function applyTheme(rows: HudLine[], theme: Theme): HudLine[] {
  return rows.map(row => {
    let next = row
    if (theme.gradient) next = gradientSpans(next, theme, theme.gradient)
    if (theme.powerline) return powerlineSpans(next, theme.powerline)
    if (theme.separator) next = themeSeparators(next, theme.separator)
    return next
  })
}
