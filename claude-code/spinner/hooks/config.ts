// spinner's options (plugin.json `userConfig`), read once into a typed config.
import type { PluginOptions } from 'claude-code'

import { flag, oneOf, text } from './kit/options'
import { THEME_NAMES } from './themes'
import type { ThemeName } from './themes'

export type Choice = ThemeName | 'random'

export const CHOICES: readonly Choice[] = ['random', ...THEME_NAMES]

export type Config = {
  /** A theme, or `random` for a new one each session. */
  theme: Choice
  isVisible: boolean
  /** A Spinner button in the prompt footer. */
  hasFooterButton: boolean
  hasStage: boolean
  hasFinale: boolean
  hasCompanion: boolean
  /** Every animation drawn as one still frame. */
  isStill: boolean
  /** `auto` or a language; the kit resolves it (kit/lang.ts). */
  language: string
}

export function readConfig(options: PluginOptions): Config {
  return {
    theme: oneOf(options.theme, CHOICES, 'random'),
    isVisible: flag(options.visible, true),
    hasFooterButton: flag(options.footerButton, true),
    hasStage: flag(options.stage, true),
    hasFinale: flag(options.celebrate, true),
    hasCompanion: flag(options.companion, true),
    isStill: flag(options.reducedMotion, false),
    language: text(options.language, 'auto'),
  }
}
