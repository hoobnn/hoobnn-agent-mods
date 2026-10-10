<div align="center">

# hud: a statusline HUD for Claude Code

[简体中文](README.md) · **English**

</div>

[claude-hud](https://github.com/jarrodwatts/claude-hud) 0.10.0 rebuilt as a Claude Code mod: model, project, git, context, usage, tools, subagents and todos at a glance, below the prompt (beside the hint line, where the statusline sat) or in a band above it. On top of claude-hud it adds alerts, a usage forecast, a daily budget, a one-line task summary, a detail pane and twelve themes you switch live.

![hud, neon theme](assets/themes/neon.png)

## Features

- Everything claude-hud shows: model and effort, project and git branch with its changes, context and usage gauges, the running tools, subagents and todos.
- Warnings before you hit a wall: toasts at the context and quota levels you pick; when a limit runs out at the current pace (the 5-hour limit at the last hour's pace); per-model weekly limits such as Fable's, with the same alerts and forecast; the tokens left before auto-compaction; what the next message re-caches once the prompt cache has expired; a turn that grew the context a lot, by how much and beside a sparkline of the recent turns (`上一轮 +98k ▂▁█`), so the turn that filled the window stands out; and too many uncommitted changes or unpushed commits.
- Spend: today's spend against a daily budget, and the last 7 days as a sparkline.
- A one-line task summary, and the `/hud detail` pane: each tool's calls and time, the last turns' time, cost and context growth, subagents, todos, and today's and the week's spend.
- Twelve themes: neon, rainbow, emoji, anime themes with a kaomoji mascot (sakura, kawaii, mecha, shonen), Tokyo Night, Matrix, Nerd Font and powerline.
- Turn-done toast for long turns (with an optional chime on macOS), and the Remote Control state.

## Install

```sh
claude plugin marketplace add hoobnn/hoobnn-agent-mods
claude plugin install hud@hoobnn-agent-mods
```

It reads claude-hud's own config files (`~/.claude/plugins/claude-hud/config.json` and `~/.claude/claude-hud.json`), so an existing claude-hud setup carries over and `/claude-hud:configure` keeps working.

## Themes

`/hud theme <name>` switches live; `/hud theme` alone asks which in a dialog (the next four offered, any other typed under Other; dismissed, or under `-p`, it lists them with a sample); `/hud theme next` cycles, and `/hud theme reset` goes back to `classic`. The choice is written to the `theme` option in `/config`, so later sessions keep it.

| Theme | Look |
| --- | --- |
| `classic` | claude-hud as it ships |
| `neon` | cyberpunk: neon truecolor, `⬢ ◆ ◈ ⚡`, `▰▱` bars, ` ❯ ` separators |
| `rainbow` | a hue per element, filled bar cells and the model name along a rainbow gradient |
| `emoji` | `🤖 📂 🌿 🧠 ⚡ 📅 ⏳ ✅` |
| `sakura` | pastel pink, `🌸 🎀 🍡 💗`, `✿` bars, a kaomoji mascot `(◕‿◕)♡` |
| `kawaii` | pastel, `「Opus」`, `●○` bars, a cat mascot `ฅ^•ω•^ฅ` |
| `mecha` | purple, green and orange, `UNIT·Opus◤`, `SYNC` / `PWR` gauges, a robot mascot `[•_•]` |
| `shonen` | red-orange-gold, `🔥 ⭐ 🍥 💥`, gradient bars, a mascot `(ง •̀_•́)ง` |
| `tokyo-night` | the Tokyo Night palette, quiet glyphs |
| `matrix` | green on black, `▮▯` bars, ` ┊ ` separators |
| `nerd` | Nerd Font symbols (needs a Nerd Font) |
| `powerline` | Nerd Font symbols on powerline segments (needs a Nerd Font) |

Every theme on the same sample session: [assets/themes/gallery.png](assets/themes/gallery.png); one still per theme in `assets/themes/<theme>.png`.

The anime themes' mascot changes face with the state: calm, busy while a tool runs, worried from 70% context (or 90% quota), panicking from 85%, knocked out when a limit is reached. `showMascot` turns it off.

- Palette: the theme's colors go over claude-hud's `colors`; a color set in claude-hud's own config (off its default) stays.
- Width: glyphs are drawn by claude-hud, so its wrapping measures them; separators are no wider than ` │ `; powerline adds 2 cells to a row, taken off the columns claude-hud and the extras row fit to. Emoji are default-presentation ones only (no U+FE0F).
- Known limit: claude-hud keeps a `[Model | Provider]` badge (Bedrock, Vertex) whole by its leading `[`; themes that drop the brackets lose that, so at a narrow width such a badge can wrap at ` | `.

## Commands

- `/hud`: shows or hides the HUD; `/hud off` and `/hud on` set it (so does the HUD button in the prompt footer).
- `/hud theme [name|next|reset]`: switches the theme.
- `/hud detail`: opens or closes the detail pane. It works while Claude is busy too.

## Options

Set them in `/config`, or under `pluginConfigs` in `~/.claude/settings.json`:

| Option | What it does | Default |
| --- | --- | --- |
| `visible` | Show the HUD | on |
| `footerButton` | Show the HUD toggle button in the prompt footer | on |
| `position` | `above` the prompt as a band, or `below` it where the statusline sat | `above` |
| `theme` | The theme | `classic` |
| `showMascot` | Show the kaomoji mascot in the anime themes | on |
| `contextAlerts` | Toast when context use reaches these percentages, comma separated (`80,90`); empty turns it off | empty |
| `usageAlerts` | Toast when the 5-hour or 7-day quota reaches these percentages; empty turns it off | empty |
| `showForecast` | Show when a limit runs out, if at the current pace that comes before it resets | on |
| `compactWarnPercent` | Once the context is this percentage of the way to auto-compaction, show the tokens left; 0 off | 60 |
| `coldCacheTokens` | Once the prompt cache has expired, show what the next message re-caches when the context holds at least this many tokens; 0 off | 20000 |
| `turnGrowthTokens` | When a turn grew the context by at least this many tokens, show by how much beside a sparkline of the recent turns; 0 off | 20000 |
| `dailyBudgetUsd` | Daily budget in US dollars, with today's spend against it; 0 off | 0 |
| `showHistory` | Show the last 7 days' spend as a sparkline and the streak of days in use | off |
| `summaryEveryTurns` | Write the one-line task summary after the first turn and every this many turns (served from the prompt cache); 0 off | 5 |
| `notifyAfterSeconds` | Toast when a turn that ran at least this many seconds ends; 0 off | 0 |
| `notifySound` | A chime with that toast (macOS) | on |
| `gitDirtyWarn` | Warn at this many uncommitted paths; 0 off | 20 |
| `gitAheadWarn` | Warn at this many unpushed commits; 0 off | 5 |
| `showAgents` | Show claude-hud's subagent lines (Claude Code already lists running subagents itself, so off by default) | off |
| `extraCmd` | claude-hud's `--extra-cmd`: a shell command whose output shows as a label (needs `CLAUDE_HUD_ALLOW_EXTRA_CMD=1`) | empty |
| `debug` | Register the `mcp__hud__hud_debug` debug tool | off |

The language follows `language` in claude-hud's config file (`en`, `zh-Hans`, `zh-Hant`, `ja`, `ko`, `es`, `fr`, `de`, `pt-BR`, `ru`), and what the mod adds (alerts, the detail pane, `/hud`'s replies, the task summary) follows it too.

## More mods

[hoobnn-agent-mods](../../README.en.md) also has a task progress bar (`todo-bar`), a turn receipt (`receipt`), spinner animations with a pet (`spinner`), a Tailscale node band (`ts-band`) and a Hitokoto quote band (`hitokoto`).

## Development

### Derived rather than reported

Claude Code's statusline stdin carries these; the mod API does not, so the mod works them out:

- `prompt_cache`: the clock restarts at the last main-thread request (from `turn.step`, else the last main-thread response in the transcript) and runs for the TTL the last cache write used (`1h` when it wrote the 1-hour tier, else `5m`). `hit_ratio` is cache-read input over all main-thread input, across the session.
- `model_scoped` (the model-scoped weekly limits, such as Fable's): neither the mod API nor the statusline carries them, so they come from Claude Code's own cache of its usage endpoint, `cachedUsageUtilization` in `.claude.json` (read again only when the file changes, nothing once it is over an hour old, as Claude Code's own reader). No request is made. claude-hud draws them beside the 5-hour and 7-day windows, with their pace.
- `session_name`: the transcript's `/rename` title, else its generated title, else its slug.
- `workspace.repo`: parsed from `$.session.repo()`'s remote URL.
- `output_style`: `outputStyle` from settings.
- Before the session's first model request, `current_usage` is the engine's context total, uncached, and the effort is `effortLevel` from settings; both arrive with the first `turn.step` and are kept in session state across reloads.
- `total_api_duration_ms` counts the requests seen since the mod was enabled in the session.

### Additions in detail

- Remote Control: ` │ ⇄ 远程控制` at the end of the first line while the session's Remote Control is on, linked to the session on claude.ai, then the attached clients by surface (`已连接 手机 · 网页/桌面×2`). The Claude app and claude.ai raise no `session.attach`, so a prompt or command arriving over Remote Control marks `已连接` until the bridge changes. The engine records the bridge as `bridgeSessionId` in `~/.claude/sessions/<pid>.json` (found by session id) and the mod API does not report it, so the file is read every 3 s and the HUD redrawn on a change; clients and their surfaces come from `session.attach` / `session.detach`.
- An extras row: appended to claude-hud's last line when both fit the width, else a line of its own under it; parts that do not fit leave it, a theme's mascot first, then the 7-day sparkline, and the `⚠` git warning last. Each part shows only when it has something to say:
  - `✎` the task in one line: a `$.model.fork` of the conversation (served from the prompt cache) after the first turn and every `summaryEveryTurns` turns. Skipped while the transcript holds a task list with work left (the list already says what the model is doing), and an older line steps aside meanwhile.
  - Usage forecast (`showForecast`): when the 5-hour, 7-day or a model-scoped weekly limit runs out, if that comes before it resets: the 5-hour limit at the last hour's pace once the session has ten minutes of readings, the weekly ones at the rate since their window began.
  - Tokens left before auto-compaction (`距自动压缩 42k`), once the context is `compactWarnPercent` of the way there. The threshold is Claude Code's own (`$.session.usage({ breakdown: 'summary' })`), read again when the context window changes.
  - Expired prompt cache (`缓存已过期，下条消息重写 120k`): once a cache the session used has expired, the context the next message writes to it again, when that is at least `coldCacheTokens`.
  - Context growth (`上一轮 +98k ▂▁█`): when the last turn grew the context by at least `turnGrowthTokens`, by how much, then a sparkline of the last 8 turns' growth (a compaction counts as none). Inspired by token-weather's per-turn chart.
  - Today's spend across sessions against `dailyBudgetUsd`, from claude-hud's daily-cost ledger; yellow from 80%, red past it.
  - The last 7 days' spend as a sparkline and the streak of days in use (`showHistory`); the spend is kept in the mod's store for 60 days either way.
  - `⚠` uncommitted paths at or past `gitDirtyWarn` and unpushed commits at or past `gitAheadWarn`.
- Alerts: a toast when context use reaches each of `contextAlerts`, and the 5-hour, 7-day or a model-scoped weekly limit each of `usageAlerts`; once per threshold, again only after the gauge drops 5 points below it (a `/compact`, a reset).
- Turn done: a turn of the main thread that ran `notifyAfterSeconds` or longer ends with a toast and, with `notifySound`, a short chime (macOS).
- `/hud detail` pane: each tool's calls, total and average time and failures this session; the last 8 turns with their time, cost and context growth; subagents; todos; today's and the week's spend.
- Prompt redraws: right after a compaction, and after `/model` (showing the new model before its first step).
- Display tweaks over claude-hud: the ` │ ` and ` | ` separators are dimmed; a running tool's file shows relative to the session directory (`◐ Read src/a.ts`); the session duration is `⏱ 12m` and the prompt cache `缓存 至 14:05`, without the emoji-width `⏱️`.

### Not carried over

- OSC 8 `file://` links (the project path): a `Link` takes https only, so the text is kept and the link dropped. https links (a GitHub branch) stay clickable.
- `worktree` (a `--worktree` session's name, path and branch): not in the mod API.

### Layout

- `hooks/register.tsx`: the hooks, and everything that calls `$` (the engine follows `$` only within this file): the session's start, the turn's events, `/hud`, the refresh loop, alerts, spend and summary, and the render hooks. The other modules get closures over `$` (`Io`, `SessionApi`).
- `hooks/config.ts`: the mod's options, read once into a typed `Config`.
- `hooks/stdin.ts`: builds the statusline stdin claude-hud expects from the session (usage, settings, repo, turn steps) and the transcript; the host facts claude-hud reads (env, platform, memory).
- `hooks/render.ts`: one pass: claude-hud's lines, the Remote Control label, today's spend; the git counts for the warning.
- `hooks/remote.ts`: Remote Control's bridge (from `sessions/<pid>.json`) and its label.
- `hooks/summary.ts`: the task summary's reply, cleaned to one line.
- `hooks/draw.tsx`: the rows (above or below the prompt) and the `/hud detail` pane, over the elements a render hook resolved.
- `hooks/live.ts`: what the module keeps between passes outside `$.state` (caches a reload finds again, the band's width, the debug tool's last pass) and the theme in use.
- `hooks/kit/`: copies of `claude-code/kit` (option readers, `/config` writes); edit the source and run `scripts/sync-kit.sh`.
- `hooks/transcript-feed.ts`: reads the transcript once and incrementally (only appended lines, gated on its size) for the whole mod. claude-hud's own `Parser` gets every line, and so does a small reader for the stdin fields `$` does not answer: `session_name` and `prompt_cache`.
- `hooks/hud/`: claude-hud's `src/` (MIT, see `LICENSE.claude-hud`), kept close to upstream. Local changes:
  - `index.ts`: `main(source)` takes the stdin from the mod; errors and setup notes go to the render sink; the run-as-script block is gone.
  - `render/index.ts`: lines go to a sink (`setRenderSink`, `emitLine`) instead of `console.log`.
  - `i18n/`: seven more locales (`ja`, `ko`, `es`, `fr`, `de`, `pt-BR`, `ru`, plus the `pt` alias) in `types.ts`, `index.ts` and new files; `getCanonicalLanguage` is exported; `isCjkLanguage` counts `ja` and `ko` too. `config.ts`'s `LANGUAGES` lists them.
  - `config.ts`: `setConfigPatch` lays the mod's options over the loaded config (`showAgents` off unless the mod's `showAgents` option is on).
  - `render/parts.ts`: `countLabel` lets a locale write a count as `Regeln: 3` (a `{n}` pattern) where `3 Regeln` would need plural agreement.
  - `transcript.ts`: `Parser` is exported and `setTranscriptProvider` lets the mod answer `parseTranscript`.
  - `git-runner.ts`: git runs through `$.process.run`; the Windows worker is gone.
  - `config.ts`: the bounded config read is one `readFileSync`; O_NOFOLLOW becomes an lstat check.
  - `render/theme.ts` (new): the glyphs claude-hud writes (`[` `]`, `git:(`, `◐ ✓ ▸`, `⚠ ▲`, `⏱`, `↑↓`, `⎇`) and a glyph before the Context, Usage, Weekly, cache and cost labels, read through `glyph()` / `iconLabel()` in `parts.ts`, `vcs.ts`, `activity.ts`, `usage.ts`, `lines.ts`, `labels.ts` and `colors.ts`. Its defaults are upstream's, so with no `setGlyphs` the output is unchanged.
  - `claude-config-dir.ts`: `getHudCacheDir` (`plugins/claude-hud-mod`), used by `speed.ts` and `daily-cost.ts`, so caches never collide with a statusline copy.
- `hooks/shims/`: the Node APIs claude-hud imports, over `$`. Synchronous reads answer from facts fetched before the pass; a miss is fetched and the pass re-run (`host.ts`). Writes are held and written once a pass completes.
- `hooks/ansi.ts`: SGR escapes to styled spans.
- `hooks/i18n.ts`: the mod's own strings in every language claude-hud has, with plural forms, money and percent written as each language writes them.
- `hooks/themes.ts`: the themes (palette, glyphs, separator, extras colors, powerline, gradient, mascot) and the span effects that apply them.
- `hooks/extras.ts`: what the mod adds, as pure helpers: thresholds, the usage forecast, the spend history, the git counts, the extras row and the chime.

### Updating from upstream

Copy the new `src/` over `hooks/hud/` (minus `windows-git-worker.ts`), re-point `node:*` imports at `../shims/*.js` (`node:fs/promises` at `fs_promises.js`), re-apply the changes listed above (re-route any new hardcoded glyph through `render/theme.ts`), then run `scripts/check.sh claude-code/hud` from the repo root. Compare against upstream by feeding the stdin `mcp__hud__hud_debug` reports to `node <claude-hud>/dist/index.js`.
