import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { attribution, hitokotoUrl, parseQuote } from './parse'

const quote = atom({ plugin: 'hitokoto', key: 'quote' } as const, null)
const isHidden = atom({ plugin: 'hitokoto', key: 'isHidden' } as const, false)

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

export const register: Register = (on, options) => {
  const url = hitokotoUrl(typeof options.categories === 'string' ? options.categories : '')
  const intervalMinutes = typeof options.intervalMinutes === 'number' ? options.intervalMinutes : 30
  const intervalMs = Math.max(1, intervalMinutes) * 60_000

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'hitokoto',
      description: '换一句一言；off / on 隐藏或显示横条',
      argumentHint: '[off|on]',
    })

    // Not awaited: session.start holds the first prompt until it settles.
    void refresh($, url)
    $.clock.every(intervalMs, () => void refresh($, url))

    return next(e)
  })

  on('command.run', { command: 'hitokoto' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'off' || arg === 'on') {
      await update($, isHidden, () => arg === 'off')
      return { text: arg === 'off' ? '一言横条已隐藏' : '一言横条已显示' }
    }

    await update($, isHidden, () => false)
    const error = await refresh($, url)
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
