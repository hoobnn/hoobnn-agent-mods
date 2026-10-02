import type { On } from 'claude-code'
import { type Engine, expect, mock, test } from 'claude-code/testing'

import { parseAnsi } from '../hooks/ansi'
import {
  addDays,
  appendExtras,
  chimeWav,
  crossThresholds,
  dimSeparators,
  exhaustAt,
  extrasLine,
  lastDays,
  parseGitStatus,
  parseThresholds,
  sparkline,
  streak,
} from '../hooks/extras'
import { setLanguage } from '../hooks/hud/i18n/index'
import { MESSAGES, m, money } from '../hooks/i18n'
import { cleanSummary, rcSpans } from '../hooks/register'
import { DEFAULT_CONFIG, mergeConfig } from '../hooks/hud/config'
import { applyPalette, applyTheme, findTheme, gradientAt, moodOf, THEMES } from '../hooks/themes'

const HOME = '/home/u'
const CWD = '/home/u/proj'
const CONFIG = JSON.stringify({
  language: 'zh-Hans',
  lineLayout: 'expanded',
  display: { showTools: true, showAgents: true, showTodos: true, contextValue: 'tokens', modelFormat: 'short' },
})
const TRANSCRIPT = `${HOME}/.claude/projects/-home-u-proj/sess-1.jsonl`
const LINES = [
  { type: 'user', timestamp: '2026-10-02T06:00:00Z', message: { role: 'user', content: 'hi' } },
  {
    type: 'assistant',
    timestamp: '2026-10-02T06:00:05Z',
    message: {
      id: 'm1',
      model: 'claude-opus-5-5',
      usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100 },
      content: [
        { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: `${CWD}/a.ts` } },
        { type: 'tool_use', id: 't2', name: 'Agent', input: { subagent_type: 'Explore', description: 'Map the repo' } },
      ],
    },
  },
].map(l => JSON.stringify(l)).join('\n') + '\n'

const SESSION_FILE = `${HOME}/.claude/sessions/4242.json`
const sessionEntry = (bridgeSessionId: string | null) => JSON.stringify({ pid: 4242, sessionId: 'sess-1', bridgeSessionId })
const FILES: Record<string, string> = {
  [`${HOME}/.claude/plugins/claude-hud/config.json`]: CONFIG,
  [TRANSCRIPT]: LINES,
  [`${HOME}/.claude/sessions/4141.json`]: JSON.stringify({ pid: 4141, sessionId: 'other', bridgeSessionId: 'session_other' }),
  [SESSION_FILE]: sessionEntry(null),
}
const DIRS = new Set([HOME, `${HOME}/.claude`, `${HOME}/.claude/sessions`, CWD])

let contextPercent = 23
// Each command's description, as the mod registered it.
const registered: string[] = []

