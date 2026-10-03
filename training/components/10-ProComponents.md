# Pro Components Reference

> This document covers: `PostProcessor`, the HDRP rendering classes (`HdrpRendering`, `HdrpPhysicallyBasedSky`, `PlanarReflection`), `TerrainBuilder`, `ShurikenParticles`, `LineRenderer` / `TrailRenderer`, `WebVideoPlayer`, `UserInterface` (exported Unity UI), and the legacy Unity GUI controls (`UnitySlider`, `UnityScrollBar`, `UnityDropdownMenu`).
>
> All of these are **created by the exporter** from Unity components (Pro licence). Find them with `TOOLKIT.SceneManager.FindScriptComponent`, then tune them — never rebuild what they already render. Shader Graph material APIs (`setFloat`, `TOOLKIT.ShaderGlobals`) are in the Custom Shader Code Instructions (`references/shader-materials.md`).

---

## Import

```typescript
import * as TOOLKIT from "@babylonjs-toolkit/next";
// named imports are equivalent:
// import { PostProcessor, TerrainBuilder, ShurikenParticles, WebVideoPlayer, UserInterface } from "@babylonjs-toolkit/next";
// ⚠️ Do NOT import from "@babylonjs-toolkit/next/shurikenparticles" or "/webvideoplayer" — those subpaths are broken; use the root import.
```

---

## TOOLKIT.PostProcessor

> **Namespace:** `TOOLKIT`  
> **Role:** One component per exported Volume (Built-in PPv2, URP, HDRP), plus a camera-owner component for cameras with anti-aliasing work. The volumes are blended per camera and rendered as Babylon pipelines plus toolkit plugin passes (colour-grading LUT, bloom, vignette, chromatic aberration, grain, lens distortion, FXAA / SMAA / TAA, PPv2 and HDRP auto-exposure; on HDRP also Panini, Screen Space Lens Flare, SSGI and height fog) in Unity's pass order. What each Unity effect becomes is in `unity-authoring-recipes.md` §9.

### Runtime API

```typescript
const pp = TOOLKIT.PostProcessor.Instance;               // null when the scene has no volumes / AA cameras
const cam = scene.activeCamera;

pp.onEffectListingChangedObservable.add(() => {         // stacks apply a frame after ready; LUT passes arrive later
    const effects = pp.GetEffectListing(cam);           // what is actually applied on this camera
    const vignette = effects.find(e => e.family === "vignette");
    vignette?.fields.find(f => f.key === "intensity")?.set?.(0.45);   // Unity units, live
});

pp.SetEffectEnabled(cam, "bloom", false);               // toggle a family; false when it is not applied
pp.SetAntialiasingMode(cam, 3);                         // 0 None, 1 FXAA, 2 SMAA, 3 TAA
pp.ResetHistory(cam);                                   // after a camera cut / teleport: fresh TAA history + exposure snap
pp.SetToneMapper(cam, 2);                               // URP only: 0 None, 1 Neutral, 2 ACES
```

| Call | Does |
|---|---|
| `TOOLKIT.PostProcessor.Instance` | The orchestrating instance |
| `pp.GetCameraStacks()` | `{ camera, stack, pipeline }[]` |
| `pp.GetEffectListing(camera)` | `IPostProcessInspectorEffect[]`: `{ family, unityEffect, applied, target, reason?, enabled, fields[] }`; each field is `{ key, label, kind, readOnly?, get(), set?(v) }` in **Unity units** |
| `pp.SetEffectEnabled(camera, family, on)` / `pp.IsEffectEnabled(camera, family)` | Families: `ambientOcclusion`, `screenSpaceReflections`, `motionBlur`, `autoExposure`, `lensDistortion`, `chromaticAberration`, `bloom`, `vignette`, `grain`, `colorGrading`, `depthOfField`, `antialiasing` |
| `pp.SetAntialiasingMode(camera, mode)` / `pp.ResetHistory(camera?)` / `pp.SetToneMapper(camera, mode)` | See above |
| `pp.GetDefaultRenderPipeline()` / `GetSSAORRenderPipeline()` / `GetSSRRenderPipeline()` | The first rendered camera's `DefaultRenderingPipeline` / `SSAO2RenderingPipeline` / `SSRRenderingPipeline` (legacy accessors) |
| `pp.applyVolumes()` | Re-blend and rebuild every stack — heavy, one-off only |

