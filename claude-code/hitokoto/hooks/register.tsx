import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Quote } from '../types'
import { attribution, hitokotoUrl, localDate, parseQuote } from './parse'

const quote = atom({ plugin: 'hitokoto', key: 'quote' } as const, null)
const isHidden = atom({ plugin: 'hitokoto', key: 'isHidden' } as const, false)

const MODES = ['interval', 'daily', 'session', 'prompt'] as const
type Mode = (typeof MODES)[number]

// How often daily mode looks whether the date has turned.
const DAY_CHECK_MS = 10 * 60_000

// A failed fetch keeps the line already shown; the error goes back to /hitokoto.
async function refresh($: EngineInterface, url: string): Promise<string | null> {
  try {
    const { ok, status, text } = await $.http.fetch(url)
    if (!ok) {
      return `HTTP ${status}`
    }
    const fresh = parseQuote(text)
    if (!fresh) {
      return '返回内容无法解析'
    }
    await update($, quote, () => fresh)
    return null
  } catch (err) {
    return String(err)
  }
}

// A new line; daily mode keeps it in the store as today's, for every session.
async function fetchNew($: EngineInterface, url: string, isDaily: boolean): Promise<string | null> {
  const error = await refresh($, url)
  if (!error && isDaily) {
    await $.store.set('daily', { date: localDate(await $.clock.now()), quote: await read($, quote) })
  }
  return error
}

// Today's line from the store, or a new one once the date has turned.
async function showDaily($: EngineInterface, url: string): Promise<void> {
  const kept = (await $.store.get('daily')) as { date?: unknown; quote?: Quote | null } | undefined
  if (kept?.date === localDate(await $.clock.now()) && kept.quote) {
    const q = kept.quote
    if ((await read($, quote))?.text !== q.text) {
      await update($, quote, () => q)
    }
    return
  }
  await fetchNew($, url, true)
}

export const register: Register = (on, options) => {
  const url = hitokotoUrl(typeof options.categories === 'string' ? options.categories : '')
  const intervalMinutes = typeof options.intervalMinutes === 'number' ? options.intervalMinutes : 30
  const intervalMs = Math.max(1, intervalMinutes) * 60_000
  const mode: Mode = MODES.find(m => m === options.refreshMode) ?? 'interval'
  const isDaily = mode === 'daily'

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'hitokoto',
      description: '换一句一言；off / on 隐藏或显示横条（跨会话保持）',
      argumentHint: '[off|on]',
    })
    if ((await $.store.get('isHidden')) === true) {
      await update($, isHidden, () => true)
    }

    // Not awaited: session.start holds the first prompt until it settles.
    if (isDaily) {
      void showDaily($, url)
      $.clock.every(DAY_CHECK_MS, () => void showDaily($, url))
    } else {
      void fetchNew($, url, false)
      if (mode === 'interval') {
        $.clock.every(intervalMs, () => void fetchNew($, url, false))
      }
    }

    return next(e)
  })

  if (mode === 'prompt') {
    on('prompt.submit', async ($, e, next) => {
      void fetchNew($, url, false)
      return next(e)
    })
  }

  on('command.run', { command: 'hitokoto' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'off' || arg === 'on') {
      await update($, isHidden, () => arg === 'off')
      await $.store.set('isHidden', arg === 'off')
      return { text: arg === 'off' ? '一言横条已隐藏' : '一言横条已显示' }
    }

    await update($, isHidden, () => false)
    await $.store.set('isHidden', false)
    const error = await fetchNew($, url, isDaily)
    if (error) {
      return { text: `一言获取失败：${error}` }
    }
    const q = await read($, quote)
    return { text: q ? `${q.text} ${attribution(q)}`.trim() : '一言获取失败' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const q = await read($, quote)
    if (e.props.hasSurvey || q === null || (await read($, isHidden))) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    // Other bands (another mod's) draw beneath this one rather than being replaced.
    const below = await next(e)
    const by = attribution(q)

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
          <Text color="cyan">『{q.text}』</Text>
          {by ? <Text dimColor>{by}</Text> : null}
        </Box>
        {below}
      </Box>
    )
  })
}
