# shared

Harness-independent logic (parsers, formatters) more than one harness's port uses.

A Claude Code mod loads only files inside its own folder, so a mod cannot import from here directly: copy what it needs into the mod (and note the source), or add a step to `scripts/` that does.
