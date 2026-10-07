// What a turn did, from the calls it made once they have run, and the loop
// rules over the main thread's calls. Pure: register.tsx hands in each call.
import type { FileChange, Receipt, Step, Watch } from '../types'

/** One call as it ran: the tool, its arguments, what it answered; `isReadOnly` when the tool held it read-only. */
export type Call = { tool: string; input: Record<string, unknown>; result: unknown; isError: boolean; isReadOnly?: boolean }

/** A loop the rules caught: a call failing again and again, or a file edited back and forth. */
export type Alert = { kind: 'repeat'; label: string; n: number } | { kind: 'flip'; path: string; n: number }

/** The thresholds; 0 turns a rule off. */
export type Rules = { repeatFailures: number; flipFlops: number }

const EDITS = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit'])
const READS = new Set(['Read', 'Grep', 'Glob', 'LS', 'NotebookRead'])
const SHELLS = new Set(['Bash', 'PowerShell'])
const AGENTS = new Set(['Agent', 'Task'])
// A command that checks the code, at the head of the line or after `&&`, `;`, `|`, `(`,
// past env assignments and a runner (`uv run`, `npx`, `bash`): a test runner, a type
// checker or linter, a build, or a project's own check script.
const CHECK = new RegExp(
  String.raw`(?:^|[;&|(]\s*)(?:\S+=\S*\s+)*(?:(?:bash|sh|zsh|time|npx|bunx|uv\s+run|poetry\s+run|pnpm\s+exec|bundle\s+exec)\s+)*(?:` +
    [
      String.raw`(?:npm|pnpm|yarn|bun|deno)\s+(?:run\s+)?(?:test|build|lint|check|typecheck|tsc)\b`,
      String.raw`(?:jest|vitest|mocha|pytest|rspec|phpunit|tox|nox|tsc|eslint|biome|ruff|mypy|pyright|rubocop|golangci-lint|shellcheck|make|playwright\s+test)\b`,
      String.raw`python3?\s+-m\s+(?:pytest|unittest|mypy)\b`,
      String.raw`go\s+(?:test|build|vet)\b`,
      String.raw`cargo\s+(?:test|check|build|clippy)\b`,
      String.raw`(?:swift|dotnet|mix|mvn|gradle|\.\/gradlew|zig|xcodebuild)\s+(?:test|build)\b`,
      String.raw`claude\s+plugin\s+(?:test|validate)\b`,
      String.raw`\S*(?:check|test|verify)\S*\.sh\b`,
    ].join('|') +
    ')',
)
// Files whose edits nothing runs to check: prose.
const PROSE = /\.(?:md|mdx|markdown|txt|rst|adoc)$/i

// Edits kept per file for the back-and-forth rule.
const KEEP_EDITS = 20
// Cells a call's label keeps, in a toast and in /receipt.
const LABEL_CELLS = 80
// What /receipt replay keeps of a turn: its first edits, each diff's first lines.
export const KEEP_STEPS = 50
const KEEP_LINES = 120

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()
const clip = (s: string) => (s.length > LABEL_CELLS ? `${s.slice(0, LABEL_CELLS - 1)}…` : s)

export function newReceipt(turnId: string, now: number): Receipt {
  return {
    turnId,
    startedAt: now,
    durationMs: null,
    reason: null,
    files: [],
    commands: 0,
    failed: [],
    errors: 0,
    reads: 0,
    agents: 0,
    warnings: [],
    checks: 0,
    isUnverified: false,
    steps: [],
  }
}

export const NO_WATCH: Watch = { failKey: null, failCount: 0, edits: {}, flips: {} }

/** `path` relative to `cwd` when it lies under it. */
export function relative(path: string, cwd: string): string {
  const base = cwd.replace(/\/+$/, '')
  return base && path.startsWith(base + '/') ? path.slice(base.length + 1) : path
}

/** A short label for a call: the command for a shell, else the tool and its file. */
export function labelOf(call: Pick<Call, 'tool' | 'input'>, cwd: string): string {
  const { tool, input } = call
  if (SHELLS.has(tool)) return clip(oneLine(str(input.command)))
  const file = str(input.file_path) || str(input.notebook_path) || str(input.path)
  return clip(file ? `${tool}: ${relative(file, cwd)}` : tool)
}

/** The lines an edit added and removed: git's own count, else the patch's, else a new file's length. */
export function changeOf(call: Call, cwd: string): FileChange | null {
  if (!EDITS.has(call.tool) || call.isError) return null
  const path = str(call.input.file_path) || str(call.input.notebook_path)
  if (!path) return null
  const result = (call.result ?? {}) as Record<string, unknown>
  const isNew = result.type === 'create'
  const git = result.gitDiff as { additions?: unknown; deletions?: unknown } | undefined
  if (typeof git?.additions === 'number' && typeof git.deletions === 'number') {
    return { path: relative(path, cwd), added: git.additions, removed: git.deletions, isNew }
  }
  let added = 0
  let removed = 0
  for (const hunk of Array.isArray(result.structuredPatch) ? (result.structuredPatch as { lines?: unknown }[]) : []) {
    for (const line of Array.isArray(hunk.lines) ? hunk.lines : []) {
      if (typeof line !== 'string') continue
      if (line.startsWith('+')) added++
      else if (line.startsWith('-')) removed++
    }
  }
  if (added === 0 && removed === 0 && isNew) added = str(result.content).split('\n').length
  return { path: relative(path, cwd), added, removed, isNew }
}

/**
 * The edit's diff for `/receipt replay`, from the hunks its result carried
 * (`structuredPatch`), else a new file's content.
 */
