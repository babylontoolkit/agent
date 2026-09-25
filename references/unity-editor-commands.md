## Unity Editor Commands — The Complete Live-Editor Manual

**IMPORTANT. THIS DOCUMENT IS THE COMMAND MANUAL FOR A LIVE UNITY EDITOR. READ IT TO THE END BEFORE DRIVING ONE.**

> *Portions adapted from Unity-Technologies/skills and the `com.unity.pipeline` package documentation,
> © 2026 Unity Technologies, used under the Unity Companion License. Facts restated; command tables
> generated from a live Editor's own catalog.*

This is the **"what can I call, and how"** manual for a running Unity Editor. It covers every command the
`com.unity.pipeline` package registers (**151 in 0.7.0-exp.1**), the eight Babylon Toolkit `bt_*` commands,
and the three code-execution paths (`run_script`, `eval`, `eval_file`).

| Read together with | For |
|---|---|
| `unity-exporter-cli.md` | Installing the three packages, the one-shot scaffold, getting a drivable Editor, the licence, exporting glTF, the dev server |
| `unity-authoring-recipes.md` | *How to author* each part of a level (materials, GI, probes, post-processing, terrain, physics, navmesh, animation) so it **exports correctly** |
| `unity-cli-reference.md` | The `unity` binary itself — editors, projects, templates, `build`, `test`, `doctor`, `vcs`, exit codes |

**Verified against** Unity 6000.5.10f1 (macOS arm64), Unity CLI **1.0.0-beta.11**, `com.unity.pipeline`
**0.7.0-exp.1**. Every example in §2–§9 was run against a live Editor.

---

## 0. The five rules

1. **A typed command beats code.** If a command exists for it, call the command — it is validated, undoable,
   sandboxed, and returns structured identities you can chain. Code (`run_script` / `eval`) is for what no
   command covers.
2. **Code goes in a file, run by `run_script`.** `eval` is for one-liners only. `run_script` compiles a real
   `.cs` file — `using` directives, classes, LINQ, `async` — in memory with **no domain reload**.
3. **Discover, never guess.** The catalog changes between Pipeline versions. Before using a command you have not
   used in this session, confirm it: `unity command --query <word>` (§1).
4. **Destructive and settings commands need `confirm=true`** — and accept `dry_run=true` to preview. Always
   dry-run a settings or bake command once before applying it.
5. **Branch on `success`, never on `data`.** A failed command still prints a full JSON envelope to **stdout**.

---

## 1. Calling a command

```bash
unity command <name> [--<param> <value> ...] [--project-path <proj>] [--timeout <s>] [--format json | --result-only]
```

| Flag | Use |
|---|---|
| `--project-path <p>` | Which Editor. **Always pass it** when more than one Editor is running — otherwise the CLI picks the Editor whose project contains your cwd, and fails with `AMBIGUOUS_EDITOR` (exit 6, candidates in `data.candidates`) on a tie. |
| `--timeout <s>` | Default **30 s**. Raise it for exports, bakes-with-`wait`, big `run_script` builders. |
| `--format json` | Envelope `{ success, command, data, errors[], warnings[] }`. The command's own return value is at **`data.result`**. |
| `--result-only` | Print only the command's result JSON (no envelope). Handy for piping to `jq`/`python3`; do not combine with `--detach`. |
| `--detach` | Submit as a background job; prints a job id. Then `unity job wait <id>` / `unity job status <id>` / `unity job cancel <id>`. |

**Parameter values.** Scalars are plain (`--count 8`, `--confirm true`). Objects and arrays are **JSON strings**
in single quotes: `--position '[0,5,0]'`, `--settings '{"bounces":3}'`, `--target '{"hierarchyPath":"/Ground"}'`.

**Reading results:**

```bash
unity command editor_status --project-path "$PROJ" --format json \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['data']['result'] if d['success'] else d['errors'][0]['message'])"
```

`eval`, `eval_file` and `run_script` nest one level deeper: their value is at **`data.result.result`**, beside
`data.result.success`, `.error` / `.diagnostics`, and timing fields.

### Discovery — the listing form

With **no command name**, `unity command` lists the catalog. These flags only mean *listing* when no name is
given; after a name they are forwarded to that command as parameters.

```bash
unity command --query bake --detail compact --project-path "$PROJ"        # substring on name/description/tag
unity command --tag baking/lighting --format json --project-path "$PROJ"  # a tag subtree
unity command --group_by tag --detail compact --project-path "$PROJ"      # the whole map, grouped
unity command --detail full --limit 1000 --format json --project-path "$PROJ" > catalog.json   # every parameter schema
```

`--group_by` really is spelled with an underscore — do not "correct" it. `unity list --format json` is a
discovery-only alternative.

---

## 2. Handles — how commands name objects

Any parameter typed `ObjectRef` (`target`, `parent`, `prefab`, `material`, `asset`, `controller`, …) accepts
**one** of these forms. They are tried in order `globalId` → `path` → `guid` (+`fileId`) → `instanceId` →
`hierarchyPath`:

| Form | Example | Notes |
|---|---|---|
| Plain hierarchy path | `--target "/Directional Light"` | Leading `/`; resolves in loaded scenes |
| Plain asset path | `--material Materials/Stone.mat` | Has an extension → treated as an asset path; `Assets/` prefix optional |
| JSON handle | `--target '{"instanceId":568105584918845600}'` | Also `{"hierarchyPath":…}`, `{"path":…}`, `{"guid":…}`, `{"globalId":…}` |

**Every creating/mutating command returns an identity** (`instanceId`, `hierarchyPath`, `type`, `globalId`, and
for assets `assetPath` + `guid`). Feed it straight into the next call — that is how commands chain, and inside a
`batch` it is how `$0.instanceId` references work (§6).

`get_scene_hierarchy` returns every node's `instanceId` + `hierarchyPath`; `find_gameobjects` finds by
`name`/`tag`/`type`/`hierarchy_path`; `search` runs a Unity Search query (§9).

---

## 3. Safety conventions

