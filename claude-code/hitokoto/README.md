# hitokoto

A line from [Hitokoto (一言)](https://hitokoto.cn) in a band above the prompt, with its author and source dimmed after it. `/hitokoto` fetches one now, `/hitokoto off` and `/hitokoto on` hide and show the band (kept across sessions).

Options:

- `refreshMode`: `interval` (default) a new line every `intervalMinutes`; `daily` one line a day, the same in every session, a new one after midnight (`/hitokoto` replaces today's); `session` a new line each session; `prompt` a new line each time you send a prompt.
- `categories`: the API's category letters, e.g. `d,i,k` for 文学、诗词、哲学; empty takes any.
- `intervalMinutes`: minutes between lines in `interval` mode (default 30).
- `language`: the language of `/hitokoto`'s replies and errors (`auto`, `en`, `zh-Hans`, `zh-Hant`, `ja`, `ko`, `es`, `fr`, `de`, `pt-BR`, `ru`); `auto` follows Claude Code's `language` setting, then the system locale, then English. The lines are Hitokoto's own, in Chinese.
