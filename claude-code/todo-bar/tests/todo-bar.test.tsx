import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { addTask, bar, formatDuration, fromTodos, progress, updateTask } from '../hooks/board'
import { MESSAGES } from '../hooks/i18n'
import { FINISH_MS } from '../hooks/register'

const START = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as const

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } } as const

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 9 }, view: {} },
} as const

const SURFACES = ['terminal', 'desktop'] as const

// The /config rows the plugin wrote, as `[key, value]`.
let rows: [string, unknown][] = []
// Calls the host refuses, by tool name.
let refused = new Set<string>()
// The agents the engine lists as running.
let listed: { id: string; status: string }[] = []
// The next id TaskCreate hands out.
let taskId = 0

function host(on: On, stored: Record<string, unknown> = {}) {
  rows = []
  refused = new Set()
  taskId = 0
  listed = []
  const clock = mock.clock(on, { now: 1_000_000 })
  const store = mock.store(on, stored)
  mock.env(on, { LANG: 'zh_CN.UTF-8' })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('config.set', ($, e) => {
    rows.push([e.key, e.value])
    return { value: e.value }
  })
  on('session.id', () => ({ value: 'sess-1' }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('tool.call', ($, e) => {
    if (refused.has(e.tool)) return { deny: 'no' }
    const input = e as unknown as Record<string, unknown>
    if (e.tool === 'TodoWrite') return { result: { oldTodos: [], newTodos: input.todos }, text: 'ok' }
    if (e.tool === 'TaskCreate') return { result: { task: { id: String(++taskId), subject: input.subject } }, text: 'ok' }
    if (e.tool === 'TaskUpdate') return { result: { success: true, taskId: input.taskId, updatedFields: ['status'] }, text: 'ok' }
    return { result: 'ok', text: 'ok' }
  })
  on('agent.spawn', ($, e) => ({ model: 'haiku', agentId: `ag-${e.description}` }))
  on('agent.list', () => ({ value: listed as never }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="core" />
  })
  return { clock, store }
}

const todo = (content: string, status: 'pending' | 'in_progress' | 'completed') => ({ content, status, activeForm: `${content}中` })

/** The band's text as one string, '' when the band does not draw. */
async function band($: Parameters<TestBody>[0], surface: (typeof SURFACES)[number] = 'terminal'): Promise<string> {
  const ui = await $.ui.mount({ plugin: 'todo-bar', surface, ...BAND })
  const texts = (await ui.findAll({ type: 'Text' })) as unknown[]
  await ui.unmount()
  return JSON.stringify(texts)
}

test('board helpers', async () => {
  const b = fromTodos(null, [todo('读代码', 'completed'), todo('写测试', 'in_progress'), todo('跑构建', 'pending')], 0)!
  expect(progress(b).done).toBe(1)
  expect(progress(b).current?.active).toBe('写测试中')
  expect(bar(1, 4, 8)).toEqual({ filled: '━━', empty: '──────' })
  expect(formatDuration(192_000)).toBe('3m 12s')
  // A finished list sent again keeps when it finished.
  const finished = fromTodos(b, [todo('读代码', 'completed'), todo('写测试', 'completed'), todo('跑构建', 'completed')], 5000)!
  expect(finished.doneAt).toBe(5000)
  expect(fromTodos(finished, finished.items.map(i => ({ content: i.title, status: 'completed' })), 9000)!.doneAt).toBe(5000)
  // Tasks: created, moved, deleted.
  let t = addTask(null, { id: '1', subject: 'A' }, 0)
  t = addTask(t, { id: '2', subject: 'B', activeForm: 'Doing B' }, 0)
  t = updateTask(t, { taskId: '2', status: 'in_progress' }, 0)
  expect(progress(t!).current?.active).toBe('Doing B')
  t = updateTask(t, { taskId: '1', status: 'deleted' }, 0)
  expect(t!.items.map(i => i.id)).toEqual(['2'])
  expect(updateTask(t, { taskId: 'nope', status: 'completed' }, 0)).toBe(t)
  for (const table of Object.values(MESSAGES)) expect(Object.keys(table).sort()).toEqual(Object.keys(MESSAGES.en).sort())
})

test('TodoWrite draws the running task, the bar and the count on every surface', async ($, on) => {
  const { clock } = host(on)
  await $.session.start(START)
  await clock.settle()
  expect(await band($)).not.toContain('━')
  await $.tool.call({ tool: 'TodoWrite', todos: [todo('读代码', 'completed'), todo('写测试', 'in_progress'), todo('跑构建', 'pending'), todo('发版', 'pending')] } as never)
  for (const surface of SURFACES) {
    const text = await band($, surface)
    expect(text).toContain('写测试中')
    expect(text).toContain('1/4  25%')
    expect(text).toContain('━')
    expect(text).toContain('接下来：跑构建 · 发版')
  }
})

test('TaskCreate and TaskUpdate draw the task list', async ($, on) => {
  const { clock } = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.tool.call({ tool: 'TaskCreate', subject: '迁移数据库', description: '...', activeForm: '迁移数据库中' } as never)
  await $.tool.call({ tool: 'TaskCreate', subject: '更新接口', description: '...' } as never)
  expect(await band($)).toContain('0/2   0%')
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'in_progress' } as never)
  expect(await band($)).toContain('迁移数据库中')
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'completed' } as never)
  const text = await band($)
  expect(text).toContain('1/2  50%')
  expect(text).toContain('更新接口')
})

