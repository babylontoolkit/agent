# Pro Components Reference

> This document covers: `PostProcessor`, `TerrainBuilder`, `ShurikenParticles`, `WebVideoPlayer`, and Unity GUI Controls (`UnitySlider`, `UnityScrollBar`, `UnityDropdownMenu`).

---

## TOOLKIT.PostProcessor

> **Namespace:** `TOOLKIT`  
> **Role:** Post-processing volume controller. Parses Unity URP Volume exported settings and creates the appropriate Babylon.js pipeline objects.

### Singleton Access
```typescript
const pp = TOOLKIT.PostProcessor.Instance;
```

### Key Properties
```typescript
pp.scene                 // BABYLON.Scene
pp.postProcessPipeline   // BABYLON.DefaultRenderingPipeline (main pipeline)
pp.ssaoPipeline          // BABYLON.SSAO2RenderingPipeline
pp.ssrPipeline           // BABYLON.ScreenSpaceReflectionPostProcess

pp.cameraList            // BABYLON.Camera[] — cameras the pipeline is attached to
```

### Configuring Post Effects at Runtime

The pipeline is built from Unity metadata, but you can modify properties at runtime:

```typescript
// Bloom
pp.postProcessPipeline.bloomEnabled = true;
pp.postProcessPipeline.bloomThreshold = 0.8;
pp.postProcessPipeline.bloomWeight = 0.3;
pp.postProcessPipeline.bloomKernel = 64;
pp.postProcessPipeline.bloomScale = 0.5;

// Depth of Field
pp.postProcessPipeline.depthOfFieldEnabled = true;
pp.postProcessPipeline.depthOfField.focusDistance = 2000;  // mm
pp.postProcessPipeline.depthOfField.focalLength = 50;
pp.postProcessPipeline.depthOfField.fStop = 1.4;

// Chromatic Aberration
pp.postProcessPipeline.chromaticAberrationEnabled = true;
pp.postProcessPipeline.chromaticAberration.aberrationAmount = 30;

// Grain
pp.postProcessPipeline.grainEnabled = true;
pp.postProcessPipeline.grain.intensity = 20;
pp.postProcessPipeline.grain.animated = true;

// Sharpening
pp.postProcessPipeline.sharpenEnabled = true;
pp.postProcessPipeline.sharpen.edgeAmount = 0.3;

// Vignette
pp.postProcessPipeline.imageProcessing.vignetteEnabled = true;
pp.postProcessPipeline.imageProcessing.vignetteWeight = 1.5;
pp.postProcessPipeline.imageProcessing.vignetteCameraFov = 0.5;

// Color Grading (LUT)
pp.postProcessPipeline.imageProcessing.colorGradingEnabled = true;
pp.postProcessPipeline.imageProcessing.colorGradingTexture = new BABYLON.ColorGradingTexture("lut.png", scene);
```

### SSAO
```typescript
pp.ssaoPipeline.radius = 2.0;
pp.ssaoPipeline.totalStrength = 1.0;
pp.ssaoPipeline.maxZ = 100.0;
pp.ssaoPipeline.base = 0.1;
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

### Instance Methods

```typescript
terrain.getTerrain(): BABYLON.Mesh          // the Babylon terrain mesh
terrain.getTerrainData(): any              // raw Unity terrain metadata
terrain.getHeightAtPoint(x: number, z: number): number  // world-space height at XZ
```

### Usage Pattern
```typescript
// Get height for object placement
const tb: TOOLKIT.TerrainBuilder = TOOLKIT.SceneManager.FindScriptComponent(
    terrainNode, "TOOLKIT.TerrainBuilder"
);
const groundY = tb.getHeightAtPoint(spawnX, spawnZ);
spawnNode.position.set(spawnX, groundY + 0.5, spawnZ);
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

### Observable

```typescript
particles.onParticleSystemReadyObservable  // Observable<BABYLON.IParticleSystem>
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

vp.play(): void
vp.pause(): void
vp.stop(): void

vp.setVolume(volume: number): void   // [0..1]
vp.getVolume(): number

vp.getVideoElement(): HTMLVideoElement   // raw DOM video element
vp.getVideoTexture(): BABYLON.VideoTexture

vp.isPlaying(): boolean
vp.isPaused(): boolean
vp.getDuration(): number              // video duration in seconds
vp.getCurrentTime(): number          // current playback position
vp.setCurrentTime(seconds: number): void  // seek
```

### Observable

```typescript
vp.onVideoReadyObservable    // Observable<BABYLON.TransformNode> — video loaded and ready
vp.onVideoEndedObservable    // Observable<BABYLON.TransformNode> — video reached end
```

### Usage Pattern

```typescript
protected start(): void {
    const vp: TOOLKIT.WebVideoPlayer = this.getComponent("TOOLKIT.WebVideoPlayer");
    vp?.onVideoReadyObservable.add(() => {
        vp.play();
    });
}
```

---

## Unity GUI Controls

These custom Babylon.js GUI controls are registered automatically when the toolkit initializes. They extend `BABYLON.GUI.Control`.

### `BABYLON.GUI.UnitySlider`

A slider matching Unity's `Slider` UI component.

```typescript
const slider = control as BABYLON.GUI.UnitySlider;

slider.minimum: number         // min value (default 0)
slider.maximum: number         // max value (default 1)
slider.value: number           // current value
slider.step: number            // step increment
slider.isVertical: boolean

// Events
slider.onValueChangedObservable.add((value: number) => {
    console.log("Slider value:", value);
});
```

### `BABYLON.GUI.UnityScrollBar`

```typescript
const sb = control as BABYLON.GUI.UnityScrollBar;

sb.value: number               // scroll position [0..1]
sb.step: number

sb.onValueChangedObservable.add((value: number) => {
    scrollContent.top = -(value * contentHeight) + "px";
});
```

### `BABYLON.GUI.UnityDropdownMenu`

```typescript
const dd = control as BABYLON.GUI.UnityDropdownMenu;

dd.items: string[]            // array of option labels
dd.selectedIndex: number      // currently selected index
dd.selectedValue: string      // currently selected label

dd.addOption(label: string): void
dd.removeOption(index: number): void
dd.clearOptions(): void

dd.onSelectionChangedObservable.add((index: number) => {
    console.log("Selected:", dd.items[index]);
});
```

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
            const pp = this.ppInstance?.postProcessPipeline;
            if (!pp) return;
            // Intensify vignette and add chromatic aberration
            pp.imageProcessing.vignetteWeight = 3.5;
            pp.chromaticAberrationEnabled = true;
            pp.chromaticAberration.aberrationAmount = 15;
        }

        private exitCombat(): void {
            this.playerInCombat = false;
            const pp = this.ppInstance?.postProcessPipeline;
            if (!pp) return;
            pp.imageProcessing.vignetteWeight = 1.5;
            pp.chromaticAberrationEnabled = false;
        }
    }
}
```