Static switches, set **before** the scene loads: `TOOLKIT.PostProcessor.ForceScreenSpaceReflections` (false — PPv2 SSR on a forward camera), `Dithering` (true), `HalfFloatChain` (true; false halves HDR bandwidth but brings back banding).

**Rules:**
- Edits last for the session; any re-apply restores the authored values.
- An effect authored at intensity 0 creates no pass. Author it above 0 in Unity and disable it at start.
- **Never** enable the pipeline's own bloom / chromatic aberration / grain / `imageProcessing.vignette*` / `colorGradingTexture` on a camera with exported volumes — toolkit passes already render those, so you get a second copy (or nothing: the toolkit turns Babylon's vignette off). Edit through `GetEffectListing` instead. Direct pipeline properties are fine for depth of field, sharpen, or a scene with no volumes.
- `PostProcessor` reuses an existing `DefaultRenderingPipeline` on the camera (e.g. `DefaultCameraSystem`'s) and overrides it.
- On HDRP cameras `SetEffectEnabled(…, false)` neutralises the family's passes instead of detaching them.

**Inspector:** `TOOLKIT.WindowManager.ShowInspector` / `ToggleDebug` / `PopupDebug` add a **"Unity Post Processing"** section to the Babylon Inspector: select a camera for per-effect ON/OFF switches and Unity-unit fields, the AA mode dropdown and every TAA knob.

---

## HDRP rendering — TOOLKIT.HdrpRendering, HdrpPhysicallyBasedSky, PlanarReflection

> **Role:** An HDRP level (exported with the `hdrp` scene block) renders in HDRP's physical units under one camera **pre-exposure** per scene, which `TOOLKIT.HdrpRendering` re-applies to every radiance source (lights, emission by HDRP's exposure weight, environment, sky, probes, lightmaps, particles, Shader Graph `g_sgExposure`) in the same frame. HDRP auto exposure drives it through `AutoExposurePlugin`'s `hdrp` variant. All of it is exporter-driven; what each HDRP feature becomes is in `unity-authoring-recipes.md` §3–§9.

| Call | Does |
|---|---|
| `TOOLKIT.HdrpRendering.IsParity(scene)` | `true` for a scene exported with the `hdrp` block (decided by the exported pipeline, never by names) |
| `TOOLKIT.HdrpRendering.GetPreExposure(scene)` / `SetPreExposure(scene, pe)` | Read / set the scene pre-exposure; a set re-applies every binding at once (1 on non-HDRP scenes) |
| `TOOLKIT.HdrpRendering.OnPreExposureChanged` | `Observable<Scene>` raised after every pre-exposure change |
| `TOOLKIT.HdrpPhysicallyBasedSky.Get(scene)` | The live PhysicallyBasedSky, or `null` (other sky types, or the baked fallback) |
| `TOOLKIT.HdrpPhysicallyBasedSky.RequestEnvironmentUpdate(scene)` / `OnEnvironmentUpdated` | Re-capture the reflection cube and SH from the live sky / raised after each capture |
| `TOOLKIT.PlanarReflection` (component) | One per HDRP Planar Reflection Probe: `getMirror()` (`BABYLON.MirrorTexture`), `getReceivers()`. Static `Budget` (default 2) caps live mirrors per scene; set it before load |

**Rules:**
- Never multiply exposure into an HDRP material, light or sky by hand — it is already pre-exposed. HDRP/Unlit base colour and overlay UI are never exposed.
- Rotating the sun under a live PhysicallyBasedSky re-captures the environment by HDRP's update rules; no call is needed.

---

## TOOLKIT.TerrainBuilder

