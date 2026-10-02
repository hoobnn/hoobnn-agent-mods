// The mascot beside the spinner's word: runs on the drawing thread, one frame
// every SPRITE_MS, its frames padded to one width so the word never jitters.
import type { ClientModule } from 'claude-code'

import { SPRITE_MS, frame, hsl, poseOf, textWidth, padTo, themeOf } from './themes'

export type SpriteProps = { theme: string; mode: string; still?: boolean }

const Sprite: ClientModule<SpriteProps, number> = (props, surface) => {
  const { Text } = surface.elements
  if (surface.state === undefined && !props.still) {
    let tick = 0
    surface.every(SPRITE_MS, () => surface.setState(++tick))
    surface.setState(0)
  }
  const t = surface.state ?? 0
  const theme = themeOf(props.theme)
  const frames = theme.sprite[poseOf(props.mode)]
  const width = Math.max(...frames.map(textWidth))
  const text = padTo(frame(frames, t), width)

  if (!theme.isRainbow) {
    return <Text color={theme.color} bold wrap="truncate">{text}</Text>
  }
  return (
    <Text bold wrap="truncate">
      {Array.from(text).map((ch, i) => <Text color={hsl((i * 40 + t * 24) % 360, 0.95, 0.62)}>{ch}</Text>)}
    </Text>
  )
}

export default Sprite
