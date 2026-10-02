import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { parseCommand } from '../hooks/command'
import { formatDuration, levelOf, toolLabel } from '../hooks/pet'
import { FINALE_MS, SPRITE_MS, STAGE_MS, THEMES, THEME_NAMES, finaleScene, petRow, pickRandom, segments, textWidth } from '../hooks/themes'
import type { Act } from '../hooks/themes'

const START = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as const

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } } as const

const SPINNER = {
  component: 'Spinner',
  props: { word: 'Sauteing', message: null, suffix: '…', mode: 'thinking' },
} as const

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 9 }, view: {} },
} as const

const IDLE = { ...BAND, props: { ...BAND.props, isWorking: false } }

const DONE = { turnId: 't1', reason: 'answer', answer: 'done', durationMs: 12_400, isAborted: false } as const

/** What a Client's module last drew, as text to search. */
async function drawn(ui: { drawn: (scope?: { in?: string }) => Promise<unknown> }, key: string): Promise<string> {
  return JSON.stringify(await ui.drawn({ in: key }))
}

// The /config rows the plugin wrote, as `[key, value]`.
let rows: [string, unknown][] = []

function host(on: On, stored: Record<string, unknown> = {}) {
  rows = []
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on, stored)
  mock.env(on, { LANG: 'zh_CN.UTF-8' })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('config.set', ($, e) => {
    rows.push([e.key, e.value])
    return { value: e.value }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: 'ok' }))
  on('classic.Notification', () => ({}))
  on('tool.call', async () => {
    await clock.sleep(1000)
    return { deny: 'test' }
  })
  on('ui.render', ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box key="core">
        <Text>Sauteing…</Text>
      </Box>
    )
  })
  return clock
}

test('every scene, finale and companion row fills exactly its width, every frame', async () => {
  const acts: Act[] = ['think', 'tool', 'ask', 'say']
  for (const name of THEME_NAMES) {
    const theme = THEMES[name]
    for (const w of [16, 37, 80, 160]) {
      for (let t = 0; t < 150; t += 7) {
        const scene = theme.scene(t, w, acts[t % 4]!)
        expect(scene).toHaveLength(theme.rows)
        const rows = [
          ...scene,
          ...finaleScene(theme, 'answer', '完成 · 12s', t, w),
          ...finaleScene(theme, 'error', 'x', t, w),
          ...petRow(theme, { state: acts[t % 4]!, bubble: t % 2 ? 'Bash: npm test' : '', stats: 'Lv.3 ♥12' }, t, w, t % 3),
          ...petRow(theme, { state: 'sleep', bubble: 'Zzz…', stats: 'Lv.1 ♥0' }, t, w, 0),
        ]
        for (const row of rows) {
          expect(textWidth(segments(row).map(s => s.text).join(''))).toBe(w)
        }
      }
    }
    for (const frames of Object.values(theme.sprite)) expect(frames.length).toBeGreaterThan(0)
  }
})

test('helpers', async () => {
  expect(formatDuration(12_400)).toBe('12s')
  expect(formatDuration(185_000)).toBe('3m 05s')
  expect(formatDuration(3_720_000)).toBe('1h 02m')
  for (let i = 0; i < 50; i++) expect(THEME_NAMES).toContain(pickRandom(i))
  expect([0, 1, 2, 8, 18].map(levelOf)).toEqual([1, 1, 2, 3, 4])
  expect(toolLabel({ tool: 'Bash', command: 'npm test\nnpm run lint' })).toBe('Bash: npm test')
  expect(toolLabel({ tool: 'Edit', file_path: '/a/b/themes.ts' })).toBe('Edit: themes.ts')
  expect(toolLabel({ tool: 'mcp__github__create_issue' })).toBe('create_issue')
})