| Convention | Rule |
|---|---|
| **`confirm` / `dry_run`** | Destructive, overwriting, and all project-settings / package / build commands refuse without `confirm=true`. `dry_run=true` validates and previews — it wins even if `confirm` is also set. Set-style commands report `{ applied[], unknown[] }`, so a dry run also catches misspelled keys. |
| **Authoring root** | Every path parameter resolves against the authoring root (default **`Assets`** — full access) and cannot escape it (`..` is rejected). `get_authoring_root` / `set_authoring_root --root Assets/AgentWork` narrows it to sandbox yourself. |
| **Undo** | Scene/object mutations (GameObjects, components, serialized fields, scene-side prefab ops) are one Undo step per command. **AssetDatabase writes, settings, packages, bakes, scene saves, and file writes are *not* undoable** — validate first. |
| **Play mode** | Scene-mutating commands are **blocked in Play mode**; read-only ones still work. `editor_stop` first. |
| **Saving** | Commands mutate the *open* scene in memory. Nothing is on disk until `save_scene` / `save_all`. The exporter and every later session read **disk** — always save before exporting. |

---

## 4. Asynchronous operations — trigger, then poll

Long operations return immediately and are finished by the Editor's update loop. **Never** busy-wait inside
`eval`/`run_script` for them — that blocks the loop that completes them. Trigger, then poll the matching
status command from the shell.

| Trigger | Poll until | Notes |
|---|---|---|
| `bake_lighting` | `lighting_bake_status` → `completed` | `cancel_lighting_bake`; `clear_baked_lighting --confirm true` |
| `bake_navmesh` (legacy) / `bake_navmesh_surfaces` (AI Navigation) | `navmesh_bake_status` → `completed` | `bake_navmesh_surfaces` returns `package_not_found` without `com.unity.ai.navigation` |
| `bake_occlusion_culling` | `occlusion_bake_status` → `completed` | |
| `package_add` / `package_remove` / `package_resolve` | `package_status` → `completed` / `failed` | then `recompile_status` (a domain reload follows) |
| `recompile` | `recompile_status` → `completed` or `up_to_date` | or the one-shot CLI verb `unity recompile` (§8) |
| `build` | `build_status` → `completed` | needs `confirm=true`; one build at a time |
| `switch_build_target` | `switch_build_target_status` | full reimport + domain reload |
| `run_tests --async_tests true` | `test_status` | `cancel_tests` |
| `audit` | `audit_status` | needs Project Auditor + `com.unity.project-auditor-rules` |
| `wait_for --async true` | `wait_status` | `wait_cancel` |

**Match status words unquoted.** Under `--result-only` some status commands (`lighting_bake_status`,
`navmesh_bake_status`, `package_status`, …) print their result as a **JSON-encoded string**
(`"{\"status\":\"completed\"}"`), others (`recompile_status`, `editor_status`) as plain JSON — so
`grep '"completed"'` never matches the first kind. Use `grep -q completed`, or parse `data.result` properly.

**A domain reload takes the Pipeline server down for ~15–25 s.** Every poll loop must treat *cannot connect* as
*not yet*, never as failure:

```bash
until unity command lighting_bake_status --project-path "$PROJ" --result-only 2>/dev/null | grep -q completed; do sleep 5; done
```

---

## 5. Code execution — pick the right tool

| You need to… | Use | Why |
|---|---|---|
| Do something a command covers | **the command** | Typed, undoable, sandboxed, chainable |
| Build many objects, wire fields, generate content, anything multi-statement | **`run_script`** | Real C# file, `using` allowed, in-memory compile (~0.1–0.3 s warm), no domain reload, `file:line` errors |
| Read one value / call one API | **`eval`** | One-liner, no file |
| Run a snippet you already have as a file | `eval_file` | Same compiler and rules as `eval` — *not* a real source file |
| Add a **persistent** type (a `MonoBehaviour`, an `EditorScriptComponent`) | write the `.cs` under `Assets/`, then `recompile` | Only a compiled project type can be attached as a component |

### 5.1 `run_script` — the builder pattern (verified)

Put the code in a `.cs` file **outside `Assets/`** (writing it then triggers no import and no reload) and call a
`static` entry point:

```bash
mkdir -p "$PROJ/AgentScripts"
cat > "$PROJ/AgentScripts/Probe.cs" <<'CS'
using UnityEngine;
using UnityEditor;
using System.Linq;

public static class Probe
{
    public static string Info(string label, int n)
    {
        var scene = UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene();
        var roots = scene.GetRootGameObjects().Select(g => g.name).Take(n);
        return label + " unity=" + Application.unityVersion + " scene=" + scene.path
             + " roots=" + string.Join(",", roots);
    }
}
CS
unity command run_script --file AgentScripts/Probe.cs --entry Probe.Info --args '["hello",3]' \
  --project-path "$PROJ" --format json
# data.result.result -> "hello unity=6000.5.10f1 scene=Assets/Scenes/SampleScene.unity roots=..."
```

| Parameter | Meaning |
|---|---|
| `--file` | Relative paths resolve against the **project root** (the folder holding `Assets/`). Absolute paths work too. |
| `--entry` | `Namespace.Type.Method`, `Type.Method`, or a bare method name. Default: the single public static method, else `Main`. |
| `--args` | JSON array coerced to the method's parameter types — primitives, enum names, `string[]`, and an `ObjectRef` handle for any `UnityEngine.Object` parameter. |
| `--dry_run true` | Compile only; returns `diagnostics`, loads and runs nothing. Use it to check a builder before running it. |
| `--timeout_ms` | Default 30000. Also bounds how long an `async Task<T>` entry is awaited. Raise the CLI `--timeout` to match. |
| `--pdb true` | Map exception stack traces to `file:line` precisely. |
| `--defines` | Extra `#if` symbols appended to the project's defines. |

Compile errors come back as full Roslyn diagnostics with line/column and execute nothing; runtime exceptions come
back as structured errors mapped to your file's lines. **Check `data.result.success`, not the outer `success`:**
a script that fails to compile still returns outer `success: true`, with `data.result.success: false`,
`data.result.error: "Compilation Failed"` and a `diagnostics[]` list (`id`, `line`, `column`, `message`, `source`).

**Namespaces trip builders.** The Babylon Toolkit's `UnityTools` and `WebServer` live in the **`System`**
namespace and `ToolkitManager` in **`UnityEngine`**; `CanvasToolsInfo` and `EditorBuildType` are global. A builder
that calls `UnityTools.*` needs `using System;` (CS0103 otherwise). `async Task<T>` entries are awaited without blocking the
Editor loop, so `await Task.Yield()` / `Task.Delay` work.

**Builder rules:**
- Prefer **one builder entry per job** over many tiny runs — each run keeps one small assembly loaded for the
  session (same as `eval`).
