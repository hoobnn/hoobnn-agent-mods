// claude-hud as a mod. claude-hud's own source (hooks/hud, MIT, see
// LICENSE.claude-hud) renders the lines; this module feeds it what the
// statusline used to hand it on stdin, from `$`, and draws its output in the
// band above the prompt.
import './shims/globals.js'

import { atom, read, update } from 'claude-code'
import type { Elements, Register, RenderElement, SessionRepo, SessionUsage, SessionVersion } from 'claude-code'

import type { Fired, HudLine, Remote, StepInfo, ToolStats } from '../types'
import { parseAnsi } from './ansi.js'
import {
  chimeWav,
  appendExtras,
  crossThresholds,
  dimSeparators,
  exhaustAt,
  extrasLine,
  formatDuration,
  lastDays,
  localDay,
  parseGitStatus,
  parseThresholds,
  pruneHistory,
  sparkline,
  streak,
} from './extras.js'
import { loadConfig, setConfigPatch } from './hud/config.js'
import { getCostTotals } from './hud/daily-cost.js'
import { setLanguage } from './hud/i18n/index.js'
import type { GitRepoIdentity } from './hud/git.js'
import { main } from './hud/index.js'
import { setRenderSink } from './hud/render/index.js'
import { setTranscriptProvider } from './hud/transcript.js'
import type { StdinData } from './hud/types.js'
import { FIVE_HOUR_WINDOW_MS, SEVEN_DAY_WINDOW_MS } from './hud/usage-pace.js'
import { processShim } from './shims/globals.js'
import { factsSummary, type Io, markStable, runWithFacts, setIo } from './shims/host.js'
import { sysinfo } from './shims/os.js'
import { basename, setCwdProvider } from './shims/path.js'
import { m, money, summaryPrompt } from './i18n.js'
import { pullTranscript, transcriptData, transcriptMeta } from './transcript-feed.js'

const lines = atom({ plugin: 'hud', key: 'lines' } as const, [])
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

const PANE = 'hud-detail'
// Days of spend the store keeps; the HUD draws the last 7.
const HISTORY_DAYS = 60
// Columns the summary may take in the row (a CJK character takes two).
const SUMMARY_COLUMNS = 56

setTranscriptProvider(async path => transcriptData(path))

// Events (tool calls, model requests, turn ends) drive the live updates; the
// tick only keeps minute-grained clocks (duration, resets, cache) current.
const TICK_MS = 15_000
const DEBOUNCE_MS = 250
const RC_POLL_MS = 3_000

type CurrentUsage = NonNullable<NonNullable<StdinData['context_window']>['current_usage']>

// What the statusline's stdin carried and no `$` call answers is tracked here
// from the turn's own events.
const live = {
  transcriptPath: undefined as string | undefined,
  transcriptFor: undefined as string | undefined,
  columns: undefined as number | undefined,
  lastStdin: null as StdinData | null,
  lastError: null as string | null,
  lastLines: [] as string[],
  refreshMs: 0,
  // This process's `sessions/<pid>.json`, found by session id.
  sessionFile: undefined as string | undefined,
  bridgeSessionId: null as string | null,
}

/** The session reads the stdin is built from, closed over `$` in session.start. */
type SessionApi = {
  info: () => Promise<{
    id: string
    cwd: string
    root: string
    model: string
    usage: SessionUsage
    version: SessionVersion
    settings: Record<string, unknown>
    step: StepInfo
    repo: SessionRepo | null
  }>
  remotes: () => Promise<Remote[]>
  exists: (path: string) => Promise<boolean>
}

