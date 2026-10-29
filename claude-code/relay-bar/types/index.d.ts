/** Where a run stands: still at work (`starting`, `running`), or how it ended; `lost` when its process went without a last word. */
export type RunState = 'starting' | 'running' | 'done' | 'failed' | 'asked' | 'lost'

/** One step of a run, as agent-relay's status.json lists its latest: a tool call, or a stretch of thought or message. */
export type Step =
  | { type: 'tool'; title: string; kind: string | null; status: string | null }
  | { type: 'thought' | 'message'; text: string }

/**
 * One agent-relay run (one agent of one `relay.py run`), read from its
 * `status.json`: who runs, what it was asked, where it stands, its latest steps.
 * Times are milliseconds since the epoch.
 */
export type Run = {
  id: string
  cli: string
  model: string | null
  effort: string | null
  prompt: string
  state: RunState
  startedAt: number
  updatedAt: number
  endedAt: number | null
  tools: { done: number; total: number }
  steps: Step[]
  error: string | null
  filesChanged: number
  /** The Bash call that started it, as `tool.call`'s `tool_use_id`; null until matched. */
  callId: string | null
  /** True when that call's row is in the main transcript (a foreground call of the main thread): the run is drawn under it, not on the band. */
  inRow: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'relay-bar': { runs: Run[]; isHidden: boolean | null; isPicking: boolean; tick: number; picked: string | null }
  }
}
