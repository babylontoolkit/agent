## Unity Authoring Recipes — Levels That Recreate Faithfully in BabylonJS

**IMPORTANT. READ THIS TO THE END BEFORE AUTHORING ANY UNITY CONTENT. IT DECIDES HOW CLOSELY THE BABYLONJS RECREATION MATCHES THE UNITY SCENE.**

> *Portions adapted from Unity-Technologies/skills (`urp-postprocessing`, `migrate-birp-to-urp`,
> `initialize-ai-navigation`, `physics-3d-collision`, `optimize-audio`, `generate-editor-search-query`,
> `new-unity-project`), © 2026 Unity Technologies, used under the Unity Companion License. Every statement about
> how a feature reaches BabylonJS was checked against the exporter source (`ProfessionalEdition/Core`: `CVTools.cs`,
> `GLTFMetaDataExporter.cs`, `UnityTools_*.cs`, `PostProcessLutBaker.cs`, `TerrainDataExporter.cs`) and the
> runtime source (`TOOLKIT` runtime `core/`, `pro/`, `dlc/`). Toolkit source tree 9.27.1, published 9.25.1.*

### What this pipeline is

**Unity is the editor, not the engine.** Nothing here ever builds or ships a Unity game or player, and no
Unity runtime code runs, except Play Mode used to see how a scene looks in Unity for comparison. Every model and
every scene is authored in the Unity Editor and **exported to glTF with `extras.metadata`**. The Babylon Toolkit
runtime then recreates each Unity subsystem in BabylonJS: lightmaps, light probes, reflection probes, IBL, fog,
post-processing volumes, terrain, Animator state machines, physics, the navmesh, particles, audio, UI and
script components. **The goal is a near pixel-perfect, behaviour-faithful recreation of the Unity scene in the
browser.**

So **author a level exactly as you would a detailed Unity game level**: sculpt terrain, build a light rig,
bake lightmaps and probes, add volumes, animate with Animator controllers, rig physics, and bake the
navmesh. Unity's own skills and docs are valid guides for that authoring. Keep it light enough for the web
and mobile (§20). Game logic is TypeScript script components (§18), never Unity MonoBehaviours.

Every Unity feature reaches BabylonJS one of four ways. Know which before you author it:

| Class | Meaning | Examples |
|---|---|---|
| **Direct** | Serialised as-is and recreated by the runtime | meshes, PBR materials, Realtime/Mixed lights, fog, colliders, cameras |
| **Bake** | Unity bakes it; the bake output ships | lightmaps and shadowmasks, light probes, reflection probes, IBL `.env`, colour-grading LUTs, the Recast navmesh, animation clips |
| **Toolkit** | Carried by a toolkit component or runtime class that mirrors the Unity system | `TerrainBuilder`, `AnimationState`, `PostProcessor`, `RigidbodyPhysics`, `NavigationAgent`, `ShurikenParticles`, script components |
| **Substitute** | Not carried; the named Babylon-side equivalent does the job | cookies, Timeline, VFX Graph, realtime GI |

**Baking is how the pipeline carries lighting and navigation.** Always bake. Unity's lightmapper, probe
bakes, reflection-probe bakes and the toolkit's Recast navmesh bake produce exactly the data the runtime
recreates.

> ### Trust the parity
>
> **The goal is parity: any well-made Unity scene, including a ready-made Asset Store scene, exports and looks
> right as it is (§23).** The exporter and runtime are built for that goal.
>
> - Author the way Unity artists author. Don't restructure a scene, or avoid Unity features, "for the export".
> - Keep working in Unity, and let the milestone browser checks (§21) confirm fidelity.
> - The tables in this document explain how each feature is carried. Use them to **diagnose a specific
>   difference seen at a milestone**, and to pick between two equally good authoring options (Metallic over
>   Specular, mesh grass over texture grass, Baked Indirect over Distance Shadowmask).
> - When the Unity frame is right, the browser frame is wrong, and no row lists a fix, that is a **toolkit parity
>   gap**. Record it for the toolkit (the feature, the scene, both captures) instead of restyling the scene
>   around it.

How to call the typed commands is in `unity-editor-commands.md`. The export itself is `unity-exporter-cli.md`
§9–§11. The runtime side of every component is in `scene-components.md`.

---

## 0. The fidelity matrix — read this first

| Unity feature | How it reaches BabylonJS | Notes |
|---|---|---|
| Meshes, skinned meshes, blend shapes | **Direct** | ≤ 4 bone influences; blend shapes take the last frame (§13) |
| URP Lit (Metallic), Complex Lit, Unlit, Built-in Standard, HDRP Lit → glTF PBR + KHR extensions | **Direct** | Author URP Lit in the **Metallic** workflow; Specular workflow and Simple Lit specular are ignored (§2) |
| Detail maps, parallax, premultiply / additive / multiply blending | **Direct** (material extras, rendered) | §2 |
| Shader Graph | **Toolkit** — transpiled to a TypeScript material class | Level exports only (§2) |
| Directional / Point / Spot, **Realtime** | **Direct** | §3 |
| **Mixed** lights | **Direct + Bake** — realtime direct light, baked indirect and shadowmask | The right mode for a sun (§3) |
| **Baked** lights, Area / Rect / Disc lights | **Bake** — lightmaps light static objects, light probes light dynamic ones | The light node itself is not written, and **its children are skipped too** (§3) |
| Lightmaps: Baked Indirect, Shadowmask, Subtractive | **Bake** | Distance Shadowmask is approximated (§4) |
| Directional lightmaps | **Bake**, approximated as non-directional | Bake `NonDirectional` so Unity previews what ships (§4) |
| Emissive surfaces lighting the scene | **Bake** (the emission itself is Direct) | Material GI = Baked (§4) |
| Light probes / Adaptive Probe Volumes | **Bake** → `TOOLKIT.LightProbeNetwork` | Needs Skybox ambient, the baked IBL and a `SceneController`; levels only (§5) |
| Reflection probes (Baked / Custom), box projection | **Bake** | One probe per renderer; no blending. **Never use Realtime mode** (§6) |
| Skybox, IBL `.env`, spherical-harmonic ambient | **Bake** | Levels only; needs `Camera.main` with Skybox clear flags (§7) |
| Gradient / Color ambient | **Direct**, approximated with a hemispheric light | No light probes in these modes (§7) |
| Fog (Linear / Exp / Exp2; HDRP Fog volume) | **Direct** | §8 |
| Shadows — cascades, distance, resolution, softness | **Direct**, from the URP asset | §3 |
| URP / HDRP / PPv2 Volumes | **Toolkit** `PostProcessor` + **Bake** (the whole colour grade becomes a LUT) | Pro (§9) |
| Camera — projection, FOV, clip, clear, HDR, physical camera, FXAA / SMAA / TAA / MSAA | **Direct** | Anti-aliasing owner is Pro (§9) |
| Terrain — heightmap, ≤ 16 layers, holes, trees, mesh details, wind, TerrainCollider, terrain lightmap | **Toolkit** `TerrainBuilder` | Pro. Texture-grass details are not rendered — use mesh details (§10) |
| Rigidbody, Box / Sphere / Capsule / Mesh / Terrain / Wheel colliders, physics materials, triggers, CharacterController | **Direct / Toolkit** (Havok) | Pro (§11) |
| Physics joints, gravity | **Toolkit** — Starter joint components, `SceneController` gravity | §11 |
| Navigation mesh | **Bake** — the toolkit's Recast `UniRcNavMeshSurface` | Levels only (§12) |
| NavMeshAgent | **Toolkit** `NavigationAgent` (crowd) | Pro (§12) |
| Animation clips | **Bake** (glTF animations, 30 fps) | Not licence-gated (§13) |
| Animator state machines, blend trees, layers, avatar masks, root motion, events | **Toolkit** `AnimationState` | Pro. Direct blend trees and additive layers are not carried (§13) |
| AudioSource, AudioListener | **Toolkit** `AudioSource`; the camera system is the listener | Pro (§14) |
| Prefabs | **Toolkit** — layer-31 in-level prefabs, or asset containers | §15 |
| Particle systems (Shuriken, every module) | **Toolkit** `ShurikenParticles` | Pro (§17) |
| Screen-space uGUI Canvas / UIDocument, TMP text in a Canvas | **Toolkit** `UserInterface` → Babylon GUI | Pro (§17) |
| VideoPlayer (Material Override) | **Toolkit** `WebVideoPlayer` | Pro (§17) |
| LOD groups | **Direct** | Pro; distances need a GUI Editor (§17) |
| Babylon Toolkit script components (`EditorScriptComponent`) | **Toolkit** — TypeScript classes | Not licence-gated (§18) |
| Tags, layers, static flags | **Direct** | §19 |
| Timeline, VFX Graph, Trail / Line renderers, cookies, realtime GI, occlusion culling, URP renderer features, 2D | **Substitute** | §22 |

