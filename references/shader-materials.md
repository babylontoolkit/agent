# Custom Shader Code Instructions (2.1.0)

**IMPORTANT. THIS DOCUMENT PROVIDES CRUCIAL SHADER CODE GENERATION INSTRUCTIONS. ALWAYS READ THIS ENTIRE DOCUMENT TO THE END OF FILE**

* Always reference the `Babylon Toolkit Component Reference` at https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/README.md for details regarding the script component model api.
* For SETTING uniform values on a material that already exists, use `Babylon Toolkit Materials` at https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/08-Materials.md. **This document is about AUTHORING a new custom shader material.**
* Important: Always use the default ES6 versions of BabylonJS, Babylon Toolkit, Babylon Toolkit React Framework and Babylon Toolkit Starter Projects, unless otherwise instructed to use the UMD versions.

---

## Follow these rules exactly when generating custom shader code

### RULE 0 — If the look is a Unity Shader Graph, do not write a shader at all.

Unity Shader Graphs are **transpiled at export** into generated `MY.*` material classes (GLSL + WGSL, the same
material + plugin pair RULE 1 describes). Author or edit the **graph in Unity**, re-export with a script compile, and
drive it from game code by its Unity property names. Hand-write a shader only for looks that do not exist as a graph.
Read **Unity Shader Graphs — transpiled at export** below before touching any graph-backed material, and never edit a
generated file.

### RULE 1 — Never write a standalone shader. Extend a toolkit material and attach a plugin.

The Babylon Toolkit does **not** use `new BABYLON.ShaderMaterial(...)`, `BABYLON.Effect.ShadersStore`, or `BABYLON.ShaderStore`. Those replace the whole shader and throw away PBR lighting, IBL, shadows, fog, skinning, instancing, morph targets and the toolkit's own Unity-style lighting.

Every custom shader in this runtime is **injected code inside the stock Babylon material**, using Babylon's `MaterialPluginBase` injection points. You always write a **pair**:

| Piece | Extends | Owns |
|---|---|---|
| the material | `TOOLKIT.CustomShaderMaterial` (PBR) or `TOOLKIT.StandardShaderMaterial` | uniforms, samplers, attributes, per-frame value updates |
| the plugin | `TOOLKIT.CustomShaderMaterialPlugin` or `TOOLKIT.StandardShaderMaterialPlugin` | the GLSL and WGSL source injected at each hook |

**Never** author only one of the two. **Never** write a plugin against `BABYLON.MaterialPluginBase` directly — the toolkit base classes carry the uniform plumbing, the WGSL declaration emitter and the UBO binding path, and reimplementing them is how custom materials break on WebGPU.

Choose the base by lighting model:

* `TOOLKIT.CustomShaderMaterial` — **default. Use this.** Extends `BABYLON.PBRMaterial`. Metallic/roughness, IBL, `splitLighting()`, all skin-array features.
* `TOOLKIT.StandardShaderMaterial` — extends `BABYLON.StandardMaterial`. Only for cheap unlit-ish / vegetation-style surfaces where PBR is overkill (this is what the shipped grass materials use). Fewer injection points exist — see RULE 5.

### RULE 2 — Both languages, always. GLSL for WebGL, WGSL for WebGPU.

The engine may be WebGL2 (GLSL) **or** WebGPU (WGSL). A plugin that emits only one is a black or untextured mesh on half of all devices. Every `getCustomCode()` you write **must** branch on `shaderLanguage` and return working source for both, and `isCompatible()` must accept both.

```typescript
public isCompatible(shaderLanguage: BABYLON.ShaderLanguage): boolean {
    return (shaderLanguage === BABYLON.ShaderLanguage.WGSL || shaderLanguage === BABYLON.ShaderLanguage.GLSL);
}
```

### RULE 3 — The material declares; the plugin injects.

Declare every uniform / sampler / attribute on the **material** (usually in its constructor). Doing so:

1. registers it for UBO upload,
2. auto-emits its GLSL declaration, and
3. **defines a preprocessor symbol equal to the UPPERCASED name** — so `addFloatUniform("g_windAmount", 0.5)` also gives you `#ifdef G_WINDAMOUNT`.

```typescript
mat.addFloatUniform(name, value);       // float / bool / int
mat.addBoolUniform(name, value);        // uploaded as a float 1.0 / 0.0
mat.addVector2Uniform(name, vec2);
mat.addVector3Uniform(name, vec3);
mat.addVector4Uniform(name, vec4);
mat.addTextureUniform(name, texture);   // ALSO creates <name>Infos (vec2) and <name>Matrix (mat4)
mat.addTextureArrayUniform(name, tex);  // sampler2DArray / texture_2d_array; marked raw
mat.addAttribute(name);                 // per-vertex or per-instance attribute
mat.markTextureAsRaw(name);             // see RULE 8
```

Read/write at runtime with `setFloatValue` / `getFloatValue`, `setVector3Value`, `setTextureValue`, etc.

Naming: prefix your uniforms (`g_`, or the Unity property name) so they cannot collide with Babylon's own (`vAlbedoColor`, `vBumpInfos`, `metallicRoughness`, …). A collision is a shader compile error with a confusing message.

### RULE 4 — The seven plugin methods. Six of them are boilerplate you must not omit.

