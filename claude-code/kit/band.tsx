// A mod's rows in the band above the prompt. Several mods draw there, so each
// stacks its rows over what the rest of the chain drew (`await next(e)`)
// instead of replacing it, two cells in, as the engine indents the lines under
// the prompt. The hook stays the mod's own (`on('ui.render', ...)` is spelled
// in the hooks module): it yields to a survey, draws, and hands both here.
import type { Elements, RenderElement } from 'claude-code'

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