**Pro** means the project needs a valid Babylon Toolkit `license.json` (`unity-exporter-cli.md` §0). Without it
the export still "succeeds", but the following are **silently omitted**:
- every `physics` and `collision` block, including static colliders;
- terrain, AnimationState, AudioSource, NavigationAgent, CharacterController, particles, UI, video;
- post-processing volumes, LOD groups and camera anti-aliasing.

Meshes, materials, lights, cameras, bakes, animation clips and script components still export.

**Level vs asset container.** Scene-level data is written **only for game levels** (`bt_export_level`):
- skybox, IBL and ambient;
- fog, image processing and gravity;
- the navmesh and **light probes**.

Node-level data is written for **both** levels and asset containers (`bt_export_prefab`): components, physics
bodies, colliders, lightmaps and reflection probes.

---

## 1. Level baseline — do this for every new level

| Requirement | Why | How |
|---|---|---|
| URP project, **Linear** colour space | The exporter warns in Gamma; procedural sky and ambient differ | `urp-blank` template is Linear by default; check `get_player_settings` |
| Scene saved under `Assets/Scenes/<Level>.unity` | Every bake writes into `Assets/Scenes/<Level>/` (lightmaps, `ReflectionProbe-N.exr`, `NavigationMesh.bin`). An unsaved scene has no folder | `create_scene --path Scenes/Level01 --template default` |
| A **LightingSettings asset** assigned and **saved into the scene** | Export throws `Lightmapping.lightingSettings is null` otherwise | `unity-exporter-cli.md` §8.1 |
| `Camera.main` (tag `MainCamera`) with **Skybox** clear flags | No skybox or IBL is exported without it | The `default` scene template provides it |
| An **active** `SceneController` component (toolkit) | Scene options (gravity, input, imaging, lighting, max lights) **and the light-probe network** — without it no `LightProbeNetwork` is emitted | `add_component --type SceneController` |
| GPU Resident Drawer off; URP renderer on **Forward** (not Forward+) | The drawer is Unity-only batching the export never uses. Left on, a failed registration makes Unity camera captures render only the sky. The toolkit recommends the standard Forward path | `eval 'return RenderPathTools.DisableResidentDrawerReport();'` (dialog-free; the §4B scaffold does it) |

Create it in one go:

```bash
unity command create_scene --path Scenes/Level01 --template default --project-path "$PROJ"   # Main Camera + Directional Light
unity command add_component --target "/Main Camera" --type SceneController --project-path "$PROJ"
unity command save_scene --project-path "$PROJ"
# then assign LightingSettings — unity-exporter-cli.md §8.1 (run_script: TryGetLightingSettings -> CreateAsset -> MarkSceneDirty -> SaveOpenScenes)
```

---

## 2. Materials and shaders

**Reaches BabylonJS as.**
- **Core glTF material:** `pbrMetallicRoughness` + `normalTexture` + `occlusionTexture` + `emissiveTexture`
  (only when emission is non-black), `alphaMode`, `doubleSided`, and `KHR_materials_unlit` for unlit materials.
- **Material extras:** Babylon-specific data rides on `materials[i].extras.metadata`, and the runtime renders it:
  - the lightmap and shadowmask;
  - the reflection cubemap;
  - the **detail map** (PBR `detailMap`);
  - **parallax** (height packed into the normal alpha);
  - extended alpha modes;
  - custom shader data.
- **Instances:** the same material splits into `…Instance…` copies when renderers differ in lightmap index or
  reflection probe.
- **Textures:** re-encoded in `TextureImageFormat` (PNG `0`, WEBP `2`, KTX2 `3`). Two exceptions: 16-bit normal
  maps always stay PNG16, and skybox KTX2 is off by default.

**The specular setting.** **`UseSpecularMaterials`** (default **on**) selects one of two whole export paths:
- **On (Specular path):** metallic-roughness plus `KHR_materials_specular`. URP shaders get their specular factor
  from the exporter's global settings, not from `_SpecColor`.
- **Off (Classic path):** `Standard (Specular setup)` materials export `KHR_materials_pbrSpecularGlossiness`.

**Other KHR extensions** come from keywords and properties:
- `emissive_strength` (HDR emission), `ior`, and `texture_transform` (non-identity tiling/offset);
- `clearcoat` (the `_CLEARCOAT` / `_CLEARCOATMAP` keyword);
- `sheen` (`_SHEEN_ON` plus glTF-style property names);
- `anisotropy`, `iridescence` and `transmission` / `volume` (glTF keywords, or HDRP `_MaterialID`).

No material or texture feature is licence-gated.

| Shader family | Export |
|---|---|
| **URP Lit** (Metallic workflow), Complex Lit, Built-in Standard, `Babylon/System/*` | glTF PBR — the well-trodden path |
| URP Unlit, any shader name containing `Unlit` | `KHR_materials_unlit` |
| `Standard (Specular setup)`, glTF spec-gloss shaders | `_SpecColor` carried |
| URP Lit **Specular workflow**, URP **Simple Lit** | ⚠️ take the metallic path — `_SpecColor` / `_SpecGlossMap` are **ignored**. Author URP Lit in the **Metallic** workflow |
| URP **Baked Lit** | ⚠️ exported as lit PBR — use Unlit with lighting in the albedo, or Lit + a lightmap |
| HDRP Lit | Generic path (warned) that still carries `_BaseColorMap`, `_MaskMap` (metallic/roughness + AO), `_NormalScale`, `_EmissiveColor`, and the `_MaterialID` features. Subsurface scattering is dropped; HDRP Unlit's `_UnlitColor` is not read |
| Unrecognised shaders | Generic PBR by property sniffing, warned *"unrecognised shader … map it or give it a SHADER_CONTROLLER block"* |
| **Shader Graph** | `customShader` + a generated TypeScript material class (transpiled on **level** exports; plain PBR in asset containers and for terrain prototypes). With *Allow Material Override* off, the graph's own surface / alpha / cull settings win |
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
Property names include the leading underscore (`_BaseColor`, `_BaseMap`, `_EmissionColor`).

**How properties map** (URP Lit):

| Unity property | BabylonJS result |
|---|---|
| `_BaseColor` × `_BaseMap` | Base colour. An HDR base colour's peak moves into emission |
| `_Metallic` + `_Smoothness` | Metallic, and roughness = 1 − smoothness |
| `_MetallicGlossMap` | Baked into a new metallic-roughness texture, with smoothness from the map's alpha |
| `_BumpMap` × `_BumpScale` | Normal map, re-rendered with Y flipped |
| `_OcclusionMap` | Occlusion (green channel) |
| `_EmissionColor` | Emissive. Its HDR peak becomes `emissive_strength` |
| `_DetailAlbedoMap` / `_DetailNormalMap` | Detail map. A detail normal on its own is promoted to the normal map |
| `_ParallaxMap` | Parallax |

