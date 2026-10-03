// The hitokoto band, for scripts/mod-shots.ts.
import type { On } from 'claude-code'
import { mock, test } from 'claude-code/testing'

const BODY = JSON.stringify({ hitokoto: '人生如逆旅，我亦是行人。', from: '临江仙·送钱穆父', from_who: '苏轼' })
const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 88, scroll: { offset: 0, bodyRows: 9 }, view: {} },
} as const

function host(on: On) {
  const clock = mock.clock(on, { now: 0 })
  mock.store(on, {})
  mock.env(on, { LANG: 'zh_CN.UTF-8' })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('http.fetch', () => ({ value: { status: 200, ok: true, headers: {}, text: BODY } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="core" />
  })
  return clock
}

test('shots', async ($, on) => {
  const clock = host(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'hitokoto', surface: 'terminal', ...BAND })
  console.log(`@@SHOT preview ${JSON.stringify(await ui.drawn())}`)
  await ui.unmount()
})