const MODEL_FAMILIES: Record<string, string> = { opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku', fable: 'Fable' }

/** `claude-opus-5-5[1m]` → `Opus 5.5 (1M context)`, as the statusline's display_name. */
export function modelDisplayName(id: string): string {
  const isLong = /\[1m\]$/i.test(id)
  const bare = id.replace(/\[1m\]$/i, '')
  const match = /claude-(opus|sonnet|haiku|fable)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?$/i.exec(bare)
    ?? /claude-(\d+)(?:-(\d+))?-(opus|sonnet|haiku)/i.exec(bare)
  let name = bare
  if (match && /^\D/.test(match[1] ?? '')) {
    name = `${MODEL_FAMILIES[match[1]!.toLowerCase()]} ${match[2]}${match[3] ? `.${match[3]}` : ''}`
  } else if (match) {
    name = `${MODEL_FAMILIES[match[3]!.toLowerCase()]} ${match[1]}${match[2] ? `.${match[2]}` : ''}`
  } else if (MODEL_FAMILIES[bare.toLowerCase()]) {
    name = MODEL_FAMILIES[bare.toLowerCase()]!
  }
  return isLong ? `${name} (1M context)` : name
}

function projectSlug(dir: string): string {
  return dir.replace(/[^a-zA-Z0-9]/g, '-')
}

function claudeConfigDir(): string {
  return processShim.env.CLAUDE_CONFIG_DIR?.trim() || `${sysinfo.home}/.claude`
}

async function findTranscript(io: Io, session: SessionApi, id: string, dirs: string[]): Promise<string | undefined> {
  const configDir = claudeConfigDir()
  for (const dir of dirs) {
    const candidate = `${configDir}/projects/${projectSlug(dir)}/${id}.jsonl`
    if (await session.exists(candidate)) return candidate
  }
  const found = await io
    .run(['/usr/bin/find', `${configDir}/projects`, '-maxdepth', '2', '-name', `${id}.jsonl`])
    .catch(() => null)
  return found?.stdout.split('\n').find(Boolean)
}

type SessionEntry = { sessionId?: unknown; bridgeSessionId?: unknown }

/**
 * Remote Control's session id, or null when it is off. The engine records it
 * as `bridgeSessionId` in `sessions/<pid>.json`; the mod API does not report it.
 */
async function remoteControl(io: Io, id: string): Promise<string | null> {
  const readEntry = (path: string) =>
    io.read(path).then(text => JSON.parse(text) as SessionEntry, () => null)
  const bridgeOf = (entry: SessionEntry) => (typeof entry.bridgeSessionId === 'string' ? entry.bridgeSessionId : null)
  if (live.sessionFile) {
    const entry = await readEntry(live.sessionFile)
    if (entry?.sessionId === id) return bridgeOf(entry)
    live.sessionFile = undefined
  }
  const dir = `${claudeConfigDir()}/sessions`
  for (const file of await io.list(dir).catch(() => [])) {
    if (file.kind !== 'file' || !/^\d+\.json$/.test(file.name)) continue
    const entry = await readEntry(`${dir}/${file.name}`)
    if (entry?.sessionId !== id) continue
    live.sessionFile = `${dir}/${file.name}`
    return bridgeOf(entry)
  }
  return null
}

function surfaceLabel(surface: string): string {
  if (surface === 'mobile') return m('surface.mobile')
  if (surface === 'desktop') return m('surface.desktop')
  return surface === 'vscode' ? 'VS Code' : surface
}

/**
 * ` │ ⇄ Remote Control` (linked to the session on claude.ai), then who is attached
 * by surface (`phone · web/desktop×2`), or that it waits for a client.
 */
export function rcSpans(bridgeSessionId: string | null, attached: readonly Remote[]): HudLine {
  if (!bridgeSessionId) return []
  const spans: HudLine = [
    { text: ' │ ' },
    { text: m('rc.label'), color: 'green', href: `https://claude.ai/code/${bridgeSessionId}` },
  ]
  if (attached.length === 0) {
    spans.push({ text: ` ${m('rc.waiting')}`, dimColor: true })
    return spans
  }
  const counts = new Map<string, number>()
  for (const r of attached) {
    const label = surfaceLabel(r.surface)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  const who = [...counts].map(([label, n]) => (n > 1 ? `${label}×${n}` : label)).join(' · ')
  spans.push({ text: ` ${m('rc.attached', { who })}`, color: 'cyan' })
  return spans
}

async function gitWorktree(io: Io, cwd: string): Promise<string | undefined> {
  const out = await io
    .run(['git', 'rev-parse', '--git-dir', '--git-common-dir', '--show-toplevel'], { cwd, timeoutMs: 3_000 })
    .catch(() => null)
  if (!out || out.exitCode !== 0) return undefined
  const [gitDir, commonDir, top] = out.stdout.trim().split('\n')
  if (!gitDir || !commonDir || !top) return undefined
  const resolveIn = (p: string) => (p.startsWith('/') ? p : `${cwd}/${p}`)
  return resolveIn(gitDir) !== resolveIn(commonDir) ? basename(top) : undefined
}

/** `git@github.com:o/n.git`, `https://github.com/o/n` → `{ host, owner, name }`, as workspace.repo. */
export function repoIdentity(remote: string | null | undefined): GitRepoIdentity | undefined {
  if (!remote) return undefined
  const match = /^(?:[a-z+]+:\/\/)?(?:[^@/]+@)?([^/:]+)[:/](?:\d+\/)?([^/]+)\/([^/]+?)(?:\.git)?\/?$/i.exec(remote.trim())
  return match ? { host: match[1]!.toLowerCase(), owner: match[2]!, name: match[3]! } : undefined
}

function epochSeconds(iso: string | undefined): number | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000)
}

