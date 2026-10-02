// Generated from claude-code/kit/pet.tsx by scripts/sync-kit.sh: edit the source, then re-run it.
// The companion pet wherever it stands. spinner owns it: it publishes the pet
// as plain data (`spinner.dock`, a DockPet: its frames, bubble and stats) and
// draws it itself above the prompt; hud, below the prompt, may give it a place
// beside its rows, and says so in `hud.dock`. Either one draws the block here,
// the frames played by the Client module `kit/pet-player.tsx`.
import type { Elements, RenderElement } from 'claude-code'

import type { DockPet } from '../../types'

/** Cells the bubble gets at least beside the pet when docked. */
export const LABEL_MIN = 14
/** Room a docked pet must gain before it moves in, so a row's length changing does not toss it back and forth. */
export const DOCK_SLACK = 6

/** Cells `text` takes as the terminal draws it: CJK, fullwidth forms and emoji two, the rest (box drawing and blocks included) one. */
export function cellWidth(text: string): number {
  let w = 0
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    const isWide =
      (cp >= 0x1100 && cp <= 0x115f) ||
      (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe30 && cp <= 0xfe4f) ||
      (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6) ||
      (cp >= 0x1f300 && cp <= 0x1faff) ||
      (cp >= 0x20000 && cp <= 0x3fffd)
    w += isWide ? 2 : 1
  }
  return w
}

/** Whether the pet fits beside rows `rowWidth` wide in `columns`; once docked it stays while it fits at all. */
export function dockFits(rowWidth: number, columns: number, petWidth: number, isDocked: boolean): boolean {
  const spare = columns - rowWidth - 2 - petWidth - LABEL_MIN
  return spare >= (isDocked ? 0 : DOCK_SLACK)
}

const TONE: Record<DockPet['tone'], { color?: string; bold?: boolean; dimColor?: boolean }> = {
  plain: { color: '#b8b8be' },
  ask: { color: '#ffd166', bold: true },
  error: { color: '#e63946' },
  aborted: { color: '#adb5bd' },
  sleep: { color: '#6c757d', dimColor: true },
}

type Ui = Pick<Elements['terminal'], 'Box' | 'Text' | 'Client'>

/** The pet in one row, for a band too short or narrow for its block: `mascot`, the bubble, the stats. */
export function drawPetLine(ui: Pick<Ui, 'Box' | 'Text'>, pet: DockPet, mascot: { text: string; color?: string }): RenderElement {
  const { Box, Text } = ui
  return (
    <Box flexDirection="row" columnGap={1} flexShrink={1}>
      <Text color={mascot.color} bold>{mascot.text}</Text>
      {pet.bubble ? (
        <Text {...TONE[pet.tone]} wrap="truncate-end">
          {pet.tone === 'ask' ? '❯ ' : ''}
          {pet.bubble}
        </Text>
      ) : null}
      <Text color="#6c757d">{pet.stats}</Text>
    </Box>
  )
}

/** The bubble and stats, right-aligned, then the pet: `rows` tall. */
export function drawPet(ui: Ui, pet: DockPet, key: string): RenderElement {
  const { Box, Text, Client } = ui
  return (
    <Box flexDirection="row" flexShrink={1} columnGap={1}>
      <Box flexDirection="column" alignItems="flex-end" flexShrink={1}>
        <Text color="#6c757d" wrap="truncate-end">{pet.stats}</Text>
        {pet.bubble ? (
          <Text {...TONE[pet.tone]} wrap="truncate-end">
            {pet.tone === 'ask' ? '❯ ' : ''}
            {pet.bubble}
          </Text>
        ) : null}
      </Box>
      <Client key={key} module="./pet-player.tsx" width={pet.width} props={pet} />
    </Box>
  )
}
