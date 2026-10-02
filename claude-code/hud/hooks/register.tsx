// claude-hud as a mod. claude-hud's own source (hooks/hud, MIT, see
// LICENSE.claude-hud) renders the lines; this module feeds it what the
// statusline used to hand it on stdin, from `$`, and draws its output in the
// band above the prompt.
import './shims/globals.js'

import { atom, read, update } from 'claude-code'
import type { Elements, Register, RenderElement, SessionUsage, SessionVersion } from 'claude-code'

import type { HudLine, StepInfo } from '../types'
import { parseAnsi } from './ansi.js'
import { main } from './hud/index.js'
import { parseTranscript } from './hud/transcript.js'
import { setRenderSink } from './hud/render/index.js'
import type { StdinData } from './hud/types.js'
import { processShim } from './shims/globals.js'
import { factsSummary, type Io, markStable, runWithFacts, setIo } from './shims/host.js'
import { sysinfo } from './shims/os.js'
import { basename, setCwdProvider } from './shims/path.js'

const lines = atom({ plugin: 'hud', key: 'lines' } as const, [])
const isHidden = atom({ plugin: 'hud', key: 'isHidden' } as const, false)
// Session state, so a reload keeps what earlier requests reported.
const steps = atom({ plugin: 'hud', key: 'step' } as const, {
  model: null,
  effort: null,
  apiDurationMs: 0,
  currentUsage: null,
} as StepInfo)

// Events (tool calls, model requests, turn ends) drive the live updates; the
// tick only keeps minute-grained clocks (duration, resets, cache) current.
const TICK_MS = 15_000
const DEBOUNCE_MS = 250

type CurrentUsage = NonNullable<NonNullable<StdinData['context_window']>['current_usage']>

// What the statusline's stdin carried and no `$` call answers is tracked here
// from the turn's own events.
const live = {
  transcriptPath: undefined as string | undefined,
  transcriptFor: undefined as string | undefined,
  columns: undefined as number | undefined,
  lastStdin: null as StdinData | null,
  lastError: null as string | null,
  lastTranscript: null as Record<string, unknown> | null,
  lastLines: [] as string[],
  refreshMs: 0,
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
  }>
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

async function findTranscript(io: Io, session: SessionApi, id: string, dirs: string[]): Promise<string | undefined> {
  const configDir = processShim.env.CLAUDE_CONFIG_DIR?.trim() || `${sysinfo.home}/.claude`
  for (const dir of dirs) {
    const candidate = `${configDir}/projects/${projectSlug(dir)}/${id}.jsonl`
    if (await session.exists(candidate)) return candidate
  }
  const found = await io
    .run(['/usr/bin/find', `${configDir}/projects`, '-maxdepth', '2', '-name', `${id}.jsonl`])
    .catch(() => null)
  return found?.stdout.split('\n').find(Boolean)
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

function epochSeconds(iso: string | undefined): number | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000)
}

