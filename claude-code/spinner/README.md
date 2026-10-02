# spinner

Animations while the model works, in three places:

![spinner: the cat theme through a turn and its finale](assets/cat.gif)

- **Mascot**: a little character in front of Claude Code's own spinner line (`[◉_◉]⊃━━ ✢ Choreographing… (4s · ↓ 14 tokens)`), with frames for thinking, using tools, responding and waiting. The engine's word, elapsed time and tokens stay as they are.
- **Stage**: a two-row animated scene in the band above the prompt while a turn runs: a cat chasing a ball of yarn, a bunny hopping between carrots, falling sakura petals, a mecha shooting down targets, a neon equalizer, a dino runner that jumps the cacti by itself, fish and bubbles, a Matrix rain. Other mods' bands (hud, ts-band, hitokoto) stay beneath it.
- **Finale**: for three seconds after a turn ends, confetti bursts around the mascot with the time the turn took (`(=^▽^=)ﾉ  Done · 12s`); an interrupted turn gets a sad face, a failed one a glitch.

Themes: `cat`, `bunny`, `sakura`, `mecha`, `neon`, `dino`, `ocean`, `matrix`, or `random` for a new one each session.

| | |
| --- | --- |
| `cat`<br>![cat](assets/cat.gif) | `bunny`<br>![bunny](assets/bunny.gif) |
| `sakura`<br>![sakura](assets/sakura.gif) | `mecha`<br>![mecha](assets/mecha.gif) |
| `neon`<br>![neon](assets/neon.gif) | `dino`<br>![dino](assets/dino.gif) |
| `ocean`<br>![ocean](assets/ocean.gif) | `matrix`<br>![matrix](assets/matrix.gif) |

Every theme's mascot and stage in one still: [assets/gallery.png](assets/gallery.png); a still per theme sits beside each GIF (`assets/<theme>.png`). `scripts/spinner-shots.ts` at the repository's root renders them all again from `hooks/themes.ts`.

`/spinner` shows the current theme and the list; `/spinner <theme>` or `/spinner random` switches live, `/spinner preview [theme]` plays a scene above the prompt for eight seconds, `/spinner off` / `on` turns everything off and on, `/spinner stage off` / `on` the band alone. What `/spinner` sets is kept across sessions.

Options:

- `theme`: the starting theme (default `random`); a theme picked with `/spinner` wins over it.
- `stage`: the animated band above the prompt (default on).
- `celebrate`: the finale when a turn ends (default on).
- `language`: the language of `/spinner`'s replies and the finale's label (`auto`, `en`, `zh-Hans`, `zh-Hant`, `ja`, `ko`, `es`, `fr`, `de`, `pt-BR`, `ru`); `auto` follows Claude Code's `language` setting, then the system locale, then English.

The mascot and the stage draw on the terminal and the desktop app (the surfaces that run a `Client`); elsewhere Claude Code's own spinner shows unchanged.
