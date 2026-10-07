// What the last turn did, in a band above the prompt once it ends, and a toast
// when the main thread goes in circles. Read from the turn's own tool calls
// once they have run: no tool of its own, nothing in the prompt, no tokens.
import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, Register, RenderElement } from 'claude-code'

import type { Receipt } from '../types'
import { readConfig } from './config'
import { m, setLang } from './i18n'
import { isPickerOpen, stackAbove } from './kit/band'
import { resolveLanguage } from './kit/lang'
import { persist, switchArg } from './kit/prefs'
import type { Prefs } from './kit/prefs'
import { NO_WATCH, addCall, finish, formatDuration, isEmpty, newReceipt, totals, watchCall } from './ledger'
import type { Alert } from './ledger'

const receipt = atom({ plugin: 'receipt', key: 'receipt' } as const, null as Receipt | null)
const watch = atom({ plugin: 'receipt', key: 'watch' } as const, NO_WATCH)
// The band shows between turns, for a turn that used a tool.
const isShown = atom({ plugin: 'receipt', key: 'isShown' } as const, false)
// The session's mirror of the `visible` row, so `/receipt` shows at once.
const isHidden = atom({ plugin: 'receipt', key: 'isHidden' } as const, false)
// True while a picker is open above the band (see kit/band).
const isPicking = atom({ plugin: 'receipt', key: 'isPicking' } as const, false)

const SEP = ' · '

/** The kit's hold on this mod's store and `/config` rows. */
function prefsOf($: EngineInterface): Prefs {
  return {
    kept: key => $.store.get(key),
    forget: key => $.store.delete(key),
    write: (field, value) => $.config.set({ key: `receipt.${field}`, value }),
  }
}

function alertText(alert: Alert): string {
  return alert.kind === 'repeat' ? m('alert.repeat', { n: alert.n, label: alert.label }) : m('alert.flip', { n: alert.n, path: alert.path })
}

/** The receipt's headline: how the turn went and how long it took (so far, while it runs). */
function headline(r: Receipt, now: number): string {
  if (r.durationMs === null) return m('band.running', { d: formatDuration(now - r.startedAt) })
  const d = formatDuration(r.durationMs)
  return r.reason === 'aborted' ? m('band.aborted', { d }) : r.reason === 'answer' ? m('band.answer', { d }) : m('band.error', { d })
}

type Segment = { text: string; color?: string }

/** The counts after the headline, each only when it has something to say; a count may be several segments. */
function counts(r: Receipt, flagUnverified: boolean): Segment[][] {
  const parts: Segment[][] = []
  if (r.files.length > 0) {
    const { added, removed } = totals(r)
    parts.push([{ text: `${m('band.edited', { n: r.files.length })} ` }, { text: `+${added}`, color: 'green' }, { text: ' ' }, { text: `−${removed}`, color: 'red' }])
  }
  if (r.commands > 0) parts.push([{ text: m('band.commands', { n: r.commands }) }])
  if (r.failed.length > 0) parts.push([{ text: m('band.failed', { n: r.failed.length }), color: 'red' }])
  if (r.reads > 0) parts.push([{ text: m('band.reads', { n: r.reads }) }])
  if (r.agents > 0) parts.push([{ text: m('band.agents', { n: r.agents }) }])
  if (r.warnings.length > 0) parts.push([{ text: `⚠ ${r.warnings.length}`, color: 'yellow' }])
  if (flagUnverified && r.isUnverified) parts.push([{ text: m('band.unverified'), color: 'yellow' }])
  return parts
}

const plain = (part: Segment[]) => part.map(s => s.text).join('')

/** `/receipt` alone: the headline, then every file, failed command and warning. */
async function listing($: EngineInterface, flagUnverified: boolean): Promise<string> {
  const r = await read($, receipt)
  if (!r) return m('cmd.none')
  const lines = [[headline(r, await $.clock.now()), ...counts(r, flagUnverified).map(plain)].join(SEP)]
  if (r.files.length > 0) {
    lines.push('', m('list.files'))
    for (const f of r.files) lines.push(`  ${f.path}  +${f.added} −${f.removed}${f.isNew ? `  ${m('list.new')}` : ''}`)
  }
  if (r.failed.length > 0) lines.push('', m('list.failed'), ...r.failed.map(c => `  ✗ ${c}`))
  if (r.warnings.length > 0) lines.push('', m('list.warnings'), ...r.warnings.map(w => `  ⚠ ${w}`))
  if (flagUnverified && r.isUnverified) lines.push('', `⚠ ${m('list.unverified')}`)
  return lines.join('\n')
}

