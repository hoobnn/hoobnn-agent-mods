// The transcript, read once and incrementally for the whole mod: claude-hud's
// own Parser gets every appended line, and so does a small reader for what
// Claude Code's statusline stdin carries and `$` does not (the session's
// title and its prompt-cache state).
import { Parser } from './hud/transcript.js'
import type { TranscriptData } from './hud/types.js'
import { readAppendedLines } from './shims/host.js'

export type TranscriptMeta = {
  /** `/rename` title, else the generated one, else the slug: the statusline's session_name. */
  sessionName: string | undefined
  /** Whether a main-thread response has read or written the prompt cache. */
  cachingObserved: boolean
  /** The TTL the last cache write used: `1h` when it wrote the 1-hour tier, else `5m`. */
  ttl: '5m' | '1h'
  /** When the last main-thread response landed (ms), the cache's latest refresh on record. */
  lastResponseAt: number | undefined
  /** Main-thread input tokens served from the cache, over all main-thread input tokens. */
  hitRatio: number | null
}

type Feed = {
  offset: number
  parser: Parser
  customTitle?: string
  aiTitle?: string
  slug?: string
  ttl: '5m' | '1h'
  lastResponseAt?: number
  usageById: Map<string, { read: number; total: number; cached: boolean }>
}

type Usage = {
  input_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
  cache_creation?: { ephemeral_1h_input_tokens?: number; ephemeral_5m_input_tokens?: number }
}

type Entry = {
  type?: string
  customTitle?: string
  aiTitle?: string
  slug?: string
  isSidechain?: boolean
  timestamp?: string
  message?: { id?: string; usage?: Usage }
}

const feeds = new Map<string, Feed>()
const n = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0)

function observe(feed: Feed, raw: string): void {
  let entry: Entry
  try {
    entry = JSON.parse(raw) as Entry
  } catch {
    return
  }
  if (entry.type === 'custom-title' && typeof entry.customTitle === 'string') feed.customTitle = entry.customTitle
  else if (entry.type === 'ai-title' && typeof entry.aiTitle === 'string') feed.aiTitle = entry.aiTitle
  else if (typeof entry.slug === 'string') feed.slug = entry.slug

  const usage = entry.message?.usage
  if (entry.type !== 'assistant' || entry.isSidechain === true || !usage) return
  const read = n(usage.cache_read_input_tokens)
  const written = n(usage.cache_creation_input_tokens)
  const total = n(usage.input_tokens) + written + read
  // A response is logged more than once; its id keeps it counted once.
  feed.usageById.set(entry.message?.id ?? `${feed.usageById.size}`, { read, total, cached: read + written > 0 })
  if (n(usage.cache_creation?.ephemeral_1h_input_tokens) > 0) feed.ttl = '1h'
  else if (n(usage.cache_creation?.ephemeral_5m_input_tokens) > 0) feed.ttl = '5m'
  const at = entry.timestamp ? Date.parse(entry.timestamp) : Number.NaN
  if (!Number.isNaN(at)) feed.lastResponseAt = at
}

/** Reads what was appended to the transcript since the last call; `size` gates the read. */
export async function pullTranscript(path: string, size: number): Promise<void> {
  let feed = feeds.get(path)
  if (!feed || size < feed.offset) {
    feed = { offset: 0, parser: new Parser(), ttl: '5m', usageById: new Map() }
    feeds.set(path, feed)
  }
  if (size <= feed.offset) return
  const { lines, consumed } = await readAppendedLines(path, feed.offset)
  feed.offset += consumed
  for (const line of lines) {
    feed.parser.line(line)
    observe(feed, line)
  }
}

export function transcriptData(path: string): TranscriptData | null {
  return feeds.get(path)?.parser.finish() ?? null
}

export function transcriptMeta(path: string | undefined): TranscriptMeta {
  const feed = path ? feeds.get(path) : undefined
  let read = 0
  let total = 0
  let cached = false
  for (const usage of feed?.usageById.values() ?? []) {
    read += usage.read
    total += usage.total
    cached ||= usage.cached
  }
  return {
    sessionName: feed?.customTitle ?? feed?.aiTitle ?? feed?.slug,
    cachingObserved: cached,
    ttl: feed?.ttl ?? '5m',
    lastResponseAt: feed?.lastResponseAt,
    hitRatio: total > 0 ? read / total : null,
  }
}
