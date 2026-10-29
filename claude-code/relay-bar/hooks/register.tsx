// What the agents agent-relay dispatched are doing: under the Bash call that
// dispatched them, or above the prompt when that call's row is not in view (a
// background call, a subagent's), and in a pane. A Bash call running
// `relay.py run` (or `check`) starts a watch on agent-relay's runs folder: once
// a second the runs made since are read from their own status.json, until none
// works and the call has ended. No tool of its own, nothing in the prompt, no tokens.
import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, Register, RenderElement, Timer } from 'claude-code'

import type { Run } from '../types'
import { readConfig } from './config'
import type { Config } from './config'
import { m, resolveLanguage, setLang } from './i18n'
import { isPickerOpen, stackAbove } from './kit/band'
import { persist, switchArg } from './kit/prefs'
import type { Prefs } from './kit/prefs'
import { dirTime, doing, formatDuration, fromStatus, isLive, merge, paneLines, runsDir } from './runs'

// This session's runs, oldest first (runs.ts keeps the newest few).
const runs = atom({ plugin: 'relay-bar', key: 'runs' } as const, [] as Run[])
// Set this session by `/relay off|on`; null otherwise, when the `visible` row decides.
const hiddenSet = atom({ plugin: 'relay-bar', key: 'isHidden' } as const, null as boolean | null)
// True while a picker is open above the band (see kit/band).
const isPicking = atom({ plugin: 'relay-bar', key: 'isPicking' } as const, false)
// The clock as the last poll read it, so the running times keep up.
const tick = atom({ plugin: 'relay-bar', key: 'tick' } as const, 0)
// The run the pane shows; null for the newest.
const picked = atom({ plugin: 'relay-bar', key: 'picked' } as const, null as string | null)

