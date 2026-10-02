// The band: the theme's scene while a turn runs, its finale once the turn has
// ended, and the companion's row beneath. Runs on the drawing thread; a click
// on it pats the companion.
import type { ClientModule } from 'claude-code'

import { IDLE_MS, STAGE_MS, finaleScene, petRow, segments, themeOf } from './themes'
import type { Act, Finale, Grid, PetView } from './themes'

export type StageProps = {
  theme: string
  columns: number
  /** Draw the scene (or the finale) above the companion row. */
  hasScene: boolean
  act: Act
  finale?: Finale
  label?: string
  pet?: PetView
  /** Changes with each pat: hearts float for a moment. */
  pat?: string
  /** Between turns: a slow clock. */
  isIdle?: boolean
}

type State = { t: number; pat?: string; patT: number }

const HEART_TICKS = 12
const IDLE_HEART_TICKS = 5

const Stage: ClientModule<StageProps, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  const tick = () => {
    const s = surface.state ?? { t: 0, patT: -HEART_TICKS }
    surface.setState({ ...s, t: s.t + 1 })
  }
  if (surface.state === undefined) {
    // Between turns nothing moves but hearts after a pat: no clock until then.
    if (!props.isIdle) surface.every(STAGE_MS, tick)
    surface.onPointer(event => {
      if (event.type === 'down') surface.post({ pat: true })
    })
    surface.setState({ t: 0, pat: props.pat, patT: -HEART_TICKS })
  }
  const s = surface.state ?? { t: 0, patT: -HEART_TICKS }
  if (props.pat !== s.pat) {
    surface.setState({ ...s, pat: props.pat, patT: s.t })
    if (props.isIdle) {
      let left = IDLE_HEART_TICKS
      const stop = surface.every(IDLE_MS, () => {
        tick()
        if (--left <= 0) stop()
      })
    }
  }

  const t = s.t
  const theme = themeOf(props.theme)
  const w = Math.max(16, Math.min(surface.columns || props.columns, props.columns) - 3)
  const rows: Grid = []
  if (props.hasScene) {
    rows.push(...(props.finale ? finaleScene(theme, props.finale, props.label ?? '', t, w) : theme.scene(t, w, props.act)))
  }
  if (props.pet) {
    const since = t - s.patT
    const hearts = since >= 0 && since < (props.isIdle ? IDLE_HEART_TICKS : HEART_TICKS) ? since + 1 : 0
    rows.push(...petRow(theme, props.pet, t, w, hearts))
  }

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
