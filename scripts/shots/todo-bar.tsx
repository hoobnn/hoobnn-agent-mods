// The todo-bar band mid-list, for scripts/mod-shots.ts.
import type { On } from 'claude-code'
import { mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 88, scroll: { offset: 0, bodyRows: 9 }, view: {} },
} as const

function host(on: On) {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on, {})
  mock.env(on, { LANG: 'zh_CN.UTF-8' })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.id', () => ({ value: 'sess-1' }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('tool.call', ($, e) => {
    const input = e as unknown as Record<string, unknown>
    if (e.tool === 'TodoWrite') return { result: { oldTodos: [], newTodos: input.todos }, text: 'ok' }
    return { result: 'ok', text: 'ok' }
  })
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="core" />
  })
  return clock
}

const todo = (content: string, activeForm: string, status: 'pending' | 'in_progress' | 'completed') => ({ content, status, activeForm })

async function shot($: Parameters<TestBody>[0], name: string) {
  const ui = await $.ui.mount({ plugin: 'todo-bar', surface: 'terminal', ...BAND })
  console.log(`@@SHOT ${name} ${JSON.stringify(await ui.drawn())}`)
  await ui.unmount()
}

const LIST = ['读懂现有主题系统', '给 HUD 加主题切换', '写测试', '跑构建', '更新 README', '发版']
const ACTIVE = ['读懂现有主题系统中', '给 HUD 加主题切换中', '编写测试中', '跑构建中', '更新 README 中', '发版中']

test('shots', async ($, on) => {
  const clock = host(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const at = (running: number) => LIST.map((t, i) => todo(t, ACTIVE[i]!, i < running ? 'completed' : i === running ? 'in_progress' : 'pending'))
  await $.tool.call({ tool: 'TodoWrite', todos: at(0) } as never)
  await clock.advance(60_000)
  await $.tool.call({ tool: 'TodoWrite', todos: at(2) } as never)
  await clock.advance(192_000)
  await shot($, 'preview')
  await $.tool.call({ tool: 'TodoWrite', todos: at(LIST.length) } as never)
  await shot($, 'done')
})