test('one mascot: in the companion row, or in front of the engine line without it', async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.command.run({ ...RUN, command: 'spinner', args: 'cat' })
  const plain = await $.ui.mount({ plugin: 'spinner', surface: 'terminal', ...SPINNER })
  expect(await plain.findAll({ type: 'Client' })).toHaveLength(0)
  await plain.unmount()

  await $.command.run({ ...RUN, command: 'spinner', args: 'companion off' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'spinner', surface, ...SPINNER })
    expect(await ui.find({ type: 'Text', text: 'Sauteing…' })).toBeDefined()
    expect(await drawn(ui, 'sprite')).toContain('(=^･ω･^=)   ')
    await ui.advance(SPRITE_MS * 3)
    expect(await drawn(ui, 'sprite')).toContain('(=^･ω･^=) ?!')
    await ui.unmount()
  }
})

test('band plays the scene and the companion while working, keeps other bands', async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.command.run({ ...RUN, command: 'spinner', args: 'dino' })
  await $.turn.start({ text: 'hi', turnId: 't1' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'spinner', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: 'Sauteing…' })).toBeDefined()
    expect(await drawn(ui, 'work')).toContain('HI 00000')
    expect(await drawn(ui, 'work')).toContain('Lv.1 ♥0')
    // Thinking is the engine's line to say; the bubble stays quiet.
    expect(await drawn(ui, 'work')).not.toContain(' · ')
    await ui.advance(STAGE_MS * 5)
    expect(await drawn(ui, 'work')).toContain('HI 00005')
    await ui.unmount()
  }

  await $.command.run({ ...RUN, command: 'spinner', args: 'stage off' })
  const off = await $.ui.mount({ plugin: 'spinner', surface: 'terminal', ...BAND })
  expect(await drawn(off, 'work')).not.toContain('HI 0')
  expect(await drawn(off, 'work')).toContain('Lv.1 ♥0')
  await off.unmount()
})

test('the companion follows tool calls and permission prompts', async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.turn.start({ text: 'hi', turnId: 't1' })

  const call = $.tool.call({ tool: 'Bash', command: 'npm test' })
  await clock.settle()
  let ui = await $.ui.mount({ plugin: 'spinner', surface: 'terminal', ...BAND })
  expect(await drawn(ui, 'work')).toContain('Bash: npm test')
  await ui.unmount()

  await $.classic.Notification({ notification_type: 'permission_prompt', message: 'Claude needs your permission' })
  ui = await $.ui.mount({ plugin: 'spinner', surface: 'terminal', ...BAND })
  expect(await drawn(ui, 'work')).toContain('等你确认一下～')
  await ui.unmount()

  await clock.advance(1000)
  await call
  ui = await $.ui.mount({ plugin: 'spinner', surface: 'terminal', ...BAND })
  expect(await drawn(ui, 'work')).not.toContain('Bash: npm test')
  expect(await drawn(ui, 'work')).not.toContain('等你确认')
  await ui.unmount()
})

test('a finished turn plays the finale, then the companion waits; a click pats it', async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.turn.complete(DONE)

  const ui = await $.ui.mount({ plugin: 'spinner', surface: 'terminal', ...IDLE })
  expect(await drawn(ui, 'finale-t1')).toContain('完成 · 12s')
  await ui.unmount()

  await clock.advance(FINALE_MS)
  const idle = await $.ui.mount({ plugin: 'spinner', surface: 'terminal', ...IDLE })
  expect(await drawn(idle, 'idle')).toContain('做完啦，快看看！')
  expect(await drawn(idle, 'idle')).toContain('Lv.1 ♥0')
  await idle.post({ pat: true })
  expect(await drawn(idle, 'idle')).toContain('Lv.1 ♥1')
  expect(await drawn(idle, 'idle')).toMatch(/"(♡|♥)"/)
  await idle.unmount()

  expect((await $.command.run({ ...RUN, command: 'spinner', args: 'pet' })).text).toContain('♥2')

  await $.command.run({ ...RUN, command: 'spinner', args: 'companion off' })
  const none = await $.ui.mount({ plugin: 'spinner', surface: 'terminal', ...IDLE })
  expect(await none.findAll({ type: 'Client' })).toHaveLength(0)
  await none.unmount()
})

