# ts-band

A band above the prompt with the Tailscale nodes' state. While every node is online and direct it is one short mark, `TS ● 4/4 direct`; otherwise the online count, then only the nodes that need a look: `◐` yellow through a relay or DERP, `○` red when offline. Reads `tailscale status --json` every minute and toasts when a node comes up or goes down. `/ts` hides or shows it (`/ts off`, `/ts on` to set it), and the choice is kept across sessions.

Options: `nodes` picks the nodes shown, in its order, and `host=label` renames one (`nas=家里, dev-box, vps-west=美西`; empty shows every node; the count and the toasts follow the pick); `hideOffline` leaves offline nodes out of the band while still counting them; plus `tailscalePath` and `intervalSeconds`.

Language: `language` (`auto`, `en`, `zh-Hans`, `zh-Hant`, `ja`, `ko`, `es`, `fr`, `de`, `pt-BR`, `ru`); `auto` follows Claude Code's `language` setting, then the system locale (`LC_ALL`, `LC_MESSAGES`, `LANG`), then English.
