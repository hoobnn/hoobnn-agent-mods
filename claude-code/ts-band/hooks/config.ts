// ts-band's options (plugin.json `userConfig`), read once into a typed config.
import type { PluginOptions } from 'claude-code'

import { count, flag, text } from './kit/options'
import { parseNodeSpec } from './parse'
import type { NodePick } from './parse'

export type Config = {
  /** The CLI's locations, tried in order: the `tailscalePath` option, else the usual places. */
  tailscale: readonly string[]
  intervalMs: number
  nodes: readonly NodePick[]
  isOfflineHidden: boolean
  isVisible: boolean
  /** `auto` or a language; the kit resolves it (kit/lang.ts). */
  language: string
}

// Where the CLI is looked for when the `tailscalePath` option is empty: PATH,
// then the Homebrew and macOS app locations a GUI-started session's PATH may lack.
export const TAILSCALE_CANDIDATES = [
  'tailscale',
  '/usr/local/bin/tailscale',
  '/opt/homebrew/bin/tailscale',
  '/Applications/Tailscale.app/Contents/MacOS/Tailscale',
]

export function readConfig(options: PluginOptions): Config {
  const path = text(options.tailscalePath)
  return {
    tailscale: path ? [path] : TAILSCALE_CANDIDATES,
    intervalMs: count(options.intervalSeconds, 60, { min: 10 }) * 1000,
    nodes: parseNodeSpec(text(options.nodes)),
    isOfflineHidden: flag(options.hideOffline, false),
    isVisible: flag(options.visible, true),
    language: text(options.language, 'auto'),
  }
}