test('a refused call, a subagent call and another tool change nothing', async ($, on) => {
  const { clock } = host(on)
  await $.session.start(START)
  await clock.settle()
  refused.add('TodoWrite')
  await $.tool.call({ tool: 'TodoWrite', todos: [todo('A', 'in_progress')] } as never)
  expect(await band($)).not.toContain('━')
  refused.clear()
  await $.tool.call({ tool: 'TodoWrite', todos: [todo('子代理的', 'in_progress')], agentId: 'a1' } as never)
  await $.tool.call({ tool: 'Bash', command: 'ls' } as never)
  expect(await band($)).not.toContain('━')
})

test('a finished list shows its time, then folds; a new list comes back', async ($, on) => {
  const { clock } = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.tool.call({ tool: 'TodoWrite', todos: [todo('A', 'in_progress'), todo('B', 'pending')] } as never)
  await clock.advance(72_000)
  await $.tool.call({ tool: 'TodoWrite', todos: [todo('A', 'completed'), todo('B', 'completed')] } as never)
  const text = await band($)
  expect(text).toContain('全部完成')
  expect(text).toContain('用时 1m 12s')
  await clock.advance(FINISH_MS + 100)
  expect(await band($)).toBe('[]')
  // `/todos` still lists it.
  expect((await $.command.run({ ...RUN, command: 'todos', args: '' })).text).toBe('任务 2/2\n✓ A  1m 12s\n✓ B')
  await $.tool.call({ tool: 'TodoWrite', todos: [todo('C', 'in_progress')] } as never)
  expect(await band($)).toContain('C中')
})

test('the band steps aside while a picker is open', async ($, on) => {
  const { clock } = host(on)
  on('prompt.edit', ($, e) => {
    const text = e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end)
    return { text, cursor: e.start + e.inputText.length }
  })
  await $.session.start(START)
  await clock.settle()
  await $.tool.call({ tool: 'TodoWrite', todos: [todo('A', 'in_progress')] } as never)
  const edit = ($.prompt as unknown as { edit: (e: object) => Promise<unknown> }).edit
  await edit({ origin: { kind: 'composer' }, text: '', cursor: 0, start: 0, end: 0, inputText: '/to' })
  expect(await band($)).toBe('[]')
  await $.prompt.submit({ origin: { kind: 'composer' }, wait: false, text: '/todos' })
  expect(await band($)).toContain('A中')
})

