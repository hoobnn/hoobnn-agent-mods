# hud

claude-hud 0.10.0 rebuilt as a Claude Code mod: the same lines, drawn below the prompt (beside the hint line, where the statusline sat) or in the band above it.

## Layout

- `hooks/register.tsx`: the mod. Builds the statusline stdin claude-hud expects from `$` (session, usage, settings, repo, turn steps) and the transcript, runs claude-hud, and draws its lines.
- `hooks/transcript-feed.ts`: reads the transcript once and incrementally (only appended lines, gated on its size) for the whole mod. claude-hud's own `Parser` gets every line, and so does a small reader for the stdin fields `$` does not answer: `session_name` and `prompt_cache`.
- `hooks/hud/`: claude-hud's `src/` (MIT, see `LICENSE.claude-hud`), kept close to upstream. Local changes:
  - `index.ts`: `main(source)` takes the stdin from the mod; errors and setup notes go to the render sink; the run-as-script block is gone.
  - `render/index.ts`: lines go to a sink (`setRenderSink`, `emitLine`) instead of `console.log`.
  - `transcript.ts`: `Parser` is exported and `setTranscriptProvider` lets the mod answer `parseTranscript`.
  - `git-runner.ts`: git runs through `$.process.run`; the Windows worker is gone.
  - `config.ts`: the bounded config read is one `readFileSync`; O_NOFOLLOW becomes an lstat check.
  - `claude-config-dir.ts`: `getHudCacheDir` (`plugins/claude-hud-mod`), used by `speed.ts` and `daily-cost.ts`, so caches never collide with a statusline copy.
- `hooks/shims/`: the Node APIs claude-hud imports, over `$`. Synchronous reads answer from facts fetched before the pass; a miss is fetched and the pass re-run (`host.ts`). Writes are held and written once a pass completes.
- `hooks/ansi.ts`: SGR escapes to styled spans.
- `hooks/extras.ts`: what the mod adds (below), as pure helpers: thresholds, the usage forecast, the spend history, the git counts, the extras row and the chime.

## Config

claude-hud's own files: `~/.claude/plugins/claude-hud/config.json` and `~/.claude/claude-hud.json`, so `/claude-hud:configure` keeps working. Mod options (`/config`, or `pluginConfigs.hud.options` in settings): `position` (`below` the prompt, or `above` it as a band), `extraCmd` (claude-hud's `--extra-cmd`), `debug` (registers `mcp__hud__hud_debug`), and the options of the additions below.

## Derived rather than reported

Claude Code's statusline stdin carries these; the mod API does not, so the mod works them out:

- `prompt_cache`: the clock restarts at the last main-thread request (from `turn.step`, else the last main-thread response in the transcript) and runs for the TTL the last cache write used (`1h` when it wrote the 1-hour tier, else `5m`). `hit_ratio` is cache-read input over all main-thread input, across the session.
- `session_name`: the transcript's `/rename` title, else its generated title, else its slug.
- `workspace.repo`: parsed from `$.session.repo()`'s remote URL.
- `output_style`: `outputStyle` from settings.
- Before the session's first model request, `current_usage` is the engine's context total, uncached, and the effort is `effortLevel` from settings; both arrive with the first `turn.step` and are kept in session state across reloads.
- `total_api_duration_ms` counts the requests seen since the mod was enabled in the session.

## Added

- Remote Control: ` │ RC` at the end of the first line while the session's Remote Control is on, linked to the session on claude.ai, with how many remote clients are attached. The engine records the bridge as `bridgeSessionId` in `~/.claude/sessions/<pid>.json` (found by session id) and the mod API does not report it, so the file is read every 3 s and the HUD redrawn on a change; clients are counted from `session.attach` / `session.detach`.

- An extras row under claude-hud's lines, each part shown only when it has something to say:
  - `✎` the task in one line: a `$.model.fork` of the conversation (served from the prompt cache) after the first turn and every `summaryEveryTurns` turns (default 5; 0 off).
  - Usage forecast (`showForecast`): when the 5-hour or 7-day limit runs out at the rate used so far, if that comes before it resets.
  - Today's spend across sessions against `dailyBudgetUsd` (0 off), from claude-hud's daily-cost ledger; yellow from 80%, red past it.
  - The last 7 days' spend as a sparkline and the streak of days in use (`showHistory`), kept in the mod's store for 60 days.
  - `⚠` uncommitted paths at or past `gitDirtyWarn` (default 20) and unpushed commits at or past `gitAheadWarn` (default 5); 0 turns either off.
- Alerts: a toast when context use reaches each of `contextAlerts` (default `80,90`), and the 5-hour or 7-day limit each of `usageAlerts`; once per threshold, again only after the gauge drops 5 points below it (a `/compact`, a reset).
- Turn done: a turn of the main thread that ran `notifyAfterSeconds` or longer (default 60; 0 off) ends with a toast and, with `notifySound`, a short chime (macOS).
- `/hud detail` opens (and closes) a pane: each tool's calls, total and average time and failures this session; subagents; todos; today's and the week's spend.

## Not carried over

- OSC 8 `file://` links (the project path): a `Link` takes https only, so the text is kept and the link dropped. https links (a GitHub branch) stay clickable.
- `worktree` (a `--worktree` session's name, path and branch): not in the mod API.

## Updating from upstream

Copy the new `src/` over `hooks/hud/` (minus `windows-git-worker.ts`), re-point `node:*` imports at `../shims/*.js` (`node:fs/promises` at `fs_promises.js`), re-apply the changes listed above, then run `scripts/check.sh claude-code/hud` from the repo root. Compare against upstream by feeding the stdin `mcp__hud__hud_debug` reports to `node <claude-hud>/dist/index.js`.
