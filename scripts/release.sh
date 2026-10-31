#!/usr/bin/env bash
# Release mods: bump each one's plugin.json and marketplace entry, commit, and
# tag every mod as <mod>--v<version>. Push with `git push --follow-tags`.
# Usage: scripts/release.sh <mod>@<version> [...]
# RELEASE_TRAILER, when set, is appended to the commit message (e.g. Co-Authored-By).
set -euo pipefail
cd "$(dirname "$0")/.."

[ $# -gt 0 ] || { echo "usage: scripts/release.sh <mod>@<version> ..." >&2; exit 2; }
[ -z "$(git status --porcelain)" ] || { echo "working tree not clean: commit the change first" >&2; exit 1; }

released=()
for arg in "$@"; do
  mod=${arg%@*} version=${arg#*@}
  if [[ $arg != *@* || ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "bad argument: $arg (want <mod>@<x.y.z>)" >&2; exit 2
  fi
  plugin=claude-code/$mod/.claude-plugin/plugin.json
  [ -f "$plugin" ] || { echo "no such mod: $mod" >&2; exit 2; }
  if git rev-parse -q --verify "refs/tags/$mod--v$version" > /dev/null; then
    echo "tag $mod--v$version exists already" >&2; exit 1
  fi
  python3 - "$plugin" .claude-plugin/marketplace.json "$mod" "$version" <<'EOF'
import re, sys
plugin, market, mod, version = sys.argv[1:]
def bump(path, pattern):
    text = open(path).read()
    new, n = re.subn(pattern, lambda m: m.group(1) + f'"{version}"', text, count=1, flags=re.M)
    if n != 1:
        sys.exit(f"no version for {mod} in {path}")
    open(path, 'w').write(new)
bump(plugin, r'^(\s*"version":\s*)"[^"]*"')
bump(market, r'("name":\s*"' + re.escape(mod) + r'",[^{}]*?"version":\s*)"[^"]*"')
EOF
  released+=("$mod $version")
done

subject="🔖 chore(release): $(printf '%s\n' "${released[@]}" | sort | paste -sd, - | sed 's/,/, /g')"
git commit -qam "$subject" ${RELEASE_TRAILER:+-m "$RELEASE_TRAILER"}
for entry in "${released[@]}"; do
  tag="${entry% *}--v${entry#* }"
  git tag -a "$tag" -m "$tag"
  echo "tagged $tag"
done
echo "push with: git push --follow-tags"
