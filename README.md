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
| [`hud`](claude-code/hud) | [claude-hud](https://github.com/jarrodwatts/claude-hud) 0.9.0 as a mod: model, project, git, context, usage, tools, agents and todos, below or above the prompt |
| [`ts-band`](claude-code/ts-band) | Tailscale nodes' state in a band above the prompt |

Load them in every session by naming their folders in `~/.claude/settings.json`:

```json
{ "env": { "CLAUDE_CODE_PLUGIN_DIRS": "~/Code/personal/active/hoobnn-agent-mods/claude-code/hud:~/Code/personal/active/hoobnn-agent-mods/claude-code/ts-band" } }
```

`scripts/check.sh` validates, tests and type-checks them; the mod API is early access, so run it after a Claude Code update.

## License

MIT. `claude-code/hud/hooks/hud` is claude-hud's source under its own MIT license (`claude-code/hud/LICENSE.claude-hud`).
