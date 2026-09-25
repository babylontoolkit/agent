## Unity Authoring Recipes — Levels That Export Correctly

**IMPORTANT. THIS DOCUMENT DECIDES WHETHER A UNITY LEVEL SURVIVES THE EXPORT TO BABYLONJS. READ IT TO THE END BEFORE AUTHORING ANY LEVEL CONTENT.**

> *Portions adapted from Unity-Technologies/skills (`urp-postprocessing`, `migrate-birp-to-urp`,
> `initialize-ai-navigation`, `physics-3d-collision`, `optimize-audio`, `generate-editor-search-query`,
> `new-unity-project`), © 2026 Unity Technologies, used under the Unity Companion License. Every "exports as"
> statement below was checked against the Babylon Toolkit exporter source (`CVTools.cs`,
> `GLTFMetaDataExporter.cs`, `UnityTools_*.cs`, `com.babylontoolkit.editor` source 9.27.1 / release 9.25.1).*

Unity is the **authoring surface**; BabylonJS is the **runtime**. A Unity feature only matters if the exporter
reads it. This document is organised by authoring domain. For each one it gives:

- **Exports as** — exactly what reaches the glTF (`scenes[0].extras.metadata`, `nodes[i].extras.metadata`,
  components, textures), and what is dropped.
- **Author it** — the typed commands (`unity-editor-commands.md`) or `run_script` builder code that sets it up.
- **Traps** — what silently fails.

The runtime side of every exported component is in `scene-components.md`. How to call the commands is in
`unity-editor-commands.md`. The export itself is `unity-exporter-cli.md` §9–§11.

---

## 0. The fidelity matrix — read this first

| Unity feature | Reaches BabylonJS? | Notes |
|---|---|---|
| Meshes, skinned meshes, blend shapes | ✅ | |
| URP/Built-in/HDRP Lit materials → glTF PBR | ✅ | §2 |
| Shader Graph materials | ✅ | Transpiled to a generated TypeScript material class (level exports) |
| Directional / Point / Spot lights (Realtime, Mixed) | ✅ | §3 |
| **Fully Baked lights** | ❌ **node dropped** | Their light lives only in the lightmap. Use **Mixed** for lights that must also light dynamic objects |
| Area / Disc / Rectangle lights | ❌ | Warned; bake them into lightmaps instead |
| Lightmaps (color + shadowmask) | ✅ | Always PNG RGBD |
| Directional lightmaps, realtime GI | ❌ | |
| Light probes (classic or APV) | ✅ | Only in Skybox ambient mode with a baked IBL (§5) |
| **Baked** reflection probes, box projection | ✅ | One probe per renderer (§6) |
| Realtime reflection probes | ❌ | |
| Skybox: Cubemap, 6-Sided, Procedural | ✅ | Needs `Camera.main` with Skybox clear flags (§7) |
| HDRP HDRI sky | ✅ | PhysicallyBased/Gradient skies ❌ |
| Fog (Built-in/URP `RenderSettings`, HDRP Fog volume) | ✅ | Local volumetric fog ❌ |
| URP/HDRP/PPv2 post-processing Volumes | ✅ Pro | Grading baked to a LUT (§9) |
| Terrain (heightmap, splats, trees, details) | ✅ Pro | §10 |
| Rigidbody, Box/Sphere/Capsule/Mesh/Wheel colliders, CharacterController | ✅ Pro | §11 |
| **Unity physics joints**, Layer Collision Matrix, `Physics.gravity` | ❌ | Toolkit joint components, `CollisionFilter`, `SceneController` instead (§11) |
| **Unity's own baked NavMesh / `NavMeshSurface`** | ❌ | The toolkit's **Recast** baker produces the exported navmesh (§12) |
| NavMeshAgent | ✅ Pro | NavMeshObstacle ❌; legacy `OffMeshLink` ✅, AI Navigation `NavMeshLink` ❌ |
| Animator + AnimatorController state machine | ✅ Pro | AnimatorOverrideController ❌; clips baked at 30 fps (§13) |
| Timeline / PlayableDirector | ❌ | Drive sequences from a script component |
| AudioSource | ✅ Pro | AudioMixer, AudioListener ❌ (§14) |
| LOD groups | ✅ Pro | Distances need a GUI Editor (§17) |
| Particle systems, VideoPlayer, uGUI Canvas / UIDocument | ✅ Pro | VFX Graph, Trail/Line renderers ❌; UI is always full-screen 2D — no world-space UI (§17) |
| Babylon Toolkit script components (`EditorScriptComponent`) | ✅ | Plain `MonoBehaviour`s ❌ (§18) |
| Occlusion culling data | ❌ | |

**Pro** = requires a valid Babylon Toolkit `license.json` (`unity-exporter-cli.md` §0). Without it these are
**silently omitted** and the export still "succeeds".

**Level vs asset container.** Everything scene-level (skybox, IBL, fog, ambient, navigation, sun, wind, image
processing, gravity) is written **only for game levels** (`bt_export_level`). Node-level data — components,
physics bodies, colliders, lightmaps, probes — is written for **both** levels and asset containers
(`bt_export_prefab`).

---

## 1. Level baseline — do this for every new level

A level that exports correctly starts from the same baseline:

| Requirement | Why | How |
|---|---|---|
| URP project, **Linear** colour space | The exporter warns in Gamma; procedural sky and ambient differ | `urp-blank` template is Linear by default; check `get_player_settings` |
| Scene saved under `Assets/Scenes/<Level>.unity` | Every bake writes into `Assets/Scenes/<Level>/` (lightmaps, `ReflectionProbe-N.exr`, `NavigationMesh.bin`). An unsaved scene has no folder, and the navmesh bake refuses | `create_scene --path Scenes/Level01 --template default` |
| A **LightingSettings asset** assigned and **saved into the scene** | Export throws `Lightmapping.lightingSettings is null` otherwise | `unity-exporter-cli.md` §8.1 |
| `Camera.main` (tag `MainCamera`) with **Skybox** clear flags | No skybox or IBL is exported without it | The `default` scene template provides it |
| A `SceneController` component (toolkit) on one GameObject | Source of gravity, environment toggle, imaging and lighting options. Defaults apply without it | `add_component --type SceneController` |
| Lights set to **Realtime** or **Mixed** | Fully Baked lights are dropped from the export | §3 |

