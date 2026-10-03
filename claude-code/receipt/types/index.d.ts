/** One file a turn changed: the lines it gained and lost, and whether the turn made it. */
export type FileChange = { path: string; added: number; removed: number; isNew: boolean }

/**
 * What one main-thread turn did, from its tool calls (its subagents' included):
 * the files it changed, the commands it ran and those that failed, the reads,
 * the subagents it started, and the loops it was warned about.
 * `durationMs` and `reason` are set when the turn ends.
 */
export type Receipt = {
  turnId: string
  startedAt: number
  durationMs: number | null
  reason: string | null
  files: FileChange[]
  commands: number
  failed: string[]
  errors: number
  reads: number
  agents: number
  warnings: string[]
}

/** The main thread's recent calls, as the loop rules read them. */
export type Watch = {
  /** The last call that failed and how many times in a row it has, no file changed between. */
  failKey: string | null
  failCount: number
  /** Each file's recent edits, oldest first. */
  edits: Record<string, { from: string; to: string }[]>
  /** Each file's edits that put back what an earlier edit took out. */
  flips: Record<string, number>
}

declare module 'claude-code' {
  interface PluginState {
    receipt: { receipt: Receipt | null; watch: Watch; isHidden: boolean; isPicking: boolean; isShown: boolean }
  }
}
