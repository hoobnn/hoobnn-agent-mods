// hud's options (plugin.json `userConfig`), read once into a typed config.
// The HUD's language and layout stay claude-hud's own config file's.
import type { PluginOptions } from 'claude-code'

import { parseThresholds } from './extras.js'
import { count, flag, oneOf, text } from './kit/options.js'
import { findTheme, THEMES, type Theme } from './themes.js'

export type Config = {
  isVisible: boolean
  /** A HUD button in the prompt footer. */
  hasFooterButton: boolean
  position: 'above' | 'below'
  theme: Theme
  hasMascot: boolean
  /** claude-hud's `--extra-cmd`. */
  extraCmd: string
  /** Registers `mcp__hud__hud_debug`. */
  isDebug: boolean
  /** A turn at least this long toasts when it ends; 0 is off. */
  notifyMs: number
  hasChime: boolean
  contextAlerts: number[]
  usageAlerts: number[]
  hasForecast: boolean
  budgetUsd: number
  hasHistory: boolean
  /** Summarize after the first turn and every this many; 0 is off. */
  summaryEvery: number
  gitDirtyWarn: number
  gitAheadWarn: number
  hasAgents: boolean
}

export function readConfig(options: PluginOptions): Config {
  return {
    isVisible: flag(options.visible, true),
    hasFooterButton: flag(options.footerButton, true),
    position: oneOf(options.position, ['above', 'below'], 'above'),
    theme: findTheme(options.theme) ?? THEMES[0]!,
    hasMascot: flag(options.showMascot, true),
    extraCmd: text(options.extraCmd),
    isDebug: flag(options.debug, false),
    notifyMs: count(options.notifyAfterSeconds, 0, { min: 0 }) * 1000,
    hasChime: flag(options.notifySound, true),
    contextAlerts: parseThresholds(text(options.contextAlerts)),
    usageAlerts: parseThresholds(text(options.usageAlerts)),
    hasForecast: flag(options.showForecast, true),
    budgetUsd: count(options.dailyBudgetUsd, 0, { min: 0 }),
    hasHistory: flag(options.showHistory, false),
    summaryEvery: count(options.summaryEveryTurns, 5, { min: 0, isInteger: true }),
    gitDirtyWarn: count(options.gitDirtyWarn, 20, { min: 0 }),
    gitAheadWarn: count(options.gitAheadWarn, 5, { min: 0 }),
    hasAgents: flag(options.showAgents, false),
  }
}
