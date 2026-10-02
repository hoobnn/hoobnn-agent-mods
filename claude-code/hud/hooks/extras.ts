// What the mod adds to claude-hud's lines: alerts, a usage forecast, today's
// spend against a budget, the spend history, a git nag and the task summary.
// Pure helpers; register.tsx feeds them from `$` and draws the row.
import type { HudLine } from '../types'
import { textWidth } from './hud/render/ansi.js'
import { m, money } from './i18n.js'

/** "80, 90" → [80, 90]: whole percents in 1-100, ascending; empty turns alerts off. */
export function parseThresholds(spec: string): number[] {
  const values = spec
    .split(/[\s,]+/)
    .map(s => Number.parseInt(s, 10))
    .filter(n => Number.isFinite(n) && n >= 1 && n <= 100)
  return [...new Set(values)].sort((a, b) => a - b)
}

// A threshold fires again only once the percent has dropped this far below it
// (a /compact, a window reset), so the tick does not repeat a toast.
const REARM_BELOW = 5

/**
 * The thresholds `percent` stands at or past, given those already fired; `alert`
 * is the highest newly crossed one (null when none). Fired ones the percent
 * dropped well below are re-armed.
 */
export function crossThresholds(
  percent: number | null | undefined,
  thresholds: number[],
  fired: number[],
): { alert: number | null; fired: number[] } {
  if (percent === null || percent === undefined || !Number.isFinite(percent)) return { alert: null, fired }
  const kept = fired.filter(t => percent >= t - REARM_BELOW)
  const fresh = thresholds.filter(t => percent >= t && !kept.includes(t))
  return { alert: fresh.length > 0 ? fresh[fresh.length - 1]! : null, fired: [...kept, ...fresh].sort((a, b) => a - b) }
}

// Below this much usage a linear projection is noise; claude-hud's pace uses the same floor.
const MIN_USED_PERCENT = 10

/**
 * When a rate-limit window runs out at the rate used so far (ms), or null when
 * it lasts until its reset (or the data cannot say).
 */