async function buildStdin(io: Io, session: SessionApi): Promise<StdinData> {
  const { id, cwd, root, model: sessionModel, usage, version, settings, step } = await session.info()
  processShim.cwdPath = cwd
  // Looked up once per session id: /clear starts a new transcript with no session.start.
  if (live.transcriptFor !== id || !live.transcriptPath) {
    live.transcriptPath = await findTranscript(io, session, id, [root, cwd])
    live.transcriptFor = live.transcriptPath ? id : undefined
  }
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

  return {
    session_id: id,
    version: version.version,
    transcript_path: live.transcriptPath,
    cwd,
    workspace: {
      current_dir: cwd,
      project_dir: root,
      added_dirs: addedDirs,
      git_worktree: await gitWorktree(io, cwd),
    },
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
    rate_limits: { five_hour: window('five_hour'), seven_day: window('seven_day') },
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

async function renderHud(io: Io, session: SessionApi): Promise<HudLine[]> {
  if (live.columns) processShim.env.COLUMNS = String(live.columns)
  const stdin = await buildStdin(io, session)
  live.lastStdin = stdin
  let out: string[] = []
  await runWithFacts(async () => {
    out = []
    setRenderSink(line => out.push(line))
    await main({
      readStdin: async () => stdin,
      parseTranscript: async path => {
        const parsed = await parseTranscript(path)
        live.lastTranscript = {
          tools: parsed.tools.length,
          agents: parsed.agents.length,
          todos: parsed.todos.length,
          sessionStart: parsed.sessionStart,
          sessionName: parsed.sessionName,
        }
        return parsed
      },
      log: (...args: unknown[]) => out.push(args.map(String).join(' ')),
    })
  })
  const rendered = out.map(parseAnsi)
  live.lastLines = rendered.map(row => row.map(span => span.text).join(''))
  return rendered
}

export const register: Register = (on, options) => {
  const extraCmd = typeof options.extraCmd === 'string' ? options.extraCmd : ''
  const isDebug = options.debug === true
  const position = options.position === 'below' ? 'below' : 'above'
  // Set in session.start: everything that outlives one dispatch calls the
  // engine through these closures.
  let refresh: () => Promise<void> = async () => {}
  let after: (ms: number, fn: () => void) => void = () => {}
  let isRunning = false
  let isQueued = false
  let isScheduled = false

  const schedule = () => {
    if (isScheduled) return
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
        const [id, cwd, root, model, usage, version, settings, step] = await Promise.all([
          $.session.id(),
          $.session.cwd(),
          $.session.root(),
          $.session.model(),
          $.session.usage(),
          $.session.version(),
          $.settings.read().catch(() => ({})),
          read($, steps),
        ])
        return { id, cwd, root, model, usage, version, settings: settings as Record<string, unknown>, step }
      },
      exists: path => $.fs.exists(path),
    }
    setIo(io)
    after = (ms, fn) => void $.clock.after(ms, fn)
    refresh = async () => {
      if (isRunning) {
        isQueued = true
        return
      }
      isRunning = true
      const started = Date.now()
      try {
        const rendered = await renderHud(io, session)
        live.lastError = null
        await update($, lines, () => rendered)
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

    await loadHostFacts(io, extraCmd)
    await $.command.register({ name: 'hud', description: '显示 / 隐藏 claude-hud 横条' })
    if (isDebug) {
      await $.tool.register({
          name: 'hud_debug',
      description: 'claude-hud mod diagnostics: the stdin it built, its last error and refresh time.',
        inputSchema: { type: 'object', properties: {} },
      })
    }
    $.clock.every(TICK_MS, () => void refresh())
    void refresh()

    return next(e)
  })

  on('command.run', { command: 'hud' }, async $ => {
    const hidden = await update($, isHidden, v => !v)

    return { text: hidden ? 'claude-hud 横条已隐藏' : 'claude-hud 横条已显示' }
  })

  on('tool.call', { tool: /^mcp__hud__hud_debug$/ }, async () => {
    const text = JSON.stringify(
      { lines: live.lastLines, stdin: live.lastStdin, transcript: live.lastTranscript, error: live.lastError, refreshMs: live.refreshMs, columns: live.columns, facts: factsSummary() },
      null,
      2,
    )

    return { result: text, text }
  })

  on('tool.call', async ($, e, next) => {
    schedule()
    const ran = await next(e)
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
          },
    )
    schedule()

    return result
  })

  on('turn.complete', async ($, e, next) => {
    schedule()

    return next(e)
  })

  // The HUD's rows over whatever the engine (or another mod) draws in the same place.
  const drawRows = (el: Pick<Elements['terminal'], 'Box' | 'Text'>, rows: HudLine[], rest: RenderElement) => {
    const { Box, Text } = el

    return (
      <Box flexDirection="column">
        {rows.map((row, i) => (
          // A row of sibling Texts, not nested ones: a nested Text drops dimColor.
          <Box key={`l${i}`} flexDirection="row">
            {row.map((span, j) => (
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
            ))}
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
}
