// What the companion knows and says: its level, its bubble, and the labels of
// the turn it watches.
import { m } from './i18n'
import { textWidth } from './themes'
import type { Act, Finale, Mood } from './themes'

/** `12s`, `3m 05s`, `1h 02m`. */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
  return `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, '0')}m`
}

/** Lv.1 at 0 xp, Lv.2 at 2, Lv.3 at 8, Lv.4 at 18: one xp a finished turn. */
export function levelOf(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 2)) + 1
}

/** What a tool call is about, short: `Bash: npm test`, `Edit: themes.ts`, `WebSearch`. */
export function toolLabel(e: { tool: string } & Record<string, unknown>): string {
  const clip = (s: string) => (textWidth(s) > 32 ? `${Array.from(s).slice(0, 31).join('')}…` : s)
  if (typeof e.command === 'string') return clip(`${e.tool}: ${e.command.split('\n')[0]!.trim()}`)
  const path = [e.file_path, e.notebook_path, e.path].find(p => typeof p === 'string') as string | undefined
  if (path) return clip(`${e.tool}: ${path.split('/').pop()}`)
  if (typeof e.pattern === 'string') return clip(`${e.tool}: ${e.pattern}`)
  return clip(e.tool.replace(/^mcp__[^_]+__/, ''))
}

export function finaleOf(reason: string): Finale {
  return reason === 'answer' ? 'answer' : reason === 'aborted' ? 'aborted' : 'error'
}

/** The bubble says what the engine's spinner line does not: the tool, a prompt waiting, how the turn ended. */
export function bubbleOf(state: Act | Mood, tool: string | undefined): string {
  if (state === 'tool') return tool ?? ''
  if (state === 'think' || state === 'say' || state === 'wait') return ''
  return m(`pet.${state}`)
}
