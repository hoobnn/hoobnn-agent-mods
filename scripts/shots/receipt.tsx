// The receipt band after a turn, for scripts/mod-shots.ts.
import type { On } from 'claude-code'
import { mock, test } from 'claude-code/testing'

const CWD = '/repo'
const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 88, scroll: { offset: 0, bodyRows: 9 }, view: {} },
} as const
const failing = new Set(['bun test'])

function host(on: On) {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on, {})
  mock.env(on, { LANG: 'zh_CN.UTF-8' })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.cwd', () => ({ value: CWD }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('tool.call', ($, e) => {
    const input = e as unknown as Record<string, unknown>
    if (e.tool === 'Bash' && failing.has(String(input.command))) return { isError: true, result: 'exit 1', text: 'exit 1' } as never
    if (e.tool === 'Edit') {
      const lines = String(input.new_string).split('\n').map(l => `+${l}`).concat(String(input.old_string).split('\n').map(l => `-${l}`))
      return { result: { filePath: input.file_path, structuredPatch: [{ lines }], gitDiff: undefined }, text: 'ok' } as never
    }
    if (e.tool === 'Write') return { result: { type: 'create', filePath: input.file_path, content: input.content, structuredPatch: [] }, text: 'ok' } as never
    return { result: 'ok', text: 'ok' } as never
  })
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="core" />
  })
  return clock
}

const lines = (n: number) => Array.from({ length: n }, (_, i) => `l${i}`).join('\n')

test('shots', async ($, on) => {
  const clock = host(on)
  await $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true })
  await clock.settle()
  await $.turn.start({ text: 'go', turnId: 't1' })
  for (const f of ['src/theme.ts', 'src/hud.ts', 'README.md']) await $.tool.call({ tool: 'Read', file_path: `${CWD}/${f}` } as never)
  await $.tool.call({ tool: 'Edit', file_path: `${CWD}/src/hud.ts`, old_string: lines(7), new_string: lines(42) } as never)
  await $.tool.call({ tool: 'Write', file_path: `${CWD}/src/themes/neon.ts`, content: lines(86) } as never)
  await $.tool.call({ tool: 'Bash', command: 'bun test' } as never)
  await $.tool.call({ tool: 'Edit', file_path: `${CWD}/src/theme.ts`, old_string: lines(3), new_string: lines(5) } as never)
  await $.tool.call({ tool: 'Bash', command: 'bun test tests/theme.test.ts' } as never)
  await $.tool.call({ tool: 'Bash', command: 'git status' } as never)
  await $.tool.call({ tool: 'Agent', description: 'review', prompt: 'review' } as never)
  await $.tool.call({ tool: 'Edit', file_path: `${CWD}/README.md`, old_string: lines(1), new_string: lines(4), agentId: 'a1' } as never)
  await $.turn.complete({ answer: 'ok', durationMs: 133_000, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  const ui = await $.ui.mount({ plugin: 'receipt', surface: 'terminal', ...BAND })
  console.log(`@@SHOT preview ${JSON.stringify(await ui.drawn())}`)
  await ui.unmount()
})
