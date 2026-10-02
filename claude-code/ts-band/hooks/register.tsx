import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, Register, RenderElement } from 'claude-code'

import type { Node, Snapshot } from '../types'
import { readConfig } from './config'
import type { Config } from './config'
import { m, setLang } from './i18n'
import { isPickerOpen, stackAbove } from './kit/band'
import { resolveLanguage } from './kit/lang'
import { keptRows, migrateStore, persist, switchArg } from './kit/prefs'
import type { Prefs } from './kit/prefs'
import { parseStatus, selectNodes } from './parse'

const snapshot = atom({ plugin: 'ts-band', key: 'snapshot' } as const, null)
const isHidden = atom({ plugin: 'ts-band', key: 'isHidden' } as const, false)
// True while a picker is open above the band (see kit/band).
const isPicking = atom({ plugin: 'ts-band', key: 'isPicking' } as const, false)

function linkText(node: Node): string {
  if (node.link === 'derp') return node.via ? `DERP-${node.via}` : 'DERP'
  return m(node.link === 'direct' ? 'link.direct' : node.link === 'peer-relay' ? 'link.relay' : 'link.offline')
}

/** The kit's hold on this mod's store and `/config` rows. */
function prefsOf($: EngineInterface): Prefs {
  return {
    kept: key => $.store.get(key),
    forget: key => $.store.delete(key),
    write: (field, value) => $.config.set({ key: `ts-band.${field}`, value }),
  }
}

/** Reads into the snapshot sooner than the timer would, when it is older than this. */
const PROMPT_REFRESH_MS = 10_000

/**
 * Reads `tailscale status` on a timer into the snapshot, toasting nodes that
 * come up or go down. Returns a read to run now, skipped while one runs or the
 * snapshot is fresh.
 */
function startPolling($: EngineInterface, config: Config): () => void {
  // The first candidate that runs is kept for the session.
  let tailscale: string | null = null
  const status = async () => {
    for (const candidate of tailscale ? [tailscale] : config.tailscale) {
      try {
        const out = await $.process.run([candidate, 'status', '--json'], { timeoutMs: 10_000 })
        tailscale = candidate
        return out
      } catch {
        // Not found or hung: try the next location.
      }
    }
    throw new Error(`tailscale not found (tried ${config.tailscale.join(', ')})`)
  }

  const refresh = async () => {
    const previous = await read($, snapshot)
    let fresh: Snapshot
    try {
      const { exitCode, stdout, stderr } = await status()
      fresh =
        exitCode === 0
          ? { nodes: selectNodes(parseStatus(stdout), config.nodes), checkedAt: await $.clock.now(), error: null }
          : { nodes: [], checkedAt: await $.clock.now(), error: stderr.trim() || `exit ${exitCode}` }
    } catch (err) {
      fresh = { nodes: [], checkedAt: await $.clock.now(), error: String(err) }
    }

    if (previous && !previous.error && !fresh.error) {
      const was = new Map(previous.nodes.map(n => [n.name, n.isOnline]))
      for (const node of fresh.nodes) {
        if (was.has(node.name) && was.get(node.name) !== node.isOnline) {
          $.ui.toast(m(node.isOnline ? 'toast.up' : 'toast.down', { name: node.name }))
        }
      }
    }
    await update($, snapshot, () => fresh)
  }

  let isRunning = false
  const run = async () => {
    if (isRunning) return
    isRunning = true
    try {
      await refresh()
    } finally {
      isRunning = false
    }
  }

  // Not awaited: session.start holds the first prompt until it settles.
  void run()
  $.clock.every(config.intervalMs, () => void run())
  return async () => {
    const snap = await read($, snapshot)
    if (snap && (await $.clock.now()) - snap.checkedAt < PROMPT_REFRESH_MS) return
    await run()
  }
}

// Before 0.6 `/ts off` was kept in the store; it is the `visible` row now.
const STORE_MOVES = { isHidden: (kept: unknown) => ['visible', kept !== true] as const }

