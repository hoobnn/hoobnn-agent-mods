// POSIX `node:path` for the hooks environment, which has no Node.
export const sep = '/'
export const delimiter = ':'

function normalizeParts(parts: string[], isAbs: boolean): string[] {
  const out: string[] = []
  for (const part of parts) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (out.length && out[out.length - 1] !== '..') out.pop()
      else if (!isAbs) out.push('..')
    } else {
      out.push(part)
    }
  }
  return out
}

export function isAbsolute(p: string): boolean {
  return p.startsWith('/')
}

export function normalize(p: string): string {
  if (!p) return '.'
  const isAbs = isAbsolute(p)
  const trailing = p.endsWith('/')
  let joined = normalizeParts(p.split('/'), isAbs).join('/')
  if (!joined && !isAbs) joined = '.'
  if (joined && trailing) joined += '/'
  return (isAbs ? '/' : '') + joined
}

export function join(...parts: string[]): string {
  const joined = parts.filter(part => part.length > 0).join('/')
  return joined ? normalize(joined) : '.'
}

let cwdProvider: () => string = () => '/'

export function setCwdProvider(fn: () => string): void {
  cwdProvider = fn
}

export function resolve(...parts: string[]): string {
  let resolved = ''
  for (let i = parts.length - 1; i >= 0 && !isAbsolute(resolved); i--) {
    const part = parts[i]
    if (!part) continue
    resolved = resolved ? `${part}/${resolved}` : part
  }
  if (!isAbsolute(resolved)) resolved = `${cwdProvider()}/${resolved}`
  const out = '/' + normalizeParts(resolved.split('/'), true).join('/')
  return out
}

export function relative(from: string, to: string): string {
  const a = resolve(from).split('/').filter(Boolean)
  const b = resolve(to).split('/').filter(Boolean)
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return [...Array(a.length - i).fill('..'), ...b.slice(i)].join('/')
}

export function dirname(p: string): string {
  if (!p) return '.'
  const trimmed = p.length > 1 ? p.replace(/\/+$/, '') : p
  const idx = trimmed.lastIndexOf('/')
  if (idx < 0) return '.'
  if (idx === 0) return '/'
  return trimmed.slice(0, idx)
}

export function basename(p: string, ext?: string): string {
  const trimmed = p.length > 1 ? p.replace(/\/+$/, '') : p
  let base = trimmed.slice(trimmed.lastIndexOf('/') + 1)
  if (ext && base.endsWith(ext) && base !== ext) base = base.slice(0, -ext.length)
  return base
}

export function extname(p: string): string {
  const base = basename(p)
  const idx = base.lastIndexOf('.')
  return idx <= 0 ? '' : base.slice(idx)
}

export function parse(p: string): { root: string; dir: string; base: string; ext: string; name: string } {
  const base = basename(p)
  const ext = extname(p)
  return { root: isAbsolute(p) ? '/' : '', dir: dirname(p), base, ext, name: ext ? base.slice(0, -ext.length) : base }
}

export const posix = { sep, delimiter, isAbsolute, normalize, join, resolve, relative, dirname, basename, extname, parse }
export const win32 = posix

export default posix
