# kit

What the Claude Code mods share. An installed mod reads no file outside its own folder, so `scripts/sync-kit.sh` copies each file here into the mods that import it (`<mod>/hooks/kit/`, with a "generated" header); `scripts/check.sh` fails when a copy drifts. Edit here, then run the script.

- `lang.ts`: the language a mod draws in (its `language` option, then Claude Code's `language` setting, then the locale, then English) and `createMessages`, which gives a mod `m(key, params)` over its own table.
- `options.ts`: readers for `register`'s options (`text`, `flag`, `count`, `oneOf`), so a mod's `config.ts` reads each `userConfig` field in one typed line.
- `band.tsx`: `stackAbove`, a mod's rows in the band above the prompt, over what the rest of the chain drew, two cells in.
- `prefs.ts`: `/config` as the one place a mod's settings live. A command that changes a setting writes its row (`persist`); values older versions kept in `$.store` are applied at once (`keptRows`) and moved to their rows once the session is up (`migrateStore`).

The engine follows `$` only within the hooks module's own file (and `on(...)`, `$.env.get(...)` take literals there), so nothing here takes `$`: a mod hands `prefs.ts` closures over it (`prefsOf($)` in each `register.tsx`) and calls the rest with plain values.

The editor types `kit/` through `tsconfig.json`, which borrows the API types Claude Code lays in `ts-band/.claude-plugin/types/` (gitignored): load ts-band once in a fresh clone.
