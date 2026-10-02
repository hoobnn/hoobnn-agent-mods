# ts-band

A band above the prompt with the Tailscale nodes' state. While every node is online and direct it is one short mark, `TS ● 4/4 direct`; otherwise the online count, then only the nodes that need a look: `◐` yellow through a relay or DERP, `○` red when offline. Reads `tailscale status --json` every minute and toasts when a node comes up or goes down. `/ts` hides or shows it (`/ts off`, `/ts on` to set it) by writing the `visible` option, so `/config` shows the choice and it is kept across sessions.

Options: `visible` shows the band (what `/ts` sets); `nodes` picks the nodes shown, in its order, and `host=label` renames one (`nas=家里, dev-box, vps-west=美西`; empty shows every node; the count and the toasts follow the pick); `hideOffline` leaves offline nodes out of the band while still counting them; plus `tailscalePath` and `intervalSeconds`.

Language: `language` (`auto`, `en`, `zh-Hans`, `zh-Hant`, `ja`, `ko`, `es`, `fr`, `de`, `pt-BR`, `ru`); `auto` follows Claude Code's `language` setting, then the system locale (`LC_ALL`, `LC_MESSAGES`, `LANG`), then English.

## Layout

- `hooks/register.tsx`: the hooks: the session's start (language, `/ts`, polling), the command and the band.
- `hooks/config.ts`: the options, read once into a typed `Config`.
- `hooks/parse.ts`: `tailscale status --json` to nodes, and the `nodes` option to picks.
- `hooks/i18n.ts`: the messages.
- `hooks/kit/`: copies of `claude-code/kit` (language, option readers, band stacking, `/config` writes); edit the source and run `scripts/sync-kit.sh`.
