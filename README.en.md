# hoobnn-agent-mods: Claude Code statusline HUD and plugins

[简体中文](README.md) · **English**

Mods, extensions and plugins I've written for coding-agent harnesses, one folder per harness. What's usable today is mainly three Claude Code mods: a statusline HUD, a Tailscale node band and a Hitokoto band.

| Folder | Harness | What goes there |
| --- | --- | --- |
| `claude-code/` | [Claude Code](https://code.claude.com) | Mods (function-hook plugins); each subfolder loads with `claude --plugin-dir` |
| `pi/` | [pi](https://github.com/badlogic/pi-mono) | Extensions |
| `deepseek/` | [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) | `dsh` plugins |
| `shared/` | any | Logic more than one port uses |
| `scripts/` | | Checks and local install helpers |

## Claude Code mods

| Mod | What it does |
| --- | --- |
| [`hud`](claude-code/hud) | [claude-hud](https://github.com/jarrodwatts/claude-hud) 0.10.0 as a mod: model, project, git, context, usage, tools, agents and todos, above or below the prompt. On top of that: a turn-done alert for long turns, context and limit alerts, a forecast of when a limit runs out, a daily budget, the last 7 days' spend, a nag about uncommitted changes, a one-line task summary and a `/hud detail` pane |
| [`ts-band`](claude-code/ts-band) | Each Tailscale node's state in a band above the prompt: green for direct, yellow through a relay or DERP, red when offline, with a toast when a node comes up or goes down |
| [`hitokoto`](claude-code/hitokoto) | A line from [Hitokoto (一言)](https://hitokoto.cn) above the prompt, refreshed on a timer, once a day, per session or per prompt |

Install them from this repo's marketplace:

```sh
claude plugin marketplace add hoobnn/hoobnn-agent-mods
claude plugin install hud@hoobnn-agent-mods
claude plugin install ts-band@hoobnn-agent-mods
claude plugin install hitokoto@hoobnn-agent-mods
```

Options (`hud`'s `position`, `dailyBudgetUsd` and `summaryEveryTurns`, `ts-band`'s `nodes` and `hideOffline`, `hitokoto`'s `refreshMode` and `categories`, …) are rows in `/config`, or `pluginConfigs` in `~/.claude/settings.json`. Each mod's folder has its own README with the details.

All three mods speak English, Simplified Chinese, Traditional Chinese, Japanese, Korean, Spanish, French, German, Brazilian Portuguese and Russian. `hud` follows `language` in claude-hud's config; `ts-band` and `hitokoto` each have a `language` option whose default, `auto`, follows Claude Code's `language` setting, then the system locale, then English.

### Developing

- Run a working copy over the installed one: `claude --plugin-dir claude-code/<mod>`. It's watched, so a save reloads the hooks module.
- `ts-band` and `hitokoto` carry the same language resolver in their own `hooks/i18n.ts` (an installed mod reaches nothing outside its folder): change one, change both.
- `scripts/check.sh` validates, tests and type-checks every mod. The mod API is early access, so run it after a Claude Code update too. `tsc` needs the types Claude Code puts in `.claude-plugin/types/` the first time it loads the mod.
- Release: bump `version` in the mod's `plugin.json` and its entry in `.claude-plugin/marketplace.json`, commit, then `claude plugin tag claude-code/<mod> --push` (tags look like `<mod>--v<version>`). Installs pick it up with `claude plugin marketplace update hoobnn-agent-mods && claude plugin update <mod>@hoobnn-agent-mods`.

## License

MIT. `claude-code/hud/hooks/hud` is claude-hud's source under its own MIT license (`claude-code/hud/LICENSE.claude-hud`).
