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

/** Alert thresholds (percent) already toasted, per gauge. */
export type Fired = { context: number[]; fiveHour: number[]; sevenDay: number[] }

/** Each tool's calls this session: how many, their total time, how many failed. */
export type ToolStats = Record<string, { count: number; totalMs: number; errors: number }>

declare module 'claude-code' {
  interface PluginState {
    hud: {
      lines: HudLine[]
      isHidden: boolean
      step: StepInfo
      clients: string[]
      /** The task in one line, from a fork of the conversation. */
      summary: string | null
      /** Main-thread turns completed, which sets the summary's cadence. */
      turns: number
      fired: Fired
      /** Spend per day (`YYYY-MM-DD` → USD), mirrored to the store. */
      history: Record<string, number>
      tools: ToolStats
    }
  }
}
