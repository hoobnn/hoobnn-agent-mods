# hitokoto: a Hitokoto quote above the Claude Code prompt

[简体中文](README.md) · **English**

A line from [Hitokoto (一言)](https://hitokoto.cn), a Chinese quote service of poetry, literature, anime lines and aphorisms, in a band above the prompt, with its author and source dimmed after it. Something to read while Claude works.

![hitokoto: a line and its source above the prompt](assets/preview.png)

## Features

- **A line and its source**, with a `↻` at the end that brings another when clicked (not in `daily` mode).
- **Four refresh modes**: on a timer (every 30 minutes by default), one line a day (the same in every session, a new one after midnight), one per session, or a new one each prompt.
- **Pick categories**: poetry, literature, philosophy and the rest, or any.
- **Light and never empty**: nothing is fetched while the band is hidden; one request runs at a time, and one that has not answered in 10 s counts as failed. The last line is kept, so a new or offline session starts with it.
- Nothing is fetched in `claude -p` or the SDK.

## Install

```sh
claude plugin marketplace add hoobnn/hoobnn-agent-mods
claude plugin install hitokoto@hoobnn-agent-mods
```

## Commands

- `/hitokoto` fetches a new line now (in `daily` mode it replaces today's).
- `/hitokoto off` and `/hitokoto on` hide or show the band. They write the `visible` option, so `/config` shows the choice and later sessions keep it; `on` brings the line up to date.

## Options

Set them in `/config`, or under `pluginConfigs` in `~/.claude/settings.json`:

| Option | What it does | Default |
| --- | --- | --- |
| `visible` | Show the band (what `/hitokoto off` / `on` sets) | on |
| `refreshMode` | `interval` every `intervalMinutes`, `daily` one a day, `session` one per session, `prompt` one per prompt | `interval` |
| `categories` | Category letters, comma separated; empty takes any. a anime, b manga, c games, d literature, e original, f internet, g other, h film, i poetry, j NetEase Music, k philosophy, l wit; e.g. `d,i,k` | empty |
| `intervalMinutes` | Minutes between lines in `interval` mode (at least 1) | 30 |
| `language` | Language of `/hitokoto`'s replies and errors: `auto`, `en`, `zh-Hans`, `zh-Hant`, `ja`, `ko`, `es`, `fr`, `de`, `pt-BR`, `ru` (the lines themselves are Chinese) | `auto` |

`auto` follows Claude Code's `language` setting, then the system locale, then English.

## More mods

[hoobnn-agent-mods](../../README.en.md) also has a statusline HUD (`hud`), a task progress bar (`todo-bar`), a turn receipt (`receipt`), spinner animations with a pet (`spinner`) and a Tailscale node band (`ts-band`).

## Development

- `hooks/register.tsx`: the hooks: the session's start (language, `/hitokoto`, the refresh schedule for the mode), the command and the band.
- `hooks/config.ts`: the options, read once into a typed `Config`.
- `hooks/parse.ts`: the API's URL and reply, the attribution and the local date.
- `hooks/i18n.ts`: the messages.
- `hooks/kit/`: copies of `claude-code/kit`; edit the source and run `scripts/sync-kit.sh`.
