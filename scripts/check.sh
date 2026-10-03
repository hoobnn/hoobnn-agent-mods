#!/usr/bin/env bash
# Validate, test and type-check every Claude Code mod (or the ones named), and
# hold each to the reach scripts/reach.txt allows it.
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

# A mod's reach, as awesome-claude-code-mods grades it from the `$` calls the
# validator lists: "<level> <what it touches>", 0 draws and remembers, 1 reads,
# 2 writes or runs, 3 reaches the network.
reach() {
  local level=0 labels=() call n label
  for call in $(grep ' calls: ' <<<"$1" | grep -oE '\$\.[A-Za-z]+\.[A-Za-z]+' | sort -u); do
    case $call in
      '$.http.fetch' | '$.mcp.call') n=3 label=network ;;
      '$.process.run' | '$.process.spawn') n=2 label='runs processes' ;;
      '$.fs.write') n=2 label='writes files' ;;
      '$.env.set') n=2 label='sets env vars' ;;
      '$.config.set') n=2 label='changes config' ;;
      '$.model.'* | '$.agent.spawn' | '$.prompt.submit' | '$.tool.call' | '$.command.run' | '$.turn.abort' | '$.session.compact' | '$.tool.register') n=2 label='drives Claude' ;;
      '$.prompt.fill' | '$.prompt.suggest') n=1 label='writes the prompt box' ;;
      '$.fs.'*) n=1 label='reads files' ;;
      '$.env.get') n=1 label='reads env vars' ;;
      '$.settings.read') n=1 label='reads settings' ;;
      '$.session.messages' | '$.session.authorize') n=1 label='reads the transcript' ;;
      '$.telemetry.'*) n=1 label=telemetry ;;
      *) n=0 label='' ;;
    esac
    [ "$n" -gt "$level" ] && level=$n
    if [ -n "$label" ] && [[ " ${labels[*]-} " != *" $label "* ]]; then labels+=("$label"); fi
  done
  local joined
  joined=$(printf ', %s' "${labels[@]-}")
  echo "$level ${joined:2}"
}

status=0
echo "== kit"
scripts/sync-kit.sh --check && echo "kit copies in sync" || status=1
for mod in "${mods[@]}"; do
  echo "== $mod"
  validated=$(claude plugin validate "$mod") || status=1
  tail -1 <<<"$validated"
  # The level each mod is allowed (scripts/reach.txt): a new call that reaches further fails the check.
  read -r level touches <<<"$(reach "$validated")"
  echo "reach: L$level${touches:+ ($touches)}"
  allowed=$(awk -v m="$(basename "$mod")" '$1 == m { print $2 }' scripts/reach.txt)
  if [ -z "$allowed" ]; then
    echo "reach: no level for $(basename "$mod") in scripts/reach.txt"
    status=1
  elif [ "$level" -gt "$allowed" ]; then
    echo "reach: above L$allowed, the level scripts/reach.txt allows"
    status=1
  fi
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
