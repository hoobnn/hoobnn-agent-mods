// Generated from claude-code/kit/band.tsx by scripts/sync-kit.sh: edit the source, then re-run it.
// A mod's rows in the band above the prompt. Several mods draw there, so each
// stacks its rows over what the rest of the chain drew (`await next(e)`)
// instead of replacing it, two cells in, as the engine indents the lines under
// the prompt. The hook stays the mod's own (`on('ui.render', ...)` is spelled
// in the hooks module): it yields to a survey, draws, and hands both here.
import type { Elements, RenderElement } from 'claude-code'

/**
 * Whether the prompt's draft has a picker open: a slash command being named
 * (`/sp`, before any space) or a file being mentioned (`@src/a`, the word at the
 * cursor). The engine draws the picker above the band, so a band steps aside
 * while one is open and the picker sits right on the prompt.
 */
export function isPickerOpen(text: string, cursor = text.length): boolean {
  const before = text.slice(0, cursor)
  return /^\/\S*$/.test(before) || /(^|\s)@\S*$/.test(before)
}

export function stackAbove(ui: Pick<Elements['terminal'], 'Box'>, mine: RenderElement, below: RenderElement): RenderElement {
  const { Box } = ui
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" paddingLeft={2}>
        {mine}
      </Box>
      {below}
    </Box>
  )
}
