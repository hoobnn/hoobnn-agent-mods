// claude-hud as a mod. claude-hud's own source (hooks/hud, MIT, see
// LICENSE.claude-hud) renders the lines; this module wires the engine's
// events to it and draws its output above or below the prompt. The work sits
// beside it: stdin.ts builds the statusline's stdin, render.ts runs a pass,
// remote.ts follows Remote Control, draw.tsx draws. Whatever calls `$` stays
// in this file (the engine follows `$` only within the hooks module's own
// file); the other modules get closures over it (`Io`, `SessionApi`).
import './shims/globals.js'

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { DockPet, Fired, HudLine, Remote, StepInfo, ToolStats, TurnCost } from '../types'
import { readConfig } from './config.js'
import { drawPane, drawRows } from './draw.js'
import { addSample, appendExtras, chimeWav, crossThresholds, exhaustAt, extrasLine, formatDuration, lastDays, localDay, paceAt, pruneHistory, streak } from './extras.js'
import type { Samples } from './extras.js'
import { loadConfig, setConfigPatch } from './hud/config.js'
import { setLanguage } from './hud/i18n/index.js'
import { setTranscriptProvider } from './hud/transcript.js'
import type { StdinData } from './hud/types.js'
import { FIVE_HOUR_WINDOW_MS, SEVEN_DAY_WINDOW_MS } from './hud/usage-pace.js'
import { m, summaryPrompt } from './i18n.js'
import { isPickerOpen } from './kit/band.js'
import { cellWidth, dockFits, drawPet } from './kit/pet.js'
import { keptRows, migrateStore, persist, switchArg } from './kit/prefs.js'
import type { Prefs } from './kit/prefs.js'
import { fitColumns, live, useTheme } from './live.js'
import { BRIDGE, remoteControl } from './remote.js'
import { gitCounts, renderHud } from './render.js'
import { factsSummary, type Io, runWithFacts, setIo } from './shims/host.js'
import { loadHostFacts, type SessionApi } from './stdin.js'
import { cleanSummary } from './summary.js'
import { applyPalette, applyTheme, findTheme, moodOf, THEMES } from './themes.js'
import type { Theme } from './themes.js'
import { transcriptData } from './transcript-feed.js'

const lines = atom({ plugin: 'hud', key: 'lines' } as const, [] as HudLine[])
// The session's mirror of the `visible` row, so `/hud` shows at once.
const isHidden = atom({ plugin: 'hud', key: 'isHidden' } as const, false)
// Session state, so a reload keeps what earlier requests reported.
const steps = atom({ plugin: 'hud', key: 'step' } as const, {
  model: null,
  effort: null,
  apiDurationMs: 0,
  currentUsage: null,
  lastRequestAt: null,
} as StepInfo)
// Remote clients attached to the session (a phone, the web), with their surface.
const remotes = atom({ plugin: 'hud', key: 'remotes' } as const, [] as Remote[])
const summary = atom({ plugin: 'hud', key: 'summary' } as const, null as string | null)
const turns = atom({ plugin: 'hud', key: 'turns' } as const, 0)
const fired = atom({ plugin: 'hud', key: 'fired' } as const, { context: [], fiveHour: [], sevenDay: [] } as Fired)
const history = atom({ plugin: 'hud', key: 'history' } as const, {} as Record<string, number>)
const tools = atom({ plugin: 'hud', key: 'tools' } as const, {} as ToolStats)
const turnLog = atom({ plugin: 'hud', key: 'turnLog' } as const, [] as TurnCost[])
const turnStart = atom({ plugin: 'hud', key: 'turnStart' } as const, null as { usd: number | null; tokens: number | null } | null)
/** Turns `/hud detail` lists. */
const TURN_LOG_SIZE = 8
// spinner's pet, and whether it stands beside the HUD's rows (below the prompt only).
const petDock = atom({ plugin: 'spinner', key: 'dock' } as const, null as DockPet | null)
const isPetDocked = atom({ plugin: 'hud', key: 'dock' } as const, false)
const petPats = atom({ plugin: 'hud', key: 'petPats' } as const, 0)
// True while a picker is open above the band (see kit/band.tsx).
const isPicking = atom({ plugin: 'hud', key: 'isPicking' } as const, false)

