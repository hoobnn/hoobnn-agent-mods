import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { attribution, hitokotoUrl, localDate, parseQuote } from '../hooks/parse'

const BODY = JSON.stringify({ hitokoto: '人生如逆旅，我亦是行人。', from: '临江仙·送钱穆父', from_who: '苏轼' })

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 160, scroll: { offset: 0, bodyRows: 9 }, view: {} },
} as const

const START = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as const

const PROMPT = { origin: { kind: 'composer' }, wait: false } as const

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

// The /config rows the plugin wrote, as `[key, value]`.
let rows: [string, unknown][] = []

function host(on: On, reply: () => { status: number; text: string }, stored: Record<string, unknown> = {}, now = 0) {
  const clock = mock.clock(on, { now })
  mock.store(on, stored)
  mock.env(on, { LANG: 'zh_CN.UTF-8' })
  const urls: string[] = []
  rows = []
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('config.set', ($, e) => {
    rows.push([e.key, e.value])
    return { value: e.value }
  })
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

test('an older /hitokoto off moves to the visible row; /hitokoto on writes it back', async ($, on) => {
  const { clock } = host(on, () => ({ status: 200, text: BODY }), { isHidden: true })
  await $.session.start(START)
  await clock.settle()
  expect(rows).toEqual([['hitokoto.visible', false]])
  const ui = await $.ui.mount({ plugin: 'hitokoto', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: '『人生如逆旅，我亦是行人。』' })).toBeUndefined()
  await ui.unmount()

  await $.command.run({ ...RUN, command: 'hitokoto', args: 'on' })
  await $.command.run({ ...RUN, command: 'hitokoto', args: 'on' })
  expect(rows).toEqual([['hitokoto.visible', false], ['hitokoto.visible', true]])
})

const OTHER = JSON.stringify({ hitokoto: '另一句。', from: '', from_who: '' })

test('daily mode reuses today\'s line and fetches once the day turns', { options: { refreshMode: 'daily' } }, async ($, on) => {
  const now = new Date(2026, 9, 2, 12).getTime()
  const kept = { date: localDate(now), quote: { text: '今日一句。', from: '', fromWho: '' } }
  const { clock, urls } = host(on, () => ({ status: 200, text: OTHER }), { daily: kept }, now)
  await $.session.start(START)
  await clock.settle()
  expect(urls.length).toBe(0)
  const ui = await $.ui.mount({ plugin: 'hitokoto', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: '『今日一句。』' })).toBeDefined()

  await clock.advance(24 * 3600_000)
  expect(urls.length).toBe(1)
  expect(await ui.find({ type: 'Text', text: '『另一句。』' })).toBeDefined()
  await ui.unmount()
})

test('prompt mode fetches on each prompt, not on a timer', { options: { refreshMode: 'prompt' } }, async ($, on) => {
  const { clock, urls } = host(on, () => ({ status: 200, text: BODY }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  await $.session.start(START)
  await clock.settle()
  expect(urls.length).toBe(1)
  await clock.advance(3 * 3600_000)
  expect(urls.length).toBe(1)
  await $.prompt.submit({ ...PROMPT, text: 'hi' })
  await clock.settle()
  expect(urls.length).toBe(2)
})

test('session mode fetches once per session', { options: { refreshMode: 'session' } }, async ($, on) => {
  const { clock, urls } = host(on, () => ({ status: 200, text: BODY }))
  await $.session.start(START)
  await clock.advance(3 * 3600_000)
  expect(urls.length).toBe(1)
})

test('replies follow Claude Code\'s language setting', async ($, on) => {
  const { clock } = host(on, () => ({ status: 503, text: '' }))
  on('settings.read', () => ({ value: { language: '日本語' } }))
  await $.session.start(START)
  await clock.settle()
  const off = await $.command.run({ ...RUN, command: 'hitokoto', args: 'off' })
  expect(off.text).toBe('Hitokoto バーを非表示にしました')
  const again = await $.command.run({ ...RUN, command: 'hitokoto', args: '' })
  expect(again.text).toBe('Hitokoto を取得できませんでした: HTTP 503')
})

test('a click on ↻ brings a new line', async ($, on) => {
  const { clock, urls } = host(on, () => ({ status: 200, text: BODY }))
  await $.session.start(START)
  await clock.settle()
  const ui = await $.ui.mount({ plugin: 'hitokoto', surface: 'terminal', ...BAND })
  const before = urls.length
  await ui.press({ key: 'hitokoto-next' })
  await clock.settle()
  expect(urls.length).toBe(before + 1)
  await ui.unmount()
})
