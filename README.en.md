<div align="center">

# hoobnn-agent-mods

A statusline HUD for Claude Code, plus a task progress bar, a turn receipt, spinner animations and more.

[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

[简体中文](README.md) · **English**

</div>

![hud, neon theme](claude-code/hud/assets/themes/neon.png)

[`hud`](claude-code/hud/README.en.md) is [claude-hud](https://github.com/jarrodwatts/claude-hud) rebuilt as a Claude Code mod: model, project, git, context, usage, the running tools, subagents and todos at a glance beside the prompt, in a band above it or below it where the statusline sat, in the terminal and in Claude Desktop. On top of claude-hud it adds quota alerts, a usage forecast, a daily budget, a one-line task summary, a `/hud detail` pane and twelve themes.

## Quick start

```sh
claude plugin marketplace add hoobnn/hoobnn-agent-mods
claude plugin install hud@hoobnn-agent-mods
```

Once installed, the HUD sits above the prompt. `/hud theme` picks a theme, `/hud detail` opens the detail pane, and `/hud off` / `/hud on` hide or show it. An existing claude-hud config (`~/.claude/plugins/claude-hud/config.json`) carries over.

## What the HUD shows

- **Everything claude-hud shows**: model and effort, project and git branch with its changes, context and usage gauges, the running tools, subagents and todos.
- **Warnings before you hit a wall**: toasts at the context and quota levels you pick; when a limit runs out at the current pace; per-model weekly limits such as Fable's, with the same alerts; the tokens left before auto-compaction.
- **Spend**: what the next message re-caches once the prompt cache has expired; a turn that grew the context a lot, by how much, beside a sparkline of the recent turns (`上一轮 +98k ▂▁█`); today's spend against a daily budget.
- **The task at a glance**: a one-line task summary every few turns; the `/hud detail` pane with each tool's calls and time, the last turns' time and cost, subagents, todos, and today's and the week's spend.
- **And**: a warning on too many uncommitted changes or unpushed commits; a turn-done toast for long turns (with an optional chime on macOS); the Remote Control state.
- **Twelve themes**: `classic`, `neon`, `rainbow`, `emoji`, `sakura`, `kawaii`, `mecha`, `shonen`, `tokyo-night`, `matrix`, `nerd` and `powerline`; the anime ones bring a kaomoji mascot whose face follows the session.

<details>
<summary>All twelve themes</summary>

![hud, all twelve themes](claude-code/hud/assets/themes/gallery.png)

</details>

Every command, option and implementation detail is in [`claude-code/hud`](claude-code/hud/README.en.md).

## More mods

| Mod | What it does |
| --- | --- |
| [`todo-bar`](claude-code/todo-bar/README.en.md) | A task progress bar: the task running, how long it has run, how much is done and what its subagents are doing; reads the TodoWrite / Task tools' results, no tokens |
| [`receipt`](claude-code/receipt/README.en.md) | A turn receipt: one row saying what the turn changed (files, lines), ran and how much failed, flagging code changed with no test run after it, with a pane that replays each edit's diff, plus an alert when Claude goes in circles; no tokens |
| [`spinner`](claude-code/spinner/README.en.md) | Animations and a companion pet: pixel-art scenes (a shoot-em-up, Clawd, a dot-eater, a rainbow cat, a spectrum of the sound your Mac plays; 15 themes), a pet that follows what Claude does and levels up, and confetti when a turn ends |
| [`ts-band`](claude-code/ts-band/README.en.md) | Tailscale node status: one small mark while every node is direct, the relayed or offline ones listed otherwise, with a toast when a node comes up or goes down |
| [`hitokoto`](claude-code/hitokoto/README.en.md) | A [Hitokoto (一言)](https://hitokoto.cn) quote and its source above the prompt, refreshed on a timer, once a day, per session or per prompt |

| `todo-bar` | `receipt` |
| --- | --- |
| ![todo-bar](claude-code/todo-bar/assets/preview.png) | ![receipt](claude-code/receipt/assets/preview.png) |
| `ts-band` | `hitokoto` |
| ![ts-band](claude-code/ts-band/assets/preview.png) | ![hitokoto](claude-code/hitokoto/assets/preview.png) |

`spinner` (the `clawd` theme through a turn, the companion's bubble following the tools, then the finale; every theme's GIF is in [`claude-code/spinner`](claude-code/spinner/README.en.md)):

![spinner, clawd theme](claude-code/spinner/assets/clawd.gif)

<sub>Each shot is rendered from what the mod itself draws.</sub>

## Install

Add this repo's marketplace, then install the mods you want; each installs on its own and works out of the box:

```sh
claude plugin marketplace add hoobnn/hoobnn-agent-mods
claude plugin install hud@hoobnn-agent-mods
claude plugin install todo-bar@hoobnn-agent-mods
claude plugin install receipt@hoobnn-agent-mods
claude plugin install spinner@hoobnn-agent-mods
claude plugin install ts-band@hoobnn-agent-mods
claude plugin install hitokoto@hoobnn-agent-mods
```

### Update

```sh
claude plugin marketplace update hoobnn-agent-mods
claude plugin update <mod>@hoobnn-agent-mods
```

### Uninstall

```sh
claude plugin uninstall <mod>@hoobnn-agent-mods
```

## Usage

Options (`hud`'s `position`, `theme`, `dailyBudgetUsd` and `summaryEveryTurns`, `ts-band`'s `nodes` and `hideOffline`, `hitokoto`'s `refreshMode` and `categories`, `spinner`'s `theme`, `stage`, `celebrate` and `companion`, …) are rows in `/config`, or `pluginConfigs` in `~/.claude/settings.json`. `/config` is the one place a mod's settings live: what a slash command changes (`/hud theme neon`, `/ts off`, `/spinner stage off`) it writes there, and every mod has a `visible` row that `/hud`, `/ts`, `/hitokoto`, `/spinner`, `/todos` and `/receipt` `off` / `on` set. Each mod's folder has its own README with the details.

All the mods speak English, Simplified Chinese, Traditional Chinese, Japanese, Korean, Spanish, French, German, Brazilian Portuguese and Russian. `hud` follows `language` in claude-hud's config; `ts-band`, `hitokoto`, `spinner`, `todo-bar` and `receipt` each have a `language` option whose default, `auto`, follows Claude Code's `language` setting, then the system locale, then English.

## Repository layout

The six Claude Code mods live in `claude-code/`. Extensions for other coding-agent harnesses go in one folder per harness; for now `pi/` and `deepseek/` hold only a README and no extensions yet.

| Folder | Harness | What goes there |
| --- | --- | --- |
| `claude-code/` | [Claude Code](https://code.claude.com) | Mods (function-hook plugins); each subfolder loads with `claude --plugin-dir`, except `kit/`, the code they share |
| `pi/` | [pi](https://github.com/earendil-works/pi) | Extensions |
| `deepseek/` | [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) | `dsh` plugins |
| `shared/` | any | Logic more than one port uses |
| `scripts/` | | Check, kit sync and screenshot scripts |

## Development

- Run a working copy over the installed one: `claude --plugin-dir claude-code/<mod>`. It's watched, so a save reloads the hooks module.
- Each mod reads its options once in `hooks/config.ts` (a typed `Config`); `hooks/register.tsx` holds the hooks, and whatever calls `$` (the engine follows `$` only within that file).
- Code the mods share lives in `claude-code/kit/` (language, option readers, band stacking, `/config` writes). An installed mod reaches nothing outside its folder, so `scripts/sync-kit.sh` copies the kit files each mod imports into its `hooks/kit/`: edit `claude-code/kit/`, then run it; `scripts/check.sh` fails on a stale copy.
- `scripts/check.sh` checks the kit copies, then validates, tests and type-checks every mod, and prints each mod's reach as [awesome-claude-code-mods](https://github.com/karanb192/awesome-claude-code-mods) grades it (L0 draws, L1 reads, L2 writes or runs, L3 network); a mod past its level in `scripts/reach.txt` fails. The mod API is early access, so run it after a Claude Code update too. `tsc` needs the types Claude Code puts in `.claude-plugin/types/` the first time it loads the mod.
- `bun scripts/spinner-shots.ts` renders `spinner`'s GIFs and stills again from its own frame tables (needs ffmpeg and Playwright's Chromium).
- `bun scripts/mod-shots.ts [<mod> ...]` renders the previews of `ts-band`, `hitokoto`, `todo-bar` and `receipt` again: it drops `scripts/shots/<mod>.tsx` into the mod's `tests/` for one run, takes the tree the band really drew, and shoots it in a terminal window (needs Playwright's Chromium).
- Release: bump `version` in the mod's `plugin.json` and its entry in `.claude-plugin/marketplace.json`, commit, then `claude plugin tag claude-code/<mod> --push` (tags look like `<mod>--v<version>`). Installs pick it up with the commands under Update.

## License

[MIT](LICENSE) © 2026 hoobnn. Free to use, modify and distribute, provided the copyright notice is kept.

`claude-code/hud/hooks/hud` is claude-hud's source under its own MIT license (`claude-code/hud/LICENSE.claude-hud`).
