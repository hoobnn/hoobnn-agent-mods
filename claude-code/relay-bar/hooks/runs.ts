// agent-relay's runs as the band and the pane draw them. relay.py keeps one
// folder per run under `$XDG_STATE_HOME/agent-relay/runs/` (default
// `~/.local/state`), named `<YYYYmmdd-HHMMSS>-<cli>-<hex>`, and rewrites its
// `status.json` about once a second while the agent works, then once more as it ends.
import type { Run, RunState, Step } from '../types'

/** A run folder's name: its local start time, the agent, a random tail. */
const RUN_DIR = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})-([a-z0-9]+)-[0-9a-f]+$/
const STATES = new Set<RunState>(['starting', 'running', 'done', 'failed', 'asked', 'lost'])
/** Runs kept for the pane; the oldest that ended go first. */
export const KEEP_RUNS = 10

export function runsDir(xdgState: string | undefined, home: string | undefined): string | null {
  if (xdgState) return `${xdgState}/agent-relay/runs`
  return home ? `${home}/.local/state/agent-relay/runs` : null
}

/** When a run folder was made, from its name (local time); null for any other name. */
export function dirTime(name: string): number | null {
  const p = RUN_DIR.exec(name)
  if (!p) return null
  const [y, mo, d, h, mi, s] = p.slice(1, 7).map(Number) as [number, number, number, number, number, number]
  return new Date(y, mo - 1, d, h, mi, s).getTime()
}

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function toStep(raw: unknown): Step | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  if (s.type === 'tool') return { type: 'tool', title: str(s.title) ?? str(s.kind) ?? 'tool', kind: str(s.kind), status: str(s.status) }
  if ((s.type === 'thought' || s.type === 'message') && typeof s.text === 'string') return { type: s.type, text: s.text }
  return null
}

/** A run from its status.json text (version 1); null when it does not parse as one. */
export function fromStatus(id: string, text: string): Run | null {
  let s: Record<string, unknown>
  try {
    s = JSON.parse(text) as Record<string, unknown>
  } catch {
    return null
  }
  const started = num(s.started)
  const cli = str(s.cli)
  if (s.v !== 1 || started === null || cli === null || !STATES.has(s.state as RunState)) return null
  const tools = (s.tools ?? {}) as Record<string, unknown>
  const ended = num(s.ended)
  return {
    id,
    cli,
    model: str(s.model),
    effort: str(s.effort),
    prompt: str(s.prompt) ?? '',
    state: s.state as RunState,
    startedAt: started * 1000,
    updatedAt: (num(s.updated) ?? started) * 1000,
    endedAt: ended === null ? null : ended * 1000,
    tools: { done: num(tools.done) ?? 0, total: num(tools.total) ?? 0 },
    steps: Array.isArray(s.steps) ? s.steps.map(toStep).filter((x): x is Step => x !== null) : [],
    error: str(s.error),
    filesChanged: num(s.files_changed) ?? 0,
    callId: null,
    inRow: false,
  }
}

export const isLive = (r: Pick<Run, 'state'>): boolean => r.state === 'starting' || r.state === 'running'

/** The runs with `incoming` laid over them by id, oldest first, at most KEEP_RUNS (the oldest ended ones go). */
export function merge(runs: readonly Run[], incoming: readonly Run[]): Run[] {
  const byId = new Map(runs.map(r => [r.id, r]))
  for (const r of incoming) byId.set(r.id, r)
  const all = [...byId.values()].sort((a, b) => a.startedAt - b.startedAt)
  while (all.length > KEEP_RUNS) {
    const i = all.findIndex(r => !isLive(r))
    all.splice(i < 0 ? 0 : i, 1)
  }
  return all
}

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()

/** The last sentence of a stretch of text, whole from its start: what it says now, never cut mid-word at the front. */
export function lastSentence(text: string): string {
  const parts = text.split(/(?<=[。！？!?；;])\s*|\n+|(?<=\.)\s+/).map(oneLine).filter(p => p.length >= 2)
  return parts[parts.length - 1] ?? oneLine(text)
}

/** What a live run is on now: its latest step, a mark and a line. */
export function doing(run: Run): { mark: string; text: string } | null {
  const last = run.steps[run.steps.length - 1]
  if (!last) return null
  if (last.type === 'tool') return { mark: last.status === 'completed' || last.status === 'failed' ? '✓' : '⚙', text: oneLine(last.title) }
  return { mark: last.type === 'thought' ? '∴' : '›', text: lastSentence(last.text) }
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

/** A run's steps as the pane's lines, oldest first: a tool a line, a thought on one line, a message line by line. */
export function paneLines(run: Run): { text: string; tone: 'tool' | 'thought' | 'message' | 'failed' }[] {
  const out: { text: string; tone: 'tool' | 'thought' | 'message' | 'failed' }[] = []
  for (const s of run.steps) {
    if (s.type === 'tool') {
      const isOver = s.status === 'completed' || s.status === 'failed'
      out.push({ text: `${isOver ? '✓' : '⚙'} ${oneLine(s.title)}`, tone: s.status === 'failed' ? 'failed' : 'tool' })
    } else if (s.type === 'thought') {
      out.push({ text: `∴ ${oneLine(s.text)}`, tone: 'thought' })
    } else {
      for (const line of s.text.replace(/\s+$/, '').split('\n')) out.push({ text: line, tone: 'message' })
    }
  }
  return out
}
