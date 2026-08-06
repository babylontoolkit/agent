# TOOLKIT.CustomShaderMaterial — Agent Reference

> **Extends:** `BABYLON.PBRMaterial`  
> **Namespace:** `TOOLKIT`  
> **Role:** PBR material extended with custom GLSL (WebGL) or WGSL (WebGPU) uniforms. Also hosts the `UnityStyleLightingPlugin`. Used when Unity exports a custom shader/material that has non-standard uniform inputs not covered by standard PBR properties.

---

## Import

```typescript
import * as TOOLKIT from "@babylonjs-toolkit/next";
// named imports are equivalent: import { CustomShaderMaterial, SceneManager } from "@babylonjs-toolkit/next";
```

---

## Class Declaration

```typescript
class CustomShaderMaterial extends BABYLON.PBRMaterial {
    // Access from a mesh
    const mat = mesh.material as TOOLKIT.CustomShaderMaterial;
}
```

---

## Getting the Material

```typescript
// From a mesh
const mesh = TOOLKIT.SceneManager.GetAbstractMesh(scene, "Character");
const mat  = mesh.material as TOOLKIT.CustomShaderMaterial;

// Or from metadata
const matData = this.getProperty<TOOLKIT.IUnityMaterial>("material");
const mat = scene.getMaterialByName(matData.name) as TOOLKIT.CustomShaderMaterial;
```

---

## Texture Uniforms

```typescript
// Register a new texture uniform slot
mat.addTextureUniform(name: string, texture: BABYLON.BaseTexture): void

// Update an existing texture uniform at runtime
mat.setTextureValue(name: string, texture: BABYLON.BaseTexture): void

// Flag that a texture should NOT be auto-converted from sRGB
mat.markTextureAsRaw(name: string): void

// Example
mat.addTextureUniform("_OverlayTex", overlayTexture);
mat.setTextureValue("_OverlayTex", newOverlay);
```

---

## Float Uniforms

```typescript
mat.addFloatUniform(name: string, value: number): void
mat.setFloatValue(name: string, value: number): void

// Example — dissolve effect
mat.addFloatUniform("_DissolveAmount", 0.0);

// Animate in update():
this.dissolve += this.getDeltaSeconds() * 0.5;
mat.setFloatValue("_DissolveAmount", BABYLON.Scalar.Clamp(this.dissolve, 0, 1));
```

---

## Vector Uniforms

```typescript
// Vector2
mat.addVector2Uniform(name: string, value: BABYLON.Vector2): void
mat.setVector2Value(name: string, value: BABYLON.Vector2): void

// Vector3
mat.addVector3Uniform(name: string, value: BABYLON.Vector3): void
mat.setVector3Value(name: string, value: BABYLON.Vector3): void

// Vector4
mat.addVector4Uniform(name: string, value: BABYLON.Vector4): void
mat.setVector4Value(name: string, value: BABYLON.Vector4): void

// Example — UV scroll
mat.addVector2Uniform("_TexScrollSpeed", new BABYLON.Vector2(0.1, 0.0));

protected update(): void {
    this.uvOffset.x += this.getDeltaSeconds() * 0.1;
    mat.setVector2Value("_TexScrollSpeed", this.uvOffset);
}
```

---

## Boolean Uniforms

```typescript
mat.addBoolUniform(name: string, value: boolean): void
mat.setBoolValue(name: string, value: boolean): void

// Example — enable emission overlay on hit
mat.addBoolUniform("_IsHit", false);
mat.setBoolValue("_IsHit", true);
// ... reset after 0.1s
```

---

## Lighting Split (Advanced)

Adjusts the diffuse and specular IBL (image-based lighting) contribution factors independently.

```typescript
mat.splitLighting(diffuseIbl: number, specularIbl: number): void
```

---

## Unity Style Lighting Plugin

All `CustomShaderMaterial` instances have `UnityStyleLightingPlugin` attached by default. This adds:
- SH ambient lighting matching Unity's GI
- Directional light as the primary light
- Point lights with Unity-compatible attenuation

You do not need to configure this — it is automatic.

---

## IUnityMaterial Interface

When Unity exports a material reference in a script property, it arrives as `IUnityMaterial`:

```typescript
interface IUnityMaterial {
    type: string;       // "Material"
    id: string;         // Unity asset id
    name: string;       // material asset name (use with scene.getMaterialByName)
    shader: string;     // Unity shader name
    gltf: number;       // glTF material index
}
```

---

## IUnityTexture Interface

When Unity exports a texture reference, it arrives as `IUnityTexture`:

```typescript
interface IUnityTexture {
    type: string;       // "Texture2D" | "RenderTexture" | etc.
    name: string;
    width: number;
    height: number;
    filename: string;
    wrapmode: string;
    filtermode: string;
    anisolevel: number;
}
```

---

## Dissolve / Damage Flash — Full Example

```typescript
namespace TOOLKIT {
    export class MaterialEffects extends TOOLKIT.ScriptComponent {
        private mat: TOOLKIT.CustomShaderMaterial = null;
        private flashTimer: number = 0;

        constructor(t: BABYLON.TransformNode, s: BABYLON.Scene, p: any = {}) {
            super(t, s, p, "TOOLKIT.MaterialEffects");
        }

        protected awake(): void {
            const mesh = this.getAbstractMesh();
            if (mesh?.material instanceof TOOLKIT.CustomShaderMaterial) {
                this.mat = mesh.material as TOOLKIT.CustomShaderMaterial;
                // Register custom uniforms
                this.mat.addFloatUniform("_DissolveAmount", 0.0);
                this.mat.addBoolUniform("_IsHit", false);
            }
        }

        protected update(): void {
            if (!this.mat) return;
            // Tick down flash timer
            if (this.flashTimer > 0) {
                this.flashTimer -= this.getDeltaSeconds();
                if (this.flashTimer <= 0) {
                    this.mat.setBoolValue("_IsHit", false);
                }
            }
        }

        public flashDamage(duration: number = 0.1): void {
            this.mat?.setBoolValue("_IsHit", true);
            this.flashTimer = duration;
        }

        public startDissolve(speed: number = 1.0): void {
            let t = 0;
            const dissolveUpdate = this.scene.onBeforeRenderObservable.add(() => {
                t += this.getDeltaSeconds() * speed;
                this.mat?.setFloatValue("_DissolveAmount", BABYLON.Scalar.Clamp(t, 0, 1));
                if (t >= 1.0) {
                    this.scene.onBeforeRenderObservable.remove(dissolveUpdate);
                    TOOLKIT.SceneManager.SafeDestroy(this.transform, 100);
                }
            });
        }
    }
}
```

---

## Notes For AI Agents

1. **Uniform names must match the GLSL/WGSL shader exactly** — including underscores (`_DissolveAmount` not `dissolveAmount`).
2. **`addXxxUniform` must be called before `setXxxValue`** — registration happens once (in `awake`), updates happen in `update`.
3. **Float uniforms** are the most common — position, time, strength, blend factors.
4. **PBR base properties** — all standard `BABYLON.PBRMaterial` properties (`albedoTexture`, `metallic`, `roughness`, `emissiveColor`, etc.) work normally on `CustomShaderMaterial` since it extends PBR.
5. **WebGPU** — use WGSL; **WebGL** — use GLSL. The shader plugin detects the backend automatically.
