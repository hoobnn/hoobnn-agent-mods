// The companion: a pixel pet three rows tall (6 px in half blocks), drawn the
// same wherever it stands (beside the HUD, or right-aligned above the prompt).
// A theme gives its body and where its eyes sit; blinking, breathing, the
// expressions and the props beside it are the same for every pet.
import { blank, canvas, cells, draw, mod, noise, plot, segments } from './cells'
import type { Canvas, Grid } from './cells'
import type { DockPet } from '../types'
import type { Act, Mood } from './themes'

export type PetState = Act | Mood

export type PetArt = {
  /** The body, 5 px tall: letters keyed in `colors`, `.` clear. Up to BODY_W wide. */
  body: readonly string[]
  /** The same body with its feet moved: a step while it works. */
  step?: readonly string[]
  colors: Record<string, string>
  /** Each eye's column in the body; an eye is 1 px wide, 2 px tall, from row `eyeRow`. */
  eyes: readonly number[]
  eyeRow: number
  /** The pupils' color, and the body's color where an eye closes. */
  eye: string
  lid: string
  /** The mouth's column and row, opened while it talks. */
  mouth?: readonly [x: number, y: number]
  /** Its cheeks' color when happy. */
  blush?: string
  /** Props beside it: sparks while a tool runs, dots while it thinks. */
  spark: string
}

/** Columns the pet takes: its props on the left, its body on the right. */
export const PROP_W = 4
export const BODY_W = 12
export const PET_W = PROP_W + BODY_W
export const PET_ROWS = 3
/** Milliseconds per frame of the pet. */
export const PET_MS = 140

const QUESTION = ['.YY.', '...Y', '..Y.', '....', '..Y.']
const HEART = ['P.P', 'PPP', '.P.']
const ZED = ['ZZZZ', '..Z.', '.Z..', 'ZZZZ']
const STAR = ['.S.', 'SSS', '.S.']

/** Frames in one loop of a state: long enough for a blink and a breath. */
export function loopOf(state: PetState): number {
  return state === 'sleep' ? 48 : state === 'think' || state === 'tool' || state === 'say' ? 24 : 40
}

/** The pet at tick `t` in `state`, `hearts` frames into a pat (0: none). */
export function petFrame(art: PetArt, state: PetState, t: number, hearts = 0): Grid {
  const cv = canvas(PET_W, PET_ROWS)
  const isBusy = state === 'tool' || state === 'say' || state === 'think'
  // Breathing: up a pixel for part of each beat, quicker while it works; a hop when happy.
  const beat = isBusy ? 6 : 16
  let lift = mod(t, beat) < beat / 2 ? 1 : 0
  if (state === 'ready' || state === 'hello') lift = mod(t, 10) < 2 ? 1 : lift
  if (state === 'sleep' || state === 'error') lift = 0
  const y = 1 - lift
  const isStep = (state === 'tool' || state === 'say') && mod(t, 4) < 2
  const body = isStep && art.step ? art.step : art.body
  const colors = state === 'error' ? desaturate(art.colors) : art.colors
  draw(cv, PROP_W, y, body, colors)
  drawFace(cv, art, state, t, y)
  drawProps(cv, art, state, t)
  if (hearts > 0) {
    const rise = Math.min(4, hearts >> 1)
    draw(cv, 0, Math.max(0, 3 - rise), HEART, { P: hearts % 4 < 2 ? '#ff6b9d' : '#ff8fab' })
    if (hearts > 3) draw(cv, PROP_W + BODY_W - 3, Math.max(0, 2 - (rise >> 1)), HEART, { P: '#ff8fab' })
  }
  return cells(cv)
}

function drawFace(cv: Canvas, art: PetArt, state: PetState, t: number, y: number): void {
  const top = y + art.eyeRow
  // A blink every few seconds, two frames long, at a different beat per eye pair.
  const isBlink = mod(t, 28) < 2 && state !== 'sleep'
  const lookAside = state === 'think' && mod(t, 24) >= 12 ? 1 : 0
  for (const ex of art.eyes) {
    const x = PROP_W + ex
    // Clear the eye's two pixels to the lid first, then draw what this state shows.
    plot(cv, x, top, art.lid)
    plot(cv, x, top + 1, art.lid)
    if (state === 'sleep' || isBlink || state === 'aborted') {
      plot(cv, x, top + 1, art.eye)
    } else if (state === 'ready' || state === 'hello') {
      // Eyes curved up: the top pixel alone.
      plot(cv, x, top, art.eye)
    } else if (state === 'error') {
      plot(cv, x, top, '#e63946')
      plot(cv, x, top + 1, '#e63946')
    } else {
      plot(cv, x + lookAside, top, art.eye)
      plot(cv, x + lookAside, top + 1, art.eye)
    }
    if ((state === 'ready' || state === 'hello') && art.blush) {
      plot(cv, x + (ex < BODY_W / 2 ? -1 : 1), top + 1, art.blush)
    }
  }
  if (state === 'aborted') {
    // A tear under the first eye, falling.
    const ex = PROP_W + art.eyes[0]!
    plot(cv, ex, top + 2 + (mod(t, 8) < 4 ? 0 : 1), '#7ec8e3')
  }
  if (art.mouth && (state === 'say' || state === 'ask') && mod(t, 4) < 2) {
    const [mx, my] = art.mouth
    plot(cv, PROP_W + mx, y + my, art.eye)
    plot(cv, PROP_W + mx + 1, y + my, art.eye)
  }
}

