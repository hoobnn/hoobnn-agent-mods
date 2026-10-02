// The task list's progress above the prompt, read from the calls the model
// already makes (TodoWrite, TaskCreate, TaskUpdate) once they have run: no tool
// of its own, nothing in the prompt, no call refused, no tokens.
import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, Register, RenderElement } from 'claude-code'

import type { Board } from '../types'
import { addTask, bar, formatDuration, fromTodos, progress, updateTask } from './board'
import { readConfig } from './config'
import type { Config } from './config'
import { m, setLang } from './i18n'
import { isPickerOpen, stackAbove } from './kit/band'
import { resolveLanguage } from './kit/lang'
import { persist, switchArg } from './kit/prefs'
import type { Prefs } from './kit/prefs'

const board = atom({ plugin: 'todo-bar', key: 'board' } as const, null as Board | null)
// The session's mirror of the `visible` row, so `/todos` shows at once.
const isHidden = atom({ plugin: 'todo-bar', key: 'isHidden' } as const, false)
// True while a picker is open above the band (see kit/band).
const isPicking = atom({ plugin: 'todo-bar', key: 'isPicking' } as const, false)

/** How long a finished list shows its time before the band folds away. */
export const FINISH_MS = 8000
// Each session's board is kept in the store, so a resumed session finds it; the newest few sessions.
const SAVED = 'board:'
const KEEP_SESSIONS = 20
const TOOLS = new Set(['TodoWrite', 'TaskCreate', 'TaskUpdate'])
const MARK = { pending: '○', in_progress: '●', completed: '✓' } as const

/** The kit's hold on this mod's store and `/config` rows. */
function prefsOf($: EngineInterface): Prefs {
  return {
    kept: key => $.store.get(key),
    forget: key => $.store.delete(key),
    write: (field, value) => $.config.set({ key: `todo-bar.${field}`, value }),
  }
}

/** Sets the board, keeps it for a resume, and folds a finished one after FINISH_MS. */
async function setBoard($: EngineInterface, next: Board | null): Promise<void> {
  const was = await read($, board)
  await update($, board, () => next)
  const key = SAVED + (await $.session.id())
  if (next === null) await $.store.delete(key)
  else {
    await $.store.set(key, next)
    const keys = (await $.store.keys()).filter(k => k.startsWith(SAVED))
    for (const old of keys.slice(0, Math.max(0, keys.length - KEEP_SESSIONS))) await $.store.delete(old)
  }
  const doneAt = next?.doneAt ?? null
  if (doneAt !== null && was?.doneAt !== doneAt) {
    $.clock.after(FINISH_MS, async () => {
      const now = await read($, board)
      if (now?.doneAt === doneAt && !now.isFolded) await update($, board, () => ({ ...now, isFolded: true }))
    })
  }
}

/** `/todos` alone: every task with its mark. */
async function listing($: EngineInterface): Promise<string> {
  const now = await read($, board)
  if (!now) return m('cmd.none')
  const { done, total } = progress(now)
  return [m('cmd.header', { done, total }), ...now.items.map(i => `${MARK[i.status]} ${i.title}`)].join('\n')
}

