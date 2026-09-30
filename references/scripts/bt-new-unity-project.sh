#!/usr/bin/env bash
# ============================================================================
# bt-new-unity-project.sh - Create a Babylon Toolkit Unity Exporter project.
#
#   ./bt-new-unity-project.sh <ProjectName> [--path <dir>] [--editor <ver>]
#                             [--template <id>] [--license <file>] [--company <name>]
#                             [--mode copilot|headless] [--snippets <dir>]
#
# Runs on macOS, Linux and Windows (Git Bash). Requires the unity CLI, python3,
# npm and a POSIX shell. Every platform difference is isolated in the four
# helpers under "portable helpers" - the rest of the script is plain POSIX.
#
# Does everything needed for a build to actually succeed:
#   1. resolve the Hub's default project directory (override with --path)
#   2. unity projects new            (waits for it to EXIT - ProjectVersion.txt is last)
#   3. unity pipeline install        (package 1/3)
#   4. launch a resident Editor      (-nographics only in headless mode)
#   5. Client.Add x2                 (packages 2/3, one at a time, polled)
#   6. install license.json          (optional but required for interactive components)
#   7. headless bootstrap            (replicates CVPanel.OnEnable -> writes package.json)
#   8. npm install                   (AFTER package.json, BEFORE any TypeScript build)
#   9. starter scene + LightingSettings
#  10. verify pro / tsc / scene
# ============================================================================
set -uo pipefail
export PATH="$HOME/.unity/bin:$PATH"

NAME="${1:?usage: bt-new-unity-project.sh <ProjectName> [--path dir] [--editor ver] [--license file] [--company name] [--mode copilot|headless]}"; shift
PARENT=""; EDITOR_VER="lts"; TEMPLATE="com.unity.template.urp-blank"; LICENSE=""; COMPANY=""; MODE="copilot"
SNIPPETS="$(cd "$(dirname "$0")" && pwd)"
while [ $# -gt 0 ]; do case "$1" in
  --path) PARENT="$2"; shift 2;; --editor) EDITOR_VER="$2"; shift 2;;
  --template) TEMPLATE="$2"; shift 2;; --license) LICENSE="$2"; shift 2;;
  --company) COMPANY="$2"; shift 2;;
  --mode) MODE="$2"; shift 2;; --snippets) SNIPPETS="$2"; shift 2;;
  *) echo "unknown arg: $1" >&2; exit 2;; esac; done
say(){ echo "[$(date +%T)] $*"; }

# --- portable helpers -------------------------------------------------------
# 1. Paths passed to the Editor BINARY must be native Windows under Git Bash.
#    (Paths passed to the `unity` CLI accept either form on every platform.)
nat(){ if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else printf '%s' "$1"; fi; }

