import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { MESSAGES, parseLanguage, resolveLanguage } from '../hooks/i18n'
import { parseNodeSpec, parseStatus, selectNodes } from '../hooks/parse'


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

test('nodes option picks, orders and renames', async () => {
  const names = (spec: string) => selectNodes(parseStatus(STATUS), parseNodeSpec(spec)).map(n => n.name)
  expect(names('')).toEqual(['dev-box', 'home-router', 'phone', 'vps-west'])
  expect(names('VPS-West=美西, dev-box, nope')).toEqual(['美西', 'dev-box'])
})

const SURFACES = ['terminal', 'desktop'] as const

// The /config rows the plugin wrote, as `[key, value]`.
let rows: [string, unknown][] = []

function host(
  on: On,
  run: (argv: readonly string[]) => { exitCode: number; stdout: string; stderr: string },
  stored: Record<string, unknown> = {},
) {
  rows = []
  const clock = mock.clock(on)
  mock.store(on, stored)
  mock.env(on, { LANG: 'zh_CN.UTF-8' })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('config.set', ($, e) => {
    rows.push([e.key, e.value])
    return { value: e.value }
  })
  on('process.run', ($, e) => ({ value: { ...run(e.argv), isStdoutTruncated: false, isStderrTruncated: false } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="core" />
  })
  return clock
}

const START = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as const

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } } as const

test('band shows nodes and online count on every surface', async ($, on) => {
  const clock = host(on, () => ({ exitCode: 0, stdout: STATUS, stderr: '' }))
  await $.session.start(START)
  await clock.settle()
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'ts-band', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: 'TS 3/4' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'DERP-sfo' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '中继' })).toBeDefined()
    // A direct node needs no look: only relayed and offline ones are listed.
    expect(await ui.find({ type: 'Text', text: 'dev-box ' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: 'phone ' })).toBeDefined()
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

test('nodes and hideOffline shape the band', { options: { nodes: 'phone=手机, dev-box', hideOffline: true } }, async ($, on) => {
  const clock = host(on, () => ({ exitCode: 0, stdout: STATUS, stderr: '' }))
  await $.session.start(START)
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'ts-band', surface: 'terminal', ...BAND })
  // The offline phone is hidden and dev-box is direct: one short mark.
  expect(await ui.find({ type: 'Text', text: '1/2' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '直连' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '手机 ' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'vps-west ' })).toBeUndefined()
  await ui.unmount()
})

test('/ts off and on write the visible row', { options: { visible: false } }, async ($, on) => {
  const clock = host(on, () => ({ exitCode: 0, stdout: STATUS, stderr: '' }))
  await $.session.start(START)
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'ts-band', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: 'TS 3/4' })).toBeUndefined()
  await ui.unmount()

  const shown = await $.command.run({ ...RUN, command: 'ts', args: 'on' })
  expect(shown.text).toBe('Tailscale 横条已显示')
  expect(rows).toEqual([['ts-band.visible', true]])
})

test('an older /ts off kept in the store moves to the visible row', async ($, on) => {
  const clock = host(on, () => ({ exitCode: 0, stdout: STATUS, stderr: '' }), { isHidden: true })
  await $.session.start(START)
  await clock.settle()
  expect(rows).toEqual([['ts-band.visible', false]])
  const ui = await $.ui.mount({ plugin: 'ts-band', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: 'TS 3/4' })).toBeUndefined()
  await ui.unmount()
  // Moved once: the store no longer holds it.
  await $.session.start(START)
  await clock.settle()
  expect(rows).toEqual([['ts-band.visible', false]])
})

test('language: option, then the setting, then the locale', async () => {
  expect(parseLanguage('简体中文')).toBe('zh-Hans')
  expect(parseLanguage('繁體中文')).toBe('zh-Hant')
  expect(parseLanguage('zh_TW.UTF-8')).toBe('zh-Hant')
  expect(parseLanguage('Japanese')).toBe('ja')
  expect(parseLanguage('es-MX')).toBe('es')
  expect(parseLanguage('pt_BR.UTF-8')).toBe('pt-BR')
  expect(parseLanguage('Deutsch')).toBe('de')
  expect(parseLanguage('C')).toBe(null)
  expect(resolveLanguage('fr', '简体中文', ['ja_JP.UTF-8'])).toBe('fr')
  expect(resolveLanguage('auto', '简体中文', ['ja_JP.UTF-8'])).toBe('zh-Hans')
  expect(resolveLanguage('auto', undefined, [undefined, undefined, 'ko_KR.UTF-8'])).toBe('ko')
  expect(resolveLanguage('auto', 'Klingon', ['C'])).toBe('en')
  for (const messages of Object.values(MESSAGES)) expect(Object.keys(messages)).toEqual(Object.keys(MESSAGES.en))
})

test('the band speaks the language option', { options: { language: 'de' } }, async ($, on) => {
  const clock = host(on, () => ({ exitCode: 0, stdout: STATUS, stderr: '' }))
  await $.session.start(START)
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'ts-band', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: 'offline' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'DERP-sfo' })).toBeDefined()
  await ui.unmount()
  const off = await $.command.run({ ...RUN, command: 'ts', args: 'off' })
  expect(off.text).toBe('Tailscale-Leiste ausgeblendet')
})
