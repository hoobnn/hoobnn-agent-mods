# ts-band: Tailscale node status in Claude Code

[简体中文](README.md) · **English**

Your Tailscale nodes' state in a band above the prompt. While every node is online and direct it is one short mark; a node that goes through a relay or drops offline gets listed. Check the link before Claude deploys to or syncs with a remote machine.

![ts-band: two nodes through a relay and one offline](assets/preview.png)

## Features

- **Tiny when all is well**: with every node online and direct it shows only `TS ● 4/4 direct`.
- **Details only when they matter**: otherwise the online count, then only the nodes that need a look: `◐` yellow through a relay or DERP (with the region, e.g. `DERP-sfo`), `○` red when offline.
- **Up / down toasts** when a node comes up or goes down.
- **Fresh**: reads `tailscale status --json` every minute, and at once after Claude runs `tailscale up`, `down`, `set`, `switch`, `login` or `logout`.
- **Keeps the last good read**: a failed read leaves the nodes last read on the band with the error after them, and the next read waits twice as long each time (up to 10 minutes), so a missing CLI or a stopped daemon is not retried every tick.
- Nothing runs in `claude -p` or the SDK.

## Install

Install [Tailscale](https://tailscale.com/download) so the `tailscale` CLI is available (the macOS app's own CLI is found too), then:

```sh
claude plugin marketplace add hoobnn/hoobnn-agent-mods
claude plugin install ts-band@hoobnn-agent-mods
```

## Commands

- `/ts` toggles the band; `/ts off` and `/ts on` set it. They write the `visible` option, so `/config` shows the choice and later sessions keep it.

## Options

Set them in `/config`, or under `pluginConfigs` in `~/.claude/settings.json`:

| Option | What it does | Default |
| --- | --- | --- |
| `visible` | Show the band (what `/ts` sets) | on |
| `nodes` | Show only these nodes, in this order; `host=label` renames one (`nas=home, dev-box, vps-west=US West`). Empty shows every node; the count and the toasts follow the pick | empty |
| `hideOffline` | Leave offline nodes out of the band (they still count in the total) | off |
| `tailscalePath` | Path to the `tailscale` CLI; empty looks on PATH, then Homebrew and the macOS app | empty |
| `intervalSeconds` | Seconds between reads (at least 10) | 60 |
| `language` | `auto`, `en`, `zh-Hans`, `zh-Hant`, `ja`, `ko`, `es`, `fr`, `de`, `pt-BR`, `ru` | `auto` |

`auto` follows Claude Code's `language` setting, then the system locale (`LC_ALL`, `LC_MESSAGES`, `LANG`), then English.

## More mods

[hoobnn-agent-mods](../../README.en.md) also has a statusline HUD (`hud`), a task progress bar (`todo-bar`), a turn receipt (`receipt`), spinner animations with a pet (`spinner`) and a Hitokoto quote band (`hitokoto`).

## Development

- `hooks/register.tsx`: the hooks: the session's start (language, `/ts`, polling), the command and the band.
- `hooks/config.ts`: the options, read once into a typed `Config`.
- `hooks/parse.ts`: `tailscale status --json` to nodes, and the `nodes` option to picks.
- `hooks/i18n.ts`: the messages.
- `hooks/kit/`: copies of `claude-code/kit` (language, option readers, band stacking, `/config` writes); edit the source and run `scripts/sync-kit.sh`.
