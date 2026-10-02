// The two Node globals claude-hud reaches for: `process` and `Buffer`.
// Filled from the session at start (see register.tsx).
export const processShim = {
  env: {} as Record<string, string | undefined>,
  platform: 'darwin',
  pid: 0,
  argv: ['node', 'claude-hud'] as string[],
  execPath: '',
  stdout: { columns: undefined as number | undefined, isTTY: false },
  stderr: { columns: undefined as number | undefined, isTTY: false },
  stdin: undefined,
  cwdPath: '/',
  cwd(): string {
    return processShim.cwdPath
  },
}

type ByteString = Uint8Array & { toString(encoding?: string): string }

function withText(bytes: Uint8Array): ByteString {
  const out = bytes as ByteString
  out.toString = () => new TextDecoder().decode(bytes)
  return out
}

const BufferShim = {
  from(value: string | ArrayLike<number>): ByteString {
    return withText(typeof value === 'string' ? new TextEncoder().encode(value) : Uint8Array.from(value))
  },
  alloc(size: number): ByteString {
    return withText(new Uint8Array(size))
  },
  byteLength(value: string): number {
    return new TextEncoder().encode(value).length
  },
  concat(list: Uint8Array[]): ByteString {
    const out = new Uint8Array(list.reduce((n, c) => n + c.length, 0))
    let at = 0
    for (const c of list) {
      out.set(c, at)
      at += c.length
    }
    return withText(out)
  },
}

const g = globalThis as Record<string, unknown>
g.process = processShim
g.Buffer = BufferShim
if (typeof g.console === 'undefined') {
  const quiet = () => {}
  g.console = { log: quiet, error: quiet, warn: quiet, info: quiet, debug: quiet }
}