export const register: Register = (on, options) => {
  const config = readConfig(options)
  const rules = { repeatFailures: config.repeatFailures, flipFlops: config.flipFlops }

  on('session.start', async ($, e, next) => {
    const settings = (await $.settings.read().catch(() => ({}))) as { language?: unknown }
    const locale = await Promise.all([
      $.env.get('LC_ALL').catch(() => undefined),
      $.env.get('LC_MESSAGES').catch(() => undefined),
      $.env.get('LANG').catch(() => undefined),
    ])
    setLang(resolveLanguage(config.language, settings.language, locale))
    await $.command.register({ name: 'receipt', description: m('cmd.description'), argumentHint: '[off|on]' })
    await update($, isHidden, () => !config.isVisible)
    return next(e)
  })

  // Only the main loop raises turn.start: a new receipt, and the last one leaves the band.
  on('turn.start', async ($, e, next) => {
    const now = await $.clock.now()
    await update($, receipt, () => newReceipt(e.turnId, now))
    await update($, watch, () => NO_WATCH)
    await update($, isShown, () => false)
    return next(e)
  })

  // Every call of the turn once it has run, its subagents' included; a refused call did nothing.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined) return ran
    const was = await read($, receipt)
    if (!was || was.durationMs !== null) return ran
    const { tool, tool_use_id: _, agentId, ...input } = e as unknown as Record<string, unknown> & { tool: string }
    const call = { tool, input, result: ran.result, isError: ran.isError === true, isReadOnly: ran.isReadOnly === true }
    const cwd = await $.session.cwd().catch(() => '')
    let next_ = addCall(was, call, cwd, agentId === undefined)
    if (agentId === undefined) {
      const seen = watchCall(await read($, watch), call, rules, cwd)
      await update($, watch, () => seen.watch)
      if (seen.alert) {
        const text = alertText(seen.alert)
        next_ = { ...next_, warnings: [...next_.warnings, text] }
        $.ui.toast(`⚠ ${text}`, { timeoutMs: 8000 })
      }
    }
    await update($, receipt, () => next_)
    return ran
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    const was = await read($, receipt)
    if (was && was.durationMs === null) {
      const done = finish(was, e.durationMs, e.reason)
      await update($, receipt, () => done)
      await update($, isShown, () => !isEmpty(done))
    }
    return next(e)
  })

  on('command.run', { command: 'receipt' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg !== 'off' && arg !== 'on') return { text: await listing($, config.flagUnverified) }
    const was = await read($, isHidden)
    const hidden = await update($, isHidden, v => switchArg(arg, v))
    if (hidden !== was) await persist(prefsOf($), 'visible', !hidden)
    return { text: m(hidden ? 'cmd.hidden' : 'cmd.shown') }
  })

  // A picker (`/` commands, `@` files) opens above the band: the band steps aside meanwhile.
  on('prompt.edit', async ($, e, next) => {
    const box = await next(e)
    const isOpen = isPickerOpen(box.text, box.cursor)
    if ((await read($, isPicking)) !== isOpen) await update($, isPicking, () => isOpen)
    return box
  })
  on('prompt.submit', async ($, e, next) => {
    if (await read($, isPicking)) await update($, isPicking, () => false)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const r = await read($, receipt)
    if (e.props.hasSurvey || r === null || !(await read($, isShown)) || (await read($, isHidden)) || (await read($, isPicking))) return next(e)
    const ui = $.ui.resolve(e)
    return stackAbove(ui, drawReceipt(ui, r, config.flagUnverified), await next(e))
  })
}

/** One row: a mark for how the turn ended, the headline, then the counts. */
function drawReceipt(ui: Pick<Elements['terminal'], 'Box' | 'Text'>, r: Receipt, flagUnverified: boolean): RenderElement {
  const { Box, Text } = ui
  const mark = r.reason === 'answer' ? { glyph: '✓', color: 'green' } : r.reason === 'aborted' ? { glyph: '◼', color: 'yellow' } : { glyph: '✗', color: 'red' }
  return (
    <Box flexDirection="row" columnGap={1}>
      <Text color={mark.color} bold>{mark.glyph}</Text>
      <Box flexGrow={1} flexShrink={1}>
        <Text wrap="truncate-end">
          <Text dimColor>{headline(r, 0)}</Text>
          {counts(r, flagUnverified).map((p, i) => (
            <Text key={String(i)}>
              <Text dimColor>{SEP}</Text>
              {p.map((seg, j) => (
                <Text key={String(j)} color={seg.color}>{seg.text}</Text>
              ))}
            </Text>
          ))}
        </Text>
      </Box>
    </Box>
  )
}