```typescript
export class MyEffectPlugin extends TOOLKIT.CustomShaderMaterialPlugin {

    public constructor(customMaterial: TOOLKIT.CustomShaderMaterial, shaderName: string) {
        // name, PRIORITY (lower runs first), and the plugin's own defines (default false)
        super(customMaterial, shaderName, 100, { MYEFFECT: false });
    }

    public isCompatible(shaderLanguage: BABYLON.ShaderLanguage): boolean {
        return (shaderLanguage === BABYLON.ShaderLanguage.WGSL || shaderLanguage === BABYLON.ShaderLanguage.GLSL);
    }

    public getCustomCode(shaderType: string, shaderLanguage: BABYLON.ShaderLanguage): any { /* RULE 5 */ }

    // --- boilerplate: copy verbatim into every plugin ---

    public getUniforms(shaderLanguage: BABYLON.ShaderLanguage): any {
        const wgsl: boolean = (shaderLanguage === BABYLON.ShaderLanguage.WGSL);
        this.vertexDefinitions = this.getCustomShaderMaterial().getCustomVertexCode(wgsl);
        this.fragmentDefinitions = (wgsl === true) ? this.getCustomShaderMaterial().getCustomFragmentCode(wgsl) : null;
        return this.getCustomShaderMaterial().getCustomUniforms(wgsl);
    }

    public getSamplers(samplers: string[]): void {
        const s: string[] = this.getCustomShaderMaterial().getCustomSamplers();
        if (s != null && s.length > 0) samplers.push(...s);
    }

    public getAttributes(attributes: string[], scene: BABYLON.Scene, mesh: BABYLON.AbstractMesh): void {
        const a: string[] = this.getCustomShaderMaterial().getCustomAttributes();
        if (a != null && a.length > 0) attributes.push(...a);
    }

    public prepareDefines(defines: BABYLON.MaterialDefines, scene: BABYLON.Scene, mesh: BABYLON.AbstractMesh): void {
        if (!this.getIsEnabled()) return;
        this.getCustomShaderMaterial().prepareCustomDefines(defines);
    }

    public bindForSubMesh(uniformBuffer: BABYLON.UniformBuffer, scene: BABYLON.Scene, engine: BABYLON.AbstractEngine, subMesh: BABYLON.SubMesh): void {
        if (!this.getIsEnabled()) return;
        this.getCustomShaderMaterial().updateCustomBindings(uniformBuffer);
    }
}
```

The `getUniforms` body is **not optional and not reorderable**: it is what hands the material's declarations to the shader before the uniform list is emitted. Omit it and every custom uniform is undefined in WGSL.

Priorities in the shipped runtime — pick a number that does not fight them: `UnityStyleLightingPlugin` 10, `SkinArraySwitchingPlugin` 21, terrain probes 90, terrain splat / project effects 100, texture grass 110, terrain foliage 120.

### RULE 5 — The injection points, and which shader they exist in.

`getCustomCode(shaderType, shaderLanguage)` returns an object keyed by hook name. Return `null` for a stage you do not touch.

**Vertex (`shaderType === "vertex"`)**

| Hook | Use for |
|---|---|
| `CUSTOM_VERTEX_DEFINITIONS` | varyings, attributes, and (GLSL only) vertex-stage uniform declarations |
| `CUSTOM_VERTEX_UPDATE_POSITION` | edit `positionUpdated` in object space |
| `CUSTOM_VERTEX_UPDATE_WORLDPOS` | edit `worldPos` — **use this for vertex animation** so shadows follow the displacement |
| `CUSTOM_VERTEX_MAIN_END` | write varyings after everything is final |

**Fragment (`shaderType === "fragment"`)**

| Hook | Available in | Use for |
|---|---|---|
| `CUSTOM_FRAGMENT_DEFINITIONS` | both | varyings, samplers, helper functions, module globals |
| `CUSTOM_FRAGMENT_UPDATE_ALBEDO` | PBR | rewrite `surfaceAlbedo`; also the only place UVs+samplers are in scope for later hooks |
| `CUSTOM_FRAGMENT_BEFORE_LIGHTS` | both | last chance to edit `normalW` / albedo before lighting |
| `CUSTOM_FRAGMENT_UPDATE_METALLICROUGHNESS` | PBR | inside `reflectivityBlock`: `metallicRoughness.r` = metallic, `.g` = roughness. **No UV or sampler access here** — sample in `UPDATE_ALBEDO` into a module global and read it here |
| `CUSTOM_FRAGMENT_BEFORE_FINALCOLORCOMPOSITION` | **PBR only** | `finalEmissive`, `finalIrradiance`, `finalRadiance`, `finalRadianceScaled` |
| `CUSTOM_FRAGMENT_BEFORE_FOG` | **StandardMaterial** | the Standard-material equivalent of the line above |

⚠️ `CUSTOM_FRAGMENT_BEFORE_FINALCOLORCOMPOSITION` **does not exist in the StandardMaterial shader.** A `StandardShaderMaterial` plugin that uses it silently injects nothing. Use `CUSTOM_FRAGMENT_BEFORE_FOG`.

Engine variables you may read or write: `positionUpdated`, `normalUpdated`, `finalWorld`, `worldPos`, `surfaceAlbedo`, `normalW`, `vTBN` (GLSL) / `vTBN0..2` (WGSL), `metallicRoughness`, `finalEmissive`, `alphaCutOff`, `vColor`, `uvOffset`.

