import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Node, Snapshot } from '../types'
import { m, resolveLanguage, setLang } from './i18n'
import { parseStatus, selectNodes } from './parse'

const snapshot = atom({ plugin: 'ts-band', key: 'snapshot' } as const, null)
const isHidden = atom({ plugin: 'ts-band', key: 'isHidden' } as const, false)

// Where the CLI is looked for when the `tailscalePath` option is empty: PATH,
// then the Homebrew and macOS app locations a GUI-started session's PATH may lack.
const TAILSCALE_CANDIDATES = [
  'tailscale',
  '/usr/local/bin/tailscale',
  '/opt/homebrew/bin/tailscale',
  '/Applications/Tailscale.app/Contents/MacOS/Tailscale',
]

function linkText(node: Node): string {
  if (node.link === 'derp') return node.via ? `DERP-${node.via}` : 'DERP'
  return m(node.link === 'direct' ? 'link.direct' : node.link === 'peer-relay' ? 'link.relay' : 'link.offline')
}

export const register: Register = (on, options) => {
  const configuredPath = typeof options.tailscalePath === 'string' ? options.tailscalePath.trim() : ''
  const candidates = configuredPath ? [configuredPath] : TAILSCALE_CANDIDATES
  const intervalSeconds = typeof options.intervalSeconds === 'number' ? options.intervalSeconds : 60
  const intervalMs = Math.max(10, intervalSeconds) * 1000
  const nodesSpec = typeof options.nodes === 'string' ? options.nodes : ''
  const hideOffline = options.hideOffline === true

  on('session.start', async ($, e, next) => {
    const settings = (await $.settings.read().catch(() => ({}))) as { language?: unknown }
    const locale = await Promise.all([
      $.env.get('LC_ALL').catch(() => undefined),
      $.env.get('LC_MESSAGES').catch(() => undefined),
      $.env.get('LANG').catch(() => undefined),
    ])
    setLang(resolveLanguage(options.language, settings.language, locale))
    await $.command.register({
      name: 'ts',
      description: m('cmd.description'),
      argumentHint: '[off|on]',
    })
    // Hidden or shown is kept across sessions in the mod's store.
    if ((await $.store.get('isHidden')) === true) {
      await update($, isHidden, () => true)
    }

    // The first candidate that runs is kept for the session.
    let tailscale: string | null = null
    const status = async () => {
      for (const candidate of tailscale ? [tailscale] : candidates) {
        try {
          const out = await $.process.run([candidate, 'status', '--json'], { timeoutMs: 10_000 })
          tailscale = candidate
          return out
        } catch {
          // Not found or hung: try the next location.
        }
      }
      throw new Error(`tailscale not found (tried ${candidates.join(', ')})`)
    }

    const refresh = async () => {
      const previous = await read($, snapshot)
      let fresh: Snapshot
      try {
        const { exitCode, stdout, stderr } = await status()
        fresh =
          exitCode === 0
            ? { nodes: selectNodes(parseStatus(stdout), nodesSpec), checkedAt: await $.clock.now(), error: null }
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

    // Not awaited: session.start holds the first prompt until it settles.
    void refresh()
    $.clock.every(intervalMs, () => void refresh())

    return next(e)
  })

  on('command.run', { command: 'ts' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const hidden = await update($, isHidden, v => (arg === 'off' ? true : arg === 'on' ? false : !v))
    await $.store.set('isHidden', hidden)

    return { text: m(hidden ? 'cmd.hidden' : 'cmd.shown') }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const snap = await read($, snapshot)
    if (e.props.hasSurvey || snap === null || (await read($, isHidden))) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    // Other bands (another mod's) draw beneath this one rather than being replaced.
    const below = await next(e)

    if (snap.error) {
      return (
        <Box flexDirection="column">
          <Box>
            <Text color="red">{m('error.read')}</Text>
            <Text dimColor wrap="truncate-end">{snap.error}</Text>
          </Box>
          {below}
        </Box>
      )
    }

    const online = snap.nodes.filter(n => n.isOnline).length
    const shown = hideOffline ? snap.nodes.filter(n => n.isOnline) : snap.nodes
    // Only what needs a look gets a place: nodes on a relay or DERP, and offline ones.
    const issues = shown.filter(n => !n.isOnline || n.link !== 'direct')
    const isAllUp = online === snap.nodes.length

    return (
      <Box flexDirection="column">
        {issues.length === 0 && snap.nodes.length > 0 ? (
          <Box flexDirection="row" columnGap={1}>
            <Text bold>TS</Text>
            <Text color={isAllUp ? 'green' : 'yellow'}>●</Text>
            <Text>{online}/{snap.nodes.length}</Text>
            <Text dimColor>{m('link.direct')}</Text>
          </Box>
        ) : (
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
        )}
        {below}
      </Box>
    )
  })
}
