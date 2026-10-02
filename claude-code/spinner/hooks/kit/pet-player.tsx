// Generated from claude-code/kit/pet-player.tsx by scripts/sync-kit.sh: edit the source, then re-run it.
// Plays a DockPet's frames on the drawing thread (see kit/pet.tsx); a click
// on it posts `{ pat: true }` to the plugin that drew it.
import type { ClientModule } from 'claude-code'

import type { DockPet } from '../../types'

type State = { t: number; id: string }

const PetPlayer: ClientModule<DockPet, State> = (pet, surface) => {
  const { Box, Text } = surface.elements
  if (surface.state === undefined) {
    surface.every(pet.ms, () => {
      const s = surface.state ?? { t: 0, id: pet.id }
      surface.setState({ ...s, t: s.t + 1 })
    })
    surface.onPointer(event => {
      if (event.type === 'down') surface.post({ pat: true })
    })
    surface.setState({ t: 0, id: pet.id })
  }
  const s = surface.state ?? { t: 0, id: pet.id }
  // A new pet (another state, a pat) plays from its first frame.
  const t = s.id === pet.id ? s.t : 0
  if (s.id !== pet.id) surface.setState({ t: 0, id: pet.id })
  const rows = pet.frames[pet.order[t % pet.order.length] ?? 0] ?? []

  return (
    <Box flexDirection="column">
      {rows.map(row => (
        <Text wrap="truncate">
          {row.map(seg => (
            <Text color={seg.c} backgroundColor={seg.bg} bold={seg.b} dimColor={seg.d}>
              {seg.text}
            </Text>
          ))}
        </Text>
      ))}
    </Box>
  )
}

export default PetPlayer
