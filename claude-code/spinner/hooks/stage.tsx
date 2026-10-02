// The band's scene: the theme's animation while a turn runs, or its finale
// once the turn has ended. Runs on the drawing thread, one frame every STAGE_MS.
import type { ClientModule } from 'claude-code'

import { STAGE_MS, finaleScene, segments, themeOf } from './themes'
import type { Finale } from './themes'

export type StageProps = { theme: string; columns: number; finale?: Finale; label?: string }

const Stage: ClientModule<StageProps, number> = (props, surface) => {
  const { Box, Text } = surface.elements
  if (surface.state === undefined) {
    let tick = 0
    surface.every(STAGE_MS, () => surface.setState(++tick))
    surface.setState(0)
  }
  const t = surface.state ?? 0
  const theme = themeOf(props.theme)
  const w = Math.max(10, Math.min(surface.columns || props.columns, props.columns) - 3)
  const grid = props.finale ? finaleScene(theme, props.finale, props.label ?? '', t, w) : theme.scene(t, w)

  return (
    <Box flexDirection="column">
      {grid.map(row => (
        <Text wrap="truncate">
          {segments(row).map(seg => <Text color={seg.c} bold={seg.b} dimColor={seg.d}>{seg.text}</Text>)}
        </Text>
      ))}
    </Box>
  )
}

export default Stage
