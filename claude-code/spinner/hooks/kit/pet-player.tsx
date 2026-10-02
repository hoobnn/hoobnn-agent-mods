// Generated from claude-code/kit/pet-player.tsx by scripts/sync-kit.sh: edit the source, then re-run it.
// Plays a DockPet's frames on the drawing thread (see kit/pet.tsx); a click
// on it posts `{ pat: true }` to the plugin that drew it.
import type { ClientModule } from 'claude-code'

import type { DockPet } from '../../types'

/** The frame shown, as `state`: a redraw only when it changes. */
type State = number

/** Each instance's tick and latest pet: the clock's callback outlives the props it began with. */
const players = new WeakMap<object, { t: number; pet: DockPet }>()

const frameAt = (pet: DockPet, t: number) => pet.order[t % pet.order.length] ?? 0

const PetPlayer: ClientModule<DockPet, State> = (pet, surface) => {
  const { Box, Text } = surface.elements
  let player = players.get(surface)
  if (player === undefined) {
    player = { t: 0, pet }
    players.set(surface, player)
    const p = player
    // Ticks go on all the time; most of an idle loop repeats one frame, which costs no redraw.
    surface.every(pet.ms, () => {
      const was = frameAt(p.pet, p.t)
      p.t += 1
      const now = frameAt(p.pet, p.t)
      if (now !== was) surface.setState(now)
    })
    surface.onPointer(event => {
      if (event.type === 'down') surface.post({ pat: true })
    })
  }
  // A new pet (another state, a pat) plays from its first frame.
  if (player.pet.id !== pet.id) player.t = 0
  player.pet = pet
  const rows = pet.frames[frameAt(pet, player.t)] ?? []

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
