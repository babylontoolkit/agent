# Custom Shader Code Instructions (2.0.0)

**IMPORTANT. THIS DOCUMENT PROVIDES CRUCIAL SHADER CODE GENERATION INSTRUCTIONS. ALWAYS READ THIS ENTIRE DOCUMENT TO THE END OF FILE**

* Always reference the `Babylon Toolkit Component Reference` at https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/README.md for details regarding the script component model api.
* For SETTING uniform values on a material that already exists, use `Babylon Toolkit Materials` at https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/08-Materials.md. **This document is about AUTHORING a new custom shader material.**
* Important: Always use the default ES6 versions of BabylonJS, Babylon Toolkit, Babylon Toolkit React Framework and Babylon Toolkit Starter Projects, unless otherwise instructed to use the UMD versions.

---

## Follow these rules exactly when generating custom shader code

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

Priorities in the shipped runtime — pick a number that does not fight them: `UnityStyleLightingPlugin` 10, `SkinArraySwitchingPlugin` 21, project/terrain effects 100, vegetation 110.

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
| terrain with splatmaps | `TOOLKIT.UniversalTerrainMaterial` | Unity-style splatmap **atlas** blending, up to 4 layers per splatmap × N splatmaps, albedo + normal + parallax + clearcoat aware |
| waving grass patches | `TOOLKIT.GrassStandardMaterial` | exact Unity `TerrainWaveGrass` (Taylor-series `FastSinCos`), distance fade, alpha cutoff, shadow-intensity control |
| camera-facing grass | `TOOLKIT.GrassBillboardMaterial` | billboard variant of the above |
| swaying tree branches | `TOOLKIT.TreeBranchMaterial` | local-space pivot bend, vertex-color mask, `setWindDirection(x, y, z)` |
| baked vertex animation (VAT) | `TOOLKIT.VertexAnimationMaterial` + `TOOLKIT.VertexAnimationController` | crowd/instance animation from position+normal textures, clip blending, `play/pause/stop/driveBlend`, `cloneForInstance()` |
| many characters, one mesh, different skins | `enableSkinArray()` on any `CustomShaderMaterial` | see below |
| double-sided surface | `TOOLKIT.CustomShaderMaterial` + `backFaceCulling = false; twoSidedLighting = true;` in `awake()` | no shader code needed at all |
| water | `PROJECT.WaterMaterialSystem` script component | wraps `BABYLON.WaterMaterial` (reflection/refraction RTT, wind, waves) |
| sky | `PROJECT.SkyMaterialSystem` script component | wraps `BABYLON.SkyMaterial` + optional `ReflectionProbe` |
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
