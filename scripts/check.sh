#!/usr/bin/env bash
# Validate, test and type-check every Claude Code mod (or the ones named).
# Usage: scripts/check.sh [claude-code/<mod> ...]
set -euo pipefail
cd "$(dirname "$0")/.."

mods=("$@")
if [ ${#mods[@]} -eq 0 ]; then
  for dir in claude-code/*/; do
    # claude-code/kit is the mods' shared source, not a mod.
    [ -f "$dir.claude-plugin/plugin.json" ] && mods+=("${dir%/}")
  done
fi

status=0
echo "== kit"
scripts/sync-kit.sh --check && echo "kit copies in sync" || status=1
for mod in "${mods[@]}"; do
  echo "== $mod"
  claude plugin validate "$mod" | tail -1 || status=1
  if compgen -G "$mod/tests/*.test.ts*" > /dev/null; then
    claude plugin test "$mod" | tail -3 || status=1
  fi
  # The engine lays .claude-plugin/types at the mod's first load; tsc needs them.
  if [ -d "$mod/.claude-plugin/types" ]; then
    tsc -p "$mod" && echo "tsc ok" || status=1
  else
    echo "tsc skipped: load the mod once so Claude Code lays .claude-plugin/types"
  fi
done
exit $status