# 2. The Editor executable. "location" from the CLI is the executable itself on
#    Windows and Linux but a .app bundle on macOS, so probe the known shapes
#    rather than hard-code /Applications/... .
editor_exe(){
  loc=$(unity editors --installed --format json 2>/dev/null | BT_VER="$1" python3 -c "
import json, os, sys
want = os.environ['BT_VER']
try: d = json.load(sys.stdin)['data']
except Exception: sys.exit(0)
print(next((e['location'] for e in d if e['version'] == want), ''))")
  [ -z "$loc" ] && return 1
  loc=$(printf '%s' "$loc" | tr '\\' '/')
  for c in "$loc" \
           "$loc/Contents/MacOS/Unity" \
           "$loc/Unity.app/Contents/MacOS/Unity" \
           "$loc/Editor/Unity.app/Contents/MacOS/Unity" \
           "$loc/Editor/Unity.exe" \
           "$loc/Editor/Unity"; do
    [ -f "$c" ] && { printf '%s' "$c"; return 0; }
  done
  return 1
}

# 3. The Editor's REAL pid, from the CLI. "$!" is the shell's job id, which under
#    Git Bash is NOT a Windows pid - stopping the Editor with it silently fails.
editor_pid(){
  unity pipeline list --format json 2>/dev/null | BT_PROJ="$PROJ" python3 -c "
import json, os, sys
want = os.path.normcase(os.path.abspath(os.environ['BT_PROJ']))
try: inst = json.load(sys.stdin)['data']['instances']
except Exception: sys.exit(0)
for i in inst:
    if i.get('isRunning') and os.path.normcase(os.path.abspath(i.get('projectPath', ''))) == want:
        print(i['pid']); break"
}

# 4. kill(1) cannot signal a native Windows process from Git Bash.
stop_pid(){
  [ -z "${1:-}" ] && return 0
  if command -v taskkill >/dev/null 2>&1; then taskkill //PID "$1" //F >/dev/null 2>&1
  else kill "$1" 2>/dev/null; fi
}

J(){ python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    print(d.get('data',{}).get('result',{}).get('result') if d.get('success') else 'ERR: '+(d.get('errors') or [{'message':'?'}])[0]['message'][:300])
except Exception: print('unreachable')"; }
ev(){  unity command eval_file "$1" --project-path "$PROJ" --format json 2>/dev/null | J; }
evs(){ unity command eval      "$1" --project-path "$PROJ" --format json 2>/dev/null | J; }
# Add a UPM package by git URL: the Pipeline's typed package_add when this Pipeline version has it,
# otherwise Unity's own PackageManager.Client.Add through eval. Either way the caller polls the outcome.
padd(){
  if unity command --query package_add --detail compact --project-path "$PROJ" 2>/dev/null | grep -q package_add; then
    unity command package_add --identifier "$1" --confirm true --project-path "$PROJ" --format json >/dev/null 2>&1
  else
    evs "UnityEditor.PackageManager.Client.Add(\"$1\"); return \"q\";" >/dev/null
  fi
}

# 1. default project dir from the Hub (portable: userDataPath/projectDir.json)
if [ -z "$PARENT" ]; then
  UDP=$(unity env --format json 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['userDataPath'])" 2>/dev/null)
  PARENT=$(BT_UDP="${UDP:-}" python3 -c "
import json, os
try: print(json.load(open(os.path.join(os.environ['BT_UDP'], 'projectDir.json')))['directoryPath'])
except Exception: print('')" 2>/dev/null)
  [ -z "$PARENT" ] && PARENT="$HOME/Unity"
fi
# Windows writes this value with backslashes; normalise before joining onto it.
PARENT=$(printf '%s' "$PARENT" | tr '\\' '/')
PROJ="$PARENT/$NAME"
say "project : $PROJ"; say "editor  : $EDITOR_VER"; say "mode    : $MODE"
[ -e "$PROJ" ] && { echo "refusing to overwrite existing path: $PROJ" >&2; exit 1; }
mkdir -p "$PARENT"

unity auth status --format json >/dev/null 2>&1 || { echo "not signed in - run: unity auth login" >&2; exit 3; }

say "1/9 creating project"
unity projects new "$NAME" --path "$PARENT" --editor-version "$EDITOR_VER" --template "$TEMPLATE" --format json >/dev/null 2>&1
[ -f "$PROJ/ProjectSettings/ProjectVersion.txt" ] || { echo "project creation failed" >&2; exit 1; }
ED=$(awk -F': ' '/m_EditorVersion:/{print $2; exit}' "$PROJ/ProjectSettings/ProjectVersion.txt" | tr -d '\r')
say "    created on $ED"

say "2/9 com.unity.pipeline (1/3)"
unity pipeline install --project-path "$PROJ" --format json >/dev/null 2>&1
grep -q '"com.unity.pipeline"' "$PROJ/Packages/manifest.json" || { echo "pipeline install failed" >&2; exit 1; }

say "3/9 launching Editor ($MODE)"
GFX=""; [ "$MODE" = "headless" ] && GFX="-nographics"
EXE=$(editor_exe "$ED") || { echo "no Editor binary for $ED - check: unity editors --installed" >&2; exit 1; }
mkdir -p "$PROJ/Logs"
nohup "$EXE" -batchmode $GFX -projectPath "$(nat "$PROJ")" -logFile "$(nat "$PROJ/Logs/agent-editor.log")" >/dev/null 2>&1 &
JOBPID=$!
ok=
for i in $(seq 1 120); do unity command --project-path "$PROJ" >/dev/null 2>&1 && { ok=1; break; }; sleep 5; done
[ "${ok:-}" = 1 ] || { echo "ERROR: Editor launch (Pipeline server reachable) timed out" >&2; exit 1; }
EDPID=$(editor_pid); [ -z "$EDPID" ] && EDPID="$JOBPID"
say "    editor pid=$EDPID ready"

say "4/9 org.khronos.unitygltf (2/3)"
padd https://github.com/babylontoolkit/unitygltf.git
R=""; ok=
for i in $(seq 1 120); do
  R=$(evs 'return UnityEditor.PackageManager.PackageInfo.FindForAssetPath("Packages/org.khronos.unitygltf/package.json") != null;')
  [ "$R" = "True" ] && { ok=1; break; }; sleep 5; done
[ "${ok:-}" = 1 ] || { echo "ERROR: org.khronos.unitygltf resolve timed out" >&2; exit 1; }
say "    resolved ($R)"

say "5/9 com.babylontoolkit.editor (3/3)"
padd https://github.com/babylontoolkit/professionaledition.git
R=""; ok=
for i in $(seq 1 180); do
  R=$(evs 'foreach (var a in System.AppDomain.CurrentDomain.GetAssemblies()) if (a.GetType("CanvasTools.CanvasToolsExporter") != null) return "READY"; return "no";')
  [ "$R" = "READY" ] && { ok=1; break; }; sleep 5; done
[ "${ok:-}" = 1 ] || { echo "ERROR: com.babylontoolkit.editor compile timed out" >&2; exit 1; }
say "    toolkit compiled in ($R)"

if [ -n "$LICENSE" ] && [ -f "$LICENSE" ]; then
  say "6/9 installing license.json"
  mkdir -p "$PROJ/Assets/[Config]"; cp "$LICENSE" "$PROJ/Assets/[Config]/license.json"
  # An EnterprisePartner licence is keyed on PlayerSettings.companyName. A NEW project is
  # "DefaultCompany", so copying the file alone leaves IsPro() false. Set it before validating.
  if [ -n "$COMPANY" ]; then
    evs "UnityEditor.PlayerSettings.companyName = \"$COMPANY\"; UnityEditor.AssetDatabase.SaveAssets(); return UnityEditor.PlayerSettings.companyName;" >/dev/null
    say "    companyName set to '$COMPANY' (EnterprisePartner seed)"
  fi
  evs 'UnityEditor.AssetDatabase.Refresh(); return "ok";' >/dev/null
  PRO=$(evs 'return ToolkitManager.IsPro();')
  [ "$PRO" = "True" ] && say "    licence ACTIVE" || say "    WARNING: licence did NOT validate (pro=$PRO). For EnterprisePartner pass --company '<Licensee Name>'; other plans are bound to the original productGUID and cannot be copied."
else
  say "6/9 no --license given -> COMMUNITY (interactive components will be stripped)"
fi

say "7/9 bootstrap (replicates CVPanel.OnEnable, writes package.json)"
say "    $(ev "$SNIPPETS/bt-bootstrap.cs")"

say "8/9 npm install in project root (AFTER package.json, BEFORE any TS build)"
( cd "$PROJ" && npm install >/dev/null 2>&1 ) && say "    tsc installed" || say "    npm install FAILED"

say "9/9 starter scene + LightingSettings"
say "    $(ev "$SNIPPETS/bt-newscene.cs")"

say "VERIFY"
say "    $(evs 'string r = UnityTools.GetRootPath();
return "pro=" + ToolkitManager.IsPro()
     + " tsc=" + System.IO.File.Exists(System.IO.Path.Combine(r, CanvasTools.CVPanel.TscLocalPath))
     + " exportRoot=" + CanvasToolsInfo.DefaultProjectFolder
     + " scene=" + UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene().path;')"

if [ "$MODE" = "headless" ]; then
  say "headless mode -> stopping Editor (pid $EDPID) and releasing the licence seat"
  evs 'UnityEditor.SceneManagement.EditorSceneManager.SaveOpenScenes(); UnityEditor.AssetDatabase.SaveAssets(); return "saved";' >/dev/null
  # `unity close` quits the Editor gracefully on every platform; the pid kill is the fallback.
  unity close "$PROJ" --force --timeout 30 >/dev/null 2>&1 || stop_pid "$EDPID"
  sleep 3; rm -f "$PROJ/Temp/UnityLockfile" 2>/dev/null
  say "DONE. Project ready at $PROJ (no Editor running - the Hub can open it)"
else
  say "DONE. Editor pid $EDPID left running for copilot mode."
  say "NOTE: the project is NOT ready to open in the Hub until that Editor is stopped."
  say "      stop it with:  $SNIPPETS/bt-stop-editor.sh \"$PROJ\""
fi