test('/spinner switches, hides and reports', async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()

  expect((await $.command.run({ ...RUN, command: 'spinner', args: 'thunder' })).text).toBe('已切换到 thunder')
  const status = (await $.command.run({ ...RUN, command: 'spinner', args: '' })).text
  expect(status).toContain('当前主题：thunder')
  expect(status).toContain('thunder · Lv.1 · 经验 0 · ♥0')
  expect((await $.command.run({ ...RUN, command: 'spinner', args: 'nyancat' })).text).toContain('没有叫 nyancat 的主题')
  expect((await $.command.run({ ...RUN, command: 'spinner', args: 'random' })).text).toContain('每个会话随机一个主题')

  expect((await $.command.run({ ...RUN, command: 'spinner', args: 'off' })).text).toBe('运行动画已关闭')
  const ui = await $.ui.mount({ plugin: 'spinner', surface: 'terminal', ...SPINNER })
  expect(await ui.findAll({ type: 'Text' })).toHaveLength(1)
  await ui.unmount()
  const band = await $.ui.mount({ plugin: 'spinner', surface: 'terminal', ...IDLE })
  expect(await band.findAll({ type: 'Client' })).toHaveLength(0)
  await band.unmount()
})

test('/spinner arguments', async () => {
  expect(parseCommand('')).toEqual({ kind: 'status' })
  expect(parseCommand(' OFF ')).toEqual({ kind: 'visible', isOn: false })
  expect(parseCommand('stage on')).toEqual({ kind: 'stage', isOn: true })
  expect(parseCommand('stage')).toEqual({ kind: 'unknown', name: 'stage' })
  expect(parseCommand('companion off')).toEqual({ kind: 'companion', isOn: false })
  expect(parseCommand('preview')).toEqual({ kind: 'preview', theme: null })
  expect(parseCommand('preview neon')).toEqual({ kind: 'preview', theme: 'neon' })
  expect(parseCommand('preview x')).toEqual({ kind: 'unknown', name: 'x' })
  expect(parseCommand('Random')).toEqual({ kind: 'theme', theme: 'random' })
  expect(parseCommand('cat')).toEqual({ kind: 'theme', theme: 'cat' })
})

test('/spinner writes its /config rows, once per change', { options: { theme: 'dino' } }, async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.command.run({ ...RUN, command: 'spinner', args: 'neon' })
  await $.command.run({ ...RUN, command: 'spinner', args: 'stage off' })
  await $.command.run({ ...RUN, command: 'spinner', args: 'stage off' })
  await $.command.run({ ...RUN, command: 'spinner', args: 'companion off' })
  await $.command.run({ ...RUN, command: 'spinner', args: 'off' })
  expect(rows).toEqual([
    ['spinner.theme', 'neon'],
    ['spinner.stage', false],
    ['spinner.companion', false],
    ['spinner.visible', false],
  ])
})

test('settings older versions kept in the store move to /config rows', async ($, on) => {
  const clock = host(on, { theme: 'cat', isStageOff: true, isCompanionOff: false, isHidden: false })
  await $.session.start(START)
  await clock.settle()
  expect(rows).toEqual([
    ['spinner.theme', 'cat'],
    ['spinner.visible', true],
    ['spinner.stage', false],
    ['spinner.companion', true],
  ])
  expect((await $.command.run({ ...RUN, command: 'spinner', args: '' })).text).toContain('当前主题：cat')
  // A reload (a row changed) keeps the session's theme; the store holds nothing to move again.
  await $.session.start(START)
  await clock.settle()
  expect(rows).toHaveLength(4)
})

test('random keeps the theme it drew this session across a reload', async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  const first = (await $.command.run({ ...RUN, command: 'spinner', args: '' })).text?.split('\n')[0]
  await clock.advance(12_345)
  await $.session.start(START)
  await clock.settle()
  expect((await $.command.run({ ...RUN, command: 'spinner', args: '' })).text?.split('\n')[0]).toBe(first)
})