function host(on: On, stored: Record<string, unknown> | null = {}) {
  const clock = mock.clock(on, { now: Date.parse('2026-10-02T06:01:00Z') })
  // null: the test answers the store itself.
  if (stored) mock.store(on, stored)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  const stat = (path: string) => {
    if (path in FILES) return { kind: 'file' as const, size: FILES[path]!.length, mtimeMs: 1, isLink: false, realPath: path }
    if (DIRS.has(path)) return { kind: 'dir' as const, size: 0, mtimeMs: 1, isLink: false, realPath: path }
    return null
  }
  on('fs.stat', ($, e) => {
    const s = stat(e.path)
    return s ? { value: s } : { deny: 'ENOENT' }
  })
  on('fs.exists', ($, e) => ({ value: stat(e.path) !== null }))
  on('fs.read', ($, e) => (e.path in FILES ? { value: FILES[e.path]! } : { deny: 'ENOENT' }))
  on('fs.list', ($, e) => ({
    value: Object.keys(FILES)
      .filter(path => path.startsWith(`${e.path}/`) && !path.slice(e.path.length + 1).includes('/'))
      .map(path => ({ name: path.slice(e.path.length + 1), kind: 'file' as const, size: FILES[path]!.length, mtimeMs: 1, isLink: false })),
  }))
  on('fs.write', () => ({ value: undefined }))
  on('process.run', ($, e) => {
    const argv = e.argv.join(' ')
    let stdout = ''
    let exitCode = 0
    if (argv.startsWith('/usr/bin/env')) stdout = `HOME=${HOME}\0`
    else if (argv.startsWith('/usr/bin/uname')) stdout = 'Darwin\n'
    else if (argv.startsWith('/usr/sbin/sysctl')) stdout = '17179869184\n'
    else if (argv.startsWith('/bin/sh -c tail')) stdout = e.argv[4] === '1' ? FILES[TRANSCRIPT]! : ''
    else if (argv.includes('rev-parse --git-dir')) stdout = '.git\n.git\n/home/u/proj\n'
    else if (argv.startsWith('git')) {
      if (argv.includes('branch --show-current') || argv.includes('symbolic-ref')) stdout = 'main\n'
      else if (argv.includes('--porcelain=v2')) {
        stdout = '# branch.oid abc123\0# branch.head main\0' + '1 .M N... 100644 100644 100644 abc abc a.ts\0'
      } else if (argv.includes('status')) stdout = '## main\n M a.ts\n'
      else if (argv.includes('rev-parse')) stdout = 'main\n'
    } else exitCode = 1
    return { value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('session.id', () => ({ value: 'sess-1' }))
  on('session.cwd', () => ({ value: CWD }))
  on('session.repo', () => ({ value: { root: CWD, remote: 'git@github.com:o/proj.git', internal: false, name: null } }))
  on('session.root', () => ({ value: CWD }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', () => ({
    value: {
      startedAt: Date.parse('2026-10-02T06:00:00Z'),
      context: { tokens: 45_000, window: 200_000, percent: contextPercent },
      rateLimits: [{ kind: 'five_hour', percentUsed: 25, resetsAt: '2026-10-02T09:00:00Z' }],
      cost: { usd: 1.23 },
    },
  }))
  on('session.version', () => ({ value: { version: '2.1.287', base: '2.1.287', builtAt: '2026-10-01T00:00:00Z' } }))
  on('settings.read', () => ({ value: {} }))
  on('command.register', ($, e) => {
    registered.push(e.description ?? '')
    return { value: { command: e.name } }
  })
  on('tool.register', ($, e) => ({ value: { tool: e.name } }))
  return clock
}

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 140, scroll: { offset: 0, bodyRows: 19 }, view: {} },
} as const

test('ansi spans keep colors and text', async () => {
  const spans = parseAnsi('\x1b[0m\x1b[36m[Opus]\x1b[0m \x1b[38;5;208mx\x1b[2my\x1b[0m')
  expect(spans).toEqual([
    { color: 'cyan', text: '[Opus]' },
    { text: ' ' },
    { color: 'ansi256(208)', text: 'x' },
    { color: 'ansi256(208)', dimColor: true, text: 'y' },
  ])
})

test('https links ride on spans, file links drop', async () => {
  const spans = parseAnsi('\x1b]8;;file:///p\x1b\\proj\x1b]8;;\x1b\\ \x1b[36m\x1b]8;;https://github.com/o/n/tree/main\x1b\\main\x1b]8;;\x1b\\\x1b[0m')
  expect(spans).toEqual([
    { text: 'proj ' },
    { color: 'cyan', href: 'https://github.com/o/n/tree/main', text: 'main' },
  ])
})

const SURFACES = ['terminal', 'desktop'] as const
const HINT = { component: 'PromptHint', props: { isDraft: false, isWorking: false, hint: '? for shortcuts' } } as const

test('band renders claude-hud lines from the session on every surface', async ($, on) => {
  const clock = host(on)
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="core" />
  })
  await $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true })
  for (let i = 0; i < 30; i++) await clock.settle()
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'hud', surface, ...BAND })
    const shown = (await ui.findAll({ type: 'Text' })).map(t => t.text).join('')
    expect(/Opus 5\.5/.test(shown)).toBe(true)
    expect(/proj git:\(main\*\)/.test(shown)).toBe(true)
    expect(await ui.find({ type: 'Link' })).toBeDefined()
    expect(/45k\/200k/.test(shown)).toBe(true)
    expect(/25%/.test(shown)).toBe(true)
    expect(/◐ Read/.test(shown)).toBe(true)
    // Claude Code lists subagents itself: claude-hud's agent line stays off.
    expect(/Map the repo/.test(shown)).toBe(false)
    await ui.unmount()
  }
})