const PANE = 'relay-bar'
/** A Bash command that starts relay runs. */
const RELAY_CALL = /relay\.py['"]?\s+(run|check)\b/
const POLL_MS = 1000
/** How long the watch stays after a relay call, for a run started in the background to show up. */
const GRACE_MS = 30_000
/** Run folders made this long before the call that started the watch still count (the two clocks, a slow start). */
const SLACK_MS = 5000
/** A run whose status has not moved for this long, with no relay call running, has lost its process. */
const STALE_MS = 90_000
/** How long an ended run stays on the band. */
export const FINISH_MS = 10_000
/** Band rows for runs; the rest are counted on one more. */
const ROWS = 4
/** Rows the pane takes besides the steps: the runs, the run's facts, its prompt, the gaps and the button. */
const PANE_CHROME = 7

/** The kit's hold on this mod's store and `/config` rows. */
function prefsOf($: EngineInterface): Prefs {
  return {
    kept: key => $.store.get(key),
    forget: key => $.store.delete(key),
    write: (field, value) => $.config.set({ key: `relay-bar.${field}`, value }),
  }
}

// The watch: relay calls still running, until when it stays, the earliest run folder it reads, its timer.
const w = { inFlight: 0, until: 0, from: 0, timer: null as Timer | null, isPolling: false, dir: undefined as string | null | undefined }
// The relay calls seen, newest last: a new run folder goes to the newest call made before it.
type Call = { id: string; at: number; inRow: boolean }
const calls: Call[] = []
const KEEP_CALLS = 20

/** The call a run folder made at `made` came from: the newest made before it (give or take SLACK_MS). */
function callOf(made: number): Call | null {
  for (let i = calls.length - 1; i >= 0; i--) if (calls[i]!.at - SLACK_MS <= made) return calls[i]!
  return null
}
let config: Config = readConfig({})

async function isHidden($: EngineInterface): Promise<boolean> {
  return (await read($, hiddenSet)) ?? !config.isVisible
}

async function runsPath($: EngineInterface): Promise<string | null> {
  if (w.dir === undefined) {
    const [xdg, home] = await Promise.all([$.env.get('XDG_STATE_HOME').catch(() => undefined), $.env.get('HOME').catch(() => undefined)])
    w.dir = runsDir(xdg, home)
  }
  return w.dir
}

function watch($: EngineInterface, from: number): void {
  w.from = w.timer === null ? from : Math.min(w.from, from)
  w.timer ??= $.clock.every(POLL_MS, () => void poll($))
}

/** Reads the runs made since the watch began, marks the stale ones lost, toasts the ones that ended, and ends the watch once nothing works. */
async function poll($: EngineInterface): Promise<void> {
  if (w.isPolling) return
  w.isPolling = true
  try {
    const now = await $.clock.now()
    const was = await read($, runs)
    const known = new Map(was.map(r => [r.id, r]))
    const path = await runsPath($)
    // Asked each poll: a failed ask retries next time, and a new session ID (/clear) is followed.
    const session = await $.session.id().catch(() => null)
    const fresh: Run[] = []
    if (path) {
      const entries = await $.fs.list(path).catch(() => [])
      for (const entry of entries) {
        const made = dirTime(entry.name)
        const had = known.get(entry.name)
        if (made === null || made < w.from - SLACK_MS || (had && !isLive(had))) continue
        const text = await $.fs.read(`${path}/${entry.name}/status.json`).catch(() => null)
        const parsed = typeof text === 'string' ? fromStatus(entry.name, text) : null
        if (!parsed || (had && parsed.updatedAt === had.updatedAt && parsed.state === had.state)) continue
        // Another session's run: its relay.py says who started it. Runs that say nothing are kept.
        if (parsed.caller !== null && session && parsed.caller !== session) continue
        const call = had ? null : callOf(made)
        fresh.push(had ? { ...parsed, callId: had.callId, inRow: had.inRow } : { ...parsed, callId: call?.id ?? null, inRow: call?.inRow ?? false })
      }
    }
    // A run that stopped writing while no relay call runs has lost its process (killed, the machine slept).
    for (const r of was) {
      if (isLive(r) && w.inFlight === 0 && now - r.updatedAt > STALE_MS && !fresh.some(f => f.id === r.id)) {
        fresh.push({ ...r, state: 'lost', endedAt: r.updatedAt })
      }
    }
    if (fresh.length > 0) {
      await update($, runs, list => merge(list, fresh))
      if (config.hasToast) {
        for (const r of fresh) {
          const before = known.get(r.id)
          if (isLive(r) || (before && !isLive(before))) continue
          if (r.state === 'done') void $.ui.toast(r.filesChanged > 0 ? m('toast.done', { cli: r.cli, n: r.filesChanged }) : `${r.cli} ${m('band.done')}`)
          else if (r.state === 'asked') void $.ui.toast(m('toast.asked', { cli: r.cli }))
          else void $.ui.toast(m('toast.failed', { cli: r.cli }))
        }
      }
    }
    const live = (await read($, runs)).some(isLive)
    await update($, tick, () => now)
    if (!live && w.inFlight === 0 && now >= w.until) {
      w.timer?.cancel()
      w.timer = null
      // One more tick once the last row has had its time, so the band folds.
      $.clock.after(FINISH_MS + POLL_MS, () => void update($, tick, () => now + FINISH_MS + POLL_MS))
    }
  } finally {
    w.isPolling = false
  }
}

async function openPane($: EngineInterface, id: string | null): Promise<void> {
  await update($, picked, () => id)
  await $.ui.open({ id: PANE, title: m('pane.title') })
}

export const register: Register = (on, options) => {
  config = readConfig(options)

  on('session.start', async ($, e, next) => {
    const settings = (await $.settings.read().catch(() => ({}))) as { language?: unknown }
    const locale = await Promise.all([
      $.env.get('LC_ALL').catch(() => undefined),
      $.env.get('LC_MESSAGES').catch(() => undefined),
      $.env.get('LANG').catch(() => undefined),
    ])
    setLang(resolveLanguage(config.language, settings.language, locale))
    await $.command.register({ name: 'relay', description: m('cmd.description'), argumentHint: '[off|on]' })
    // A reload in the middle of a run picks the watch up again.
    const live = (await read($, runs)).filter(isLive)
    if (live.length > 0) watch($, Math.min(...live.map(r => r.startedAt)))
    return next(e)
  })

  // A relay call, in the main thread or a subagent's: watch from now until it ends, and a while after.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (!RELAY_CALL.test(e.command)) return next(e)
    const at = await $.clock.now()
    // A foreground call of the main thread has its row in the transcript; the runs are drawn under it.
    calls.push({ id: e.tool_use_id, at, inRow: e.agentId === undefined && e.run_in_background !== true })
    calls.splice(0, Math.max(0, calls.length - KEEP_CALLS))
    w.inFlight++
    w.until = Math.max(w.until, at + GRACE_MS)
    watch($, at)
    try {
      return await next(e)
    } finally {
      w.inFlight--
      w.until = Math.max(w.until, (await $.clock.now()) + GRACE_MS)
      await poll($)
    }
  }).catch(($, e, next) => next(e)) // a failure here never holds the call: it runs, or keeps what it ran to

  on('command.run', { command: 'relay' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'off' || arg === 'on') {
      const was = await isHidden($)
      const hidden = await update($, hiddenSet, () => switchArg(arg, was))
      if (hidden !== was) await persist(prefsOf($), 'visible', !hidden)
      return { text: m(hidden ? 'cmd.hidden' : 'cmd.shown') }
    }
    if ((await read($, runs)).length === 0) return { text: m('cmd.none') }
    await openPane($, null)
    return { text: '' }
  })

  // A picker (`/` commands, `@` files) opens above the band: the band steps aside meanwhile.
  on('prompt.edit', async ($, e, next) => {
    const box = await next(e)
    const isOpen = isPickerOpen(box.text, box.cursor)
    if ((await read($, isPicking)) !== isOpen) await update($, isPicking, () => isOpen)
    return box
  })
  on('prompt.change', async ($, e, next) => {
    const isOpen = isPickerOpen(e.text, e.cursor)
    if ((await read($, isPicking)) !== isOpen) await update($, isPicking, () => isOpen)
    return next(e)
  })
  on('prompt.submit', async ($, e, next) => {
    if (await read($, isPicking)) await update($, isPicking, () => false)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await isHidden($)) || (await read($, isPicking))) return next(e)
    const at = Math.max(await read($, tick), await $.clock.now())
    const shown = (await read($, runs)).filter(r => !r.inRow && (isLive(r) || (r.endedAt !== null && at - r.endedAt < FINISH_MS)))
    if (shown.length === 0) return next(e)
    const ui = $.ui.resolve(e)
    return stackAbove(ui, drawBand(ui, shown, at, id => void openPane($, id)), await next(e), e.surface)
  })

  // Under the Bash call that dispatched them: a row a run, live while it works, its end kept after.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (e.props.tool !== 'Bash') return next(e)
    const id = e.props.tool_use_id
    const mine = (await read($, runs)).filter(r => r.callId === id)
    if (mine.length === 0) return next(e)
    const ui = $.ui.resolve(e)
    const { Box } = ui
    const at = Math.max(await read($, tick), await $.clock.now())
    return (
      <Box flexDirection="column">
        {await next(e)}
        <Box flexDirection="column" paddingLeft={5}>
          {drawRows(ui, mine, at, rid => void openPane($, rid))}
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const list = await read($, runs)
    const id = await read($, picked)
    const run = list.find(r => r.id === id) ?? list[list.length - 1]
    const at = Math.max(await read($, tick), await $.clock.now())
    const rows = Math.max(4, e.props.scroll.bodyRows - PANE_CHROME)
    const act = { pick: (to: string) => void update($, picked, () => to), close: () => void $.ui.close({ id: PANE }) }
    return drawPane($.ui.resolve(e), list, run, at, rows, act)
  })
}

