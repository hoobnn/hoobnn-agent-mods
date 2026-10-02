import type { Quote } from '../types'

const CATEGORY = /^[a-l]$/

// `categories` option ("d, i,k") to the API's query: one `c` per letter.
export function hitokotoUrl(categories: string): string {
  const letters = categories
    .split(/[\s,]+/)
    .map(c => c.trim().toLowerCase())
    .filter(c => CATEGORY.test(c))
  const query = ['encode=json', ...letters.map(c => `c=${c}`)].join('&')
  return `https://v1.hitokoto.cn/?${query}`
}

// The API's text as one plain line: control characters (escapes, newlines) drawn as nothing.
const clean = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').replace(/\s+/g, ' ').trim() : ''

export function parseQuote(body: string): Quote | null {
  const json = JSON.parse(body) as { hitokoto?: unknown; from?: unknown; from_who?: unknown }
  const text = clean(json.hitokoto)
  if (!text) {
    return null
  }
  return { text, from: clean(json.from), fromWho: clean(json.from_who) }
}

// "—— 鲁迅「呐喊」"; empty when the API names neither.
export function attribution(quote: Quote): string {
  const source = quote.from && quote.from !== quote.fromWho ? `「${quote.from}」` : ''
  const who = quote.fromWho + source
  return who ? `—— ${who}` : ''
}

// "2026-10-02" in the machine's time zone: the day daily mode keeps a line for.
export function localDate(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
