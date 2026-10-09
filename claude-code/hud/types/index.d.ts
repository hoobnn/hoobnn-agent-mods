export type Span = {
  text: string
  color?: string
  backgroundColor?: string
  bold?: boolean
  dimColor?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  inverse?: boolean
  /** An https OSC 8 link the span sits inside. */
  href?: string
}

export type HudLine = Span[]

/** What the statusline's stdin carried and only the turn's requests reveal. */
export type StepInfo = {
  model: string | null
  effort: string | null
  apiDurationMs: number
  currentUsage: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens: number
    cache_read_input_tokens: number
  } | null
  /** When the last main-thread request started (ms). */
  lastRequestAt: number | null
}

/** A remote client attached to the session: its id and the surface it draws on. */
export type Remote = { id: string; surface: string }

/** Alert thresholds (percent) already toasted, per gauge. */
export type Fired = {
  context: number[]
  fiveHour: number[]
  sevenDay: number[]
  /** Per model-scoped weekly window (`Fable`); absent in state kept from before 0.11. */
  scoped?: Record<string, number[]>
}

/** Each tool's calls this session: how many, their total time, how many failed. */
export type ToolStats = Record<string, { count: number; totalMs: number; errors: number }>

/** One finished main-thread turn: how long, what it cost, how far the context grew (null: unknown). */
export type TurnCost = { n: number; durationMs: number; usd: number | null; tokens: number | null }

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
    hud: {
      lines: HudLine[]
      isHidden: boolean | null
      step: StepInfo
      /** Remote clients attached (a phone, the web), not the terminal. */
      remotes: Remote[]
      /** The task in one line, from a fork of the conversation. */
      summary: string | null
      /** Main-thread turns completed, which sets the summary's cadence. */
      turns: number
      fired: Fired
      /** Spend per day (`YYYY-MM-DD` → USD), mirrored to the store. */
      history: Record<string, number>
      tools: ToolStats
      /** The session's last finished turns, oldest first. */
      turnLog: TurnCost[]
      /** Spend and context size when the running turn began. */
      turnStart: { usd: number | null; tokens: number | null } | null
      /** True while the pet stands beside the HUD's rows. */
      dock: boolean
      /** Pats the pet took here, which spinner counts. */
      petPats: number
      /** True while a `/` or `@` picker is open above the band. */
      isPicking: boolean
    }
    /** spinner's pet (read only). */
    spinner: {
      dock: DockPet | null
    }
  }
}
