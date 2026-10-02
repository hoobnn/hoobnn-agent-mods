// The band's scene: the theme's scene while a turn runs, its finale once the
// turn has ended. Runs on the drawing thread. The pet beside it is drawn
// apart (kit/pet-player.tsx), so it can stand beside the HUD as well.
import type { ClientModule } from 'claude-code'

import { STAGE_MS, finaleScene, segments, themeOf } from './themes'
import type { Act, Finale } from './themes'

export type StageProps = {
  theme: string
  /** Cells the scene takes across. */
  columns: number
  act: Act
  finale?: Finale
  label?: string
  /** One frame, never redrawn (reduced motion). */
  still?: boolean
}

const Stage: ClientModule<StageProps, number> = (props, surface) => {
  const { Box, Text } = surface.elements
  if (surface.state === undefined && !props.still) {
    let tick = 0
    surface.every(STAGE_MS, () => surface.setState(++tick))
    surface.setState(0)
  }
  const t = surface.state ?? 0
  const theme = themeOf(props.theme)
  const w = Math.max(16, Math.min(surface.columns || props.columns, props.columns))
  const rows = props.finale ? finaleScene(theme, props.finale, props.label ?? '', t, w) : theme.scene(t, w, props.act)

  return (
    <Box flexDirection="column">
      {rows.map(row => (
        <Text wrap="truncate">
          {segments(row).map(seg => (
            <Text color={seg.c} backgroundColor={seg.bg} bold={seg.b} dimColor={seg.d}>
              {seg.text}
            </Text>
          ))}
        </Text>
      ))}
    </Box>
  )
}

export default Stage
