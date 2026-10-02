// claude-hud writes SGR escapes; the band draws Text elements. This turns a
// line of escapes into styled spans. An OSC 8 link to an https URL rides on
// its spans as `href`; any other link (file://) is dropped and its text kept,
// since a Link takes https only.
import type { Span } from '../types'

const BASIC = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']
const BRIGHT = ['gray', 'redBright', 'greenBright', 'yellowBright', 'blueBright', 'magentaBright', 'cyanBright', 'whiteBright']

type Style = Omit<Span, 'text'>

function extendedColor(codes: number[], i: number): { color?: string; used: number } {
  if (codes[i + 1] === 5 && codes[i + 2] !== undefined) {
    return { color: `ansi256(${codes[i + 2]})`, used: 2 }
  }
  if (codes[i + 1] === 2 && codes[i + 4] !== undefined) {
    const hex = [codes[i + 2], codes[i + 3], codes[i + 4]].map(n => (n ?? 0).toString(16).padStart(2, '0')).join('')
    return { color: `#${hex}`, used: 4 }
  }
  return { used: 0 }
}

function applySgr(style: Style, params: string): Style {
  const codes = params === '' ? [0] : params.split(';').map(p => Number.parseInt(p || '0', 10))
  let next: Style = { ...style }
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i]!
    if (code === 0) next = {}
    else if (code === 1) next.bold = true
    else if (code === 2) next.dimColor = true
    else if (code === 3) next.italic = true
    else if (code === 4) next.underline = true
    else if (code === 7) next.inverse = true
    else if (code === 9) next.strikethrough = true
    else if (code === 22) {
      delete next.bold
      delete next.dimColor
    } else if (code === 23) delete next.italic
    else if (code === 24) delete next.underline
    else if (code === 27) delete next.inverse
    else if (code === 29) delete next.strikethrough
    else if (code >= 30 && code <= 37) next.color = BASIC[code - 30]
    else if (code >= 90 && code <= 97) next.color = BRIGHT[code - 90]
    else if (code === 39) delete next.color
    else if (code >= 40 && code <= 47) next.backgroundColor = BASIC[code - 40]
    else if (code >= 100 && code <= 107) next.backgroundColor = BRIGHT[code - 100]
    else if (code === 49) delete next.backgroundColor
    else if (code === 38 || code === 48) {
      const { color, used } = extendedColor(codes, i)
      if (color) {
        if (code === 38) next.color = color
        else next.backgroundColor = color
      }
      i += used
    }
  }
  return next
}

const ESCAPE = /\x1b\[([0-9;]*)m|\x1b\]8;[^;\x07\x1b]*;([^\x07\x1b]*)(?:\x07|\x1b\\)|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|[\x00-\x08\x0b-\x1f\x7f]/g

export function parseAnsi(line: string): Span[] {
  const spans: Span[] = []
  let style: Style = {}
  let last = 0
  const push = (text: string) => {
    if (!text) return
    const prev = spans[spans.length - 1]
    if (prev && JSON.stringify({ ...prev, text: '' }) === JSON.stringify({ ...style, text: '' })) {
      prev.text += text
    } else {
      spans.push({ ...style, text })
    }
  }
  for (const match of line.matchAll(ESCAPE)) {
    push(line.slice(last, match.index))
    if (match[1] !== undefined) style = { ...applySgr(style, match[1]), ...(style.href ? { href: style.href } : {}) }
    else if (match[2] !== undefined) {
      const { href: _closed, ...rest } = style
      style = /^https:\/\//.test(match[2]) ? { ...rest, href: match[2] } : rest
    }
    last = (match.index ?? 0) + match[0].length
  }
  push(line.slice(last))
  return spans
}
