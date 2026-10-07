import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { MESSAGES } from '../hooks/i18n'
import { NO_WATCH, addCall, changeOf, isCheck, labelOf, newReceipt, totals, watchCall } from '../hooks/ledger'

const CWD = '/repo'
const START = { cwd: CWD, surface: 'terminal', isInteractive: true } as const
const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } } as const
const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 140, scroll: { offset: 0, bodyRows: 9 }, view: {} },
} as const
const DONE = { answer: 'ok', durationMs: 133_000, isAborted: false, turnId: 't1', reason: 'answer' } as const
const RULES = { repeatFailures: 3, flipFlops: 2 }

// The /config rows the plugin wrote, and the toasts, in order.
let rows: [string, unknown][] = []
let toasts: string[] = []
// Commands the host fails, by command line.
let failing = new Set<string>()

function host(on: On) {
  rows = []
  toasts = []
  failing = new Set()
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on, {})
  mock.env(on, { LANG: 'zh_CN.UTF-8' })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('config.set', ($, e) => {
    rows.push([e.key, e.value])
    return { value: e.value }
  })
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('session.cwd', () => ({ value: CWD }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('tool.call', ($, e) => {
    const input = e as unknown as Record<string, unknown>
    if (e.tool === 'Bash' && failing.has(String(input.command))) return { isError: true, result: 'exit 1', text: 'exit 1' } as never
    if (e.tool === 'Edit') {
      return { result: { filePath: input.file_path, structuredPatch: [{ lines: ['-a', '+b', '+c'] }], gitDiff: undefined }, text: 'ok' } as never
    }
    if (e.tool === 'Write') return { result: { type: 'create', filePath: input.file_path, content: 'x\ny\nz', structuredPatch: [] }, text: 'ok' } as never
    return { result: 'ok', text: 'ok' } as never
  })
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="core" />
  })
  return { clock }
}

async function band($: Parameters<TestBody>[0]): Promise<string> {
  const ui = await $.ui.mount({ plugin: 'receipt', surface: 'terminal', ...BAND })
  const texts = (await ui.findAll({ type: 'Text' })) as { text?: string }[]
  await ui.unmount()
  // The mark, then the row's outer Text (the nested ones repeat its pieces).
  return texts.slice(0, 2).map(t => t.text ?? '').join('')
}

const edit = (file: string, from: string, to: string) => ({ tool: 'Edit', file_path: `${CWD}/${file}`, old_string: from, new_string: to }) as never
const bash = (command: string) => ({ tool: 'Bash', command }) as never

test('ledger helpers', async () => {
  const call = { tool: 'Edit', input: { file_path: '/repo/src/a.ts' }, result: { gitDiff: { additions: 4, deletions: 1 } }, isError: false }
  expect(changeOf(call, '/repo')).toEqual({ path: 'src/a.ts', added: 4, removed: 1, isNew: false })
  let r = addCall(newReceipt('t', 0), call, '/repo', true)
  r = addCall(r, call, '/repo', true)
  r = addCall(r, { tool: 'Bash', input: { command: 'npm  test' }, result: '', isError: true }, '/repo', true)
  r = addCall(r, { tool: 'Agent', input: {}, result: {}, isError: false }, '/repo', true)
  expect(r.files).toEqual([{ path: 'src/a.ts', added: 8, removed: 2, isNew: false }])
  expect(totals(r)).toEqual({ added: 8, removed: 2 })
  expect(r.failed).toEqual(['npm test'])
  expect(r.agents).toBe(1)
  // A failing call re-run after an edit is iteration, not a loop.
  const fail = { tool: 'Bash', input: { command: 'npm test' }, result: '', isError: true }
  let w = watchCall(NO_WATCH, fail, RULES, '/repo').watch
  w = watchCall(w, fail, RULES, '/repo').watch
  w = watchCall(w, call, RULES, '/repo').watch
  expect(watchCall(w, fail, RULES, '/repo').alert).toBeNull()
  // So is one after a shell command that changed something; a read-only one changes nothing.
  const sed = { tool: 'Bash', input: { command: "sed -i '' s/a/b/ x" }, result: '', isError: false }
  const cat = { ...sed, input: { command: 'cat x' }, isReadOnly: true }
  w = watchCall(watchCall(NO_WATCH, fail, RULES, '/repo').watch, fail, RULES, '/repo').watch
  expect(watchCall(watchCall(w, sed, RULES, '/repo').watch, fail, RULES, '/repo').alert).toBeNull()
  expect(watchCall(watchCall(w, cat, RULES, '/repo').watch, fail, RULES, '/repo').alert?.kind).toBe('repeat')
  expect(labelOf({ tool: 'Bash', input: { command: 'x'.repeat(200) } }, '/repo').length).toBe(80)
  for (const table of Object.values(MESSAGES)) expect(Object.keys(table).sort()).toEqual(Object.keys(MESSAGES.en).sort())
})

