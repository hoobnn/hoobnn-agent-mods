# hoobnn-agent-mods

Mods, extensions and plugins for coding-agent harnesses, grouped by harness.

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
| [`hud`](claude-code/hud) | [claude-hud](https://github.com/jarrodwatts/claude-hud) 0.10.0 as a mod: model, project, git, context, usage, tools, agents and todos, below or above the prompt |
| [`ts-band`](claude-code/ts-band) | Tailscale nodes' state in a band above the prompt |

Install them from this repo's marketplace:

```sh
claude plugin marketplace add hoobnn/hoobnn-agent-mods
claude plugin install hud@hoobnn-agent-mods
claude plugin install ts-band@hoobnn-agent-mods
```

Options (`hud`'s `position`, `ts-band`'s `tailscalePath` and `intervalSeconds`, …) are rows in `/config`, or `pluginConfigs` in `~/.claude/settings.json`.

### Developing

- Run a working copy over the installed one: `claude --plugin-dir claude-code/<mod>` (watched: a save reloads the hooks module).
- `scripts/check.sh` validates, tests and type-checks every mod; the mod API is early access, so run it after a Claude Code update too. `tsc` needs the types Claude Code lays in `.claude-plugin/types/` the first time it loads the mod.
- Release: bump `version` in the mod's `plugin.json` and its entry in `.claude-plugin/marketplace.json`, commit, then `claude plugin tag claude-code/<mod> --push` (tags `<mod>--v<version>`). Installs pick it up with `claude plugin marketplace update hoobnn-agent-mods && claude plugin update <mod>@hoobnn-agent-mods`.

## License

MIT. `claude-code/hud/hooks/hud` is claude-hud's source under its own MIT license (`claude-code/hud/LICENSE.claude-hud`).
