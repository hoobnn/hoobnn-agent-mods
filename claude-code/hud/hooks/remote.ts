// Remote Control: whether the session's bridge is on (the engine records it in
// `sessions/<pid>.json`, the mod API does not report it) and the HUD's label
// for it and the clients attached.

// First: claude-hud's modules read Node's globals as they load.
import './shims/globals.js'

import type { HudLine, Remote } from '../types'
import { m } from './i18n.js'
import { live } from './live.js'
import type { Io } from './shims/host.js'
import { claudeConfigDir } from './stdin.js'

type SessionEntry = { sessionId?: unknown; bridgeSessionId?: unknown }

/**
 * Remote Control's session id, or null when it is off. The engine records it
 * as `bridgeSessionId` in `sessions/<pid>.json`; the mod API does not report it.
 */
export async function remoteControl(io: Io, id: string): Promise<string | null> {
  const readEntry = (path: string) =>
    io.read(path).then(text => JSON.parse(text) as SessionEntry, () => null)
  const bridgeOf = (entry: SessionEntry) => (typeof entry.bridgeSessionId === 'string' ? entry.bridgeSessionId : null)
  if (live.sessionFile) {
    const entry = await readEntry(live.sessionFile)
    if (entry?.sessionId === id) return bridgeOf(entry)
    live.sessionFile = undefined
  }
  const dir = `${claudeConfigDir()}/sessions`
  for (const file of await io.list(dir).catch(() => [])) {
    if (file.kind !== 'file' || !/^\d+\.json$/.test(file.name)) continue
    const entry = await readEntry(`${dir}/${file.name}`)
    if (entry?.sessionId !== id) continue
    live.sessionFile = `${dir}/${file.name}`
    return bridgeOf(entry)
  }
  return null
}

/**
 * A client known only by the messages it sends over Remote Control: the
 * Claude app and claude.ai raise no `session.attach`.
 */
export const BRIDGE = 'bridge'

function surfaceLabel(surface: string): string {
  if (surface === 'mobile') return m('surface.mobile')
  if (surface === 'desktop') return m('surface.desktop')
  return surface === 'vscode' ? 'VS Code' : surface
}

/**
 * ` │ ⇄ Remote Control` (linked to the session on claude.ai), then who is attached
 * by surface (`phone · web/desktop×2`). A client that has not attached or sent
 * a message is unknown, so nothing is said of one.
 */
export function rcSpans(bridgeSessionId: string | null, attached: readonly Remote[]): HudLine {
  if (!bridgeSessionId) return []
  const spans: HudLine = [
    { text: ' │ ' },
    { text: m('rc.label'), color: 'green', href: `https://claude.ai/code/${bridgeSessionId}` },
  ]
  // A client that attached names its surface; the message-only one is just there.
  const named = attached.filter(r => r.surface !== BRIDGE)
  if (named.length === 0) {
    if (attached.length > 0) spans.push({ text: ` ${m('rc.connected')}`, color: 'cyan' })
    return spans
  }
  const counts = new Map<string, number>()
  for (const r of named) {
    const label = surfaceLabel(r.surface)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  const who = [...counts].map(([label, n]) => (n > 1 ? `${label}×${n}` : label)).join(' · ')
  spans.push({ text: ` ${m('rc.attached', { who })}`, color: 'cyan' })
  return spans
}
