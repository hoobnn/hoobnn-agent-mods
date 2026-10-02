// Types for the Node names claude-hud's source mentions; the values come
// from globals.ts.
declare namespace NodeJS {
  type ProcessEnv = Record<string, string | undefined>
  type Platform = string
  type Timeout = number
  type ReadStream = any
  interface ErrnoException extends Error {
    code?: string
    errno?: number
    path?: string
  }
}

declare const process: {
  env: NodeJS.ProcessEnv
  platform: NodeJS.Platform
  pid: number
  argv: string[]
  execPath: string
  stdout: { columns?: number; isTTY?: boolean }
  stderr: { columns?: number; isTTY?: boolean }
  stdin: any
  cwd(): string
}

type Buffer = Uint8Array & { toString(encoding?: string): string }
type BufferEncoding = string

declare const console: {
  log(...args: unknown[]): void
  error(...args: unknown[]): void
  warn(...args: unknown[]): void
}

declare const Buffer: {
  from(value: string | ArrayLike<number>): Uint8Array & { toString(encoding?: string): string }
  alloc(size: number): Uint8Array & { toString(encoding?: string): string }
  byteLength(value: string, encoding?: string): number
  concat(list: Uint8Array[]): Uint8Array & { toString(encoding?: string): string }
}

declare function setTimeout(fn: () => void, ms?: number): number
declare function clearTimeout(id?: number): void
