import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Quote } from '../types'
import { m, resolveLanguage, setLang } from './i18n'
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
      return m('error.parse')
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
  const mode: Mode = MODES.find(mode => mode === options.refreshMode) ?? 'interval'
  const isDaily = mode === 'daily'

  on('session.start', async ($, e, next) => {
    const settings = (await $.settings.read().catch(() => ({}))) as { language?: unknown }
    const locale = await Promise.all([
      $.env.get('LC_ALL').catch(() => undefined),
      $.env.get('LC_MESSAGES').catch(() => undefined),
      $.env.get('LANG').catch(() => undefined),
    ])
    setLang(resolveLanguage(options.language, settings.language, locale))
    await $.command.register({
      name: 'hitokoto',
      description: m('cmd.description'),
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
      return { text: m(arg === 'off' ? 'cmd.hidden' : 'cmd.shown') }
    }

    await update($, isHidden, () => false)
    await $.store.set('isHidden', false)
    const error = await fetchNew($, url, isDaily)
    if (error) {
      return { text: m('error.fetch', { error }) }
    }
    const q = await read($, quote)
    return { text: q ? `${q.text} ${attribution(q)}`.trim() : m('error.fetch', { error: m('error.parse') }) }
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
        {/* Two cells in, as the engine indents the lines under the prompt. */}
        <Box flexDirection="row" flexWrap="wrap" columnGap={1} paddingLeft={2}>
          <Text dimColor italic>『{q.text}』</Text>
          {by ? <Text dimColor>{by}</Text> : null}
        </Box>
        {below}
      </Box>
    )
  })
}
