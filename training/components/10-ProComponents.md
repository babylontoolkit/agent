# Pro Components Reference

> This document covers: `PostProcessor`, `TerrainBuilder`, `ShurikenParticles`, `WebVideoPlayer`, and Unity GUI Controls (`UnitySlider`, `UnityScrollBar`, `UnityDropdownMenu`).

---

## Import

```typescript
import * as TOOLKIT from "@babylonjs-toolkit/next";
// named imports are equivalent:
// import { PostProcessor, TerrainBuilder, ShurikenParticles, WebVideoPlayer, UnitySlider, UnityScrollBar, UnityDropdownMenu } from "@babylonjs-toolkit/next";
// ⚠️ Do NOT import from "@babylonjs-toolkit/next/shurikenparticles" or "/webvideoplayer" — those subpaths are broken; use the root import.
```

---

## TOOLKIT.PostProcessor

> **Namespace:** `TOOLKIT`  
> **Role:** Post-processing volume controller. Parses Unity URP Volume exported settings and creates the appropriate Babylon.js pipeline objects.

### Singleton Access
```typescript
const pp = TOOLKIT.PostProcessor.Instance;
```

### Key Accessors
```typescript
pp.scene                        // BABYLON.Scene (inherited from ScriptComponent)
pp.GetDefaultRenderPipeline()   // BABYLON.DefaultRenderingPipeline (main pipeline)
pp.GetSSAORRenderPipeline()     // BABYLON.SSAORenderingPipeline
pp.GetSSRRenderPipeline()       // BABYLON.SSRRenderingPipeline
```

### Configuring Post Effects at Runtime

The pipeline is built from Unity metadata, but you can modify properties at runtime:

```typescript
const pipeline = pp.GetDefaultRenderPipeline();

// Bloom
pipeline.bloomEnabled = true;
pipeline.bloomThreshold = 0.8;
pipeline.bloomWeight = 0.3;
pipeline.bloomKernel = 64;
pipeline.bloomScale = 0.5;

// Depth of Field
pipeline.depthOfFieldEnabled = true;
pipeline.depthOfField.focusDistance = 2000;  // mm
pipeline.depthOfField.focalLength = 50;
pipeline.depthOfField.fStop = 1.4;

// Chromatic Aberration
pipeline.chromaticAberrationEnabled = true;
pipeline.chromaticAberration.aberrationAmount = 30;

// Grain
pipeline.grainEnabled = true;
pipeline.grain.intensity = 20;
pipeline.grain.animated = true;

// Sharpening
pipeline.sharpenEnabled = true;
pipeline.sharpen.edgeAmount = 0.3;

// Vignette
pipeline.imageProcessing.vignetteEnabled = true;
pipeline.imageProcessing.vignetteWeight = 1.5;
pipeline.imageProcessing.vignetteCameraFov = 0.5;

// Color Grading (LUT)
pipeline.imageProcessing.colorGradingEnabled = true;
pipeline.imageProcessing.colorGradingTexture = new BABYLON.ColorGradingTexture("lut.png", scene);
```

### SSAO
```typescript
const ssao = pp.GetSSAORRenderPipeline();
ssao.radius = 2.0;
ssao.totalStrength = 1.0;
ssao.fallOff = 0.000001;
ssao.base = 0.1;
```

### Unity-Exported Volume Effects

These are automatically parsed from `node.metadata.toolkit.postprocessing`:
- `colorgrading` → `imageProcessing` color grading + tone mapping
- `ambientocclusion` → SSAO2
- `screenspacereflections` → SSR pipeline
- `bloom` → pipeline bloom
- `chromaticaberration` → chromatic aberration
- `depthoffield` → DOF
- `grain` → grain
- `lensdistortion` → barrel distortion
- `motionblur` → motion blur
- `vignette` → vignette
- `sharpen` → sharpen
- `autoexposure` → eye adaptation

---

## TOOLKIT.TerrainBuilder

> **Extends:** `TOOLKIT.ScriptComponent`  
> **Role:** Runtime renderer for Unity terrain — grass layers, detail meshes, and tree billboards.