### RULE 6 — The GLSL / WGSL divergences that actually break builds.

| | GLSL | WGSL |
|---|---|---|
| read a uniform | `myUniform` | `uniforms.myUniform` |
| read a vertex attribute | `uv`, `position` | `vertexInputs.uv` |
| write a varying (vertex) | `vFoo = …;` | `vertexOutputs.vFoo = …;` |
| read a varying (fragment) | `vFoo` | `fragmentInputs.vFoo` |
| declare a varying | `varying vec2 vFoo;` | `varying vFoo: vec2<f32>;` |
| sample a 2D texture | `texture2D(tex, uv)` or `texture(tex, uv)` | `textureSample(tex, texSampler, uv)` |
| sample an array texture | `texture(arr, vec3(uv, layer))` | `textureSample(arr, arrSampler, uv, i32(layer))` |
| declare a sampler | `uniform sampler2D tex;` | `var tex: texture_2d<f32>;` **plus** `var texSampler: sampler;` |
| sRGB → linear | `toLinearSpace(c)` | `toLinearSpaceVec3(c)` |
| local variable | `vec3 v = …;` | `let v = …;` (immutable) / `var v = …;` (mutable) |
| module-scope global | `vec2 _myGlobal;` | `var<private> _myGlobal: vec2<f32>;` |
| vector literal | `vec4(1.0)` | `vec4<f32>(1.0)` or `vec4f(1.0)` |
| discard | `discard;` | `{ discard; }` (statement, needs a block in an `if`) |

Both languages still run Babylon's **preprocessor**, so `#ifdef` / `#ifndef` / `#define` work in WGSL too.

⚠️ **WGSL has no C preprocessor at the language level and no redefinition tolerance.** Declaring the same varying or sampler twice is a hard compile error. Guard shared declarations:

```glsl
#ifndef MY_SHARED_VARYINGS
#define MY_SHARED_VARYINGS
varying vFoo: f32;
#endif
```

⚠️ **GLSL vertex-stage uniforms are NOT auto-declared.** The material auto-emits declarations for the *fragment* shader only. Any uniform you read in the GLSL vertex shader must be declared by hand in `getCustomVertexCode(wgsl)` on the material:

```typescript
public getCustomVertexCode(wgsl: boolean): string {
    if (wgsl) {
        return `varying Splat3UV: vec2<f32>;`;                 // WGSL: uniforms need no declaration
    }
    return `
        #ifdef VERTEXSPLAT
        varying vec2 Splat3UV;
        uniform vec2 Splat3Infos;                              // GLSL: declare it yourself
        uniform mat4 Splat3Matrix;
        #endif
    `;
}
```

### RULE 7 — Gate everything behind a define, and register both classes.

Set `this.shader` in the material constructor. `prepareCustomDefines()` turns it into an UPPERCASE define automatically, and the plugin declares the same symbol in its constructor defaults. **Wrap every injected line in it**, so a scene that never uses your material compiles byte-identical stock shaders.

```typescript
#ifdef MYEFFECT
    surfaceAlbedo = mix(surfaceAlbedo, tint, amount);
#endif
```

Then register **both** classes so scene loading and metadata parsing can find them:

```typescript
TOOLKIT.SceneManager.RegisterClass("PROJECT.MyEffect", MyEffect);
TOOLKIT.SceneManager.RegisterClass("PROJECT.MyEffectPlugin", MyEffectPlugin);
```

Use the `PROJECT.` namespace prefix for project shaders; `TOOLKIT.` is reserved for the runtime's own.

### RULE 8 — Per-frame update rules. These are the real performance traps.

* **`update()` on the material is called once per submesh per draw call — including every shadow pass.** It is NOT once per frame. Accumulating time in it makes animation run N× too fast with N visible chunks, and *change speed as the camera turns* (frustum culling changes N). Guard on the frame id:

```typescript
public update(): void {
    const scene = this.getScene();
    const frame = scene.getFrameId();
    if (this._lastUpdateFrame === frame) return;    // already ran this frame
    this._lastUpdateFrame = frame;
    const dt = Math.min(TOOLKIT.SceneManager.GetDeltaSeconds(scene), 1 / 30);
    this._windTimeAccum += dt;
    this.setFloatValue("g_windTime", this._windTimeAccum);
}
```

* **Do NOT call `uniformBuffer.update()` inside a PBR plugin's `bindForSubMesh`.** The parent PBR material flushes the UBO once at the end of its own bind; an extra flush is 1–2 wasted GPU uploads per draw call whose data is immediately overwritten.
* **Call `markTextureAsRaw(name)` for pure data samplers** (VAT position/normal textures, LUTs, arrays). It skips the per-draw-call `mat4` matrix + `vec2` infos upload — 18 wasted UBO float writes per texture per draw call — for textures that never use Babylon UV transforms.
* Changing a **define** requires `markAsDirty(BABYLON.Constants.MATERIAL_AllDirtyFlag)` + `plugin.markAllDefinesAsDirty()` and recompiles the shader. Changing a **value** does not — prefer a uniform over a define for anything that changes at runtime.
* `CustomShaderMaterial.clone()` preserves the subclass and all custom uniform/sampler/skin state. **Never use plain `BABYLON.PBRMaterial.clone()` on one** — it builds a stock PBRMaterial and drops every hook.

---

## Do not rebuild what already ships

