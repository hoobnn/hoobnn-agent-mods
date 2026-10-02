import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { formatDuration, pickRandom } from '../hooks/register'
import { FINALE_MS, SPRITE_MS, STAGE_MS, THEMES, THEME_NAMES, finaleScene, segments, textWidth } from '../hooks/themes'

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

/** What a Client's module last drew, as text to search. */
async function drawn(ui: { drawn: (scope?: { in?: string }) => Promise<unknown> }, key: string): Promise<string> {
  return JSON.stringify(await ui.drawn({ in: key }))
}

function host(on: On) {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on, {})
  mock.env(on, { LANG: 'zh_CN.UTF-8' })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: 'ok' }))
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

test('every scene and finale fills exactly its width, every frame', async () => {
  for (const name of THEME_NAMES) {
    const theme = THEMES[name]
    for (const w of [10, 37, 80, 160]) {
      for (let t = 0; t < 120; t += 7) {
        const rows = [...theme.scene(t, w), ...finaleScene(theme, 'answer', '完成 · 12s', t, w), ...finaleScene(theme, 'error', 'x', t, w)]
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
})

test('mascot rides in front of the engine line and animates', async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.command.run({ ...RUN, command: 'spinner', args: 'cat' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'spinner', surface, ...SPINNER })
    expect(await ui.find({ type: 'Text', text: 'Sauteing…' })).toBeDefined()
    expect(await drawn(ui, 'sprite')).toContain('(=^･ω･^=)   ')
    await ui.advance(SPRITE_MS * 3)
    expect(await drawn(ui, 'sprite')).toContain('(=^･ω･^=) ?!')
    await ui.unmount()
  }
})

test('band plays the scene only while working, keeps other bands', async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.command.run({ ...RUN, command: 'spinner', args: 'dino' })

  const idle = await $.ui.mount({ plugin: 'spinner', surface: 'terminal', ...BAND, props: { ...BAND.props, isWorking: false } })
  expect(await idle.findAll({ type: 'Client' })).toHaveLength(0)
  await idle.unmount()

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'spinner', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: 'Sauteing…' })).toBeDefined()
    expect(await drawn(ui, 'work')).toContain('HI 00000')
    await ui.advance(STAGE_MS * 5)
    expect(await drawn(ui, 'work')).toContain('HI 00005')
    await ui.unmount()
  }

  await $.command.run({ ...RUN, command: 'spinner', args: 'stage off' })
  const off = await $.ui.mount({ plugin: 'spinner', surface: 'terminal', ...BAND })
  expect(await off.findAll({ type: 'Client' })).toHaveLength(0)
  await off.unmount()
})

test('a finished turn plays the finale with its time, then clears', async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.turn.complete({ turnId: 't1', reason: 'answer', answer: 'done', durationMs: 12_400, isAborted: false })

  const props = { ...BAND.props, isWorking: false }
  const ui = await $.ui.mount({ plugin: 'spinner', surface: 'terminal', ...BAND, props })
  expect(await drawn(ui, 'finale-t1')).toContain('完成 · 12s')
  await ui.unmount()

  await clock.advance(FINALE_MS)
  const after = await $.ui.mount({ plugin: 'spinner', surface: 'terminal', ...BAND, props })
  expect(await after.findAll({ type: 'Client' })).toHaveLength(0)
  await after.unmount()
})

test('/spinner switches, hides and reports', async ($, on) => {
  const clock = host(on)
  await $.session.start(START)
  await clock.settle()

  expect((await $.command.run({ ...RUN, command: 'spinner', args: 'neon' })).text).toBe('已切换到 neon')
  expect((await $.command.run({ ...RUN, command: 'spinner', args: '' })).text).toContain('当前主题：neon')
  expect((await $.command.run({ ...RUN, command: 'spinner', args: 'nyan' })).text).toContain('没有叫 nyan 的主题')
  expect((await $.command.run({ ...RUN, command: 'spinner', args: 'random' })).text).toContain('每个会话随机一个主题')

  expect((await $.command.run({ ...RUN, command: 'spinner', args: 'off' })).text).toBe('运行动画已关闭')
  const ui = await $.ui.mount({ plugin: 'spinner', surface: 'terminal', ...SPINNER })
  expect(await ui.findAll({ type: 'Text' })).toHaveLength(1)
  await ui.unmount()
})
