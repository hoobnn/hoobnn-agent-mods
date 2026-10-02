# hud

claude-hud 0.9.0 rebuilt as a Claude Code mod: the same lines, drawn in the band above the prompt instead of the status line.

## Layout

- `hooks/register.tsx`: the mod. Builds the statusline stdin claude-hud expects from `$` (session, usage, settings, turn steps), runs claude-hud, and draws its lines.
- `hooks/hud/`: claude-hud's `src/` (MIT, see `LICENSE.claude-hud`), kept close to upstream. Local changes:
  - `transcript.ts`: the parse is incremental (state per transcript, only appended lines read), replacing the stream read and the disk cache.
  - `git-runner.ts`: git runs through `$.process.run`; the Windows worker is gone.
  - `config.ts`: the bounded config read uses `readFileSync`; O_NOFOLLOW becomes an lstat check.
  - `render/index.ts`: lines go to a sink (`setRenderSink`) instead of `console.log`.
  - `index.ts`: the run-as-script block is gone.
  - `claude-config-dir.ts`: `getHudCacheDir` (`plugins/claude-hud-mod`) so caches never collide with the statusline copy.
- `hooks/shims/`: the Node APIs claude-hud imports, over `$`. Synchronous reads answer from facts fetched before the pass; a miss is fetched and the pass re-run (`host.ts`). Writes are held and written once a pass completes.
- `hooks/ansi.ts`: SGR escapes to styled spans.

## Config

claude-hud's own files: `~/.claude/plugins/claude-hud/config.json` and `~/.claude/claude-hud.json`, so `/claude-hud:configure` keeps working. Mod options (`/config`): `position` (`above` the prompt as a band, or `below` it beside the hint line), `extraCmd` (claude-hud's `--extra-cmd`), `debug` (registers `mcp__hud__hud_debug`).

## Not carried over

- OSC 8 file links: a `Link` takes https only, so the text is kept and the link dropped.
- `rate_limits.model_scoped`: `$.session.usage()` has no per-model windows (an external usage snapshot still feeds them).
- Before the session's first model request, `current_usage` is the engine's context total, uncached, and the effort is `effortLevel` from settings; both arrive with the first `turn.step` and are kept in session state across reloads.
- `total_api_duration_ms` counts the requests seen since the mod was enabled in the session.

## Updating from upstream

Copy the new `src/` over `hooks/hud/`, re-point `node:*` imports at `../shims/*.js`, re-apply the changes listed above, then `claude plugin validate`, `claude plugin test` and `tsc`.
