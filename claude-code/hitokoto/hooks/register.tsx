import { atom, derive, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Quote } from '../types'
import { readConfig } from './config'
import type { Config } from './config'
import { m, setLang } from './i18n'
import { isPickerOpen, stackAbove } from './kit/band'
import { resolveLanguage } from './kit/lang'
import { keptRows, migrateStore, persist } from './kit/prefs'
import type { Prefs } from './kit/prefs'
import { attribution, localDate, parseQuote } from './parse'

const quote = atom({ plugin: 'hitokoto', key: 'quote' } as const, null)
// Set this session by `/hitokoto` or session.start; null in a session resumed or
// cleared, which gets no session.start: `isHidden` is the `visible` row's then.
const hiddenSet = atom({ plugin: 'hitokoto', key: 'isHidden' } as const, null as boolean | null)
// The `visible` row's, set in register.
let isRowHidden = false
const isHidden = derive([hiddenSet], set => set ?? isRowHidden)
// True while a picker is open above the band (see kit/band).
const isPicking = atom({ plugin: 'hitokoto', key: 'isPicking' } as const, false)

// How often daily mode looks whether the date has turned.
const DAY_CHECK_MS = 10 * 60_000
// A request that has not answered by then counts as failed.
const FETCH_TIMEOUT_MS = 10_000
/** Below this many columns (a phone over a remote terminal) the line and its source flow as one text. */
const NARROW_COLUMNS = 60

/** The kit's hold on this mod's store and `/config` rows. */
function prefsOf($: EngineInterface): Prefs {
  return {
    kept: key => $.store.get(key),
    forget: key => $.store.delete(key),
    write: (field, value) => $.config.set({ key: `hitokoto.${field}`, value }),
  }
}

// One request at a time: a slow API or a burst of prompts never stacks them up.
let inFlight: Promise<string | null> | null = null

// A failed fetch keeps the line already shown; the error goes back to /hitokoto.
function refresh($: EngineInterface, url: string): Promise<string | null> {
  inFlight ??= request($, url).finally(() => {
    inFlight = null
  })
  return inFlight
}

async function request($: EngineInterface, url: string): Promise<string | null> {
  try {
    const timeout = $.clock.sleep(FETCH_TIMEOUT_MS).then(() => null)
    const response = await Promise.race([$.http.fetch(url), timeout])
    if (response === null) {
      return `timed out after ${FETCH_TIMEOUT_MS / 1000}s`
    }
    const { ok, status, text } = response
    if (!ok) {
      return `HTTP ${status}`
    }
    const fresh = parseQuote(text)
    if (!fresh) {
      return m('error.parse')
    }
    await update($, quote, () => fresh)
    await $.store.set('last', fresh)
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

// The last line any session fetched, shown while a new one is on its way (or offline).
async function showLast($: EngineInterface): Promise<void> {
  const kept = (await $.store.get('last')) as Quote | undefined
  if (kept?.text && (await read($, quote)) === null) await update($, quote, () => kept)
}

// A timer's fetch, skipped while the band is hidden: no requests nobody sees.
async function whenShown($: EngineInterface, fn: () => Promise<unknown>): Promise<void> {
  if (!(await read($, isHidden))) await fn()
}

/** Shown or hidden; the `visible` row keeps it. */
async function show($: EngineInterface, isShown: boolean): Promise<void> {
  if ((await read($, isHidden)) === !isShown) return
  await update($, hiddenSet, () => !isShown)
  await persist(prefsOf($), 'visible', isShown)
}

// Before 0.4 `/hitokoto off` was kept in the store; it is the `visible` row now.
const STORE_MOVES = { isHidden: (kept: unknown) => ['visible', kept !== true] as const }

// Started once per load: at session.start where the session draws, else when the
// first surface attaches.
let isStarted = false

async function start($: EngineInterface, config: Config): Promise<void> {
  if (isStarted) return
  isStarted = true
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
  await update($, hiddenSet, () => !(kept.visible ?? config.isVisible))

  // Not awaited: session.start holds the first prompt until it settles.
  if (config.mode === 'daily') {
    void showDaily($, config.url)
    $.clock.every(DAY_CHECK_MS, () => void whenShown($, () => showDaily($, config.url)))
  } else {
    await showLast($)
    void fetchNew($, config.url, false)
    if (config.mode === 'interval') {
      $.clock.every(config.intervalMs, () => void whenShown($, () => fetchNew($, config.url, false)))
    }
  }
}

export const register: Register = (on, options) => {
  const config = readConfig(options)
  isRowHidden = !config.isVisible
  const { url, mode } = config
  const isDaily = mode === 'daily'

  on('session.start', async ($, e, next) => {
    // `-p` runs and the SDK draw no band: nothing to fetch for.
    if (!e.isInteractive && (await $.session.surfaces()).length === 0) return next(e)
    await start($, config)
    const result = await next(e)
    await migrateStore(prefsOf($), STORE_MOVES)
    return result
  })

  // The desktop app hosts its sessions headless and attaches once they are up.
  on('session.attach', async ($, e, next) => {
    if (!isStarted) {
      await start($, config)
      await migrateStore(prefsOf($), STORE_MOVES)
    }
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (await read($, isPicking)) await update($, isPicking, () => false)
    if (mode === 'prompt') void whenShown($, () => fetchNew($, url, false))
    return next(e)
  })

  on('command.run', { command: 'hitokoto' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'off' || arg === 'on') {
      await show($, arg === 'on')
      // Hidden, the timers skipped their fetches: back on, the line is brought up to date.
      if (arg === 'on') void (isDaily ? showDaily($, url) : fetchNew($, url, false))
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
  // A change no key made (a history recall, a clear, a fill) opens or closes one too.
  on('prompt.change', async ($, e, next) => {
    const isOpen = isPickerOpen(e.text, e.cursor)
    if ((await read($, isPicking)) !== isOpen) await update($, isPicking, () => isOpen)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const q = await read($, quote)
    if (e.props.hasSurvey || q === null || (await read($, isHidden)) || (await read($, isPicking))) {
      return next(e)
    }

    const ui = $.ui.resolve(e)
    const { Box, Button, Text } = ui
    const by = attribution(q)
    // A click brings a new line; daily mode keeps today's.
    const again = isDaily ? null : <Button key="hitokoto-next" plain dimColor label="↻" onPress={() => void fetchNew($, url, false)} />
    // Narrow (a phone), the source wrapping whole under the line leaves half rows (a lone `』`): the line
    // and its source flow as one text, its own spaces unbroken so a wrap falls before it, the ↻ ahead.
    const line = e.props.bodyColumns < NARROW_COLUMNS ? (
      <Box flexDirection="row" columnGap={1}>
        {again}
        <Box flexShrink={1}>
          <Text dimColor italic>{`『${q.text}』${by ? ` ${by.replace(/ /g, '\u00a0')}` : ''}`}</Text>
        </Box>
      </Box>
    ) : (
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        <Text dimColor italic>『{q.text}』</Text>
        {by ? <Text dimColor>{by}</Text> : null}
        {again}
      </Box>
    )
    return stackAbove(ui, line, await next(e), e.surface)
  })
}
