// Synchronous `node:fs` over the host's fetched facts (see host.ts).
import type { FsStat } from 'claude-code'

import { FsError, listFact, overlayText, readFact, statFact, writeOverlay } from './host.js'
import { resolve } from './path.js'

export { readAppendedLines } from './host.js'

export class Stats {
  size: number
  mtimeMs: number
  ctimeMs: number
  mtime: Date
  dev = 0
  ino = 0
  mode: number
  uid = 0
  private readonly kind: FsStat['kind']
  private readonly link: boolean

  constructor(stat: FsStat, asLink: boolean) {
    this.size = stat.size
    this.mtimeMs = stat.mtimeMs
    this.ctimeMs = stat.mtimeMs
    this.mtime = new Date(stat.mtimeMs)
    this.kind = stat.kind
    this.link = asLink
    this.mode = stat.kind === 'dir' ? 0o40755 : 0o100644
  }

  isFile(): boolean {
    return !this.link && this.kind === 'file'
  }

  isDirectory(): boolean {
    return !this.link && this.kind === 'dir'
  }

  isSymbolicLink(): boolean {
    return this.link
  }
}

export class Dirent {
  constructor(
    readonly name: string,
    private readonly kind: string,
    private readonly link: boolean,
    readonly parentPath: string,
  ) {}

  isFile(): boolean {
    return !this.link && this.kind === 'file'
  }

  isDirectory(): boolean {
    return !this.link && this.kind === 'dir'
  }

  isSymbolicLink(): boolean {
    return this.link
  }
}

export const constants = { O_RDONLY: 0, O_NOFOLLOW: 0x100, X_OK: 1, R_OK: 4, W_OK: 2, F_OK: 0 }

const fds = new Map<number, string>()
let nextFd = 100

type PathLike = string | number

function pathOf(p: PathLike): string {
  if (typeof p === 'number') {
    const path = fds.get(p)
    if (!path) throw new FsError('EBADF', String(p))
    return path
  }
  return resolve(p)
}

export function existsSync(p: string): boolean {
  try {
    statFact(resolve(p))
    return true
  } catch {
    return false
  }
}

export function statSync(p: PathLike, options?: { throwIfNoEntry?: boolean }): Stats {
  try {
    return new Stats(statFact(pathOf(p)), false)
  } catch (err) {
    if (options?.throwIfNoEntry === false) return undefined as unknown as Stats
    throw err
  }
}

export function lstatSync(p: string): Stats {
  const stat = statFact(resolve(p))
  return new Stats(stat, stat.isLink)
}

export function fstatSync(fd: number): Stats {
  return statSync(fd)
}

function realpath(p: string): string {
  const path = resolve(p)
  const stat = statFact(path)
  return stat.realPath ?? path
}

export const realpathSync = Object.assign(realpath, { native: realpath })

export function accessSync(p: string, _mode?: number): void {
  statFact(resolve(p))
}

export function readFileSync(p: PathLike, _options?: unknown): string {
  return readFact(pathOf(p))
}

export function readdirSync(p: string, options?: { withFileTypes?: boolean }): any[] {
  const path = resolve(p)
  const entries = listFact(path)
  if (options?.withFileTypes) {
    return entries.map(entry => new Dirent(entry.name, entry.kind, entry.isLink, path))
  }
  return entries.map(entry => entry.name)
}

export function openSync(p: string, flags?: string | number, _mode?: number): number {
  const path = resolve(p)
  if (flags === 'wx' || flags === 'w') {
    if (flags === 'wx' && overlayText(path) !== undefined) throw new FsError('EEXIST', path)
    writeOverlay(path, '')
  } else {
    statFact(path)
  }
  const fd = nextFd++
  fds.set(fd, path)
  return fd
}

export function closeSync(fd: number): void {
  fds.delete(fd)
}

export function writeFileSync(p: PathLike, data: unknown, _options?: unknown): void {
  writeOverlay(pathOf(p), typeof data === 'string' ? data : String(data))
}

export function writeSync(fd: number, data: unknown): number {
  const path = pathOf(fd)
  const text = String(data)
  writeOverlay(path, (overlayText(path) ?? '') + text)
  return text.length
}

export function appendFileSync(p: string, data: unknown): void {
  const path = resolve(p)
  let current = ''
  try {
    current = readFact(path)
  } catch {
    current = ''
  }
  writeOverlay(path, current + String(data))
}

export function renameSync(from: string, to: string): void {
  const source = resolve(from)
  const text = overlayText(source) ?? readFact(source)
  if (text === null) throw new FsError('ENOENT', source)
  writeOverlay(resolve(to), text)
  writeOverlay(source, null)
}

export function unlinkSync(p: string): void {
  writeOverlay(resolve(p), null)
}

export function rmSync(p: string, _options?: unknown): void {
  writeOverlay(resolve(p), null)
}

export function mkdirSync(_p: string, _options?: unknown): void {}
export function chmodSync(_p: string, _mode: number): void {}
export function fchmodSync(_fd: number, _mode: number): void {}
export function utimesSync(_p: string, _a: unknown, _m: unknown): void {}
export function fsyncSync(_fd: number): void {}

export function createReadStream(_path?: string): never {
  throw new Error('hud: createReadStream is not available; transcript reads go through readAppendedLines')
}

export const promises = {}