test('position below draws under the prompt and leaves the band alone', { options: { position: 'below' } }, async ($, on) => {
  const clock = host(on)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text key="core">? for shortcuts</Text>
  })
  await $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true })
  for (let i = 0; i < 30; i++) await clock.settle()
  for (const surface of SURFACES) {
    const hint = await $.ui.mount({ plugin: 'hud', surface, ...HINT })
    const shown = (await hint.findAll({ type: 'Text' })).map(t => t.text).join('')
    expect(/Opus 5\.5/.test(shown)).toBe(true)
    expect(/for shortcuts/.test(shown)).toBe(true)
    await hint.unmount()
    const band = await $.ui.mount({ plugin: 'hud', surface, ...BAND })
    expect(await band.find({ type: 'Text', text: /Opus/ })).toBeUndefined()
    await band.unmount()
  }
})


test('rc label links the bridge session and names attached clients by surface', async () => {
  setLanguage('zh-Hans')
  const phone = { id: 'p1', surface: 'mobile' }
  expect(rcSpans(null, [phone])).toEqual([])
  expect(rcSpans('session_x', [])).toEqual([
    { text: ' │ ' },
    { text: '⇄ 远程控制', color: 'green', href: 'https://claude.ai/code/session_x' },
  ])
  const attached = [phone, { id: 'w1', surface: 'desktop' }, { id: 'w2', surface: 'desktop' }]
  expect(rcSpans('session_x', attached).at(-1)).toEqual({ text: ' 已连接 手机 · 网页/桌面×2', color: 'cyan' })
  // The Claude app over Remote Control is known only by its messages.
  const bridge = { id: 'bridge', surface: 'bridge' }
  expect(rcSpans('session_x', [bridge]).at(-1)).toEqual({ text: ' 已连接', color: 'cyan' })
  expect(rcSpans('session_x', [bridge, phone]).at(-1)).toEqual({ text: ' 已连接 手机', color: 'cyan' })
})

test('rc state follows this session\'s entry in sessions/', async ($, on) => {
  const clock = host(on)
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="core" />
  })
  const shown = async () => {
    const ui = await $.ui.mount({ plugin: 'hud', surface: 'terminal', ...BAND })
    const links = await ui.findAll({ type: 'Link' })
    await ui.unmount()
    return links.map(l => l.props.href).find(href => /^https:\/\/claude\.ai\/code\//.test(String(href)))
  }
  try {
    await $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true })
    for (let i = 0; i < 30; i++) await clock.settle()
    expect(await shown()).toBeUndefined()
    FILES[SESSION_FILE] = sessionEntry('session_abc')
    await clock.advance(15_000)
    for (let i = 0; i < 30; i++) await clock.settle()
    expect(await shown()).toBe('https://claude.ai/code/session_abc')
  } finally {
    FILES[SESSION_FILE] = sessionEntry(null)
  }
})

test('thresholds fire once and re-arm after a drop', async () => {
  const t = parseThresholds('90, 80,abc,120')
  expect(t).toEqual([80, 90])
  const a = crossThresholds(85, t, [])
  expect(a).toEqual({ alert: 80, fired: [80] })
  expect(crossThresholds(86, t, a.fired).alert).toBe(null)
  expect(crossThresholds(95, t, a.fired)).toEqual({ alert: 90, fired: [80, 90] })
  // After /compact the percent falls well below: both re-arm.
  expect(crossThresholds(30, t, [80, 90]).fired).toEqual([])
})

test('forecast names the time a window runs out before its reset', async () => {
  const now = Date.parse('2026-10-02T06:00:00Z')
  const hour = 3600_000
  // 5h window, 2h in, 60% used: 100% at 3h20m in, before the reset at 5h.
  const resets = (now + 3 * hour) / 1000
  expect(exhaustAt(60, resets, 5 * hour, now)).toBe(now + (40 / 60) * 2 * hour)
  // 20% after 2h lasts to the reset.
  expect(exhaustAt(20, resets, 5 * hour, now)).toBe(null)
  expect(exhaustAt(5, resets, 5 * hour, now)).toBe(null)
})