type Ui = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'>

const MARK: Record<Run['state'], { glyph: string; color: string }> = {
  starting: { glyph: '●', color: 'ide' },
  running: { glyph: '●', color: 'ide' },
  done: { glyph: '✓', color: 'success' },
  asked: { glyph: '?', color: 'warning' },
  failed: { glyph: '✗', color: 'error' },
  lost: { glyph: '✗', color: 'error' },
}

const took = (r: Run, at: number) => formatDuration((r.endedAt ?? at) - r.startedAt)
const modelOf = (r: Run) => [r.model, r.effort].filter(Boolean).join('·')

/** What a run's row says after its name: the step it is on, or how it ended. */
function status(r: Run): { text: string; color?: string } {
  if (r.state === 'done') return { text: r.filesChanged > 0 ? `${m('band.done')} · ${m('band.files', { n: r.filesChanged })}` : m('band.done'), color: 'success' }
  if (r.state === 'asked') return { text: m('band.asked'), color: 'warning' }
  if (r.state === 'lost') return { text: m('band.lost'), color: 'error' }
  if (r.state === 'failed') return { text: `${m('band.failed')}: ${(r.error ?? '').split('\n')[0]}`, color: 'error' }
  const now = doing(r)
  return now ? { text: `${now.mark} ${now.text}` } : { text: m('band.starting') }
}

