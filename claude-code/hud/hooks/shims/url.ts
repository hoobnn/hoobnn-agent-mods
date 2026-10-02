// `node:url` file-URL helpers, POSIX only.
export function pathToFileURL(p: string): URL {
  return new URL('file://' + p.split('/').map(encodeURIComponent).join('/'))
}

export function fileURLToPath(url: string | URL): string {
  const parsed = typeof url === 'string' ? new URL(url) : url
  return decodeURIComponent(parsed.pathname)
}
