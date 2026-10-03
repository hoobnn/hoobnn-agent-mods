// The ts-band band with relayed and offline nodes, for scripts/mod-shots.ts.
import type { On } from 'claude-code'
import { mock, test } from 'claude-code/testing'

const STATUS = JSON.stringify({
  Peer: {
    a: { HostName: 'dev-box', Online: true, CurAddr: '1.2.3.4:5', Relay: 'lax' },
    b: { HostName: 'vps-west', Online: true, CurAddr: '', Relay: 'sfo' },
    c: { HostName: 'phone', Online: false, CurAddr: '', Relay: 'sfo' },
    d: { HostName: 'home-router', Online: true, CurAddr: '', PeerRelay: '10.0.0.1:40000' },
    e: { HostName: 'nas', Online: true, CurAddr: '192.168.1.8:41641', Relay: 'hkg' },
  },
})
const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 88, scroll: { offset: 0, bodyRows: 9 }, view: {} },
} as const

function host(on: On, stdout: string) {
  const clock = mock.clock(on)
  mock.store(on, {})
  mock.env(on, { LANG: 'zh_CN.UTF-8' })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('process.run', () => ({ value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="core" />
  })
  return clock
}

test('shots', async ($, on) => {
  const clock = host(on, STATUS)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'ts-band', surface: 'terminal', ...BAND })
  console.log(`@@SHOT preview ${JSON.stringify(await ui.drawn())}`)
  await ui.unmount()
})
