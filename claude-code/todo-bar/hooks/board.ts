// The task list as the band draws it, built from the calls the model already
// makes: TodoWrite sends the whole list each time, TaskCreate and TaskUpdate
// one task a call. Pure: register.tsx hands in what the call carried and when.
import type { Board, Item, ItemStatus } from '../types'

type Todo = { content?: unknown; status?: unknown; activeForm?: unknown }

const STATUSES: readonly ItemStatus[] = ['pending', 'in_progress', 'completed']

const str = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '')
const statusOf = (v: unknown): ItemStatus => STATUSES.find(s => s === v) ?? 'pending'

/**
 * Each item's times carried over from the board before (a task by its id, a
 * todo by its title, as TodoWrite sends the whole list again): it started when
 * first seen running, was done when first seen completed.
 */
function stamp(prev: Board | null, source: Board['source'], items: Item[], now: number): Item[] {
  const before = prev && prev.source === source ? prev.items : []
  return items.map(item => {
    const was = before.find(b => (source === 'task' ? b.id === item.id : b.title === item.title))
    const startedAt = was?.startedAt ?? (item.status === 'in_progress' ? now : undefined)
    const doneAt = item.status !== 'completed' ? undefined : (was?.status === 'completed' ? was.doneAt : undefined) ?? now
    const stamped: Item = { ...item }
    if (startedAt !== undefined) stamped.startedAt = startedAt
    if (doneAt !== undefined) stamped.doneAt = doneAt
    if (was?.calls) stamped.calls = was.calls
    if (was?.agents) stamped.agents = was.agents
    return stamped
  })
}

/** A board whose list just changed: finished when every item is, started over when it comes back from finished. */
function settle(prev: Board | null, source: Board['source'], listed: Item[], now: number): Board | null {
  if (listed.length === 0) return null
  const isDone = listed.every(i => i.status === 'completed')
  // A finished list sent again (the model closing it twice) stays as it finished.
  if (isDone && prev !== null && prev.source === source && prev.doneAt !== null) return { ...prev, items: stamp(prev, source, listed, now) }
  const isFresh = prev === null || prev.source !== source || prev.doneAt !== null
  // A fresh list owes the finished one nothing, not even a task of the same name.
  const items = stamp(isFresh ? null : prev, source, listed, now)
  return { source, items, startedAt: isFresh ? now : prev.startedAt, doneAt: isDone ? now : null, isFolded: false }
}

/** TodoWrite's list (its `newTodos`, else the input's `todos`) as the board. */
export function fromTodos(prev: Board | null, todos: unknown, now: number): Board | null {
  const list = (Array.isArray(todos) ? todos : []) as Todo[]
  const items = list
    .map((t, i): Item => {
      const title = str(t?.content)
      return { id: String(i), title, active: str(t?.activeForm) || title, status: statusOf(t?.status) }
    })
    .filter(i => i.title)
  return settle(prev, 'todo', items, now)
}

/** A task TaskCreate made, added to the task board (a finished or todo board makes way). */
export function addTask(prev: Board | null, task: { id: string; subject: string; activeForm?: string }, now: number): Board | null {
  const title = str(task.subject)
  if (!title) return prev
  const kept = prev && prev.source === 'task' && prev.doneAt === null ? prev.items : []
  const items = [...kept.filter(i => i.id !== task.id), { id: task.id, title, active: str(task.activeForm) || title, status: 'pending' as const }]
  return settle(prev && prev.source === 'task' && prev.doneAt === null ? prev : null, 'task', items, now)
}

/** What TaskUpdate changed on a task the board holds; `deleted` drops it. */
export function updateTask(
  prev: Board | null,
  change: { taskId: string; status?: string; subject?: string; activeForm?: string },
  now: number,
): Board | null {
  if (!prev || prev.source !== 'task' || !prev.items.some(i => i.id === change.taskId)) return prev
  const items =
    change.status === 'deleted'
      ? prev.items.filter(i => i.id !== change.taskId)
      : prev.items.map(i => {
          if (i.id !== change.taskId) return i
          const title = str(change.subject) || i.title
          const status = change.status === undefined ? i.status : statusOf(change.status)
          return { ...i, title, active: str(change.activeForm) || (str(change.subject) ? title : i.active), status }
        })
  return settle(prev, 'task', items, now)
}

/** The board with one more tool call counted on the running item; the same board when none runs. */
export function countCall(board: Board): Board {
  const running = board.items.find(i => i.status === 'in_progress')
  if (!running) return board
  return { ...board, items: board.items.map(i => (i === running ? { ...i, calls: (i.calls ?? 0) + 1 } : i)) }
}

/** The board with one more subagent counted on the running item; the same board when none runs. */
export function countAgent(board: Board): Board {
  const running = board.items.find(i => i.status === 'in_progress')
  if (!running) return board
  return { ...board, items: board.items.map(i => (i === running ? { ...i, agents: (i.agents ?? 0) + 1 } : i)) }
}

/** How long an item ran: until it was done, else until now; null when it was never seen running. */
export function elapsed(item: Item, now: number): number | null {
  if (item.startedAt === undefined) return null
  return Math.max(0, (item.doneAt ?? now) - item.startedAt)
}

/** Where the board stands: done and total, the running item (else the first open one), and the next open ones. */
export function progress(board: Board): { done: number; total: number; current: Item | null; isRunning: boolean; next: Item[] } {
  const done = board.items.filter(i => i.status === 'completed').length
  const running = board.items.find(i => i.status === 'in_progress') ?? null
  const open = board.items.filter(i => i.status === 'pending')
  const current = running ?? open[0] ?? null
  return { done, total: board.items.length, current, isRunning: running !== null, next: open.filter(i => i !== current) }
}

/** A bar of `width` cells, `━` for the done share and `─` for the rest. */
export function bar(done: number, total: number, width: number): { filled: string; empty: string } {
  const n = total === 0 ? 0 : Math.round((done / total) * width)
  return { filled: '━'.repeat(n), empty: '─'.repeat(Math.max(0, width - n)) }
}

/** 42s, 3m 12s, 1h 05m. */
export function formatDuration(ms: number): string {
  const sec = Math.max(0, Math.round(ms / 1000))
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`
  return `${Math.floor(sec / 3600)}h ${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}m`
}