export function stepOf(call: Call, change: FileChange): Step {
  const result = (call.result ?? {}) as Record<string, unknown>
  const lines: string[] = []
  for (const hunk of Array.isArray(result.structuredPatch) ? (result.structuredPatch as Record<string, unknown>[]) : []) {
    const at = typeof hunk.newStart === 'number' ? hunk.newStart : typeof hunk.oldStart === 'number' ? hunk.oldStart : 0
    lines.push(`@${at}`)
    for (const line of Array.isArray(hunk.lines) ? hunk.lines : []) if (typeof line === 'string') lines.push(line)
  }
  if (lines.length === 0 && change.isNew && str(result.content)) {
    lines.push('@1', ...str(result.content).replace(/\n$/, '').split('\n').map(l => `+${l}`))
  }
  return { ...change, tool: call.tool, lines: lines.slice(0, KEEP_LINES), more: Math.max(0, lines.length - KEEP_LINES) }
}

/** Whether a shell command checks the code: a test, build, lint or type check. */
export function isCheck(command: string): boolean {
  return CHECK.test(command)
}

/** The receipt with one more call counted. */
export function addCall(receipt: Receipt, call: Call, cwd: string, isMain: boolean): Receipt {
  const next = { ...receipt }
  if (call.isError) next.errors++
  const change = changeOf(call, cwd)
  if (change) {
    const had = receipt.files.find(f => f.path === change.path)
    next.files = had
      ? receipt.files.map(f => (f === had ? { ...f, added: f.added + change.added, removed: f.removed + change.removed } : f))
      : [...receipt.files, change]
    if (!PROSE.test(change.path)) next.isUnverified = true
    const steps = receipt.steps ?? []
    if (steps.length < KEEP_STEPS) next.steps = [...steps, stepOf(call, change)]
  } else if (SHELLS.has(call.tool)) {
    next.commands++
    if (call.isError) next.failed = [...receipt.failed, labelOf(call, cwd)]
    // A check that ran counts whatever it found: its failure is on the receipt already.
    if (isCheck(str(call.input.command))) {
      next.checks = (receipt.checks ?? 0) + 1
      next.isUnverified = false
    }
  } else if (READS.has(call.tool)) {
    next.reads++
  } else if (AGENTS.has(call.tool) && isMain) {
    next.agents++
  }
  return next
}

export function finish(receipt: Receipt, durationMs: number, reason: string): Receipt {
  return { ...receipt, durationMs, reason }
}

/** Lines added and removed across the turn's files. */
export function totals(receipt: Receipt): { added: number; removed: number } {
  return receipt.files.reduce((t, f) => ({ added: t.added + f.added, removed: t.removed + f.removed }), { added: 0, removed: 0 })
}

/** Whether the turn did anything worth a receipt: a chat-only turn has none. */
export function isEmpty(receipt: Receipt): boolean {
  return receipt.files.length === 0 && receipt.commands === 0 && receipt.reads === 0 && receipt.agents === 0 && receipt.errors === 0
}

// What identifies a call for the repeat rule: the tool and its arguments.
function keyOf(call: Call): string {
  if (SHELLS.has(call.tool)) return `${call.tool}:${oneLine(str(call.input.command))}`
  const { description: _, ...rest } = call.input
  return `${call.tool}:${JSON.stringify(rest)}`
}

/**
 * The main thread's watch after one more call, and the alert it raises, if any.
 *
 * Repeat: the same call failing `repeatFailures` times in a row with nothing
 * changed in between: no edit, no shell command that was not read-only
 * (re-running a test after `sed -i` or an edit is work, not a loop).
 * Back and forth: an edit that puts back exactly what an earlier one took out
 * of the same file, the `flipFlops`th time.
 */
export function watchCall(watch: Watch, call: Call, rules: Rules, cwd: string): { watch: Watch; alert: Alert | null } {
  const edited = EDITS.has(call.tool) && !call.isError
  const changed = edited || (SHELLS.has(call.tool) && !call.isError && call.isReadOnly !== true)
  let next: Watch = watch
  let alert: Alert | null = null

  if (call.isError) {
    const key = keyOf(call)
    const failCount = watch.failKey === key ? watch.failCount + 1 : 1
    next = { ...next, failKey: key, failCount }
    if (rules.repeatFailures > 0 && failCount === rules.repeatFailures) alert = { kind: 'repeat', label: labelOf(call, cwd), n: failCount }
  } else if (changed || keyOf(call) === watch.failKey) {
    next = { ...next, failKey: null, failCount: 0 }
  }

  if (edited && (call.tool === 'Edit' || call.tool === 'MultiEdit')) {
    const path = relative(str(call.input.file_path), cwd)
    const pairs =
      call.tool === 'Edit'
        ? [{ from: str(call.input.old_string), to: str(call.input.new_string) }]
        : (Array.isArray(call.input.edits) ? (call.input.edits as Record<string, unknown>[]) : []).map(e => ({ from: str(e.old_string), to: str(e.new_string) }))
    const before = watch.edits[path] ?? []
    const isFlip = pairs.some(p => p.from !== p.to && before.some(b => b.from === p.to && b.to === p.from))
    const flips = isFlip ? (watch.flips[path] ?? 0) + 1 : (watch.flips[path] ?? 0)
    next = { ...next, edits: { ...watch.edits, [path]: [...before, ...pairs].slice(-KEEP_EDITS) }, flips: { ...watch.flips, [path]: flips } }
    if (isFlip && rules.flipFlops > 0 && flips === rules.flipFlops) alert = { kind: 'flip', path, n: flips }
  }
  return { watch: next, alert }
}

/** 42s, 3m 12s, 1h 05m. */
export function formatDuration(ms: number): string {
  const sec = Math.max(0, Math.round(ms / 1000))
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`
  return `${Math.floor(sec / 3600)}h ${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}m`
}
