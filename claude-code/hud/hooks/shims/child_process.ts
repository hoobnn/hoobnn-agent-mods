// `node:child_process` over `$.process.run`. Async calls run for real;
// `execFileSync` answers from the host's fetched facts (see host.ts).
import { commandFact, getIo } from './host.js'
import { promisify } from './util.js'

type ExecOptions = { cwd?: string; env?: Record<string, string | undefined>; timeout?: number; [key: string]: unknown }
type ExecResult = { stdout: string; stderr: string }

export class ExecError extends Error {
  code: number | string
  stdout: string
  stderr: string
  constructor(message: string, code: number | string, stdout: string, stderr: string) {
    super(message)
    this.code = code
    this.stdout = stdout
    this.stderr = stderr
  }
}

function cleanEnv(env?: Record<string, string | undefined>): Record<string, string> | undefined {
  if (!env) return undefined
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') out[key] = value
  }
  return out
}

async function run(argv: readonly string[], options: ExecOptions = {}): Promise<ExecResult> {
  let out
  try {
    out = await getIo().run(argv, {
      cwd: options.cwd,
      env: cleanEnv(options.env),
      timeoutMs: Math.min(Math.max(Number(options.timeout) || 30_000, 1), 600_000),
    })
  } catch (err) {
    throw new ExecError(String(err), 'ENOENT', '', '')
  }
  if (out.exitCode !== 0) {
    throw new ExecError(`Command failed: ${argv.join(' ')}\n${out.stderr}`, out.exitCode, out.stdout, out.stderr)
  }
  return { stdout: out.stdout, stderr: out.stderr }
}

type Callback = (err: unknown, stdout?: string, stderr?: string) => void

function splitArgs(rest: unknown[]): { args: string[]; options: ExecOptions; cb?: Callback } {
  let args: string[] = []
  let options: ExecOptions = {}
  let cb: Callback | undefined
  for (const value of rest) {
    if (Array.isArray(value)) args = value as string[]
    else if (typeof value === 'function') cb = value as Callback
    else if (value && typeof value === 'object') options = value as ExecOptions
  }
  return { args, options, cb }
}

export function execFile(file: string, ...rest: unknown[]): void {
  const { args, options, cb } = splitArgs(rest)
  run([file, ...args], options).then(
    r => cb?.(null, r.stdout, r.stderr),
    err => cb?.(err, (err as ExecError).stdout, (err as ExecError).stderr),
  )
}
;(execFile as unknown as Record<symbol, unknown>)[promisify.custom] = (file: string, ...rest: unknown[]) => {
  const { args, options } = splitArgs(rest)
  return run([file, ...args], options)
}

export function exec(command: string, ...rest: unknown[]): void {
  const { options, cb } = splitArgs(rest)
  run(['/bin/sh', '-c', command], options).then(
    r => cb?.(null, r.stdout, r.stderr),
    err => cb?.(err, (err as ExecError).stdout, (err as ExecError).stderr),
  )
}
;(exec as unknown as Record<symbol, unknown>)[promisify.custom] = (command: string, ...rest: unknown[]) => {
  const { options } = splitArgs(rest)
  return run(['/bin/sh', '-c', command], options)
}

export function execFileSync(file: string, ...rest: unknown[]): string {
  const { args } = splitArgs(rest)
  const fact = commandFact([file, ...args])
  if (fact.exitCode !== 0) throw new ExecError(`Command failed: ${file}`, fact.exitCode, fact.stdout, fact.stderr)
  return fact.stdout
}

export type ChildProcess = { pid?: number; exitCode: number | null; signalCode: string | null; kill: (signal?: string) => boolean }

export function spawn(): never {
  throw new Error('hud: spawn is not available in the hooks environment')
}