> **Extends:** `TOOLKIT.ScriptComponent` (Pro)  
> **Role:** Rebuilds an exported Unity terrain from data: a quadtree-LOD heightfield surface (splat material, or the terrain's Shader Graph class), holes, a Havok heightfield collider, instanced trees (LODGroup, crossfade, billboards, wind), mesh details and texture grass streamed by distance. The exporter creates one per Unity terrain; never add it by hand.

### Find it, wait for it

```typescript
const terrain = TOOLKIT.SceneManager.FindScriptComponent<TOOLKIT.TerrainBuilder>(node, "TOOLKIT.TerrainBuilder");
if (terrain.isBuilt) start(); else terrain.onBuiltObservable.addOnce(() => start());
TOOLKIT.TerrainBuilder.IsAllBuilt(scene);              // every terrain in the scene finished
TOOLKIT.TerrainBuilder.GetTerrains(scene);             // TerrainBuilder[]
TOOLKIT.TerrainBuilder.GetTerrainAt(scene, worldPos);  // the tile under a point, or null
```

### Height queries (Unity names)

| Call | Returns |
|---|---|
| `TerrainBuilder.GetWorldHeightAt(scene, worldPos)` (static) | World Y under the point across all tiles; null off-terrain |
| `terrain.GetWorldHeight(worldPos)` | World Y on this tile (clamped to its rect) |
| `terrain.SampleHeight(worldPos)` | Height relative to the terrain (`Terrain.SampleHeight`) |
| `terrain.WorldToTerrainUV(worldPos)` | Normalised `Vector2`; null outside |
| `terrain.GetInterpolatedHeight(u, v)` / `GetInterpolatedNormal(u, v)` | Local height / world normal at uv |

They return 0 or null before the build.

> ⚠️ The terrain surface is **not pickable** — `scene.pickWithRay` never hits it. Use the queries above, or a Havok
> raycast against the terrain collider (`TOOLKIT.RigidbodyPhysics.Raycast(origin, direction, length)`).

```typescript
const y = TOOLKIT.TerrainBuilder.GetWorldHeightAt(scene, new BABYLON.Vector3(x, 0, z));
if (y != null) spawnNode.position.set(x, y + 0.5, z);
```

### Live Unity settings

| Member | Unity equivalent |
|---|---|
| `treeDistance` | `Terrain.treeDistance` |
| `detailObjectDistance` | `Terrain.detailObjectDistance` (fade 0.9–1×) |
| `detailObjectDensity` | `Terrain.detailObjectDensity` (relative to the exported density — can only thin) |
| `heightmapPixelError` | `Terrain.heightmapPixelError` (surface LOD) |
| `setGrassWind(strength, amount, speed, tint?)` | TerrainData *Waving Grass* settings |

There are no static configuration fields. An export from an older exporter logs "export contract N is not supported — re-export the scene" and builds nothing.

---

## TOOLKIT.ShurikenParticles

> **Extends:** `TOOLKIT.ScriptComponent` (Pro)  
> **Role:** Unity Shuriken runtime. Each exported `ParticleSystem` becomes one **CPU** `BABYLON.ParticleSystem` that this component drives: clock, emission, every module, sorting, trails, mesh instances, particle lights and Shader Graph particle materials.

### Find and control a system

```typescript
const fx = TOOLKIT.SceneManager.FindScriptComponent<TOOLKIT.ShurikenParticles>(node, "TOOLKIT.ShurikenParticles");
fx.play();                // resumes if paused, restarts if stopped; also plays child systems (play(false) = this one only)
fx.stop();                // StopEmitting — live particles finish
fx.stop(true, 1);         // StopEmittingAndClear
fx.pause();  fx.clear();
fx.emit(20);              // 20 extra particles, through the shape and start values
fx.simulate(1.5);         // jump 1.5 s ahead (restart = true clears and rewinds first)
fx.onSystemStoppedObservable.add((s) => { /* Stop Action = Callback */ });
```

| Member | Notes |
|---|---|
| `play(withChildren = true)`, `stop(withChildren = true, stopBehavior = 0)`, `pause(withChildren = true)`, `clear(withChildren = true)` | Unity semantics. Children = descendant nodes with the component |
| `emit(count)`, `emitFrom(position, velocity, count)` | Extra particles; `emitFrom` takes a world position and velocity |
| `simulate(seconds, withChildren = true, restart = true)` | Fixed 1/60 s steps |
| `reset()` | Stop and clear, then `play()` |
| `isPlaying()`, `isPaused()`, `isEmitting()`, `isAlive(withChildren = true)` | |
| `time`, `duration`, `loop`, `particleCount` | Read-only getters |
| `getParticleSystem()`, `getEmitterMesh()`, `getChildSystems()` | The CPU `BABYLON.ParticleSystem`, the component's node, child systems |
| `triggerSubEmitter(index)` | Fire the Manual sub-emitter at that index of the Inspector list |
| `onParticleCollisionObservable` | Needs Collision › **Send Collision Messages** |
| `onParticleTriggerObservable` `{ type, particle, system }` | `type`: 0 inside, 1 outside, 2 enter, 3 exit. Fires only for actions set to **Callback** |
| `ShurikenParticles.SimulateAll(scene, seconds)`, `SetHold(scene, hold)`, `FindByInstanceId(scene, id)` | Step or freeze every system (captures) |

### Editing the Babylon system

Safe to edit (written once at load): the *constant* start values `minLifeTime` / `maxLifeTime`, `minEmitPower` / `maxEmitPower`, `minSize` / `maxSize`, `minInitialRotation` / `maxInitialRotation`, `color1` / `color2`, `blendMode`. Start values authored as curves are rewritten every frame.

**Has no effect — do not set:** `emitRate`, `manualEmitCount`, `updateSpeed`, `gravity`, `colorDead`. Emission, gravity and colour over lifetime come from the exported modules. Control playback with the component (`play` / `stop` / `emit`), never `ps.start()` / `ps.stop()`. Change the look in Unity and re-export.

---

## TOOLKIT.LineRenderer / TOOLKIT.TrailRenderer

> **Extends:** `TOOLKIT.ScriptComponent` (Pro)  
> **Role:** Unity `LineRenderer` / `TrailRenderer` as ribbon meshes (width curve, colour gradient, alignment, texture mode). A Shader Graph material draws through its generated class; any other material draws unlit and alpha-blended.

```typescript
const line = TOOLKIT.SceneManager.FindScriptComponent<TOOLKIT.LineRenderer>(node, "TOOLKIT.LineRenderer");
line.setPositions([from, to]);                  // BABYLON.Vector3[] — replaces the points
const points = line.getPositions();
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

## TOOLKIT.UserInterface — exported Unity UI

The exporter attaches one `TOOLKIT.UserInterface` per root uGUI Canvas / UI Toolkit UIDocument (every render mode). It builds asynchronously in its own `start()`, so wait for it before looking up elements. Elements are `TOOLKIT.UnityElement` (extends `BABYLON.GUI.Container`). All members below are **static**. Authoring rules and limits: `unity-authoring-recipes.md` §17.

| Member | Returns / does |
|---|---|
| `GetInterface(name, scene?)` | The built interface (root node name), else `null` (not built yet, or still inactive) |
| `GetInterfaceNames(scene?)` / `AllInterfacesLoaded(scene?)` | `string[]` / `boolean` |
| `OnInterfaceLoaded` | `Observable<string>`: the node name of each interface as it finishes |
| `FindElement(nameOrPath, scene?)` | `UnityElement`: a `"Canvas/Panel/Button"` path, a path suffix, or the first element with that name |
| `QueryElements({ name?, className?, type? }, scene?)` | `UnityElement[]`. uGUI `type`: `button`, `toggle`, `slider`, `scrollbar`, `dropdown`, `inputField`, `scrollRect`, `image`, `text`, … UI Toolkit: USS class or element type |
| `OnClick(el)` | `Observable<UnityElement>`; fires after the persistent listeners |
| `OnValueChanged(el)` | `Observable<any>`: toggle `boolean`, slider / scrollbar `number`, dropdown index, input `string`, scroll rect `{x,y}` |
| `OnSubmit(el)` | `Observable<string>` (input field) |
| `GetText(el)` / `SetText(el, text)` | Text graphic or input value; layout re-runs |
| `GetValue(el)` / `SetValue(el, value, notify = true)` | The control's value |
| `SetInteractable(el, on)` | `Selectable.interactable` (disabled tint, no events) |
| `SetActive(nameOrPathOrInterface, active, scene?)` | Show / hide an element with layout, or enable a whole interface (building an inactive one the first time) |
| `GetForegroundTexture(scene)` | The shared fullscreen ADT that holds the overlay canvases — use it instead of creating a second fullscreen ADT |

```typescript
namespace PROJECT {
    export class HudController extends TOOLKIT.ScriptComponent {
        private loaded: BABYLON.Observer<string> = null;
        constructor(t: BABYLON.TransformNode, s: BABYLON.Scene, p: any = {}) { super(t, s, p, "PROJECT.HudController"); }
        protected start(): void {
            if (TOOLKIT.UserInterface.GetInterface("HUD", this.scene) != null) this.wire();
            else this.loaded = TOOLKIT.UserInterface.OnInterfaceLoaded.add((name) => { if (name === "HUD") this.wire(); });
        }
        private wire(): void {
            const UI = TOOLKIT.UserInterface;
            const play = UI.FindElement("HUD/Menu/PlayButton", this.scene);
            if (play) UI.OnClick(play).add(() => this.startGame());
            const volume = UI.FindElement("Volume", this.scene);
            if (volume) UI.OnValueChanged(volume).add((v: number) => this.setVolume(v));
            UI.SetText(UI.FindElement("Score", this.scene), "0");
            UI.SetActive("PauseMenu", false, this.scene);
        }
        // Also callable from a Unity Button's persistent onClick when the C# class has [Babylon(Class="PROJECT.HudController")]
        public startGame(): void { /* … */ }
        private setVolume(v: number): void { /* … */ }
        protected destroy(): void { if (this.loaded) TOOLKIT.UserInterface.OnInterfaceLoaded.remove(this.loaded); }
    }
}
```

`OnInterfaceLoaded` is static and is not cleared per scene — always remove your observer in `destroy()`.

---

## Legacy Unity GUI Controls (old exports only)

These controls are created only for scenes exported by an older toolkit (that path logs *"was exported by an older toolkit — re-export the scene"*). Current exports build `TOOLKIT.UnityElement` trees — use the `TOOLKIT.UserInterface` API above and never cast an exported element to these classes.

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

---

## PostProcessor + Volume Scripting Pattern

```typescript
namespace PROJECT {
    export class VolumeBlender extends TOOLKIT.ScriptComponent {
        private ppInstance: TOOLKIT.PostProcessor = null;

        constructor(t: BABYLON.TransformNode, s: BABYLON.Scene, p: any = {}) {
            super(t, s, p, "PROJECT.VolumeBlender");
        }

        protected start(): void {
            this.ppInstance = TOOLKIT.PostProcessor.Instance;
            TOOLKIT.SceneManager.EventBus.OnMessage("combat:start", () => this.enterCombat());
            TOOLKIT.SceneManager.EventBus.OnMessage("combat:end",   () => this.exitCombat());
        }

        private setVignette(intensity: number): void {
            const cam = this.scene.activeCamera;
            const vig = this.ppInstance?.GetEffectListing(cam)?.find(e => e.family === "vignette");
            vig?.fields.find(f => f.key === "intensity")?.set?.(intensity);     // Unity units
        }

        private enterCombat(): void {
            this.setVignette(0.45);
            this.ppInstance?.SetEffectEnabled(this.scene.activeCamera, "chromaticAberration", true);   // authored > 0, disabled at start
        }

        private exitCombat(): void {
            this.setVignette(0.25);
            this.ppInstance?.SetEffectEnabled(this.scene.activeCamera, "chromaticAberration", false);
        }
    }
}
```
