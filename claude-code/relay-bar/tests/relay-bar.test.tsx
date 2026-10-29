import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { MESSAGES } from '../hooks/i18n'
import { FINISH_MS } from '../hooks/register'
import { dirTime, doing, formatDuration, fromStatus, lastSentence, merge, paneLines } from '../hooks/runs'
import type { Run } from '../types'

const START = { cwd: '/repo', surface: 'terminal', isInteractive: true } as const
const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } } as const
const RUNS = '/home/me/.local/state/agent-relay/runs'
// 2026-10-29 12:00:00 local, when the session's clock starts.
const T0 = new Date(2026, 9, 29, 12, 0, 0).getTime()
const DIR = '20261029-120001-codex-abc123'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 9 }, view: {} },
} as const
const PANE = {
  component: 'Pane',
  requestId: 'relay-bar',
  props: { title: '派活', isFocused: true, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

// What the runs folder holds, by folder name: its status.json text.
let files: Record<string, string> = {}
let toasts: string[] = []
let panes: string[] = []
// Runs the relay call does while the engine "runs" it.
let during: (() => Promise<void>) | null = null

function status(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    v: 1, cli: 'codex', model: 'gpt-5.5', effort: 'high', pid: 1, cwd: '/repo', prompt: '评审 src/a.ts',
    started: (T0 + 1000) / 1000, updated: (T0 + 2000) / 1000, state: 'running', session_id: 's1',
    tools: { done: 1, total: 2 },
    steps: [{ type: 'thought', text: '先读文件' }, { type: 'tool', title: 'Read src/a.ts', kind: 'read', status: 'in_progress' }],
    ...over,
  })
}

