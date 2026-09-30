#!/usr/bin/env bash
# ============================================================================
# bt-stop-editor.sh - Stop the resident Editor holding a project, on any platform.
#
#   ./bt-stop-editor.sh <ProjectPath>
#
# Copilot mode leaves an Editor running on purpose. Until it is stopped the
# project is locked and the Unity Hub cannot open it. Use this rather than
# `kill $!`: the pid the scaffold prints is the shell's job id, which is not a
# Windows pid, and kill(1) cannot signal a native Windows process from Git Bash.
# ============================================================================
set -uo pipefail
export PATH="$HOME/.unity/bin:$PATH"

PROJ="${1:?usage: bt-stop-editor.sh <ProjectPath>}"
PROJ=$(printf '%s' "$PROJ" | tr '\\' '/')

PID=$(unity pipeline list --format json 2>/dev/null | BT_PROJ="$PROJ" python3 -c "
import json, os, sys
want = os.path.normcase(os.path.abspath(os.environ['BT_PROJ']))
try: inst = json.load(sys.stdin)['data']['instances']
except Exception: sys.exit(0)
for i in inst:
    if i.get('isRunning') and os.path.normcase(os.path.abspath(i.get('projectPath', ''))) == want:
        print(i['pid']); break")

# kill -0 cannot see a native Windows process from Git Bash; ask tasklist there.
alive(){
  if command -v tasklist >/dev/null 2>&1; then tasklist //FI "PID eq $1" 2>/dev/null | grep -q " $1 "
  else kill -0 "$1" 2>/dev/null; fi
}

if [ -z "$PID" ]; then
  echo "no running Editor registered for $PROJ - lock left untouched"
else
  echo "stopping Editor pid $PID"
  # Save first - `unity close` quits WITHOUT saving. Then quit gracefully; kill the pid only as a fallback.
  unity command save_all --project-path "$PROJ" >/dev/null 2>&1
  if ! unity close "$PROJ" --force --timeout 30 >/dev/null 2>&1; then
    if command -v taskkill >/dev/null 2>&1; then taskkill //PID "$PID" //F >/dev/null 2>&1
    else kill "$PID" 2>/dev/null; fi
  fi
  for i in $(seq 1 15); do alive "$PID" || break; sleep 1; done
  if alive "$PID"; then
    echo "ERROR: Editor pid $PID is still running - lock left in place" >&2
    exit 1
  fi
  # The lockfile is what actually blocks the Hub. Clear it only once the Editor is gone:
  # deleting it under a live Editor lets the Hub open a second Editor on the same project.
  rm -f "$PROJ/Temp/UnityLockfile" 2>/dev/null
  echo "lock cleared - $PROJ can now be opened from the Unity Hub"
fi
