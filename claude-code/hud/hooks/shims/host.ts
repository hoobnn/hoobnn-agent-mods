// The bridge between claude-hud's synchronous Node calls and the engine's `$`.
//
// claude-hud reads files and runs a few commands synchronously. The hooks
// environment reaches the machine only through async `$` calls, so a refresh
// runs claude-hud against facts fetched beforehand: a read of a path not yet
// fetched is recorded as a miss (and answered as missing), the missing facts
// are fetched, and the pass runs again. Writes are held in an overlay and
// written out only once a pass completes with no misses.
import type { FsEntry, FsStat, ProcessRunInit, ProcessRunResult } from 'claude-code'

/** The engine calls the shims make, closed over `$` in the hooks module. */
export type Io = {
  stat: (path: string) => Promise<FsStat>
  read: (path: string) => Promise<string>
  list: (path: string) => Promise<FsEntry[]>
  write: (path: string, text: string) => Promise<void>
  run: (argv: readonly string[], init?: ProcessRunInit) => Promise<ProcessRunResult>
}

const MAX_READ_BYTES = 4 * 1024 * 1024
const MAX_PASSES = 8

type Want = { stat: boolean; read: boolean; list: boolean }
type Fact = {
  stat?: FsStat | null
  text?: string | null | 'EFBIG'
  list?: FsEntry[] | null
}
type CommandFact = { stdout: string; stderr: string; exitCode: number }

const wants = new Map<string, Want>()
const facts = new Map<string, Fact>()
const commandWants = new Map<string, readonly string[]>()
const commandFacts = new Map<string, CommandFact>()
const overlay = new Map<string, string | null>()
let missCount = 0
let io: Io | null = null

export function setIo(next: Io): void {
  io = next
}

export function getIo(): Io {
  if (!io) throw new Error('hud: io not ready')
  return io
}

function want(path: string, kind: keyof Want): void {
  const current = wants.get(path) ?? { stat: false, read: false, list: false }
  if (!current[kind]) {
    current[kind] = true
    wants.set(path, current)
  }
}

export class FsError extends Error {
  code: string
  errno: number
  path: string
  constructor(code: string, path: string) {
    super(`${code}: ${path}`)
    this.code = code
    this.errno = code === 'ENOENT' ? -2 : -1
    this.path = path
  }
}

function miss(path: string, kind: keyof Want): never {
  want(path, kind)
  missCount += 1
  throw new FsError('ENOENT', path)
}

export function statFact(path: string): FsStat {
  if (overlay.has(path)) {
    const text = overlay.get(path)
    if (text === null || text === undefined) throw new FsError('ENOENT', path)
    return { kind: 'file', size: new TextEncoder().encode(text).length, mtimeMs: Date.now(), isLink: false, realPath: path }
  }
  const fact = facts.get(path)
  if (!fact || fact.stat === undefined) miss(path, 'stat')
  want(path, 'stat')
  if (fact.stat === null) throw new FsError('ENOENT', path)
  return fact.stat
}

export function readFact(path: string): string {
  if (overlay.has(path)) {
    const text = overlay.get(path)
    if (text === null || text === undefined) throw new FsError('ENOENT', path)
    return text
  }
  const fact = facts.get(path)
  if (!fact || fact.text === undefined) miss(path, 'read')
  want(path, 'read')
  if (fact.text === null) throw new FsError(fact.stat?.kind === 'dir' ? 'EISDIR' : 'ENOENT', path)
  if (fact.text === 'EFBIG') throw new FsError('EFBIG', path)
  return fact.text
}

