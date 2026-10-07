// The statusline's stdin claude-hud reads, built from what the session reports
// and the transcript. The session is read through closures register.tsx hands
// in (`SessionApi`, `Io`): the engine follows `$` only within the hooks
// module's own file.

// First: claude-hud's modules read Node's globals as they load.
import './shims/globals.js'

import type { SessionRepo, SessionUsage, SessionVersion } from 'claude-code'

import type { Remote, StepInfo } from '../types'
import type { GitRepoIdentity } from './hud/git.js'
import type { StdinData } from './hud/types.js'
import { live } from './live.js'
import { processShim } from './shims/globals.js'
import { getClaudeConfigJsonPath } from './hud/claude-config-dir.js'
import { setHostClock } from './hud/render/time.js'
import { type Io, markStable } from './shims/host.js'
import { homedir, sysinfo } from './shims/os.js'
import { basename, setCwdProvider } from './shims/path.js'
import { pullTranscript, transcriptMeta } from './transcript-feed.js'

type CurrentUsage = NonNullable<NonNullable<StdinData['context_window']>['current_usage']>

/** The session reads the stdin is built from, closed over `$` in session.start. */
export type SessionApi = {
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

type ModelScoped = NonNullable<StdinData['model_scoped']>[number]

// Claude Code's own reader drops its cached usage after an hour.
const USAGE_CACHE_TTL_MS = 60 * 60 * 1000
// The legacy per-model weekly windows, before the endpoint listed them in `limits`.
const LEGACY_SCOPED: Record<string, string> = { seven_day_opus: 'Opus', seven_day_sonnet: 'Sonnet' }

/** `2026-10-09T15:59:59.754523+00:00` (the endpoint writes microseconds) → ISO with milliseconds. */
function isoOf(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const ms = Date.parse(value.replace(/(\.\d{3})\d+/, '$1'))
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}

/** Claude Code's own cache of its usage endpoint: when it was fetched and the model-scoped weekly windows. */
type UsageCache = { fetchedAtMs: number; windows: ModelScoped[] }

/**
 * The model-scoped weekly windows (Fable's) in `cachedUsageUtilization` in
 * .claude.json, which Claude Code keeps from its usage endpoint: `$` reports
 * only the 5-hour and 7-day windows.
 */
export function usageCacheOf(text: string): UsageCache | null {
  let cached: { fetchedAtMs?: unknown; utilization?: Record<string, unknown> } | undefined
  try {
    cached = (JSON.parse(text) as { cachedUsageUtilization?: typeof cached }).cachedUsageUtilization
  } catch {
    return null
  }
  if (typeof cached?.fetchedAtMs !== 'number') return null
  const usage = cached.utilization ?? {}
  const windows = new Map<string, ModelScoped>()
  const add = (name: unknown, percent: unknown, resetsAt: unknown) => {
    if (typeof name !== 'string' || !name || typeof percent !== 'number' || windows.has(name)) return
    windows.set(name, { display_name: name, utilization: percent, resets_at: isoOf(resetsAt) })
  }
  for (const limit of Array.isArray(usage.limits) ? usage.limits : []) {
    const l = limit as { kind?: unknown; percent?: unknown; resets_at?: unknown; scope?: { model?: { display_name?: unknown } } | null }
    if (l?.kind === 'weekly_scoped') add(l.scope?.model?.display_name, l.percent, l.resets_at)
  }
  for (const [key, name] of Object.entries(LEGACY_SCOPED)) {
    const w = usage[key] as { utilization?: unknown; resets_at?: unknown } | null | undefined
    if (w) add(name, w.utilization, w.resets_at)
  }
  return { fetchedAtMs: cached.fetchedAtMs, windows: [...windows.values()] }
}

/** The windows still current: none once the cache is over an hour old, none whose reset has passed. */
export function currentScoped(cache: UsageCache | null, now: number): ModelScoped[] {
  if (!cache || now - cache.fetchedAtMs > USAGE_CACHE_TTL_MS) return []
  return cache.windows.filter(w => !w.resets_at || Date.parse(w.resets_at) > now)
}

// .claude.json is large and changes often for other reasons: parsed again only when it changed.
let usageCache: { path: string; mtimeMs: number; cache: UsageCache | null } | null = null

async function modelScoped(io: Io, now: number): Promise<ModelScoped[]> {
  const path = getClaudeConfigJsonPath(homedir())
  try {
    const { mtimeMs } = await io.stat(path)
    if (usageCache?.path !== path || usageCache.mtimeMs !== mtimeMs) {
      usageCache = { path, mtimeMs, cache: usageCacheOf(await io.read(path)) }
    }
    return currentScoped(usageCache.cache, now)
  } catch {
    return []
  }
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

export function claudeConfigDir(): string {
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

export async function buildStdin(io: Io, session: SessionApi): Promise<StdinData> {
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
    model_scoped: usage.rateLimits.length > 0 ? await modelScoped(io, Date.now()) : [],
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

export async function loadHostFacts(io: Io, extraCmd: string): Promise<void> {
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
  await loadHostClock(io, platform)
}

/** `zh_CN.UTF-8`, `en_US@calendar=gregorian` → `zh-CN`, `en-US`; undefined when Intl doesn't know it. */
export function localeTag(raw: string | undefined): string | undefined {
  const tag = raw?.trim().split(/[.@]/)[0]?.replace(/_/g, '-')
  if (!tag || tag === 'C' || tag === 'POSIX') return undefined
  try {
    return Intl.DateTimeFormat.supportedLocalesOf([tag])[0]
  } catch {
    return undefined
  }
}

// macOS keeps the region and the 24-hour switch in its preferences, not in LANG.
async function loadHostClock(io: Io, platform: string): Promise<void> {
  const env = processShim.env
  if (platform !== 'darwin') {
    setHostClock(localeTag(env.LC_ALL || env.LC_TIME || env.LANG), 'auto')
    return
  }
  const read = (key: string) =>
    io.run(['/usr/bin/defaults', 'read', '-g', key]).then(
      out => (out.exitCode === 0 ? out.stdout.trim() : undefined),
      () => undefined,
    )
  const [locale, force24, force12] = await Promise.all([
    read('AppleLocale'),
    read('AppleICUForce24HourTime'),
    read('AppleICUForce12HourTime'),
  ])
  setHostClock(localeTag(locale), force24 === '1' ? 'h23' : force12 === '1' ? 'h12' : 'auto')
}
