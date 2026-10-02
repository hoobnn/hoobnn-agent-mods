// One pass of the HUD: claude-hud's lines from the stdin, the Remote Control
// label on the first, and today's spend from claude-hud's ledger.

// First: claude-hud's modules read Node's globals as they load.
import './shims/globals.js'

import type { HudLine } from '../types'
import { parseAnsi } from './ansi.js'
import { dimSeparators, parseGitStatus } from './extras.js'
import { getCostTotals } from './hud/daily-cost.js'
import { main } from './hud/index.js'
import { setRenderSink } from './hud/render/index.js'
import type { StdinData } from './hud/types.js'
import { fitColumns, live } from './live.js'
import { rcSpans, remoteControl } from './remote.js'
import { processShim } from './shims/globals.js'
import { type Io, runWithFacts } from './shims/host.js'
import { buildStdin, type SessionApi } from './stdin.js'

/** Changed paths and unpushed commits, or null outside a repo. */
export async function gitCounts(io: Io, cwd: string): Promise<{ dirty: number; ahead: number } | null> {
  const out = await io
    .run(['git', 'status', '--porcelain=v2', '--branch'], { cwd, timeoutMs: 3_000 })
    .catch(() => null)
  return out && out.exitCode === 0 ? parseGitStatus(out.stdout) : null
}

export type Rendered = { rows: HudLine[]; stdin: StdinData; todayUsd: number | null }

export async function renderHud(io: Io, session: SessionApi): Promise<Rendered> {
  const columns = fitColumns()
  if (columns) processShim.env.COLUMNS = String(columns)
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
