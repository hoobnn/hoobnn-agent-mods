// What the mod tracks between passes in the module itself rather than in
// `$.state`: caches a reload finds again (the transcript's path, the session
// file), the last pass's output for the debug tool, and the band's width,
// which a render hook learns and may not write to state.

// First: claude-hud's modules read Node's globals as they load.
import './shims/globals.js'

import type { StdinData } from './hud/types.js'
import { setGlyphs } from './hud/render/theme.js'
import { THEMES, themeOverhead, type Theme } from './themes.js'

export const live = {
  transcriptPath: undefined as string | undefined,
  transcriptFor: undefined as string | undefined,
  columns: undefined as number | undefined,
  lastStdin: null as StdinData | null,
  lastError: null as string | null,
  lastLines: [] as string[],
  refreshMs: 0,
  // This process's `sessions/<pid>.json`, found by session id.
  sessionFile: undefined as string | undefined,
  bridgeSessionId: null as string | null,
  theme: THEMES[0]! as Theme,
}

/** Columns claude-hud and the extras row may fill, leaving room for the theme's span effects. */
export function fitColumns(): number | undefined {
  return live.columns ? Math.max(20, live.columns - themeOverhead(live.theme)) : undefined
}

export function useTheme(theme: Theme): void {
  live.theme = theme
  setGlyphs(theme.glyphs)
}
