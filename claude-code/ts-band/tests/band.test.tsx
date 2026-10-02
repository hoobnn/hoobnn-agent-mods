import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { parseStatus } from '../hooks/parse'


const STATUS = JSON.stringify({
  Peer: {
    a: { HostName: 'dev-box', Online: true, CurAddr: '1.2.3.4:5', Relay: 'lax' },
    b: { HostName: 'vps-west', Online: true, CurAddr: '', Relay: 'sfo' },
    c: { HostName: 'phone', Online: false, CurAddr: '', Relay: 'sfo' },
    d: { HostName: 'home-router', Online: true, CurAddr: '', PeerRelay: '10.0.0.1:40000' },
  },
})

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 160, scroll: { offset: 0, bodyRows: 9 }, view: {} },
} as const

test('parses link kinds', async () => {
  const byName = Object.fromEntries(parseStatus(STATUS).map(n => [n.name, n]))
  expect(byName['dev-box']?.link).toBe('direct')
  expect(byName['vps-west']?.link).toBe('derp')
  expect(byName['vps-west']?.via).toBe('sfo')
  expect(byName['phone']?.link).toBe('offline')
  expect(byName['home-router']?.link).toBe('peer-relay')
})

const SURFACES = ['terminal', 'desktop'] as const

function host(on: On, run: (argv: readonly string[]) => { exitCode: number; stdout: string; stderr: string }) {
  const clock = mock.clock(on)
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('process.run', ($, e) => ({ value: { ...run(e.argv), isStdoutTruncated: false, isStderrTruncated: false } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="core" />
  })
  return clock
}

const START = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as const

test('band shows nodes and online count on every surface', async ($, on) => {
  const clock = host(on, () => ({ exitCode: 0, stdout: STATUS, stderr: '' }))
  await $.session.start(START)
  await clock.settle()
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'ts-band', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: 'TS 3/4' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'DERP-sfo' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '中继' })).toBeDefined()
    await ui.unmount()
  }
})

test('band shows read error', async ($, on) => {
  const clock = host(on, () => ({ exitCode: 1, stdout: '', stderr: 'not running' }))
  await $.session.start(START)
  await clock.settle()
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'ts-band', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: 'not running' })).toBeDefined()
    await ui.unmount()
  }
})

test('tailscalePath option names the CLI', { options: { tailscalePath: '/opt/ts/tailscale' } }, async ($, on) => {
  const seen: string[] = []
  const clock = host(on, argv => {
    seen.push(argv[0]!)
    return { exitCode: 0, stdout: STATUS, stderr: '' }
  })
  await $.session.start(START)
  await clock.settle()
  expect(seen[0]).toBe('/opt/ts/tailscale')
})