export const register: Register = (on, options) => {
  const config = readConfig(options)

  on('session.start', async ($, e, next) => {
    const settings = (await $.settings.read().catch(() => ({}))) as { language?: unknown }
    const locale = await Promise.all([
      $.env.get('LC_ALL').catch(() => undefined),
      $.env.get('LC_MESSAGES').catch(() => undefined),
      $.env.get('LANG').catch(() => undefined),
    ])
    setLang(resolveLanguage(config.language, settings.language, locale))
    await $.command.register({ name: 'todos', description: m('cmd.description'), argumentHint: '[off|on]' })
    await update($, isHidden, () => !config.isVisible)
    // A reload keeps the session's state; a resumed session finds its board in the store.
    if ((await read($, board)) === null) {
      const kept = (await $.store.get(SAVED + (await $.session.id()))) as Board | undefined
      if (kept && Array.isArray(kept.items)) await update($, board, () => (kept.doneAt !== null ? { ...kept, isFolded: true } : kept))
    }
    return next(e)
  })

  // The main thread's list, once the call has run; a refused or failed call changes nothing.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId || !TOOLS.has(e.tool) || ran.deny !== undefined || ran.isError) return ran
    const input = e as unknown as Record<string, unknown>
    const result = (ran.result ?? {}) as Record<string, unknown>
    const was = await read($, board)
    const now = await $.clock.now()
    if (e.tool === 'TodoWrite') {
      await setBoard($, fromTodos(was, Array.isArray(result.newTodos) ? result.newTodos : input.todos, now))
    } else if (e.tool === 'TaskCreate') {
      const task = result.task as { id?: unknown } | undefined
      if (typeof task?.id !== 'string') return ran
      const made = { id: task.id, subject: String(input.subject ?? ''), activeForm: typeof input.activeForm === 'string' ? input.activeForm : undefined }
      await setBoard($, addTask(was, made, now))
    } else if (result.success !== false && typeof input.taskId === 'string') {
      const change = {
        taskId: input.taskId,
        status: typeof input.status === 'string' ? input.status : undefined,
        subject: typeof input.subject === 'string' ? input.subject : undefined,
        activeForm: typeof input.activeForm === 'string' ? input.activeForm : undefined,
      }
      const changed = updateTask(was, change, now)
      if (changed !== was) await setBoard($, changed)
    }
    return ran
  })

  on('command.run', { command: 'todos' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg !== 'off' && arg !== 'on') return { text: await listing($) }
    const was = await read($, isHidden)
    const hidden = await update($, isHidden, v => switchArg(arg, v))
    if (hidden !== was) await persist(prefsOf($), 'visible', !hidden)
    return { text: m(hidden ? 'cmd.hidden' : 'cmd.shown') }
  })

  // A picker (`/` commands, `@` files) opens above the band: the band steps aside meanwhile.
  on('prompt.edit', async ($, e, next) => {
    const box = await next(e)
    const isOpen = isPickerOpen(box.text, box.cursor)
    if ((await read($, isPicking)) !== isOpen) await update($, isPicking, () => isOpen)
    return box
  })
  on('prompt.submit', async ($, e, next) => {
    if (await read($, isPicking)) await update($, isPicking, () => false)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const now = await read($, board)
    if (e.props.hasSurvey || now === null || now.isFolded || (await read($, isHidden)) || (await read($, isPicking))) return next(e)
    const ui = $.ui.resolve(e)
    // Two cells in, as kit/band indents the band.
    return stackAbove(ui, drawBoard(ui, now, e.props.bodyColumns - 2, config), await next(e))
  })
}

/** The band: the running task, a bar, the count; then what comes next. Finished: a check and the time it took. */
function drawBoard(ui: Pick<Elements['terminal'], 'Box' | 'Text'>, now: Board, columns: number, config: Config): RenderElement {
  const { Box, Text } = ui
  const { done, total, current, isRunning, next } = progress(now)
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  const count = `${done}/${total} ${String(pct).padStart(3)}%`
  const width = Math.max(8, Math.min(30, Math.floor(columns * 0.3)))
  const { filled, empty } = bar(done, total, width)

  if (now.doneAt !== null) {
    return (
      <Box flexDirection="row" columnGap={1}>
        <Text color="green" bold>✓</Text>
        <Text color="green">{m('band.done')}</Text>
        <Text color="green">{filled}</Text>
        <Text>{`${done}/${total}`}</Text>
        <Text dimColor>{m('band.took', { d: formatDuration(now.doneAt - now.startedAt) })}</Text>
      </Box>
    )
  }
  const label = current ? (isRunning ? current.active : current.title) : ''
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" columnGap={1}>
        <Text color={isRunning ? 'cyan' : undefined} dimColor={!isRunning}>{isRunning ? MARK.in_progress : MARK.pending}</Text>
        <Box flexGrow={1} flexShrink={1}>
          <Text wrap="truncate-end" dimColor={!isRunning}>{label}</Text>
        </Box>
        <Box flexShrink={0}>
          <Text>
            <Text color="cyan">{filled}</Text>
            <Text dimColor>{empty}</Text>
          </Text>
        </Box>
        <Box flexShrink={0}>
          <Text>{count}</Text>
        </Box>
      </Box>
      {config.hasNext && next.length > 0 ? (
        <Box paddingLeft={2}>
          <Text dimColor wrap="truncate-end">{m('band.next') + next.slice(0, 2).map(i => i.title).join(' · ')}</Text>
        </Box>
      ) : null}
    </Box>
  )
}
