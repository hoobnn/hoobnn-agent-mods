import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Quote } from '../types'
import { readConfig } from './config'
import { m, setLang } from './i18n'
import { isPickerOpen, stackAbove } from './kit/band'
import { resolveLanguage } from './kit/lang'
import { keptRows, migrateStore, persist } from './kit/prefs'
import type { Prefs } from './kit/prefs'
import { attribution, localDate, parseQuote } from './parse'

const quote = atom({ plugin: 'hitokoto', key: 'quote' } as const, null)
const isHidden = atom({ plugin: 'hitokoto', key: 'isHidden' } as const, false)
// True while a picker is open above the band (see kit/band).
const isPicking = atom({ plugin: 'hitokoto', key: 'isPicking' } as const, false)

// How often daily mode looks whether the date has turned.
const DAY_CHECK_MS = 10 * 60_000

/** The kit's hold on this mod's store and `/config` rows. */
function prefsOf($: EngineInterface): Prefs {
  return {
    kept: key => $.store.get(key),
    forget: key => $.store.delete(key),
    write: (field, value) => $.config.set({ key: `hitokoto.${field}`, value }),
  }
}

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

/** Shown or hidden; the `visible` row keeps it. */
async function show($: EngineInterface, isShown: boolean): Promise<void> {
  if ((await read($, isHidden)) === !isShown) return
  await update($, isHidden, () => !isShown)
  await persist(prefsOf($), 'visible', isShown)
}

// Before 0.4 `/hitokoto off` was kept in the store; it is the `visible` row now.
const STORE_MOVES = { isHidden: (kept: unknown) => ['visible', kept !== true] as const }

export const register: Register = (on, options) => {
  const config = readConfig(options)
  const { url, mode } = config
  const isDaily = mode === 'daily'

  on('session.start', async ($, e, next) => {
    const settings = (await $.settings.read().catch(() => ({}))) as { language?: unknown }
    const locale = await Promise.all([
      $.env.get('LC_ALL').catch(() => undefined),
      $.env.get('LC_MESSAGES').catch(() => undefined),
      $.env.get('LANG').catch(() => undefined),
    ])
    setLang(resolveLanguage(config.language, settings.language, locale))
    await $.command.register({
      name: 'hitokoto',
      description: m('cmd.description'),
      argumentHint: '[off|on]',
    })
    const kept = await keptRows(prefsOf($), STORE_MOVES)
    await update($, isHidden, () => !(kept.visible ?? config.isVisible))

    // Not awaited: session.start holds the first prompt until it settles.
    if (isDaily) {
      void showDaily($, url)
      $.clock.every(DAY_CHECK_MS, () => void showDaily($, url))
    } else {
      void fetchNew($, url, false)
      if (mode === 'interval') {
        $.clock.every(config.intervalMs, () => void fetchNew($, url, false))
      }
    }

    const result = await next(e)
    await migrateStore(prefsOf($), STORE_MOVES)
    return result
  })

  on('prompt.submit', async ($, e, next) => {
    if (await read($, isPicking)) await update($, isPicking, () => false)
    if (mode === 'prompt') void fetchNew($, url, false)
    return next(e)
  })

  on('command.run', { command: 'hitokoto' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'off' || arg === 'on') {
      await show($, arg === 'on')
      return { text: m(arg === 'off' ? 'cmd.hidden' : 'cmd.shown') }
    }

    const error = await fetchNew($, url, isDaily)
    await show($, true)
    if (error) {
      return { text: m('error.fetch', { error }) }
    }
    const q = await read($, quote)
    return { text: q ? `${q.text} ${attribution(q)}`.trim() : m('error.fetch', { error: m('error.parse') }) }
  })

  // A picker (`/` commands, `@` files) opens above the band: the band steps aside meanwhile.
  on('prompt.edit', async ($, e, next) => {
    const box = await next(e)
    const isOpen = isPickerOpen(box.text, box.cursor)
    if ((await read($, isPicking)) !== isOpen) await update($, isPicking, () => isOpen)
    return box
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const q = await read($, quote)
    if (e.props.hasSurvey || q === null || (await read($, isHidden)) || (await read($, isPicking))) {
      return next(e)
    }

    const ui = $.ui.resolve(e)
    const { Box, Text } = ui
    const by = attribution(q)
    const line = (
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        <Text dimColor italic>『{q.text}』</Text>
        {by ? <Text dimColor>{by}</Text> : null}
      </Box>
    )
    return stackAbove(ui, line, await next(e))
  })
}
