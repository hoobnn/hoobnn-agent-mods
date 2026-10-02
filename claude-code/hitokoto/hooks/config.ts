// hitokoto's options (plugin.json `userConfig`), read once into a typed config.
import type { PluginOptions } from 'claude-code'

import { count, flag, oneOf, text } from './kit/options'
import { hitokotoUrl } from './parse'

export const MODES = ['interval', 'daily', 'session', 'prompt'] as const
export type Mode = (typeof MODES)[number]

export type Config = {
  /** The API's URL, the `categories` option in its query. */
  url: string
  mode: Mode
  intervalMs: number
  isVisible: boolean
  /** `auto` or a language; the kit resolves it (kit/lang.ts). */
  language: string
}

export function readConfig(options: PluginOptions): Config {
  return {
    url: hitokotoUrl(text(options.categories)),
    mode: oneOf(options.refreshMode, MODES, 'interval'),
    intervalMs: count(options.intervalMinutes, 30, { min: 1 }) * 60_000,
    isVisible: flag(options.visible, true),
    language: text(options.language, 'auto'),
  }
}
