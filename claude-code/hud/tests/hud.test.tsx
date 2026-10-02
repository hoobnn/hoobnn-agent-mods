import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { parseAnsi } from '../hooks/ansi'

const HOME = '/home/u'
const CWD = '/home/u/proj'
const CONFIG = JSON.stringify({
  language: 'zh-Hans',
  lineLayout: 'expanded',
  display: { showTools: true, showTodos: true, contextValue: 'tokens', modelFormat: 'short' },
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
      content: [{ type: 'tool_use', id: 't1', name: 'Read', input: { file_path: `${CWD}/a.ts` } }],
    },
  },
].map(l => JSON.stringify(l)).join('\n') + '\n'

const FILES: Record<string, string> = {
  [`${HOME}/.claude/plugins/claude-hud/config.json`]: CONFIG,
  [TRANSCRIPT]: LINES,
}
const DIRS = new Set([HOME, `${HOME}/.claude`, CWD])

function host(on: On) {
  const clock = mock.clock(on, { now: Date.parse('2026-10-02T06:01:00Z') })
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
  on('fs.list', () => ({ value: [] }))
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
      else if (argv.includes('status')) stdout = '## main\n M a.ts\n'
      else if (argv.includes('rev-parse')) stdout = 'main\n'
    } else exitCode = 1
    return { value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('session.id', () => ({ value: 'sess-1' }))
  on('session.cwd', () => ({ value: CWD }))
  on('session.root', () => ({ value: CWD }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', () => ({
    value: {
      startedAt: Date.parse('2026-10-02T06:00:00Z'),
      context: { tokens: 45_000, window: 200_000, percent: 23 },
      rateLimits: [{ kind: 'five_hour', percentUsed: 25, resetsAt: '2026-10-02T09:00:00Z' }],
      cost: { usd: 1.23 },
    },
  }))
  on('session.version', () => ({ value: { version: '2.1.287', base: '2.1.287', builtAt: '2026-10-01T00:00:00Z' } }))
  on('settings.read', () => ({ value: {} }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
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

test('band renders claude-hud lines from the session', async ($, on) => {
  const clock = host(on)
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="core" />
  })
  await $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true })
  for (let i = 0; i < 30; i++) await clock.settle()
  const ui = await $.ui.mount({ plugin: 'hud', surface: 'terminal', ...BAND })
  const shown = (await ui.findAll({ type: 'Text' })).map(t => t.text).join('')
  expect(/Opus 5\.5/.test(shown)).toBe(true)
  expect(/proj git:\(main\*\)/.test(shown)).toBe(true)
  expect(/45k\/200k/.test(shown)).toBe(true)
  expect(/25%/.test(shown)).toBe(true)
  expect(/◐ Read/.test(shown)).toBe(true)
  await ui.unmount()
})