test('a turn ends with its receipt above the prompt; the next turn clears it', async ($, on) => {
  const { clock } = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.tool.call({ tool: 'Read', file_path: `${CWD}/a.ts` } as never)
  await $.tool.call(edit('src/a.ts', 'a', 'b'))
  await $.tool.call({ tool: 'Write', file_path: `${CWD}/src/new.ts`, content: 'x\ny\nz' } as never)
  failing.add('npm test')
  await $.tool.call(bash('npm test'))
  await $.tool.call(bash('ls'))
  // A subagent's edit counts toward the turn.
  await $.tool.call({ ...(edit('src/b.ts', 'a', 'b') as object), agentId: 'a1' } as never)
  expect(await band($)).toBe('')
  await $.turn.complete(DONE)
  // The subagent's edit came after the test: the turn ends unverified.
  expect(await band($)).toBe('✓上一轮 2m 13s · 改动 3 个文件 +7 −2 · 命令 2 · 1 失败 · 读取 1 · 未验证')
  const listed = (await $.command.run({ ...RUN, command: 'receipt', args: '' })).text
  expect(listed).toContain('  src/new.ts  +3 −0  新建')
  expect(listed).toContain('失败的命令\n  ✗ npm test')
  expect(listed).toContain('⚠ 最后一次改代码之后没有跑过测试、构建或检查。')
  await $.turn.start({ text: 'again', turnId: 't2' })
  expect(await band($)).toBe('')
})

test('a chat-only turn shows no receipt; an interrupted one is marked', async ($, on) => {
  const { clock } = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.turn.complete(DONE)
  expect(await band($)).toBe('')
  await $.turn.start({ text: 'go', turnId: 't2' })
  await $.tool.call(bash('ls'))
  await $.turn.complete({ ...DONE, turnId: 't2', reason: 'aborted', isAborted: true, durationMs: 5_000 })
  expect(await band($)).toBe('◼已中断，用时 5s · 命令 1')
})

test('the same call failing again and again toasts once; so does an edit undone and redone', async ($, on) => {
  const { clock } = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.turn.start({ text: 'go', turnId: 't1' })
  failing.add('npm test')
  for (let i = 0; i < 5; i++) await $.tool.call(bash('npm test'))
  expect(toasts).toEqual(['⚠ 同一调用已连续失败 3 次：npm test'])
  await $.tool.call(edit('src/a.ts', 'x = 1', 'x = 2'))
  await $.tool.call(edit('src/a.ts', 'x = 2', 'x = 1'))
  await $.tool.call(edit('src/a.ts', 'x = 1', 'x = 2'))
  expect(toasts[1]).toBe('⚠ src/a.ts：来回改了 2 次')
  await $.turn.complete(DONE)
  expect(await band($)).toContain('⚠ 2')
})

test('commands that check the code', async () => {
  for (const command of ['npm test', 'cd web && pnpm run build', 'bash scripts/check.sh claude-code/hud', 'uv run pytest -q', 'npx tsc --noEmit', 'CI=1 go test ./...', 'cargo clippy', 'make', 'claude plugin test .'])
    expect([command, isCheck(command)]).toEqual([command, true])
  for (const command of ['ls', 'git commit -m test', 'cat test.sh', 'npm install', 'echo pytest'])
    expect([command, isCheck(command)]).toEqual([command, false])
})

test('code checked after its last edit, or prose alone, is not flagged', async ($, on) => {
  const { clock } = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.tool.call(edit('src/a.ts', 'a', 'b'))
  await $.tool.call(bash('npm test'))
  await $.tool.call(edit('README.md', 'a', 'b'))
  await $.turn.complete(DONE)
  expect(await band($)).toBe('✓上一轮 2m 13s · 改动 2 个文件 +4 −2 · 命令 1')
})

test('flagUnverified off leaves the receipt unmarked', { options: { flagUnverified: false } }, async ($, on) => {
  const { clock } = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.tool.call(edit('src/a.ts', 'a', 'b'))
  await $.turn.complete(DONE)
  expect(await band($)).toBe('✓上一轮 2m 13s · 改动 1 个文件 +2 −1')
})

test('/receipt off and on write the visible row', { options: { repeatFailures: 0 } }, async ($, on) => {
  const { clock } = host(on)
  await $.session.start(START)
  await clock.settle()
  expect((await $.command.run({ ...RUN, command: 'receipt', args: '' })).text).toBe(MESSAGES['zh-Hans']['cmd.none'])
  await $.turn.start({ text: 'go', turnId: 't1' })
  failing.add('make')
  for (let i = 0; i < 4; i++) await $.tool.call(bash('make'))
  expect(toasts).toEqual([])
  await $.turn.complete(DONE)
  expect((await $.command.run({ ...RUN, command: 'receipt', args: 'off' })).text).toBe('回合回执已隐藏')
  expect(await band($)).toBe('')
  expect((await $.command.run({ ...RUN, command: 'receipt', args: 'on' })).text).toBe('回合回执已显示')
  expect(await band($)).toContain('4 失败')
  expect(rows).toEqual([
    ['receipt.visible', false],
    ['receipt.visible', true],
  ])
})