**Alpha.** Transparency is read from the **surface settings**, **not** from keywords (`_ALPHATEST_ON` counts
only when the exporter's `UseAlphaKeywords` setting is on, default off):

| Surface setting | Result |
|---|---|
| Opaque + `_AlphaClip` = 1 | `MASK`, cutoff from `_Cutoff` |
| `_Surface` = 1 (Transparent) | `BLEND`. Transparent **+ AlphaClip** is also `BLEND`, and the clip is lost |
| Premultiply / Additive / Multiply blend | Carried |

Double-sided comes from `_Cull` = 0, `_DoubleSidedEnable`, a `/DoubleSided` shader name, or a graph's render
face set to Both.

**Textures.** The exporter has **no maximum texture size for materials**: every texture ships at its Unity
**import** size, so set `maxTextureSize` on the importer (§16, §20). Terrain layers are the exception, capped
by `TerrainLayerMaxSize`.
- **Tools:** WEBP needs the **`cwebp`** tool and KTX2 the **`ktx`** tool on the machine. KTX2 is UASTC, zstd,
  mipmaps; normal maps are encoded `--normalize`.
- **WEBP is lossless by default** (`DefaultWebpImageCommandType`). Switch it to lossy for real savings.
- **Wrap modes:** Clamp → clamp, everything else → repeat. **Mirror is not carried.**

**Traps:**
- **A normal map must be imported as a normal map** (`set_import_settings --asset Textures/stone_normal.png --settings '{"textureType":"NormalMap"}'`), and the `_NORMALMAP` keyword enabled.
- **Emission needs both** `_EmissionColor` non-black **and** the `_EMISSION` keyword.
- **Complex Lit clear coat:** with `_ClearCoatMask` > 0, Babylon turns on clear coat **even with `_CLEARCOAT`
  off**. Keep the mask at 0 unless you want clear coat.
- **Vertex colours** export only with `MeshDetails.useVertexColors`, a shader name containing "Vertex" and
  "Color", or a Shader Graph that reads vertex colour.
- **Read back every shader name after a conversion.** Unity's Built-in→URP converter can silently assign the
  wrong shader (e.g. a 2D mesh shader to a 3D Standard material). `get_material_properties` shows the shader.
- `Shader.Find` returning null is an error, not a fallback. Use `GraphicsSettings.currentRenderPipeline.defaultMaterial` for "the pipeline's default lit material".

---

## 3. Lights

**Reaches BabylonJS as.** A `light` component on the node. No licence gate.

| Key | Carries |
|---|---|
| `type` | 0 directional, 1 point, 2 spot |
| `color`, `intensity` | Unity intensity × π on URP/Built-in, × the toolkit's per-type scale (default 1). Colour temperature is applied |
| `intensitymode` | Point lights use inverse-square falloff |
| `range`, `spotangle` / `innerspotangle` | Range and cone |
| Shadows | `generateshadows`, `softshadows` (PCF), `shadowstrength`. Cascades, split, distance and `shadowmapsize` come from the **URP pipeline asset** (map size = the main-light resolution, used for every light). Babylon bias = Unity bias × 0.1 |
| `lightmapmode`, `occlusionmaskchannel` | Mixed-light bake data |
| `renderlist` | From the culling mask |

Extra Babylon shadow knobs come from the toolkit **`LightSettings`** component on the same GameObject. At
runtime, shadows are created only at render quality High or Medium. A material takes at most
`SceneController` **`maximumLights`** lights (default 4).

| Light mode | How it reaches BabylonJS | Use it for |
|---|---|---|
| Realtime | **Direct** — lights everything at runtime, with realtime shadows | Moving or animated lights, anything that must change at runtime |
| **Mixed** | **Direct + Bake** — realtime direct light and shadows, plus baked indirect (and the shadowmask) | The **sun**, and any key light that must give specular highlights or realtime shadows on dynamic objects |
| **Baked** | **Bake** — the light node is not written; its direct and indirect light live in the **lightmaps** (static objects) and the **light probes** (dynamic objects) | Fill, bounce and practical lights. They cost nothing at runtime. They give no specular highlight and no realtime shadow on dynamic objects |
| Area / Disc / Rectangle (URP, Built-in) | **Bake** — Unity bakes them only; carried by lightmaps and probes | Soft window light, panels, signage |
| HDRP **realtime** Rectangle | **Substitute** — dropped **without a warning** | Bake it, or add a Babylon `RectAreaLight` from a script component |

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

**Traps:**
- **Never parent anything under a Baked light.** The exporter skips the Baked light's node **and its whole
  subtree**, so children vanish from the export.
- A Baked light's warning ("Baked lights") in the export summary is expected. It is not a failure.
- Cookies are not carried. Add `SpotLight.projectionTexture` from a script component.
- HDRP physical light units carry over only with `UseHDRPPhotometricLights` on (default off, warned).
- Under Shadowmask, more than four overlapping Mixed lights exceed the shadowmask channels (warned).

---

## 4. Lightmaps and global illumination

**Reaches BabylonJS as.**
- **Per material:** each lightmapped renderer's material gets `lightmapTexture` (colour) and, under Shadowmask,
  `shadowmaskTexture`, plus `lightmapLevel`.
- **Per mesh:** a `TEXCOORD_1` accessor with the renderer's lightmap scale/offset baked in.
- **Encoding:** lightmaps are re-encoded as **RGBD PNG**. Keep `TextureImageFormat` = 0: the WEBP/KTX2 lightmap
  paths are not verified.
- **Scene keys:** `lightmapbakemode`, `shadowmaskmode`, `subtractiveshadowcolor`, `renderpipeline`
  (`birp`/`urp`/`hdrp`).
- **Diffuse IBL:** lightmapped materials suppress it, because the lightmap already holds the indirect light.

| Mixed Lighting mode | Fidelity in BabylonJS |
|---|---|
| **Baked Indirect** | The most exact. Mixed lights give full realtime direct light and shadows |
| **Shadowmask** | Exact within **four overlapping Mixed lights** per area; the runtime combines `min(realtime, baked)` shadowing |
| **Subtractive** | For a single main directional light. Non-realtime direct light is removed from lightmapped surfaces and the main light's shadow is subtracted |
| Distance Shadowmask | **Approximated.** Behaviour past the shadow distance differs from Unity — prefer Shadowmask |

**Author it:**

```bash
unity command get_lighting_settings --project-path "$PROJ"
unity command set_lighting_settings --project-path "$PROJ" --dry_run true \
  --settings '{"bakedGI":true,"realtimeGI":false,"lightmapper":"ProgressiveGPU","bounces":2,"lightmapResolution":20,"directionalMode":"NonDirectional","maxLightmapSize":2048}'
# review applied[] / unknown[], then run again without --dry_run
unity command bake_lighting --project-path "$PROJ"
deadline=$((SECONDS+900)); seen=""
while :; do
  s=$(unity command lighting_bake_status --project-path "$PROJ" --result-only 2>/dev/null)
  case "$s" in
    *completed*) break;;
    *failed*) echo "failed: $s"; exit 1;;
    *baking*|*running*|*in_progress*) seen=1;;
    *idle*) [ -n "$seen" ] && { echo "stopped without completing"; exit 1; };;
  esac
  [ $SECONDS -ge $deadline ] && { echo "timed out after 15 min"; exit 1; }
  sleep 5
done
unity command save_scene --project-path "$PROJ"
```

Mark static geometry **Contribute GI** (static flags) so it receives lightmaps — from `run_script`:
`UnityEditor.GameObjectUtility.SetStaticEditorFlags(go, UnityEditor.StaticEditorFlags.ContributeGI | UnityEditor.StaticEditorFlags.BatchingStatic)`.
Meshes need lightmap UVs (`generateSecondaryUV` on the model importer, or authored UV2). A mesh without UV2
falls back to UV0.

Set **Player Settings ▸ Lightmap Encoding = High Quality**. The exporter decodes every encoding, but a lower
setting loses range and is warned.

**Check after every bake:**
- `Assets/Scenes/<Level>/` contains the lightmap and shadowmask textures and `ReflectionProbe-*.exr`.
- `LightmapSettings.lightmaps.Length > 0`, and static renderers have `lightmapIndex >= 0`.
- Each Mixed light's `bakingOutput.mixedLightingMode` matches the scene's mode.

**Traps:**
- **Bake `directionalMode` = `NonDirectional`.** Directional lightmaps export their colour map only (the
  direction map is not read), so a directional bake looks non-directional in Babylon. Baking non-directional
  makes Unity preview what ships.
- **Emissive materials** light the scene through the bake: set the material's Global Illumination to **Baked**.
- **Realtime GI (Enlighten) is not carried** (`globalillumination` is always `false`). Bake the GI instead.
- The exporter **refuses to export while a bake is running**, and in the legacy *Iterative* GI workflow it
  forces a synchronous bake first. Always bake explicitly and wait for `completed`.
- A **stale bake** (the mixed-lighting mode changed after baking) is warned — re-bake.
- **Check duplicated lightmapped props at a browser checkpoint.** Several copies of one mesh and material in the
  same lightmap atlas may share the first copy's UV2 region. That is unverified, so look before relying on it.

---

## 5. Light probes

**Reaches BabylonJS as.**
- **Files and components:** a binary side file `<scene>.probe.bin` written **next to the scene file** in the scenes
  folder (not under `assets/`; with compression on, its gzip twin is `<scene>.probe.gz.bin`), a scene `lightprobes`
  header, per-node `lightprobes` usage, and one `TOOLKIT.LightProbeNetwork` component.
- **Runtime:** a tetrahedral walk. Static meshes get pre-interpolated spherical harmonics; dynamic meshes
  re-sample after moving 0.05 m.
- **This is how Baked lights light moving objects.** The probe network deliberately excludes Baked lights from
  realtime lighting, because the probes already contain them.
- **Sources:** classic `LightProbeGroup`s or Adaptive Probe Volumes. APV is capped at 8192 probes, and every
  non-lightmapped renderer is probe-lit under APV.

**All of these are required, or nothing is written:**
- `RenderSettings.ambientMode` = **Skybox**;
- the IBL environment baked (§7);
- an **active `SceneController`**;
- a **level** export — light probes never ship in asset containers.

A renderer is probe-lit only if it is a Mesh or SkinnedMeshRenderer, **not** lightmapped, with *Blend Probes*
(or Proxy) usage.

**Author it:** place a `LightProbeGroup` that covers everywhere dynamic objects move
(`add_component --type LightProbeGroup`), then set its positions via `set_serialized_field` on
`m_SourcePositions.Array.data[i]` or from `run_script`. Run `bake_lighting` — the probes bake with the lightmaps.

**See the probes.** Exporter setting **Show Debug Probes** (Collision System panel; `CanvasToolsInfo.Instance.ShowDebugProbes`,
default off) draws a small yellow sphere at every probe position — one thin-instanced mesh, so thousands of APV probes
cost one draw. It is exported as the `showdebug` property of the `TOOLKIT.LightProbeNetwork` component. At runtime,
`TOOLKIT.LightProbeNetwork.Get(scene).setDebugVisible(true | false)` toggles it without a re-export, and
`TOOLKIT.LightProbeNetwork.DebugProbeSize` (metres, default 0.1) sets the sphere size before the scene loads.

---

## 6. Reflection probes

**Reaches BabylonJS as.**
- **One probe per renderer:** the **single highest-weight enabled probe** only.
- **Baked** and **Custom** probes are converted to `.env` (default) or `.dds` at the probe's resolution and
  attached as the material's `reflectionCubemapFile`.
- `probe.boxProjection` exports as box projection (`boundingBoxSize` = the probe size, `boundingBoxPosition` =
  its position + centre).
- Probe `intensity` / `importance` are **not** read. The global `ReflectionProbePower` setting applies instead.
- **Probe blending is not carried** (warned). Place one probe per area.
- The runtime applies reflection probes at render quality High / Medium.

**Author it:**

```bash
unity command create_gameobject --name "Probe_Hall" --project-path "$PROJ"
unity command add_component --target /Probe_Hall --type ReflectionProbe --project-path "$PROJ"
unity command set_transform --target /Probe_Hall --position '[0,2,0]' --project-path "$PROJ"
unity command set_component_properties --target /Probe_Hall --type ReflectionProbe --project-path "$PROJ" \
  --properties '{"m_Mode":0,"m_BoxProjection":true,"m_BoxSize":[20,6,20],"m_Resolution":256}'
#   m_Mode: 0 Baked, 1 Realtime, 2 Custom — use Baked or Custom
unity command bake_lighting --project-path "$PROJ"     # baked probes bake with the lightmaps
```

**Traps:**
- **Never use Realtime mode.** A Realtime probe gives its renderers a `[REALTIME]` placeholder cubemap that the
  runtime does not handle. For truly dynamic reflections, add a Babylon `ReflectionProbe` from a script
  component.
- Under URP, turn probe blending **off** in the URP pipeline asset. Box projection is also switched on there.
- The component's public properties for those flags are read-only in some versions. Set them through the
  serialized fields (`set_serialized_field` / `SerializedObject`), not the C# property.

---

## 7. Skybox, IBL and environment

**Reaches BabylonJS as** (levels only, scene key `skybox`):
- the sky texture(s), `exposure` and `rotation`;
- `environment`: the IBL `.env` baked from `<SceneDir>/<Scene>/ReflectionProbe-N.exr` (the highest N), plus 27
  spherical-harmonic floats (`sh`) that become the scene's ambient in **Skybox ambient mode**.

**Requirements:**
- `Camera.main` with **Skybox clear flags**;
- a skybox material in `RenderSettings.skybox`;
- **Reflections Source = Skybox** (`RenderSettings.defaultReflectionMode`);
- a lighting bake.

`defaultReflectionResolution` becomes the IBL cube size. **Custom** reflection mode exports its cubemap without
the camera check.

| Skybox material shader | Export |
|---|---|
| `Skybox/Cubemap` (`_Tex`) | One RGBD `.env` (Compressed), a copied `.hdr/.exr/.dds`, or six RGBD PNG faces |
| `Skybox/6 Sided`, `Mobile/Skybox`, `Skybox/Babylon Toolkit` | Six face textures |
| `Skybox/Procedural` | A `procedural` block (sun disk/size, atmosphere, tint, ground, exposure) — no texture |
| HDRP `HDRISky` | Its cubemap as the sky. From the source, HDRP gets no `.env` IBL, SH or probe network unless Reflections Source is Custom (unverified) |
| Anything else (incl. HDRP PhysicallyBased/Gradient sky) | **Skybox and reflections disabled** (warned) |

| Ambient mode | Result |
|---|---|
| **Skybox** | Spherical-harmonic ambient from the baked sky, plus the light-probe network (§5). **Use this** |
| Gradient | A hemispheric light (sky and ground colours; the equator colour is dropped). No light probes |
| Color | A hemispheric light (ground = half the colour). No light probes |

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

**Trap:** `SKYBOX: You must generate the scene lighting` in the log means the IBL source `.exr` does not exist.
Bake lighting after setting the skybox. Without it the level has a sky but **no image-based lighting**, and PBR
materials look flat.

---

## 8. Fog

**Reaches BabylonJS as** (levels only):
- `RenderSettings.fog` / `fogMode` → `fogmode`:
  - 1 = Exponential (density × 0.5);
  - 2 = ExponentialSquared (density × 0.66);
  - 3 = Linear (`fogstart` / `fogend`);
- plus `fogcolor` and `fogdensity`.

The runtime sets the linear fog end to **twice** the exported value. The sky is never fogged.

An HDRP Fog volume becomes exponential fog with height, albedo and anisotropy keys. Volumetrics are flagged, not
reproduced. Local volumetric fog is not carried. Compare fog at a browser checkpoint (§21).

```bash
unity command eval 'UnityEngine.RenderSettings.fog = true;
UnityEngine.RenderSettings.fogMode = UnityEngine.FogMode.ExponentialSquared;
UnityEngine.RenderSettings.fogDensity = 0.02f;
UnityEngine.RenderSettings.fogColor = new UnityEngine.Color(0.55f, 0.62f, 0.72f);
UnityEditor.SceneManagement.EditorSceneManager.MarkSceneDirty(UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene());
return "ok";' --project-path "$PROJ"
```

---

## 9. Post-processing (URP Volumes) and the camera

**Reaches BabylonJS as** (Pro). Each enabled `Volume` (URP/HDRP) or `PostProcessVolume` (PPv2) becomes a
`TOOLKIT.PostProcessor` component with `isglobal`, `weight`, `priority`, `blenddistance`, `bounds` and an
`effects[]` list, read from the volume's `sharedProfile`.
- **Colour grading.** The volume's whole colour grade is **baked into a LUT strip PNG**
  (`assets/<volume>_lut.png`) and replayed by the toolkit's HDR grading plugin. That grade covers tonemapping,
  contrast, saturation, hue, colour filter, white balance, channel mixer, lift/gamma/gain,
  shadows/midtones/highlights, split toning, curves and ColorLookup. It is baked in HDR (LogC) with the
  tonemapper inside. Post-exposure stays a runtime value.
- **Tonemapping inheritance.** A volume that does not override Tonemapping inherits it from the pipeline
  defaults.
- **Pipeline defaults.** URP's **default volume profiles** (the global default at priority -20000, the quality
  asset's at -10000) are exported onto the main camera, so the look matches Unity even with no scene Volume.

| Effect | How it reaches BabylonJS |
|---|---|
| Tonemapping, ColorAdjustments, WhiteBalance, ChannelMixer, LiftGammaGain, ShadowsMidtonesHighlights, SplitToning, ColorCurves, ColorLookup (PPv2 ColorGrading) | **Bake** → the LUT |
| Bloom, Vignette, ChromaticAberration, FilmGrain / Grain, LensDistortion | **Toolkit** post-process plugins |
| DepthOfField, MotionBlur | **Direct** → Babylon's default rendering pipeline / motion blur |
| HDRP ScreenSpaceAmbientOcclusion, PPv2 AmbientOcclusion | **Direct** → SSAO2 |
| HDRP ScreenSpaceReflection, PPv2 SSR (Deferred) | **Direct** → SSR pipeline |
| HDRP Exposure, PPv2 AutoExposure | **Toolkit** auto-exposure |
| PaniniProjection, ScreenSpaceLensFlare, anything else | **Substitute** (warned) — a custom Babylon post-process or `LensFlareSystem` in a script component |
| URP **renderer features** (including the SSAO feature) | **Substitute** — not read; add `SSAO2RenderingPipeline` etc. from a script component |

**The camera** (`Camera.main` drives the view):
- **Direct:** projection, FOV, near/far clip, clear flags and background colour, `allowHDR` (**the browser
  follows the camera's HDR flag, not the URP asset's**) and the physical camera.
- **Anti-aliasing (Pro):** FXAA, SMAA and TAA become toolkit plugins. MSAA samples need the exporter's
  `EnableAntiAliasing` (default on).
- **Not carried:** URP render scale — use `engine.setHardwareScalingLevel`. Viewport rect, depth, target texture,
  culling mask and Cinemachine are not carried either — use the toolkit `DefaultCameraSystem` or a script
  component.

**The five pre-flight checks** — an effect that "does nothing" in Unity will do nothing in the export either:

1. The project's render pipeline asset exists (`get_graphics_settings`, quality levels).
2. **HDR** is allowed on the camera, and on in the URP asset (for an accurate Unity preview).
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

        var cam = Camera.main; if (cam == null) throw new System.Exception("No Main Camera");
        var data = cam.GetComponent<UniversalAdditionalCameraData>(); if (data == null) data = cam.gameObject.AddComponent<UniversalAdditionalCameraData>();   // not ??: it misses Unity's fake null
        data.renderPostProcessing = true;
        data.volumeLayerMask |= 1 << go.layer;

        UnityEditor.SceneManagement.EditorSceneManager.MarkSceneDirty(go.scene);
        UnityEditor.SceneManagement.EditorSceneManager.SaveScene(go.scene);
        return "volume + profile saved";
    }
}
```

**Traps:**
- Put the level's grade in **global** Volumes.
- A **local** Volume (`isGlobal = false`) needs a **Box or Sphere Collider on the same GameObject**, which gives
  its exported bounds. Without one it is ignored at runtime (warned).
- **A local Volume's blend weight is computed once, when the level loads**, not per frame as the camera moves.
  Use local Volumes only for areas the camera starts in, or drive transitions from a script component.
- Use `sharedProfile` to edit the asset; `profile` silently clones it.
- URP's LDR grading mode is not read; grading always bakes as HDR.
- Texture3D LUTs are not supported.
- The URP names differ from PPv2: `Volume` (not `PostProcessVolume`), `ColorAdjustments` (not `ColorGrading`),
  `profile.TryGet<T>(out var x)` (not `GetSetting<T>`).

Recipes for common looks (all with ACES tonemapping):

| Look | Settings |
|---|---|
| **Cinematic** | Bloom 0.5–1 / threshold 0.9, Vignette 0.25, slight warm white balance |
| **Stylised** | Saturation +20, contrast +15, low bloom |
| **Horror** | Desaturate −40, vignette 0.45, film grain 0.3, cool white balance |
| **Clean / mobile** | Tonemapping + light bloom only |

---

## 10. Terrain

**Reaches BabylonJS as** (Pro): a `TOOLKIT.TerrainBuilder` component, recreated as a quadtree-LOD heightfield
surface with the same splat blend as the Unity terrain material. Heights, trees and details go into the scene's
binary buffer, and splat/control images are written beside it.
- **Transform:** the terrain node is exported **position-only**, because Unity ignores terrain rotation and scale.
- **Prototypes:** tree and detail prototypes export as template groups, with their materials forced to plain PBR.
- **`TerrainExportMode`:** 0 = heightfield (default, use it), 1 = legacy segmented mesh.

**Author it:** create everything from `run_script`:
1. Create the `TerrainData` asset: `new TerrainData { heightmapResolution = 513, size = new Vector3(500, 60, 500) }`,
   then `AssetDatabase.CreateAsset`.
2. Create the `Terrain` GameObject with `Terrain.CreateTerrainGameObject(data)`.
3. Set heights with `data.SetHeights(0, 0, float[,])`.
4. Assign `TerrainLayer` assets to `data.terrainLayers`, and paint with `data.SetAlphamaps`.
5. Save the scene, bake lighting, then export.

| Terrain feature | How it reaches BabylonJS |
|---|---|
| Heightmap | Full resolution (≥ 33), u16, in the scene `.bin`; `pixelError` drives the runtime LOD |
| Terrain layers | **Up to 16** (beyond that the 16 most-painted are kept, warned). Albedo, normal and mask as JPG at ≤ `TerrainLayerMaxSize` (default 1024). Smoothness packs into the normal's blue channel. Mask maps export for URP/HDRP |
| Splat control maps | PNG, not resampled |
| Terrain material | Its pipeline flavour (URP Terrain Lit / Shader Graph "Terrain" → urp, HDRP TerrainLit → hdrp, `Nature/Terrain/*` → built-in) is recreated, with height blending |
| Holes | Carried — cut in the surface, the collider and the splat material |
| Terrain lightmap | ✅ in `.gltf` exports — **skipped in `.glb`** (warned) |
| Trees | Prefab prototypes → thin instances with LODGroup levels, crossfade, billboards and SpeedTree hue. Tree colliders need "Enable Tree Colliders"; only the first capsule/box/sphere is used |
| **Mesh** details | Instanced, with sway, grass wave and distance fade (`TerrainFoliagePlugin`); sway reads `Wind_Intensity` / `Wind_Speed` / `Wind_Wavelength` material properties |
| **Texture** grass (Grass / GrassBillboard) | ⚠️ exported but **not rendered** — author grass as **mesh** detail prototypes (a crossed-quad prefab) |
| WindZone | Carried (levels) — drives foliage sway |
| `TerrainCollider` | Carried — a **Havok heightfield** body with friction and bounciness (needs Havok physics) |
| Neighbouring terrains | One builder per terrain; mesh skirts close the seams |

Without Pro nothing is written — in heightfield mode there is then **no terrain surface at all**.

---

## 11. Physics

**Reaches BabylonJS as** (Pro, `ExportPhysics` on). Per node:
- **`physics`:** `type: "rigidbody"`, `mass`, drag, `freeze`, `gravity`, `kinematic`.
- **`collision`:** Box, Sphere, Capsule, Mesh (a convex hull when *Convex*), Terrain or Wheel. Two or more
  colliders become a compound collider with per-shape friction and restitution.
- **A component:** `TOOLKIT.RigidbodyPhysics` or `TOOLKIT.CharacterController`, recreated with Havok.

A collider with no Rigidbody becomes a **static** body (mass 0). Kinematic bodies become animated bodies.
Layers become the shape's collision membership.

| Unity setting | How it reaches BabylonJS |
|---|---|
| Mass, drag, angular drag, use gravity, kinematic | **Direct** |
| Rotation constraints | **Direct** |
| **Position** constraints | **Substitute** — not applied at runtime; clamp in a script component or use a `SixdofJoint` |
| Physics materials (friction, bounciness, combine modes) | **Direct**. No material = the exporter's Default Friction / Restitution (0.6 / 0) |
| Triggers | **Direct** for primitive colliders; events arrive once a script calls `enableCollisionEvents()` |
| `Physics.gravity` | **Toolkit** — `SceneController.sceneOptions.defaultGravity` (default `(0,-9.81,0)`, levels only) |
| Hinge / Fixed / Spring / Configurable / Character joints | **Toolkit** — Starter joint components: `BallSocketJoint`, `DistanceJoint`, `FixedHingeJoint`, `LockedJoint`, `PrismaticJoint`, `SixdofJoint`, `SliderJoint` (`Assets/[Starter]/Physics/`) |
| Centre of mass | **Toolkit** — `PhysicsRoot.centerMass` |
| Layer Collision Matrix, `CollisionFilter.collideWith` | **Substitute** — exported but not applied; set `shape.filterCollideMask` from a script component |
| Interpolation, collision detection mode | **Substitute** — not carried |
| WheelCollider | **Toolkit** — a chassis Rigidbody with ≥ 2 child wheels becomes a Havok raycast vehicle. Suspension and friction come from the toolkit **`RaycastWheel`** on each wheel; drive it from a script (`dlc/[Racing]/StandardCarController.ts`) |
| CharacterController | **Toolkit** `CharacterController` (radius, height, centre, skin width, slope, step) |
| Nested Rigidbodies | Ignored (warned) — one body per hierarchy branch |
| Rigidbody + CharacterController / NavMeshAgent on one object | The body is ignored (warned) — pick one driver |

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

**Friction.** Assign a `PhysicsMaterial` wherever friction matters. Published toolkits up to **9.25.1** export
**0** friction for a collider with no material, so objects slide; on those, a material is mandatory. On the same
versions, the trigger flag of a mesh collider's collision child was inverted.

**Traps:**
- Use **primitive colliders for triggers.** Mesh and convex shapes are always solid at runtime.
- A collision needs a Rigidbody on **at least one** side. Two kinematic bodies never *collide*, but **two
  kinematic triggers do fire trigger events**.
- A non-convex **MeshCollider cannot be on a dynamic Rigidbody** — mark it Convex or use primitives. Inside a
  compound, a MeshCollider is always a convex hull.
- A mesh named "Cylinder" becomes a true cylinder shape.
- Fast small bodies tunnel through thin colliders — use thicker colliders.
- Never set `contactOffset` to 0.
- A raycast starting **inside** a collider does not hit it.

---

## 12. Navigation — carried by the toolkit's Recast bake

**Reaches BabylonJS as** (levels only, `ExportNavigation` on, no licence gate):
- **The navmesh.** The toolkit's bundled **Recast** baker (`UniRecast.Core.UniRcNavMeshSurface`) writes
  `Assets/Scenes/<Level>/NavigationMesh.bin`. The export copies it to `scenes/<scene>.nav.bin` and points
  scene key `navigation.prebaked` at it.
- **Runtime.** The runtime loads it straight into recast-navigation-js. NavMeshAgents become
  `TOOLKIT.NavigationAgent` crowd agents (Pro), with speed, acceleration, radius, height, base offset, angular
  speed, stopping distance and area mask.
- **Optional height mesh.** With `_buildHeightMesh` on, a height mesh also exports as a pickable surface.

Unity's own navmesh (`bake_navmesh`, the AI Navigation `NavMeshSurface`) is a separate Unity-side system. It is
useful for trying agents inside Unity, but the export carries the **Recast** bake, so always bake that one.

**Author it:**

```bash
unity command save_scene --project-path "$PROJ"            # the bake needs a saved scene
# The bake writes into Assets/Scenes/<Level>/ but does NOT create it — a lighting bake does; otherwise create it:
unity command eval 'if (!UnityEditor.AssetDatabase.IsValidFolder("Assets/Scenes/Level01")) UnityEditor.AssetDatabase.CreateFolder("Assets/Scenes","Level01"); return "ok";' --project-path "$PROJ"
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
        s.Bake();                                                   // writes <SceneDir>/<Scene>/NavigationMesh.bin (+ .asset with the height mesh)
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
| `_agentRadius` / `_agentHeight` / `_agentMaxClimb` / `_agentMaxSlope` | 0.4 / 2.0 / 0.4 / 45° — the agent shape lives in the bake |
| `_cellSize` / `_cellHeight` | 0.1 / 0.2 — smaller is more accurate and slower |
| `_buildHeightMesh` | Also bake a height mesh (`NavigationMesh.asset`) for precise picking |

**Choose the walkable geometry deliberately.**
- **The Navigation Static flag is ignored** by the Recast bake.
- In render-mesh mode it collects **every** MeshFilter, dynamic props included, and terrain is always included.
- Restrict the bake with `_includeLayers`, or with `_useTagFilter` and the `Navigation` tag.

**Agents.** Add a `NavMeshAgent` (`add_component --type UnityEngine.AI.NavMeshAgent`) and tune it with
`set_component_properties`. Don't put a Rigidbody on the same object.

**Not carried → substitute:**

| Unity feature | Babylon-side substitute |
|---|---|
| Area types and costs | The runtime `SceneManager` area API: `RegisterNavigationArea`, `SetNavigationAreaCost`, `AddNavigationAreaVolume`, `AddNavigationAreaMesh`. The agent's area mask *is* honoured |
| Off-mesh links (`OffMeshLink`, `NavMeshLink`) | Not baked or read — script a jump or teleport |
| `NavMeshObstacle`, `NavMeshModifier` | Exclude via layers/tags; agents avoid each other through the crowd |

A missing `NavigationMesh.bin` fails **silently** (`navigation.prebaked` is `null`). Check the file exists
before exporting.

---

## 13. Animation

**Reaches BabylonJS as:**
- **Clips (Bake, not licence-gated).** Every enabled Animator with a controller, and every legacy Animation
  component, has its clips **baked to glTF animations** at `AnimBakingFrameRate` (default **30 fps**). Skinned
  meshes export skins, and blend-shape weight curves become morph-target animation.
- **State machine (Toolkit, Pro).** An Animator also becomes a `TOOLKIT.AnimationState` component carrying the
  **state machine**: layers, states, transitions, parameters and blend trees. It also carries clip settings,
  `applyrootmotion` and the update mode.
- **Rig modes.** The toolkit **`AnimatorControlRig`** component switches a rig to vertex-animation textures (VAT,
  for crowds) or to a shared runtime rig that retargets clips by bone name.

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

| Feature | How it reaches BabylonJS |
|---|---|
| States; transitions with conditions, exit time, (fixed) duration, solo/mute; parameters | **Toolkit** ✅ |
| Blend trees — 1D, 2D Simple Directional, 2D Freeform (both) | **Toolkit** ✅ |
| **Direct** blend trees | ❌ not evaluated — use layers and `setLayerWeight` from a script |
| Layers — weight, **override** blending, avatar masks | **Toolkit** ✅ |
| **Additive** layers, synced layers | ❌ additive plays as override; synced is ignored — restructure as override layers |
| Entry transitions | ❌ a layer always starts in its **default state** — set the right default, or call `playAnimation` |
| Interruption source | Only `None` is honoured |
| Sub-state machines | Flattened; transitions **to** a sub-machine and machine-level transitions ❌ — keep every state name unique |
| State `speedParameter`, `mirror`, `cycleOffsetParameter`; Animator `speed` | ❌ (Animator speed is 1) |
| `StateMachineBehaviour`s | ❌ — subscribe to the runtime transition observable in a script component |
| `AnimatorOverrideController` | ❌ — nothing exports; use a real controller |
| Root motion | Baked in when `applyRootMotion` is on, pinned otherwise; the runtime exposes root-motion deltas |
| AnimationEvents | ✅ via `onAnimationEventObservable` (skeleton mode, 0.01 normalised-time precision) |
| Clip curves that drive Animator parameters | ✅ |
| Humanoid clips | Baked onto the first SkinnedMeshRenderer's bones; share clips across rigs with `AnimatorControlRig`'s rig mode (bone names must match) |
| IK pass | The runtime raises an IK observable; solve the IK in a script component |
| Skinning | Max **4** bone influences |
| Blend shapes | ✅ (last frame only, no names); blend-shape animation ✅ |
| Timeline / PlayableDirector | **Substitute** — a TypeScript component driving `AnimationState` or animation groups |

For one animated transform in its own `.glb`: `bt_export_animation --path <HierarchyPath>`. It writes no
metadata, so that file has no `AnimationState`. It also bakes **no keyframes** for a rig in VAT mode.

---

## 14. Audio

**Reaches BabylonJS as** (Pro). A `TOOLKIT.AudioSource` with the clip's original `.wav` / `.mp3` / `.ogg` copied
**byte-for-byte** (no transcoding).

| AudioSource setting | How it reaches BabylonJS |
|---|---|
| Volume, pitch, loop, mute, play on awake | **Direct**. Autoplay waits for the browser's audio unlock |
| Spatial blend | **Direct, on/off** — ≥ 0.1 is fully 3D, below is 2D |
| Min / max distance | **Direct** |
| Rolloff mode | Always linear at runtime — call `setRolloffMode` from a script for others |
| Priority, stereo pan, reverb zone mix, bypass flags, doppler, spread | Not used at runtime |
| AudioListener | **Toolkit** — the camera system attaches the listener (`DefaultCameraSystem` spatial audio) |
| AudioMixer and snapshots | **Substitute** — the Starter `SoundManager` / `SceneSoundSystem` components (music and SFX groups) |
| Reverb zones | **Substitute** — not carried |

`AudioDetails.preloadAsset` makes a clip preload.

Because the file ships as-is, **the source format is the web format**: author `.ogg` or `.mp3` for music and
ambience, and short `.wav`/`.ogg` for SFX. Unity's audio import settings (compression, load type, force-to-mono)
do not touch the exported file. To shrink or down-mix audio for the web, convert the source file itself (e.g.
with `ffmpeg`) before importing it. Generated audio comes from `web-kie-servers.md`.

---

## 15. Prefabs and asset containers

A Unity **prefab** (`.prefab`) is an authoring asset. At runtime the toolkit has two prefab mechanisms of its
own, both instantiated from TypeScript.

```bash
unity command create_prefab --source /Crate --path Prefabs/Crate.prefab --project-path "$PROJ"        # scene object -> prefab asset
unity command instantiate_prefab --prefab Prefabs/Crate.prefab --name Crate_02 --project-path "$PROJ"
unity command create_prefab_variant --base Prefabs/Crate.prefab --path Prefabs/Crate_Red.prefab --project-path "$PROJ"
unity command apply_prefab_overrides --instance /Crate_02 --project-path "$PROJ"
unity command save_prefab_contents --prefab Prefabs/Crate.prefab --rename_child Lid --new_name Top --project-path "$PROJ"
```

(Confirm each command's exact parameter names with `unity command --tag prefabs --detail full`.)

| Mechanism | How to author | At runtime |
|---|---|---|
| **In-level prefab** | Put the master object on **layer 31 "Babylon Prefab"** in the level | Exported with `prefab: true`, **disabled, with its scripts not run**. Clone it with `SceneManager.InstantiatePrefabFromScene(scene, "Name", …)`, which starts the clone's scripts |
| **Asset container** | Stage the objects **in the open scene** under one parent (e.g. `Props/`), then `bt_export_prefab --paths "Props/Crate,Props/Barrel" --folder "$PROJ/Export/containers"` | `SceneManager.LoadAssetContainerAsync` (cached), then `InstantiatePrefabFromContainer` / `CloneAssetContainerItem` |

Asset containers keep animations, skins, morphs, components, colliders, node-level physics, lightmaps and
reflection probes. They carry **no scene-level data**: skybox, fog, ambient, light probes, image processing,
gravity or navigation. Physics bodies in a container are created only when the host scene already has physics
enabled.

**Other layer conventions:**
- **29 "No Instance":** disables glTF mesh instancing.
- `MeshDetails.instantiatePrefabAs = INSTANCE` makes clones hardware instances.
- **30 "Ignore Export":** skips a node entirely.

---

## 16. Importing assets and import settings

```bash
unity command import_asset --source /abs/path/rock.fbx --path Models/Rock.fbx --project-path "$PROJ"
unity command get_import_settings --asset Models/Rock.fbx --project-path "$PROJ"
unity command set_import_settings --asset Models/Rock.fbx --settings '{"generateSecondaryUV":true,"importCameras":false,"importLights":false}' --project-path "$PROJ"
unity command set_import_settings --asset Textures/rock_n.png --settings '{"textureType":"NormalMap"}' --project-path "$PROJ"
unity command set_import_settings --asset Textures/ui_icon.png --settings '{"maxTextureSize":512}' --project-path "$PROJ"
```

| Asset | Settings that matter for the export |
|---|---|
| Models | `generateSecondaryUV` (lightmap UVs), scale, `importCameras`/`importLights` off, animation type (Humanoid/Generic) for characters |
| Textures | `textureType` (NormalMap for normals), `sRGBTexture` (off for masks/data), **`maxTextureSize` (the exported size)**, `isReadable` when a tool needs pixels |
| HDR sky | `textureShape` Cube (2) |
| `.unitypackage` | `unity assets import` (no Editor running) — `unity-cli-reference.md` §5.4 |

Set `maxTextureSize` on the **default** platform settings. The exporter reads the imported texture, and
per-platform overrides depend on the active build target.

Import settings live in `.meta` files and are **not undoable**. Never hand-edit `.meta` files. Models authored
or repaired in Blender follow `unity-blender-cli.md`, which edits them in place to keep GUIDs and importer settings.

---

## 17. LOD, particles, video, UI

| Component | How it reaches BabylonJS (Pro) | Traps |
|---|---|---|
| `LODGroup` | Node keys `lods` and `distances` (needs `MeshExportSystem` = sub-meshes, the default) | **Distances need a Scene View camera — in a `-batchmode` Editor they are skipped (warned).** Export LOD levels from a GUI Editor. LOD renderers must be children of the group. Non-first levels never cast shadows. Screen coverages and crossfade are not used |
| `ParticleSystem` | `TOOLKIT.ShurikenParticles` — every module: main, emission/bursts, shape (incl. mesh), velocity/force/limit, colour/size/rotation over lifetime and by speed, noise, collision (planes, and world via ray casts), triggers, sub-emitters, texture-sheet animation, lights, trails, custom data. Renderer: billboard, stretched, horizontal, vertical, mesh | Use particle shaders from the Particles / Legacy / Mobile / URP / HDRP families or Shader Graph. **VFX Graph, TrailRenderer and LineRenderer are not carried** — use Babylon GPU particles, `TrailMesh` and GreasedLine from a script. Normal maps on particle materials are not sampled |
| `VideoPlayer` | `TOOLKIT.WebVideoPlayer` (a video texture) | **Only Material Override render mode** |
| uGUI `Canvas` / `UIDocument` | `TOOLKIT.UserInterface` → Babylon GUI: layout groups, Button, Toggle, Slider, Scrollbar, Dropdown, ScrollRect, InputField, Text and **TMP text / dropdowns / inputs**, Image (9-slice), RawImage, masks; ~35 UI Toolkit element types; onClick/onValueChanged listeners | Needs `ExportUserInterfaces` (default on). **Canvas render mode is not read — World Space and Camera canvases export as full-screen 2D.** For world-space UI, use Babylon GUI on a mesh from a script component. For app-style UI, see `ui-design-system.md` first |

---

## 18. Script components — the game logic

All game logic runs in BabylonJS as TypeScript **script components**. Each one is paired with a C#
**`EditorScriptComponent`** class in Unity that carries its inspector fields. Script components are **not
licence-gated**. Plain `MonoBehaviour`s are Unity-only and are not exported.

**How each part is exported:**
- **Entries.** An enabled `EditorScriptComponent` exports as a `components[]` entry with `klass` and `order`.
  - `klass` comes from `[Babylon(Class=…)]`, else `<first C# namespace segment | "MY">.<Type>`.
  - `order` comes from the script execution order or `[Babylon(ScriptOrder=n)]`. `*CameraSystem` / `*SoundSystem` /
    `*LightSystem`-style classes get −100, and scripts on the `SceneController` object get −10.
- **Disabled components** are skipped.
- **Fields: only public fields export.** `[SerializeField] private` fields and C# properties don't.
  - `[Auto]` fields export as `auto__<name>`, and need the TypeScript field declared **with an initializer**.
  - `[IgnoreExport]` fields are skipped.
- **Field types:** primitives, enums (as int), strings, `Color`, vectors, `Sprite`, `Texture2D`, `Cubemap`,
  `Material`, `AudioClip`, `VideoClip`, `AnimationCurve` (→ `BABYLON.Animation`), `Font`, `TextAsset`,
  embedded assets, `Transform`, `GameObject`, `Component`, `ScriptableObject`, and arrays and `List<>` of these.
  - `GameObject` and `Component` fields export as a **Transform reference** and resolve to the node, not the
    component.
  - Reference prefabs that are not in the scene **by name** (a string).
- **Runtime lifecycle:** `awake` → `start` → `update`, plus `late`, `step` / `fixed` (physics) and `destroy`. A
  missing TypeScript class is logged as a warning ("Failed to locate script class").

Writing and attaching the C#/TypeScript pair: `unity-exporter-cli.md` §8.2. Runtime contract:
`scene-components.md`. Converting existing C# gameplay code to TypeScript: the `bt-convert` skill.

---

## 19. Tags, layers, static flags

| Unity | Reaches BabylonJS as |
|---|---|
| Tag | `group` and a `tags` entry (spaces → `_`); `AdditionalTags` component adds more; `SceneManager.FindGameObjectWithTag` |
| Layer | `layer`, `layermask`, `layername`, plus a `Layer<N>` tag. The Unity camera culling mask is not applied |
| Static flags (Contribute GI / Batching / Navigation) | `freezeworldmatrix` (with `FreezeStaticMeshes`) and lightmapping. Batching Static does not merge meshes (use the toolkit's mesh-baking tool for that) |
| Layer 28 "Hidden" | Exported, but **invisible to toolkit cameras** |
| Layer 29 "No Instance" | No glTF mesh instancing |
| Layer 30 "Ignore Export" | **Node skipped** |
| Layer 31 "Babylon Prefab" | In-level prefab master — disabled until cloned (§15) |
| Inactive GameObjects | **Skipped** — keep objects active and disable them from a script at runtime |

The toolkit creates its reserved layers (20–31) during bootstrap. Use `set_tags_layers` to add your own user
layers in 8–19.

---

## 20. Web and mobile budget

Author the full level, but keep it light enough to run in a browser, and on mobile when that is a target.

| Lever | How to set it |
|---|---|
| Texture size | The importer's `maxTextureSize` is the exported size — there is no exporter cap for materials. 2048 for hero surfaces, 1024 or less for props, 512 or less for UI and small details |
| Texture format | `TextureImageFormat` KTX2 (`3`) for the smallest GPU memory. WEBP (`2`) only after switching `DefaultWebpImageCommandType` to lossy. Keep lightmaps PNG |
| Lightmaps | `lightmapResolution` and `maxLightmapSize` (1024–2048) set lightmap memory. Fewer, fuller atlases are cheaper |
| Lights | Bake fills and practicals (they cost nothing at runtime). Keep realtime and Mixed lights few. A material takes at most `SceneController.maximumLights` (default 4). The shadow map size comes from the URP asset |
| Terrain | `TerrainLayerMaxSize` 512–1024, 4–8 layers, a moderate heightmap (257–513 for mobile), tree instances and detail density sized for the target |
| Geometry | LOD groups on heavy meshes (export LODs from a GUI Editor). Repeated meshes stay glTF instances (`ExportMeshInstances`, default on). Mark static objects Static to freeze their world matrices |
| Probes | Enough light probes to cover dynamic areas (APV ≤ 8192). Reflection-probe resolution 128–256 |
| Post-processing | Grading is free (one LUT). Bloom, DOF, motion blur, SSAO and SSR cost real fill-rate — use them sparingly on mobile |
| Audio | Compress the source files (`.ogg` / `.mp3`); they ship as-is |
| Snapshot rendering | `GpuRenderingMode` (WebGPU snapshot rendering) for very large static scenes |

---

## 21. Verification cadence and visual QA

Author in **large passes**: landform and terrain, blockout, light rig and bake, set dressing, materials,
post-processing, gameplay components. Check each pass in the Unity Editor as you go. Then **verify in the
browser at milestones**:

1. **Once at the start.** Export a simple version of the level and load it in the browser, to prove the whole
   chain works (licence, bake, export, dev server).
2. **After each major pass.** Especially after lighting and baking, post-processing, and terrain.
3. **At the end.** A full comparison.

Don't export after every edit; a full export and browser check takes minutes. **Never skip the milestone
checks, though.** The browser result is what ships.

```bash
# Unity side — any Editor with the GPU Resident Drawer off (see the note below); absolute paths keep captures out of Assets/
unity command screenshot --view game  --output "$PWD/qa/level01_game.png"  --width 1920 --height 1080 --project-path "$PROJ"
unity command console --level warn --tail 50 --project-path "$PROJ"     # exporter/bake warnings

# Browser side — the milestone check
unity command bt_export_level --scene Assets/Scenes/Level01.unity --geometryOnly false --project-path "$PROJ" --timeout 900
unity command bt_devserver_start --project-path "$PROJ"
# load http://localhost:<port>/index.html?scene=Level01.gltf in a real browser, screenshot the same camera, read the console
```

**How to compare.**
1. Put the Unity capture and the browser capture of the **same camera** side by side.
2. A **lit and tonemapped** image — not flat grey, not blown out — means lighting, IBL and post-processing are wired.
3. When they differ, decide **which side of the export the gap is on**:
   - **Unity right, browser wrong:** look up the feature's row in §0. It may need a substitute, or an authoring
     change (for example Metallic instead of Specular, or mesh grass instead of texture grass).
   - **Both wrong the same way:** it's the art — keep authoring.
4. Also check the exported `scenes/<level>.gltf` holds the keys the pass should have produced: `lightmapbakemode`,
   `skybox.environment`, `lightprobes`, `navigation.prebaked`, `PostProcessor` components and so on.

For a long target-image loop, hand off to the `bt-gauntlet` skill.

> **Unity-side captures work in a `-batchmode` Editor once the GPU Resident Drawer is off.** With it on, camera
> renders showed **only the skybox** — no scene geometry, with `screenshot`, `capture_game_view` and a manual
> `Camera.Render` alike. The Editor log showed `QueryRendererInstancesJob` exceptions: a failed drawer
> registration takes the renderers off the normal draw path, and they stay invisible until the scene reloads.
> Turn it off with `unity command eval 'return RenderPathTools.DisableResidentDrawerReport();'` (toolkit 9.25+,
> dialog-free; it also reloads the open scenes). The `unity-exporter-cli.md` §4B bootstrap does this. *Verified: Unity 6000.5.10f1,
> Metal, URP — a batch-mode `capture_game_view` then rendered the full lit scene.* Always also judge the
> **exported** level in the browser at milestones — that is the result that ships.

For multi-angle Unity shots, move the Scene View camera from `run_script`
(`SceneView.lastActiveSceneView.LookAt(pivot, rotation, size)`), then `capture_scene_view`.

---

## 22. Not carried — the Babylon-side substitute

A handful of Unity authoring features have no exporter path. Each one has a Babylon-side substitute, usually a
few lines in a script component:

| Unity feature | Babylon-side substitute |
|---|---|
| Timeline / PlayableDirector cinematics | A TypeScript component driving `AnimationState`, animation groups or camera paths |
| VFX Graph | Babylon GPU particles / Node Particle Editor |
| TrailRenderer, LineRenderer | `TrailMesh`, `CreateLines` / GreasedLine |
| Light cookies | `SpotLight.projectionTexture` |
| Realtime GI (Enlighten) | Bake the GI (§4) |
| Realtime reflection probes | Babylon `ReflectionProbe` in a script component |
| URP renderer features (SSAO, custom passes), Panini, lens flare | `SSAO2RenderingPipeline`, custom `PostProcess`, `LensFlareSystem` |
| Render scale | `engine.setHardwareScalingLevel` |
| Occlusion culling | `mesh.occlusionType` / occlusion queries |
| Layer Collision Matrix | `shape.filterCollideMask` in a script |
| Navmesh areas, off-mesh links, obstacles | The runtime `SceneManager` navigation-area API; scripted jumps |
| World-space UI, 3D TextMeshPro | Babylon GUI on a mesh (`AdvancedDynamicTexture.CreateForMesh`), or DOM overlays |
| Sprites, Tilemaps, 2D physics and lights | Babylon `SpriteManager` and quads |
| Unity Input System | Toolkit input (`userinput` scene options) — `scene-components.md` |

**Unity game-runtime services never apply.** This pipeline never builds a Unity player. When a request names one of these, build the Babylon-side version in the web project and say so in one line:

| Unity service | Babylon-side version |
|---|---|
| In-App Purchasing, LevelPlay ads | Web payments / ad SDKs (`project-installer.md`) |
| Unity Gaming Services (Multiplayer, Vivox, Cloud Save, Remote Config) | Web backends, WebRTC / WebSocket services |
| Localization | DOM/React i18n (`ui-design-system.md`, `react-framework.md`) |
| Unity WebGL player settings, IL2CPP, Brotli | The web build in `project-installer.md` |

---

## 23. Ready-made scenes (Asset Store, sample projects)

The goal is that a finished Unity scene exports as it is: materials, terrain, lighting, probes, volumes,
animation, particles and physics all carry across. Bring one in like this:

1. **Import it.** Use `unity assets import <pkg.unitypackage>` with no Editor running, or `package_add` for a UPM
   package. Open the scene with `open_scene`.
2. **Confirm it runs on the project's pipeline.** URP content in a URP project is the easy case. Built-in
   content needs Unity's material upgrade to URP first (the `migrate-birp-to-urp` skill). Read back the shader
   names afterwards (§2).
3. **Complete the baseline (§1), without restyling anything:**
   - a LightingSettings asset;
   - `Camera.main` with Skybox clear flags;
   - an active `SceneController`.
   Keep the scene's own lights, sky, volumes and materials.
4. **Bake.** Asset Store scenes often ship without lighting data, or with a stale bake. Run `bake_lighting` to
   produce the lightmaps, probes, reflection probes and IBL. Add and bake a `UniRcNavMeshSurface` if the level
   needs navigation (§12).
5. **Export the level** (`bt_export_level --geometryOnly false`) and do a **milestone browser check** (§21) from
   the scene's own camera.
6. **Only if a difference shows**, find the feature's row in §0 and apply the listed authoring change or
   substitute. If no row explains it, record it as a toolkit parity gap, with the feature, both captures and
   the scene, and leave the scene's look alone.
