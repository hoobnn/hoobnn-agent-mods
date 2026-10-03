# receipt: a turn receipt for Claude Code

[简体中文](README.md) · **English**

When a Claude turn ends, a one-line receipt stays above the prompt: the files it changed with the lines added and removed, the commands it ran and how many failed. You know what the turn did without scrolling back. It also toasts when the model goes in circles, and costs no tokens.

![receipt: what the last turn changed, ran and read](assets/preview.png)

```
✓ Last turn 2m 13s · Edited 3 +48 −12 · Commands 6 · 1 failed · Reads 14 · Agents 1 · ⚠ 1
```

## Features

- **One-line receipt**: how the turn ended (`✓` answered, `◼` interrupted, `✗` an error) and how long it took, then only the counts that have something to say: files changed with lines added and removed, commands run and failed, reads (`Read`, `Grep`, `Glob`), subagents started and warnings raised.
- **Subagents count too**: a subagent's edits and commands count toward the turn that started it.
- **Stays out of the way**: a chat-only turn leaves no receipt, the row leaves when the next turn starts, and it steps aside while a `/` or `@` picker is open.
- **Going-in-circles alerts**: while the turn runs, a toast (once per streak) when the main thread
  - runs the same call and it fails `repeatFailures` times in a row (default 3) with nothing changed in between. An edit, or a shell command the tool did not hold read-only (`sed -i`, `npm install`), is work, not a loop, and starts the count over; `cat` or `ls` does not.
  - edits a file back to what an earlier edit took out of it, the `flipFlops`th time (default 2).
- **No tokens, no side effects**: it reads the turn's tool calls after they have run (Edit, Write and NotebookEdit for the files, with git's line counts when the result has them, else the patch's; Bash for the commands). It registers no tool, adds nothing to the system prompt and never refuses or holds a call; a refused call counts for nothing.

## Install

```sh
claude plugin marketplace add hoobnn/hoobnn-agent-mods
claude plugin install receipt@hoobnn-agent-mods
```

## Commands

- `/receipt` lists the last receipt in full: every file with its lines (`new` for a file the turn made), every failed command, every warning.
- `/receipt off` and `/receipt on` hide or show the receipt. They write the `visible` option, so `/config` shows the choice and later sessions keep it.

## Options

Set them in `/config`, or under `pluginConfigs` in `~/.claude/settings.json`:

| Option | What it does | Default |
| --- | --- | --- |
| `visible` | Show the receipt above the prompt between turns | on |
| `repeatFailures` | Toast after the same call fails this many times in a row; 0 off | 3 |
| `flipFlops` | Toast after a file is edited back and forth this many times; 0 off | 2 |
| `language` | `auto`, `en`, `zh-Hans`, `zh-Hant`, `ja`, `ko`, `es`, `fr`, `de`, `pt-BR`, `ru` | `auto` |

`auto` follows Claude Code's `language` setting, then the system locale (`LC_ALL`, `LC_MESSAGES`, `LANG`), then English.

## More mods

[hoobnn-agent-mods](../../README.en.md) also has a task progress bar (`todo-bar`), a statusline HUD (`hud`), spinner animations with a pet (`spinner`), a Tailscale node band (`ts-band`) and a Hitokoto quote band (`hitokoto`).

## Development

- `hooks/register.tsx`: the hooks: the session's start (language, `/receipt`), the turn's start and end, the tool calls it reads, the command and the band.
- `hooks/ledger.ts`: the receipt and the loop rules, built from what each call carried.
- `hooks/config.ts`: the options, read once into a typed `Config`.
- `hooks/i18n.ts`: the messages.
- `hooks/kit/`: copies of `claude-code/kit` (language, option readers, band stacking, `/config` writes); edit the source and run `scripts/sync-kit.sh`.