test('/todos off and on write the visible row; /todos lists', async ($, on) => {
  const { clock } = host(on)
  await $.session.start(START)
  await clock.settle()
  expect((await $.command.run({ ...RUN, command: 'todos', args: '' })).text).toBe(MESSAGES['zh-Hans']['cmd.none'])
  await $.tool.call({ tool: 'TodoWrite', todos: [todo('A', 'completed'), todo('B', 'in_progress')] } as never)
  expect((await $.command.run({ ...RUN, command: 'todos', args: '' })).text).toBe('任务 1/2\n✓ A\n● B  0s')
  expect((await $.command.run({ ...RUN, command: 'todos', args: 'off' })).text).toBe('任务进度条已隐藏')
  expect(await band($)).toBe('[]')
  expect((await $.command.run({ ...RUN, command: 'todos', args: 'on' })).text).toBe('任务进度条已显示')
  expect(await band($)).toContain('B中')
  expect(rows).toEqual([
    ['todo-bar.visible', false],
    ['todo-bar.visible', true],
  ])
})

test('a resumed session finds its board in the store', async ($, on) => {
  const kept = fromTodos(null, [todo('A', 'completed'), todo('B', 'in_progress')], 1_000_000)
  const { clock } = host(on, { 'board:sess-1': kept })
  await $.session.start(START)
  await clock.settle()
  expect(await band($)).toContain('B中')
})

test('the running task shows its time, yellow once slow; /todos counts its tool calls', { options: { slowMinutes: 5 } }, async ($, on) => {
  const { clock } = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.tool.call({ tool: 'TodoWrite', todos: [todo('A', 'in_progress'), todo('B', 'pending')] } as never)
  expect(await band($)).not.toContain('"0s"')
  await $.tool.call({ tool: 'Bash', command: 'ls' } as never)
  await $.tool.call({ tool: 'Read', file_path: '/tmp/a' } as never)
  // A subagent's call is its own.
  await $.tool.call({ tool: 'Read', file_path: '/tmp/b', agentId: 'a1' } as never)
  await clock.advance(120_000)
  expect(await band($)).toContain('"text":"2m 0s"')
  expect(await band($)).not.toContain('"color":"warning"')
  await clock.advance(200_000)
  expect(await band($)).toContain('"color":"warning"')
  await $.tool.call({ tool: 'TodoWrite', todos: [todo('A', 'completed'), todo('B', 'in_progress')] } as never)
  expect((await $.command.run({ ...RUN, command: 'todos', args: '' })).text).toBe('任务 1/2\n✓ A  5m 20s · 工具调用 2 次\n● B  0s')
})

test('subagents at work show under the running task, each with its tool and time', async ($, on) => {
  const { clock } = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.tool.call({ tool: 'TodoWrite', todos: [todo('A', 'in_progress'), todo('B', 'pending')] } as never)
  for (const d of ['查鉴权', '查路由', '查测试', '查文档']) await $.agent.spawn({ prompt: 'go', description: d, subagentType: 'Explore' } as never)
  await $.tool.call({ tool: 'Grep', pattern: 'x', agentId: 'ag-查鉴权' } as never)
  await clock.advance(90_000)
  let shown = await band($)
  expect(shown).toContain('"text":"Explore"')
  expect(shown).toContain('"text":"查鉴权"')
  expect(shown).toContain('"text":"Grep"')
  expect(shown).toContain('"text":"1m 30s"')
  // Two rows, then the rest counted on one.
  expect(shown).toContain('还有 2 个子代理')
  expect(shown).not.toContain('查测试')
  // An agent's own turn ends its row; the main turn's end drops those the engine no longer runs.
  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 'x', reason: 'answer', agentId: 'ag-查鉴权' } as never)
  expect(await band($)).not.toContain('查鉴权')
  listed = [{ id: 'ag-查路由', status: 'running' }, { id: 'ag-查测试', status: 'completed' }]
  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  shown = await band($)
  expect(shown).toContain('查路由')
  expect(shown).not.toContain('查文档')
  expect((await $.command.run({ ...RUN, command: 'todos', args: '' })).text).toContain('● A  1m 30s · 子代理 4 个')
})

test('showAgents off keeps the band to the tasks', { options: { showAgents: false } }, async ($, on) => {
  const { clock } = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.tool.call({ tool: 'TodoWrite', todos: [todo('A', 'in_progress')] } as never)
  await $.agent.spawn({ prompt: 'go', description: '查鉴权', subagentType: 'Explore' } as never)
  expect(await band($)).not.toContain('查鉴权')
})