function host(on: On) {
  files = {}
  toasts = []
  panes = []
  during = null
  const clock = mock.clock(on, { now: T0 })
  mock.store(on, {})
  mock.env(on, { LANG: 'zh_CN.UTF-8', HOME: '/home/me' })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('config.set', ($, e) => ({ value: e.value }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.id', () => ({ value: 'sess-me' }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.open', ($, e) => {
    panes.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('fs.list', () => ({
    value: Object.keys(files).map(name => ({ name, kind: 'directory', size: 0, mtimeMs: 0, isLink: false })) as never,
  }))
  on('fs.read', ($, e) => {
    const name = e.path.slice(RUNS.length + 1).split('/')[0] ?? ''
    if (!e.path.startsWith(RUNS) || !(name in files)) throw new Error('ENOENT')
    return { value: files[name]! }
  })
  on('tool.call', async () => {
    if (during) await during()
    return { result: { stdout: '{}', stderr: '', interrupted: false } as never, text: 'ok' }
  })
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="core" />
  })
  return { clock }
}

async function band($: Parameters<TestBody>[0]): Promise<string> {
  const ui = await $.ui.mount({ plugin: 'relay-bar', surface: 'terminal', ...BAND })
  const texts = (await ui.findAll({ type: 'Text' })) as unknown[]
  await ui.unmount()
  return JSON.stringify(texts)
}

const COMMAND = 'python3 "/x/agent-relay/scripts/relay.py" run codex "评审"'
const relay = (over: Record<string, unknown> = {}) => ({ tool: 'Bash', tool_use_id: 'tu-1', command: COMMAND, ...over }) as never

/** The transcript row of the relay call, as drawn through the mod. */
async function row($: Parameters<TestBody>[0], isRunning: boolean): Promise<string> {
  const ui = await $.ui.mount({
    plugin: 'relay-bar',
    surface: 'terminal',
    component: 'ToolUse',
    requestId: 'tu-1',
    props: { tool_use_id: 'tu-1', tool: 'Bash', input: { command: COMMAND }, isRunning, isErrored: false, isInterrupted: false },
  } as never)
  const texts = (await ui.findAll({ type: 'Text' })) as unknown[]
  await ui.unmount()
  return JSON.stringify(texts)
}

test('runs helpers', async () => {
  expect(dirTime(DIR)).toBe(T0 + 1000)
  expect(dirTime('notes')).toBe(null)
  const run = fromStatus(DIR, status())!
  expect(run.startedAt).toBe(T0 + 1000)
  expect(doing(run)).toEqual({ mark: '⚙', text: 'Read src/a.ts' })
  expect(fromStatus(DIR, '{"v":2}')).toBe(null)
  expect(fromStatus(DIR, 'not json')).toBe(null)
  expect(formatDuration(130_000)).toBe('2m 10s')
  // A thought shows its last sentence whole, never cut at the front.
  expect(lastSentence('先读文件。然后检查 write_status 的锁是否覆盖判断')).toBe('然后检查 write_status 的锁是否覆盖判断')
  const msg = fromStatus(DIR, status({ steps: [{ type: 'message', text: '第一行\n第二行\n' }] }))!
  expect(paneLines(msg).map(l => l.text)).toEqual(['第一行', '第二行'])
  // Over the cap, the oldest that ended goes; a live run stays.
  const many: Run[] = Array.from({ length: 11 }, (_, i) => ({ ...run, id: String(i), startedAt: i, state: i === 0 ? 'running' : 'done' }))
  expect(merge([], many).map(r => r.id)).toEqual(['0', '2', '3', '4', '5', '6', '7', '8', '9', '10'])
  for (const table of Object.values(MESSAGES)) expect(Object.keys(table).sort()).toEqual(Object.keys(MESSAGES.en).sort())
})

test('a foreground relay call draws its run under its own row, live, then its end; the band stays clear', async ($, on) => {
  const { clock } = host(on)
  await $.session.start(START)
  await clock.settle()
  expect(await band($)).not.toContain('codex')
  // The call runs on while the test looks at the band.
  let release!: () => void
  const held = new Promise<void>(r => (release = r))
  during = () => held
  const call = $.tool.call(relay())
  files[DIR] = status()
  await clock.advance(1000)
  expect(await band($)).not.toContain('codex')
  let text = await row($, true)
  expect(text).toContain('codex')
  expect(text).toContain('gpt-5.5·high')
  expect(text).toContain('⚙ Read src/a.ts')
  expect(text).toContain('工具 1/2')
  files[DIR] = status({ state: 'done', ended: (T0 + 5000) / 1000, updated: (T0 + 5000) / 1000, files_changed: 3, steps: [{ type: 'message', text: '没问题' }] })
  release()
  await call
  expect(toasts).toEqual(['codex 完成 · 改了 3 个文件'])
  // The row keeps its end in the transcript.
  await clock.advance(FINISH_MS + 31_000)
  expect(await row($, false)).toContain('完成 · 改了 3 个文件')
  expect(await band($)).not.toContain('codex')
})

test('a background call or a subagent call shows on the band, then folds', async ($, on) => {
  const { clock } = host(on)
  await $.session.start(START)
  await clock.settle()
  files[DIR] = status()
  await $.tool.call(relay({ agentId: 'ag-1' }))
  expect(await band($)).toContain('⚙ Read src/a.ts')
  // Its row in the subagent's own transcript, opened from the tasks list, shows it too.
  expect(await row($, false)).toContain('codex')
  files[DIR] = status({ state: 'done', ended: (T0 + 5000) / 1000, updated: (T0 + 5000) / 1000 })
  await clock.advance(1000)
  expect(await band($)).toContain('完成')
  await clock.advance(FINISH_MS + 31_000)
  expect(await band($)).not.toContain('codex')
})

test('other Bash calls start no watch, and folders from before the call are left out', async ($, on) => {
  const { clock } = host(on)
  await $.session.start(START)
  await clock.settle()
  files['20261029-110000-grok-aaaaaa'] = status({ cli: 'grok' })
  await $.tool.call({ tool: 'Bash', command: 'ls' } as never)
  await clock.advance(2000)
  expect(await band($)).toBe('[]')
  await $.tool.call(relay())
  expect(await band($)).not.toContain('grok')
})

test("another session's runs stay out; this session's and the unmarked ones show", async ($, on) => {
  const { clock } = host(on)
  await $.session.start(START)
  await clock.settle()
  files[DIR] = status({ caller_session: 'sess-me' })
  files['20261029-120001-grok-bbbbbb'] = status({ cli: 'grok', caller_session: 'sess-other' })
  files['20261029-120001-pi-cccccc'] = status({ cli: 'pi' })
  await $.tool.call(relay({ agentId: 'ag-1' }))
  const text = await band($)
  expect(text).toContain('codex')
  expect(text).toContain('pi')
  expect(text).not.toContain('grok')
  expect(fromStatus(DIR, status({ caller_session: 'sess-me' }))!.caller).toBe('sess-me')
})

test('a run that stops writing after the call is marked lost', async ($, on) => {
  const { clock } = host(on)
  await $.session.start(START)
  await clock.settle()
  files[DIR] = status()
  // A background call: the engine answers at once, the run goes on.
  await $.tool.call(relay({ run_in_background: true }))
  expect(await band($)).toContain('codex')
  await clock.advance(95_000)
  expect(toasts).toEqual(['codex 失败'])
})

test('/relay opens the pane on the newest run, with its steps; off hides the band', async ($, on) => {
  const { clock } = host(on)
  await $.session.start(START)
  await clock.settle()
  expect((await $.command.run({ ...RUN, command: 'relay', args: '' })).text).toContain('还没有派活')
  files[DIR] = status()
  let release!: () => void
  during = () => new Promise<void>(r => (release = r))
  const call = $.tool.call(relay())
  await clock.advance(1000)
  await $.command.run({ ...RUN, command: 'relay', args: '' })
  expect(panes).toEqual(['relay-bar'])
  const ui = await $.ui.mount({ plugin: 'relay-bar', surface: 'terminal', ...PANE })
  const text = JSON.stringify(await ui.findAll({ type: 'Text' }))
  expect(text).toContain('» 评审 src/a.ts')
  expect(text).toContain('∴ 先读文件')
  expect(text).toContain('⚙ Read src/a.ts')
  await ui.unmount()
  expect((await $.command.run({ ...RUN, command: 'relay', args: 'off' })).text).toBe('派活横条已隐藏')
  expect(await band($)).toBe('[]')
  release()
  await call
})

test('a run the list let go is not read back, nor toasted again', async ($, on) => {
  const { clock } = host(on)
  await $.session.start(START)
  await clock.settle()
  // More runs than the list keeps, all of them left at running by a process long gone.
  for (let i = 0; i < 12; i++) files[`20261029-120001-mcode-${String(i).padStart(6, '0')}`] = status({ cli: 'mcode' })
  await $.tool.call(relay({ run_in_background: true }))
  await clock.advance(95_000)
  expect(toasts.length).toBe(12)
  await clock.advance(10_000)
  expect(toasts.length).toBe(12)
})
