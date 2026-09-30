## Unity Exporter — Internals (read on demand)

> Section numbers (§N) refer to [`unity-exporter-cli.md`](https://raw.githubusercontent.com/babylontoolkit/agent/main/references/unity-exporter-cli.md) unless the section is in this document. §9, §10, §13, §14 and the §15 symptom table are here.

## 9. The export API — `CanvasToolsExporter.BuildProject`

The single entry point for **all** Babylon Toolkit exports. Verified signature:

```csharp
namespace CanvasTools
{
    [InitializeOnLoad]
    public static class CanvasToolsExporter
    {
        public static void BuildProject(
            EditorBuildType mode,                  // what to build
            Transform[]     selection      = null, // null = whole scene; non-null = prefab / asset container
            string          filename       = null, // output name, no extension (null = PascalCase scene name)
            string          folder         = null, // output folder (null = <Project>/Export)
            bool            animationMode  = false,// true = animation-only export, forces .glb
            int             exportHandSystem  = 1, // handedness conversion
            int             exportMeshSystem  = 1, // mesh conversion
            bool            exportUnityMetadata = true);  // emit extras.metadata (components!)
    }
}
```

### `EditorBuildType`

| Value | # | Compiles scripts | Exports scene | Builds web project | PWA | Auto-deploy | Shows dialogs |
|---|---|---|---|---|---|---|---|
| `Launch` | 0 | — | — | — | — | — | opens preview and returns immediately |
| `Script` | 1 | ✅ | — | — | — | — | ✅ confirm + completion |
| `Scene` | 2 | — | ✅ | — | — | — | ✅ confirm¹ + completion |
| `Project` | 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ confirm + completion |
| **`Automate`** | **4** | ✅ | ✅ | ✅ | ✅ | — | **❌ none** |

¹ The confirm dialog is **skipped whenever `selection != null`**, so prefab exports never prompt.

> **`Automate` is `Project` minus every dialog (and minus auto-deploy). It is the mode for all agent and CI
> work.** See §9.1 for why this is not optional.

### Every observed call form

| Intent | Call |
|---|---|
| Export **selected transforms** as a prefab / asset container | `BuildProject(EditorBuildType.Scene, transforms, "Crate", "/abs/out/dir", false, info.HandedExportSystem, info.MeshExportSystem, info.ExportMetadata)` |
| Export the **whole active scene** as a game level | `BuildProject(EditorBuildType.Scene, null, null, null, false, info.HandedExportSystem, info.MeshExportSystem, info.ExportMetadata)` |
| **Full project build** (scripts + scene + web + PWA + deploy) | `BuildProject(EditorBuildType.Project, null, null, null, false, …)` |
| **Compile TypeScript/JS only** | `BuildProject(EditorBuildType.Script, null, null, null, false, …)` |
| **Open the browser preview**, build nothing | `BuildProject(EditorBuildType.Launch, null, null, null, false, …)` |
| **Animation-only** `.glb` for one transform | `BuildProject(EditorBuildType.Scene, new Transform[]{ t }, "Run", "/abs/out/dir", true, (int)hand, 0, false)` |
| **Headless everything, no dialogs** | `BuildProject(EditorBuildType.Automate, null, null, null, false, …)` |

### 9.1 The dialog problem — why `Automate` is mandatory

`UnityTools.ShowMessage` is a thin wrapper over `EditorUtility.DisplayDialog`, and `UnityTools.ReportProgress`
wraps `EditorUtility.DisplayProgressBar`. `BuildProject` calls both. That produces two distinct failures:

- **In a live GUI Editor** (`unity command eval`), the completion dialog is **modal on the main thread**. Your
  `eval` call blocks until a human clicks it, and the call times out. `eval`/`eval_file` have their OWN `timeout` parameter (milliseconds, default 5000). The CLI's `--timeout` (seconds) shares the name but only raises how long the CLI waits, so it cannot lift the 5 s limit — the work may still finish, but you lose the result.
- **In batch mode**, Unity refuses to show dialogs, logging `Cancelling DisplayDialog: …`. The pre-build
  confirm is `if (!UnityTools.ShowMessage(...)) return;` — a cancelled dialog is **not** an OK, so
  `BuildProject(EditorBuildType.Scene, null, …)` **returns immediately having exported nothing**, while
  reporting no error.

`Automate` is the only mode that takes neither path. **Always use `EditorBuildType.Automate` for a full-scene
export from an agent.** Prefab exports (`selection != null`) skip the confirm regardless, but still hit the
completion dialog.

**`SuppressDialogs` (toolkit 9.25+).** `CanvasTools.CanvasToolsExporter.SuppressDialogs = true` makes every
`UnityTools.ShowMessage` log instead of opening a modal, and answer *OK* — so `Scene`-mode prefab exports and
failure paths cannot wedge a GUI Editor. The `bt_*` commands set it **around each call and restore it in a
`finally`**. Do the same in your own code — it is **not** a mode: the Editor you drive is the one a person may be
clicking in, and leaving it set silences their dialogs (a domain reload resets it to `false`):

```csharp
bool prev = CanvasTools.CanvasToolsExporter.SuppressDialogs;
CanvasTools.CanvasToolsExporter.SuppressDialogs = true;
try { CanvasTools.CanvasToolsExporter.BuildProject(EditorBuildType.Scene, transforms, "Crates", outDir, false, info.HandedExportSystem, info.MeshExportSystem, info.ExportMetadata); }
finally { CanvasTools.CanvasToolsExporter.SuppressDialogs = prev; }
```

**Use the `bt_*` commands (§11)** rather than calling `BuildProject` yourself — they already do all of this.

### 9.2 The `DefaultProjectFolder` trap — read this before your first export

`CanvasToolsInfo.DefaultProjectFolder` is a **`static string` initialised to `String.Empty`**, and it is
assigned in exactly one place: `CVPanel.OnEnable()` — the **Scene Exporter window**. It is *not* part of the
serialised settings, so it never comes back from `settings.json`, and being a static it is **wiped by every
domain reload** (recompile, enter/exit play mode).

Every export against an empty value fails with:

```
No default project folder specified.
```

**The fix is the §5.1 bootstrap** — a docked Scene Exporter panel in a GUI Editor (re-`OnEnable()`d after every
domain reload, so the static repopulates itself), or `bt-bootstrap.cs` in a headless one. Either also performs
the rest of the bootstrap (layers, FreeImage, shader list, namespace) that `BuildProject` alone does not.

Setting the static by hand is what every `bt_*` command does before exporting, and what your own code must do
wherever no panel exists:

```csharp
CanvasToolsInfo.DefaultProjectFolder = UnityTools.GetDefaultExportFolder();
```

`GetDefaultExportFolder()` returns `<ProjectRoot>/Export` (`Application.dataPath` with `/Assets` swapped for
`/Export`), or `CVPanel.AlternateExport` when configured, creating the directory if needed.

> This one line makes the *current* export find its output folder. It does **not** substitute for the
> bootstrap — run `bt-bootstrap.cs` once per project on a headless machine (§5.1).

### 9.3 Other guards that abort an export

`BuildProject` returns early — logging a warning, not throwing — when:

| Guard | Fix |
|---|---|
| TypeScript compile failed (9.25+: `LastBuildResult != 0`, `Debug/tsc-errors.txt`) — the scene stage is **skipped** | Fix the `.ts` error (§8.2) and re-export |
| `EditorApplication.isCompiling` | `unity command recompile_status` until `completed` |
| `Lightmapping.isRunning` | Wait for the bake, or cancel it |
| `Lightmapping.lightingSettings is null` (throws, does not warn) | Create and assign a LightingSettings asset — §8.1 |
| `DefaultProjectFolder` empty / uncreatable | §9.2 |
| Pro license expired, wrong licensee, wrong org, or no seat | Sign into Unity as the licensee; link the project to the licensed org |

Community edition is **not** blocked — it logs `Pro Tools Disabled: Exporting standard community edition
content` and continues.

Before exporting, `BuildProject` calls `EditorSceneManager.SaveOpenScenes()` and `CanvasToolsInfo.SaveSettings()`
— **any settings you mutate in-memory are persisted to disk**. Save and restore them (§11).

---

## 10. Game levels vs. asset containers — the critical distinction

This is decided by **one argument**: whether `selection` is `null`.

```csharp
CanvasToolsExporter.ExportSelectionOnly = (selection != null);
```

That single flag gates the entire scene-level metadata block.

| | **Game level** (`selection == null`) | **Asset container / prefab** (`selection != null`) |
|---|---|---|
| Scene-level metadata | ✅ emitted | ❌ omitted — `sceneMetaData["properties"] = false` |
| Skybox | ✅ | ❌ |
| Ambient / global IBL, spherical harmonics, reflection probe intensity | ✅ | ❌ |
| Fog (incl. HDRP volumetric) | ✅ | ❌ |
| Clear colour, tonemapping, exposure, gamma, image processing | ✅ | ❌ |
| Scene-level gravity, physics world, CCD, world sweep, fixed timestep | ✅ | ❌ (node-level rigidbodies/colliders **are** still exported) |
| **NavMesh** (the Recast `navigation.prebaked` block) | ✅ | ❌ |
| **Light probes** (`LightProbeNetwork` + `<scene>.probe.bin` beside the scene file) | ✅ | ❌ |
| Sun position/rotation, wind zones | ✅ | ❌ |
| User input, pointer lock, context menu, capture | ✅ | ❌ |
| Debug colliders / collision wireframe | ✅ | ❌ |
| TypeScript/JS bundle compile | ✅ (Script/Project/Automate) | ❌ always skipped |
| Web project + PWA emit | ✅ (Project/Automate) | ❌ always skipped |
| File format setting used | `ExportFileFormat` | **`PrefabFileFormat`** |
| Output directory | `<folder>/scenes/` | `<folder>` **directly**, when `folder` is supplied |

**Both carry every node-level feature**: lightmaps, reflection probes, animations, skins and morph targets
always, plus `extras.metadata.components`, rigidbodies and colliders when `exportUnityMetadata: true`. That is
what makes an exported prefab an *interactive* asset container rather than dumb geometry. Set it `false` only
for pure geometry or animation-only exports. A container's physics bodies are created only when the host scene
already has physics enabled.

> ⚠️ **`exportUnityMetadata: true` is necessary but not sufficient.** Which components actually make it into
> `extras.metadata.components` is gated by the **Babylon Toolkit licence**. Under community edition, `camera`,
> `light` and script components survive, while physics and collision, Animator state machines, AudioSource
> and the other native-system components are silently dropped. See the licence table in §0 before concluding
> a component "isn't supported".

> **Where to look in the exported file.** Scene metadata lives at **`scenes[0].extras.metadata`**, and
> per-object component metadata at **`nodes[i].extras.metadata.components`** — *not* at the document root.
> The file declares `extensionsUsed: ["CVTOOLS_babylon_mesh", "CVTOOLS_left_handed", "CVTOOLS_unity_metadata", …]`.

#### Measured on a real export (Unity 6000.5.10f1, toolkit 9.22.2)

Same scene, exported both ways:

| | `Level01.gltf` (level) | `Crates.glb` (container) |
|---|---|---|
| `scenes[0].extras.metadata` key count | **73** | **23** |
| `properties` | `true` | `false` |
| `skybox`, `ambientlighting`, `fogmode`, `defaultgravity`, `enablephysics`, `navigation`, `clearcolor`, `sunposition`, `tonemapping` | all present | **none present** |
| Extension | `.gltf` (`ExportFileFormat`) | `.glb` (`PrefabFileFormat`) |
| Written to | `Export/scenes/` | `Export/containers/` — the `folder` given, no `scenes/` subfolder |

Skybox cubemap faces (`Default-Skybox_px.png` …) are emitted beside the level and **not** beside the container.

**File names.** With the default `ExportCaseMode = UseDefaultCasing` (0), a level keeps its scene's name
(`Level01.gltf`); with `ForceLowerCasing` (1) every output path and file name is lowercased (`level01.gltf`).
URLs are case-sensitive on the dev server and on Linux hosts — **always use the path `bt_export_level` /
`bt_export_prefab` returns** rather than assuming a case.

The full scene-level key set emitted for a level (for reference when reading exported glTF):
`skybox`, `skyreflections`, `createpolynomials`, `sunposition`, `sunrotation`, `windzones`,
`ambientlighting`, `ambientcoloring`, `ambientskycolor`, `ambientgroundcolor`, `ambientspecularcolor`,
`ambientoverride`, `ambientlightintensity`, `ambientskymode`, `ambientskysource`, `ambientlightmap`,
`lightmaplevel`, `reflectionprobeintensity`, `clearcolor`, `autoclear`, `exposure`, `tonemapping`,
`gammacorrection`, `imageprocessing`, `fogtype`, `fogmode`, `fogcolor`, `fogdensity`, `fogstart`, `fogend`,
`fogalbedo`, `foganisotropy`, `fogvolumetric`, `fogbaseheight`, `fogmaximumheight`, `fogmeanfreepath`,
`enablephysics`, `defaultgravity`, `ccdenabled`, `ccdpenetration`, `maxworldsweep`, `deltaworldstep`,
`subtimestep`, `navigation`, `enableinput`, `userinput`, `usecapture`, `pointerlock`, `contextmenu`,
`preventdefault`, `trianglenormals`, `freezeactivemeshes`, `performancepriority`, `prewarmup`, `hideloader`,
`showdebugcolliders`, `collidervisibility`, `collisionwireframe`, `colliderrendergroup`.

Keys emitted for **both** levels and containers: `gltf`, `license`, `licensee`, `filename`, `script`,
`project`, `intensity`, `debugging`, `properties`, `disposeroot`, `webptextures`, `webplightmaps`,
`ktxtextures`, `ktxlightmaps`, `rendergroups`, `rawmaterials`, `enablelegacyaudio`, `snapshotrendering`,
`colliderinstances`, `reparentcolliders`, `defaultrendergroup`, `globalillumination`.

---

## 13. Exporter settings

Settings live in **`Assets/[Config]/settings.json`** (`CanvasToolsStatics.CANVAS_TOOLS_CONFIG` is the literal
string `[Config]`), alongside `build.json`, `project.json`, `deploy.json`, `cache.json` and the custom
`index.html` / `engine.html` / CSS overrides. `CanvasToolsInfo.CreateSettings()` reads it; `SaveSettings()`
writes it — and **`BuildProject` calls `SaveSettings()` on every run**.

Prefer setting fields through `eval` on a live Editor (the in-memory singleton is what the export reads):

```bash
unity command eval_file "$PROJ/AgentScripts/settings.cs" --project-path "$PROJ"
```
```csharp
var info = CanvasToolsInfo.Instance;
info.ExportFileFormat   = 0;     // scene:  EditorExportFormat  0 = GLTF, 1 = GLB   (default 0)
info.PrefabFileFormat   = 1;     // prefab: EditorExportFormat  0 = GLTF, 1 = GLB   (default 1)
info.ExportMetadata     = true;  // MUST stay true for interactive components
info.DefaultScenePath   = "scenes";
info.TextureImageFormat = 2;     // EditorImageFormat  0 = PNG (default), 2 = WEBP (needs cwebp), 3 = KTX2 (needs ktx)
CanvasToolsInfo.SaveSettings();
return "ok";
```

> **`GLB` is `1`, not `2`.** A value outside the enum matches neither the GLTF nor the GLB branch of the exporter,
> so the file extension is never chosen. Always write the enum: `(int)EditorExportFormat.GLB`.

Editing `settings.json` on disk works too, but only takes effect on the next `CreateSettings()` — a live
Editor that has already cached `CanvasToolsInfo.Instance` will not see it.

### Fields that matter most for agent exports

| Field | Meaning |
|---|---|
| `ExportFileFormat` / `PrefabFileFormat` | `EditorExportFormat`: `GLTF` = 0, `GLB` = 1. Scene vs selection respectively (defaults 0 and 1) |
| `ExportMetadata` | Emit `extras.metadata` — **required** for script components |
| `HandedExportSystem` / `MeshExportSystem` | Defaults `1` (LeftHanded, `CVTOOLS_left_handed`) / `1` (SubMeshes, `CVTOOLS_babylon_mesh` — LOD groups need it); pass straight through to `BuildProject` |
| `DefaultScenePath` (default `"scenes"`) | Subfolder under the export root for scene output |
| `DefaultScriptPath` (default `"scripts"`) | Subfolder for script assets of the web project (the compiled bundle itself is `scenes/<Product>.js`) |
| `CompileProjectScript` | Run the TypeScript/JS bundle compile |
| `BuildWebProject` / `ProgressiveWebApp` | Emit the web project / PWA assets |
| `AutoDeployProject` | Deploy after a `Project` build (**ignored by `Automate`**) |
| `ExportCaseMode` | `UseDefaultCasing` = 0 (default), `ForceLowerCasing` = 1 lowercases every output path and filename |
| `TextureImageFormat` | `PNG` = 0 (default), `WEBP` = 2, `KTX2` = 3. There is no max size for materials: set `maxTextureSize` on the importer. `TerrainLayerMaxSize` (default 1024) caps terrain layers only. Keep lightmaps on PNG |
| `DefaultWebpImageCommandType` | WEBP encoding — **lossless by default**; switch to lossy for real savings |
| `DefaultKtx2RenderingQuality` / `DefaultKtx2ImageCompression` | KTX2 UASTC quality (default 3) / zstd level (default 9) |
| `ForceHighBitDepth` | Default `false`; `true` forces 16-bit normal maps to PNG |
| `UseSpecularMaterials` | Default `true`: selects the **Specular** export path (metallic-roughness + `KHR_materials_specular`, with URP's factor from the global settings below). `false` selects the Classic path (`Standard (Specular setup)` → `KHR_materials_pbrSpecularGlossiness`) (`unity-authoring-recipes.md` §2) |
| `SpecularHighlights` / `GlossyReflections` / `SpecularIntensityScale` / `MetallicF0FactorScale` | Material scalars (default 1.0) |
| `ReflectionProbePower` / `DefaultReflectionFormat` | Reflection-probe intensity for every probe (default 1.0; probe intensity is not read) / `.env` (1, default) or `.dds` |
| `UseHDRPPhotometricLights` | Default `false`; carry HDRP physical light units |
| `BakedLightingMode` | `0` additive (default); `1` multiplies (warned) |
| `ExportNavigation` | Export the toolkit Recast navmesh (`unity-authoring-recipes.md` §12) |
| `ExportMeshInstances` | Default `true`: repeated meshes become glTF mesh instances (off for lightmapped meshes) |
| `FreezeStaticMeshes` | Default `true`: static-flagged objects get `freezeworldmatrix` |
| `EnableAntiAliasing` | Default `true`; MSAA needs it |
| `GpuRenderingMode` | `0` off (default), `1` / `2` WebGPU snapshot rendering |
| `AnimBakingFrameRate` | Clip bake rate (default 30) |
| `TerrainExportMode` | `0` heightfield (default), `1` legacy mesh |
| `ProductShortName` | Overrides `Application.productName` for the bundle name |
| `DebugProjectFiles` | Pretty-print the glTF JSON |
| `ExportPhysics` / `ExportLightmaps` / `ExportBlendShapes` / `ExportLightmapUvs` | Feature toggles |
| `GroupSceneNodes` | Controls `disposeroot` in the emitted metadata |

**Fields with no effect** — don't set them expecting a change: `TextureImageQuality`, `SurfaceCompression`,
`EnableDracoCompression` and the other `Draco*` fields (there is no mesh compression), and `CalculateBindPoses`.

### Output layout

```
<ProjectRoot>/
  Assets/[Config]/settings.json      # exporter settings
  Export/                            # GetDefaultExportFolder() — or CVPanel.AlternateExport
    scenes/                          # DefaultScenePath — levels land here
      Level01.gltf
      MyGame.js                      # compiled bundle (Script/Project/Automate)
    scripts/                         # DefaultScriptPath
    css/  fonts/  images/  icons/    # created when BuildWebProject / ProgressiveWebApp are on
  Debug/                             # GetDefaultDebugFolder() — .d.ts declarations
```

A **prefab export with an explicit `folder`** writes straight into that folder — no `scenes/` subfolder.

---

## 14. Menu items (for reference and `ExecuteMenuItem`)

`CanvasToolsStatics.CANVAS_TOOLS_MENU` is `"Babylon Toolkit"`.

| Menu path | Does |
|---|---|
| `Tools/Babylon Toolkit/Scene Exporter` | Opens the exporter window — the **only** thing that sets `DefaultProjectFolder` from the UI |
| `Tools/Babylon Toolkit/Export Selection` | Prefab export — **opens a modal Save panel** |
| `GameObject/Export Selection`, `Assets/Export Selection` | Same, from the context menus |
| `Tools/Babylon Toolkit/Export Animation` | Opens the animation export utility window |
| `Tools/Babylon Toolkit/Geometry Tools`, `Cubemap Baker`, `Mesh Colliders`, `Height Mapping`, `Disable Blending`, `Copy Mesh Asset` | Art tools |
| `Tools/Babylon Toolkit/Project Deployment/…` | Local file system, FTP, AWS S3 |
| `Tools/Babylon Toolkit/Developer Options/Generate Project License` | Writes a `license.json` bound to **this** project (`Indie` / `SmallBusiness` / `PremiumContent`, §0) — needs the signed-in licensee |
| `Window/Browser Preview/…` | Preview, graphics report, gamepad tester |
| `Assets/Create/Babylon Toolkit/…` | New TypeScript / JavaScript / shader / script-component assets |

> **Do not drive exports with `EditorApplication.ExecuteMenuItem`.** `Export Selection` opens an
> `EditorUtility.SaveFilePanel` and the Scene Exporter opens a window — both block an agent. Call
> `BuildProject` directly, or use the §11 bridge.

---

## 15. Troubleshooting (symptom table)

### Symptom table

| Symptom | Cause | Fix |
|---|---|---|
| `No default project folder specified.` | Bootstrap never ran, or a domain reload wiped the static | Use the `bt_*` commands (they set it); otherwise dock the panel or run `bt-bootstrap.cs` (§5.1, §9.2) |
| Export worked, then broke after a recompile / play-mode toggle | Domain reload wiped `DefaultProjectFolder`; the panel is closed or floating, so nothing re-ran `OnEnable()` | **Dock** the panel so `OnEnable()` re-runs on every reload (§5.1) |
| Missing toolkit layers, shaders, or texture export fails on macOS | `CVPanel.OnEnable()` bootstrap never ran — `BuildProject` does not perform it | Run `bt-bootstrap.cs` (headless) or dock the panel (GUI) — §5.1 |
| Export "succeeds" in batch but writes nothing | `Scene`/`Project` pre-build dialog was cancelled by batch mode | Use `EditorBuildType.Automate` (§9.1) |
| `eval` times out but the file appears | A modal completion dialog is blocking the GUI Editor (`editor_status` → `blocked_by_dialog`) | Use the `bt_*` commands or wrap the call in `SuppressDialogs` (§9.1) |
| `unity command` finds no Editor, one is open | Safe Mode, a sandboxed agent shell blocking loopback, or several Editors (`AMBIGUOUS_EDITOR`) | `unity pipeline list`; pass `--project-path`; gate on `unity command`, not `unity status` (`unity-cli-reference.md` §6) |
| `Cannot connect to Pipeline server` | Package missing, or Unity < 6000.3 (CS0246 `IPreprocessBuildWithContext` in `Editor.log`) | `unity pipeline install`; on older Unity use `-executeMethod` (§7.4) |
| `There is a project compile in progress.` | `EditorApplication.isCompiling` | Poll `unity command recompile_status` until `completed` |
| `There is a lightmap bake in progress.` | `Lightmapping.isRunning` | Wait or cancel the bake |
| `Pro tools license expired / does not have seat` | License gate in `BuildProject` | Sign into Unity as the licensee; link the project to the licensed org |
| `Pro Tools Disabled: Exporting standard community edition content` | No `Assets/[Config]/license.json` | **NOT harmless.** The export runs but silently drops every physics and collision block, and the Animator, AudioSource, NavMeshAgent, CharacterController, ParticleSystem, Canvas, Terrain, VideoPlayer, PostProcess, camera-AA and LOD components. See §0 |
| Exported glTF has geometry and scripts but no physics or native components | Community edition — the Pro gate stripped them | Install `license.json`, verify `ToolkitManager.IsPro()` is true, re-export (§0) |
| `CanvasTools` type not found in `eval` | Toolkit package missing or not compiled | §5, then `recompile` |
| Prefab exported with skybox/fog | `selection` was `null` | Pass a non-empty `Transform[]` (§10) |
| Image/texture tooling fails on macOS with a FreeImage load error | Native image library vs Apple Silicon build | Install the `x86_64` Editor (`-a x86_64`) and run under Rosetta |
| `bt_export_level` fails: `TypeScript compile failed (exit N)` | A `.ts` error; the scene stage was skipped | Read `Debug/tsc-errors.txt`, fix, re-export (§8.2) |
| WEBP/KTX2 textures missing or export errors | `cwebp` / `ktx` tools not installed | Install them, or use `TextureImageFormat = 0` (PNG) |
| Prefab export produced no file / odd extension | `PrefabFileFormat` set to a non-enum value (e.g. `2`) | `GLB` is `1` (§13) |
| Level exported but has no navigation | `NavigationMesh.bin` missing — Unity's `bake_navmesh` is not what the exporter reads | Bake the toolkit Recast surface (`unity-authoring-recipes.md` §12) |
| Baked lights are not in the node list (`Baked lights` warning) | Expected — a Baked light is carried by its bake (lightmaps + light probes) | Nothing to fix. If a Baked light had children, they were skipped too — re-parent them (`unity-authoring-recipes.md` §3) |
| Dynamic objects look unlit or flat | No light-probe network: missing `SceneController`, ambient mode not Skybox, no IBL bake, no `LightProbeGroup` / APV, or an asset-container export | Fix whichever is missing and re-bake (`unity-authoring-recipes.md` §5) |
| Browser frame differs from the Unity frame of the same camera | A feature carried differently, or a toolkit parity gap | Find the feature's row in `unity-authoring-recipes.md` §0; if none explains it, record a parity gap with both captures (§21) |
| Sky exported but no reflections / flat PBR | IBL source `ReflectionProbe-N.exr` never baked (`SKYBOX: You must generate the scene lighting`) | `bake_lighting` after setting the skybox (`unity-authoring-recipes.md` §7) |
| `unity pipeline install --version` rejected | Flag collides with global `-V` | Use `--package-version` |
| `Pipeline package requires Unity 6.0 or higher. Project version: unknown` on a 6000.x project | Project creation had not finished — `ProjectVersion.txt` is written last | Wait for `unity projects new` to exit (§3) |
| `PIPELINE_MANIFEST_WRITE_FAILED` | `unity pipeline install` into a project an Editor already has open | Install before opening, or `unity close` first |
| `Lightmapping.lightingSettings is null` on export | Scene was created programmatically and has no LightingSettings asset | Create and assign one — §8.1 |
| A null-check on `Lightmapping.lightingSettings` throws | The getter itself throws when unset | Probe with `TryGetLightingSettings` (§8.1) |
| Build fails compiling scripts / `tsc` not found | `npm install` never run in the project root | §5.2 — run it after `package.json` appears |
| `package.json` missing from the project root | Only the bootstrap writes it — it has never run | Run `bt-bootstrap.cs` or dock the Exporter panel (§5.1) |
| Export silently used the wrong scene | A fresh Editor session opens the template's default scene | `OpenScene` explicitly first (§8.1) |
| `Invalid Pro Tools License Hash Key` | Seed mismatch — `companyName` (EnterprisePartner) or `productGUID` (all other plans) does not match the licence | §0 — a licence cannot be copied between projects unless it is EnterprisePartner and the Company Name matches |
| Pro licence valid on desktop, community in CI | `EnterprisePartner` needs `projectId` + `organizationName`, both empty headless | Use a seat-based plan or a wildcard-org licence (§0) |
| Poll loop dies with "cannot connect" mid-package-add | Domain reload takes the Pipeline server down ~15–25 s | Treat connection failure as "not ready yet" (§7.3) |
| `eval` returned but the value looks empty | The value is nested at `data.result.result` (other commands: `data.result`) | Parse that path (§7.3), or use `--result-only` |
| `eval` fails with `Identifier expected` / `is a namespace but is used like a type` | A `using` directive in an `eval` / `eval_file` snippet | Fully qualify, or use `run_script` (§7.3) |
| Editor is drivable but `CanvasTools` does not exist | Only `com.unity.pipeline` was installed — the two Toolkit packages were skipped | Install **all three** (§4.1) |
| UPM rejects the manifest / package not found | Wrong package key — it is `org.khronos.unitygltf` and `com.babylontoolkit.editor`, not `com.khronos.*` or `com.babylontoolkit.professionaledition` | Fix the keys (§4) |
| Dev server "starts" but nothing is served | `WebServer.IsStarted` was already true, `HostPreviewType` is `RemoteWebServer`, or `DefaultProjectFolder` is empty | Check all four guards (§12.2); the server starts **once per Editor session** |
| Cannot free the dev server port | `WebServer` has no stop API — the listener lives for the session | Quit the Editor (§12.2) |
| `StartDevelopmentServer` not found | Toolkit older than 9.25 | Use `bt_devserver_start`, which probes and falls back (§12.4) — or upgrade the package |

---