### Static Configuration (set before scene load)

```typescript
// Grass
TOOLKIT.TerrainBuilder.grassHeightScale     // number (default 1.0) — world scale of grass height
TOOLKIT.TerrainBuilder.grassRandomFlip      // boolean (default true) — randomly mirror grass quads

// Detail mesh chunks
TOOLKIT.TerrainBuilder.detailChunkMode      // number — 0 = static instances, 1 = dynamic
TOOLKIT.TerrainBuilder.detailChunkWorldSize // number — chunk size in world units
TOOLKIT.TerrainBuilder.meshDetailChunkTargetInstances  // number — target instances per chunk
```

### Instance API

> ⚠️ `TerrainBuilder` exposes **no** public instance query methods — there is no `getTerrain()`,
> `getTerrainData()`, or `getHeightAtPoint()`. The class is driven entirely by the static
> configuration fields above plus the exported terrain metadata. To place objects on the ground
> at runtime, raycast down against the terrain mesh instead:

```typescript
const ray = new BABYLON.Ray(new BABYLON.Vector3(spawnX, 1000, spawnZ), BABYLON.Vector3.Down(), 2000);
const hit = scene.pickWithRay(ray, (m) => m.isPickable);
if (hit?.pickedPoint) spawnNode.position.set(spawnX, hit.pickedPoint.y + 0.5, spawnZ);
```

---

## TOOLKIT.ShurikenParticles

> **Extends:** `TOOLKIT.ScriptComponent`  
> **Role:** Unity Shuriken particle system runtime. Reads exported metadata and creates a `BABYLON.ParticleSystem` with Unity-compatible defaults.

### Accessing the Particle System

```typescript
const particles: TOOLKIT.ShurikenParticles = TOOLKIT.SceneManager.FindScriptComponent(
    emitterNode, "TOOLKIT.ShurikenParticles"
);

// Get the underlying Babylon particle system
const ps = particles.getParticleSystem();

// Play / stop
particles.play();
particles.stop();
particles.pause();
```

### Common Runtime Modifications

```typescript
const ps = particles.getParticleSystem();

// Emission rate
ps.emitRate = 200;

// Color over lifetime
ps.color1 = new BABYLON.Color4(1, 0.5, 0, 1);
ps.color2 = new BABYLON.Color4(1, 0, 0, 0);
ps.colorDead = new BABYLON.Color4(0, 0, 0, 0);

// Speed
ps.minInitialRotation = -Math.PI;
ps.maxInitialRotation = Math.PI;
ps.minEmitPower = 1;
ps.maxEmitPower = 3;

// Gravity
ps.gravity = new BABYLON.Vector3(0, -9.81, 0);
```

### More Methods

```typescript
particles.reset(): void                 // reset the particle system
particles.isPlaying(): boolean
particles.getParticleCount(): number
particles.getEmitterMesh(): BABYLON.AbstractMesh
```

---

## TOOLKIT.WebVideoPlayer

> **Extends:** `TOOLKIT.ScriptComponent`  
> **Role:** Plays a video file on a mesh texture (Unity `VideoPlayer` equivalent).

### Methods

```typescript
const vp: TOOLKIT.WebVideoPlayer = TOOLKIT.SceneManager.FindScriptComponent(
    node, "TOOLKIT.WebVideoPlayer"
);

vp.play(): Promise<boolean>
vp.pause(): boolean
vp.mute(): boolean
vp.unmute(): boolean

vp.setVolume(volume: number): boolean   // [0..1]
vp.getVolume(): number

vp.getVideoElement(): HTMLVideoElement   // raw DOM video element
vp.getVideoTexture(): BABYLON.VideoTexture
vp.getVideoMaterial(): BABYLON.StandardMaterial
vp.getVideoScreen(): BABYLON.AbstractMesh
vp.setDataSource(source: string | string[] | HTMLVideoElement): void

vp.isReady(): boolean
vp.isPlaying(): boolean
vp.isPaused(): boolean

// Duration / seeking — use the raw DOM video element (there is no getDuration/getCurrentTime):
vp.getVideoElement().duration           // video duration in seconds
vp.getVideoElement().currentTime        // current playback position (assignable to seek)
```

