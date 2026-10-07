export type ItemStatus = 'pending' | 'in_progress' | 'completed'

/**
 * One task: its title, the words it shows while it runs, and where it stands;
 * when it started running and was done, the tool calls made and the subagents
 * started while it ran. The last four are optional so a board kept by an older version resumes.
 */
export type Item = { id: string; title: string; active: string; status: ItemStatus; startedAt?: number; doneAt?: number; calls?: number; agents?: number }

/** A subagent the main thread started and that still runs: its task, its type, the tool it is on, its calls so far. */
export type Agent = { id: string; title: string; type: string; startedAt: number; tool: string | null; calls: number }

/**
 * The list the band draws: from TodoWrite (the whole list each call) or from
 * TaskCreate / TaskUpdate (one task a call). `doneAt` is set once every item
 * is completed; `isFolded` once the finished band has shown its time.
 */
export type Board = {
  source: 'todo' | 'task'
  items: Item[]
  startedAt: number
  doneAt: number | null
  isFolded: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'todo-bar': { board: Board | null; isHidden: boolean; isPicking: boolean; tick: number; agents: Agent[] }
  }
}