Create it in one go:

```bash
unity command create_scene --path Scenes/Level01 --template default --project-path "$PROJ"   # Main Camera + Directional Light
unity command add_component --target "/Main Camera" --type SceneController --project-path "$PROJ"
unity command save_scene --project-path "$PROJ"
# then assign LightingSettings — unity-exporter-cli.md §8.1 (run_script: TryGetLightingSettings -> CreateAsset -> MarkSceneDirty -> SaveOpenScenes)
```

---

## 2. Materials and shaders

**Exports as.** glTF `pbrMetallicRoughness` + `normalTexture` + `occlusionTexture` + `emissiveTexture` (only when
emission is non-black), `alphaMode` (`MASK` cutoff / `BLEND`), `doubleSided`, `KHR_materials_unlit` for unlit
materials. Babylon-specific extras (lightmap, reflection cubemap, detail map, custom shader data) ride on
`materials[i].extras.metadata`. The same material splits into `…Instance…` copies when renderers differ in
lightmap index or reflection probe. Textures are re-encoded in `TextureImageFormat` (PNG `0`, WEBP `2`, KTX2 `3`).

The export workflow is chosen by the exporter setting **`UseSpecularMaterials`** (default **on**): core
metallic-roughness **plus `KHR_materials_specular`** — the shader never decides it. Other KHR extensions are
written when their Unity keywords/properties are present: `emissive_strength` (HDR emission), `ior`,
`clearcoat` (`_CLEARCOAT` keyword), `sheen`, `anisotropy`, `iridescence`, `transmission`/`volume`,
`texture_transform` (non-identity tiling/offset). No material or texture feature is licence-gated.

| Shader family | Export |
|---|---|
| **URP Lit** (Metallic workflow), Built-in Standard (+ Roughness/Specular setups), `Babylon/System/*` | glTF PBR — the well-trodden path |
| URP Unlit, any shader name containing `Unlit` | `KHR_materials_unlit` |
| URP Lit **Specular workflow**, URP **Simple Lit** | ⚠️ exported as metallic PBR — `_SpecColor` / `_SpecGlossMap` are **ignored**. Author URP Lit in the **Metallic** workflow |
| URP **Baked Lit** | ⚠️ exported as lit PBR, not unlit |
| HDRP Lit | ⚠️ not recognised by name — generic PBR via property sniffing (warned). LayeredLit / StackLit ❌; HDRP Unlit loses its colour |
| Unrecognised shaders | Generic PBR by property sniffing, warned *"unrecognised shader … map it or give it a SHADER_CONTROLLER block"* |
| **Shader Graph** | `customShader` + a generated TypeScript material class (transpiled on **level** exports; plain PBR in asset containers and for terrain prototypes) |
| `Babylon/…`, `Babylon/Custom/…`, `Custom/…` | Toolkit custom shader (`SHADER_CONTROLLER` block), falling back to `UniversalShaderMaterial` with a warning |
| `Legacy Shaders/*`, `Particles/Standard Unlit` | No custom hook — convert to a PBR shader |

**Author it:**

```bash
unity command list_shaders --project-path "$PROJ" --result-only | grep -i "Universal Render Pipeline"   # pick a real name
unity command create_asset --path Materials/Stone.mat --type UnityEngine.Material \
  --shader "Universal Render Pipeline/Lit" --project-path "$PROJ"
unity command get_shader_properties --shader "Universal Render Pipeline/Lit" --project-path "$PROJ"       # valid property names
unity command set_material_properties --material Materials/Stone.mat --project-path "$PROJ" \
  --properties '{"_BaseColor":[0.55,0.52,0.48,1],"_Smoothness":0.35,"_Metallic":0,"_BaseMap":{"path":"Textures/stone_albedo.png"},"_BumpMap":{"path":"Textures/stone_normal.png"}}' \
  --enableKeywords '["_NORMALMAP"]' --dry_run true      # check applied[] / unknown[] first, then drop --dry_run
unity command set_component_properties --target /Ground --type MeshRenderer \
  --properties '{"m_Materials":[{"path":"Materials/Stone.mat"}]}' --project-path "$PROJ"
```

`create_asset` with a Material and no `--shader` defaults to `Universal Render Pipeline/Lit` in an SRP project.
Property names include the leading underscore (`_BaseColor`, `_BaseMap`, `_BumpMap`, `_EmissionColor`).