### Observable

```typescript
vp.onReadyObservable    // Observable<BABYLON.VideoTexture> — video loaded and ready
// For end-of-playback, use the DOM element: vp.getVideoElement().onended = () => { ... };
```

### Usage Pattern

```typescript
protected start(): void {
    const vp: TOOLKIT.WebVideoPlayer = this.getComponent("TOOLKIT.WebVideoPlayer");
    vp?.onReadyObservable.add(() => {
        vp.play();
    });
}
```

---

## Unity GUI Controls

These custom GUI controls extend the Babylon.js GUI control classes (`Slider`, `ScrollBar`, `Container`) and are registered automatically for GUI parsing when the toolkit initializes. Import them from the package root as `TOOLKIT.UnitySlider`, `TOOLKIT.UnityScrollBar`, and `TOOLKIT.UnityDropdownMenu`.

### `TOOLKIT.UnitySlider`

A slider matching Unity's `Slider` UI component. Extends `BABYLON.GUI.Slider` — all standard slider members are inherited.

```typescript
const slider = control as TOOLKIT.UnitySlider;

slider.minimum: number         // min value (default 0)
slider.maximum: number         // max value (default 1)
slider.value: number           // current value
slider.step: number            // step increment
slider.isVertical: boolean

// Events (inherited from BABYLON.GUI.Slider)
slider.onValueChangedObservable.add((value: number) => {
    console.log("Slider value:", value);
});
```

### `TOOLKIT.UnityScrollBar`

Extends `BABYLON.GUI.ScrollBar` — standard scroll bar members are inherited, plus a `direction` accessor.

```typescript
const sb = control as TOOLKIT.UnityScrollBar;

sb.value: number               // scroll position [0..1]
sb.direction: string           // scroll direction

sb.onValueChangedObservable.add((value: number) => {
    scrollContent.top = -(value * contentHeight) + "px";
});
```

### `TOOLKIT.UnityDropdownMenu`

Extends `BABYLON.GUI.Container`.

```typescript
const dd = control as TOOLKIT.UnityDropdownMenu;

dd.selectedIndex: number      // currently selected index (get/set)
dd.options = [                // replace the option list (setter)
    { text: "Easy" },
    { text: "Hard", imageSource: "skull.png" },
];
```

> ⚠️ There is no `items`, `selectedValue`, `addOption`, `removeOption`, `clearOptions`, or
> `onSelectionChangedObservable` on `UnityDropdownMenu` — set the whole option list via the
> `options` setter and read/write `selectedIndex`.

---

## PostProcessor + Volume Scripting Pattern

```typescript
namespace TOOLKIT {
    export class VolumeBlender extends TOOLKIT.ScriptComponent {
        private ppInstance: TOOLKIT.PostProcessor = null;
        private playerInCombat: boolean = false;

        constructor(t: BABYLON.TransformNode, s: BABYLON.Scene, p: any = {}) {
            super(t, s, p, "TOOLKIT.VolumeBlender");
        }

        protected start(): void {
            this.ppInstance = TOOLKIT.PostProcessor.Instance;

            TOOLKIT.SceneManager.EventBus.OnMessage("combat:start", () => this.enterCombat());
            TOOLKIT.SceneManager.EventBus.OnMessage("combat:end",   () => this.exitCombat());
        }

        private enterCombat(): void {
            this.playerInCombat = true;
            const pp = this.ppInstance?.GetDefaultRenderPipeline();
            if (!pp) return;
            // Intensify vignette and add chromatic aberration
            pp.imageProcessing.vignetteWeight = 3.5;
            pp.chromaticAberrationEnabled = true;
            pp.chromaticAberration.aberrationAmount = 15;
        }

        private exitCombat(): void {
            this.playerInCombat = false;
            const pp = this.ppInstance?.GetDefaultRenderPipeline();
            if (!pp) return;
            pp.imageProcessing.vignetteWeight = 1.5;
            pp.chromaticAberrationEnabled = false;
        }
    }
}
```
