#!/usr/bin/env bash
# Copy claude-code/kit/* into each mod's hooks/kit/: an installed mod reads no
# file outside its own folder, so the copies ship with it. A mod gets the kit
# files its own sources name (`./kit/<name>`, an import or a Client module),
# and the kit files those name in turn, no others.
# Usage: scripts/sync-kit.sh          write the copies
#        scripts/sync-kit.sh --check  fail when a copy differs from its source
set -euo pipefail
cd "$(dirname "$0")/.."

check=false
[ "${1:-}" = "--check" ] && check=true

# The kit files `files...` name, one basename (with its suffix) a line: a mod's
# sources name them `./kit/<name>`, the kit's own name each other `./<name>`.
named() {
  local prefix=$1
  shift
  grep -ohE "${prefix}[a-z-]+(\.js|\.tsx?)?['\"]" "$@" 2>/dev/null | sed -E "s#^${prefix}##; s#['\"]##; s#\.js\$##" | while read -r ref; do
    for src in claude-code/kit/"${ref%.*}".ts claude-code/kit/"${ref%.*}".tsx claude-code/kit/"$ref".ts claude-code/kit/"$ref".tsx; do
      if [ -e "$src" ]; then basename "$src"; fi
    done
  done | sort -u || true
}

status=0
for mod in claude-code/*/; do
  mod=${mod%/}
  [ -f "$mod/.claude-plugin/plugin.json" ] || continue
  dest="$mod/hooks/kit"
  # What the mod's own sources name, then what those kit files name, until nothing new.
  uses=$(named 'kit/' $(find "$mod/hooks" -path "$dest" -prune -o \( -name '*.ts' -o -name '*.tsx' \) -print))
  while :; do
    more=$( { echo "$uses"; [ -n "$uses" ] && named '\./' $(printf 'claude-code/kit/%s\n' $uses); } | grep -v '^$' | sort -u)
    [ "$more" = "$uses" ] && break
    uses=$more
  done

  if ! $check && [ -n "$uses" ]; then mkdir -p "$dest"; fi
  for name in $uses; do
    want=$(printf '%s\n%s\n' "// Generated from claude-code/kit/$name by scripts/sync-kit.sh: edit the source, then re-run it." "$(cat "claude-code/kit/$name")")
    if $check; then
      if [ "$(cat "$dest/$name" 2>/dev/null)" != "$want" ]; then
        echo "kit drift: $dest/$name (run scripts/sync-kit.sh)"
        status=1
      fi
    else
      printf '%s\n' "$want" > "$dest/$name"
    fi
  done
  # A copy the kit no longer has, or the mod no longer uses.
  for copy in "$dest"/*; do
    [ -e "$copy" ] || continue
    if ! grep -qx "$(basename "$copy")" <<< "$uses"; then
      if $check; then echo "kit drift: $copy is not used or has no source"; status=1; else rm "$copy"; fi
    fi
  done
done
exit $status