function drawProps(cv: Canvas, art: PetArt, state: PetState, t: number): void {
  if (state === 'think') {
    // Three dots rising one after another.
    for (let i = 0; i < 3; i++) {
      const p = mod(t - i * 4, 12)
      if (p < 6) plot(cv, 1 + i, 5 - p, i === 2 ? art.spark : '#8a8a8a')
    }
  } else if (state === 'tool') {
    // Sparks flying off where it works.
    for (let i = 0; i < 4; i++) {
      if (noise(i * 31 + Math.floor(t / 2)) < 0.55) plot(cv, Math.floor(noise(i + t) * PROP_W), 1 + Math.floor(noise(i * 7 + t) * 4), i % 2 ? art.spark : '#ffd166')
    }
  } else if (state === 'ask') {
    if (mod(t, 8) < 6) draw(cv, 0, 0, QUESTION, { Y: '#ffd166' })
  } else if (state === 'sleep') {
    const p = mod(t, 24)
    draw(cv, 0, Math.max(0, 2 - (p >> 3)), ZED, { Z: p < 16 ? '#8d99ae' : '#5c677d' })
  } else if (state === 'ready' || state === 'hello') {
    if (mod(t, 20) < 10) draw(cv, 0, mod(t, 20) < 5 ? 1 : 2, STAR, { S: art.spark })
  }
}

function desaturate(colors: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(colors).map(([k, hex]) => [k, gray(hex)]))
}

function gray(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16)
  const l = Math.round(((n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) * 0.7)
  const h = l.toString(16).padStart(2, '0')
  return `#${h}${h}${h}`
}

/** A blank pet-sized grid, for a theme with no pet. */
export function noPet(): Grid {
  return blank(PET_W, PET_ROWS)
}

// ---- the pets ------------------------------------------------------------------

/** Clawd, as Claude Code draws him: a warm orange body, arms out, four legs. */
export const CLAWD_PET: PetArt = {
  body: [
    '.LLOOOOOOOO.',
    '.OOOOOOOOOO.',
    'OOOOOOOOOOOO',
    '.DOOOOOOOOD.',
    '..D.D..D.D..',
  ],
  step: [
    '.LLOOOOOOOO.',
    '.OOOOOOOOOO.',
    'OOOOOOOOOOOO',
    '.DOOOOOOOOD.',
    '.D.D....D.D.',
  ],
  colors: { O: '#d77757', L: '#e8957a', D: '#a9553b' },
  eyes: [3, 8],
  eyeRow: 1,
  eye: '#2b1d18',
  lid: '#d77757',
  mouth: [5, 3],
  blush: '#f2a28c',
  spark: '#f4a261',
}

/** One loop of the pet in `state` as DockPet data: distinct frames and their order. */
export function dockPetOf(
  art: PetArt,
  state: PetState,
  view: Pick<DockPet, 'id' | 'bubble' | 'tone' | 'stats'>,
  isPatted = false,
  isStill = false,
): DockPet {
  const frames: DockPet['frames'] = []
  const seen = new Map<string, number>()
  const order: number[] = []
  // Still: the loop's first frame alone, which the player never has to redraw.
  const loop = isStill ? 1 : loopOf(state)
  for (let t = 0; t < loop; t++) {
    // A pat floats hearts over the first frames of the loop.
    const rows = petFrame(art, state, t, isPatted && t < 16 ? t + 1 : 0).map(row => segments(row).map(plainSeg))
    const key = JSON.stringify(rows)
    let at = seen.get(key)
    if (at === undefined) {
      at = frames.length
      frames.push(rows)
      seen.set(key, at)
    }
    order.push(at)
  }
  return { ...view, frames, order, ms: PET_MS, width: PET_W }
}

/** A run as plain data: a key left undefined is refused in state and Client props. */
function plainSeg(seg: ReturnType<typeof segments>[number]): DockPet['frames'][number][number][number] {
  return Object.fromEntries(Object.entries(seg).filter(([, v]) => v !== undefined)) as DockPet['frames'][number][number][number]
}