async function buildStdin(io: Io, session: SessionApi): Promise<StdinData> {
  const { id, cwd, root, model: sessionModel, usage, version, settings, step, repo } = await session.info()
  processShim.cwdPath = cwd
  // Looked up once per session id: /clear starts a new transcript with no session.start.
  if (live.transcriptFor !== id || !live.transcriptPath) {
    live.transcriptPath = await findTranscript(io, session, id, [root, cwd])
    live.transcriptFor = live.transcriptPath ? id : undefined
  }
  if (live.transcriptPath) {
    const size = await io.stat(live.transcriptPath).then(stat => stat.size, () => 0)
    await pullTranscript(live.transcriptPath, size)
  }
  const meta = transcriptMeta(live.transcriptPath)
  // The prompt cache's state, which the statusline reports and `$` does not:
  // its clock restarts at the last main-thread request (else the last
  // response on record) and runs for the TTL the last cache write used.
  const cacheAnchor = step.lastRequestAt ?? meta.lastResponseAt
  const expiresAt = cacheAnchor === undefined ? null : Math.floor(cacheAnchor / 1000) + (meta.ttl === '1h' ? 3600 : 300)
  const modelId = step.model ?? sessionModel
  const percent = usage.context.percent
  const window = (kind: string) => {
    const limit = usage.rateLimits.find(r => r.kind === kind)
    return limit ? { used_percentage: limit.percentUsed, resets_at: epochSeconds(limit.resetsAt) } : null
  }
  // The last main-thread response's usage, as the statusline's current_usage.
  // Before this session has seen one (fresh start, a reload) the engine's
  // context figure stands in for it, uncached, so the token count is right.
  const tokens = usage.context.tokens
  let currentUsage: CurrentUsage | null = step.currentUsage
  const seen = currentUsage
    ? (currentUsage.input_tokens ?? 0) + (currentUsage.cache_creation_input_tokens ?? 0) + (currentUsage.cache_read_input_tokens ?? 0)
    : undefined
  if (tokens !== undefined && seen !== tokens) {
    currentUsage = {
      input_tokens: tokens,
      output_tokens: currentUsage?.output_tokens ?? 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    }
  }
  const permissions = (settings as { permissions?: { additionalDirectories?: unknown } }).permissions
  const addedDirs = Array.isArray(permissions?.additionalDirectories)
    ? permissions.additionalDirectories.filter((d): d is string => typeof d === 'string')
    : []

  const outputStyle = (settings as { outputStyle?: unknown }).outputStyle

  return {
    session_id: id,
    session_name: meta.sessionName,
    version: version.version,
    transcript_path: live.transcriptPath,
    cwd,
    workspace: {
      current_dir: cwd,
      project_dir: root,
      added_dirs: addedDirs,
      git_worktree: await gitWorktree(io, cwd),
      repo: repoIdentity(repo?.remote),
    },
    output_style: typeof outputStyle === 'string' ? { name: outputStyle } : undefined,
    model: { id: modelId, display_name: modelDisplayName(modelId) },
    context_window: {
      context_window_size: usage.context.window,
      total_input_tokens: usage.context.tokens ?? null,
      total_output_tokens: null,
      current_usage: currentUsage,
      used_percentage: percent ?? null,
      remaining_percentage: percent === undefined ? null : 100 - percent,
    },
    cost: {
      total_cost_usd: usage.cost?.usd ?? null,
      total_duration_ms: Date.now() - usage.startedAt,
      total_api_duration_ms: step.apiDurationMs,
      total_lines_added: null,
      total_lines_removed: null,
    },
    rate_limits: { five_hour: window('five_hour'), seven_day: window('seven_day'), spend_limit: window('spend_limit') },
    prompt_cache: {
      caching_observed: meta.cachingObserved,
      warm: expiresAt !== null && expiresAt * 1000 > Date.now(),
      ttl: meta.ttl,
      expires_at: expiresAt,
      hit_ratio: meta.hitRatio,
    },
    // Before the first request of the session, the configured level.
    effort: (step.effort ?? (settings as { effortLevel?: unknown }).effortLevel)
      ? { level: String(step.effort ?? (settings as { effortLevel?: unknown }).effortLevel) }
      : null,
  }
}

