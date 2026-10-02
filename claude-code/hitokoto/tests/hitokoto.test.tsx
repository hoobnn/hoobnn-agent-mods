import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { attribution, hitokotoUrl, parseQuote } from '../hooks/parse'

const BODY = JSON.stringify({ hitokoto: '人生如逆旅，我亦是行人。', from: '临江仙·送钱穆父', from_who: '苏轼' })

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 160, scroll: { offset: 0, bodyRows: 9 }, view: {} },
} as const

const START = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as const

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } } as const

test('url carries one c per valid category', async () => {
  expect(hitokotoUrl('')).toBe('https://v1.hitokoto.cn/?encode=json')
  expect(hitokotoUrl('d, I,x,k')).toBe('https://v1.hitokoto.cn/?encode=json&c=d&c=i&c=k')
})

test('parses quote and attribution', async () => {
  const q = parseQuote(BODY)!
  expect(q.text).toBe('人生如逆旅，我亦是行人。')
  expect(attribution(q)).toBe('—— 苏轼「临江仙·送钱穆父」')
  expect(attribution({ text: 'x', from: '', fromWho: '' })).toBe('')
  expect(parseQuote('{"hitokoto":""}')).toBe(null)
})

function host(on: On, reply: () => { status: number; text: string }) {
  const clock = mock.clock(on)
  const urls: string[] = []
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('http.fetch', ($, e) => {
    urls.push(e.url)
    const { status, text } = reply()
    return { value: { status, ok: status < 300, headers: {}, text } }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="core" />
  })
  return { clock, urls }
}

test('band shows the quote on every surface', { options: { categories: 'i' } }, async ($, on) => {
  const { clock, urls } = host(on, () => ({ status: 200, text: BODY }))
  await $.session.start(START)
  await clock.settle()
  expect(urls[0]).toBe('https://v1.hitokoto.cn/?encode=json&c=i')
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'hitokoto', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: '『人生如逆旅，我亦是行人。』' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '—— 苏轼「临江仙·送钱穆父」' })).toBeDefined()
    await ui.unmount()
  }
})

test('/hitokoto off hides, failed fetch reports', async ($, on) => {
  let status = 200
  const { clock } = host(on, () => ({ status, text: BODY }))
  await $.session.start(START)
  await clock.settle()

  const off = await $.command.run({ ...RUN, command: 'hitokoto', args: 'off' })
  expect(off.text).toBe('一言横条已隐藏')
  const ui = await $.ui.mount({ plugin: 'hitokoto', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: '『人生如逆旅，我亦是行人。』' })).toBeUndefined()
  await ui.unmount()

  status = 503
  const again = await $.command.run({ ...RUN, command: 'hitokoto', args: '' })
  expect(again.text).toBe('一言获取失败：HTTP 503')
})