/** A small fighter with a face in its canopy, its exhaust flickering. */
export const THUNDER_PET: PetArt = {
  body: ['..AA........', '.ABBBBWWWW..', 'FBBBBBWWWWBC', '.ABBBBBBBB..', '..AA........'],
  step: ['..AA........', '.ABBBBWWWW..', 'GBBBBBWWWWBC', '.ABBBBBBBB..', '..AA........'],
  colors: { A: '#4361ee', B: '#4cc9f0', W: '#e0fbfc', C: '#f72585', F: '#ff9f1c', G: '#ffd60a' },
  eyes: [7, 9],
  eyeRow: 1,
  eye: '#14213d',
  lid: '#e0fbfc',
  mouth: [7, 3],
  blush: '#ff8fab',
  spark: '#ffd60a',
}

/** A maze ghost, its skirt rippling. */
export const CHOMP_PET: PetArt = {
  body: ['...GGGGGG...', '..GWWGGWWG..', '.GGWWGGWWGG.', '.GGGGGGGGGG.', '.G.GG.GG.GG.'],
  step: ['...GGGGGG...', '..GWWGGWWG..', '.GGWWGGWWGG.', '.GGGGGGGGGG.', '.GG.GG.GG.G.'],
  colors: { G: '#ff5d8f', W: '#ffffff' },
  eyes: [4, 8],
  eyeRow: 1,
  eye: '#2121de',
  lid: '#ffffff',
  mouth: [5, 3],
  spark: '#ffff00',
}

/** An electric mouse: black-tipped ears, red cheeks. */
export const SPARKY_PET: PetArt = {
  body: ['KY.....YK.Y.', '.YYYYYYY.YY.', 'YYYYYYYYY.Y.', 'RYYYYYYYR...', '.YY.YY.YY...'],
  step: ['KY.....YK..Y', '.YYYYYYY.YY.', 'YYYYYYYYYY..', 'RYYYYYYYR...', 'YY..YY..YY..'],
  colors: { K: '#5a3a22', Y: '#ffd60a', R: '#e63946' },
  eyes: [2, 6],
  eyeRow: 1,
  eye: '#5a3a22',
  lid: '#ffd60a',
  blush: '#ff8fab',
  spark: '#fff3b0',
}

/** A blue robot cat: white face, red nose, a bell on its collar. */
export const BLUECAT_PET: PetArt = {
  body: ['..BBBBBBBB..', '.BBWWWWWWBB.', 'BBWWWWWWWWBB', 'BBWWWRRWWWBB', '.BRRRYYRRRB.'],
  colors: { B: '#0096c7', W: '#ffffff', R: '#e63946', Y: '#ffd60a' },
  eyes: [4, 7],
  eyeRow: 1,
  eye: '#1b1b1b',
  lid: '#ffffff',
  mouth: [5, 3],
  blush: '#ff8fab',
  spark: '#80ffdb',
}

/** A pop-tart cat, its head poking out on the right. */
export const NYAN_PET: PetArt = {
  body: ['.TTTTT.G...G', 'TPSPPTGGGGGG', 'TPPSPTGGGGGG', 'TPSPPTGGGGGG', '.L.L.L..L.L.'],
  step: ['.TTTTT.G...G', 'TPSPPTGGGGGG', 'TPPSPTGGGGGG', 'TPSPPTGGGGGG', 'L.L.L..L.L..'],
  colors: { T: '#ffcc99', P: '#ff99cc', S: '#ff3399', G: '#a0a0a0', L: '#a0a0a0' },
  eyes: [8, 10],
  eyeRow: 1,
  eye: '#1b1b1b',
  lid: '#a0a0a0',
  blush: '#ff99cc',
  spark: '#ffff00',
}

/** A round listener in big headphones, swaying to whatever plays. */
export const AUDIO_PET: PetArt = {
  body: ['..HHHHHHHH..', '.H.BBBBBB.H.', 'CCBBBBBBBBCC', 'CCBBBBBBBBCC', '.B.B....B.B.'],
  step: ['..HHHHHHHH..', '.H.BBBBBB.H.', 'CCBBBBBBBBCC', 'CCBBBBBBBBCC', '..B.B..B.B..'],
  colors: { H: '#5a189a', C: '#c77dff', B: '#e0aaff' },
  eyes: [4, 7],
  eyeRow: 1,
  eye: '#240046',
  lid: '#e0aaff',
  mouth: [5, 3],
  blush: '#ff8fab',
  spark: '#4cc9f0',
}

const PETS: Record<string, PetArt> = {
  clawd: CLAWD_PET,
  thunder: THUNDER_PET,
  chomp: CHOMP_PET,
  sparky: SPARKY_PET,
  bluecat: BLUECAT_PET,
  nyan: NYAN_PET,
  audio: AUDIO_PET,
}

/** A theme's pet; a theme without one of its own borrows Clawd's shape in its color. */
export function petArtOf(theme: string, color: string): PetArt {
  return PETS[theme] ?? { ...CLAWD_PET, colors: { O: color, L: color, D: color }, lid: color }
}
