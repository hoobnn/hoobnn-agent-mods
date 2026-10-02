// The task in one line: the reply of a fork of the conversation, cleaned up.

// Columns the summary may take in the row (a CJK character takes two).
export const SUMMARY_COLUMNS = 56

const WIDE = /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/

/** One reply line of the summary fork: quotes and closing punctuation off, cut to `columns`. */
export function cleanSummary(text: string, columns = SUMMARY_COLUMNS): string | null {
  const line = text.split('\n').map(l => l.trim()).find(Boolean) ?? ''
  const bare = line
    .replace(/^["'“”‘’„‚«»「『【]+/, '')
    .replace(/["'“”‘’„‚«»」』】。．.!！?？…]+$/, '')
    .trim()
  if (!bare) return null
  let width = 0
  let out = ''
  for (const ch of bare) {
    width += WIDE.test(ch) ? 2 : 1
    if (width > columns - 1) return `${out.trimEnd()}…`
    out += ch
  }
  return out
}
