# todo-bar

The task list's progress in a band above the prompt. It shows once Claude writes a task list and follows it as the work moves on:

```
● Writing the tests        ━━━━━━━━──────────────────  2/7  29%
  Next: Run the build · Publish
```

Once every task is done the band turns green with the time the list took, `✓ All done ━━━━━━━━ 7/7 took 3m 12s`, and folds away after 8 seconds; the next list brings it back.

It costs no tokens. It reads the calls Claude already makes, after they have run: `TodoWrite` (the whole list each call), and `TaskCreate` / `TaskUpdate` (one task a call). It registers no tool, adds nothing to the system prompt, and refuses or holds no call. A call that was refused or failed changes nothing; a subagent's own list is left out.

`/todos` lists every task with its mark (`✓` done, `●` running, `○` waiting); `/todos off` and `/todos on` hide or show the band by writing the `visible` option, so `/config` shows the choice and it is kept across sessions. The band steps aside while a `/` or `@` picker is open, as the other mods' bands do. Each session's list is kept in the plugin's store, so a resumed session finds its band where it left it.

Options: `visible` shows the band (what `/todos` sets); `showNext` draws the dim second row with the next one or two tasks.

Language: `language` (`auto`, `en`, `zh-Hans`, `zh-Hant`, `ja`, `ko`, `es`, `fr`, `de`, `pt-BR`, `ru`); `auto` follows Claude Code's `language` setting, then the system locale (`LC_ALL`, `LC_MESSAGES`, `LANG`), then English.

## Layout

- `hooks/register.tsx`: the hooks: the session's start (language, `/todos`, a resumed board), the tool calls it reads, the command and the band.
- `hooks/board.ts`: the list as the band draws it, built from what each call carried.
- `hooks/config.ts`: the options, read once into a typed `Config`.
- `hooks/i18n.ts`: the messages.
- `hooks/kit/`: copies of `claude-code/kit` (language, option readers, band stacking, `/config` writes); edit the source and run `scripts/sync-kit.sh`.