**How properties map** (URP Lit): `_BaseColor` × `_BaseMap` → base colour (an HDR base colour's peak moves into
emission); `_Metallic` + `_Smoothness` → metallic / roughness = 1 − smoothness (with a `_MetallicGlossMap`, the two
are baked into a new metallic-roughness texture, smoothness from the map's alpha); `_BumpMap` × `_BumpScale` →
normal (re-rendered, Y flipped); `_OcclusionMap` → occlusion (green channel); `_EmissionColor` → emissive, HDR peak
→ `emissive_strength`. Detail maps and parallax only reach `extras` (no glTF equivalent).

**Alpha.** Transparency is read from the **surface settings** — `_Surface` = 1 → `BLEND`, `_AlphaClip` = 1 →
`MASK` (cutoff from `_Cutoff`), the `RenderType` tag — **not** from keywords (`_ALPHATEST_ON` counts only when the
exporter's `UseAlphaKeywords` setting is on, default off). Double-sided comes from `_Cull` = 0.

**Textures.** There is **no maximum-texture-size option in the exporter** — every texture ships at its Unity
**import** size, so set `maxTextureSize` on the importer (§16) for web budgets. `TextureImageFormat` WEBP needs
the **`cwebp`** tool and KTX2 the **`ktx`** tool on the machine (UASTC, zstd, mipmaps). Wrap modes: Clamp →
clamp, everything else → repeat; **Mirror is not supported**.

**Traps:**
- **A normal map must be imported as a normal map** (`set_import_settings --asset Textures/stone_normal.png --settings '{"textureType":"NormalMap"}'`), and the `_NORMALMAP` keyword enabled.
- **Emission needs both** `_EmissionColor` non-black **and** the `_EMISSION` keyword.
- **Read back every shader name after a conversion.** Unity's Built-in→URP converter can silently assign the
  wrong shader (e.g. a 2D mesh shader to a 3D Standard material). `get_material_properties` shows the shader.
- `Shader.Find` returning null is an error, not a fallback. Use `GraphicsSettings.currentRenderPipeline.defaultMaterial` for "the pipeline's default lit material".

---

## 3. Lights

**Exports as.** A `light` entry on the node: `type` (0 directional, 1 point, 2 spot), `color`, `intensity`
(Unity intensity × the toolkit's per-type scale), `intensitymode`, `range`, `spotangle` / `innerspotangle`,
shadows (`generateshadows`, `softshadows`, `shadowmapsize`, `shadowstrength`, biases, cascades from
QualitySettings), `lightmapmode`, and `renderlist` from the culling mask. No licence gate. Extra Babylon shadow
knobs come from the toolkit **`LightSettings`** component on the same GameObject.

| Light mode | Result |
|---|---|
| Realtime | Exported; lights everything at runtime |
| **Mixed** | Exported **and** baked — the right choice for a sun that both bakes GI and lights dynamic objects |
| **Baked** | **Node dropped** — its contribution exists only in the lightmap |
| Area / Disc / Rectangle | Not exported (warned); bake them |

**Author it:**

```bash
unity command find_gameobjects --type Light --project-path "$PROJ"
unity command set_component_properties --target "/Directional Light" --type Light --project-path "$PROJ" \
  --properties '{"m_Intensity":1.2,"m_Color":[1,0.96,0.9,1],"m_Lightmapping":1,"m_Shadows.m_Type":2}'
#   m_Lightmapping: 4 Realtime, 1 Mixed, 2 Baked       m_Shadows.m_Type: 0 none, 1 hard, 2 soft
unity command get_component_properties --target "/Directional Light" --type Light --project-path "$PROJ"   # confirm
```

Set `RenderSettings.sun` to the main directional light (it drives `sunposition` / `sunrotation`); a sun lower
than `MinSunlightDistance` (50) is raised to that height.

**Traps:** HDRP physical light units only carry over with `UseHDRPPhotometricLights` on (default off). Under
Shadowmask, more than four overlapping Mixed lights exceed the shadowmask channels (warned).

---

## 4. Lightmaps and global illumination

**Exports as.** Each lightmapped renderer's material gets `lightmapTexture` (color) and, under Shadowmask,
`shadowmaskTexture`, plus `lightmapLevel`; meshes get a `uv2` accessor. Lightmaps are **always PNG in RGBD**
(no WEBP/KTX2). Scene keys: `lightmapbakemode`, `shadowmaskmode`, `renderpipeline` (`birp`/`urp`/`hdrp`).
**Not exported:** directional lightmaps, realtime GI (`globalillumination` is always `false`).

**Author it:**

```bash
unity command get_lighting_settings --project-path "$PROJ"
unity command set_lighting_settings --project-path "$PROJ" --dry_run true \
  --settings '{"bakedGI":true,"realtimeGI":false,"lightmapper":"ProgressiveGPU","bounces":2,"lightmapResolution":20,"directionalMode":"NonDirectional","maxLightmapSize":2048}'
# review applied[] / unknown[], then run again without --dry_run
unity command bake_lighting --project-path "$PROJ"
until unity command lighting_bake_status --project-path "$PROJ" --result-only 2>/dev/null | grep -q completed; do sleep 5; done
unity command save_scene --project-path "$PROJ"
```

Mark static geometry **Contribute GI** (static flags) so it receives lightmaps — from `run_script`:
`UnityEditor.GameObjectUtility.SetStaticEditorFlags(go, UnityEditor.StaticEditorFlags.ContributeGI | UnityEditor.StaticEditorFlags.BatchingStatic)`.
Meshes need lightmap UVs (`generateSecondaryUV` on the model importer, or authored UV2).

**Traps:**
- **Set `directionalMode` to `NonDirectional`** — the directional component is not exported, so baking it only costs time and disk.
- The exporter **refuses to export while a bake is running**, and in the legacy *Iterative* GI workflow it forces a synchronous bake before export. Always bake explicitly and wait for `completed`.
- A **stale bake** (mixed-lighting mode changed after baking) is warned — re-bake.
- Lightmap-static renderers do not cast realtime shadows (except under Distance Shadowmask); dynamic objects need Mixed or Realtime lights.

---

## 5. Light probes

**Exports as.** A binary side file `<scene>.lightprobes.bin`, a scene `lightprobes` header, per-node
`lightprobes` usage, and one `TOOLKIT.LightProbeNetwork` component. Sources: classic `LightProbeGroup`s or
Adaptive Probe Volumes. **Written only when `RenderSettings.ambientMode` is Skybox *and* the IBL environment was
baked** (§7). A renderer is probe-lit only if it is a Mesh/SkinnedMeshRenderer, **not** lightmapped, with *Blend
Probes* usage.

**Author it:** place a `LightProbeGroup` covering where dynamic objects move (`add_component --type LightProbeGroup`,
positions via `set_serialized_field` on `m_SourcePositions.Array.data[i]` or from `run_script`), then
`bake_lighting` — probes bake with the lightmaps.

---

## 6. Reflection probes

**Exports as.** Per renderer, the **single highest-weight enabled probe** only. **Baked** probes are converted to
`.env` (default) or `.dds` and attached as the material's `reflectionCubemapFile`; `probe.boxProjection` exports
as box projection (`boundingBoxSize` = probe size, `boundingBoxPosition` = position + centre). Probe
`intensity` / `importance` are **not** read. **Realtime probes are not converted** (the node only gets a
`PROBE_<id>` tag). URP adds scene keys `reflectionprobeblending` / `reflectionprobeboxprojection` (blending is
warned: one probe per renderer).

**Author it:**

```bash
unity command create_gameobject --name "Probe_Hall" --project-path "$PROJ"
unity command add_component --target /Probe_Hall --type ReflectionProbe --project-path "$PROJ"
unity command set_transform --target /Probe_Hall --position '[0,2,0]' --project-path "$PROJ"
unity command set_component_properties --target /Probe_Hall --type ReflectionProbe --project-path "$PROJ" \
  --properties '{"m_Mode":0,"m_BoxProjection":true,"m_BoxSize":[20,6,20],"m_Resolution":256}'
#   m_Mode: 0 Baked, 1 Realtime, 2 Custom — only Baked and Custom export
unity command bake_lighting --project-path "$PROJ"     # baked probes bake with the lightmaps
```

**Trap:** under URP, probe blending and box projection are also switched on the **URP pipeline asset**; the
component's public properties for those flags are read-only in some versions — set them through the serialized
fields (`set_serialized_field` / `SerializedObject`), not the C# property.

---

## 7. Skybox, IBL and environment

**Exports as** (levels only, scene key `skybox`): sky texture(s), `exposure`, `rotation`, and `environment` —
the IBL `.env`/`.dds` baked from `<SceneDir>/<Scene>/ReflectionProbe-N.exr` (highest N), with spherical
harmonics (`sh`) **only in Skybox ambient mode**. Nothing is written unless **`Camera.main` exists with Skybox
clear flags**.

| Skybox material shader | Export |
|---|---|
| `Skybox/Cubemap` (`_Tex`) | One RGBD `.env` (Compressed), a copied `.hdr/.exr/.dds`, or six RGBD PNG faces |
| `Skybox/6 Sided`, `Mobile/Skybox`, `Skybox/Babylon Toolkit` | Six face textures |
| `Skybox/Procedural` | A `procedural` block (sun disk/size, atmosphere, tint, ground, exposure) — no texture |
| HDRP `HDRISky` | Its cubemap |
| Anything else (incl. HDRP PhysicallyBased/Gradient sky) | **Skybox and reflections disabled** (warned) |

**Author it:**

```bash
unity command create_asset --path Materials/Sky.mat --type UnityEngine.Material --shader "Skybox/Cubemap" --project-path "$PROJ"
unity command set_material_properties --material Materials/Sky.mat --project-path "$PROJ" \
  --properties '{"_Tex":{"path":"Textures/sky_cubemap.hdr"},"_Exposure":1.0,"_Rotation":0}'
unity command eval 'UnityEngine.RenderSettings.skybox = UnityEditor.AssetDatabase.LoadAssetAtPath<UnityEngine.Material>("Assets/Materials/Sky.mat");
UnityEngine.RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Skybox;
UnityEngine.RenderSettings.defaultReflectionMode = UnityEngine.Rendering.DefaultReflectionMode.Skybox;
UnityEditor.SceneManagement.EditorSceneManager.MarkSceneDirty(UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene());
return "ok";' --project-path "$PROJ"
unity command bake_lighting --project-path "$PROJ"     # REQUIRED: produces ReflectionProbe-0.exr, the IBL source
unity command save_scene --project-path "$PROJ"
```

Import an HDR panorama as a cubemap first: `set_import_settings --asset Textures/sky.hdr --settings '{"textureShape":2}'`
(`2` = Cube).

**Trap:** `SKYBOX: You must generate the scene lighting` in the log means the IBL source `.exr` does not exist —
bake lighting after setting the skybox. Without it the level has a sky but **no image-based lighting**, and PBR
materials look flat.

---

## 8. Fog

**Exports as** (levels only): `RenderSettings.fog` / `fogMode` → `fogmode` 1 (Exponential, density × 0.5),
2 (ExponentialSquared, density × 0.66), 3 (Linear, `fogstart`/`fogend`), plus `fogcolor`, `fogdensity`. HDRP Fog
volume → exponential with height/albedo/anisotropy keys (volumetrics are flagged, not reproduced). Local
volumetric fog is not exported.

```bash
unity command eval 'UnityEngine.RenderSettings.fog = true;
UnityEngine.RenderSettings.fogMode = UnityEngine.FogMode.ExponentialSquared;
UnityEngine.RenderSettings.fogDensity = 0.02f;
UnityEngine.RenderSettings.fogColor = new UnityEngine.Color(0.55f, 0.62f, 0.72f);
UnityEditor.SceneManagement.EditorSceneManager.MarkSceneDirty(UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene());
return "ok";' --project-path "$PROJ"
```

---

## 9. Post-processing (URP Volumes)

**Exports as** (Pro): each enabled `Volume` (URP/HDRP) or `PostProcessVolume` (PPv2) becomes a
`TOOLKIT.PostProcessor` component with `isglobal`, `weight`, `priority`, `blenddistance`, and an `effects[]`
list. Colour-grading operators with no native Babylon equivalent are **baked into a 32³ LUT strip PNG**
(`assets/<volume>_lut.png`). With URP, the pipeline's **default volume profiles** (global default at priority
-20000, the quality asset's at -10000) are also exported onto the main camera, so the look matches Unity even
with no scene Volume.

| Supported (URP/HDRP) | Unsupported (warned, ignored) |
|---|---|
| Bloom, Tonemapping, ColorAdjustments, WhiteBalance, ChannelMixer, LiftGammaGain, ShadowsMidtonesHighlights, SplitToning, ColorCurves, ColorLookup, Vignette, ChromaticAberration, FilmGrain, DepthOfField, MotionBlur, LensDistortion, ScreenSpaceReflection, ScreenSpaceAmbientOcclusion, Exposure | PaniniProjection, ScreenSpaceLensFlare, URP renderer-feature SSAO, anything else |

**The five pre-flight checks** — an effect that "does nothing" in Unity will do nothing in the export either:

1. The project's render pipeline asset exists (`get_graphics_settings`, quality levels).
2. **HDR** is on in the URP asset (Bloom and tonemapping need it).
3. **Post Processing** is ticked on the camera (`UniversalAdditionalCameraData.renderPostProcessing` — off by
   default). The exporter warns when no exported camera renders the volumes.
4. The camera's **Volume Mask** includes the Volume's layer.
5. The Volume is enabled, has a **profile**, and each effect parameter has **`overrideState = true`** — setting
   a value without its override flag is the #1 scripting mistake.

**Author it** (one builder — the profile must be a persistent asset):

```csharp
// AgentScripts/Post.cs  —  unity command run_script --file AgentScripts/Post.cs --entry Post.Cinematic
using UnityEngine;
using UnityEditor;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

public static class Post
{
    public static string Cinematic()
    {
        var profile = ScriptableObject.CreateInstance<VolumeProfile>();
        System.IO.Directory.CreateDirectory(Application.dataPath + "/Settings");
        AssetDatabase.CreateAsset(profile, "Assets/Settings/Level01_Post.asset");

        var tone = profile.Add<Tonemapping>(true);          // overrides=true sets every overrideState
        tone.mode.value = TonemappingMode.ACES;
        var bloom = profile.Add<Bloom>(true);
        bloom.intensity.value = 0.6f; bloom.threshold.value = 0.9f;
        var vig = profile.Add<Vignette>(true);
        vig.intensity.value = 0.25f;
        foreach (var c in profile.components) AssetDatabase.AddObjectToAsset(c, profile);   // persist sub-assets
        EditorUtility.SetDirty(profile); AssetDatabase.SaveAssets();

        var go = new GameObject("Global Volume");
        var vol = go.AddComponent<Volume>();
        vol.isGlobal = true; vol.priority = 0; vol.sharedProfile = profile;   // sharedProfile, not profile (which clones)

        var cam = Camera.main;
        var data = cam.GetComponent<UniversalAdditionalCameraData>() ?? cam.gameObject.AddComponent<UniversalAdditionalCameraData>();
        data.renderPostProcessing = true;
        data.volumeLayerMask |= 1 << go.layer;

        UnityEditor.SceneManagement.EditorSceneManager.MarkSceneDirty(go.scene);
        UnityEditor.SceneManagement.EditorSceneManager.SaveScene(go.scene);
        return "volume + profile saved";
    }
}
```

**Traps:**
- A **local** Volume (`isGlobal = false`) needs a **Box or Sphere Collider on the same GameObject** — that is
  its exported bounds. Without one it is ignored at runtime (warned).
- Use `sharedProfile` to edit the asset; `profile` silently clones it.
- The URP names differ from PPv2: `Volume` (not `PostProcessVolume`), `ColorAdjustments` (not `ColorGrading`),
  `profile.TryGet<T>(out var x)` (not `GetSetting<T>`).

Recipes for common looks (all with ACES tonemapping): **cinematic** Bloom 0.5–1 / threshold 0.9, Vignette 0.25,
slight warm white balance; **stylized** saturation +20, contrast +15, low bloom; **horror** desaturate −40,
vignette 0.45, film grain 0.3, cool white balance; **clean/mobile** tonemapping + light bloom only.

---

## 10. Terrain

**Exports as** (Pro): a `TOOLKIT.TerrainBuilder` component. Heights, trees and details go into the scene's
binary buffer; splat/control images are written beside it. The terrain node is exported **position-only**
(Unity ignores terrain rotation and scale). Tree and detail prototypes export as template groups (their materials
are forced to plain PBR). `TerrainExportMode` 0 = heightfield (default), 1 = legacy segmented mesh.

**Author it:** create the `TerrainData` asset and the `Terrain` GameObject from `run_script`
(`new TerrainData { heightmapResolution = 513, size = new Vector3(500, 60, 500) }` →
`AssetDatabase.CreateAsset` → `Terrain.CreateTerrainGameObject(data)`), set heights with
`data.SetHeights(0, 0, float[,])`, assign `TerrainLayer` assets to `data.terrainLayers`, paint with
`data.SetAlphamaps`. Save the scene, then export.

| Terrain feature | Export |
|---|---|
| Heightmap | Full resolution, u16, in the scene `.bin` |
| Terrain layers | **Up to 16** (beyond that the 16 most-painted are kept, warned); albedo/normal/mask as JPG at ≤ `TerrainLayerMaxSize` (default 1024) |
| Splat control maps | PNG, 3 layers per map, not resampled |
| Holes | `holes.png` (heightfield mode only) |
| Terrain lightmap | ✅ in `.gltf` exports — **skipped in `.glb`** (warned) |
| Trees | Prefab templates + instances (LODs, billboards, SpeedTree); tree colliders: first capsule/box/sphere only |
| Details / grass | Mesh details as instance transforms; grass textures + density maps; wind |
| `TerrainCollider` | Not a physics collider — the runtime builds a **heightfield** from the terrain data |
| Shader flavour | From the terrain material: URP Terrain / Shader Graph "Terrain" → urp, HDRP TerrainLit → hdrp, `Nature/Terrain/*` → built-in |

Without Pro nothing is written — in heightfield mode there is then **no terrain surface at all**.

---

## 11. Physics

**Exports as** (Pro, `ExportPhysics` on): per node, `physics` (`type: "rigidbody"`, `mass`, drag, `freeze`
constraints, `gravity`, `kinematic`) and `collision` (Box, Sphere, Capsule, Mesh — convex hull when *Convex*,
Wheel; two or more colliders become a compound collider with per-shape friction/restitution), plus a
`TOOLKIT.RigidbodyPhysics` or `TOOLKIT.CharacterController` component. A collider with no Rigidbody becomes a
**static** body (mass 0). Triggers get a `Trigger` tag.

| Unity setting | Exported? | Use instead |
|---|---|---|
| `Physics.gravity` | ❌ | `SceneController.sceneOptions.defaultGravity` (default `(0,-9.81,0)`) |
| Layer Collision Matrix | ❌ | The toolkit **`CollisionFilter`** component (`collideWith`) |
| Rigidbody interpolation, collision detection mode, centre of mass | ❌ | `PhysicsRoot` component for `centre` / sleep |
| **Hinge / Fixed / Spring / Configurable / Character joints** | ❌ | Toolkit joint script components: `BallSocketJoint`, `DistanceJoint`, `FixedHingeJoint`, `LockedJoint`, `PrismaticJoint`, `SixdofJoint`, `SliderJoint` (Starter assets, `Physics/`) |
| Nested Rigidbodies | ❌ (ignored, warned) | One body per hierarchy branch |
| Rigidbody + CharacterController / NavMeshAgent on the same object | ❌ (body ignored, warned) | Pick one driver |

**Author it:**

```bash
unity command batch --project-path "$PROJ" --operations '[
  {"id":"crate","command":"create_gameobject","params":{"name":"Crate","primitive":"cube"}},
  {"command":"set_transform","params":{"target":"$crate.instanceId","position":[0,4,0]}},
  {"id":"rb","command":"add_component","params":{"target":"$crate.instanceId","type":"Rigidbody"}},
  {"command":"set_component_properties","params":{"target":"$rb.instanceId","properties":{"m_Mass":25,"m_LinearDamping":0.1}}}
]'
unity command save_scene --project-path "$PROJ"
```

Unity 6 renamed the Rigidbody API: `linearVelocity` / `linearDamping` / `angularDamping` (serialized
`m_LinearDamping`, `m_AngularDamping`). The old names (`velocity`, `drag`) are obsolete — use the new ones.

**Always assign a `PhysicsMaterial` to colliders** that need friction: a collider with none exports friction
and restitution as **0**, not Unity's 0.6 default, so objects slide. Wheel colliders read the toolkit
`RaycastWheel` component for suspension/friction — Unity's spring and friction curves are not read.

**Traps (from Unity's collision diagnostics, adapted):**
- A collision needs a Rigidbody on **at least one** side; two kinematic bodies never *collide*, but **two
  kinematic triggers do fire trigger events**.
- A non-convex **MeshCollider cannot be on a dynamic Rigidbody** — mark it Convex or use primitives.
- Fast small bodies tunnel through thin colliders — use thicker colliders or continuous detection at runtime.
- Never set `contactOffset` to 0.
- A raycast starting **inside** a collider does not hit it.

---

## 12. Navigation (navmesh)

**Exports as** (levels only, `ExportNavigation` on): scene key `navigation` with `prebaked` →
`<scenes>/<scene>.nav.bin` (a recast-navigation-js navmesh), an optional height-mesh node, and `offmeshlinks`
from legacy `OffMeshLink` components. NavMeshAgents become `TOOLKIT.NavigationAgent` (Pro) with speed,
acceleration, angular speed, stopping distance, avoidance and area mask.

> ### The exporter does NOT read Unity's navmesh
> Neither the legacy baked NavMesh (`bake_navmesh`) nor the AI Navigation `NavMeshSurface`
> (`bake_navmesh_surfaces`) reaches the export. The exported navmesh is the file
> **`Assets/Scenes/<Level>/NavigationMesh.bin`**, produced by the toolkit's bundled **Recast** baker
> (`UniRecast.Core.UniRcNavMeshSurface`). Baking Unity's navmesh is still useful for testing agents inside
> Unity, but it does nothing for BabylonJS.

**Author it:**

```bash
unity command save_scene --project-path "$PROJ"            # the bake refuses an unsaved scene (no scene folder)
unity command create_gameobject --name NavMesh --project-path "$PROJ"
unity command add_component --target /NavMesh --type UniRecast.Core.UniRcNavMeshSurface --project-path "$PROJ"
unity command get_serialized_fields --target /NavMesh --component UniRcNavMeshSurface --project-path "$PROJ"   # _agentRadius, _agentHeight, _agentMaxSlope, _cellSize, _collectObjects, _includeLayers, …
unity command set_serialized_field --target /NavMesh --component UniRcNavMeshSurface --field _agentRadius --value 0.4 --project-path "$PROJ"
mkdir -p "$PROJ/AgentScripts" && cat > "$PROJ/AgentScripts/Nav.cs" <<'CS'
using System;                 // UnityTools lives in the System namespace
using UnityEngine;
using UniRecast.Core;

public static class Nav
{
    public static string Bake()
    {
        var s = UnityEngine.Object.FindAnyObjectByType<UniRcNavMeshSurface>();
        if (s == null) return "no UniRcNavMeshSurface in the scene";
        s.Bake();                                                   // writes <SceneDir>/<Scene>/NavigationMesh.bin (+ .asset)
        var bin = UnityTools.GetRecastNavMeshFilename();
        return bin + " exists=" + System.IO.File.Exists(UnityTools.GetNativePath(bin));
    }
}
CS
# A bake takes seconds to minutes — run_script with a long timeout, NOT eval (eval's main-thread call times out after ~5 s)
unity command run_script --file AgentScripts/Nav.cs --entry Nav.Bake --timeout_ms 300000 --timeout 300 --project-path "$PROJ" --format json
unity command save_scene --project-path "$PROJ"
```

*Verified: an 8-crate level baked in ~12 s to a 1.4 MB `NavigationMesh.bin`.*

| Surface field | Meaning (defaults) |
|---|---|
| `_collectObjects` | 0 All (default), 1 Volume (`_volumeSize`), 2 Children |
| `_useGeometry` | 0 Render meshes (default), 1 Physics colliders |
| `_includeLayers` / `_useTagFilter` + `_includeTags` | Which objects are walkable geometry (tag defaults to `Navigation`) |
| `_agentRadius` / `_agentHeight` / `_agentMaxClimb` / `_agentMaxSlope` | 0.4 / 2.0 / 0.4 / 45° |
| `_cellSize` / `_cellHeight` | 0.1 / 0.2 — smaller is more accurate and slower |

Mark walkable static geometry **Navigation Static** — it also gets a `NavigationStatic` tag and a
`navigation.area` in the export. Agents: add `NavMeshAgent` (`add_component --type UnityEngine.AI.NavMeshAgent`)
and tune it with `set_component_properties`.

**Not exported:** `NavMeshObstacle`, `NavMeshModifier`, AI Navigation `NavMeshLink`, area costs, and the
agent-type build settings (radius/height live only in the Recast bake). Use legacy `OffMeshLink` for jumps and
drops. A missing `NavigationMesh.bin` fails **silently** (`navigation.prebaked` is `null`) — always check the
file exists before exporting.

---

## 13. Animation

**Exports as** (Pro): every enabled Animator with a controller (or legacy Animation component) has its clips
**baked to glTF animations**; skinned meshes export skins. An Animator also becomes a `TOOLKIT.AnimationState`
component carrying the **state machine** (`machine`: layers, states, transitions, parameters), clip settings
(loop, mirror, root motion, speed), `applyrootmotion`, and update mode. The toolkit **`AnimatorControlRig`**
component switches to vertex-animation textures (VAT) or a runtime rig. **Timeline / PlayableDirector are not
exported**, and a legacy `Animation` component gets clips but no state component.

**Author it** — controllers from the typed commands:

```bash
unity command create_animator_controller --path Animation/Hero.controller --project-path "$PROJ"
unity command add_animator_parameter --controller Animation/Hero.controller --name Speed --type Float --project-path "$PROJ"
unity command add_animator_state --controller Animation/Hero.controller --name Idle --motion Animation/Idle.anim --isDefault true --project-path "$PROJ"
unity command add_animator_state --controller Animation/Hero.controller --name Run  --motion Animation/Run.anim  --project-path "$PROJ"
unity command add_animator_transition --controller Animation/Hero.controller --fromState Idle --toState Run \
  --conditions '[{"parameter":"Speed","mode":"Greater","threshold":0.1}]' --duration 0.15 --project-path "$PROJ"
unity command get_animator_controller --controller Animation/Hero.controller --project-path "$PROJ"   # verify the graph
unity command add_component --target /Hero --type Animator --project-path "$PROJ"
unity command set_component_properties --target /Hero --type Animator \
  --properties '{"m_Controller":{"path":"Animation/Hero.controller"}}' --project-path "$PROJ"
```

Simple procedural clips (doors, platforms, spinning pickups): `create_animation_clip --loop true`, then
`set_animation_curve --type Transform --property m_LocalPosition.y --keys '[{"time":0,"value":0},{"time":1,"value":2}]'`.
Omitted tangents are **flat**, not Unity's Auto tangents. Exact parameter names for every command:
`unity command --tag animation --detail full`.

What the export keeps and drops:

| Feature | Export |
|---|---|
| States, transitions (with conditions, exit time, duration), parameters, layers, avatar masks | ✅ |
| Blend trees — 1D, 2D (all three), Direct, nested | ✅ |
| Sub-state machines | Flattened; transitions **to** a sub-machine and machine-level transitions ❌ |
| `AnimatorOverrideController` | ❌ — silently no clips; use a real controller |
| Animator `speed`, Write Defaults, culling mode | ❌ |
| Clips | Baked at `AnimBakingFrameRate` (default **30 fps**), linear TRS; start/stop/mirror/loop are metadata only |
| Humanoid clips | Baked onto the first SkinnedMeshRenderer's bones — **no runtime retargeting** |
| Root motion | Baked in when `applyRootMotion` is on, pinned otherwise |
| Material/property/active curves | ❌ (Transform curves only) |
| AnimationEvents | ✅ as metadata on Animator-state clips |
| Skinning | Max **4** bone influences |
| Blend shapes | ✅ (SkinnedMeshRenderer; **last frame only**, no names) |

For one animated transform on its own `.glb`: `bt_export_animation --path <HierarchyPath>` (no metadata, so no
`AnimationState` in that file).

---

## 14. Audio

**Exports as** (Pro): `TOOLKIT.AudioSource` with `file` (the clip's original wav/mp3/ogg copied **byte-for-byte**
— no transcoding), `loop`, `volume`, `pitch`, `playonawake`, `spatialblend`, min/max distance, rolloff mode,
priority, stereo pan. **Not exported:** AudioMixer groups and effects, AudioListener, custom rolloff curves,
doppler, spread.

Because the file ships as-is, **the source format is the web format** — author `.ogg` or `.mp3` for music and
ambience, short `.wav`/`.ogg` for SFX. Unity's import settings (compression, load type, force-to-mono) affect only
Unity's player, **not** the exported file; to shrink or down-mix audio for the web, convert the source file
itself (e.g. with `ffmpeg`) before importing it. Generated audio comes from `web-kie-servers.md`.

---

## 15. Prefabs and asset containers

A Unity **prefab** (`.prefab`) and a Babylon **asset container** (`bt_export_prefab`) are different things: the
first is an authoring asset, the second is an export of selected transforms from the open scene.

```bash
unity command create_prefab --source /Crate --path Prefabs/Crate.prefab --project-path "$PROJ"        # scene object -> prefab asset
unity command instantiate_prefab --prefab Prefabs/Crate.prefab --name Crate_02 --project-path "$PROJ"
unity command create_prefab_variant --base Prefabs/Crate.prefab --path Prefabs/Crate_Red.prefab --project-path "$PROJ"
unity command apply_prefab_overrides --instance /Crate_02 --project-path "$PROJ"
unity command save_prefab_contents --prefab Prefabs/Crate.prefab --rename_child Lid --new_name Top --project-path "$PROJ"
```

(Confirm each command's exact parameter names with `unity command --tag prefabs --detail full`.)

**Exporting prefabs as asset containers:** the objects must be **in the open scene** (`bt_export_prefab` resolves
`--paths` with `GameObject.Find`). Put them under one parent (e.g. `Props/`) in a staging scene, export with
`--paths "Props/Crate,Props/Barrel" --folder "$PROJ/Export/containers"`, and load them at runtime as
`AssetContainer`s. Asset containers keep animations, skins, morphs, node-level physics, colliders, components, lightmaps and
probes, but no scene-level metadata (skybox, fog, ambient, image processing, gravity, navigation).

**Babylon prefab conventions:** layer 31 ("Babylon Prefab") marks a prefab node; layer 29 ("No Instance")
disables mesh instancing; layer 30 ("Ignore Export") skips a node entirely.

---

## 16. Importing assets and import settings

```bash
unity command import_asset --source /abs/path/rock.fbx --path Models/Rock.fbx --project-path "$PROJ"
unity command get_import_settings --asset Models/Rock.fbx --project-path "$PROJ"
unity command set_import_settings --asset Models/Rock.fbx --settings '{"generateSecondaryUV":true,"importCameras":false,"importLights":false}' --project-path "$PROJ"
unity command set_import_settings --asset Textures/rock_n.png --settings '{"textureType":"NormalMap"}' --project-path "$PROJ"
unity command set_import_settings --asset Textures/ui_icon.png --settings '{"maxTextureSize":512}' --platform WebGL --project-path "$PROJ"
```

| Asset | Settings that matter for the export |
|---|---|
| Models | `generateSecondaryUV` (lightmap UVs), scale, `importCameras`/`importLights` off, animation type (Humanoid/Generic) for characters |
| Textures | `textureType` (NormalMap for normals), `sRGBTexture` (off for masks/data), `maxTextureSize`, `isReadable` when a tool needs pixels |
| HDR sky | `textureShape` Cube (2) |
| `.unitypackage` | `unity assets import` (no Editor running) — `unity-cli-reference.md` §5.4 |

Import settings live in `.meta` files and are **not undoable**. Never hand-edit `.meta` files. Models authored
or repaired in Blender follow `unity-blender-cli.md`, which edits them in place to keep GUIDs and importer settings.

---

## 17. LOD, particles, video, UI

| Component | Exports as (Pro) | Traps |
|---|---|---|
| `LODGroup` | Node keys `lods`, `coverages`, `distances` (with `MeshExportSystem` = sub-meshes) | **Distances need a Scene View camera — in a `-batchmode` Editor they are skipped (warned).** Export LOD levels from a copilot/GUI Editor. LOD renderers must be children of the group; non-first levels never cast shadows |
| `ParticleSystem` | `TOOLKIT.ShurikenParticles` — main, emission/bursts, shape (incl. mesh), renderer (billboard/mesh), velocity/force/limit, colour/size/rotation over lifetime and by speed, noise, collision (planes), triggers, sub-emitters, texture-sheet animation, lights, trails, custom data | **VFX Graph, TrailRenderer, LineRenderer are not exported**. Normal maps on particle materials are not sampled at runtime |
| `VideoPlayer` | `TOOLKIT.WebVideoPlayer` | **Only Material Override render mode** is supported |
| uGUI `Canvas` / `UIDocument` | `TOOLKIT.UserInterface` with Babylon-GUI JSON: layout groups, Button, Toggle, Slider, Scrollbar, Dropdown, ScrollRect, InputField, Text/TMP text, Image (9-slice), RawImage, masks; ~35 UI Toolkit element types; onClick/onValueChanged listeners | **Canvas render mode is ignored — World Space and Camera canvases export as full-screen 2D.** Most in-game UI belongs in DOM/React or Babylon GUI — see `ui-design-system.md` first |

---

## 18. Script components

Only classes deriving from **`EditorScriptComponent`** export — as `components[]` entries with
`klass` (`[Babylon(Class=…)]`), `order`, and every public field (`[Auto]` fields prefixed `auto__`,
`[IgnoreExport]` skipped). Plain `MonoBehaviour`s are not exported. Supported field types include primitives,
enums, strings, colours, vectors, `Texture2D`, `Cubemap`, `Material`, `AudioClip`, `VideoClip`,
`AnimationCurve`, `TextAsset`, `Transform`, `GameObject`, components and `ScriptableObject`s. Writing and
attaching the C#/TypeScript pair: `unity-exporter-cli.md` §8.2; runtime contract: `scene-components.md`.

---

## 19. Tags, layers, static flags

| Unity | Exports as |
|---|---|
| Tag | `group` and a `tags` entry (spaces → `_`); `AdditionalTags` component adds more |
| Layer | `layer`, `layermask`, `layername`, plus a `Layer<N>` tag |
| Static flags (Contribute GI / Batching / Navigation) | `freezeworldmatrix` (with `FreezeStaticMeshes`), lightmapping, `NavigationStatic` tag |
| Layer 30 "Ignore Export" | **Node skipped** |
| Layer 29 "No Instance", 20 "Vehicle", 31 "Babylon Prefab" | Instancing control |
| Inactive GameObjects | **Skipped** |

The toolkit creates its reserved layers (20–31) during bootstrap. Use `set_tags_layers` to add your own user
layers in 8–19.

---

## 20. The visual QA loop

Author → **look** → fix → repeat, at both ends:

```bash
# Unity side — GUI Editor (see the note below); absolute paths keep captures out of Assets/
unity command screenshot --view game  --output "$PWD/qa/level01_game.png"  --width 1920 --height 1080 --project-path "$PROJ"
unity command screenshot --view scene --output "$PWD/qa/level01_scene.png" --width 1920 --height 1080 --project-path "$PROJ"
unity command console --level warn --tail 50 --project-path "$PROJ"     # exporter/bake warnings
```

Open the PNG and judge it. A **lit and tonemapped** image — not flat grey, not blown out — means lighting, IBL and
post-processing are wired. Then export (`bt_export_level`), serve (`bt_devserver_start`), load the level in a real
browser, screenshot **that**, and compare it with the Unity capture. Differences point at a row of the §0 matrix.
For a long target-image loop, hand off to the `bt-gauntlet` skill.

> **Unity-side captures need a GUI Editor.** In a resident `-batchmode` Editor (the scaffold's default), camera
> renders came back showing **only the skybox** — no scene geometry, at any resolution, with `screenshot`,
> `capture_game_view` and a manual `Camera.Render` alike (Unity 6000.5.10f1, Metal, URP template; the Editor log
> showed GPU-Resident-Drawer job exceptions). Do Unity-side visual QA in a **GUI** Editor (`unity open`, with
> `set_autotick` on so it keeps rendering unfocused), and always judge the **exported** level in the browser —
> that is the result that ships.

For multi-angle Unity shots, move the Scene View camera from `run_script`
(`SceneView.lastActiveSceneView.LookAt(pivot, rotation, size)`), then `capture_scene_view`.

---

## 21. Unity features that do not exist in a Babylon export — use the Babylon equivalent

Unity's own skills cover several runtime systems. **None of them survive a glTF export**; the BabylonJS project
has its own equivalents:

| Unity system (Unity skill) | Babylon Toolkit equivalent |
|---|---|
| In-App Purchasing, LevelPlay ads | Web payments / ad SDKs in the web project (`project-installer.md`) |
| Unity Gaming Services (Cloud Code, Cloud Save, Remote Config, Multiplayer, Vivox) | Web backends and WebRTC/WebSocket services from the web project |
| Localization, TextMeshPro | DOM/React text and i18n (`ui-design-system.md`, `react-framework.md`) |
| uGUI / UI Toolkit runtime UI | DOM React UI or `@babylonjs/gui` (`ui-design-system.md` decision matrix, `babylon-gui.md`) |
| Unity WebGL player settings / Brotli / IL2CPP stripping | The web build and deployment in `project-installer.md`; KTX2/WEBP via `TextureImageFormat` |
| Timeline cinematics | A TypeScript script component or Babylon animation groups (`scene-components.md`) |
| AudioMixer | Babylon audio engine buses in a script component |
| Unity Input System | Toolkit input (`userinput` scene options) and `scene-components.md` |
| MonoBehaviour gameplay code | TypeScript `ScriptComponent`s (`scene-components.md`, `bt-convert` skill for C# → TS) |

When a user asks for one of these "in Unity", build it in the Babylon project instead, and say so in one line.
