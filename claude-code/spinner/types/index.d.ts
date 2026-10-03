export type FinaleState = { kind: 'answer' | 'aborted' | 'error'; label: string; id: string }
export type Preview = { theme: string; id: string }
/** What the running turn is doing, and the tool when it is running one. */
export type Activity = { act: 'think' | 'tool' | 'ask' | 'say' | 'wait'; tool?: string }
export type PetStats = { xp: number; love: number }

/** A run of cells in a pet's frame. */
export type DockSeg = { text: string; c?: string; bg?: string; b?: boolean; d?: boolean }

/**
 * The companion as spinner publishes it (`spinner.dock`) for whoever draws it:
 * one loop of its current state. Kept alike in spinner's and hud's contracts.
 */
export type DockPet = {
  /** Changes with the state or a pat: the player starts over. */
  id: string
  /** Distinct frames, each its rows of runs. */
  frames: DockSeg[][][]
  /** The frames in play order, by index. */
  order: number[]
  ms: number
  /** Cells the pet takes across. */
  width: number
  bubble: string
  tone: 'plain' | 'ask' | 'error' | 'aborted' | 'sleep'
  /** `Lv.3 ♥12`. */
  stats: string
}

declare module 'claude-code' {
  interface PluginState {
    spinner: {
      theme: string
      choice: string
      isHidden: boolean
      isStageOff: boolean
      isCompanionOff: boolean
      finale: FinaleState | null
      preview: Preview | null
      activity: Activity
      mood: 'hello' | 'ready' | 'aborted' | 'error' | 'sleep'
      pet: PetStats
      pat: string | null
      /** What the pet says for a moment about a command that just ran: tests, a commit. */
      news: { kind: 'testPass' | 'testFail' | 'commit'; id: string } | null
      /** The pet for whoever draws it; null while it is off. */
      dock: DockPet | null
      /** Whether a turn is running. */
      isTurn: boolean
      /** True while a `/` or `@` picker is open above the band. */
      isPicking: boolean
      /** The audio theme's tap: whether anything played in the last seconds, and why it could not run. */
      tap: { isAudible: boolean; error: string | null }
    }
    /** hud's side of the pet's place (read only). */
    hud: {
      /** True while hud draws the pet beside its rows. */
      dock: boolean
      /** Counts the pats hud's drawing of the pet took. */
      petPats: number
    }
  }
}
