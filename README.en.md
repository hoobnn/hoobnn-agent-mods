# hoobnn-agent-mods: Claude Code statusline HUD and plugins

[简体中文](README.md) · **English**

Mods, extensions and plugins I've written for coding-agent harnesses, one folder per harness. What's usable today is mainly four Claude Code mods: a statusline HUD, a Tailscale node band, a Hitokoto band and spinner animations.

| Folder | Harness | What goes there |
| --- | --- | --- |
| `claude-code/` | [Claude Code](https://code.claude.com) | Mods (function-hook plugins); each subfolder loads with `claude --plugin-dir`, except `kit/`, the code they share |
| `pi/` | [pi](https://github.com/badlogic/pi-mono) | Extensions |
| `deepseek/` | [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) | `dsh` plugins |
| `shared/` | any | Logic more than one port uses |
| `scripts/` | | Checks and local install helpers |

## Claude Code mods

| Mod | What it does |
| --- | --- |
| [`hud`](claude-code/hud) | [claude-hud](https://github.com/jarrodwatts/claude-hud) 0.10.0 as a mod: model, project, git, context, usage, tools, agents and todos, above or below the prompt. On top of that: a turn-done alert for long turns, context and limit alerts, a forecast of when a limit runs out, a daily budget, the last 7 days' spend, a nag about uncommitted changes, a one-line task summary, a `/hud detail` pane, and 12 themes to switch between live (neon, rainbow gradient, emoji, anime ones with a kaomoji mascot: sakura, kawaii, mecha, shonen; Nerd Font and powerline) |
| [`ts-band`](claude-code/ts-band) | Tailscale node state in a band above the prompt: one short mark while every node is direct, otherwise only the nodes on a relay or DERP (yellow) or offline (red), with a toast when a node comes up or goes down |
| [`hitokoto`](claude-code/hitokoto) | A line from [Hitokoto (一言)](https://hitokoto.cn) above the prompt, refreshed on a timer, once a day, per session or per prompt |
| [`spinner`](claude-code/spinner) | Animations and a companion pet while the model works: a scene above the prompt (pixel-art: a shoot-em-up, Claude's Clawd, a dot-eater, an electric mouse, a robot cat, a rainbow cat; plus cat, bunny, sakura, mecha, neon, dino, ocean and Matrix rain); a Codex-style pet that changes pose for thinking, tools and replies, whose bubble names the tool running and flags a permission prompt (never repeating the spinner line), stays between turns, levels up and takes a pat (click or `/spinner pet`); a three-second confetti finale with the turn's time; fourteen themes, switched and previewed with `/spinner` |

Install them from this repo's marketplace:

```sh
claude plugin marketplace add hoobnn/hoobnn-agent-mods
claude plugin install hud@hoobnn-agent-mods
claude plugin install ts-band@hoobnn-agent-mods
claude plugin install hitokoto@hoobnn-agent-mods
claude plugin install spinner@hoobnn-agent-mods
```

Options (`hud`'s `position`, `theme`, `dailyBudgetUsd` and `summaryEveryTurns`, `ts-band`'s `nodes` and `hideOffline`, `hitokoto`'s `refreshMode` and `categories`, `spinner`'s `theme`, `stage`, `celebrate` and `companion`, …) are rows in `/config`, or `pluginConfigs` in `~/.claude/settings.json`. `/config` is the one place a mod's settings live: what a slash command changes (`/hud theme neon`, `/ts off`, `/spinner stage off`) it writes there, and every mod has a `visible` row that `/hud`, `/ts`, `/hitokoto` and `/spinner` `off` / `on` set. Each mod's folder has its own README with the details.

`spinner` at work (the `clawd` theme through a turn, the companion's bubble following the tools, then the finale; every theme's GIF is in [`claude-code/spinner`](claude-code/spinner)):

![spinner, clawd theme](claude-code/spinner/assets/clawd.gif)

![spinner, thunder theme](claude-code/spinner/assets/thunder.gif)

All four mods speak English, Simplified Chinese, Traditional Chinese, Japanese, Korean, Spanish, French, German, Brazilian Portuguese and Russian. `hud` follows `language` in claude-hud's config; `ts-band`, `hitokoto` and `spinner` each have a `language` option whose default, `auto`, follows Claude Code's `language` setting, then the system locale, then English.

### Developing

- Run a working copy over the installed one: `claude --plugin-dir claude-code/<mod>`. It's watched, so a save reloads the hooks module.
- Each mod reads its options once in `hooks/config.ts` (a typed `Config`); `hooks/register.tsx` holds the hooks, and whatever calls `$` (the engine follows `$` only within that file).
- Code the mods share lives in `claude-code/kit/` (language, option readers, band stacking, `/config` writes). An installed mod reaches nothing outside its folder, so `scripts/sync-kit.sh` copies the kit files each mod imports into its `hooks/kit/`: edit `claude-code/kit/`, then run it; `scripts/check.sh` fails on a stale copy.
- `scripts/check.sh` checks the kit copies, then validates, tests and type-checks every mod. The mod API is early access, so run it after a Claude Code update too. `tsc` needs the types Claude Code puts in `.claude-plugin/types/` the first time it loads the mod.
- `bun scripts/spinner-shots.ts` renders `spinner`'s GIFs and stills again from its own frame tables (needs ffmpeg and Playwright's Chromium).
- Release: bump `version` in the mod's `plugin.json` and its entry in `.claude-plugin/marketplace.json`, commit, then `claude plugin tag claude-code/<mod> --push` (tags look like `<mod>--v<version>`). Installs pick it up with `claude plugin marketplace update hoobnn-agent-mods && claude plugin update <mod>@hoobnn-agent-mods`.

## License

MIT. `claude-code/hud/hooks/hud` is claude-hud's source under its own MIT license (`claude-code/hud/LICENSE.claude-hud`).
