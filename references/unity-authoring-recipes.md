## Unity Authoring Recipes — Levels That Recreate Faithfully in BabylonJS

**IMPORTANT. READ THIS TO THE END BEFORE AUTHORING ANY UNITY CONTENT. IT DECIDES HOW CLOSELY THE BABYLONJS RECREATION MATCHES THE UNITY SCENE.**

> *Portions adapted from Unity-Technologies/skills (`urp-postprocessing`, `migrate-birp-to-urp`,
> `initialize-ai-navigation`, `physics-3d-collision`, `optimize-audio`, `generate-editor-search-query`,
> `new-unity-project`), © 2026 Unity Technologies, used under the Unity Companion License. Every statement about
> how a feature reaches BabylonJS was checked against the exporter source (`ProfessionalEdition/Core`: `CVTools.cs`,
> `GLTFMetaDataExporter.cs`, `UnityTools_*.cs`, `PostProcessLutBaker.cs`, `TerrainDataExporter.cs`) and the
> runtime source (`TOOLKIT` runtime `core/`, `pro/`, `dlc/`). Toolkit source tree 9.28.0, published 9.25.1.*

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
| **Toolkit** | Carried by a toolkit component or runtime class that mirrors the Unity system | `TerrainBuilder`, `AnimationState`, `PostProcessor`, `RigidbodyPhysics`, `NavigationAgent`, `ShurikenParticles`, `VisualEffect`, script components |
| **Substitute** | Not carried; the named Babylon-side equivalent does the job | cookies, Timeline, realtime GI |

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
>   Specular, Baked Indirect over Distance Shadowmask).
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
| URP Lit (Metallic), Complex Lit, Unlit, Built-in Standard → glTF PBR + KHR extensions | **Direct** | Author URP Lit in the **Metallic** workflow; Specular workflow and Simple Lit specular are ignored (§2) |
| HDRP Lit (every material type), LayeredLit, Unlit, SpeedTree8 | **Direct** (HDRP's own properties) + **Toolkit** `HdrpLitPlugin` / `HdrpLayeredLitMaterial` | Specular workflow, subsurface (diffusion profiles), translucency, anisotropy, refraction, emission by exposure weight; AxF and tessellation are reported (§2) |
| Detail maps, parallax, premultiply / additive / multiply blending | **Direct** (material extras, rendered) | §2 |
| Shader Graph (every URP / Built-in / HDRP sub-target, sub-graphs, Custom Function nodes, keywords, globals) | **Toolkit** — transpiled at export to a generated `MY.*` material class | Every export path; per-node polyfills, never a whole-graph fallback (§2, `shader-materials.md`) |
| Directional / Point / Spot, **Realtime** | **Direct** | §3 |
| **Mixed** lights | **Direct + Bake** — realtime direct light, baked indirect and shadowmask | The right mode for a sun (§3) |
| **Baked** lights, Area / Rect / Disc lights | **Bake** — lightmaps light static objects, light probes light dynamic ones | The light node itself is not written, and **its children are skipped too** (§3) |
| HDRP **Realtime** Rectangle light | **Direct** → Babylon `RectAreaLight` (type 3, `width` / `height`) | WebGL2 / WebGPU only (WebGL1 skips it, warned once); diffuse only; LTC tables load from the Babylon CDN (§3) |
| HDRP **Realtime** Tube light | **Toolkit** `TOOLKIT.HdrpTubeLights` — HDRP's own line light (LTC line integrals per HDRP material model, range window, Display Emissive Mesh) | As in HDRP: no shadows, cookie or IES. An export without the tube block falls back to a point light of the same flux, reported (§3) |
| HDRP **Realtime** Disc light | **Direct**, degraded — a 180° spot without shadows | Reported; Disc lights are baked-only in HDRP 17.5 (§3) |
| HDRP **Water Surface** (Ocean / River / Pool, Quad / Infinite / Instanced Quads / Custom mesh) | **Toolkit** `TOOLKIT.HdrpWaterSystem` / `TOOLKIT.HdrpWaterSurface` — a port of HDRP 17.5's water: GPU FFT simulation, foam, refraction, caustics, underwater, water decals / deformers / foam generators, custom water Shader Graphs, CPU height queries | WebGL2 / WebGPU; draws only when the HDRP asset's `supportWater` and the WaterRendering override are on. Tessellation is pre-built geometry (§7) |
| Lightmaps: Baked Indirect, Shadowmask, Subtractive | **Bake** | Distance Shadowmask is approximated (§4) |
| Directional lightmaps | **Bake** — the direction map ships and the runtime applies Unity's directional decode | Normal-mapped surfaces keep their baked relief (§4) |
| Emissive surfaces lighting the scene | **Bake** (the emission itself is Direct) | Material GI = Baked (§4) |
| Light probes / Adaptive Probe Volumes | **Bake** → `TOOLKIT.LightProbeNetwork` | Needs baked probes (Light Probe Group or APV); hosted on the active `SceneController`, else on the first active exported node; works in every ambient mode; levels only (§5) |
| Reflection probes (Baked / Custom), box projection | **Bake** | One probe per renderer; no blending (§6) |
| HDRP Planar Reflection Probe | **Toolkit** `TOOLKIT.PlanarReflection` → a live mirror on receivers inside its influence volume | Two per scene; the rest fall back to cubes (reported) (§6) |
| Reflection probes (**Realtime**) | **Toolkit** `TOOLKIT.RealtimeReflection` → live Babylon `ReflectionProbe` | Pro; same box, resolution, culling mask and refresh mode; renders the scene into a cube every N frames — budget it (§6) |
| Skybox — Cubemap, 6 Sided, **Procedural** (incl. Default-Skybox), Shader Graph skies; IBL `.env`, spherical-harmonic ambient | **Direct** (sky textures copied; Procedural and Shader Graph skies drawn live) + **Bake** (IBL `.env`) | Levels only; needs a camera with Skybox clear flags. `Skybox/Panoramic` is not carried. HDRP: PhysicallyBasedSky drawn live (`HdrpPhysicallyBasedSky`), every other HDRP sky baked in physical units (§7) |
| Gradient / Color ambient | **Direct**, approximated with a hemispheric light | Light probes still light probe-lit renderers (§5, §7) |
| Fog (Linear / Exp / Exp2; HDRP Fog volume) | **Direct**; HDRP height fog is a **Toolkit** post pass (`HdrpFogPass`) | §8 |
| Shadows — cascades, distance, resolution, softness | **Direct**, from the URP asset (HDRP: the scene's HDRP shadow settings) | §3 |
| URP / HDRP / PPv2 Volumes | **Toolkit** `PostProcessor` + **Bake** (the whole colour grade becomes a LUT) | Pro (§9). Local (Box / Sphere) Volumes blend per frame as the camera walks in and out |
| Camera — projection, FOV, clip, clear, HDR, physical camera | **Direct** | §9 |
| Camera anti-aliasing — FXAA / SMAA / TAA / MSAA | **Toolkit** `PostProcessor` plugin passes (MSAA on the chain head, or the canvas) | Pro; per-pipeline gating (§9) |
| PPv2 Auto Exposure (eye adaptation), HDRP Exposure (Automatic / Automatic Histogram / Curve Mapping) | **Toolkit** `AutoExposurePlugin` — one GPU engine, `ppv2` and `hdrp` variants | Built-in and HDRP; URP has no auto exposure (§9) |
| HDRP physical units and camera exposure | **Toolkit** `TOOLKIT.HdrpRendering` — one **pre-exposure** scalar per scene re-applied to every radiance source; HDR chain | Levels with the `hdrp` scene block; Ray Tracing / Path Tracing are carried by `TOOLKIT.RayTracingSystem` (§3, §7, §9) |
| Terrain — heightmap, ≤ 16 layers, holes, Shader Graph terrain material, trees (LODGroup, SpeedTree), mesh details, texture grass, wind, TerrainCollider, terrain lightmap | **Toolkit** `TerrainBuilder` | Pro. HDRP draws no texture grass (neither does Unity's HDRP). Terrain lightmaps need `.gltf` (§10) |
| Rigidbody (incl. position and rotation constraints), Box / Sphere / Capsule / Mesh / Terrain / Wheel colliders, physics materials, triggers (mesh triggers as convex hulls), Layer Collision Matrix, `CollisionFilter`, CharacterController | **Direct / Toolkit** (Havok) | Pro (§11) |
| Physics joints, gravity | **Toolkit** — Starter joint components, `SceneController` gravity | §11 |
| Navigation mesh | **Bake** — the toolkit's Recast `UniRcNavMeshSurface` | Levels only (§12) |
| Off-mesh links — `OffMeshLink`, AI Navigation `NavMeshLink` (width, direction, area, cost override, activation) | **Bake** — into the Recast navmesh, plus scene key `navigation.offmeshlinks` | Re-bake after adding or moving a link (§12) |
| NavMeshAgent | **Toolkit** `NavigationAgent` (crowd) — crosses off-mesh links (auto or manual traversal) | Pro (§12) |
| Animation clips | **Bake** (glTF animations, 30 fps) | Not licence-gated (§13) |
| Animator state machines, blend trees, layers, avatar masks, root motion, events, StateMachineBehaviours | **Toolkit** `AnimationState` | Pro. Direct blend trees, additive and synced layers, entry transitions, interruption, sub-state machines, speed / mirror / cycle-offset parameters carried; mirror and synced Timing are approximations (§13) |
| AudioSource, AudioListener | **Toolkit** `AudioSource`: Unity's rolloff curves, spatial blend and stereo pan; the active camera is the listener | Pro (§14) |
| Prefabs | **Toolkit** — layer-31 in-level prefabs, or asset containers | §15 |
| Particle systems (Shuriken, every module; CPU-simulated), incl. Shader Graph particle materials | **Toolkit** `ShurikenParticles` | Pro. Noise, distortion and lit-particle shading approximated (§17) |
| VFX Graph (VisualEffect + .vfx) | **Toolkit** `VisualEffect` | Pro. Each particle system runs on the GPU path (GPUParticleSystem) when every block maps, else on the CPU path (Node Particle System + toolkit steps); the export summary names each system's path and every deviation (§17) |
| LineRenderer, TrailRenderer | **Toolkit** `LineRenderer` / `TrailRenderer` (ribbon mesh) | Pro (§17) |
| SpriteRenderer, TilemapRenderer, 2D lights (for Sprite / Shader Graph materials) | **Toolkit** `SpriteRenderer` / `TilemapRenderer` carriers, `Light2DTexture` | Pro. No 2D physics; SpriteMask not drawn (§17) |
| DecalProjector, URP Full Screen Pass renderer feature, HDRP fullscreen Custom Pass, Custom Render Textures | **Toolkit** `DecalProjector`, `ShaderGraphPass`, `ShaderGraphRenderTexture` | Their materials are Shader Graphs (`shader-materials.md`); an HDRP/Decal material draws as one alpha-blended PBR pass (its mask map is not sampled, reported) |
| uGUI Canvas (Overlay / Camera / World Space), UI Toolkit `UIDocument` (overlay / world / render-texture panels), TMP and Legacy text | **Toolkit** `UserInterface` → Babylon GUI, laid out in the browser with Unity's rules | Pro (§17) |
| VideoPlayer (Material Override) | **Toolkit** `WebVideoPlayer` | Pro (§17) |
| LOD groups | **Direct** — Unity's screen coverages (any FOV, orthographic), group size, Cross Fade / SpeedTree dither fades | Pro (§17) |
| Babylon Toolkit script components (`EditorScriptComponent`) | **Toolkit** — TypeScript classes | Not licence-gated (§18) |
| Tags, layers, static flags | **Direct** | §19 |
| Timeline, cookies, realtime GI, occlusion culling, URP renderer features other than Full Screen Pass / Decal, 2D physics | **Substitute** | §22 |

**Pro** means the project needs a valid Babylon Toolkit `license.json` (`unity-exporter-cli.md` §0). Without it
the export still "succeeds", but the following are **silently omitted**:
- every `physics` and `collision` block, including static colliders;
- terrain, AnimationState, AudioSource, NavigationAgent, CharacterController, particles, line / trail / sprite /
  tilemap renderers, UI, video;
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
| An **active** `SceneController` component (toolkit) | Scene options (gravity, input, imaging, lighting, max lights) **and the light-probe network** host — without it the `LightProbeNetwork` lands on the first active exported node | `add_component --type SceneController` |
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
  maps always stay PNG16, and skybox faces never become KTX2 (with WEBP, six-face skies export WEBP faces;
  single-file `.env` / `.hdr` / `.exr` skies ship as-is). Terrain images are always JPG / PNG.

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
| HDRP Lit, LitTessellation, LayeredLit, Unlit, SpeedTree8 | Their own family, read with HDRP's properties: `_BaseColor` (`_UnlitColor` on Unlit), `_MaskMap` (metallic / AO / smoothness), `_EmissiveColor` with its exposure weight, the specular workflow, and the `_MaterialID` features. At runtime `TOOLKIT.HdrpLitPlugin` adds mask-map smoothness, subsurface scattering with HDRP's shape parameters (up to four diffusion profiles; an unassigned profile uses HDRP's default, reported), translucency tinted by albedo and HDRP anisotropy; LayeredLit draws as `TOOLKIT.HdrpLayeredLitMaterial`. Refraction on transparent surfaces exports as `transmission` / `volume`. AxF and tessellation are reported once |
| Unrecognised shaders | Generic PBR by property sniffing, warned *"unrecognised shader … map it or give it a SHADER_CONTROLLER block"* |
| **Shader Graph** | `customMaterial: "MY.<Graph>"` + a generated TypeScript material class, transpiled on **every** export path (levels, selections, prefabs / asset containers, terrain prototypes and templates) for the active pipeline's target. Unsupported nodes are polyfilled or neutralised one by one and reported; plain PBR only for an unreadable graph or a device compile failure. With *Allow Material Override* off, the graph's own surface / alpha / cull settings win. **Read `shader-materials.md` → Unity Shader Graphs** before scripting one |
| `Babylon/…`, `Babylon/Custom/…`, `Custom/…` | Toolkit custom shader (`SHADER_CONTROLLER` block), falling back to `UniversalShaderMaterial` with a warning |
| `Legacy Shaders/*`, and any particle shader on a **mesh** renderer | No custom hook — convert to a PBR shader. On a `ParticleSystem` renderer the particle shader families are carried (§17) |

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
**import** size, so set `maxTextureSize` on the importer (§16, §20). Terrain layers follow the same rule: each
exports at its imported size (§10).
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
| `type` | 0 directional, 1 point, 2 spot, 3 rectangle (HDRP Realtime Rectangle only) |
| `color`, `intensity` | Unity intensity × π on URP/Built-in, × the toolkit's per-type scale (default 1). HDRP: the light type's native physical unit (candela, lux or nits), rendered under the scene's pre-exposure. Colour temperature is applied |
| `intensitymode` | Point lights use inverse-square falloff |
| `range`, `spotangle` / `innerspotangle` | Range and cone |
| Shadows | `generateshadows`, `softshadows` (PCF), `shadowstrength`. Cascades, split, distance and `shadowmapsize` come from the **URP pipeline asset** (map size = the main-light resolution, used for every light). Babylon bias = Unity bias × 0.1. HDRP: distance from the scene's HDRP shadow settings, always soft |
| `lightmapmode`, `occlusionmaskchannel` | Mixed-light bake data |
| `renderlist` | From the culling mask. HDRP light and rendering layers are honoured (an instance on another layer than its source mesh becomes a geometry-sharing clone) |
| `width`, `height` | Rectangle size (type 3), from the light's area size |

Extra Babylon shadow knobs come from the toolkit **`LightSettings`** component on the same GameObject. At
runtime, shadows are created only at render quality High or Medium. A material takes at most
`SceneController` **`maximumLights`** lights (default 4).

| Light mode | How it reaches BabylonJS | Use it for |
|---|---|---|
| Realtime | **Direct** — lights everything at runtime, with realtime shadows | Moving or animated lights, anything that must change at runtime |
| **Mixed** | **Direct + Bake** — realtime direct light and shadows, plus baked indirect (and the shadowmask) | The **sun**, and any key light that must give specular highlights or realtime shadows on dynamic objects |
| **Baked** | **Bake** — the light node is not written; its direct and indirect light live in the **lightmaps** (static objects) and the **light probes** (dynamic objects) | Fill, bounce and practical lights. They cost nothing at runtime. They give no specular highlight and no realtime shadow on dynamic objects |
| Area / Disc / Rectangle (URP, Built-in) | **Bake** — Unity bakes them only; carried by lightmaps and probes | Soft window light, panels, signage |
| HDRP **Realtime** Rectangle | **Direct** — a Babylon `RectAreaLight` facing the light's forward, same size, colour, range; intensity passes through in nits (factor 1.0, like every HDRP light) | Soft panels and windows that must light dynamic objects at runtime |
| HDRP **Realtime** Tube | **Toolkit** `TOOLKIT.HdrpTubeLights` — rendered as HDRP's line light with its length, radius, nits, range attenuation and Display Emissive Mesh. As in HDRP, no shadows, cookie or IES | Strip lights, neon, fluorescent tubes |
| HDRP **Realtime** Disc | **Direct**, degraded — a 180° spot without shadows (reported). Disc lights are baked-only in HDRP 17.5 | Prefer Rectangle or Point / Spot for realtime HDRP panels |
| Any other Rectangle (Mixed / Baked, or Realtime on URP / Built-in) | **Bake** — not exported, **always warned** ("Rectangle lights" in the export summary) | Carried by the lightmaps and probes; a Realtime one on URP / Built-in lights nothing in Unity either |

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
- HDRP lights always export in their physical units (automatic on HDRP; `UseHDRPPhotometricLights` is kept only for
  saved settings). Under Distance Shadowmask, HDRP static renderers still cast realtime shadows, as HDRP draws them.
- **Rectangle lights need WebGL2 or WebGPU.** A WebGL1 context skips them with one warning. They are **diffuse only**:
  Babylon 9.29's rect-area specular misuses the light colour as Fresnel F0 and explodes above intensity 1, so the
  runtime zeroes it. Babylon loads the area-light LTC tables once per scene from `assets.babylonjs.com` — an
  offline build has no rectangle lighting. Each rect light counts against `maximumLights` like any other.
- Under Shadowmask, more than four overlapping Mixed lights exceed the shadowmask channels (warned).

---

## 4. Lightmaps and global illumination

**Reaches BabylonJS as.**
- **Per material:** each lightmapped renderer's material gets `lightmapTexture` (colour) and, under Shadowmask,
  `shadowmaskTexture`, plus `lightmapLevel`. A **Directional** bake (`directionalMode` = `CombinedDirectional`, Unity's
  default) also writes `lightmapDirection` — the direction map, linear PNG in every format setting. The runtime then
  attaches `TOOLKIT.DirectionalLightmapPlugin` (GLSL and WGSL), which runs Unity's `DecodeDirectionalLightmap` with the
  per-pixel normal (the vertex normal on a material without a normal map). Non-directional bakes are unchanged.
- **Per mesh:** a `TEXCOORD_1` accessor with the renderer's lightmap scale/offset baked in.
- **Encoding:** lightmaps are always **RGBD**-packed (the GLB-embedded path too). Their format follows
  `TextureImageFormat`: PNG (0); WEBP (2) when `SuperCompressWebpLightmaps` is on — lossless, decodes to the same pixels as the PNG;
  KTX2 (3) when `SuperCompressKtx2Lightmaps` is on — linear UNORM, UASTC quality 4, no RDO, no mipmaps, which renders
  within a level of the PNG. With the matching `SuperCompress*Lightmaps` off, lightmaps stay PNG. Shadowmasks are
  linear occlusion data (never RGBD) and follow the format setting like any linear texture.
- **Scene keys:** `lightmapbakemode`, `shadowmaskmode`, `subtractiveshadowcolor`, `renderpipeline`
  (`birp`/`urp`/`hdrp`).
- **Diffuse IBL:** lightmapped materials suppress it, because the lightmap already holds the indirect light.
- **HDRP:** one scene lightmap scale puts lightmaps (terrain lightmaps too) in physical units, so they follow the
  scene's pre-exposure like every other radiance source.

| Mixed Lighting mode | Fidelity in BabylonJS |
|---|---|
| **Baked Indirect** | The most exact. Mixed lights give full realtime direct light and shadows |
| **Shadowmask** | Exact within **four overlapping Mixed lights** per area; the runtime combines `min(realtime, baked)` shadowing |
| **Subtractive** | For a single main directional light. Non-realtime direct light is removed from lightmapped surfaces and the main light's shadow is subtracted |
| Distance Shadowmask | **Approximated.** Behaviour past the shadow distance differs from Unity — prefer Shadowmask. On HDRP, static renderers cast realtime shadows, as HDRP draws them |

**Author it:**

```bash
unity command get_lighting_settings --project-path "$PROJ"
unity command set_lighting_settings --project-path "$PROJ" --dry_run true \
  --settings '{"bakedGI":true,"realtimeGI":false,"lightmapper":"ProgressiveGPU","bounces":2,"lightmapResolution":20,"directionalMode":"CombinedDirectional","maxLightmapSize":2048}'
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
- **Directional is carried.** Bake `CombinedDirectional` when normal-mapped static surfaces should keep their
  baked relief; `NonDirectional` halves the lightmap memory and looks flat in both Unity and Babylon.
- **No non-uniform transform scale on normal-mapped meshes.** Babylon builds the tangent frame as
  `mat3(world) * TBN` without renormalising, so a scale like (9, 4, 0.3) exaggerates the normal map many times — in
  realtime lighting and, through the directional decode, in the baked relief. Put the size in the mesh (scale 1).
- **Emissive materials** light the scene through the bake: set the material's Global Illumination to **Baked**.
- **Realtime GI (Enlighten) is not carried** (`globalillumination` is always `false`). Bake the GI instead.
- The exporter **refuses to export while a bake is running**, and in the legacy *Iterative* GI workflow it
  forces a synchronous bake first. Always bake explicitly and wait for `completed`.
- A **stale bake** (the mixed-lighting mode changed after baking) is warned — re-bake.
- **Duplicated lightmapped props are safe.** A lightmapped renderer never shares a cached mesh
  (`MeshCachePolicy.CanShareMesh`): each copy gets its own mesh with its own lightmap scale/offset baked into UV2, so
  every copy shows its own atlas region (verified on six copies of one mesh and material in one atlas). The cost is
  one mesh per lightmapped copy.

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

**Required, or the network never loads:**
- baked probes (`bake_lighting`);
- a host for the `TOOLKIT.LightProbeNetwork` component: the **active `SceneController`**, or — in a scene without
  one — the first active exported node;
- a **level** export — light probes never ship in asset containers.

The ambient mode does not matter. Under Gradient or Color ambient, probe-lit meshes use the probe SH and drop the
hemispheric fill. When APV is active, classic Light Probe Group data is ignored (warned). APV statics that are not
anchored ship a 6-point bounds fit, not a centre sample; Unity's `normalBias` is applied, `viewBias` is not. Terrain
tree and rock instances whose prototype uses probes are lit per instance, and a runtime-instantiated prefab loads the
probe data itself.

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
- Probe `intensity` / `importance` are **not** read for baked probes. The global `ReflectionProbePower` setting applies instead.
- **Realtime** probes (Pro) are carried by `TOOLKIT.RealtimeReflection`, which the exporter adds to the probe node
  automatically: a live Babylon `ReflectionProbe` at the probe position and `resolution`, linear HDR (`hdr`), with
  the probe's box projection, `intensity` as the cube level, and Solid Color / Skybox clear. Its render list comes
  from the culling mask (Everything = every scene mesh). Every renderer whose closest probe it is carries a
  `PROBE_{id}` tag and its material reflects the live cube. Refresh: On Awake renders once, Every Frame renders
  every frame (time slicing: every 9 frames for All Faces At Once, 14 for Individual Faces), Via Scripting renders
  once and then on the component's `render()`. The optional toolkit `RealtimeReflection` editor component's list
  adds extra render-list entries. Render quality Low skips realtime probes (receivers keep the scene IBL, warned once).
- **HDRP probes:** Baked / Custom HDRP probes export through the same per-renderer path from their HDProbe texture
  (each renderer takes the probe whose influence volume contains it), in physical units under pre-exposure. HDRP
  **Planar Reflection Probes** render as `TOOLKIT.PlanarReflection` mirrors on the receivers inside their influence
  volume, captured without sky reflection as HDRP captures — the two largest per scene (`TOOLKIT.PlanarReflection.Budget`); the
  rest fall back to cubes with one report.
- **Probe blending is not carried** (warned). Place one probe per area.
- The runtime applies reflection probes at render quality High / Medium.

**Author it:**

```bash
unity command create_gameobject --name "Probe_Hall" --project-path "$PROJ"
unity command add_component --target /Probe_Hall --type ReflectionProbe --project-path "$PROJ"
unity command set_transform --target /Probe_Hall --position '[0,2,0]' --project-path "$PROJ"
unity command set_component_properties --target /Probe_Hall --type ReflectionProbe --project-path "$PROJ" \
  --properties '{"m_Mode":0,"m_BoxProjection":true,"m_BoxSize":[20,6,20],"m_Resolution":256}'
#   m_Mode: 0 Baked, 1 Realtime, 2 Custom — Baked / Custom by default; Realtime (+ m_RefreshMode 0 On Awake, 1 Every Frame,
#   2 Via Scripting; m_TimeSlicingMode 0 All Faces, 1 Individual Faces, 2 None) only where reflections must move
unity command bake_lighting --project-path "$PROJ"     # baked probes bake with the lightmaps
```

**Traps:**
- **Budget Realtime mode.** Every Realtime probe re-renders its whole render list six times per refresh. Use
  it only where reflections must move (a mirror, a car paint showroom); prefer **Time Slicing** (9 / 14 frame
  refresh) or **On Awake**, a tight **culling mask**, and a modest `resolution` (128–256). Baked stays the default.
- Rough receivers of a realtime probe sample Babylon's box-filtered mip chain, not Unity's GGX-convolved cube, so
  their blurry reflections show faint blocky patches. Keep realtime-probe receivers glossy, or keep rough
  surfaces out of the probe's box.
- Under URP, turn probe blending **off** in the URP pipeline asset. Box projection is also switched on there.
- The component's public properties for those flags are read-only in some versions. Set them through the
  serialized fields (`set_serialized_field` / `SerializedObject`), not the C# property.
- Toolkit PBR materials turn off Babylon's `brdf.mixIblRadianceWithIrradiance` to match Unity's mip-only probe
  reflections. A plain `BABYLON.PBRMaterial` you create in a script still mixes, so rough surfaces reflect sky
  colour inside a probe zone — call `TOOLKIT.CustomShaderMaterial.ApplyUnityReflectionModel(mat)` on it.

---

## 7. Skybox, IBL and environment

**Reaches BabylonJS as** (levels only, scene key `skybox`):
- the sky texture(s), `exposure` and `rotation`;
- `environment`: the IBL `.env` baked from `<SceneDir>/<Scene>/ReflectionProbe-N.exr` (the highest N), plus 27
  spherical-harmonic floats (`sh`) that become the scene's ambient in **Skybox ambient mode**.

**Requirements:**
- a camera with **Skybox clear flags**: `Camera.main`, or the first enabled camera when none is tagged MainCamera
  (HDRP: the camera's Background Type — Sky shows the background colour only when the scene has no sky, Color /
  None hide the sky, and a camera without HD camera data uses its legacy clear flags);
- a skybox material in `RenderSettings.skybox`;
- **Reflections Source = Skybox** (`RenderSettings.defaultReflectionMode`);
- a lighting bake.

`defaultReflectionResolution` becomes the IBL cube size. **Custom** reflection mode exports its cubemap without
the camera check.

| Skybox material shader | Export → runtime |
|---|---|
| `Skybox/Cubemap` (`_Tex`) | IBL Texture Format `.env` (default): one unfiltered RGBD `assets/<cube>_sky.env`, pre-multiplied by min(`_Exposure`, 1). Otherwise the `.hdr/.exr/.dds` source is copied, or six RGBD faces are split |
| `Skybox/6 Sided`, `Mobile/Skybox`, `Skybox/Babylon Toolkit` | Six faces. PNG or `_rgbd`-named sources are copied as they are; anything else is re-encoded (warned *"Must encode PNG skybox textures"*) |
| `Skybox/Procedural` (also Unity's stock **Default-Skybox**) | A `procedural` block (sun disk / size / convergence, atmosphere thickness, sky tint, ground colour, exposure, the `RenderSettings.sun` name). Drawn **live** by `TOOLKIT.ProceduralSkyMaterial` on Unity's own sky mesh, following the sun every frame. No texture |
| A **Shader Graph** skybox material | The generated class draws the sky through `TOOLKIT.ShaderGraphSky` (class must be in the bundle — no class, no sky) |
| HDRP `PhysicallyBasedSky` | Drawn **live** by `TOOLKIT.HdrpPhysicallyBasedSky`, a port of HDRP's own sky (HDRP's LUTs and coefficients, up to four sun disks, CloudLayer, physical units × pre-exposure). It is captured into the scene's reflection cube and, in Dynamic ambient mode, its SH, re-captured by HDRP's update rules when the sun or sky changes; aerial perspective joins the fog. Material rendering mode draws the default live atmosphere (warned). Falls back to the bake below with VolumetricClouds, on WebGL1 or without half-float targets |
| HDRP `HDRISky`, `GradientSky` and every other HDRP sky | **Baked** at export through HDRP's own baked-probe route (sky only, CloudLayer included) into a physical-units skybox `.env` and a prefiltered environment `.env` plus one `physicalscale`; drawn and lit under the scene's pre-exposure |
| `Skybox/Panoramic` and anything else | No sky and no `.env` IBL (warned *"shader type is unsupported"*); ambient SH still ships. Re-import the panorama as a cubemap (`textureShape` 2) and use `Skybox/Cubemap` |

| Ambient mode | Result |
|---|---|
| **Skybox** | Spherical-harmonic ambient from the baked sky, plus the light-probe network (§5). **Use this** |
| Gradient | A hemispheric light (sky and ground colours; the equator colour is dropped). Light probes still apply |
| Color | A hemispheric light (ground = half the colour). Light probes still apply |

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
Bake lighting after setting the skybox. Without a bake there is no prefiltered IBL:
- a textured sky becomes its own unfiltered specular environment, so rough metals reflect a sharp sky;
- a Procedural or Shader Graph sky gets a 128 px live capture of the sky;
- diffuse ambient comes from the exported ambient SH (Skybox ambient mode).

Always bake for parity.

**Procedural sky at runtime** (`TOOLKIT.ProceduralSkyMaterial`, every edition):

| Item | Fact |
|---|---|
| Class | Extends `TOOLKIT.StandardShaderMaterial`; `getClassName()` returns `"StandardMaterial"`, so test with `instanceof`. `TOOLKIT.SceneManager.GetDefaultSkyboxMaterial(scene)` returns it for a procedural level |
| Mesh | `ProceduralSkyMaterial.CreateSkyMesh(name, scene, size = 1000)` — Unity's 1680-triangle sky sphere. Scattering is per vertex, so the horizon only matches on this mesh |
| Properties (Unity names) | `sunDisk` (0 None, 1 Simple, 2 High Quality), `sunSize`, `sunSizeConvergence`, `atmosphereThickness`, `exposure`, `skyTint`, `groundColor` (sRGB `BABYLON.Color3`) |
| Sun | `sunDirection` / `sunColor` overrides, else `sunLight`, else the light named `sunName`, else the brightest enabled DirectionalLight. Re-read every frame, so rotating the light moves the sun (day/night cycles just rotate the light) |
| Reflections | A baked `.env` wins. With none, `createEnvironmentProbe(skyMesh, 128)` captures the sky once (diffuse locked to Unity's ambient SH); call `refreshEnvironment()` after moving the sun a lot |

```typescript
const sky = TOOLKIT.ProceduralSkyMaterial.CreateSkyMesh("Sky", scene, 1000);
sky.infiniteDistance = true; sky.isPickable = false;
const mat = new TOOLKIT.ProceduralSkyMaterial("SkyMat", scene);
mat.initMaterial();                       // runs awake(): unlit, both faces
mat.sunLight = sun;                       // a BABYLON.DirectionalLight
sky.material = mat;
mat.createEnvironmentProbe(sky, 128);     // only when the scene has no baked .env
```

**Sky authoring rules:**
- Make the sun **Mixed** and assign it to `RenderSettings.sun` (Lighting window → Sun Source). A Baked sun is not
  exported, so the procedural sky falls back to another light.
- Keep the project **Linear** (a procedural sky in Gamma is warned). Built-in skyboxes declare `[Gamma] _Exposure`;
  the exporter linearises it, so author the value Unity shows and never compensate by hand.
- Every procedural-sky level writes its IBL to the same `assets/procedural_skybox_ibl.env`; export two such levels to
  separate folders.
- Known gaps: the procedural sun disc renders brighter than Unity's. The live HDRP PhysicallyBasedSky uses HDRP's
  camera-space sky-view path in both rendering spaces and has no CloudLayer self-shadowing.

---

## 8. Fog

**Reaches BabylonJS as** (levels only):
- `RenderSettings.fog` / `fogMode` → `fogmode`:
  - 1 = Exponential (density × 0.5);
  - 2 = ExponentialSquared (density × 0.66);
  - 3 = Linear (`fogstart` / `fogend`);
- plus `fogcolor` and `fogdensity`.

The runtime sets the linear fog end to **twice** the exported value. The sky is never fogged.

An HDRP Fog volume becomes HDRP's height fog, rendered by `TOOLKIT.HdrpFogPass` as a post pass over the prepass depth
(mean free path, base / maximum height, mip fog, albedo, anisotropy), composited with a live PhysicallyBasedSky's
aerial perspective; Babylon scene fog is off on HDRP. Transparent materials get the height fog through a material
plugin (no mip fog or aerial perspective), particles are fogged at the opaque depth behind them, and terrain and Shader
Graphs follow the same fog. Volumetric fog has no shadowed shafts; Local Volumetric Fog is reported, not drawn.
Compare fog at a browser checkpoint (§21).

```bash
unity command eval 'UnityEngine.RenderSettings.fog = true;
UnityEngine.RenderSettings.fogMode = UnityEngine.FogMode.ExponentialSquared;
UnityEngine.RenderSettings.fogDensity = 0.02f;
UnityEngine.RenderSettings.fogColor = new UnityEngine.Color(0.55f, 0.62f, 0.72f);
UnityEditor.SceneManagement.EditorSceneManager.MarkSceneDirty(UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene());
return "ok";' --project-path "$PROJ"
```

---

## 9. Post-processing (PPv2 / URP / HDRP Volumes) and the camera

**Reaches BabylonJS as** (Pro). Each enabled `Volume` (URP/HDRP) or `PostProcessVolume` (PPv2) becomes a
`TOOLKIT.PostProcessor` component with `isglobal`, `weight`, `priority`, `blenddistance`, `bounds` and an
`effects[]` list, read from the volume's `sharedProfile`.
- **Colour grading.** The volume's grade is **baked into one 32³ LUT strip PNG** (`assets/<volume>_lut.png`; URP
  also writes `_lut_<mode>` tone-mapper variants). It covers tonemapping, contrast, saturation, hue shift, white
  balance, channel mixer, lift/gamma/gain, shadows/midtones/highlights, split toning, curves and ColorLookup.
  - **HDR path:** PPv2 `HighDefinitionRange` / `External` and every URP volume, on an HDR camera — a LogC strip with
    the tonemapper inside, applied by `ColorGradingHdrPlugin`, post-exposure a runtime uniform.
  - **HDRP path:** every HDRP camera runs an HDR chain (`allowhdr: true`, no final clamp, a head pass that bounds
    values and removes NaN). The strip is baked in HDRP's own grading space with HDRP's tonemappers (Custom curve and
    External LUT included); post exposure is a runtime uniform.
  - **LDR path:** PPv2 `LowDefinitionRange`, a camera without HDR, and legacy HDRP exports (re-export warned) — the
    strip goes through Babylon image processing. PPv2 LDR ignores the tonemapper, as Unity does.
- **Tonemapping inheritance (URP).** A volume that does not override Tonemapping inherits it from the pipeline
  defaults — not from a lower-priority scene Volume. A scene Volume that sets a different tonemapper than the
  pipeline default is therefore not inherited by a local Volume's bake: keep the tonemapper in the pipeline default,
  or override it in every Volume.
- **Local Volumes blend live.** A local Volume (`isGlobal = false`, with a Box or Sphere Collider) blends like
  Unity's `VolumeManager`: weight = `Volume.weight × (1 − d²/b²)` where d is the camera's distance to the bounds and
  b the **Blend Distance** (1 inside; Blend Distance 0 = inside only). Volumes mix in priority order, every
  parameter lerped by its weight.
  - The post chain is built once for the **union** of every Volume's effects; an effect at weight 0 is neutralised
    (its Unity default), never detached, so the chain head never moves.
  - Each frame the camera or a Volume moved, the weights are recomputed and the blended Unity values are written
    into the existing passes through the same setters the Inspector uses. A still camera costs nothing; a
    global-only level registers no per-frame observer.
  - **LUTs:** the baked LUTs of the overlapping Volumes are blended on the CPU into one LUT per camera, only when a
    weight moves by more than 1/255 (needs WebGL2 / WebGPU 3D textures). Documented deviation: Unity re-bakes one
    LUT from the blended parameters, so mid-band grades are close, exact at weights 0 and 1.
  - Switch a Volume at runtime with `postProcessor.SetVolumeEnabled(false)` (or disable its node); the camera
    re-blends at once. The Inspector's **Volumes** row shows each Volume's live weight
    (`PostProcessor.Instance.GetVolumeWeights()` in code).
  - Only fields the Inspector can edit re-blend per frame (intensity, colour, smoothness, centre, post exposure,
    bloom threshold / scatter, …); enum switches (tonemapper, modes, quality) keep the union value.
- **Pipeline defaults.** URP's two **default volume profiles** (global at priority -20000, quality asset at -10000)
  are exported onto `Camera.main`, so the look matches Unity with no scene Volume. HDRP's default volume profiles
  (global default + quality asset) export the same way, as pipeline-default volumes, so a scene with no Volume still
  gets HDRP's bloom and tonemapper. HDRP's Exposure is the evaluated stack, exported in the scene's `hdrp` block.

| Unity effect | Reaches BabylonJS as | Notes |
|---|---|---|
| Tonemapping, ColorAdjustments / ColorGrading, WhiteBalance, ChannelMixer, LiftGammaGain, ShadowsMidtonesHighlights, SplitToning, ColorCurves, ColorLookup | **Bake** → the LUT strip | Texture3D LUTs are refused |
| Bloom | **Toolkit** `ColoredBloomPlugin` (PPv2 pyramid; URP and HDRP Gaussian ladder, HDRP with its own prefilter and composite) | URP Kawase / Dual render as Gaussian (warned). HDRP lens dirt, tint and anamorphic are carried; PPv2 / URP dirt is not |
| Vignette (Classic) | **Toolkit** `VignettePlugin` (follows lens distortion) | HDRP Masked renders (mask × opacity); PPv2 Masked is ignored (warned) |
| ChromaticAberration | **Toolkit** `ChromaticAberrationPlugin` (spectral LUT exported) | |
| Grain / FilmGrain | **Toolkit** `GrainPlugin` | URP grain runs after grading, as in Unity. HDRP grain uses the texture of its type (or Custom) with `response` |
| LensDistortion | **Toolkit** `LensDistortionPlugin` | |
| DepthOfField | **Direct** → pipeline bokeh DOF | URP Gaussian approximated (warned). HDRP quality → blur level; HDRP Manual → focus between the near and far ranges, f-stop fitted so blur peaks at Far End; HDRP UsePhysicalCamera needs the camera's Physical Properties |
| MotionBlur | **Direct** → `MotionBlurPostProcess` | URP CameraAndObjects = object-based. HDRP intensity and sample count carried |
| PPv2 AmbientOcclusion, HDRP ScreenSpaceAmbientOcclusion (GTAO) | **Direct** → `SSAO2RenderingPipeline` | HDRP radius (metres), intensity and step count carried |
| PPv2 / HDRP ScreenSpaceReflections | **Direct** → `SSRRenderingPipeline` | PPv2 only on a **Deferred** camera; forward is skipped (warned) unless `TOOLKIT.PostProcessor.ForceScreenSpaceReflections = true` before load. HDRP: only when the HDRP asset supports SSR (`hdrp.features`), with its smoothness, fade, step and thickness fields |
| PPv2 AutoExposure | **Toolkit** `AutoExposurePlugin` (GPU histogram + eye adaptation) | Built-in only. Needs camera HDR and WebGL2 / WebGPU, else exposure 1 (warned) |
| HDRP Exposure | **Toolkit** — applied as the scene's **pre-exposure** (`TOOLKIT.HdrpRendering`); Automatic / Automatic Histogram / Curve Mapping run live on `AutoExposurePlugin`'s `hdrp` variant (HDRP's range, metering, histogram, curve and adaptation) | Fixed and UsePhysicalCamera are exact. The first metered frame snaps and the loader is held until the meter settles (≤ 120 frames). Emission with exposure weight < 1 follows the auto-exposure ratio. URP has no auto exposure |
| HDRP PaniniProjection, ScreenSpaceLensFlare, ScreenSpaceGlobalIllumination | **Toolkit** passes (HDRP only) | SSGI follows HDRP's pipeline: one ray per pixel reading the previous frame's colour, HDRP's temporal accumulation (prepass velocity reprojection, depth / normal rejection, reset on cut / resize / edit), diffuse denoiser and optional second pass, bilateral upsample at half resolution; it converges over ~8 frames as HDRP does. Like HDRP it replaces the opaque materials' own probe / ambient / lightmap indirect diffuse, and a ray miss falls back to the scene's HDRP reflection probes, then the sky |
| HDRP contact shadows, micro-shadowing, shadow tint, receive-SSR off | Reported once, not drawn | |
| HDRP Ray Tracing / Path Tracing (ray-traced shadows, AO, reflections incl. Mixed, GI, Recursive Rendering, SSS; the Path Tracing volume) | **Toolkit** `TOOLKIT.RayTracingSystem` — a GPU software ray tracer (one two-level BVH, SVGF denoiser), created only when the export asks for ray tracing, whatever the HDRP asset's `supportRayTracing`. A camera whose volume enables Path Tracing renders a progressive path-traced frame | WebGPU compute at full tiers; WebGL2 at half resolution, one sample. A GPU-time governor (8 ms) lowers resolution, then samples, then hands an effect back to its screen-space branch (one report). Results reach materials one frame late. Unity itself ray-traces only on Windows DX12, so the Mac Game view shows the screen-space branch — the Inspector A/B switch shows that look. Renderers set to Ray Tracing Mode Off stay out of the BVH |
| URP PaniniProjection / ScreenSpaceLensFlare, anything unlisted | **Substitute** (warned) — a Babylon post-process or `LensFlareSystem` in a script component | |
| HDRP Fog / sky / IndirectLightingController inside a profile | Not post-processing — read from the scene (§7, §8) | |
| URP renderer features | **Full Screen Pass** (Shader Graph material) and **Decal** are carried (`shader-materials.md`). The SSAO feature and others are **Substitute** (SSAO warned) — add `SSAO2RenderingPipeline` from a script | |

**The camera** (`Camera.main` drives the view):
- **Direct:** projection, FOV, near/far clip, clear flags and background colour, `allowHDR` (**the browser
  follows the camera's HDR flag, not the URP asset's**) and the physical camera.
- **Anti-aliasing (Pro, toolkit passes):** see *Camera anti-aliasing* below.
- **Not carried:** URP render scale — use `engine.setHardwareScalingLevel`. Viewport rect, depth, target texture,
  culling mask and Cinemachine are not carried either — use the toolkit `DefaultCameraSystem` or a script
  component.

**The five pre-flight checks (URP)** — an effect that "does nothing" in Unity will do nothing in the export either
(Built-in and HDRP: see the per-pipeline table below):

1. The project's render pipeline asset exists (`get_graphics_settings`, quality levels).
2. **HDR** is allowed on the **camera** (the browser follows the camera's flag; the URP asset's HDR only affects
   Unity's preview).
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
- A local Volume blends per frame (see *Local Volumes blend live* above). Give it a **Blend Distance** for a soft
  transition; 0 makes it switch at the bounds. Nested Volumes: the higher **priority** wins where both are at full
  weight.
- Use `sharedProfile` to edit the asset; `profile` silently clones it.
- URP's Grading Mode is honoured: LowDynamicRange bakes in URP's order (tonemap, then grade). Re-export older levels.
- Texture3D LUTs are not supported. A ColorLookup / external LUT must be an N²×N 2D strip (Read/Write or a PNG source).
- The URP names differ from PPv2: `Volume` (not `PostProcessVolume`), `ColorAdjustments` (not `ColorGrading`),
  `profile.TryGet<T>(out var x)` (not `GetSetting<T>`).

Recipes for common looks (all with ACES tonemapping):

| Look | Settings |
|---|---|
| **Cinematic** | Bloom 0.5–1 / threshold 0.9, Vignette 0.25, slight warm white balance |
| **Stylised** | Saturation +20, contrast +15, low bloom |
| **Horror** | Desaturate −40, vignette 0.45, film grain 0.3, cool white balance |
| **Clean / mobile** | Tonemapping + light bloom only |

**Per-pipeline authoring (what to tick in Unity):**

| | Built-in (PPv2) | URP | HDRP |
|---|---|---|---|
| Camera renders volumes | Enabled `PostProcessLayer`; its Volume Layer includes the volume's layer | Post Processing ticked; Volume Mask | Postprocess frame setting on; Volume Mask |
| HDR | Camera Allow HDR — needed for the HDR grading pass, auto-exposure and the half-float chain | Camera Allow HDR | Always an HDR chain |
| Grading mode | HighDefinitionRange (default) = Unity-exact LUT including the tonemapper | Asset Grading Mode honoured | Baked in HDRP's grading space; the default volume profiles supply bloom / tonemapping when the scene has no Volume |
| SSR | Camera Rendering Path = Deferred | No SSR volume in URP | Volume SSR, enabled in the HDRP asset |
| Local volume | Box or Sphere Collider on the same GameObject | same | same |

**Camera anti-aliasing (Pro).** The mode Unity actually renders is exported per camera; the camera gets a
`PostProcessor` even with no Volume.

| Mode | Built-in (PPv2) | URP | HDRP |
|---|---|---|---|
| Source | `PostProcessLayer.antialiasingMode` (layer enabled) | Camera Anti-aliasing (needs Post Processing ticked) | Camera Anti-aliasing (Postprocess frame setting) |
| FXAA | FXAA 3.11 preset 28 (12 in Fast Mode), last pass | preset 12 | lite FXAA |
| SMAA | SMAA 1x Low / Medium / High, last pass | before bloom / grading | as URP |
| TAA | `TaaPlugin`, URP High resolve | Quality VeryLow–VeryHigh + RCAS sharpen | closest URP resolve; TAAU forces TAA |
| MSAA | Quality level × camera Allow MSAA | URP asset (or target texture); Deferred renderer = none | Frame settings, Forward only |

- **URP drops TAA** (exported as None, warned) under MSAA > 1, camera stacking / overlay, or dynamic resolution.
  Turn MSAA off for TAA.
- **TAA needs WebGL2 / WebGPU**, otherwise no AA is drawn (warned). Its velocity misses bone-texture skinning,
  morphs and VAT (warned) — expect ghosting there.
- The exporter's `EnableAntiAliasing` (canvas MSAA) only affects cameras with no post chain.

**Known gaps:** legacy HDRP exports (no `hdrp` scene block) keep the old 8-bit chain until re-exported (warned). On
HDRP cameras an Inspector toggle neutralises a family rather than detaching it. Each effect warns once for every
overridden parameter it cannot carry. The runtime API (toggle an effect, change a value in Unity units, switch
AA mode, reset TAA history, the Inspector's *Unity Post Processing* section) is in `10-ProComponents.md`.

---

## 10. Terrain

**Reaches BabylonJS as** (Pro): a `TOOLKIT.TerrainBuilder` component, recreated as a quadtree-LOD heightfield
surface with the same splat blend as the Unity terrain material (or the terrain's Shader Graph material template).
Heights, trees and details go into the scene's
binary buffer, and splat/control images are written beside it.
- **Transform:** the terrain node is exported **position-only**, because Unity ignores terrain rotation and scale.
- **Prototypes:** tree and detail prototypes export as template groups. Their materials are glTF PBR, or the
  Shader Graph's generated `MY.*` class when the prototype uses a graph.
- **`TerrainExportMode`:** 0 = heightfield (default, use it), 1 = legacy segmented mesh.

**Author it:** create everything from `run_script`:
1. Create the `TerrainData` asset: `new TerrainData { heightmapResolution = 513, size = new Vector3(500, 60, 500) }`,
   then `AssetDatabase.CreateAsset`.
2. Create the `Terrain` GameObject with `Terrain.CreateTerrainGameObject(data)`.
3. Set heights with `data.SetHeights(0, 0, float[,])`.
4. Assign `TerrainLayer` assets to `data.terrainLayers`, and paint with `data.SetAlphamaps`.
5. Trees: `data.treePrototypes = new[] { new TreePrototype { prefab = treePrefab } }`, then
   `data.SetTreeInstances(TreeInstance[], true)` (positions 0–1). Give tree prefabs a LODGroup; add a capsule
   collider and tick *Enable Tree Colliders* on the TerrainCollider for solid trunks.
6. Details: `data.SetDetailResolution(1024, 32)`, `data.detailPrototypes = new[] { … }` (mesh:
   `usePrototypeMesh = true, prototype = prefab, renderMode = VertexLit, useInstancing = true`; grass:
   `prototypeTexture = tex, renderMode = Grass`), and paint with `data.SetDetailLayer(0, 0, i, int[,])`.
7. Save the scene, bake lighting, then export.

| Terrain feature | How it reaches BabylonJS |
|---|---|
| Heightmap | Full resolution (≥ 33), u16, in the scene `.bin`; `pixelError` drives the runtime LOD |
| Terrain layers | **Up to 16** (beyond that the 16 most-painted are kept, warned). Albedo, normal and mask are JPG at each layer's **Unity-imported size** (no exporter cap). Smoothness packs into the normal's blue channel. Mask maps export for URP/HDRP. The runtime packs layers into texture arrays whose slice size is the **largest** layer — keep every layer texture at one size (the importer's `maxTextureSize`) |
| Splat control maps | PNG, not resampled |
| Terrain material | URP Terrain Lit, HDRP TerrainLit and `Nature/Terrain/*` become `TerrainSplatMaterial` with that pipeline's blend (height blend, mask maps, holes, lightmap). A **Shader Graph** `materialTemplate` draws as its generated `MY.*` class, with Terrain Texture / Terrain Properties nodes fed by `TerrainGraphAdapter` |
| Holes | Carried — cut in the surface, the collider and the splat material |
| Terrain lightmap | ✅ in `.gltf` exports — **skipped in `.glb`** (warned) |
| Trees | Prefab prototypes → thin instances per LOD renderer: Unity LODGroup selection, 0.5 s dithered crossfade, SpeedTree billboards, hue and SpeedTree 8 wind. Only the active LOD casts, with its renderer's cast flag; billboards never cast. Probe-lit prototypes take the scene's light probes per instance. Tree colliders need *Enable Tree Colliders*; only the first capsule/box/sphere is used |
| **Mesh** details | Unity's exact detail positions, instanced, streamed by distance, fading between 0.9× and 1× `detailObjectDistance`, healthy/dry tint. Only the prototype's **first** mesh is drawn. Sway reads `Wind_Intensity` / `Wind_Speed` / `Wind_Wavelength` on the prototype material |
| **Texture** grass (Grass / GrassBillboard) | Rendered (`GrassStandardMaterial` / `GrassBillboardMaterial`) from the density map with Unity's scatter and waving-grass maths: nearly static on URP (as in Unity), waving on Built-in. Never casts. Density above 255 per cell is clamped (warned). **HDRP draws none — Unity's HDRP draws none either** (warned) |
| WindZone | Levels only. The **first directional** WindZone drives tree bend, mesh-detail sway and SpeedTree 8 graph wind; spherical zones are ignored. Texture grass uses the TerrainData *Waving Grass* settings |
| `TerrainCollider` | Built by `TerrainBuilder` (not a `collision` block): a static **Havok heightfield** with the physics material's friction / bounciness and the node's layer. Hole cells drop out. Needs Havok |
| Neighbouring terrains | One `TerrainBuilder` per tile; surface skirts close the seams. `TerrainBuilder.GetWorldHeightAt` covers every tile |

**Export settings.** `TerrainExportMode` 0 = heightfield (default; use it), 1 = legacy mesh (a far larger `.bin`, no
runtime LOD). `TerrainTreeInstances` / `TerrainDetailPrototypes` (default true) skip trees / details when false.

**Limits and gaps:**
- **The terrain surface is not pickable** — `scene.pickWithRay` never hits it. Use `TerrainBuilder.GetWorldHeightAt`
  or a Havok raycast (`10-ProComponents.md`).
- Mesh details draw the prototype's first mesh only; `detailObjectDensity` can only thin the exported instances.
- A Shader Graph prototype needs its class in the bundle; keep its own textures well under 16 (the sampler budget).
- Built-in terrain surfaces cast back faces only (avoids acne from Built-in's tiny bias).

Without Pro nothing is written — in heightfield mode there is then **no terrain surface at all**.

---

## 11. Physics

**Reaches BabylonJS as** (Pro, `ExportPhysics` on). Per node:
- **`physics`:** `type: "rigidbody"`, `mass`, drag, `freeze`, `gravity`, `kinematic`.
- **`collision`:** Box, Sphere, Capsule, Mesh (a convex hull when *Convex*) or Wheel (a `TerrainCollider` is built
  by `TerrainBuilder`, §10). Two or more
  colliders become a compound collider with per-shape friction and restitution.
- **A component:** `TOOLKIT.RigidbodyPhysics` or `TOOLKIT.CharacterController`, recreated with Havok.

A collider with no Rigidbody becomes a **static** body (mass 0). Kinematic bodies become animated bodies.

**Collision layers.** The scene carries the project's Layer Collision Matrix (`layercollisionmatrix`, `int[32]`:
bit *j* of row *i* set = layers *i* and *j* collide). Every shape — compound children and triggers included — gets
membership `1 << layer` (a compound child uses its own GameObject's layer) and collides with its layer's matrix
row, so two layers unticked in *Project Settings → Physics* pass through each other in BabylonJS exactly as in
Unity. An enabled `CollisionFilter` on the body replaces the row with its `collideWith` mask
(`physics.filteroverride: true`). Scenes exported before the matrix existed keep membership from `layermask` and
collide with everything.

| Unity setting | How it reaches BabylonJS |
|---|---|
| Mass, drag, angular drag, use gravity, kinematic | **Direct** |
| Rotation constraints | **Direct** |
| **Position** constraints | **Toolkit** — frozen world axes are held every physics step (frozen velocity zeroed, coordinates restored), so gravity, forces, impulses and hits cannot move the body on them. Kinematic bodies are exempt. `RigidbodyPhysics.HoldFrozenAxes(body, x, y, z)` re-captures after a scripted teleport; `ReleaseFrozenAxes(body)` frees it |
| Physics materials (friction, bounciness, combine modes) | **Direct**. No material = the exporter's Default Friction / Restitution (0.6 / 0) |
| Triggers | **Direct**; events arrive once a script calls `enableCollisionEvents()`. A **MeshCollider** trigger is a convex hull trigger; a non-convex one is exported as convex with one export warning (and warns once at runtime on older exports) |
| `Physics.gravity` | **Toolkit** — `SceneController.sceneOptions.defaultGravity` (default `(0,-9.81,0)`, levels only) |
| Hinge / Fixed / Spring / Configurable / Character joints | **Toolkit** — Starter joint components: `BallSocketJoint`, `DistanceJoint`, `FixedHingeJoint`, `LockedJoint`, `PrismaticJoint`, `SixdofJoint`, `SliderJoint` (`Assets/[Starter]/Physics/`) |
| Centre of mass | **Toolkit** — `PhysicsRoot.centerMass` |
| Layer Collision Matrix, `CollisionFilter.collideWith` | **Direct** — shape filter masks (see *Collision layers* above) |
| Layer-masked queries | **Toolkit** — `RigidbodyPhysics.Raycast(origin, dir, length, RigidbodyPhysics.LayerMaskQuery(mask))` hits only layers in `mask` (Unity layer-mask bits); `Shapecast({ ..., layerMask })` likewise |
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
- A **mesh trigger fires on its convex hull**, not the exact surface — for a concave trigger volume use several
  primitive triggers.
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
  speed, stopping distance, area mask and auto-traverse.
- **Off-mesh links.** Legacy `OffMeshLink` and AI Navigation `NavMeshLink` components are baked into
  `NavigationMesh.bin` and listed in scene key `navigation.offmeshlinks`. A wide `NavMeshLink` becomes parallel
  point links across its width. Direction, area (its flags apply to area masks), cost override and activation
  carry. Runtime bakes (scene data, tile cache) add the same links. A `.bin` baked before a link existed logs a
  stale-bake warning — re-bake and export again.
- **Link traversal.** The agent walks to the link start, then crosses in a straight line at its own `speed`,
  facing the direction of travel, and continues to its destination. It never reports stuck on a link.
  `isOnOffMeshLink()`, `currentOffMeshLinkData` (`startPosition`, `endPosition`, `area`, `linkId`, `activated`,
  `autoTraverse`), `onOffMeshLinkStartObservable` and `onOffMeshLinkEndObservable` report the crossing. With
  `autoTraverseOffMeshLink` off (`setAutoTraverseOffMeshLink(false)`), the agent stops at the link start and
  leaves the transform to your script. Play a jump there, then call `completeOffMeshLink()` to place it at the
  link end and continue. `teleport`, `cancelNavigation`, disabling or disposing the agent ends a crossing. A
  `setDestination` during a crossing applies from the link end.
- **Links at runtime.** `SceneManager.GetNavigationLinks` / `GetNavigationLink` read them.
  `SetNavigationLinkActive(scene, id, false)` switches a link off without a rebake: new paths avoid it, and an
  agent heading for it re-plans. `AddNavigationLink` / `RemoveNavigationLink` apply on the next runtime bake.
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
| Off-mesh link animation (Unity plays none either) | Carried as links (above). For a jump arc, turn auto-traverse off, animate the transform on `onOffMeshLinkStartObservable`, then call `completeOffMeshLink()` |
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
| States; transitions with conditions, exit time, (fixed) duration, offset, solo/mute; parameters | **Toolkit** ✅ |
| Blend trees — 1D, 2D Simple Directional, 2D Freeform (both), **Direct** (incl. Normalized Blend Values, nested in other trees) | **Toolkit** ✅ |
| Layers — weight (`setLayerWeight` / `getLayerWeight`), **override** and **additive** blending, avatar masks | **Toolkit** ✅ — additive adds `inverse(first frame) × current` of its clip on top of the layers below |
| **Synced** layers (override motions per state) | **Toolkit** ✅ — follow the source layer's state, including mid-transition |
| Entry transitions | **Toolkit** ✅ — evaluated in order when a machine is entered through Entry (a transition to a sub-state machine, or Exit from the root); like Unity, a layer **starts in its default state** |
| Transitions in flight; interruption source (None, Current State, Next State, both orders), Ordered Interruption | **Toolkit** ✅ — Any State transitions are evaluated first (Unity order) and can always interrupt; `isInTransition(layer)` / `getActiveTransition(layer)` |
| Can Transition To Self | **Toolkit** ✅ (Any State transitions); a state's own transition onto itself restarts it |
| Sub-state machines | **Toolkit** ✅ — transitions to a machine enter through its entry transitions (else its default state); Exit follows the machine's outgoing transitions, else re-enters the parent through Entry |
| State speed + **speed multiplier parameter** (negative plays backwards), **cycle offset** + parameter, **mirror** + parameter; Animator `speed` | **Toolkit** ✅ — parameters are read live. A state with a speed multiplier parameter plays at that parameter's value, as in Unity. The toolkit's `ThirdPersonPlayerController` and `StandardPlayerController` set the Starter Assets `MotionSpeed` every frame as Unity's ThirdPersonController does (1, or the input magnitude when `analogMovement` is on; parameter name `animationStateParams.motionSpeed`); a custom script driving that controller must set it itself, or locomotion holds still |
| `StateMachineBehaviour`s | **Toolkit** ✅ — `onStateMachineBehaviourObservable` raises `{kind, behaviour, state, layer, properties}` for enter / update / exit / machineEnter / machineExit; a class registered with `TOOLKIT.SceneManager.RegisterClass("<C# class name>", …)` (namespace-qualified name first) is created on its first enter, gets the exported public / `[SerializeField]` fields, and receives `onStateEnter` / `onStateUpdate` / `onStateExit(animator, stateInfo, layerIndex)` and `onStateMachineEnter` / `onStateMachineExit(animator, machinePath)`. Machine-level behaviours also receive enter / update / exit for every state inside the machine. A missing class warns once per name |
| `AnimatorOverrideController` | ❌ — nothing exports; use a real controller |
| Root motion | Baked in when `applyRootMotion` is on, pinned otherwise; the runtime exposes root-motion deltas |
| AnimationEvents | ✅ via `onAnimationEventObservable` (skeleton mode, 0.01 normalised-time precision) |
| Clip curves that drive Animator parameters | ✅ |
| Humanoid clips | Baked onto the first SkinnedMeshRenderer's bones; share clips across rigs with `AnimatorControlRig`'s rig mode (bone names must match) |
| IK pass | The runtime raises an IK observable; solve the IK in a script component |
| Skinning | Max **4** bone influences |
| Blend shapes | ✅ (last frame only, no names); blend-shape animation ✅ |
| Timeline / PlayableDirector | **Substitute** — a TypeScript component driving `AnimationState` or animation groups |

**Deviations from Unity** (skeleton mode unless noted):

- **Mirror is an approximation.** The runtime swaps the tracks of the exported humanoid left / right bone pairs and
  reflects local rotations across the character's YZ plane (rest-pose corrected). Like Unity, a mirrored **looping**
  motion plays half a cycle on (mirrored at t = swapped and reflected clip at t + 0.5), so a mirrored run stays in step
  with the unmirrored one, and generic rigs ignore mirror. Measured against Unity on the Starter PlayerArmature (Run_N and
  an authored one-arm clip) hands and feet agree to about 2 cm; Unity mirrors in muscle space, so rigs with an
  asymmetric rest pose can differ more.
- **Synced-layer Timing is an approximation.** With Timing on, the source layer plays at
  `sourceLength / lerp(sourceLength, syncedLength, syncedWeight)` and the synced layer is locked to the source's
  normalized time; Unity's exact duration blend is not documented, so long, heavily weighted synced clips can drift.
- **Additive layers carry no root motion,** and an additive layer is never the base layer.
- **Direct trees divide by the weight sum** of the children that animate a property, so weights summing below 1 do
  not fade toward the rest pose.
- **Cycle offset shifts the sampled pose only**; animation events still fire on the unshifted phase.
- **Machine enter / exit behaviours fire whenever the active state's machine changes** (including the root machine on
  the first state), not only through Entry / Exit nodes.
- **VAT mode** carries transitions, interruption, behaviours, speed and cycle offset; it has one layer and no mirror.

For one animated transform in its own `.glb`: `bt_export_animation --path <HierarchyPath>`. It writes no
metadata, so that file has no `AnimationState`. It also bakes **no keyframes** for a rig in VAT mode.

---

## 14. Audio

**Reaches BabylonJS as** (Pro). A `TOOLKIT.AudioSource` with the clip's original `.wav` / `.mp3` / `.ogg` copied
**byte-for-byte** (no transcoding).

| AudioSource setting | How it reaches BabylonJS |
|---|---|
| Volume, pitch, loop, mute, play on awake | **Direct**. Autoplay waits for the browser's audio unlock |
| Rolloff mode, min / max distance | **Direct** — the toolkit computes Unity's curve as a per-frame gain (native Web Audio distance attenuation is switched off). *Logarithmic* (default) = `min / d`, full volume inside min, and it keeps falling past max exactly like Unity (max does not stop it). *Linear* = `1 − (d − min) / (max − min)`, silent at max. *Custom* = your curve over `d / max`, exported as 64 samples of Unity's own `AnimationCurve.Evaluate` (0 or the last key past max) |
| Spatial blend | **Direct** — any value above 0 is positional; the volume is `lerp(1, rolloff, blend)` like Unity's 2D/3D mix |
| Stereo pan | **Direct** on the 2D share (`pan × (1 − blend)`), with Unity's constant-power pan law. A 2D source plays at Unity's level (−3 dB per channel at centre) |
| Priority, reverb zone mix, bypass flags, doppler, spread | Not used at runtime |
| AudioListener | **Toolkit** — the active camera hears (the toolkit attaches the listener to it when nothing else did); `DefaultCameraSystem` re-attaches it to its rig |
| AudioMixer and snapshots | **Substitute** — the Starter `SoundManager` / `SceneSoundSystem` components (music and SFX groups) |
| Reverb zones | **Substitute** — not carried |

`AudioDetails.preloadAsset` makes a clip preload. Scripts can change the same settings at runtime:
`setRolloffMode("logarithmic" | "linear" | "custom", keys?)`, `setMinDistance`, `setMaxDistance`, `setSpatialBlend`,
`setStereoPan`; `getRolloffGain()` / `getListenerDistance()` read back what is applied. A blend between 0 and 1 *and*
a stereo pan together is approximate (Unity mixes two signal paths; the web plays one). The legacy audio engine
(`EnableLegacyAudio`) follows the same rules.

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

## 17. LOD, particles, lines and sprites, video, UI

| Component | How it reaches BabylonJS (Pro) | Traps |
|---|---|---|
| `LODGroup` | Node keys `lods`, `coverages` (screen-relative transition heights), `lodsize` / `lodcenter` (the group's size and reference point), `fademode`, `fadewidths`, `animatecrossfade` (needs `MeshExportSystem` = sub-meshes, the default). The runtime switches by Unity's own rule — group size × LOD bias ÷ (2 tan(fov/2) × distance), or ÷ (2 × ortho size) — so levels change at the same screen height at any field of view and in an orthographic camera, from a GUI or a batch-mode export. Below the last level the group is culled. **Fade Mode Cross Fade / SpeedTree** dither-fades between levels (Unity's 4×4 pattern): *Animate Cross-fading* gives a 0.5 s timed fade at each switch, otherwise the fade runs across each level's *Fade Transition Width*; a culled last level fades out. During a fade only the stronger level casts shadows | LOD renderers must be children of the group. Cross-fades need regular meshes with materials (a group with instanced renderers switches hard). Baked `distances` are only a fallback for old exports without coverages. Non-active levels never cast shadows. A group with one renderer per level and no fade runs on Babylon's native LOD (the fast path, thresholds re-derived from the coverages for the active camera): its active level casts only when the LOD0 renderer has Cast Shadows on |
| `ParticleSystem` | `TOOLKIT.ShurikenParticles` — one **CPU** `BABYLON.ParticleSystem` per system. Every module: main, emission/bursts, shape (every type incl. mesh, skinned mesh, sprite, shape texture), velocity / limit / inherit / force, lifetime by emitter speed, colour / size / rotation over lifetime and by speed, external forces (force fields, wind zones), noise, collision (planes; world by ray casts), triggers, sub-emitters (birth / death / collision / trigger / manual), texture-sheet animation (grid, sprites), lights, trails (particle + ribbon), custom data. Renderer: billboard, stretched, horizontal, vertical, mesh (thin instances, ≤ 4 meshes), none (trail-only); sort modes, sorting layer / order | Materials: `Particles/Standard Unlit` / `Surface`, `Legacy Shaders/Particles/*`, `Mobile/Particles/*`, URP `Particles/Unlit` / `Lit` / `Simple Lit`, URP Lit / Unlit, HDRP Lit / Unlit, and **Shader Graph** (drawn through its generated class with Unity's vertex streams). Any other shader draws alpha-blended with the main texture (warned). See *Particle fidelity* below |
| `VisualEffect` (VFX Graph 17.x) | `TOOLKIT.VisualEffect` — the graph is read at export (optional editor assembly, read-only reflection) and each particle system is classified **GPU** (`BABYLON.GPUParticleSystem`: box / sphere / point spawns, initial values, colour / size / angular speed over life, gravity and absolute Force, Turbulence as noise, constant-rate flipbooks) or **CPU** (a Node Particle System skeleton whose update queue runs every VFX block as a toolkit step: operator chains, Set Attribute compositions, forces, point caches, vector fields, kill / collision shapes, 3D angles, custom attributes). Spawners, events (`OnPlay` / `OnStop` / custom), exposed properties with the instance's overrides, the asset's update mode and prewarm are carried. Outputs: camera-facing billboards draw through the particle system with a toolkit render effect (soft particles, camera fade, flipbook blending, lit approximation, cutout, premultiply, Subpixel AA); 3D-oriented and multi-output systems draw as thin-instance quads with a PBR material (CPU only), casting alpha-clipped shadows when *Cast Shadows* is on | Needs the VFX Graph package (17.x); another version exports the component as unsupported (one summary line). The export summary, `Library/BabylonToolkit/VisualEffects/manifest.json` and one grouped runtime console summary per scene name each system's path, the reason for every CPU system and every deviation. A device without GPU particles runs GPU systems on the CPU path. See *Particle fidelity* below |
| `LineRenderer` | `TOOLKIT.LineRenderer` — a ribbon through the exported points: width curve, colour gradient, View / TransformZ alignment, every texture mode. `setPositions(points)` / `getPositions()` at runtime | Corner and cap vertices are not generated. A non-graph material draws **unlit and alpha-blended** with its colour and texture — use a Shader Graph material for additive looks. Draws in rendering group 1 |
| `TrailRenderer` | `TOOLKIT.TrailRenderer` — a world-space ribbon behind the moving node: `time`, `minVertexDistance`, width curve, colour gradient, `emitting` | Same material rule as `LineRenderer`. `autodestruct` and corner / cap vertices are not read |
| `SpriteRenderer`, `TilemapRenderer` | `TOOLKIT.SpriteRenderer` / `TOOLKIT.TilemapRenderer` quads, sorted by sorting layer and order (rendering group 1). Sprite Lit / Shader Graph materials see 2D lights through `TOOLKIT.Light2DTexture` | No 2D physics; Light2D sorting-layer targeting is ignored; SpriteMask is not drawn |
| `VideoPlayer` | `TOOLKIT.WebVideoPlayer` (a video texture) | **Only Material Override render mode** |
| uGUI `Canvas` / `UIDocument` | `TOOLKIT.UserInterface`, one per root Canvas / UIDocument, rebuilding Unity's own model and re-running layout on every resize. Layout: CanvasScaler (constant pixel; scale with screen with match / expand / shrink; constant physical), anchors, pivots, Z rotation, Horizontal / Vertical / Grid layout groups, LayoutElement, ContentSizeFitter, AspectRatioFitter. Graphics: Image (simple / sliced / tiled / filled), RawImage, Mask, RectMask2D, CanvasGroup, Outline / Shadow. Controls: every Selectable — Button, Toggle + ToggleGroup, Slider, Scrollbar, ScrollRect, Dropdown, InputField (TMP and Legacy). Text: TMP and Legacy Text. UI Toolkit: UXML/USS computed styles, flexbox, hover / active / focus states, 58 element types. **Render modes:** Overlay draws on the scene's foreground texture after post-processing; Camera is a plane at `planeDistance`; World Space is a mesh on the canvas node. Persistent `onClick` / `onValueChanged` listeners call script-component methods or `GameObject.SetActive` | Needs `ExportUserInterfaces` (*Embed User Interface*, default on). See *Unity UI — rules and limits* below; the scripting API is in `10-ProComponents.md`. For app-style UI, read `ui-design-system.md` first |

### Particle fidelity and limits

| Topic | Rule |
|---|---|
| Simulation | CPU only. Cost grows with live particles; trails, lights, world collision, triggers and force fields add CPU work per particle. Budget live particles like draw calls on mobile |
| Lit particles | Per-vertex: ambient + main directional + the 4 nearest point lights. **No shadows, light probes, specular or normal maps** |
| Particle lights | Pooled point lights, ≤ 8 per system and ≤ 16 per scene; they light a material only where it has a free light slot. Spot templates draw as points |
| Soft particles | Need a depth texture: the toolkit adds an opaque depth pass unless `TOOLKIT.ShurikenParticles.SoftParticleDepth = false` is set before load |
| World collision | Rays hit Havok colliders when physics runs, else pickable meshes, filtered by *Collides With*; 256 rays a frame for the whole scene, so dense collision is approximate |
| Triggers | Box, sphere, capsule; mesh colliders by their bounds; ≤ 31 colliders per system |
| Blend | Alpha, additive, multiply, premultiply, cutout, opaque. Subtractive is approximated. Distortion has no refraction (a tinted quad) |
| Approximated | Noise (ported, not exact); billboard rotation is Z only (X / Y on mesh particles); wind turbulence, vector fields; Use Unscaled Time; Freeform Stretching |
| Caps | Sorting is skipped above 2000 live particles; ≤ 32 points per trail; ≤ 16 sprite rectangles per sheet |
| Sub-emitters | The child must be another exported `ParticleSystem`; it never emits on its own |
| Inactive objects | A system whose GameObject is inactive at export never auto-plays — call `play()` |

**VFX Graph.** Author as usual; the exporter picks the path per particle system. To stay on the GPU path, keep a system to unrotated volume-box / full-sphere / point spawns, Initialize Set Attribute (overwrite) and over-life blocks (colour, size, angular speed), gravity and absolute Force, Turbulence and constant-rate flipbooks — any other block (operator-driven attributes, relative forces and drag, point caches, vector fields, collision / kill shapes, 3D orientation, custom attributes, more than one output) moves that system to the CPU path, which runs every block but costs CPU per live particle. Not carried (reported neutral): Shader Graph outputs, strips, mesh outputs, GPU events, SDF shapes, mask maps and billboard normal maps; bounds culling (the simulation always runs); Timeline Visual Effect control tracks. Particles are not sorted and billboard outputs cast no shadows — use a quad output (3D orientation) for shadow casters. Quad flipbooks show the nearest frame. Script access is `TOOLKIT.VisualEffect` (`10-ProComponents.md`).

### Unity UI — rules and limits

| Rule / limit | Detail |
|---|---|
| Listener targets | A persistent listener runs only when its target is a script component whose C# class carries an **explicit `[Babylon(Class="…")]`**, or `GameObject.SetActive`. The TypeScript class needs a public method with the same name. Arguments: void → `()`, dynamic → `(value)`, static int/float/string/bool → `(arg)`, Object → `(BABYLON.Node)`. Any other target (Animator, AudioSource, plain MonoBehaviour) is skipped (warned `listener-unsupported`) |
| UI Toolkit events | UXML has no UnityEvents — wire UI Toolkit controls from a script (`UserInterface.OnClick` / `OnValueChanged`) |
| Fonts | The source `.ttf/.otf` is copied into `fonts/`. A TMP font asset with no source font file falls back to `"<family>", sans-serif` (warned). Built-in Arial becomes LiberationSans |
| Sprites | Exported once, untinted, named by asset name — give every UI sprite a unique name |
| RawImage | The texture must be a `Texture2D`; a RenderTexture draws empty (warned) |
| Rotation | Only Z rotation carries; rotate a World Space canvas for tilt |
| Masks | Clip to rectangles; a Mask sprite with transparent pixels clips to its rect |
| TMP | Overflow / Ellipsis / Masking / Truncate carry; ScrollRect / Page / Linked become Overflow. `<sprite>` and `<link>` tags are removed. Outline and underlay carry |
| Transitions | Color Tint and Sprite Swap carry; Animation renders the normal state |
| Colour | Translucent UI blends in sRGB, so translucent panels look a little darker than in a Linear Unity project |
| Render modes | Overlay is drawn after post-processing; Camera and World Space canvases are scene meshes and are post-processed, as in Unity. Screen Space – Camera with no camera falls back to overlay (warned). A UI Toolkit render-texture panel draws on the mesh whose material samples that texture |
| Inactive UI | An inactive root canvas still exports and builds the first time it is enabled (`UserInterface.SetActive("Name", true)`) |
| Input | UI owns every pointer it hits, in every mode — camera controls and scene picks never see it. Empty UI area passes through |
| Not carried | Keyboard / gamepad navigation between Selectables; UI Toolkit data binding |
| Shader Graph UI | An Image / RawImage / TMP text / UI Toolkit element whose material is a Canvas / UI Shader Graph renders through the transpiled graph, per element. Any other custom material draws as the plain graphic (warned `custom-material`) |
| Diagnostics | Export: `[GUI] <path>: …` in the Unity console. Runtime: `UserInterface: [<code>] <path> — …`, once per code and path |
---

## 18. Script components — the game logic

All game logic runs in BabylonJS as **script components**. They can live in the web app project that loads
the glTF (written in TypeScript or JavaScript, reaching exported nodes and their components with
`SceneManager.GetComponent`), or, optionally, be attached to GameObjects in Unity. This section covers the Unity
path. A Unity-attached script component is a TypeScript class paired with a C# **`EditorScriptComponent`** class
that carries its inspector fields. Script components are **not licence-gated**. Plain `MonoBehaviour`s are
Unity-only and are not exported.

**Use the Unity path when you want to script up objects in a particular scene** — a moving platform, a door, a
trigger zone — and no supplied `TOOLKIT.*` component provides the behaviour. Write the pair and attach it to the
GameObject yourself. The C# side never runs in the game; only its public fields are exported, as the component's
property bag. The exporter compiles the TypeScript into the project script bundle (`scenes/<Product>.js`), just
as generated Shader Graph material classes are compiled and auto-loaded. The glTF loader then loads that bundle and
instantiates the class on each node automatically (`unity-exporter-cli.md` §8.2 → *How the class reaches the
browser*).

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
| Texture format | `TextureImageFormat` KTX2 (`3`) for the smallest GPU memory. WEBP (`2`) only after switching `DefaultWebpImageCommandType` to lossy. Lightmaps follow the format setting (RGBD survives PNG, lossless WEBP and the linear KTX2 lightmap path) |
| Lightmaps | `lightmapResolution` and `maxLightmapSize` (1024–2048) set lightmap memory. Fewer, fuller atlases are cheaper |
| Lights | Bake fills and practicals (they cost nothing at runtime). Keep realtime and Mixed lights few. A material takes at most `SceneController.maximumLights` (default 4). The shadow map size comes from the URP asset |
| Terrain | 4–8 layers, all layer textures one imported size (1024 mobile, 2048 desktop — the largest sets every array slice), heightmap 257–513 for mobile, tree / detail distance and detail density sized for the target, heightfield mode |
| Geometry | LOD groups on heavy meshes (any Editor; Cross Fade only where popping shows). Repeated meshes stay glTF instances (`ExportMeshInstances`, default on). Mark static objects Static to freeze their world matrices |
| Probes | Enough light probes to cover dynamic areas (APV ≤ 8192). Reflection-probe resolution 128–256 |
| Post-processing | Grading is one LUT (an extra pass on the HDR path). TAA ≈ 2.5 ms (mostly its velocity prepass), auto-exposure ≈ 0.4 ms. Bloom, DOF, motion blur, SSAO and SSR cost fill-rate — use them sparingly on mobile. `TOOLKIT.PostProcessor.HalfFloatChain = false` before load halves HDR-chain bandwidth but brings back banding |
| Shader Graph | Graph shadows use stock depth by default (`TOOLKIT.SgShadowDepth.Enabled = false`). Scene Color / Scene Depth nodes add a render target per camera. Keep each graph under 16 samplers |
| Particles | CPU-simulated — budget live particles, trails, particle lights and world collision |
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
     change (for example Metallic instead of Specular).
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
| Light cookies | `SpotLight.projectionTexture` |
| Realtime GI (Enlighten) | Bake the GI (§4) |
| URP renderer features other than Full Screen Pass / Decal (e.g. the SSAO feature), URP Panini and Screen Space Lens Flare (HDRP's are carried, §9) | `SSAO2RenderingPipeline`, custom `PostProcess`, `LensFlareSystem` |
| Render scale | `engine.setHardwareScalingLevel` |
| Occlusion culling | `mesh.occlusionType` / occlusion queries |
| Navmesh areas, obstacles | The runtime `SceneManager` navigation-area API. Off-mesh links are carried (§12) |
| 3D `TextMeshPro` (not TextMeshProUGUI) on the default *Distance Field* shader | A World Space Canvas with TMP text, a TMP SDF Shader Graph font material, or Babylon GUI on a mesh |
| Keyboard / gamepad navigation between Selectables | `TOOLKIT.InputController` in a script driving `UserInterface.SetValue` / click targets |
| Selectable *Animation* transitions, UI Toolkit data binding | Color Tint / Sprite Swap; set values from a script with `UserInterface.SetValue` / `SetText` |
| 2D physics (Rigidbody2D, Collider2D) | Havok 3D bodies with a locked axis, or scripted motion. Sprites, tilemaps and 2D lights are carried (§17) |
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