async function loadHostFacts(io: Io, extraCmd: string): Promise<void> {
  const [env, uname, memsize] = await Promise.all([
    io.run(['/usr/bin/env', '-0']).catch(() => null),
    io.run(['/usr/bin/uname', '-s']).catch(() => null),
    io.run(['/usr/sbin/sysctl', '-n', 'hw.memsize']).catch(() => null),
  ])
  for (const pair of env?.stdout.split('\0') ?? []) {
    const eq = pair.indexOf('=')
    if (eq > 0) processShim.env[pair.slice(0, eq)] = pair.slice(eq + 1)
  }
  const platform = uname?.stdout.trim().toLowerCase() === 'linux' ? 'linux' : 'darwin'
  processShim.platform = platform
  sysinfo.platform = platform
  sysinfo.home = processShim.env.HOME ?? '/'
  sysinfo.tmpdir = processShim.env.TMPDIR ?? '/tmp'
  sysinfo.totalmem = Number.parseInt(memsize?.stdout.trim() ?? '', 10) || 0
  processShim.argv = extraCmd ? ['node', 'claude-hud', '--extra-cmd', extraCmd] : ['node', 'claude-hud']
  markStable(['/usr/sbin/sysctl', '-n', 'hw.memsize'])
  setCwdProvider(() => processShim.cwdPath)
}

/** Changed paths and unpushed commits, or null outside a repo. */
async function gitCounts(io: Io, cwd: string): Promise<{ dirty: number; ahead: number } | null> {
  const out = await io
    .run(['git', 'status', '--porcelain=v2', '--branch'], { cwd, timeoutMs: 3_000 })
    .catch(() => null)
  return out && out.exitCode === 0 ? parseGitStatus(out.stdout) : null
}

const WIDE = /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/