Check this list before writing any shader. These are complete, tested, WebGL+WebGPU implementations in the runtime.

| Need | Use | Notes |
|---|---|---|
| any look authored as a **Unity Shader Graph** (water, foliage wind, toon, dissolve, decals, fullscreen effects, UI effects, sky) | the **Shader Graph transpiler** — the generated `MY.<Graph>` class | see **Unity Shader Graphs — transpiled at export** below; drive it with `setFloat("_Ref", v)` / `TOOLKIT.ShaderGlobals` |
| terrain splatmaps, trees, grass, wind | author a **Unity Terrain** — `TOOLKIT.TerrainBuilder` builds `TOOLKIT.TerrainSplatMaterial`, `GrassStandardMaterial` / `GrassBillboardMaterial` and `TerrainFoliagePlugin` from the export (`unity-authoring-recipes.md` §10) | these are fed by terrain export data (texture arrays, control maps, instance buffers); they are **not** general-purpose materials. A terrain whose material template is a Shader Graph renders through its generated class |
| baked vertex animation (VAT) | `TOOLKIT.VertexAnimationMaterial` + `TOOLKIT.VertexAnimationController` | crowd/instance animation from position+normal textures, clip blending, `play/pause/stop/driveBlend`, `cloneForInstance()` |
| many characters, one mesh, different skins | `enableSkinArray()` on any `CustomShaderMaterial` | see below |
| double-sided surface | `TOOLKIT.CustomShaderMaterial` + `backFaceCulling = false; twoSidedLighting = true;` in `awake()` | no shader code needed at all |
| water | `PROJECT.WaterMaterialSystem` (Starter content), or the scene's own Unity water Shader Graph | wraps `BABYLON.WaterMaterial` (reflection/refraction RTT, wind, waves) |
| Unity-matching atmospheric sky | `TOOLKIT.ProceduralSkyMaterial` on `TOOLKIT.ProceduralSkyMaterial.CreateSkyMesh(name, scene, 1000)` | exact port of Unity `Skybox/Procedural`; the loader builds it for any level whose skybox is Procedural (incl. Unity's Default-Skybox); follows the sun light every frame (`unity-authoring-recipes.md` §7) |
| Preetham sky (not Unity-matching) | `PROJECT.SkyMaterialSystem` (Starter content) | wraps `BABYLON.SkyMaterial` + optional `ReflectionProbe` |
| node-editor material (.json from NME) | `PROJECT.NodeMaterialInstance` script component | `BABYLON.NodeMaterial.Parse`; `PROJECT.NodeMaterialTexture` turns one into a procedural texture |
| shadow-catcher plane | `PROJECT.MobileShadowMaterial` | `BABYLON.ShadowOnlyMaterial` |
| depth-only occluder | `PROJECT.MobileOccludeMaterial` | sets `disableColorWrite` |
| separate diffuse/specular IBL | `mat.splitLighting(diffuse, specular)` | built into every `CustomShaderMaterial` via `UnityStyleLightingPlugin` |

### Per-skin Texture2DArray switching (no shader authoring required)

One shared mesh, an N-layer texture array, a different skin per mesh or per instance. Surface UVs are used as-is — no atlas remap, so every skin keeps full resolution and its own clean mip chain.

```typescript
mat.addTextureArrayUniform("tkAlbedoArray", albedoArray);
mat.enableSkinArray(/* layerUniform */ true);
mat.setSkinLayer(3);                        // shared uniform: one skin for the whole mesh

// per-instance instead:
mat.addTextureArrayUniform("tkAlbedoArray", albedoArray);
mat.enableSkinArray(false);
mesh.registerInstancedBuffer("tkSkinLayer", 1);
inst.instancedBuffers.tkSkinLayer = 3;
```

Channels are independent and combinable — `enableSkinArrayNormal()` (`tkNormalArray`, needs a tangent frame: BUMP + TANGENT + NORMAL), `enableSkinArrayMetalRough()` (`tkMetalRoughArray`, metallic = Blue, roughness = Green), `enableSkinArrayEmissive()` (`tkEmissiveArray`, works with no base emissive, so it drives emissive-only swaps like brake lights). Every injected line is gated, so a material that never opts in compiles identically.

For VAT materials use the `enableVatSkinArray*()` variants instead: the layer is packed into the existing `g_vatAnim1.w` attribute (VAT instances are already at the vertex-buffer ceiling), and set per instance with `TOOLKIT.VertexAnimationController.SetAtlasCellIndex(mesh, index)`.

---

## Unity Shader Graphs — transpiled at export

Unity ships most custom looks as Shader Graphs: water, wind-swept grass and foliage, SpeedTree, toon, dissolve, decals,
fullscreen effects, UI effects, TextMesh Pro SDF text, terrain templates and skies. The exporter's **Shader Graph
transpiler** turns every graph into a generated BabylonJS material class at export time. **The goal is that Unity
content using Shader Graphs exports and renders out of the box. Do not hand-port a graph.**

### How a graph reaches BabylonJS

| Step | What happens |
|---|---|
| Discovery | Every export path except Launch (level, selection, prefab / asset container) sweeps active **and inactive** renderers, terrain templates and prototypes, prefabs referenced by exported components, the skybox, uGUI, particle and trail materials, Custom Render Textures and fullscreen renderer features |
| Transpile | Each graph becomes `Assets/Scripts/Materials/Generated/<GraphName>.ts`: a `MY.<GraphName>` material (`TOOLKIT.CustomShaderMaterial` + `MY.<GraphName>Plugin`, GLSL **and** WGSL), registered with `RegisterClass`. A name starting with a digit gets an `Sg` prefix (`MY.Sg0_Lit_Basic`); duplicate names get `_2`, `_3` |
| Target | The graph is generated for the **project's active render pipeline**, whatever targets it declares. Dead nodes, unused properties and greyed-out blocks are pruned first, exactly as Unity compiles only what reaches an active block |
| Compile | UMD: the project bundle recompiles whenever the transpiler wrote files or the bundle lacks a generated class. ESM: the generated classes compile alone into `<scene dir>/shadergraphs.js`, which the runtime loads before any material. `bt_export_level` defaults `compileScripts` to true for this reason |
| glTF | The material's `extras.metadata` carries `customMaterial: "MY.<GraphName>"` plus the property bags (`customFloats`, `customColors`, `customVectors`, `customTextures`, `customMatrices`); keyword values ride as `customFloats["kw_<REF>"]`. Scene metadata carries `shaderglobals`, `renderfeatures`, `customrendertextures`, `lights2d` and per-renderer property blocks |

**Generated files are build output.** Never edit them (each has a `GENERATED … do not edit (hash …)` header); change the
graph in Unity and re-export. To opt one graph out on purpose, add `{ "<graphPath>": "<reason>" }` to
`Generated/overrides.json`.

### The degrade ladder — a gap never kills a graph

Every node, block, property, keyword and custom-function construct is handled **at its own position**:
**faithful port → polyfill** (closest WebGL2 + WebGPU behaviour) **→ neutral value** (pass-through of the primary input,
else the slot's Unity default). Every step other than a port is a **deviation**, reported:

- in the export summary — one count line (`N graphs transpiled: a clean, b with deviations, c last resort`) plus one
  block per graph with deviations, in plain language;
- in `Assets/Scripts/Materials/Generated/manifest.json`;
- on the class (`SgInfo.deviations`, `material.getGraphInfo()`), shown read-only in the Babylon Inspector as
  "Shader Graph deviations";
- in the browser, one collapsed `Shader Graph: N materials with deviations, M last resort` console group per scene in
  debug mode (`TOOLKIT.ShaderGraphRuntime.ReportDeviations`; `null` = follow `SceneManager.IsDebugMode()`).

**Plain PBR is the last resort only** for an unreadable graph file (export) or a generated shader that fails to compile
on the device (runtime). At runtime the material disables its graph in place, so the mesh still renders with its glTF
PBR inputs and one warning names the error; check `material.graphDisabled` / `graphDisabledReason`. A class missing
from the bundle renders with the `TOOLKIT.UniversalShaderMaterial` stand-in, and one warning says to re-export with
`compileScripts`.

### What renders

| Area | Coverage |
|---|---|
| Sub-targets | **URP:** Lit (Metallic **and** Specular), Unlit, Sprite Lit / Unlit / Custom Lit, Decal, Fullscreen, Canvas, Six Way, Terrain Lit. **Built-in:** Lit, Unlit, Canvas. **HDRP:** Lit (every material type), StackLit, Hair, Fabric, Eye, Unlit, Decal, Fullscreen, Canvas, Six Way, Fog Volume, Physically Based Sky, Terrain Lit. Custom Render Texture target. VFX-target graphs render as Lit / Unlit on ordinary meshes |
| Lighting | Generated Lit classes use their **pipeline's** response (`TOOLKIT.PipelineLightingPlugin` modes `urp`, `builtin`, `hdrp`, `sixway`); Hair, Eye, Fabric and StackLit use `TOOLKIT.GraphLightingExtension` |
| Nodes | Every Unity node except the HDRP Water simulation nodes. Virtual textures are baked to plain textures, tessellation becomes export-time subdivision, URP 2D Light Texture is a screen-space light-accumulation texture, UI element nodes are fed by the element being drawn |
| Properties | Float, Vector 2/3/4, Color, Boolean, Texture 2D / 2D Array / 3D / Cubemap, Gradient, Matrix, Sampler State, Dropdown, **Global** and **Hybrid Per Instance** scope, Tiling & Offset and Texel Size |
| Keywords | Material-local `shader_feature` keywords compile as variants; global, `multi_compile` and script-toggled keywords branch at runtime; pipeline keywords resolve from the scene |
| Custom Function nodes | A toolkit HLSL-subset compiler: control flow, structs, helper functions, `#include` of project and package `.hlsl`, int and bit operations, texture macros and Unity's ShaderLibrary (`GetMainLight`, `GetAdditionalLight`, `SampleSH`, space transforms, depth helpers, …). An unresolved `#if` takes the `#else` branch, as a deviation |
| Old graphs | Pre-v10 single-JSON graphs, sub-graphs and the FBX-importer graphs load |

**Renderers Babylon lacks are exported as carriers** that host the graph (any graph or plain material):

| Unity | Runtime class |
|---|---|
| `DecalProjector` (URP / HDRP) | `TOOLKIT.DecalProjector` — receiver triangles clipped in Unity's decal space, angle / distance fade, rendering layers; rebuilt when the projector or a receiver moves. A scene with no decal renderer feature draws nothing (warned) |
| URP Full Screen Pass renderer feature, HDRP fullscreen Custom Pass | A post-process from `TOOLKIT.ShaderGraphPass`, ordered before or after the toolkit post-processing chain as Unity injects it |
| Custom Render Texture with a graph material | `TOOLKIT.ShaderGraphRenderTexture` — GPU updates OnLoad / Realtime / period / OnDemand, double-buffered Self |
| Skybox material that is a graph | `TOOLKIT.ShaderGraphSky` — draws on Unity's own sky mesh; adds a live environment probe when no baked environment exists |
| HDRP Fog Volume graph | `TOOLKIT.ShaderGraphFogVolume` (raymarched, no volumetric shadows) |
| `SpriteRenderer`, `TilemapRenderer`, `LineRenderer`, `TrailRenderer` | `TOOLKIT.SpriteRenderer` / `TilemapRenderer` / `LineRenderer` / `TrailRenderer`; non-graph materials draw unlit, vertex-coloured and alpha-blended |
| Particle system with a graph material | `TOOLKIT.ShurikenParticles` draws through the generated class with Unity's vertex streams |
| uGUI Image / RawImage / TMP with a Canvas graph | Rendered per element to a texture inside the Unity UI pipeline (TMP SDF graphs: face / outline / underlay polyfill) |
| Terrain `materialTemplate` graph | `TOOLKIT.TerrainGraphAdapter` — the terrain's layers, splat maps and holes feed Terrain Texture / Terrain Properties nodes |
| SpeedTree 8 wind | `TOOLKIT.SpeedTreeWind` drives the graph's wind uniforms |

### Driving graphs from game code

Names are always the graph property's **Unity reference name** (`_BaseColor`, `_DissolveAmount`), not its display name.

```typescript
// One material (any generated MY.* class is a TOOLKIT.CustomShaderMaterial)
const mat = mesh.material as TOOLKIT.CustomShaderMaterial;
mat.setFloat("_DissolveAmount", 0.4);
mat.setColor("_EdgeColor", new BABYLON.Color3(1, 0.4, 0));      // converted to linear, as Unity does
mat.setVector("_WindDirection", new BABYLON.Vector3(1, 0, 0));
mat.setTexture("_MaskTex", maskTexture);
mat.enableKeyword("_USE_RIM");                                 // compile-time variants rebuild the effect once
const amount = mat.getFloat("_DissolveAmount");

// Engine-wide globals: Unity's Shader.SetGlobal* / Shader.EnableKeyword
TOOLKIT.ShaderGlobals.SetGlobalFloat("_TransitionProgress", 0.5);
TOOLKIT.ShaderGlobals.SetGlobalColor("_FogTint", new BABYLON.Color3(0.5, 0.6, 0.7));
TOOLKIT.ShaderGlobals.SetGlobalTexture("_RippleMap", rippleTexture);
TOOLKIT.ShaderGlobals.EnableKeyword("_RAIN_ON");               // enum keyword entry: "<REF>_<ENTRY>"

// A fullscreen graph a script drives (e.g. a transition blit)
const fx = TOOLKIT.ShaderGraphFullscreen.Create(scene, "MY.FullscreenTransition", { injection: "afterPost" });
fx.pass.setFloat("_Progress", 0.0);
// ... later: fx.dispose();

// An On Demand Custom Render Texture
TOOLKIT.ShaderGraphRenderTexture.Update(scene, "RippleCRT");
```

| API | Notes |
|---|---|
| `setFloat` / `setVector` / `setColor` / `setTexture` / `setMatrix`, `get*`, `enableKeyword` / `disableKeyword` / `isKeywordEnabled` | On every generated material and on `ShaderGraphPass` (fullscreen, CRT, UI hosts). `clone()` keeps the full graph state; never clone through `BABYLON.PBRMaterial.clone()` |
| `TOOLKIT.ShaderGlobals.SetGlobalFloat/Vector/Color/Texture/Matrix`, `Get*`, `EnableKeyword` / `DisableKeyword` / `IsKeywordEnabled` | Engine-wide, keyed by reference name. Every graph material reading the global updates the next frame. The values Unity held at export are pre-loaded |
| `TOOLKIT.ShaderGlobals.GetClock(scene)` | `{ time, deltaTime, smoothDeltaTime, frame }`, Unity's `_Time`. One clock per scene, so all graph materials animate in lockstep and never pause while hidden |
| `TOOLKIT.ShaderGraphFullscreen.Create(scene, className, { camera?, injection?: "beforePost" \| "afterPost", block? })` | Returns `{ pass, postProcess, enabled, dispose() }` |
| `TOOLKIT.ShaderGraphRenderTexture.Update(scene, name, count?)`, `Initialize`, `Get`, `WhenReady` | Custom Render Textures |
| `TOOLKIT.ShaderGraphRuntime.CreateMaterialFromBlock(scene, { customMaterial: "MY.X", customFloats, … }, name)` | Build a graph material without a glTF |
| `TOOLKIT.ShaderGraphRuntime.SetThinInstanceValue(mesh, index, key, value)` | Hybrid Per Instance properties on thin instances (`EnsureThinInstanceBuffers(mesh)` first) |
| `TOOLKIT.SgShadowDepth.Enabled` | **Default `false`.** Shadows and the depth pass use Babylon's stock depth shader, so wind / vertex displacement and graph clip do **not** show in shadows. Set it to `true` **before the scene loads** only when displaced shadows matter; it costs a full material bind per shadow draw (≈16 ms/frame on a 290-material vegetation scene) and swaying shadows can flicker under TAA |

MaterialPropertyBlocks are applied automatically per renderer (as clones named `<material>#mpb<meshId>`).

### Gotchas

- **Re-export after editing a graph**, with script compilation on. A stale bundle shows the plain-PBR stand-in plus the
  missing-class warning; in ESM, `shadergraphs.js` must sit beside the scene.
- **Sampler budget:** WebGPU allows 16 samplers per stage. The runtime drops stock textures the graph never reads,
  strips dead graph code, shares samplers with the same state, and only then reads the remaining graph textures as
  neutral values (each reported as a `budget` deviation). Graphs with 13+ textures should be simplified in Unity.
- **Scene Color / Scene Depth nodes** cost an opaque-scene render target / depth renderer per camera. Use them on water
  and glass, not everywhere.
- **Babylon's rough-IBL / irradiance mix is off** on every toolkit material (`mixIblRadianceWithIrradiance = false`) to
  match Unity; do not turn it back on.
- **Performance:** check frame time on the heaviest scene after adding many graph materials.

### Known limits — do not over-promise

| Area | Status |
|---|---|
| VFX Graph assets | Not exported. Use a Babylon substitute (`unity-authoring-recipes.md` §22) |
| HDRP | Graphs load and compile, but HDRP visual parity is incomplete: **water surfaces do not render**, the Physically Based Sky atmosphere draws nothing, fog-volume looks are approximate |
| Clear coat | Environment term not ported (slightly bright under the probe) |
| Subsurface | An in-shader per-light wrap polyfill, not Babylon subsurface |
| Hair | Marschner is close; cinematic hair is treated as non-cinematic |
| Tessellation | Flat export-time subdivision; Phong is approximated; skinned and blend-shape meshes are not subdivided |
| Decals | A static projector does not pick up receivers that move in later; channel toggles are approximate |
| 2D | Light2D sorting-layer targeting is ignored; SpriteMask is not drawn |
| UI | UI Toolkit SDF text / gradient and uGUI TMP graphs are polyfills |
| SpeedTree | Leaves render slightly bright; `SpeedTreeWind` stands in for the UV3 wind data glTF drops |
| Smaller substitutions | MirrorOnce → Mirror; Exposure previous-frame = current; LOD crossfade fixed off |

---

## Complete minimal example

A vertex-color splat blend: mixes a second texture over the PBR albedo using the vertex-color blue channel. Both languages, gated, registered.

```typescript
import * as BABYLON from "@babylonjs/core";
import * as TOOLKIT from "@babylonjs-toolkit/next";

export class VertexSplat extends TOOLKIT.CustomShaderMaterial {

    public constructor(name: string, scene: BABYLON.Scene) {
        super(name, scene);
        this.shader = this.getShaderName();            // -> the VERTEXSPLAT define
        this.plugin = new VertexSplatPlugin(this, this.shader);

        this.addTextureUniform("Splat3", null);        // + Splat3Infos, Splat3Matrix
        this.addVector4Uniform("ColorC", new BABYLON.Vector4(1, 1, 1, 1));
        this.addFloatUniform("IntensityA", 1.0);
        this.addFloatUniform("IntensityC", 1.0);
    }

    public awake(): void { /* one-time init */ }
    public update(): void { /* per-bind value updates — see RULE 8 */ }

    public getShaderName(): string { return "VertexSplat"; }

    public getCustomVertexCode(wgsl: boolean): string {
        if (wgsl) return `varying Splat3UV: vec2<f32>;`;
        return `
            #ifdef VERTEXSPLAT
            varying vec2 Splat3UV;
            uniform vec2 Splat3Infos;
            uniform mat4 Splat3Matrix;
            #endif
        `;
    }
}

export class VertexSplatPlugin extends TOOLKIT.CustomShaderMaterialPlugin {

    public constructor(customMaterial: TOOLKIT.CustomShaderMaterial, shaderName: string) {
        super(customMaterial, shaderName, 100, { VERTEXSPLAT: false });
    }

    public isCompatible(shaderLanguage: BABYLON.ShaderLanguage): boolean {
        return (shaderLanguage === BABYLON.ShaderLanguage.WGSL || shaderLanguage === BABYLON.ShaderLanguage.GLSL);
    }

    public getCustomCode(shaderType: string, shaderLanguage: BABYLON.ShaderLanguage): any {
        const wgsl: boolean = (shaderLanguage === BABYLON.ShaderLanguage.WGSL);

        if (shaderType === "vertex") {
            return {
                CUSTOM_VERTEX_DEFINITIONS: this.vertexDefinitions,
                CUSTOM_VERTEX_MAIN_END: wgsl ? `
                    #ifdef VERTEXSPLAT
                    vertexOutputs.Splat3UV = (uniforms.Splat3Matrix * vec4<f32>(vertexInputs.uv, 1.0, 0.0)).xy;
                    #endif
                ` : `
                    #ifdef VERTEXSPLAT
                    Splat3UV = vec2(Splat3Matrix * vec4(uv, 1.0, 0.0));
                    #endif
                `,
            };
        }

        if (shaderType === "fragment") {
            return {
                CUSTOM_FRAGMENT_DEFINITIONS: wgsl
                    ? (this.fragmentDefinitions || "") + `varying Splat3UV: vec2<f32>;`
                    : `#ifdef VERTEXSPLAT
                       varying vec2 Splat3UV;
                       #endif`,
                CUSTOM_FRAGMENT_BEFORE_LIGHTS: wgsl ? `
                    #ifdef VERTEXSPLAT
                    #if defined(VERTEXCOLOR) || defined(INSTANCESCOLOR) && defined(INSTANCES)
                        var base: vec3<f32> = surfaceAlbedo * uniforms.IntensityA;
                        var raw: vec4<f32> = textureSample(Splat3, Splat3Sampler, fragmentInputs.Splat3UV);
                        raw = vec4<f32>(pow(raw.rgb, vec3<f32>(2.2)), raw.a);
                        let overlay: vec4<f32> = raw * uniforms.ColorC * uniforms.IntensityC;
                        surfaceAlbedo = mix(overlay.rgb, base, fragmentInputs.vColor.b);
                    #endif
                    #endif
                ` : `
                    #ifdef VERTEXSPLAT
                    #if defined(VERTEXCOLOR) || defined(INSTANCESCOLOR) && defined(INSTANCES)
                        vec3 base = surfaceAlbedo.rgb * IntensityA;
                        vec4 raw = texture2D(Splat3, Splat3UV);
                        raw = vec4(pow(raw.rgb, vec3(2.2)), raw.a);
                        vec4 overlay = raw * ColorC * IntensityC;
                        surfaceAlbedo.rgb = mix(overlay.rgb, base, vColor.b);
                    #endif
                    #endif
                `,
            };
        }
        return null;
    }

    // --- RULE 4 boilerplate ---

    public getUniforms(shaderLanguage: BABYLON.ShaderLanguage): any {
        const wgsl: boolean = (shaderLanguage === BABYLON.ShaderLanguage.WGSL);
        this.vertexDefinitions = this.getCustomShaderMaterial().getCustomVertexCode(wgsl);
        this.fragmentDefinitions = (wgsl === true) ? this.getCustomShaderMaterial().getCustomFragmentCode(wgsl) : null;
        return this.getCustomShaderMaterial().getCustomUniforms(wgsl);
    }

    public getSamplers(samplers: string[]): void {
        const s: string[] = this.getCustomShaderMaterial().getCustomSamplers();
        if (s != null && s.length > 0) samplers.push(...s);
    }

    public getAttributes(attributes: string[], scene: BABYLON.Scene, mesh: BABYLON.AbstractMesh): void {
        const a: string[] = this.getCustomShaderMaterial().getCustomAttributes();
        if (a != null && a.length > 0) attributes.push(...a);
    }

    public prepareDefines(defines: BABYLON.MaterialDefines, scene: BABYLON.Scene, mesh: BABYLON.AbstractMesh): void {
        if (!this.getIsEnabled()) return;
        this.getCustomShaderMaterial().prepareCustomDefines(defines);
    }

    public bindForSubMesh(uniformBuffer: BABYLON.UniformBuffer, scene: BABYLON.Scene, engine: BABYLON.AbstractEngine, subMesh: BABYLON.SubMesh): void {
        if (!this.getIsEnabled()) return;
        this.getCustomShaderMaterial().updateCustomBindings(uniformBuffer);
    }
}