export function exhaustAt(
  percent: number | null | undefined,
  resetsAtSec: number | null | undefined,
  windowMs: number,
  now: number,
): number | null {
  if (percent === null || percent === undefined || !resetsAtSec || percent < MIN_USED_PERCENT) return null
  if (percent >= 100) return now
  const resetsAt = resetsAtSec * 1000
  const elapsed = windowMs - (resetsAt - now)
  if (elapsed <= 0 || resetsAt <= now) return null
  const at = now + ((100 - percent) / percent) * elapsed
  return at < resetsAt ? at : null
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "14:05" in the machine's time zone. */
export function clockTime(ms: number): string {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "2026-10-02" in the machine's time zone. */
export function localDay(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** The day `n` days after `day` (negative: before). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return localDay(new Date(y!, m! - 1, d! + n, 12).getTime())
}

/** "45s", "2m05s", "1h03m". */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m${pad(s % 60)}s`
  return `${Math.floor(s / 3600)}h${pad(Math.floor((s % 3600) / 60))}m`
}

const BLOCKS = '▁▂▃▄▅▆▇█'

/** One block per value, scaled to the largest; a zero is the lowest block. */
export function sparkline(values: number[]): string {
  const max = Math.max(0, ...values)
  return values
    .map(v => (max <= 0 || v <= 0 ? BLOCKS[0] : BLOCKS[Math.min(7, Math.max(1, Math.round((v / max) * 7)))]))
    .join('')
}

/** Spend per day, `YYYY-MM-DD` → USD. */
export type History = Record<string, number>

/** The last `days` days' spend, oldest first, ending today. */
export function lastDays(history: History, today: string, days: number): number[] {
  return Array.from({ length: days }, (_, i) => history[addDays(today, i - days + 1)] ?? 0)
}

/** Consecutive days with spend, ending today (or yesterday, before today's first spend). */
export function streak(history: History, today: string): number {
  let day = (history[today] ?? 0) > 0 ? today : addDays(today, -1)
  let count = 0
  while ((history[day] ?? 0) > 0) {
    count++
    day = addDays(day, -1)
  }
  return count
}

/** Days older than `keepDays` before today leave the history. */
export function pruneHistory(history: History, today: string, keepDays: number): History {
  const oldest = addDays(today, -keepDays)
  return Object.fromEntries(Object.entries(history).filter(([day]) => day > oldest))
}

/** `git status --porcelain=v2 --branch` → changed paths and commits ahead of upstream. */
export function parseGitStatus(stdout: string): { dirty: number; ahead: number } {
  let dirty = 0
  let ahead = 0
  for (const line of stdout.split('\n')) {
    if (!line) continue
    if (line.startsWith('#')) {
      const ab = /^# branch\.ab \+(\d+) -\d+/.exec(line)
      if (ab) ahead = Number(ab[1])
    } else {
      dirty++
    }
  }
  return { dirty, ahead }
}

/** "Today $3.20/$10.00 ▓▓▓░░░░░", red once past the budget, yellow from 80%. */
export function budgetSpans(todayUsd: number, budgetUsd: number, width = 8): HudLine {
  const ratio = budgetUsd > 0 ? todayUsd / budgetUsd : 0
  const filled = Math.min(width, Math.round(ratio * width))
  const color = ratio >= 1 ? 'red' : ratio >= 0.8 ? 'yellow' : 'green'
  const spans: HudLine = [{ text: `${m('spend.today', { spent: `${money(todayUsd)}/${money(budgetUsd)}` })} `, dimColor: ratio < 0.8 }]
  if (filled > 0) spans.push({ text: '▓'.repeat(filled), color })
  if (filled < width) spans.push({ text: '░'.repeat(width - filled), dimColor: true })
  return spans
}

export type ExtrasInput = {
  summary: string | null
  /** Rate-limit windows that run out before they reset: label and when. */
  exhaust: { label: string; at: number }[]
  todayUsd: number | null
  budgetUsd: number
  /** The last 7 days' spend, oldest first, and the streak; null hides the history. */
  week: { values: number[]; streak: number } | null
  git: { dirty: number; ahead: number } | null
  gitDirtyWarn: number
  gitAheadWarn: number
  /** The row's width; parts that do not fit leave it, least important first. */
  columns?: number
}

const SEPARATOR = ' │ '

const lineWidth = (spans: HudLine) => spans.reduce((sum, span) => sum + textWidth(span.text), 0)

/** The row under claude-hud's lines; empty when there is nothing to say. */
export function extrasLine(x: ExtrasInput): HudLine {
  // Kept in display order; `rank` is what goes last when the row is too wide.
  const parts: { spans: HudLine; rank: number }[] = []
  if (x.summary) parts.push({ spans: [{ text: `✎ ${x.summary}`, color: 'cyan' }], rank: 3 })
  for (const { label, at } of x.exhaust) {
    parts.push({ spans: [{ text: m('forecast', { label, time: clockTime(at) }), color: 'magenta' }], rank: 2 })
  }
  if (x.budgetUsd > 0 && x.todayUsd !== null) parts.push({ spans: budgetSpans(x.todayUsd, x.budgetUsd), rank: 1 })
  if (x.week && x.week.values.some(v => v > 0)) {
    parts.push({
      spans: [
        { text: `${m('week')} `, dimColor: true },
        { text: sparkline(x.week.values), color: 'blue' },
        ...(x.week.streak > 1 ? [{ text: ` ${m('streak', { n: x.week.streak })}`, dimColor: true }] : []),
      ],
      rank: 0,
    })
  }
  const nags: string[] = []
  if (x.git && x.gitDirtyWarn > 0 && x.git.dirty >= x.gitDirtyWarn) nags.push(m('git.dirty', { n: x.git.dirty }))
  if (x.git && x.gitAheadWarn > 0 && x.git.ahead >= x.gitAheadWarn) nags.push(m('git.ahead', { n: x.git.ahead }))
  if (nags.length > 0) parts.push({ spans: [{ text: `⚠ ${nags.join(' · ')}`, color: 'yellow' }], rank: 4 })

  const join = (kept: typeof parts) =>
    kept.flatMap((part, i) => (i === 0 ? part.spans : [{ text: SEPARATOR, dimColor: true }, ...part.spans]))
  const kept = [...parts]
  while (x.columns && kept.length > 1 && lineWidth(join(kept)) > x.columns) {
    const lowest = Math.min(...kept.map(p => p.rank))
    kept.splice(kept.findIndex(p => p.rank === lowest), 1)
  }
  return join(kept)
}

/** claude-hud's ` │ ` and ` | ` between elements, dimmed like the extras row's. */
export function dimSeparators(row: HudLine): HudLine {
  return row.flatMap(span => {
    if (span.dimColor || !/ [│|] /.test(span.text)) return [span]
    return span.text
      .split(/( [│|] )/)
      .flatMap((text, i) => (!text ? [] : i % 2 === 1 ? [{ text, dimColor: true }] : [{ ...span, text }]))
  })
}

/** The extras row joins claude-hud's last row when both fit in `columns`, else goes under it. */
export function appendExtras(rows: HudLine[], extra: HudLine, columns: number | undefined): HudLine[] {
  if (extra.length === 0) return rows
  const last = rows[rows.length - 1]
  if (last && columns && lineWidth(last) + textWidth(SEPARATOR) + lineWidth(extra) <= columns) {
    return [...rows.slice(0, -1), [...last, { text: SEPARATOR, dimColor: true }, ...extra]]
  }
  return [...rows, extra]
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function base64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b = 0, c = 0] = [bytes[i]!, bytes[i + 1], bytes[i + 2]]
    const n = (a << 16) | (b << 8) | c
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63]! : '='
    out += i + 2 < bytes.length ? B64[n & 63]! : '='
  }
  return out
}

let chime: string | null = null

/** A short two-note chime, as a base64 16-bit mono WAV: the turn-done sound. */
export function chimeWav(): string {
  if (chime) return chime
  const rate = 22_050
  const notes = [
    { hz: 880, ms: 110 },
    { hz: 1320, ms: 170 },
  ]
  const samples = notes.flatMap(({ hz, ms }) => {
    const count = Math.round((rate * ms) / 1000)
    return Array.from({ length: count }, (_, i) => {
      const fade = Math.min(1, i / 200, (count - i) / 600)
      return Math.round(Math.sin((2 * Math.PI * hz * i) / rate) * fade * 0.35 * 32767)
    })
  })
  const data = samples.length * 2
  const buf = new DataView(new ArrayBuffer(44 + data))
  const text = (at: number, s: string) => [...s].forEach((ch, i) => buf.setUint8(at + i, ch.charCodeAt(0)))
  text(0, 'RIFF')
  buf.setUint32(4, 36 + data, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  buf.setUint32(16, 16, true)
  buf.setUint16(20, 1, true)
  buf.setUint16(22, 1, true)
  buf.setUint32(24, rate, true)
  buf.setUint32(28, rate * 2, true)
  buf.setUint16(32, 2, true)
  buf.setUint16(34, 16, true)
  text(36, 'data')
  buf.setUint32(40, data, true)
  samples.forEach((s, i) => buf.setInt16(44 + i * 2, s, true))
  chime = base64(new Uint8Array(buf.buffer))
  return chime
}