/** One reply line of the summary fork: quotes and closing punctuation off, cut to `columns`. */
export function cleanSummary(text: string, columns = SUMMARY_COLUMNS): string | null {
  const line = text.split('\n').map(l => l.trim()).find(Boolean) ?? ''
  const bare = line
    .replace(/^["'“”‘’„‚«»「『【]+/, '')
    .replace(/["'“”‘’„‚«»」』】。．.!！?？…]+$/, '')
    .trim()
  if (!bare) return null
  let width = 0
  let out = ''
  for (const ch of bare) {
    width += WIDE.test(ch) ? 2 : 1
    if (width > columns - 1) return `${out.trimEnd()}…`
    out += ch
  }
  return out
}

type Rendered = { rows: HudLine[]; stdin: StdinData; todayUsd: number | null }

async function renderHud(io: Io, session: SessionApi): Promise<Rendered> {
  if (live.columns) processShim.env.COLUMNS = String(live.columns)
  const stdin = await buildStdin(io, session)
  live.lastStdin = stdin
  let out: string[] = []
  let todayUsd: number | null = null
  await runWithFacts(async () => {
    out = []
    setRenderSink(line => out.push(line))
    await main(async () => stdin)
    // Today's spend across sessions, from claude-hud's own ledger (kept current here
    // even when its daily-cost element is off), so the history and /hud detail have every day.
    const resetsAt = stdin.rate_limits?.seven_day?.resets_at
    todayUsd = getCostTotals(stdin, { sevenDayResetAt: resetsAt ? new Date(resetsAt * 1000) : null })?.todayUsd ?? null
  })
  const rendered = out.map(line => dimSeparators(parseAnsi(line)))
  live.bridgeSessionId = await remoteControl(io, stdin.session_id ?? '')
  const rc = rcSpans(live.bridgeSessionId, await session.remotes())
  if (rc.length > 0) {
    if (rendered.length > 0) rendered[0] = [...rendered[0]!, ...rc]
    else rendered.push(rc.slice(1))
  }
  return { rows: rendered, stdin, todayUsd }
}

export const register: Register = (on, options) => {
  const extraCmd = typeof options.extraCmd === 'string' ? options.extraCmd : ''
  const isDebug = options.debug === true
  const position = options.position === 'below' ? 'below' : 'above'
  const num = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback)
  const notifyMs = Math.max(0, num(options.notifyAfterSeconds, 0)) * 1000
  const hasChime = options.notifySound !== false
  const contextThresholds = parseThresholds(typeof options.contextAlerts === 'string' ? options.contextAlerts : '')
  const usageThresholds = parseThresholds(typeof options.usageAlerts === 'string' ? options.usageAlerts : '')
  const hasForecast = options.showForecast !== false
  const budgetUsd = Math.max(0, num(options.dailyBudgetUsd, 0))
  const hasHistory = options.showHistory === true
  const summaryEvery = Math.max(0, Math.floor(num(options.summaryEveryTurns, 5)))
  const gitDirtyWarn = Math.max(0, num(options.gitDirtyWarn, 20))
  const gitAheadWarn = Math.max(0, num(options.gitAheadWarn, 5))
  let isSummarizing = false
  // Claude Code lists running subagents itself, with their time and tokens; claude-hud's
  // agent lines would repeat them, so they show only when asked for.
  const showAgents = options.showAgents === true
  setConfigPatch(config => (showAgents ? config : { ...config, display: { ...config.display, showAgents: false } }))
  // Set in session.start: everything that outlives one dispatch calls the
  // engine through these closures.
  let refresh: () => Promise<void> = async () => {}
  let after: (ms: number, fn: () => void) => void = () => {}
  let isRunning = false
  let isQueued = false
  let isScheduled = false
  let isStarted = false

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
        const now = await $.clock.now()
        await alert(stdin)
        if (todayUsd !== null) await recordSpend(now, todayUsd)
        const days = await read($, history)
        const today = localDay(now)
        const limits = stdin.rate_limits
        const exhaust = hasForecast
          ? [
              { label: m('limit.fiveHour'), at: exhaustAt(limits?.five_hour?.used_percentage, limits?.five_hour?.resets_at, FIVE_HOUR_WINDOW_MS, now) },
              { label: m('limit.sevenDay'), at: exhaustAt(limits?.seven_day?.used_percentage, limits?.seven_day?.resets_at, SEVEN_DAY_WINDOW_MS, now) },
            ].flatMap(({ label, at }) => (at === null ? [] : [{ label, at }]))
          : []
        const extra = extrasLine({
          summary: await read($, summary),
          exhaust,
          todayUsd,
          budgetUsd,
          week: hasHistory ? { values: lastDays(days, today, 7), streak: streak(days, today) } : null,
          git: gitDirtyWarn > 0 || gitAheadWarn > 0 ? await gitCounts(io, stdin.cwd ?? '') : null,
          gitDirtyWarn,
          gitAheadWarn,
          columns: live.columns,
        })
        const all = appendExtras(rows, extra, live.columns)
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

    // Toasts once per threshold a gauge crosses; re-armed once it drops back.
    const alert = async (stdin: StdinData) => {
      const was = await read($, fired)
      const limits = stdin.rate_limits
      const context = crossThresholds(stdin.context_window?.used_percentage, contextThresholds, was.context)
      const fiveHour = crossThresholds(limits?.five_hour?.used_percentage, usageThresholds, was.fiveHour)
      const sevenDay = crossThresholds(limits?.seven_day?.used_percentage, usageThresholds, was.sevenDay)
      if (context.alert !== null) $.ui.toast(m('alert.context', { p: context.alert }))
      if (fiveHour.alert !== null) $.ui.toast(m('alert.fiveHour', { p: fiveHour.alert }))
      if (sevenDay.alert !== null) $.ui.toast(m('alert.sevenDay', { p: sevenDay.alert }))
      const now = { context: context.fired, fiveHour: fiveHour.fired, sevenDay: sevenDay.fired }
      if (JSON.stringify(now) !== JSON.stringify(was)) await update($, fired, () => now)
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

    await loadHostFacts(io, extraCmd)
    // claude-hud sets its language in each pass; the command's description is read before the first.
    await runWithFacts(async () => setLanguage((await loadConfig()).language))
    await $.command.register({ name: 'hud', description: m('cmd.description'), argumentHint: '[detail]' })
    if (isDebug) {
      await $.tool.register({
          name: 'hud_debug',
      description: 'claude-hud mod diagnostics: the stdin it built, its last error and refresh time.',
        inputSchema: { type: 'object', properties: {} },
      })
    }
    $.clock.every(TICK_MS, () => void refresh())
    void refresh()
    // Remote Control turns on and off outside the turn's events (`/remote-control`,
    // `--remote-control` connecting): a cheap read of the session file, a redraw on a change.
    $.clock.every(RC_POLL_MS, async () => {
      const bridge = await remoteControl(io, await $.session.id()).catch(() => live.bridgeSessionId)
      if (bridge !== live.bridgeSessionId) schedule()
    })

    return next(e)
  })

  on('command.run', { command: 'hud' }, async ($, e) => {
    if (e.args.trim().toLowerCase() === 'detail') {
      if ((await $.ui.panes()).some(p => p.id === PANE)) {
        await $.ui.close({ id: PANE })
        return { text: m('pane.closed') }
      }
      await $.ui.open({ id: PANE, title: m('pane.title') })
      return { text: m('pane.opened') }
    }
    const hidden = await update($, isHidden, v => !v)

    return { text: m(hidden ? 'cmd.hidden' : 'cmd.shown') }
  })

  on('session.attach', async ($, e, next) => {
    if (e.surface !== 'terminal') {
      await update($, remotes, all => [...all.filter(r => r.id !== e.clientId), { id: e.clientId, surface: e.surface }])
    }
    schedule()

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

  on('turn.complete', async ($, e, next) => {
    schedule()
    if (e.agentId !== undefined || e.isAborted) return next(e)

    if (notifyMs > 0 && e.durationMs >= notifyMs && e.reason === 'answer') {
      $.ui.toast(m('turn.done', { d: formatDuration(e.durationMs) }))
      if (hasChime) void $.audio.play({ base64: chimeWav(), mime: 'audio/wav' }).catch(() => {})
    }
    const count = await update($, turns, n => n + 1)
    if (summaryEvery > 0 && !isSummarizing && (count === 1 || count % summaryEvery === 0)) {
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

  // The HUD's rows over whatever the engine (or another mod) draws in the same place.
  const drawRows = (el: Pick<Elements['terminal'], 'Box' | 'Text' | 'Link'>, rows: HudLine[], rest: RenderElement) => {
    const { Box, Text, Link } = el

    return (
      <Box flexDirection="column">
        {rows.map((row, i) => (
          // A row of sibling Texts, not nested ones: a nested Text drops dimColor.
          // claude-hud fits its own rows; the extras row wraps when it runs long.
          <Box key={`l${i}`} flexDirection="row" flexWrap="wrap">
            {row.map((span, j) => {
              const text = (
              <Text
                key={`s${j}`}
                color={span.color}
                backgroundColor={span.backgroundColor}
                bold={span.bold}
                dimColor={span.dimColor}
                italic={span.italic}
                underline={span.underline}
                strikethrough={span.strikethrough}
                inverse={span.inverse}
              >
                {span.text}
              </Text>
              )
              // claude-hud's https links (a GitHub branch) stay clickable.
              return span.href ? (
                <Link key={`s${j}`} href={span.href}>
                  {text}
                </Link>
              ) : (
                text
              )
            })}
          </Box>
        ))}
        {rest}
      </Box>
    )
  }

  const trackWidth = (columns: number | undefined) => {
    if (columns && columns !== live.columns) {
      live.columns = columns
      schedule()
    }
  }

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (position !== 'above') return next(e)
    trackWidth(e.props.bodyColumns)
    const rows = await read($, lines)
    if (e.props.hasSurvey || rows.length === 0 || (await read($, isHidden))) {
      return next(e)
    }

    return drawRows($.ui.resolve(e), rows, await next(e))
  })

  // Under the prompt, where the statusline sat: the HUD, then the engine's hint line.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    if (position !== 'below') return next(e)
    trackWidth(e.viewport?.columns)
    const rows = await read($, lines)
    if (rows.length === 0 || (await read($, isHidden))) {
      return next(e)
    }

    return drawRows($.ui.resolve(e), rows, await next(e))
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    // Read so the pane redraws with the HUD: the transcript's agents and todos change with it.
    await read($, lines)
    const stats = Object.entries(await read($, tools)).sort((a, b) => b[1].totalMs - a[1].totalMs)
    const transcript = live.transcriptPath ? transcriptData(live.transcriptPath) : null
    const agents = (transcript?.agents ?? []).slice(-8)
    const todos = transcript?.todos ?? []
    const days = await read($, history)
    const today = localDay(await $.clock.now())
    const week = lastDays(days, today, 7)
    const heading = (text: string) => <Text bold color="cyan">{text}</Text>
    const todaySpent = money(days[today] ?? 0) + (budgetUsd > 0 ? `/${money(budgetUsd)}` : '')
    const days7 = streak(days, today)
    const spendLine = [
      m('spend.today', { spent: todaySpent }),
      `${m('spend.week', { spent: money(week.reduce((a, b) => a + b, 0)) })} ${sparkline(week)}`,
      ...(days7 > 1 ? [m('streak', { n: days7 })] : []),
    ].join(' · ')

    return (
      <Box flexDirection="column">
        {heading(m('pane.tools'))}
        {stats.length === 0 && <Text dimColor>{m('pane.noTools')}</Text>}
        {stats.slice(0, 12).map(([name, s]) => (
          <Box key={`t-${name}`} flexDirection="row" columnGap={1}>
            <Text>{name}</Text>
            <Text dimColor>
              {m('pane.toolStats', { count: s.count, total: formatDuration(s.totalMs), avg: formatDuration(s.totalMs / s.count) })}
            </Text>
            {s.errors > 0 ? <Text color="red">{m('pane.failed', { n: s.errors })}</Text> : null}
          </Box>
        ))}
        <Text> </Text>
        {heading(m('pane.agents'))}
        {agents.length === 0 && <Text dimColor>{m('pane.none')}</Text>}
        {agents.map(a => (
          <Box key={`a-${a.id}`} flexDirection="row" columnGap={1}>
            <Text color={a.status === 'running' ? 'yellow' : 'green'}>{a.status === 'running' ? '◐' : '✓'}</Text>
            <Text>{a.type}</Text>
            <Text dimColor wrap="truncate-end">
              {a.description ?? ''} {formatDuration((a.endTime?.getTime() ?? Date.now()) - a.startTime.getTime())}
            </Text>
          </Box>
        ))}
        <Text> </Text>
        {heading(m('pane.todos'))}
        {todos.length === 0 && <Text dimColor>{m('pane.none')}</Text>}
        {todos.map((t, i) => (
          <Text key={`d-${i}`} dimColor={t.status === 'completed'} color={t.status === 'in_progress' ? 'yellow' : undefined}>
            {t.status === 'completed' ? '☑' : t.status === 'in_progress' ? '◐' : '☐'} {t.content}
          </Text>
        ))}
        <Text> </Text>
        {heading(m('pane.spend'))}
        <Text>{spendLine}</Text>
      </Box>
    )
  })
}