test('extras fit the width: low parts drop, the row joins the last line when it fits', async () => {
  const x = { summary: 'Fix login', exhaust: [], todayUsd: 3, budgetUsd: 10, week: { values: [1, 2, 0, 0, 0, 0, 3], streak: 1 }, git: null, gitDirtyWarn: 20, gitAheadWarn: 5 }
  const text = (row: { text: string }[]) => row.map(s => s.text).join('')
  expect(text(extrasLine(x))).toMatch(/Fix login │ .* │ /)
  // Too narrow for all three: the sparkline goes first, then the budget.
  const narrow = text(extrasLine({ ...x, columns: 60 }))
  expect(narrow).toMatch(/Fix login │ /)
  expect(narrow).not.toMatch(/▁/)
  expect(text(extrasLine({ ...x, columns: 12 }))).toBe('✎ Fix login')
  const rows = [[{ text: 'a' }], [{ text: '◐ Read' }]]
  const extra = [{ text: '✎ x' }]
  expect(appendExtras(rows, extra, 80)).toEqual([[{ text: 'a' }], [{ text: '◐ Read' }, { text: ' │ ', dimColor: true }, { text: '✎ x' }]])
  expect(appendExtras(rows, extra, 8)).toEqual([...rows, extra])
  expect(dimSeparators([{ text: 'Opus │ proj', color: 'cyan' }])).toEqual([
    { text: 'Opus', color: 'cyan' },
    { text: ' │ ', dimColor: true },
    { text: 'proj', color: 'cyan' },
  ])
})

test('history helpers: sparkline, streak, git counts, summary', async () => {
  expect(sparkline([0, 1, 2, 4])).toBe('▁▃▅█')
  const today = '2026-10-02'
  const days = { [addDays(today, -2)]: 1, [addDays(today, -1)]: 2, [today]: 0.5, [addDays(today, -4)]: 3 }
  expect(streak(days, today)).toBe(3)
  expect(streak({ [addDays(today, -1)]: 1 }, today)).toBe(1)
  expect(lastDays(days, today, 3)).toEqual([1, 2, 0.5])
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  expect(parseGitStatus('# branch.oid x\n# branch.ab +3 -1\n1 .M a\n? b\n')).toEqual({ dirty: 2, ahead: 3 })
  expect(cleanSummary('“修复登录页的跳转 bug。”\n')).toBe('修复登录页的跳转 bug')
  expect(cleanSummary('« Corriger la redirection »')).toBe('Corriger la redirection')
  expect(cleanSummary('  \n')).toBe(null)
  // Cut by columns: a CJK character takes two.
  expect(cleanSummary('一二三四五六七八九十', 10)).toBe('一二三四…')
  setLanguage('zh-Hans')
  expect(chimeWav().startsWith('UklGR')).toBe(true)
  const line = extrasLine({
    summary: null,
    exhaust: [],
    todayUsd: 12,
    budgetUsd: 10,
    week: null,
    git: { dirty: 25, ahead: 1 },
    gitDirtyWarn: 20,
    gitAheadWarn: 5,
  })
  expect(line.map(s => s.text).join('')).toBe('今日 $12.00/$10.00 ▓▓▓▓▓▓▓▓ │ ⚠ 25 个改动未提交')
  expect(line.find(s => s.text.startsWith('▓'))?.color).toBe('red')
})

const DONE = { answer: 'ok', durationMs: 90_000, isAborted: false, turnId: 't1', reason: 'answer' } as const

test('a long turn toasts and chimes, then the summary joins the HUD', { options: { notifyAfterSeconds: 60 } }, async ($, on) => {
  const clock = host(on)
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="core" />
  })
  const toasts: string[] = []
  let chimes = 0
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('audio.play', () => {
    chimes++
    return { value: undefined }
  })
  on('model.fork', () => ({
    value: { isAnswered: true, text: '给 HUD 加提醒与摘要', usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } },
  }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  await $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true })
  for (let i = 0; i < 30; i++) await clock.settle()

  await $.turn.complete({ ...DONE, durationMs: 5_000 })
  expect(toasts.length).toBe(0)
  await $.turn.complete(DONE)
  for (let i = 0; i < 30; i++) await clock.settle()
  expect(toasts).toEqual(['✓ 本轮完成，用时 1m30s'])
  expect(chimes).toBe(1)
  // The summary lands, then the debounced refresh draws it.
  await clock.advance(1_000)
  for (let i = 0; i < 30; i++) await clock.settle()

  const ui = await $.ui.mount({ plugin: 'hud', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: '✎ 给 HUD 加提醒与摘要' })).toBeDefined()
  await ui.unmount()
})

