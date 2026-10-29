// Generated from claude-code/kit/prefs.ts by scripts/sync-kit.sh: edit the source, then re-run it.
// `/config` is where a mod's settings live: a slash command that changes one
// (`/ts off`, `/spinner neon`) writes that row as the person would in the menu,
// so the menu shows it, settings.json keeps it, and the engine reloads the
// module with it. The command also sets the mod's session state, so the change
// shows at once, and stays for the session where no row can be written
// (`claude -p` has no plugin rows).
//
// The engine follows `$` only within the hooks module's own file, so the mod
// hands the kit closures over `$` (a `Prefs`) rather than `$` itself.
import type { ConfigValue } from 'claude-code'

/** The mod's store and its own `/config` rows, as closures the hooks module builds over `$`. */
export type Prefs = {
  kept: (key: string) => Promise<unknown>
  forget: (key: string) => Promise<void>
  /** `$.config.set` on `<plugin>.<field>`. */
  write: (field: string, value: ConfigValue) => Promise<{ deny?: string }>
}

/** Writes one of the mod's rows; false when no row took it. */
export async function persist(prefs: Prefs, field: string, value: ConfigValue): Promise<boolean> {
  const result = await prefs.write(field, value).catch(() => null)
  return result !== null && result.deny === undefined
}

/** What a value kept in the store under an older version becomes: a row and its value, or nothing. */
export type Move = (kept: unknown) => readonly [field: string, value: ConfigValue] | null

/** The rows values older versions kept in `$.store` stand for, which the session applies at once. */
export async function keptRows(prefs: Prefs, moves: Readonly<Record<string, Move>>): Promise<Record<string, ConfigValue>> {
  const rows: Record<string, ConfigValue> = {}
  for (const [key, move] of Object.entries(moves)) {
    const kept = await prefs.kept(key)
    const target = kept === undefined ? null : move(kept)
    if (target) rows[target[0]] = target[1]
  }
  return rows
}

/**
 * Moves those values to their `/config` rows, once: a key is dropped only
 * after its row took the value (or it has none to give). Run it after
 * `session.start`'s `next(e)`: the plugin's rows join `/config` as the
 * session comes up, and the write brings a reload that applies them.
 */
export async function migrateStore(prefs: Prefs, moves: Readonly<Record<string, Move>>): Promise<void> {
  for (const [key, move] of Object.entries(moves)) {
    const kept = await prefs.kept(key)
    if (kept === undefined) continue
    const target = move(kept)
    if (!target || (await persist(prefs, target[0], target[1]))) await prefs.forget(key)
  }
}

/** `off` → true, `on` → false, anything else flips `isOff`. */
export function switchArg(arg: string, isOff: boolean): boolean {
  return arg === 'off' ? true : arg === 'on' ? false : !isOff
}
