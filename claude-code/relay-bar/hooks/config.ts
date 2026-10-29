// relay-bar's options (plugin.json `userConfig`), read once into a typed config.
import type { PluginOptions } from 'claude-code'

import { flag, text } from './kit/options'

export type Config = {
  isVisible: boolean
  /** A toast when a run ends. */
  hasToast: boolean
  /** `auto` or a language; the kit resolves it (kit/lang.ts). */
  language: string
}

export function readConfig(options: PluginOptions): Config {
  return {
    isVisible: flag(options.visible, true),
    hasToast: flag(options.toast, true),
    language: text(options.language, 'auto'),
  }
}
