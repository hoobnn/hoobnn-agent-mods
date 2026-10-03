// receipt's options (plugin.json `userConfig`), read once into a typed config.
import type { PluginOptions } from 'claude-code'

import { count, flag, text } from './kit/options'

export type Config = {
  isVisible: boolean
  /** The same call failing this many times in a row toasts; 0 off. */
  repeatFailures: number
  /** A file edited back to what it was this many times toasts; 0 off. */
  flipFlops: number
  /** `auto` or a language; the kit resolves it (kit/lang.ts). */
  language: string
}

export function readConfig(options: PluginOptions): Config {
  return {
    isVisible: flag(options.visible, true),
    repeatFailures: count(options.repeatFailures, 3, { min: 0, isInteger: true }),
    flipFlops: count(options.flipFlops, 2, { min: 0, isInteger: true }),
    language: text(options.language, 'auto'),
  }
}
