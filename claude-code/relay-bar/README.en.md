<div align="center">

# relay-bar

What the agents agent-relay dispatched are doing.

[简体中文](README.md) · **English**

</div>

When Claude hands work to grok, codex, pi and the rest through [agent-relay](https://github.com/hoobnn/hoobnn-skills/tree/main/plugins/agent-relay), the terminal shows one Bash call spinning. relay-bar puts a row per agent under that Bash call saying what it is on, keeps how it ended there, and `/relay` opens a pane with its thoughts, tool calls and answer. It reads only the status files agent-relay writes, no tokens.

```text
● codex  gpt-5.5·high  2m 10s  ⚙ Edit src/relay.ts                 7/8 tools
● grok                 48s     ∴ First check whether callers handle an empty list
✓ pi                   1m 3s   done · 2 files changed
```

## Features

- Where its call is: a run the main thread dispatched in the foreground is drawn under that Bash call in the transcript, and how it ended stays there; one dispatched in the background (`run_in_background`) or by a subagent, whose call the main transcript does not show, goes above the prompt and folds 10 seconds after it ends (under the subagent's own call too). The space above the prompt is left to the other mods.
- A row per agent: a mark, the agent, its model and effort, how long it has run, then what it is on (`⚙` a tool call, `∴` a thought's last sentence, `›` the answer) and how many of its tool calls are done. Above the prompt four rows at most, the rest counted on one more. Below 60 columns (a phone over a remote terminal) the model and the tool count give their room to what it is on.
- Its end: files changed when done, an error's first line when failed, "waiting for an answer" when it asks back; a toast at the same time.
- `/relay` pane: the session's last 10 runs in a row, the one you press shown: its model, time, the prompt it got, and its latest thoughts, tool calls and answer. Pressing an agent's name on the band opens it too.
- A run that has not moved for 90 seconds once its call is over (killed, the machine slept) is marked "process gone".
- No tokens, nothing in the way: a Bash command naming `relay.py run` or `relay.py check` starts a read of the status files once a second, which stops once every run is over; no tool, nothing in the system prompt, no call changed.

## Install

```sh
claude plugin marketplace add hoobnn/hoobnn-agent-mods
claude plugin install relay-bar@hoobnn-agent-mods
```

agent-relay must write its status file (`status.json`; the agent-relay in hoobnn-skills does).

## Commands

- `/relay`: opens the relay pane.
- `/relay off`, `/relay on`: hides or shows the band. This is written back to `/config`, so later sessions keep it.

## Options

Change them in `/config`, or under `pluginConfigs` in `~/.claude/settings.json`:

| Option | What it does | Default |
| --- | --- | --- |
| `visible` | Show the band (what `/relay off` / `on` set) | on |
| `toast` | A toast when a run ends, fails or asks a question | on |
| `language` | `auto`, `en`, `zh-Hans`, `zh-Hant`, `ja`, `ko`, `es`, `fr`, `de`, `pt-BR`, `ru` | `auto` |

With `language` at `auto`, the band follows Claude Code's `language` setting, then the system locale, then English.

## What it reads

Each agent-relay run has a folder under `$XDG_STATE_HOME/agent-relay/runs/` (by default `~/.local/state/agent-relay/runs/`). While the agent works `relay.py` rewrites its `status.json` about once a second, and once more as it ends:

```json
{"v": 1, "cli": "codex", "model": "gpt-5.5", "effort": "high", "pid": 12345, "cwd": "/repo",
 "prompt": "first 200 characters", "started": 1761700000.0, "updated": 1761700130.0,
 "state": "starting | running | done | failed | asked", "session_id": "…", "caller_session": "…",
 "tools": {"done": 7, "total": 8},
 "steps": [{"type": "thought", "text": "…"}, {"type": "tool", "title": "Edit src/x.ts", "kind": "edit", "status": "in_progress"}],
 "ok": true, "error": null, "files_changed": 3, "ended": 1761700135.0}
```

`steps` holds the latest 40 steps, each text cut to 600 characters; `ok` and what follows appear once it ends. relay-bar reads only folders made after the relay call began, and skips those whose `caller_session` (the Claude Code session that dispatched it, from `CLAUDE_CODE_SESSION_ID`) is not this one, so another session dispatching at the same moment stays out; a subagent's runs share the session's ID and show. Runs from an older relay.py, which writes no such field, and any poll that cannot get the session's ID still go by time.

## Other mods

[hoobnn-agent-mods](../../README.en.md) also has a statusline HUD (`hud`), a task progress bar (`todo-bar`, which shows Claude's own subagents), a turn receipt (`receipt`), spinner animations with a pet (`spinner`), a Tailscale node band (`ts-band`) and a Hitokoto quote band (`hitokoto`).

## Development

- `hooks/register.tsx`: the hooks (the watch a relay call starts, `/relay`, the band and the pane).
- `hooks/runs.ts`: reads `status.json`, merges the session's runs, and words what the band and the pane show.
- `hooks/config.ts`: the options, read once into a typed `Config`.
- `hooks/i18n.ts`: the messages in each language.
- `hooks/kit/`: copies of `claude-code/kit`; edit the source, then run `scripts/sync-kit.sh`.
