// Generated from claude-code/kit/options.ts by scripts/sync-kit.sh: edit the source, then re-run it.
// Readers for `register`'s options: each takes the raw value and the field's
// default, so a mod's `readConfig` is one typed line per `userConfig` field.
// The engine has validated the type already; these hold the ranges.

export function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

export function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/** A finite number, clamped to `min` / `max` and floored with `isInteger`. */
export function count(
  value: unknown,
  fallback: number,
  range: { min?: number; max?: number; isInteger?: boolean } = {},
): number {
  let n = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  if (range.isInteger) n = Math.floor(n)
  if (range.min !== undefined) n = Math.max(range.min, n)
  if (range.max !== undefined) n = Math.min(range.max, n)
  return n
}

/** One of `values`, else the fallback. */
export function oneOf<const T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return values.find(v => v === value) ?? fallback
}
