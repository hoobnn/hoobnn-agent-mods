// The `audio` theme's feed: lines from the tap (hooks/audio-tap.swift) to what
// its scene draws. The meter lives in the hooks module; the band's Client asks
// for its latest view each frame (register.tsx, `ui.message`). Pure but for the
// meter's own memory.

/** Bands the tap is asked for, low to high. */
export const AUDIO_BANDS = 32
/** The tap's line period, in milliseconds. */
export const TAP_MS = 50

/**
 * One frame for the scene: band levels and their falling peaks (0..99, gained
 * to the last few seconds' loudest), and a count of beats so far.
 */
export type AudioView = { b: number[]; p: number[]; beat: number }

/**
 * What the scene is given: live levels, `null` when the tap could not run,
 * or nothing at all (a preview, a screenshot, a surface without processes)
 * for a made-up signal.
 */
export type AudioFeed = AudioView | null | undefined

/** A tap line: `L <loudness> <band>...`, each 0..99; anything else is null. */
export function parseTapLine(line: string): { loud: number; bands: number[] } | null {
  const parts = line.trim().split(' ')
  if (parts[0] !== 'L' || parts.length < 3) return null
  const nums = parts.slice(1).map(Number)
  if (nums.some(n => !Number.isFinite(n))) return null
  const [loud, ...bands] = nums.map(n => Math.max(0, Math.min(99, n)))
  return { loud: loud!, bands }
}

/** Splits streamed text into whole lines, keeping a cut-off tail for the next piece. */
export function lineSplitter(): (text: string) => string[] {
  let rest = ''
  return text => {
    const lines = (rest + text).split('\n')
    rest = lines.pop() ?? ''
    return lines
  }
}

/** Below this a band is drawn as nothing: the tap's floor of hiss. */
const FLOOR = 6
/** The gain's ceiling never drops under this, so near-silence is not blown up. */
const MIN_CEILING = 35
/** Per line: the ceiling eases down this much toward the bands' level (about 7 s to half). */
const CEILING_DECAY = 0.995
/** Per line: how far a peak falls. */
const PEAK_FALL = 4
/** A beat: loudness this far over its running average, at least this loud, this many lines apart. */
const BEAT_RATIO = 1.3
const BEAT_MIN = 12
const BEAT_GAP = 5
/** Lines of quiet before the meter counts as silent (3 s). */
const QUIET_LINES = 60

/** The tap's lines in, the scene's view out: gain, peaks, beats and whether anything plays. */
export class AudioMeter {
  private ceiling = MIN_CEILING
  private levels: number[] = new Array(AUDIO_BANDS).fill(0)
  private peaks: number[] = new Array(AUDIO_BANDS).fill(0)
  private average = 0
  private beats = 0
  private sinceBeat = BEAT_GAP
  private sinceSound = QUIET_LINES

  /** Takes one tap line; returns whether it was a reading. */
  push(line: string): boolean {
    const reading = parseTapLine(line)
    if (!reading) return false
    const { loud, bands } = reading
    const top = Math.max(0, ...bands)
    this.ceiling = Math.max(MIN_CEILING, top, this.ceiling * CEILING_DECAY)
    this.levels = Array.from({ length: AUDIO_BANDS }, (_, i) => {
      const raw = bands[Math.floor((i * bands.length) / AUDIO_BANDS)] ?? 0
      return raw < FLOOR ? 0 : Math.round(Math.min(99, (raw * 99) / this.ceiling))
    })
    this.peaks = this.peaks.map((p, i) => Math.max(this.levels[i]!, p - PEAK_FALL))

    this.sinceBeat++
    if (loud >= BEAT_MIN && loud > this.average * BEAT_RATIO && this.sinceBeat >= BEAT_GAP) {
      this.beats++
      this.sinceBeat = 0
    }
    this.average = this.average * 0.9 + loud * 0.1
    this.sinceSound = top >= FLOOR ? 0 : this.sinceSound + 1
    return true
  }

  /** Whether anything has played in the last few seconds. */
  get isAudible(): boolean {
    return this.sinceSound < QUIET_LINES
  }

  view(): AudioView {
    return { b: [...this.levels], p: [...this.peaks], beat: this.beats }
  }
}

/** A made-up signal with a beat, for when no tap feeds the scene. */
export function demoView(t: number): AudioView {
  const kick = Math.max(0, 1 - (t % 5) / 3)
  const b = Array.from({ length: AUDIO_BANDS }, (_, i) => {
    const u = i / AUDIO_BANDS
    const v =
      0.12 +
      0.5 * kick * Math.max(0, 1 - u * 3) +
      0.3 * (0.5 + 0.5 * Math.sin(t * 0.45 + i * 0.6)) * (1 - u * 0.5) +
      0.2 * (0.5 + 0.5 * Math.sin(t * 0.9 - i * 1.3))
    return Math.round(Math.min(99, v * 90))
  })
  return { b, p: b.map(v => Math.min(99, v + 10)), beat: Math.floor(t / 5) }
}
