#!/usr/bin/env bash
# Copy claude-code/kit/* into each mod's hooks/kit/: an installed mod reads no
# file outside its own folder, so the copies ship with it. A mod gets the kit
# files its own sources import (`./kit/<name>`), no others.
# Usage: scripts/sync-kit.sh          write the copies
#        scripts/sync-kit.sh --check  fail when a copy differs from its source
set -euo pipefail
cd "$(dirname "$0")/.."

check=false
[ "${1:-}" = "--check" ] && check=true

status=0
for mod in claude-code/*/; do
  mod=${mod%/}
  [ -f "$mod/.claude-plugin/plugin.json" ] || continue
  dest="$mod/hooks/kit"
  $check || mkdir -p "$dest"
  for src in claude-code/kit/*.ts claude-code/kit/*.tsx; do
    [ -e "$src" ] || continue
    name=$(basename "$src")
    base=${name%.*}
    grep -rqE "kit/$base(\.js)?['\"]" --include='*.ts' --include='*.tsx' --exclude-dir=kit "$mod/hooks" || continue
    want=$(printf '%s\n%s\n' "// Generated from claude-code/kit/$name by scripts/sync-kit.sh: edit the source, then re-run it." "$(cat "$src")")
    if $check; then
      if [ "$(cat "$dest/$name" 2>/dev/null)" != "$want" ]; then
        echo "kit drift: $dest/$name (run scripts/sync-kit.sh)"
        status=1
      fi
    else
      printf '%s\n' "$want" > "$dest/$name"
    fi
  done
  # A file the kit no longer has, or the mod no longer imports.
  for copy in "$dest"/*; do
    [ -e "$copy" ] || continue
    base=$(basename "$copy"); base=${base%.*}
    if [ ! -e "claude-code/kit/$(basename "$copy")" ] || ! grep -rqE "kit/$base(\.js)?['\"]" --include='*.ts' --include='*.tsx' --exclude-dir=kit "$mod/hooks"; then
      if $check; then echo "kit drift: $copy is not used or has no source"; status=1; else rm "$copy"; fi
    fi
  done
done
exit $status