test('context crossing a threshold toasts once', { options: { contextAlerts: '80,90' } }, async ($, on) => {
  contextPercent = 85
  try {
    const clock = host(on)
    const toasts: string[] = []
    on('ui.toast', ($, e) => {
      toasts.push(e.text)
      return { value: undefined }
    })
    await $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true })
    for (let i = 0; i < 30; i++) await clock.settle()
    await clock.advance(15_000)
    for (let i = 0; i < 30; i++) await clock.settle()
    expect(toasts).toEqual(['上下文已用 80%，可以考虑 /compact'])
  } finally {
    contextPercent = 23
  }
})

test('detail pane lists tool time and the spend history', async ($, on) => {
  const today = new Date(Date.parse('2026-10-02T06:01:00Z'))
  const day = (n: number) => addDays(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`, n)
  const clock = host(on, { history: { [day(-1)]: 2, [day(-2)]: 1 } })
  on('tool.call', () => ({ result: 'ok', text: 'ok' }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.panes', () => ({ value: [] }))
  await $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true })
  for (let i = 0; i < 30; i++) await clock.settle()
  await $.tool.call({ tool: 'Bash', input: { command: 'ls' }, tool_use_id: 'u1' } as never)
  const opened = await $.command.run({
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 120 },
    command: 'hud',
    args: 'detail',
  })
  expect(opened.text).toBe('HUD 详情面板已打开（/hud detail 关闭）')
  for (const surface of SURFACES) {
    const pane = await $.ui.mount({
      plugin: 'hud',
      surface,
      component: 'Pane',
      requestId: 'hud-detail',
      props: { title: 'HUD 详情', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
    })
    expect(await pane.find({ type: 'Text', text: 'Bash' })).toBeDefined()
    const shown = (await pane.findAll({ type: 'Text' })).map(t => t.text).join('')
    expect(/连续 2 天/.test(shown)).toBe(true)
    await pane.unmount()
  }
})

test('alerts and the turn-done toast are off by default', async ($, on) => {
  contextPercent = 95
  try {
    const clock = host(on)
    const toasts: string[] = []
    on('ui.toast', ($, e) => {
      toasts.push(e.text)
      return { value: undefined }
    })
    on('turn.complete', ($, e) => ({ text: e.answer }))
    await $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true })
    for (let i = 0; i < 30; i++) await clock.settle()
    await $.turn.complete({ ...DONE, durationMs: 600_000 })
    for (let i = 0; i < 30; i++) await clock.settle()
    expect(toasts).toEqual([])
  } finally {
    contextPercent = 23
  }
})

test('every locale carries every message with the same placeholders', async () => {
  const holes = (text: unknown) =>
    [...new Set(Object.values(typeof text === 'string' ? { other: text } : (text as object)).flatMap(v => String(v).match(/\{\w+\}/g) ?? []))].sort()
  for (const [lang, messages] of Object.entries(MESSAGES)) {
    for (const [key, text] of Object.entries(MESSAGES.en)) {
      expect([lang, key, holes((messages as Record<string, unknown>)[key])]).toEqual([lang, key, holes(text)])
    }
  }
})

test('plurals, money and percent spacing follow the language', async () => {
  expect(m('git.dirty', { n: 1 }, 'en')).toBe('1 uncommitted change')
  expect(m('git.dirty', { n: 21 }, 'ru')).toBe('21 незакоммиченное изменение')
  expect(m('git.dirty', { n: 22 }, 'ru')).toBe('22 незакоммиченных изменения')
  expect(m('git.dirty', { n: 25 }, 'ru')).toBe('25 незакоммиченных изменений')
  expect(m('streak', { n: 3 }, 'de')).toBe('3 Tage in Folge')
  expect(m('alert.fiveHour', { p: 80 }, 'fr')).toBe('Limite de 5 heures utilisée à 80\u00a0%')
  expect(money(3.2, 'en')).toBe('$3.20')
  expect(money(3.2, 'de')).toBe('3,20\u00a0$')
  expect(money(3.2, 'ja')).toBe('$3.20')
})

test('the band follows claude-hud\'s language', async ($, on) => {
  const config = FILES[`${HOME}/.claude/plugins/claude-hud/config.json`]!
  FILES[`${HOME}/.claude/plugins/claude-hud/config.json`] = config.replace('"zh-Hans"', '"de"')
  try {
    const clock = host(on)
    on('ui.render', ($, e) => {
      const { Box } = $.ui.resolve(e)
      return <Box key="core" />
    })
    registered.length = 0
    await $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true })
    for (let i = 0; i < 30; i++) await clock.settle()
    expect(registered[0]).toBe('claude-hud-Leiste ein- oder ausblenden; detail öffnet den Detailbereich; theme wechselt das Design')
    const ui = await $.ui.mount({ plugin: 'hud', surface: 'terminal', ...BAND })
    const shown = (await ui.findAll({ type: 'Text' })).map(t => t.text).join('')
    expect(/Kontext/.test(shown)).toBe(true)
    await ui.unmount()
  } finally {
    FILES[`${HOME}/.claude/plugins/claude-hud/config.json`] = config
    setLanguage('zh-Hans')
  }
})

test('showAgents brings claude-hud\'s subagent lines back', { options: { showAgents: true } }, async ($, on) => {
  const clock = host(on)
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="core" />
  })
  await $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true })
  for (let i = 0; i < 30; i++) await clock.settle()
  const ui = await $.ui.mount({ plugin: 'hud', surface: 'terminal', ...BAND })
  const shown = (await ui.findAll({ type: 'Text' })).map(t => t.text).join('')
  expect(/Map the repo/.test(shown)).toBe(true)
  await ui.unmount()
})

const COMMAND = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 }, command: 'hud' } as const

async function bandText($: Engine): Promise<string> {
  const ui = await $.ui.mount({ plugin: 'hud', surface: 'terminal', ...BAND })
  const shown = (await ui.findAll({ type: 'Text' })).map(t => t.text).join('')
  await ui.unmount()
  return shown
}

test('the theme option swaps glyphs and palette, and the anime mascot joins', { options: { theme: 'sakura' } }, async ($, on) => {
  const clock = host(on)
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="core" />
  })
  await $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true })
  for (let i = 0; i < 30; i++) await clock.settle()
  const ui = await $.ui.mount({ plugin: 'hud', surface: 'terminal', ...BAND })
  const shown = (await ui.findAll({ type: 'Text' })).map(t => t.text).join('')
  expect(/🌸Opus 5\.5/.test(shown) || /🌸 Opus 5\.5/.test(shown)).toBe(true)
  expect(/🍡 main\*/.test(shown)).toBe(true)
  expect(/git:\(/.test(shown)).toBe(false)
  expect(/💗 上下文/.test(shown)).toBe(true)
  expect(/ ✿ /.test(shown)).toBe(true)
  // A tool is running in the transcript: the mascot is busy.
  expect(shown.includes('(๑•̀ㅂ•́)و✧')).toBe(true)
  await ui.unmount()
})

test('/hud theme lists, switches, persists and resets the theme', async ($, on) => {
  const kept: Record<string, unknown> = {}
  on('store.get', ($, e) => ({ value: kept[e.key] }))
  on('store.set', ($, e) => {
    kept[e.key] = e.value
    return { value: undefined }
  })
  on('store.delete', ($, e) => {
    delete kept[e.key]
    return { value: undefined }
  })
  const clock = host(on, null)
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="core" />
  })
  await $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true })
  for (let i = 0; i < 30; i++) await clock.settle()
  expect(/proj git:\(main\*\)/.test(await bandText($))).toBe(true)
  const listed = await $.command.run({ ...COMMAND, args: 'theme' })
  expect(listed.text!.startsWith('HUD 主题（当前 classic）')).toBe(true)
  expect(listed.text!.includes('powerline*')).toBe(true)
  const unknown = await $.command.run({ ...COMMAND, args: 'theme nope' })
  expect(unknown.text!.startsWith('没有名为 nope 的主题')).toBe(true)
  const set = await $.command.run({ ...COMMAND, args: 'theme emoji' })
  expect(set.text!.startsWith('HUD 主题：emoji')).toBe(true)
  await clock.advance(1_000)
  for (let i = 0; i < 30; i++) await clock.settle()
  const emoji = await bandText($)
  expect(/🤖 Opus/.test(emoji) && /📂 proj 🌿 main/.test(emoji) && /⏳ Read/.test(emoji)).toBe(true)
  expect(kept.theme).toBe('emoji')
  await $.command.run({ ...COMMAND, args: 'theme next' })
  expect(kept.theme).toBe('sakura')
  await $.command.run({ ...COMMAND, args: 'theme reset' })
  expect('theme' in kept).toBe(false)
  await clock.advance(1_000)
  for (let i = 0; i < 30; i++) await clock.settle()
  expect(/proj git:\(main\*\)/.test(await bandText($))).toBe(true)
})

test('a theme kept in the store wins over the option', { options: { theme: 'neon' } }, async ($, on) => {
  const clock = host(on, { theme: 'mecha' })
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="core" />
  })
  await $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true })
  for (let i = 0; i < 30; i++) await clock.settle()
  const shown = await bandText($)
  expect(/◢UNIT·Opus 5\.5/.test(shown) || /◢ UNIT·Opus 5\.5/.test(shown)).toBe(true)
  expect(/ ┃ /.test(shown)).toBe(true)
})

test('powerline puts segments on backgrounds joined by caps, two cells wider', async () => {
  const theme = findTheme('powerline')!
  const [row] = applyTheme([[{ text: 'a', color: 'cyan' }, { text: ' │ ', dimColor: true }, { text: 'bc' }]], theme)
  expect(row!.map(s => s.text).join('')).toBe(' a \ue0b0 bc \ue0b0')
  expect(row![0]!.backgroundColor).toBe('#313244')
  expect(row![3]).toEqual({ text: '\ue0b0', color: '#313244', backgroundColor: '#45475a' })
  expect(row![row!.length - 1]).toEqual({ text: '\ue0b0', color: '#45475a' })
  // The rule between the HUD's parts stays bare.
  expect(applyTheme([[{ text: '────', dimColor: true }]], theme)).toEqual([[{ text: '────', dimColor: true }]])
})

test('gradient bars keep warning colors; moods follow the gauges', async () => {
  const theme = findTheme('rainbow')!
  const [calm] = applyTheme([[{ text: 'x' }, { text: '███', color: '#38ef7d' }, { text: '░', dimColor: true }]], theme)
  expect(calm!.slice(1, 4).map(s => s.color)).toEqual([gradientAt(theme.gradient!, 0), gradientAt(theme.gradient!, 1 / 3), gradientAt(theme.gradient!, 2 / 3)])
  const hot = [{ text: 'x' }, { text: '███', color: '#ff0844' }]
  expect(applyTheme([hot], theme)[0]!.slice(0, 2)).toEqual(hot)
  expect(gradientAt(['#000000', '#ffffff'], 0.5)).toBe('#808080')
  expect([moodOf(10, 0, false), moodOf(10, 0, true), moodOf(75, 0, false), moodOf(90, 0, true), moodOf(10, 100, false)])
    .toEqual(['calm', 'busy', 'worried', 'panic', 'out'])
  expect(new Set(THEMES.map(t => t.name)).size).toBe(THEMES.length)
  // No emoji that needs U+FE0F, which the renderer misjudges.
  expect(THEMES.some(t => JSON.stringify(t).includes('\ufe0f'))).toBe(false)
})

test('the palette fills claude-hud\'s default colors and leaves the person\'s own', async () => {
  const neon = findTheme('neon')!
  const themed = applyPalette(mergeConfig({}), neon)
  expect([themed.colors.model, themed.colors.custom, themed.colors.label, themed.colors.barFilled]).toEqual(['#00e5ff', '#ff9e00', '#5c6b8a', '▰'])
  const own = applyPalette(mergeConfig({ colors: { ...DEFAULT_CONFIG.colors, model: 'red', barFilled: '#' } }), neon)
  expect([own.colors.model, own.colors.barFilled, own.colors.project]).toEqual(['red', '#', '#ff2bd6'])
  expect(applyPalette(mergeConfig({}), findTheme('classic')!).colors).toEqual(mergeConfig({}).colors)
})

test('the mascot leaves a narrow extras row before the warning does', async () => {
  setLanguage('en')
  try {
    const row = extrasLine({
      summary: null, exhaust: [], todayUsd: null, budgetUsd: 0, week: null,
      git: { dirty: 30, ahead: 0 }, gitDirtyWarn: 20, gitAheadWarn: 0, columns: 26, mascot: '(◕‿◕)♡',
    })
    expect(row.map(s => s.text).join('')).toBe('⚠ 30 uncommitted changes')
  } finally {
    setLanguage('zh-Hans')
  }
})