- A builder is still arbitrary code: it runs with the Editor's full rights, bypasses the authoring-root sandbox,
  and (unless you use `Undo` APIs yourself) is **not** undoable. Save the scene only when the build succeeded.
- Keep builders in `AgentScripts/` and commit them — they are a reproducible record of how a level was made.

### 5.2 `eval` / `eval_file` — one-liners

```bash
unity command eval 'return UnityEngine.Application.unityVersion;' --project-path "$PROJ" --format json
```

The snippet is compiled as a **method body**. Verified consequences:

| Rule | Symptom if broken |
|---|---|
| **No `using` directives** — in `eval` *and* `eval_file` | `Identifier expected`, `'UnityEngine' is a namespace but is used like a type` (CS0210 family) |
| **Fully qualify every type** — `UnityEngine.GameObject`, `UnityEditor.AssetDatabase` | CS0246 / CS0103; bare `Object` is ambiguous (CS0104) |
| **No extension-method syntax** — write `System.Linq.Enumerable.First(xs)` | method not found |
| **Prefer non-obsolete APIs** — `FindAnyObjectByType<T>()`, `FindObjectsByType<T>(FindObjectsInactive.Include, FindObjectsSortMode.None)`, `Rigidbody.linearVelocity` | Pipeline 0.5.0 compiled with warnings-as-errors, so obsolete calls and unreachable code failed there; 0.7.0 accepts them. Current names work on both |
| **`return` a string** rather than `Debug.Log` | You get the value back in `data.result.result` |
| **Fresh scope per call** | Nothing you declared survives to the next call |

