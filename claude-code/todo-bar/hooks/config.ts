// todo-bar's options (plugin.json `userConfig`), read once into a typed config.
import type { PluginOptions } from 'claude-code'

import { count, flag, text } from './kit/options'

export type Config = {
  isVisible: boolean
  hasNext: boolean
  /** Rows under the running task for the subagents still at work. */
  hasAgents: boolean
  /** Minutes after which the running task's time turns yellow; 0 never. */
  slowMinutes: number
  /** `auto` or a language; the kit resolves it (kit/lang.ts). */
  language: string
}

export function readConfig(options: PluginOptions): Config {
  return {
    isVisible: flag(options.visible, true),
    hasNext: flag(options.showNext, true),
    hasAgents: flag(options.showAgents, true),
    slowMinutes: count(options.slowMinutes, 10, { min: 0 }),
    language: text(options.language, 'auto'),
  }
}