TOOLKIT.SceneManager.RegisterClass("PROJECT.VertexSplat", VertexSplat);
TOOLKIT.SceneManager.RegisterClass("PROJECT.VertexSplatPlugin", VertexSplatPlugin);
```

Note the sRGB `pow(rgb, 2.2)` on the overlay: albedo lives in **linear** space inside the PBR shader, so any sRGB-authored texture you sample yourself must be linearized before it is mixed in.

---

## Compliance checklist — verify every one before finishing

1. No `BABYLON.ShaderMaterial`, no `ShadersStore`, no `ShaderStore` anywhere in the generated code.
2. A material class **and** a plugin class, extending the toolkit base classes.
3. `isCompatible()` returns true for **both** `WGSL` and `GLSL`.
4. `getCustomCode()` returns working source for **both** languages, for every hook used.
5. `getUniforms`, `getSamplers`, `getAttributes`, `prepareDefines`, `bindForSubMesh` are all present, verbatim.
6. Every uniform/sampler/attribute is declared on the material, not just used in the shader string.
7. GLSL vertex-stage uniforms are declared by hand in `getCustomVertexCode`.
8. All injected code is wrapped in the material's `#ifdef`.
9. Shared WGSL varying/sampler declarations are `#ifndef`-guarded against redefinition.
10. `CUSTOM_FRAGMENT_BEFORE_FINALCOLORCOMPOSITION` is used only on a PBR material (`CUSTOM_FRAGMENT_BEFORE_FOG` for Standard).
11. Any per-frame time accumulation in `update()` is frame-id guarded.
12. Both classes are passed to `TOOLKIT.SceneManager.RegisterClass`.
13. Nothing on the "do not rebuild" list was reimplemented from scratch.
14. No look that exists as a Unity Shader Graph was hand-ported, and no generated `MY.*` file under `Materials/Generated/` was edited.
15. Graph properties and keywords are set by their Unity **reference** names, through `setFloat` / `enableKeyword` or `TOOLKIT.ShaderGlobals`.