export const register: Register = (on, options) => {
  const config = readConfig(options)
  // Set in session.start: a read now, for each prompt the person sends.
  let refreshNow: () => Promise<void> | void = () => {}

  on('session.start', async ($, e, next) => {
    const settings = (await $.settings.read().catch(() => ({}))) as { language?: unknown }
    const locale = await Promise.all([
      $.env.get('LC_ALL').catch(() => undefined),
      $.env.get('LC_MESSAGES').catch(() => undefined),
      $.env.get('LANG').catch(() => undefined),
    ])
    setLang(resolveLanguage(config.language, settings.language, locale))
    await $.command.register({ name: 'ts', description: m('cmd.description'), argumentHint: '[off|on]' })
    const kept = await keptRows(prefsOf($), STORE_MOVES)
    await update($, isHidden, () => !(kept.visible ?? config.isVisible))
    refreshNow = startPolling($, config)
    const result = await next(e)
    await migrateStore(prefsOf($), STORE_MOVES)
    return result
  })

  on('command.run', { command: 'ts' }, async ($, e) => {
    const was = await read($, isHidden)
    const hidden = await update($, isHidden, v => switchArg(e.args.trim().toLowerCase(), v))
    if (hidden !== was) await persist(prefsOf($), 'visible', !hidden)
    return { text: m(hidden ? 'cmd.hidden' : 'cmd.shown') }
  })

  // A picker (`/` commands, `@` files) opens above the band: the band steps aside meanwhile.
  on('prompt.edit', async ($, e, next) => {
    const box = await next(e)
    const isOpen = isPickerOpen(box.text, box.cursor)
    if ((await read($, isPicking)) !== isOpen) await update($, isPicking, () => isOpen)
    return box
  })
  on('prompt.submit', async ($, e, next) => {
    if (await read($, isPicking)) await update($, isPicking, () => false)
    // A new round: the nodes as they are now, not as the last tick saw them.
    void refreshNow()
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const snap = await read($, snapshot)
    if (e.props.hasSurvey || snap === null || (await read($, isHidden)) || (await read($, isPicking))) return next(e)
    const ui = $.ui.resolve(e)
    return stackAbove(ui, drawNodes(ui, snap, config), await next(e))
  })
}

/** The band's row: a short mark when every node shown is direct, else the nodes that need a look. */
function drawNodes(ui: Pick<Elements['terminal'], 'Box' | 'Text'>, snap: Snapshot, config: Config): RenderElement {
  const { Box, Text } = ui

  if (snap.error) {
    return (
      <Box>
        <Text color="red">{m('error.read')}</Text>
        <Text dimColor wrap="truncate-end">{snap.error}</Text>
      </Box>
    )
  }

  const online = snap.nodes.filter(n => n.isOnline).length
  const shown = config.isOfflineHidden ? snap.nodes.filter(n => n.isOnline) : snap.nodes
  // Only what needs a look gets a place: nodes on a relay or DERP, and offline ones.
  const issues = shown.filter(n => !n.isOnline || n.link !== 'direct')
  const isAllUp = online === snap.nodes.length

  if (issues.length === 0 && snap.nodes.length > 0) {
    return (
      <Box flexDirection="row" columnGap={1}>
        <Text bold>TS</Text>
        <Text color={isAllUp ? 'green' : 'yellow'}>●</Text>
        <Text>{online}/{snap.nodes.length}</Text>
        <Text dimColor>{m('link.direct')}</Text>
      </Box>
    )
  }
  return (
    <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
      <Text bold>TS {online}/{snap.nodes.length}</Text>
      {issues.map(node => (
        <Box key={node.name}>
          <Text color={node.isOnline ? 'yellow' : 'red'}>{node.isOnline ? '◐' : '○'} </Text>
          <Text dimColor={!node.isOnline}>{node.name} </Text>
          <Text dimColor>{linkText(node)}</Text>
        </Box>
      ))}
    </Box>
  )
}