/** The band: the runs' rows, the newest few, the rest counted on one more. */
function drawBand(ui: Ui, shown: Run[], at: number, open: (id: string) => void): RenderElement {
  const { Box, Text } = ui
  const rows = shown.length > ROWS ? shown.slice(-(ROWS - 1)) : shown
  return (
    <Box flexDirection="column">
      {drawRows(ui, rows, at, open)}
      {shown.length > ROWS ? <Text dimColor>{m('band.more', { n: shown.length - rows.length })}</Text> : null}
    </Box>
  )
}

/** A row a run: its mark, its agent (a press opens the pane on it), model, time, what it is on, its tools. */
function drawRows(ui: Ui, rows: Run[], at: number, open: (id: string) => void): RenderElement[] {
  const { Box, Text, Button } = ui
  return rows.map(r => {
    const mark = MARK[r.state]
    const s = status(r)
    const model = modelOf(r)
    return (
      <Box key={r.id} flexDirection="row" columnGap={1}>
        <Text color={mark.color} bold>{mark.glyph}</Text>
        <Box flexShrink={0}>
          <Button key={`open-${r.id}`} plain onPress={() => open(r.id)}>
            <Text color="merged" bold>{r.cli}</Text>
          </Button>
        </Box>
        {model ? (
          <Box flexShrink={0}>
            <Text dimColor>{model}</Text>
          </Box>
        ) : null}
        <Box flexShrink={0}>
          <Text dimColor>{took(r, at)}</Text>
        </Box>
        <Box flexGrow={1} flexShrink={1}>
          <Text color={s.color} dimColor={!s.color} wrap="truncate-end">{s.text}</Text>
        </Box>
        {isLive(r) && r.tools.total > 0 ? (
          <Box flexShrink={0}>
            <Text dimColor>{m('band.tools', { done: r.tools.done, total: r.tools.total })}</Text>
          </Box>
        ) : null}
      </Box>
    )
  })
}

const TONE: Record<string, { color?: string; dim: boolean }> = {
  tool: { color: 'ide', dim: false },
  thought: { dim: true },
  message: { dim: false },
  failed: { color: 'error', dim: false },
}

/** The pane: a button a run, the picked run's facts and prompt, then its latest steps. */
function drawPane(
  ui: Ui,
  list: Run[],
  run: Run | undefined,
  at: number,
  rows: number,
  act: { pick: (id: string) => void; close: () => void },
): RenderElement {
  const { Box, Text, Button } = ui
  if (!run) return <Text dimColor>{m('cmd.none')}</Text>
  const lines = paneLines(run)
  const shown = lines.slice(-rows)
  const mark = MARK[run.state]
  const s = status(run)
  const facts = [modelOf(run), took(run, at), run.tools.total > 0 ? m('band.tools', { done: run.tools.done, total: run.tools.total }) : ''].filter(Boolean)
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" columnGap={1} flexWrap="wrap">
        {list.map(r => (
          <Button key={`pick-${r.id}`} plain onPress={() => act.pick(r.id)}>
            <Text inverse={r.id === run.id} color={MARK[r.state].color}>{` ${MARK[r.state].glyph} ${r.cli} `}</Text>
          </Button>
        ))}
      </Box>
      <Box flexDirection="row" columnGap={1} marginTop={1}>
        <Text color={mark.color} bold>{`${mark.glyph} ${run.cli}`}</Text>
        <Text dimColor>{facts.join(' · ')}</Text>
        <Box flexGrow={1} flexShrink={1}>
          <Text color={s.color} dimColor={!s.color} wrap="truncate-end">{s.text}</Text>
        </Box>
      </Box>
      <Text dimColor wrap="truncate-end">{`» ${run.prompt}`}</Text>
      <Box flexDirection="column" marginTop={1}>
        {shown.length === 0 ? <Text dimColor>{m('pane.empty')}</Text> : null}
        {shown.map((line, i) => (
          <Text key={String(i)} color={TONE[line.tone]?.color} dimColor={TONE[line.tone]?.dim} wrap="truncate-end">
            {line.text || ' '}
          </Text>
        ))}
      </Box>
      <Box flexDirection="row" marginTop={1}>
        <Button key="close" label={m('pane.close')} role="dismiss" onPress={act.close} />
      </Box>
    </Box>
  )
}