const PANE = 'hud-detail'
// Days of spend the store keeps; the HUD draws the last 7.
const HISTORY_DAYS = 60

setTranscriptProvider(async path => transcriptData(path))

// Events (tool calls, model requests, turn ends) drive the live updates; the
// tick only keeps minute-grained clocks (duration, resets, cache) current.
const TICK_MS = 15_000
const DEBOUNCE_MS = 250
const RC_POLL_MS = 3_000

/** The kit's hold on this mod's store and `/config` rows. */
function prefsOf($: EngineInterface): Prefs {
  return {
    kept: key => $.store.get(key),
    forget: key => $.store.delete(key),
    write: (field, value) => $.config.set({ key: `hud.${field}`, value }),
  }
}

/** Marks the message-only client present when `origin` came over the bridge; true if that is news. */
async function sawBridge($: EngineInterface, origin: { kind: string }): Promise<boolean> {
  if (origin.kind !== 'bridge') return false
  if ((await read($, remotes)).some(r => r.surface === BRIDGE)) return false
  await update($, remotes, rs => [...rs.filter(r => r.surface !== BRIDGE), { id: BRIDGE, surface: BRIDGE }])
  return true
}

type Gauges = { context?: number; fiveHour?: number; sevenDay?: number }

/** Toasts once per threshold a gauge crosses; re-armed once it drops back. */
async function alert($: EngineInterface, gauges: Gauges, contextAlerts: number[], usageAlerts: number[]): Promise<void> {
  const was = await read($, fired)
  const context = crossThresholds(gauges.context, contextAlerts, was.context)
  const fiveHour = crossThresholds(gauges.fiveHour, usageAlerts, was.fiveHour)
  const sevenDay = crossThresholds(gauges.sevenDay, usageAlerts, was.sevenDay)
  if (context.alert !== null) $.ui.toast(m('alert.context', { p: context.alert }))
  if (fiveHour.alert !== null) $.ui.toast(m('alert.fiveHour', { p: fiveHour.alert }))
  if (sevenDay.alert !== null) $.ui.toast(m('alert.sevenDay', { p: sevenDay.alert }))
  const now = { ...was, context: context.fired, fiveHour: fiveHour.fired, sevenDay: sevenDay.fired }
  if (JSON.stringify(now) !== JSON.stringify(was)) await update($, fired, () => now)
}

/** The same for the model-scoped weekly windows (Fable's), which `session.measure` does not carry. */
async function alertScoped($: EngineInterface, windows: readonly { name: string; percent: number }[], usageAlerts: number[]): Promise<void> {
  if (usageAlerts.length === 0 || windows.length === 0) return
  const was = await read($, fired)
  const scoped = { ...was.scoped }
  for (const { name, percent } of windows) {
    const crossed = crossThresholds(percent, usageAlerts, scoped[name] ?? [])
    if (crossed.alert !== null) $.ui.toast(m('alert.scoped', { name, p: crossed.alert }))
    scoped[name] = crossed.fired
  }
  if (JSON.stringify(scoped) !== JSON.stringify(was.scoped ?? {})) await update($, fired, f => ({ ...f, scoped }))
}

/** The gauges a usage reading carries (`$.session.usage()`, or a pushed `session.measure`). */
function gaugesOf(usage: { context: { percent?: number }; rateLimits: readonly { kind: string; percentUsed: number }[] }): Gauges {
  const percent = (kind: string) => usage.rateLimits.find(r => r.kind === kind)?.percentUsed
  return { context: usage.context.percent, fiveHour: percent('five_hour'), sevenDay: percent('seven_day') }
}

/** The context the next message re-caches, once a cache this session used has expired and holds at least `min` tokens. */
function coldCacheOf(stdin: StdinData, min: number): number | null {
  const cache = stdin.prompt_cache
  const tokens = stdin.context_window?.total_input_tokens ?? 0
  return min > 0 && cache?.caching_observed && !cache.warm && tokens >= min ? tokens : null
}

/** Draws `picked` (the redraw scheduled) and writes the theme row. */
async function setTheme($: EngineInterface, picked: Theme, schedule: () => void): Promise<{ text: string }> {
  useTheme(picked)
  schedule()
  await persist(prefsOf($), 'theme', picked.name)
  return { text: m('theme.set', { name: `${picked.name} ${picked.sample}` }) }
}