export function listFact(path: string): FsEntry[] {
  const fact = facts.get(path)
  if (!fact || fact.list === undefined) miss(path, 'list')
  want(path, 'list')
  if (fact.list === null) throw new FsError('ENOENT', path)
  const written = [...overlay.entries()]
    .filter(([p, text]) => text !== null && p.startsWith(path.endsWith('/') ? path : `${path}/`))
    .map(([p]) => p.slice(path.length).replace(/^\//, ''))
    .filter(name => name && !name.includes('/'))
  const names = new Set(fact.list.map(entry => entry.name))
  return [
    ...fact.list.filter(entry => overlay.get(`${path}/${entry.name}`) !== null),
    ...written.filter(name => !names.has(name)).map(name => ({ name, kind: 'file' as const, size: 0, mtimeMs: Date.now(), isLink: false })),
  ]
}

export function writeOverlay(path: string, text: string | null): void {
  overlay.set(path, text)
}

export function overlayText(path: string): string | null | undefined {
  return overlay.get(path)
}

export function commandFact(argv: readonly string[]): CommandFact {
  const key = JSON.stringify(argv)
  const fact = commandFacts.get(key)
  commandWants.set(key, argv)
  if (!fact) {
    missCount += 1
    return { stdout: '', stderr: 'hud: not fetched yet', exitCode: 1 }
  }
  return fact
}

async function fetchPath($: Io, path: string, need: Want): Promise<void> {
  const fact: Fact = {}
  try {
    fact.stat = await $.stat(path)
  } catch {
    fact.stat = null
  }
  if (need.read) {
    if (fact.stat?.kind === 'file') {
      if (fact.stat.size > MAX_READ_BYTES) {
        fact.text = 'EFBIG'
      } else {
        fact.text = await $.read(path).catch(() => null)
      }
    } else {
      fact.text = null
    }
  }
  if (need.list) {
    fact.list = fact.stat?.kind === 'dir' ? await $.list(path).catch(() => null) : null
  }
  facts.set(path, fact)
}

async function fetchCommand($: Io, key: string, argv: readonly string[]): Promise<void> {
  try {
    const out = await $.run(argv, { timeoutMs: 5_000 })
    commandFacts.set(key, { stdout: out.stdout, stderr: out.stderr, exitCode: out.exitCode })
  } catch (err) {
    commandFacts.set(key, { stdout: '', stderr: String(err), exitCode: 127 })
  }
}

async function fetchAll($: Io, onlyMissing: boolean): Promise<void> {
  const jobs: Promise<void>[] = []
  for (const [path, need] of wants) {
    const fact = facts.get(path)
    const isMissing = !fact
      || (need.stat && fact.stat === undefined)
      || (need.read && fact.text === undefined)
      || (need.list && fact.list === undefined)
    if (!onlyMissing || isMissing) jobs.push(fetchPath($, path, need))
  }
  for (const [key, argv] of commandWants) {
    if (!onlyMissing || !commandFacts.has(key)) jobs.push(fetchCommand($, key, argv))
  }
  await Promise.all(jobs)
}

/** Commands whose answer does not change within a session (memory size, uname). */
const STABLE_COMMANDS = new Set<string>()

export function markStable(argv: readonly string[]): void {
  STABLE_COMMANDS.add(JSON.stringify(argv))
}

/**
 * Runs `pass` against fresh facts until it completes without a miss, then
 * writes out what it wrote. Returns the last pass's result.
 */
export async function runWithFacts<T>(pass: () => Promise<T>): Promise<T> {
  const $ = getIo()
  for (const key of commandFacts.keys()) {
    if (!STABLE_COMMANDS.has(key)) commandFacts.delete(key)
  }
  facts.clear()
  await fetchAll($, false)
  let result: T | undefined
  for (let i = 0; i < MAX_PASSES; i++) {
    overlay.clear()
    missCount = 0
    result = await pass()
    if (missCount === 0) break
    await fetchAll($, true)
  }
  const writes = [...overlay.entries()]
  overlay.clear()
  await Promise.all(
    writes.map(async ([path, text]) => {
      if (text !== null) {
        await $.write(path, text).catch(() => undefined)
      } else if (facts.get(path)?.stat) {
        await $.run(['/bin/rm', '-f', path]).catch(() => undefined)
      }
    }),
  )
  return result as T
}

/** Reads the complete lines appended to a file since `offset` (bytes). */
let lastAppend: Record<string, unknown> = {}

export async function readAppendedLines(path: string, offset: number): Promise<{ lines: string[]; consumed: number }> {
  const $ = getIo()
  const lines: string[] = []
  let consumed = 0
  const encoder = new TextEncoder()
  for (;;) {
    const at = offset + consumed
    const out = await $.run(
      ['/bin/sh', '-c', 'tail -c +"$1" "$2" | head -c 3000000', 'sh', String(at + 1), path],
      { timeoutMs: 60_000 },
    )
    const text = out.stdout
    const end = text.lastIndexOf('\n')
    if (end < 0) break
    const chunk = text.slice(0, end + 1)
    consumed += encoder.encode(chunk).length
    lines.push(...chunk.slice(0, -1).split('\n'))
    if (encoder.encode(text).length < 3_000_000) break
  }
  lastAppend = { path, offset, lines: lines.length, consumed }
  return { lines, consumed }
}

/** For the debug tool: what the last refresh fetched and still missed. */
export function factsSummary(): Record<string, unknown> {
  const missing = [...wants.entries()]
    .filter(([path]) => facts.get(path)?.stat === null)
    .map(([path]) => path)
  return { lastAppend, paths: wants.size, missingPaths: missing.slice(0, 40), commands: [...commandWants.keys()] }
}
