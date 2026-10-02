export type ItemStatus = 'pending' | 'in_progress' | 'completed'

/** One task: its title, the words it shows while it runs, and where it stands. */
export type Item = { id: string; title: string; active: string; status: ItemStatus }

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
    'todo-bar': { board: Board | null; isHidden: boolean; isPicking: boolean }
  }
}