/** `/hud [off|on]`: the HUD hidden or shown (no verb toggles), its row written when it changed. */
async function setHidden($: EngineInterface, verb: string, schedule: () => void): Promise<boolean> {
  const was = await read($, isHidden)
  const hidden = await update($, isHidden, v => switchArg(verb, v))
  if (hidden !== was) await persist(prefsOf($), 'visible', !hidden)
  schedule()
  return hidden
}

// Before 0.8 a theme picked with `/hud theme` was kept in the store; it is the `theme` row now.
const STORE_MOVES = { theme: (kept: unknown) => (findTheme(kept) ? (['theme', findTheme(kept)!.name] as const) : null) }

export const register: Register = (on, options) => {
  const config = readConfig(options)
  useTheme(config.theme)
  setConfigPatch(hud => {
    const themed = applyPalette(hud, live.theme)
    // Claude Code lists running subagents itself, with their time and tokens; claude-hud's
    // agent lines would repeat them, so they show only when asked for.
    return config.hasAgents ? themed : { ...themed, display: { ...themed.display, showAgents: false } }
  })
  let isSummarizing = false
  // Set in session.start: everything that outlives one dispatch calls the
  // engine through these closures.
  let refresh: () => Promise<void> = async () => {}
  let after: (ms: number, fn: () => void) => void = () => {}
  let isRunning = false
  let isQueued = false
  let isScheduled = false
  let isStarted = false
  // Where auto-compaction runs (null: off), for the window it was read for: it
  // moves only with the window, so a model switch reads it again.
  let compactAt: { window: number; at: number | null } | null = null
  // The 5-hour window's readings this session: its forecast follows the last hour's pace.
  let fiveHour: Samples | undefined

  const schedule = () => {
    // A draw can come before session.start: nothing to schedule on yet, and
    // session.start refreshes anyway.
    if (isScheduled || !isStarted) return
    isScheduled = true
    after(DEBOUNCE_MS, () => {
      isScheduled = false
      void refresh()
    })
  }

  on('session.start', async ($, e, next) => {
    const io: Io = {
      stat: path => $.fs.stat(path, { resolve: true }),
      read: path => $.fs.read(path),
      list: path => $.fs.list(path),
      write: (path, text) => $.fs.write(path, text),
      run: (argv, init) => $.process.run(argv, init),
    }
    const session: SessionApi = {
      info: async () => {
        const [id, cwd, root, model, usage, version, settings, step, repo] = await Promise.all([
          $.session.id(),
          $.session.cwd(),
          $.session.root(),
          $.session.model(),
          $.session.usage(),
          $.session.version(),
          $.settings.read().catch(() => ({})),
          read($, steps),
          $.session.repo().catch(() => null),
        ])
        return { id, cwd, root, model, usage, version, settings: settings as Record<string, unknown>, step, repo }
      },
      // A value from before 0.4.3 (bare ids) is dropped rather than misread.
      remotes: async () => (await read($, remotes)).filter(r => typeof r === 'object' && r !== null),
      exists: path => $.fs.exists(path),
    }
    setIo(io)
    after = (ms, fn) => void $.clock.after(ms, fn)
    isStarted = true
    refresh = async () => {
      if (isRunning) {
        isQueued = true
        return
      }
      isRunning = true
      const started = Date.now()
      try {
        const { rows, stdin, todayUsd } = await renderHud(io, session)
        const window = stdin.context_window?.context_window_size ?? 0
        if (config.compactWarnPercent > 0 && window > 0 && compactAt?.window !== window) {
          const breakdown = (await $.session.usage({ breakdown: 'summary' }).catch(() => null))?.context.breakdown
          compactAt = { window, at: breakdown?.isAutoCompactEnabled ? (breakdown.autoCompactThreshold ?? null) : null }
        }
        const tokens = stdin.context_window?.total_input_tokens ?? 0
        const compactLeft =
          compactAt?.at && tokens >= (compactAt.at * config.compactWarnPercent) / 100 ? compactAt.at - tokens : null
        const pet = config.position === 'below' ? await read($, petDock) : null
        const now = await $.clock.now()
        if (todayUsd !== null) await recordSpend(now, todayUsd)
        const days = await read($, history)
        const today = localDay(now)
        const limits = stdin.rate_limits
        const five = limits?.five_hour
        if (five && typeof five.used_percentage === 'number' && five.resets_at) {
          fiveHour = addSample(fiveHour, five.used_percentage, five.resets_at, now)
        }
        const scoped = (stdin.model_scoped ?? []).flatMap(w =>
          w.display_name && typeof w.utilization === 'number'
            ? [{ name: w.display_name, percent: w.utilization, resetsAt: w.resets_at ? Math.floor(Date.parse(w.resets_at) / 1000) : null }]
            : [],
        )
        await alertScoped($, scoped, config.usageAlerts)
        // The 7-day window keeps the pace since it began: an hour of work says little about a week.
        const exhaust = config.hasForecast
          ? [
              { label: m('limit.fiveHour'), at: paceAt(fiveHour, five?.used_percentage, five?.resets_at, FIVE_HOUR_WINDOW_MS, now) },
              { label: m('limit.sevenDay'), at: exhaustAt(limits?.seven_day?.used_percentage, limits?.seven_day?.resets_at, SEVEN_DAY_WINDOW_MS, now) },
              ...scoped.map(w => ({ label: m('limit.scoped', { name: w.name }), at: exhaustAt(w.percent, w.resetsAt, SEVEN_DAY_WINDOW_MS, now) })),
            ].flatMap(({ label, at }) => (at === null ? [] : [{ label, at }]))
          : []
        const extra = extrasLine({
          summary: await read($, summary),
          exhaust,
          todayUsd,
          budgetUsd: config.budgetUsd,
          week: config.hasHistory ? { values: lastDays(days, today, 7), streak: streak(days, today) } : null,
          compactLeft,
          coldCache: coldCacheOf(stdin, config.coldCacheTokens),
          git: config.gitDirtyWarn > 0 || config.gitAheadWarn > 0 ? await gitCounts(io, stdin.cwd ?? '') : null,
          gitDirtyWarn: config.gitDirtyWarn,
          gitAheadWarn: config.gitAheadWarn,
          columns: fitColumns(),
          style: live.theme.extras,
          // spinner's pet stands in for the theme's mascot below the prompt.
          mascot: config.hasMascot && live.theme.mascot && !pet ? live.theme.mascot[mood(stdin)] : null,
        })
        const all = applyTheme(appendExtras(rows, extra, fitColumns()), live.theme)
        // The pet moves in beside the rows when it fits, and out when it does not.
        const widest = Math.max(0, ...all.map(row => row.reduce((sum, span) => sum + cellWidth(span.text), 0)))
        const wasDocked = await read($, isPetDocked)
        const isDocked = pet !== null && !(await read($, isHidden)) && live.columns !== undefined && dockFits(widest, live.columns, pet.width, wasDocked)
        if (isDocked !== wasDocked) await update($, isPetDocked, () => isDocked)
        live.lastLines = all.map(row => row.map(span => span.text).join(''))
        live.lastError = null
        await update($, lines, () => all)
      } catch (err) {
        live.lastError = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)
      } finally {
        live.refreshMs = Date.now() - started
        isRunning = false
      }
      if (isQueued) {
        isQueued = false
        void refresh()
      }
    }

    // The mascot's mood: the quota, the context, whether a tool is running.
    const mood = (stdin: StdinData) => {
      const limits = stdin.rate_limits
      const usage = Math.max(limits?.five_hour?.used_percentage ?? 0, limits?.seven_day?.used_percentage ?? 0)
      const tools = live.transcriptPath ? transcriptData(live.transcriptPath)?.tools ?? [] : []
      return moodOf(stdin.context_window?.used_percentage, usage, tools.some(t => t.status === 'running'))
    }
    // Today's spend into the history, and the store, which other sessions share.
    const recordSpend = async (now: number, todayUsd: number) => {
      const today = localDay(now)
      const usd = Math.round(todayUsd * 100) / 100
      if ((await read($, history))[today] === usd) return
      const stored = ((await $.store.get('history')) ?? {}) as Record<string, number>
      const merged = pruneHistory({ ...stored, [today]: usd }, today, HISTORY_DAYS)
      await $.store.set('history', merged)
      await update($, history, () => merged)
    }

    const kept = await $.store.get('history')
    if (kept && typeof kept === 'object') {
      const today = localDay(await $.clock.now())
      await update($, history, () => pruneHistory(kept as Record<string, number>, today, HISTORY_DAYS))
    }

    const keptTheme = findTheme((await keptRows(prefsOf($), STORE_MOVES)).theme)
    if (keptTheme) useTheme(keptTheme)
    await update($, isHidden, () => !config.isVisible)

    await loadHostFacts(io, config.extraCmd)
    // claude-hud sets its language in each pass; the command's description is read before the first.
    await runWithFacts(async () => setLanguage((await loadConfig()).language))
    await $.command.register({ name: 'hud', description: m('cmd.description'), argumentHint: '[off|on | detail | theme [name|next|reset]]', immediate: true })
    if (config.isDebug) {
      await $.tool.register({
        name: 'hud_debug',
        description: 'claude-hud mod diagnostics: the stdin it built, its last error and refresh time.',
        inputSchema: { type: 'object', properties: {} },
      })
    }
    // Usage the session already had (a resumed one): alerts now, not after the first measurement.
    const usage = await $.session.usage().catch(() => null)
    if (usage) {
      await alert($, gaugesOf(usage), config.contextAlerts, config.usageAlerts)
    }
    $.clock.every(TICK_MS, () => void refresh())
    void refresh()
    // Remote Control turns on and off outside the turn's events (`/remote-control`,
    // `--remote-control` connecting): a cheap read of the session file, a redraw on a change.
    $.clock.every(RC_POLL_MS, async () => {
      const bridge = await remoteControl(io, await $.session.id()).catch(() => live.bridgeSessionId)
      if (bridge !== live.bridgeSessionId) {
        // A new bridge, or none: whoever wrote over the old one is not known to be there.
        await update($, remotes, all => all.filter(r => r.surface !== BRIDGE))
        schedule()
      }
    })

    const result = await next(e)
    await migrateStore(prefsOf($), STORE_MOVES)
    return result
  })

  on('command.run', { command: 'hud' }, async ($, e) => {
    const [verb = '', arg = ''] = e.args.trim().toLowerCase().split(/\s+/)
    if (verb === 'theme') {
      const list = THEMES.map(t => `${t.name}${t.isNerdFont ? '*' : ''} ${t.sample}`).join(' · ')
      const names = THEMES.map(t => t.name).join(', ')
      const at = THEMES.indexOf(live.theme)
      if (!arg) {
        // The engine's dialog offers the next four; "Other" takes any name. Dismissed, or no one to ask (-p): the list.
        const offered = [1, 2, 3, 4].map(i => THEMES[(at + i) % THEMES.length]!.name)
        const answer = await $.ui.ask(m('theme.ask', { name: live.theme.name, list: names }), { options: offered, header: 'HUD theme' }).catch(() => null)
        if (answer === null) return { text: m('theme.list', { name: live.theme.name, list }) }
        const asked = findTheme(answer.trim().split(/\s+/)[0]?.toLowerCase())
        if (!asked) return { text: m('theme.unknown', { name: answer.trim(), list: names }) }
        return setTheme($, asked, schedule)
      }
      // `reset`: the option's default, claude-hud's own look.
      const picked = arg === 'next' ? THEMES[(at + 1) % THEMES.length] : arg === 'reset' ? THEMES[0] : findTheme(arg)
      if (!picked) return { text: m('theme.unknown', { name: arg, list: names }) }
      return setTheme($, picked, schedule)
    }
    if (verb === 'detail') {
      if ((await $.ui.panes()).some(p => p.id === PANE)) {
        await $.ui.close({ id: PANE })
        return { text: m('pane.closed') }
      }
      await $.ui.open({ id: PANE, title: m('pane.title') })
      return { text: m('pane.opened') }
    }
    const hidden = await setHidden($, verb, schedule)

    return { text: m(hidden ? 'cmd.hidden' : 'cmd.shown') }
  })

  // A button in the prompt footer: what `/hud` alone does. Mode labels other plugins add stay beside it.
  if (config.hasFooterButton) {
    on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
      const hidden = await read($, isHidden)
      const below = await next(e)
      const { Box, Button } = $.ui.resolve(e)
      return (
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Button key="hud-toggle" plain dimColor={hidden} label="HUD" onPress={() => setHidden($, '', schedule)} />
          {below}
        </Box>
      )
    })
  }

  on('session.attach', async ($, e, next) => {
    if (e.surface !== 'terminal') {
      await update($, remotes, all => [...all.filter(r => r.id !== e.clientId), { id: e.clientId, surface: e.surface }])
    }
    schedule()

    return next(e)
  })

  // Remote Control's clients are seen by what they send.
  on('prompt.submit', async ($, e, next) => {
    if (await read($, isPicking)) await update($, isPicking, () => false)
    if (await sawBridge($, e.origin)) schedule()
    return next(e)
  })
  on('command.run', async ($, e, next) => {
    if (await sawBridge($, e.origin)) schedule()
    if (e.command !== 'model') return next(e)
    // /model: the last step's model is the old one; the session's is shown until the next step.
    const result = await next(e)
    await update($, steps, step => ({ ...step, model: null }))
    schedule()
    return result
  })

  // Remote Control's prompts reach the session as deliveries before they are a prompt.
  on('session.receive', async ($, e, next) => {
    if (await sawBridge($, e.origin)) schedule()
    return next(e)
  })

  // Usage pushed by the engine: the alerts at once, and the gauges redrawn.
  on('session.measure', async ($, e, next) => {
    await alert($, gaugesOf(e), config.contextAlerts, config.usageAlerts)
    schedule()
    return next(e)
  })

  // A compaction empties the context: the gauge drops now, not at the next tick.
  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined) schedule()
    return result
  })

  // spinner's pet came, went or changed: whether it fits is decided again.
  on('state.set', { plugin: 'spinner', key: 'dock' }, async ($, e, next) => {
    const result = await next(e)
    schedule()
    return result
  })

  // A click on the pet drawn here: spinner counts it as a pat.
  on('ui.message', async ($, e, next) => {
    if ((e.data as { pat?: unknown } | null)?.pat === true) await update($, petPats, n => n + 1)
    return next(e)
  })

  on('session.detach', async ($, e, next) => {
    await update($, remotes, all => all.filter(r => r.id !== e.clientId))
    schedule()

    return next(e)
  })

  on('tool.call', { tool: /^mcp__hud__hud_debug$/ }, async () => {
    const text = JSON.stringify(
      { lines: live.lastLines, stdin: live.lastStdin, bridgeSessionId: live.bridgeSessionId, sessionFile: live.sessionFile, error: live.lastError, refreshMs: live.refreshMs, columns: live.columns, facts: factsSummary() },
      null,
      2,
    )

    return { result: text, text }
  })

  on('tool.call', async ($, e, next) => {
    schedule()
    const started = Date.now()
    const ran = await next(e)
    const ms = Date.now() - started
    const failed = 'deny' in ran ? ran.deny !== undefined : ran.isError === true
    await update($, tools, all => {
      const was = all[e.tool] ?? { count: 0, totalMs: 0, errors: 0 }
      return { ...all, [e.tool]: { count: was.count + 1, totalMs: was.totalMs + ms, errors: was.errors + (failed ? 1 : 0) } }
    })
    schedule()

    return ran
  })

  on('turn.step', async function* ($, e, next) {
    const started = Date.now()
    const result = yield* next(e)
    const elapsed = Date.now() - started
    const usage = result.usage
    await update($, steps, step =>
      e.agentId
        ? { ...step, apiDurationMs: step.apiDurationMs + elapsed }
        : {
            model: e.model,
            effort: e.effort === undefined ? step.effort : String(e.effort),
            apiDurationMs: step.apiDurationMs + elapsed,
            currentUsage: usage
              ? {
                  input_tokens: usage.input_tokens,
                  output_tokens: usage.output_tokens,
                  cache_creation_input_tokens: usage.cache_creation_input_tokens,
                  cache_read_input_tokens: usage.cache_read_input_tokens,
                }
              : step.currentUsage,
            // The request's start is when the main thread's prompt cache was last used.
            lastRequestAt: started,
          },
    )
    schedule()

    return result
  })

  // What the turn about to run starts from, for its row in `/hud detail`.
  on('turn.start', async ($, e, next) => {
    const usage = await $.session.usage().catch(() => null)
    await update($, turnStart, () => ({ usd: usage?.cost?.usd ?? null, tokens: usage?.context.tokens ?? null }))
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    schedule()
    if (e.agentId !== undefined) return next(e)
    const start = await read($, turnStart)
    if (start) {
      const usage = await $.session.usage().catch(() => null)
      const usd = usage?.cost?.usd
      const tokens = usage?.context.tokens
      await update($, turnStart, () => null)
      await update($, turnLog, log => [
        ...log.slice(-(TURN_LOG_SIZE - 1)),
        {
          n: (log[log.length - 1]?.n ?? 0) + 1,
          durationMs: e.durationMs,
          usd: usd !== undefined && start.usd !== null ? usd - start.usd : null,
          tokens: tokens !== undefined && start.tokens !== null ? tokens - start.tokens : null,
        },
      ])
    }
    if (e.isAborted) return next(e)

    if (config.notifyMs > 0 && e.durationMs >= config.notifyMs && e.reason === 'answer') {
      $.ui.toast(m('turn.done', { d: formatDuration(e.durationMs) }))
      if (config.hasChime) void $.audio.play({ base64: chimeWav(), mime: 'audio/wav' }).catch(() => {})
    }
    const count = await update($, turns, n => n + 1)
    // While the model keeps a task list with work left, the list already says what it is doing
    // (Claude Code draws it, and so do todo-bar and the todos line): no fork, and an older line steps aside.
    const todos = live.transcriptPath ? transcriptData(live.transcriptPath)?.todos ?? [] : []
    const hasPlan = todos.some(t => t.status !== 'completed')
    if (hasPlan && (await read($, summary)) !== null) {
      await update($, summary, () => null)
      schedule()
    }
    if (config.summaryEvery > 0 && !hasPlan && !isSummarizing && (count === 1 || count % config.summaryEvery === 0)) {
      isSummarizing = true
      // Not awaited: the fork reads the conversation from the prompt cache while the person reads the answer.
      void $.model
        .fork({ prompt: summaryPrompt() })
        .then(async reply => {
          const line = reply.isAnswered ? cleanSummary(reply.text) : null
          if (line) {
            await update($, summary, () => line)
            schedule()
          }
        })
        .catch(() => {})
        .finally(() => {
          isSummarizing = false
        })
    }

    return next(e)
  })

  const trackWidth = (columns: number | undefined) => {
    if (columns && columns !== live.columns) {
      live.columns = columns
      schedule()
    }
  }

  if (config.position === 'above') {
    // A picker (`/` commands, `@` files) opens above the band: the band steps aside meanwhile.
  on('prompt.edit', async ($, e, next) => {
    const box = await next(e)
    const isOpen = isPickerOpen(box.text, box.cursor)
    if ((await read($, isPicking)) !== isOpen) await update($, isPicking, () => isOpen)
    return box
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
      // Two cells in, as the engine indents the lines under the prompt.
      trackWidth(e.props.bodyColumns - 2)
      const rows = await read($, lines)
      if (e.props.hasSurvey || rows.length === 0 || (await read($, isHidden)) || (await read($, isPicking))) {
        return next(e)
      }

      return drawRows($.ui.resolve(e), rows, await next(e), 2)
    })
  } else {
    // Under the prompt, where the statusline sat: the HUD, then the engine's hint line.
    on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
      trackWidth(e.viewport?.columns)
      const rows = await read($, lines)
      if (rows.length === 0 || (await read($, isHidden))) {
        return next(e)
      }
      const ui = $.ui.resolve(e)
      const pet = (await read($, isPetDocked)) ? await read($, petDock) : null
      if (!pet || !('Client' in ui)) return drawRows(ui, rows, await next(e))

      const { Box } = ui
      return (
        <Box flexDirection="row">
          <Box flexDirection="column" flexGrow={1} flexShrink={0}>
            {drawRows(ui, rows, await next(e))}
          </Box>
          {drawPet(ui, pet, 'pet')}
        </Box>
      )
    })
  }

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    // Read so the pane redraws with the HUD: the transcript's agents and todos change with it.
    await read($, lines)
    const transcript = live.transcriptPath ? transcriptData(live.transcriptPath) : null
    const now = await $.clock.now()
    return drawPane($.ui.resolve(e), {
      tools: await read($, tools),
      turns: await read($, turnLog),
      agents: transcript?.agents ?? [],
      todos: transcript?.todos ?? [],
      history: await read($, history),
      today: localDay(now),
      budgetUsd: config.budgetUsd,
      now: Date.now(),
    })
  })
}