A C# exception or compile error surfaces as outer `success:false` with the message in `errors[0].message`.
`eval_file` reads its path on the Unity side (relative to the Unity process's working directory) — pass an
absolute path.

**`eval` is for quick calls.** Its main-thread dispatch times out after about **5 s** (`Main thread operation timed
out after 5000ms`) regardless of `--timeout` — the work may still finish, but you lose the result. Anything
slower (a bake, a big import, a builder) goes through `run_script` with `--timeout_ms` and a matching `--timeout`.

**Undo from code.** `Undo.RecordObject` alone registers nothing useful when called from eval. For an undoable
change: `UnityEditor.Undo.IncrementCurrentGroup()` → `Undo.SetCurrentGroupName("…")` →
`Undo.RegisterCompleteObjectUndo(obj, "…")` → mutate → `UnityEditor.EditorUtility.SetDirty(obj)` →
`Undo.FlushUndoRecordObjects()` → `Undo.CollapseUndoOperations(group)`. Easier: use a typed command.

**AssetDatabase searches from code** must be scoped: `UnityEditor.AssetDatabase.FindAssets("t:Material", new[]{"Assets"})`
— unscoped, it also returns every package's assets.

---

## 6. `batch` — many commands, one request, one Undo step

`batch` runs up to 200 commands in one main-thread turn. Later operations reference earlier results with
`"$<id-or-index>.<jsonPath>"`. With `transactional` (the default) the whole batch is **one Undo step** and
**rolls back completely** if any operation fails.

```bash
unity command batch --project-path "$PROJ" --format json --operations '[
  {"id":"ball","command":"create_gameobject","params":{"name":"Ball","primitive":"sphere"}},
  {"command":"add_component","params":{"target":"$ball.instanceId","type":"Rigidbody"}},
  {"command":"set_transform","params":{"target":"$ball.instanceId","position":[0,5,0]}}
]'
unity command save_scene --project-path "$PROJ"      # standalone — see restrictions below
```

| Option | Default | Meaning |
|---|---|---|
| `transactional` | `true` | One Undo step + full rollback on failure |
| `on_error` | `abort` | `continue` runs every op and collects errors (forces `transactional=false`) |
| `dry_run` | `false` | Validates commands, parameters and `$` references without mutating — **run it first** |
| `time_budget_ms` | 50000 | Remaining ops are skipped (and a transactional batch rolls back) when exceeded |

**Transactional restrictions (verified):** anything that writes outside the Undo system is rejected with
`not_batchable_transactional` — asset and file writes, prefab **asset** writes, `save_scene`/`save_all`, build
list, all `set_*_settings`, animation/timeline asset edits, `set_material_properties`, and every bake. Run those
standalone, or in a batch with `"transactional": false`.

**Never batchable:** `open_scene`, `create_scene` (they wipe the Undo stack), `eval`, `eval_file`, `run_script`,
nested `batch`, `menu`, synchronous `wait_for`, `build`, `switch_build_target`, `package_*`, play-mode commands,
`recompile`, `run_tests`, `list_tests`.

References are **backward-only** and **whole-value** (the entire string must be the reference); `"$$"` escapes a
literal `$`. Results over 16 KiB are truncated in the echo (the reference still sees the full value); use
`result_fields` to project large results.

---

## 7. `wait_for` — wait on the Editor, not in a shell loop

`wait_for` evaluates a condition on the Editor's own frame loop and can **capture a screenshot in the same frame
it becomes true**:

```bash
# async (the default choice): returns a wait id immediately; other commands keep working
unity command wait_for --project-path "$PROJ" --async true --timeout_s 300 \
  --condition '{"member":"MatchManager.Instance.State","op":"equals","value":"Ended"}' \
  --on_met '{"capture":{"view":"game","source":"screen","save_path":"Screenshots/victory.png"}}'
unity command wait_status --wait_id <id> --project-path "$PROJ"
```

| Field | Values |
|---|---|
| `condition.member` | Dotted path to a **public** field/property — static, or on `target` (a handle) or `findType` (a type whose instance is found) |
| `condition.op` | `equals`, `notEquals`, `greaterThan`, `lessThan`, `contains`, `changed` |
| `tolerate_missing` | `true` retries while the type/object does not exist yet (spawn waits) |
| `on_met` | `{ capture: {view, source, save_path, width, height}, pause: true }` |

**Use sync only when** the wait is short (< 30 s) **and** needs no further command from you — a sync wait blocks
the command queue, so a condition that depends on your next command deadlocks until timeout. A domain reload or
exiting play mode resolves every wait as `interrupted`.

---

## 8. Seeing, reading, compiling, testing

### 8.1 Seeing the Editor

| Command | Captures | Use |
|---|---|---|
| `screenshot --view game\|scene --output <png> --width --height` | Game or Scene view to a file, returns the path | Simplest visual check |
| `capture_game_view --save_path <png>` | A camera (`source=camera`, default; `--camera <name>`) or the composited screen (`source=screen`, **Play Mode only**, includes Screen-Space-Overlay UI) | Checking what the player sees |
| `capture_scene_view --save_path <png>` | The active Scene View camera | Checking layout from the editing camera |

Without `save_path`, `capture_*` return the PNG **inline as base64**. `save_path` resolves under the **authoring
root** — `Screenshots/x.png` lands in `Assets/Screenshots/` and gets imported as an asset. To keep captures out of
the project, use `screenshot --output <absolute path>`, which writes anywhere. Then open the file and look at it.

> **Unity-side captures need a GUI Editor.** In a resident `-batchmode` Editor (the scaffold's default), camera
> renders came back showing **only the skybox** — no scene geometry, at any resolution, with `screenshot`,
> `capture_game_view` and a manual `Camera.Render` alike (Unity 6000.5.10f1, Metal, URP template; the Editor log
> showed GPU-Resident-Drawer job exceptions). Do Unity-side visual QA in a **GUI** Editor (`unity open`, with
> `set_autotick` on so it keeps rendering unfocused), and always judge the **exported** level in the browser —
> that is the result that ships. `max_resolution` caps the inline image only. For
multi-angle shots, move the Scene View camera (`SceneView.lastActiveSceneView.pivot/rotation/size`) from
`run_script`, then capture.

### 8.2 Reading the Editor

| Command | Returns |
|---|---|
| `editor_status` | `status` — `ready`, `settling` (cold import/compile still running: wait), or **`blocked_by_dialog`** with a `dialog` payload (title, buttons) — plus `compiling`, `domainReloadInProgress`, `playMode`, version. A modal dialog blocks every main-thread command: stop retrying, and avoid the code path that opened it (`Automate` exports, no `menu`). Headless Editors cancel dialogs instead. |
| `console --tail 50 --level warn` | Captured console entries plus a `cursor` + `session`. Follow with `--since <cursor> --since_session <session>`; a stale pair returns the tail with `reset=true`. |
| `console_status` | Cheap: `groundTruth.compilationFailed`, `compiling`, console error/warning counts. Poll this while a compile runs. |
| `clear_console` | Clears buffer + Console (sticky compile errors stay until the next compile) |
| `get_performance_stats` | Render, memory, frame timing |
| `list_open_scenes`, `get_scene_hierarchy`, `get_selection` | Scene state |

The Editor log file is still the ground truth for export and TypeScript errors (`grep -E "error TS|Failed to
build" <logFile>`) — see `unity-exporter-cli.md` §15.

### 8.3 Keep an unfocused Editor responsive

A GUI Editor that is not the foreground app ticks slowly, so compiles, tests and async commands crawl.
In copilot mode, once per session:

```bash
unity command set_autotick --enable true --project-path "$PROJ"     # ~60 Hz forced tick; survives domain reloads
```

`--interval_ms 0` pegs a CPU core — use it only with `--persist false`. Headless (`-batchmode`) Editors do not
need it.

### 8.4 Compile and test loop

```bash
unity recompile --project-path "$PROJ" --format json   # CLI verb (beta.11+): exit 0 ok, 6 compile errors, 7 no Editor reachable
                                                       # prints file:line:col diagnostics; --strict fails on warnings
# or, command form:  unity command recompile  ->  poll  unity command recompile_status
unity command list_tests --mode editor --project-path "$PROJ"
unity command run_tests  --mode editor --filter MyTests --project-path "$PROJ" --timeout 300
```

`create_script` → `recompile` → poll → `attach_script` is the path for a **persistent** component type.
`attach_script` on a not-yet-compiled type returns a *recoverable* error — recompile and retry.

---

## 9. Packages, search, menus

```bash
unity command package_add --identifier com.unity.ai.navigation --dry_run true --project-path "$PROJ"   # preview
unity command package_add --identifier com.unity.ai.navigation --confirm true --project-path "$PROJ"   # async
until unity command package_status --project-path "$PROJ" --result-only 2>/dev/null | grep -qE 'completed|failed'; do sleep 5; done
unity command package_list --project-path "$PROJ" --format json          # installed (default) | available | all
unity command package_search --query com.unity.timeline --project-path "$PROJ"
```

`--identifier` takes `name`, `name@version`, a **git URL**, or `file:<path>` — so the two Babylon Toolkit git
packages install the same way (`unity-exporter-cli.md` §4.1). Add packages **one at a time**; a second
operation while one is running returns `busy`.

**Unity Search** (`search --query … --limit`) takes Unity Search syntax: `t:Material`, `t:[Texture2D,Material]`,
`t:Light`, `dir:Levels`, `l:<label>`, `p: <text>` (project), `h: <name>` (hierarchy), `ref=<asset>` and
`ref={t:texture}` (what references what). Results carry `path` and a `globalId` handle.

**`menu --path "Assets/Reimport All"`** runs any menu item (omit `--path` to list them). Menu items can open
modal dialogs that wedge a GUI Editor — prefer a command or code.

---

## 10. The Babylon Toolkit commands (`bt_*`)

Shipped in `com.babylontoolkit.editor` 9.22.3+ (`Editor/CLI/`), registered only when `com.unity.pipeline` is
present. Full behaviour: `unity-exporter-cli.md` §11.

| Command | Parameters | Does |
|---|---|---|
| `bt_status` | — | Exporter readiness: toolkit version, active scene, `pro`, export root, formats, compiling/baking, dev server |
| `bt_refresh` | `force`=false | `AssetDatabase.Refresh` so rebuilt toolkit libraries reload |
| `bt_export_level` | `scene`, `filename`, `folder`, `geometryOnly`=**true**, `compileScripts`=false | Export the active (or named — **asset path**, e.g. `Assets/Scenes/Level01.unity`) scene as a game level. `geometryOnly=true` skips the script bundle and web project; `compileScripts=true` still compiles `Assets/**/*.ts` into the bundle |
| `bt_export_prefab` | `paths` (comma-separated hierarchy paths), `filename`, `folder`, `metadata`=true | Export selected transforms as an asset container (no scene metadata) |
| `bt_export_animation` | `path`, `filename`, `folder` | Export one animated transform as a `.glb` |
| `bt_build_project` | — | Full `EditorBuildType.Automate` build: scene + TypeScript bundle + web project |
| `bt_devserver_start` | `port`=0 (keep current) | Start the toolkit dev web server |
| `bt_devserver_status` | — | Server state, root, ports |

---

## 11. Full command catalog (generated)

Generated from `unity command --detail full --format json` on `com.unity.pipeline` **0.7.0-exp.1**. Descriptions
are the command's own first sentence. For complete parameter descriptions and types, run
`unity command --query <name> --detail full --format json`. Commands marked **Runtime-only** in the package
(`simulate_key`, `simulate_pointer`, `set_timescale`, `quit`, …) exist only on a development **Player** build
reached with `--runtime`, and are not listed.

**Regenerate** this section whenever `unity pipeline list` reports a new version:
`unity command --detail full --limit 1000 --format json > catalog.json`, then rebuild the tables from
`data.commands[]` (`name`, `tags[0]`, `parameters[].name/required/defaultValue`, `description`). A command that
disappears in a new version must be removed here, not left as a phantom.

### GameObjects & components

| Command | Parameters (`*` required, `=default`) | What it does |
|---|---|---|
| `add_component` | `target`\*, `type`\* | Add a component (by type name) to a GameObject. |
| `create_gameobject` | `name`, `primitive`, `parent` | Create an empty GameObject or a built-in primitive (cube/sphere/capsule/cylinder/plane/quad) in the active scene. |
| `create_gameobjects` | `name`, `primitive`, `parent`, `count`=1, `positions`, `rotations`, `scales` | Batch-create N empty GameObjects or primitives in one call. Optional positions/rotations/scales are arrays of [x,y,z] (length must equal count). |
| `delete_gameobject` | `target`\* | Delete a GameObject from the scene (reversible via Undo). |
| `find_gameobjects` | `name`, `tag`, `type`, `hierarchy_path`, `include_inactive`=true | Find GameObjects in loaded scenes by name, tag, component type, and/or hierarchy path (filters are combined). |
| `get_component_properties` | `target`\*, `type` | Get a component's serialized properties as a JSON map. Address the component by handle, or by GameObject handle + type. |
| `remove_component` | `target`\*, `type` | Remove a component from a GameObject. Provide either a component handle (target) or a GameObject handle (target) plus a type name. |
| `rename_gameobject` | `target`\*, `name`\* | Rename a GameObject. |
| `set_active` | `target`\*, `active`\* | Set a GameObject's active self-state (activeSelf). |
| `set_component_properties` | `target`\*, `properties`\*, `type` | Set serialized properties on a component (one Undo step). 'properties' maps property name -> value; object references accept an ObjectRef handle. |
| `set_layer` | `target`\*, `layer`\* | Set a GameObject's layer by name or numeric index (0-31). |
| `set_parent` | `target`\*, `parent`, `world_position_stays`=true | Reparent a GameObject under a new parent, or detach it to scene root when no parent is given. |
| `set_tag` | `target`\*, `tag`\* | Set a GameObject's tag (the tag must already exist in the project). |
| `set_transform` | `target`\*, `position`, `rotation`, `scale` | Set a GameObject's local position/rotation(euler)/scale. Omitted channels are left unchanged. |

### Scenes & build list

| Command | Parameters (`*` required, `=default`) | What it does |
|---|---|---|
| `add_scene_to_build` | `path`\*, `enabled`=true | Add a scene to the Build Settings scene list (idempotent). Optionally enable it. |
| `create_scene` | `path`\*, `additive`=false, `template`="empty" | Create a new scene and save it to the given path under the authoring root. |
| `get_scene_hierarchy` | `path` | Return the GameObject tree of an open scene (or the active scene). |
| `list_open_scenes` | — | List all currently open scenes with their load/active/dirty state. |
| `open_scene` | `path`\*, `additive`=false | Open an existing scene from the given path. |
| `remove_scene_from_build` | `path`\* | Remove a scene from the Build Settings scene list (idempotent). |
| `save_all` | — | Save all open scenes that have unsaved changes. |
| `save_scene` | `path` | Save an open scene. Saves the active scene when no path is given. |
| `set_active_scene` | `path`\* | Set which open scene is the active scene (new objects are created in the active scene). |

### Prefabs

| Command | Parameters (`*` required, `=default`) | What it does |
|---|---|---|
| `apply_prefab_overrides` | `instance`\* | Apply a prefab instance's overrides back to its source prefab asset. |
| `create_prefab` | `source`\*, `path`\* | Save a GameObject as a prefab asset at a project path; the source becomes a connected instance. |
| `create_prefab_variant` | `base`\*, `path`\* | Create a prefab variant asset that inherits from a base prefab. |
| `instantiate_prefab` | `prefab`\*, `scene_path`, `name` | Instantiate a prefab asset into a loaded scene and return the created instance. |
| `revert_prefab_overrides` | `instance`\* | Revert a prefab instance's overrides so it matches its source prefab asset. |
| `save_prefab_contents` | `prefab`\*, `rename_child`, `new_name`, `set_active_child`, `active`=true | Open a prefab asset in an isolated prefab stage, apply a declarative edit, and save it back (nested-prefab safe). |
| `unpack_prefab` | `instance`\*, `completely`=false | Unpack a prefab instance into plain GameObjects (outermost level or completely). |

### Assets, import settings & text files

| Command | Parameters (`*` required, `=default`) | What it does |
|---|---|---|
| `copy_asset` | `asset`\*, `destination`\*, `confirm`=false, `dry_run`=false | Copy an asset to a new path under the authoring root. The copy gets a fresh GUID. |
| `create_asset` | `path`\*, `type`\*, `shader`, `confirm`=false, `dry_run`=false | Create a new ScriptableObject (or other UnityEngine.Object) asset of the given type at a path under the authoring root. |
| `create_folder` | `path`\* | Create a folder under the authoring root (creates intermediate folders). |
| `delete_asset` | `asset`\*, `confirm`=false, `dry_run`=false | Delete an asset from the project. Destructive: requires confirm=true. |
| `find_assets` | `type`, `name`, `label`, `search_in`, `limit`=200 | Find assets by type and/or name and/or label, returning their path, GUID and type. |
| `get_import_settings` | `asset`\*, `platform`="Default" | Read an asset's import settings, structured by importer type (texture/model/audio), including the default-platform fields and (for textures/audio) one platform override block. |
| `import_asset` | `source`\*, `path`\*, `confirm`=false, `dry_run`=false | Import an external file (e.g. a texture, model, audio clip) into the project by copying it to a path under the authoring root, then importing it. |
| `move_asset` | `asset`\*, `destination`\*, `dry_run`=false | Move (or rename via a new path) an asset to a new location under the authoring root. |
| `read_text_file` | `path`\*, `max_bytes`=1048576 | Read a UTF-8 text file under the authoring root and return its contents. |
| `rename_asset` | `asset`\*, `new_name`\*, `dry_run`=false | Rename an asset in place (keeps it in the same folder, keeps its GUID). |
| `set_import_settings` | `asset`\*, `settings`\*, `platform`="Default", `dry_run`=false | Set import settings on an asset's AssetImporter (default platform top-level properties, or a texture/audio per-platform override) and re-import it. |
| `write_text_file` | `path`\*, `contents`\*, `confirm`=false, `dry_run`=false | Write UTF-8 text to a file under the authoring root, then import it. |

### Materials & shaders

| Command | Parameters (`*` required, `=default`) | What it does |
|---|---|---|
| `get_material_properties` | `material`\* | Read a material's shader, render queue, enabled keywords, and all shader properties with their current values (Color as [r,g,b,a], Vector as [x,y,z,w], Texture as an object reference). |
| `get_shader_properties` | `shader`, `material` | Introspect a shader's declared property list (name, description, type Color\|Vector\|Float\|Range\|TexEnv\|Int, range, textureDimension, flags). |
| `list_shaders` | `filter`, `includeBuiltin`=true, `limit`=200 | Discover available shaders so an agent can pick a valid name for set_material_properties / create_asset. |
| `set_material_properties` | `material`\*, `shader`, `properties`, `renderQueue`, `enableKeywords`, `disableKeywords`, `confirm`=false, `dry_run`=false | Set shader properties on a material (Float/Range/Int=number; Color=[r,g,b,a] or "#RRGGBBAA" hex; Vector=[x,y,z,w]; Texture=an object reference or null to clear), optionally reassign the shader, set the render queue, and toggle ke… |

### Animation — clips, Animator controllers, Timeline

| Command | Parameters (`*` required, `=default`) | What it does |
|---|---|---|
| `add_animator_layer` | `controller`\*, `name`\*, `weight`=1, `blendingMode`="Override", `dry_run`=false | Add a layer to an AnimatorController. |
| `add_animator_parameter` | `controller`\*, `name`\*, `type`\*, `defaultValue`, `dry_run`=false | Add a parameter (Float \| Int \| Bool \| Trigger) to an AnimatorController. |
| `add_animator_state` | `controller`\*, `layer`, `name`\*, `motion`, `isDefault`=false, `position`, `dry_run`=false | Add a state to a layer, optionally with a motion (AnimationClip or BlendTree) and as the layer default. |
| `add_animator_transition` | `controller`\*, `layer`, `fromState`\*, `toState`\*, `conditions`, `hasExitTime`=false, `exitTime`=0, `duration`=0.25, `hasFixedDuration`=true, `dry_run`=false | Add a transition between two states (or from AnyState/Entry, to Exit) on a layer, with optional conditions. |
| `add_timeline_clip` | `timeline`\*, `track`\*, `start`\*=0, `duration`\*=0, `asset`, `dry_run`=false | Add a clip to a named track on a TimelineAsset. For Animation tracks pass an AnimationClip asset; for Audio tracks an AudioClip. |
| `add_timeline_track` | `timeline`\*, `trackType`\*, `name`, `parentTrack`, `dry_run`=false | Add a track (Animation \| Audio \| Activation \| Control \| Playable \| Signal \| Marker) to a TimelineAsset, optionally nested under a parent group/track. |
| `create_animation_clip` | `path`\*, `frameRate`=60, `loop`=false, `confirm`=false, `dry_run`=false | Create an empty .anim AnimationClip asset under the authoring root, with an optional frame rate and loop flag. |
| `create_animator_controller` | `path`\*, `confirm`=false, `dry_run`=false | Create an .controller AnimatorController asset (with a default Base Layer) under the authoring root. |
| `create_timeline` | `path`\*, `frameRate`=60, `confirm`=false, `dry_run`=false | Create a .playable TimelineAsset under the authoring root (optional frame rate). |
| `get_animation_clip` | `clip`\*, `includeKeys`=false | Read an AnimationClip's metadata and all float curve bindings (optionally with keyframes). |
| `get_animator_controller` | `controller`\* | Read an AnimatorController's full structure: parameters, layers, states (with motion / default), and transitions (with conditions). |
| `get_timeline` | `timeline`\* | Read a TimelineAsset's structure: frame rate, duration, and its tracks with their clips. |
| `remove_animation_curve` | `clip`\*, `path`, `type`\*, `property`\*, `confirm`=false, `dry_run`=false | Remove a float curve binding from an AnimationClip (SetEditorCurve(clip, binding, null)). |
| `set_animation_curve` | `clip`\*, `path`, `type`\*, `property`\*, `keys`\*, `dry_run`=false | Add or replace a single float curve binding on an AnimationClip (via AnimationUtility.SetEditorCurve). |

### Baking — lighting, NavMesh, occlusion

| Command | Parameters (`*` required, `=default`) | What it does |
|---|---|---|
| `bake_lighting` | `confirm`=false, `dry_run`=false | Trigger an async lightmap bake of the open scene(s) via Lightmapping.BakeAsync(). |
| `bake_navmesh` | `confirm`=false, `dry_run`=false | Trigger an async legacy NavMesh bake of the open scene(s) via UnityEditor.AI.NavMeshBuilder. |
| `bake_navmesh_surfaces` | — | Bake NavMeshSurface components (AI Navigation package). v1 stub: returns package_not_found when the package is absent. |
| `bake_occlusion_culling` | `smallest_occluder`=-3.40282347e+38, `smallest_hole`=-3.40282347e+38, `backface_threshold`=-3.40282347e+38, `confirm`=false, `dry_run`=false | Trigger an async occlusion-culling bake of the open scene(s) via StaticOcclusionCulling.GenerateInBackground(). |
| `cancel_lighting_bake` | — | Cancel an in-progress lighting bake (Lightmapping.Cancel()). |
| `cancel_navmesh_bake` | — | Cancel an in-progress NavMesh bake (NavMeshBuilder.Cancel()). |
| `cancel_occlusion_bake` | — | Cancel an in-progress occlusion bake (StaticOcclusionCulling.Cancel()). |
| `clear_baked_lighting` | `confirm`=false, `include_disk_cache`=false, `dry_run`=false | Clear baked lightmap data for the open scene(s). Destructive: requires confirm=true. |
| `clear_navmesh` | `confirm`=false, `dry_run`=false | Clear the baked NavMesh for the open scene(s). Destructive: requires confirm=true. |
| `clear_occlusion_culling` | `confirm`=false, `dry_run`=false | Clear baked occlusion-culling data for the open scene(s). Destructive: requires confirm=true. |
| `get_lighting_settings` | — | Read the active LightingSettings (lightmapper, bounces, resolution, directional mode, AO, etc.). |
| `get_navmesh_settings` | — | Read the default agent's legacy NavMesh bake settings (agentRadius/Height/Slope/Climb, minRegionArea, voxelSize). |
| `lighting_bake_status` | — | Get the status of the last lighting bake: idle \| baking \| completed. |
| `navmesh_bake_status` | — | Get the status of the last NavMesh bake: idle \| baking \| completed. |
| `occlusion_bake_status` | — | Get the status of the last occlusion bake: idle \| baking \| completed. |
| `set_lighting_settings` | `settings`\*, `dry_run`=false | Apply a subset of lighting settings to the active LightingSettings. |
| `set_navmesh_settings` | `settings`\*, `dry_run`=false | Apply a subset of legacy NavMesh bake settings to the default agent. |

### Project settings

| Command | Parameters (`*` required, `=default`) | What it does |
|---|---|---|
| `get_audio_settings` | — | Read project Audio settings (volume, rolloff scale, doppler factor). |
| `get_graphics_settings` | — | Read GraphicsSettings (default render pipeline). |
| `get_input_settings` | — | Read the legacy Input Manager axes (names and count). |
| `get_physics_settings` | — | Read Physics settings (gravity, solver iterations, bounce threshold). |
| `get_player_settings` | — | Read PlayerSettings (company/product/version, scripting backend, API level). |
| `get_quality_settings` | — | Read QualitySettings (current level, level names, vSync, anti-aliasing). |
| `get_runtime_pipeline_settings` | — | Read Pipeline Runtime settings (enableInBuilds, port, requestTimeoutMs, enableAuditLogging, autoStart, maxWorkItemsPerFrame). |
| `get_tags_layers` | — | Read the project's tags and (named) layers. |
| `get_time_settings` | — | Read Time settings (fixedDeltaTime, maximumDeltaTime, timeScale). |
| `set_audio_settings` | `settings`, `confirm`=false, `dry_run`=false | Change project Audio settings. Requires confirm=true; use dry_run to preview. |
| `set_graphics_settings` | `settings`, `confirm`=false, `dry_run`=false | Set the default render pipeline asset. Requires confirm=true; use dry_run to preview. |
| `set_input_settings` | `settings`, `confirm`=false, `dry_run`=false | Tune a legacy Input Manager axis (sensitivity/gravity/dead) by name. |
| `set_physics_settings` | `settings`, `confirm`=false, `dry_run`=false | Change Physics settings. Requires confirm=true; use dry_run to preview. |
| `set_player_settings` | `settings`, `confirm`=false, `dry_run`=false | Change PlayerSettings. Requires confirm=true; use dry_run to preview. |
| `set_quality_settings` | `settings`, `confirm`=false, `dry_run`=false | Change QualitySettings. Requires confirm=true; use dry_run to preview. |
| `set_runtime_pipeline_settings` | `settings`, `confirm`=false, `dry_run`=false | Change Pipeline Runtime settings. Requires confirm=true; use dry_run to preview. |
| `set_tags_layers` | `settings`, `confirm`=false, `dry_run`=false | Add/remove tags and assign user layer names (index 8-31). Requires confirm=true; use dry_run to preview. |
| `set_time_settings` | `settings`, `confirm`=false, `dry_run`=false | Change Time settings. Requires confirm=true; use dry_run to preview. |

### Player build & build settings

| Command | Parameters (`*` required, `=default`) | What it does |
|---|---|---|
| `build` | `target`, `outputPath`, `profileName`, `options`, `scenes`, `confirm`=false, `dry_run`=false | Trigger an async Player build and report the full BuildReport. |
| `build_status` | — | Status of the current/most recent build: idle \| queued \| building \| completed, with the full BuildReport (files, packedAssets, buildSteps, errors, warnings) once completed. |
| `get_build_settings` | — | Read the current build configuration from EditorUserBuildSettings / EditorBuildSettings. |
| `list_build_profiles` | — | List Build Profile assets in the project (Unity 6 only). Returns feature_unavailable on earlier versions. |
| `list_build_targets` | — | List the known BuildTarget values with their group and whether build support is installed. |
| `set_build_settings` | `settings`, `confirm`=false, `dry_run`=false | Set mutable EditorUserBuildSettings fields. Does NOT manage scenes (use add_scene_to_build / remove_scene_from_build) or switch target (use switch_build_target). |
| `switch_build_target` | `target`\*, `confirm`=false | Switch the active build target (destructive, long-running: triggers a full reimport + domain reload). |
| `switch_build_target_status` | — | Status of the last target switch: idle \| switching \| completed (with success + activeBuildTarget). |

### Capture (seeing the Editor)

| Command | Parameters (`*` required, `=default`) | What it does |
|---|---|---|
| `capture_game_view` | `width`=1280, `height`=720, `camera`, `save_path`, `include_inline_image`=false, `max_resolution`=0, `source`="camera" | Render the game view to a PNG. source=camera (default) renders a camera and misses Screen Space - Overlay UI; source=screen captures the composited backbuffer incl. |
| `capture_scene_view` | `width`=1280, `height`=720, `save_path`, `include_inline_image`=false, `max_resolution`=0 | Render the active Scene View to a PNG. Returns it inline as base64, unless save_path is set (path-only result; pass include_inline_image=true to get both). |
| `screenshot` | `view`="game", `output`, `width`=0, `height`=0 | Capture the Scene or Game view as a PNG and return its file path |

### Editor lifecycle & play mode

| Command | Parameters (`*` required, `=default`) | What it does |
|---|---|---|
| `editor_focus` | — | Bring the Unity Editor window to the foreground |
| `editor_pause` | — | Toggle pause state of Unity Editor play mode |
| `editor_play` | — | Enter Unity Editor play mode |
| `editor_status` | — | Get detailed Unity Editor status and state information |
| `editor_stop` | — | Exit Unity Editor play mode |
| `menu` | `path` | Execute an Editor menu item by path, or list available items when no path is given |
| `set_autotick` | `enable`=true, `interval_ms`=16, `persist`=true | Keep the editor ticking while unfocused by forcing EditorApplication.SignalTick at a throttled rate |

### Observability — console, audit, performance

| Command | Parameters (`*` required, `=default`) | What it does |
|---|---|---|
| `audit` | `categories`, `output` | Run a Project Auditor static-analysis scan. Returns immediately; poll audit_status until status is 'completed', then read the CSV. |
| `audit_status` | — | Get the status of the last audit: idle \| scanning \| completed \| failed \| interrupted \| unavailable. |
| `clear_console` | — | Clear the captured log buffer and the Unity Editor console. |
| `console` | `tail`=100, `level`="log", `since`=-1, `since_session` | Get captured Unity console output (Editor or Player; supports tail, level filtering, and follow via a cursor) |
| `console_status` | — | Console ground truth and buffer counters without pulling entries: compile-failure flag, Editor console counts, and the buffer's retained counts and cursor. |
| `get_performance_stats` | — | Read render, memory, and frame-timing stats (structured, read-only). |
| `report_evals` | `top`=50 | Aggregate local eval-usage telemetry into a ranked report: API fingerprint frequency, one-liner percentage, error rate, and command-coverage suggestions. |

### Packages (UPM)

| Command | Parameters (`*` required, `=default`) | What it does |
|---|---|---|
| `package_add` | `identifier`\*, `confirm`=false, `dry_run`=false, `wait`=false | Add a UPM package by name@version, git URL, or 'file:' local path. |
| `package_list` | `scope`="installed", `include_indirect`=true, `offline`=false | List packages by scope: installed (default) \| available (registry) \| all (both). |
| `package_remove` | `name`\*, `confirm`=false, `dry_run`=false, `wait`=false | Remove a UPM package by name. Async by default (returns in_progress; poll package_status); pass wait=true to block until removed. |
| `package_resolve` | — | Resolve/refresh packages from the manifest (re-fetch and re-link). |
| `package_search` | `query`, `offline`=false | Search packages available in the registry. Provide a name (e.g. |
| `package_status` | — | Status of the last async package operation (add/remove/resolve): idle \| in_progress \| completed \| failed, with the added package, manifest, and any error. |

### Tests

| Command | Parameters (`*` required, `=default`) | What it does |
|---|---|---|
| `cancel_tests` | — | Cancel running test execution |
| `list_tests` | `mode`="all" | List all available tests (EditMode and/or PlayMode) without running them |
| `run_tests` | `mode`="all", `filter`, `filter_type`="testName", `include_explicit`=false, `async_tests`=false, `timeout`=300 | Execute Unity tests with filtering options |
| `test_status` | — | Get status of running async test execution |

### Scripts — eval, run_script, compile, code reload

| Command | Parameters (`*` required, `=default`) | What it does |
|---|---|---|
| `attach_script` | `target`\*, `type`, `script` | Add a MonoBehaviour to a GameObject by its (compiled) type name OR by its script asset path. |
| `create_script` | `name`\*, `path`, `namespace`, `base_class`="MonoBehaviour", `overwrite`=false | Create a new C# script (default base class MonoBehaviour) from a template under the authoring root. |
| `eval` | `code`\*, `timeout`=5000 | Evaluate C# code dynamically using Roslyn compiler |
| `eval_file` | `file`\*, `timeout`=5000 | Evaluate C# code read from a .cs file on disk |
| `get_serialized_fields` | `target`\*, `field`, `component`, `format` | Read serialized fields of a component/asset. Returns each top-level field's name, type and value (object references are returned as re-usable handles). |
| `recompile` | `focus`=false | Force a script recompile (works while unfocused/minimized). Poll recompile_status for completion. |
| `recompile_status` | — | Get the status of the last recompile: idle \| triggered \| compiling \| completed \| up_to_date. |
| `reload_file` | `filename`\*, `timeout`=30000, `assemblyDir`, `pdb`=false | Compile and apply in-place [CodeReload] edits from a source file |
| `reload_file_editor_interpreter` | `filename`\*, `timeout`=30000, `assemblyDir`, `pdb`=false | Compile in-place [CodeReload] edits and run them through the IlInterpreter VM in this process instead of Assembly.Load (IL2CPP-safe; only a minimal host API + the target type are available) |
| `reload_file_player_interpreter` | `filename`\*, `player`=-1 | Compile a file's (or folder's) [CodeReload] method(s) and push the IL to a connected player (IL2CPP-safe) over PlayerConnection. |
| `run_script` | `file`\*, `entry`, `args`, `mode`="ephemeral", `references`, `defines`, `pdb`=false, `timeout_ms`=30000, `dry_run`=false | Compile a project C# file in memory (no domain reload) and execute a named static entry point. |
| `set_serialized_field` | `target`\*, `field`\*, `value`\*, `component` | Set a serialized field on a component/asset. Supports primitives, enums, Vector/Color/Rect/Bounds, object references (value = an ObjectRef: asset by guid/fileId/path or scene object by instanceId/hierarchyPath), and array element… |

### Selection & Unity Search

| Command | Parameters (`*` required, `=default`) | What it does |
|---|---|---|
| `get_selection` | — | Read the current Editor selection as structured object identities. |
| `search` | `query`\*, `limit`=50 | Run a Unity Search query and return structured results. |
| `set_selection` | `instance_ids`, `paths` | Set the Editor selection to the given assets/scene objects. |

### Authoring root

| Command | Parameters (`*` required, `=default`) | What it does |
|---|---|---|
| `get_authoring_root` | — | Get the base folder (under Assets/) that bare authoring paths resolve against. |
| `set_authoring_root` | `root`\* | Set the base folder (under Assets/) that bare authoring paths resolve against and are confined to. |

### Server-side waits

| Command | Parameters (`*` required, `=default`) | What it does |
|---|---|---|
| `wait_cancel` | `wait_id`\* | Cancel an async wait started with wait_for (async=true). |
| `wait_for` | `condition`\*, `timeout_s`=30, `poll_interval_ms`=100, `on_met`, `return_history`=false, `tolerate_missing`=false, `async`=false | Wait server-side until a member condition holds, then optionally act in the same frame. |
| `wait_status` | `wait_id`\* | Get the status/result of an async wait started with wait_for (async=true). |

### Batch

| Command | Parameters (`*` required, `=default`) | What it does |
|---|---|---|
| `batch` | `operations`\*, `transactional`=true, `on_error`="abort", `dry_run`=false, `result_fields`, `time_budget_ms`=50000 | Run multiple registered commands in one transactional request. |

