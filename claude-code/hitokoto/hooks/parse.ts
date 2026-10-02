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

export function parseQuote(body: string): Quote | null {
  const json = JSON.parse(body) as { hitokoto?: unknown; from?: unknown; from_who?: unknown }
  if (typeof json.hitokoto !== 'string' || !json.hitokoto.trim()) {
    return null
  }
  return {
    text: json.hitokoto.trim(),
    from: typeof json.from === 'string' ? json.from.trim() : '',
    fromWho: typeof json.from_who === 'string' ? json.from_who.trim() : '',
  }
}

// "—— 鲁迅「呐喊」"; empty when the API names neither.
export function attribution(quote: Quote): string {
  const source = quote.from && quote.from !== quote.fromWho ? `「${quote.from}」` : ''
  const who = quote.fromWho + source
  return who ? `—— ${who}` : ''
}
