# Pro Components Reference

> This document covers: `PostProcessor`, the HDRP rendering classes (`HdrpRendering`, `HdrpPhysicallyBasedSky`, `PlanarReflection`), `TerrainBuilder`, `ShurikenParticles`, `VisualEffect` (VFX Graph), `LineRenderer` / `TrailRenderer`, `WebVideoPlayer`, `UserInterface` (exported Unity UI), and the legacy Unity GUI controls (`UnitySlider`, `UnityScrollBar`, `UnityDropdownMenu`).
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

## VFX Graph (TOOLKIT.VisualEffect)

> **Extends:** `TOOLKIT.ScriptComponent` (Pro)  
> **Role:** Unity VFX Graph runtime. Each exported `VisualEffect` carries a description of every particle system in its graph. A system runs on the **GPU** path (`BABYLON.GPUParticleSystem`) when every block maps, else on the **CPU** path (a Node Particle System skeleton whose update queue runs every VFX block as a toolkit step). Spawners, events, exposed properties, update mode and prewarm come from the export; the export summary and one grouped runtime console summary per scene name each system's path and every deviation.

### Find and control an effect

```typescript
const fogEffect: TOOLKIT.VisualEffect = TOOLKIT.SceneManager.GetComponent<TOOLKIT.VisualEffect>(node, "TOOLKIT.VisualEffect");
const BURST_SPAWN_RATE: number = 40;                // particles per second
fogEffect.play();                                   // sends the initial event (default OnPlay)
fogEffect.sendEvent("Burst");                       // a graph event by name; an unknown name warns once
fogEffect.setFloat("Spawn Rate", BURST_SPAWN_RATE); // exposed property by Unity's exposed name
fogEffect.resetOverride("Spawn Rate");              // back to the exported value
```

| Member | Notes |
|---|---|
| `play()` | Sends the initial event (default `OnPlay`) |
| `stop()` | Sends `OnStop`: spawners stop, live particles finish |
| `reinit()` | Clears every particle, resets spawners and the seed rule, then sends the initial event |
| `sendEvent(eventName)` | Sends an event by name. An unknown name warns once and does nothing |
| `pause()`, `resume()`, `paused` | Freezes simulation and spawning; drawing continues |
| `aliveParticleCount` | Live particles over every system (read-only) |
| `getSystems()` | One `TOOLKIT.IVisualEffectSystemInfo` per exported system: `name`, `exportedPath` / `builtPath` (`"gpu"` / `"cpu"`; they differ on CPU fallback), `reason`, `particleSystem`, `aliveCount`, `deviations` |
| `hasFloat` / `getFloat` / `setFloat`, and the same for `Int`, `UInt`, `Bool`, `Vector2`, `Vector3`, `Vector4`, `Gradient`, `AnimationCurve` | Typed exposed-property access by Unity's exposed name. `Vector3` also takes position / direction / vector properties, `Vector4` colours. A missing name or wrong type warns once: `set*` does nothing, `get*` returns null. Textures and meshes are not settable |
| `resetOverride(name)` | Restores the exported value of one property |
| `VisualEffect.FindAll(scene)`, `FindByInstanceId(scene, instanceId)` | Every live component of a scene; the component with that exported instance id (else null) |
| `VisualEffect.PendingPrewarms(scene)`, `SceneTime(scene)` | CPU prewarms still queued (they hold the splash screen); seconds since the scene's first VisualEffect step |
| `VisualEffect.GpuParticlesEnabled`, `GpuPrewarmMaxCycles` (200), `PrewarmSliceMs` (8) | Set before a scene loads. `GpuParticlesEnabled = false` builds every GPU system on the CPU path (testing) |

### Example

```typescript
/** Thickens a VFX Graph fog while the player stands in a trigger. */
export class FogThickener extends TOOLKIT.ScriptComponent {
    /** Spawn rate while thickened, particles per second. */
    private static readonly THICK_SPAWN_RATE: number = 60;
    /** The fog effect on this node. */
    private fog: TOOLKIT.VisualEffect = null;

    /** Finds the exported VisualEffect on the same node. */
    protected start(): void {
        this.fog = TOOLKIT.SceneManager.GetComponent<TOOLKIT.VisualEffect>(this.transform, "TOOLKIT.VisualEffect");
    }

    /** Raises the exposed "Spawn Rate" when the effect has it. */
    public thicken(): void {
        if (this.fog == null || !this.fog.hasFloat("Spawn Rate")) return;
        this.fog.setFloat("Spawn Rate", FogThickener.THICK_SPAWN_RATE);
    }
}
```

Drive the effect through the component and its exposed properties — never `start()` / `stop()` the Babylon systems from `getSystems()` directly. Change the graph in Unity and re-export; what the toolkit carries and what stays neutral is in `references/unity-authoring-recipes.md` §17.

---

## Cinemachine cameras and Unity Splines

> **Extends:** `TOOLKIT.ScriptComponent` (Pro)  
> **Role:** Unity Cinemachine 3 runtime — a `TOOLKIT.CinemachineBrain` on the exported camera node picks the live `TOOLKIT.CinemachineCamera` by priority, blends between cameras and writes the result to the node and its camera rig every frame. Cinemachine 2 content is converted to the Cinemachine 3 model at export, so V2 and V3 cameras play on the same runtime. The Unity Splines runtime (`TOOLKIT.SplineContainer`, `TOOLKIT.SplineAnimate`) ships alongside it and also works in projects without Cinemachine.

### What exports automatically

- **Cinemachine 3 (`com.unity.cinemachine` 3.x):** the brain, every camera and manager, every Position / Rotation Control, noise, extension, input axis controller, target group, impulse source / listener and the Timeline Cinemachine track, with their inline assets (noise profiles, blender settings, impulse definitions).
- **Cinemachine 2 (2.x):** virtual cameras, FreeLooks, managers, the brain, paths, dolly / cart, impulse and post-processing are converted with the same tables as Unity's own upgrader (the scene is never changed). The Starter Assets `PlayerFollowCamera` plays as a third-person follow camera.
- **Unity Splines (`com.unity.splines`):** every `SplineContainer` (knots, tangents, tangent modes, closed state, extra data) and `SplineAnimate`.
- A setting the runtime cannot honour is listed once in the export console under **Cinemachine**; nothing fails the export. A project without Cinemachine or Splines exports exactly as before.

### Classes and their Unity counterparts

| Toolkit class | Unity counterpart |
|---|---|
| `TOOLKIT.CinemachineBrain` | `CinemachineBrain` |
| `TOOLKIT.CinemachineCore` (static) | `CinemachineCore` |
| `TOOLKIT.CinemachineVirtualCameraBase` (base) | `CinemachineVirtualCameraBase` |
| `TOOLKIT.CinemachineCamera` | `CinemachineCamera` (V2 `CinemachineVirtualCamera`, `CinemachineFreeLook`) |
| `TOOLKIT.CinemachineExternalCamera` | `CinemachineExternalCamera` |
| `TOOLKIT.CinemachineCameraManagerBase` (base) | `CinemachineCameraManagerBase` |
| `TOOLKIT.CinemachineClearShot` / `CinemachineStateDrivenCamera` / `CinemachineSequencerCamera` / `CinemachineMixingCamera` | the same names (V2 `CinemachineBlendListCamera` → Sequencer) |
| `TOOLKIT.CinemachineComponentBase` (base) | `CinemachineComponentBase` |
| `TOOLKIT.CinemachineFollow` / `CinemachineOrbitalFollow` / `CinemachineThirdPersonFollow` / `CinemachinePositionComposer` / `CinemachineHardLockToTarget` / `CinemachineSplineDolly` | Position Control: the same names (V2 Transposer, Orbital Transposer / FreeLook, 3rd Person Follow, Framing Transposer, Hard Lock To Target, Tracked Dolly) |
| `TOOLKIT.CinemachineRotationComposer` / `CinemachinePanTilt` / `CinemachineHardLookAt` / `CinemachineRotateWithFollowTarget` / `CinemachineSplineDollyLookAtTargets` | Rotation Control: the same names (V2 Composer, POV, Hard Look At, Same As Follow Target) |
| `TOOLKIT.CinemachineBasicMultiChannelPerlin` | Noise: `CinemachineBasicMultiChannelPerlin` |
| `TOOLKIT.CinemachineExtension` (base) | `CinemachineExtension` |
| `TOOLKIT.CinemachineDeoccluder` / `CinemachineDecollider` / `CinemachineConfiner2D` / `CinemachineConfiner3D` / `CinemachineShotQualityEvaluator` | the same names (V2 Collider → Deoccluder, Confiner → Confiner 3D) |
| `TOOLKIT.CinemachineCameraOffset` / `CinemachineRecomposer` / `CinemachineFollowZoom` / `CinemachineGroupFraming` / `CinemachineThirdPersonAim` / `CinemachineFreeLookModifier` | the same names |
| `TOOLKIT.CinemachineVolumeSettings` / `CinemachinePostProcessing` / `CinemachineAutoFocus` | the same names (per-camera post-processing; the profile is a `TOOLKIT.PostProcessor` on the camera node) |
| `TOOLKIT.CinemachineFreeLookModifierBase`, `CinemachineFreeLookTiltModifier`, `CinemachineFreeLookLensModifier`, `CinemachineFreeLookPositionDampingModifier`, `CinemachineFreeLookCompositionModifier`, `CinemachineFreeLookDistanceModifier`, `CinemachineFreeLookNoiseModifier`, `CinemachineFreeLookComponentModifier` | `CinemachineFreeLookModifier.Modifier` and its Tilt / Lens / Position Damping / Composition / Distance / Noise modifiers |
| `TOOLKIT.CinemachineInputAxisController`, `CinemachineInputAxisControllerEntry`, `CinemachineInputAxisReader`, `CinemachineInputSource` | `CinemachineInputAxisController` and its controllers / readers (V2 `CinemachineInputProvider`) |
| `TOOLKIT.CinemachineTargetGroup`, `CinemachineGroupWeightManipulator` | the same names |
| `TOOLKIT.CinemachineImpulseSource` / `CinemachineCollisionImpulseSource` / `CinemachineImpulseListener` / `CinemachineExternalImpulseListener` | the same names |
| `TOOLKIT.CinemachineImpulseManager`, `CinemachineImpulseEvent`, `CinemachineImpulseDefinition`, `CinemachineImpulseEnvelopeDefinition`, `CinemachineImpulseReaction`, `CinemachineFixedSignal` | `CinemachineImpulseManager`, `ImpulseEvent`, `CinemachineImpulseDefinition`, `EnvelopeDefinition`, `ImpulseReaction`, `CinemachineFixedSignal` |
| `TOOLKIT.CinemachineSplineCart`, `CinemachineSplineRoll`, `CinemachineSplineDolly`, `CinemachineSplineContainerExtensions`, `CinemachineSplineHelpers`, `SplineAutoDollyFixedSpeed`, `SplineAutoDollyNearestPointToTarget` | `CinemachineSplineCart`, `CinemachineSplineRoll`, `CinemachineSplineDolly`, `SplineContainerExtensions`, `SplineAutoDolly.FixedSpeed` / `NearestPointToTarget` (V2 `CinemachineDollyCart`, paths) |
| `TOOLKIT.CinemachineTimeline`, `CinemachineTimelineTrack`, `CinemachineTimelineShot` | Timeline `CinemachineTrack` / `CinemachineShot` played live on the brain |
| `TOOLKIT.CinemachineTriggerAction` | `CinemachineTriggerAction` |
| `TOOLKIT.CinemachineBlend`, `CinemachineBlendDefinition`, `CinemachineBlenderSettings` | `CinemachineBlend`, `CinemachineBlendDefinition`, `CinemachineBlenderSettings` |
| `TOOLKIT.CinemachineThirdPersonFollowObstacleSettings`, `CinemachinePhysicsQuery`, `CinemachineVolumeBlendable`, `CinemachineVolumeExtension`, `Cinemachine3OrbitRigSettings`, `Cinemachine3OrbitRigSplineCache`, `CinemachineRect`, `CinemachineContract`, `CinemachineMath` | runtime helpers (Third Person obstacle settings, physics casts, volume blending, orbit rig, screen rects, export contract, Unity math) |
| `TOOLKIT.SplineContainer`, `Spline`, `SplineCurve`, `SplineData`, `SplinePath`, `SplineUtility`, `SplineMath` | Unity Splines `SplineContainer`, `Spline`, `BezierCurve`, `SplineData<T>`, `SplinePath`, `SplineUtility`, `SplineMath` |
| `TOOLKIT.SplineAnimate` | Unity Splines `SplineAnimate` |
| Enums: `TOOLKIT.CinemachineBlendStyles`, `CinemachineBrainUpdateMethods`, `CinemachineBrainBlendUpdateMethods`, `CinemachineLensOverrideModes`, `CinemachineGateFitMode`, `CinemachineOutputChannels`, `CinemachineStandbyUpdateMode`, `CinemachineStage`, `CinemachineUpdateClock`, `CinemachineUpdateFilter`, `CinemachineBindingMode`, `CinemachineAngularDampingMode`, `CinemachineOrbitalFollowOrbitStyles`, `CinemachineOrbitalFollowReferenceFrames`, `CinemachinePanTiltReferenceFrames`, `CinemachinePanTiltRecenterTargetModes`, `CinemachineDeoccluderResolutionStrategy`, `CinemachineFocusTrackingModes`, `CinemachineGroupFramingModes`, `CinemachineGroupFramingSizeAdjustmentModes`, `CinemachineGroupFramingLateralAdjustmentModes`, `CinemachineTargetGroupPositionModes`, `CinemachineTargetGroupRotationModes`, `CinemachineTargetGroupUpdateMethods`, `CinemachineImpulseShapes`, `CinemachineImpulseTypes`, `CinemachineImpulseDirectionModes`, `CinemachineImpulseDissipationModes`, `CinemachineImpulseRepeatModes`, `CinemachineImpulseSignalCombinationModes`, `CinemachinePostFlavours`, `CinemachineSplineCartUpdateMethods`, `CinemachineSplineDollyRotationMode`, `CinemachineTriggerActionModes`, `CinemachineTriggerTimeModes`, `SplineAnimateMethod`, `SplineAnimateLoopMode`, `SplineAnimateEasingMode`, `SplineAnimateAlignmentMode`, `CinemachineBlendHints`, `CinemachineInputAxisHints`, `SplineAlignAxis`, `SplineBezierTangent`, `SplineTangentMode` | Unity's nested enums with the same values (`CinemachineBlendDefinition.Styles`, `CinemachineBrain.UpdateMethods`, `LensSettings.OverrideModes`, `Camera.GateFitMode`, `OutputChannels`, `CinemachineOrbitalFollow.OrbitStyles`, `CinemachineImpulseDefinition.ImpulseShapes`, `CinemachineTriggerAction.ActionSettings.Mode`, `SplineAnimate.LoopMode` …); `CinemachineBlendHints` = `CinemachineCore.BlendHints`, `CinemachineInputAxisHints` = `InputAxis.AxisHint` (via `IInputAxisOwner.AxisDescriptor.Hints`), `SplineAlignAxis` = `SplineComponent.AlignAxis`, `SplineBezierTangent` = Splines `BezierTangent`, `SplineTangentMode` = Splines `TangentMode` |
| `TOOLKIT.Clipper`, `Clipper64`, `ClipperBase`, `ClipperOffset`, `ClipperInternal`, `ClipperPoint64`, `ClipperPointD`, `ClipperRect64`, `ClipperPath64`, `ClipperPaths64`, `ClipperActive`, `ClipperJoiner`, `ClipperLocalMinima`, `ClipperOutPt`, `ClipperOutRec`, `ClipperVertex`; enums `ClipperClipType`, `ClipperEndType`, `ClipperFillRule`, `ClipperJoinType`, `ClipperPathType`, `ClipperPointInPolygonResult`, `ClipperVertexFlags` | the Clipper2 routines Cinemachine's Confiner 2D vendors (`Clipper`, `Clipper64`, `ClipperBase`, `ClipperOffset`, `InternalClipper`, `Point64`, `PointD`, `Rect64`, `Path64`, `Paths64`, `Active`, `Joiner`, `LocalMinima`, `OutPt`, `OutRec`, `Vertex`; enums `ClipType`, `EndType`, `FillRule`, `JoinType`, `PathType`, `PointInPolygonResult`, `VertexFlags`) |

### Main API

```typescript
const scene: BABYLON.Scene = this.scene;
const brain: TOOLKIT.CinemachineBrain = TOOLKIT.CinemachineCore.GetActiveBrain(scene);      // the first live brain, or null
const cameras: TOOLKIT.CinemachineVirtualCameraBase[] = TOOLKIT.CinemachineCore.GetVirtualCameras(scene);
const closeUp: TOOLKIT.CinemachineCamera = TOOLKIT.SceneManager.GetComponent<TOOLKIT.CinemachineCamera>(closeUpNode, "TOOLKIT.CinemachineCamera");
```

| Member | Notes |
|---|---|
| `CinemachineCore.GetActiveBrain(scene, index?)`, `GetActiveBrains(scene)`, `GetVirtualCameras(scene)`, `IsLive(camera)` | Static lookups, keyed by scene |
| `CinemachineCore.OnCameraActivated` / `OnBlendCreated` / `OnBlendFinished` / `OnCameraDeactivated` / `OnCameraUpdated` | Global observables (every brain and manager) |
| `CinemachineCore.UniformDeltaTimeOverride`, `CurrentTimeOverride` | Seconds; `-1` (default) uses the scene clock |
| `brain.activeVirtualCamera`, `activeBlend`, `isBlending`, `outputCamera` | The live camera, the blend in progress, the Babylon camera rig the brain drives |
| `brain.defaultBlend`, `customBlends`, `updateMethod`, `blendUpdateMethod`, `ignoreTimeScale`, `channelMask` | Unity's brain settings (`CinemachineBrainUpdateMethods`: FixedUpdate 0, LateUpdate 1, SmartUpdate 2, ManualUpdate 3) |
| `brain.onCameraActivatedObservable`, `onBlendCreatedObservable`, `onBlendFinishedObservable`, `onCameraCutObservable`, `onCameraUpdatedObservable` | Per-brain events; each fires once per change |
| `brain.manualUpdate()`, `brain.resetState()` | Update now (ManualUpdate brains, once per frame); forget the current camera so the next one cuts in |
| `camera.priority`, `priorityEnabled`, `prioritize()`, `enabled`, `isLive`, `outputChannel` | Raise the priority (or call `prioritize()`) to make a camera live on the next frame; a disabled camera never goes live |
| `camera.follow`, `lookAt`, `target`, `lens`, `blendHint`, `state` | Retarget at run time by assigning a node; `lens.fieldOfView` is vertical degrees |
| `camera.cancelDamping(updateNow?)`, `forceCameraPosition(position, rotation)`, `getCinemachineComponent(stage)` | Snap, teleport, and find the Body / Aim / Noise / Finalize component |
| `orbitalFollow.horizontalAxis` / `verticalAxis` / `radialAxis`, `panTilt.panAxis` / `tiltAxis` (`TOOLKIT.InputAxis`: `value`, `range`, `wrap`, `recentering`) | Drive the axes from code, or let `CinemachineInputAxisController` read the toolkit input (mouse, gamepad, keyboard) |
| `targetGroup.addMember(node, weight, radius)`, `removeMember(node)`, `findMember(node)` | Group framing members (weight 0–1, radius in metres) |
| `impulseSource.generateImpulse(velocityOrForce?)`, `generateImpulseAt(position, velocity)` | Fire an impulse; listening cameras within the definition's dissipation distance shake |
| `container.evaluatePosition(t, splineIndex?)`, `evaluateTangent`, `evaluateUpVector`, `calculateLength(splineIndex?)` | `TOOLKIT.SplineContainer`; `t` is normalized 0–1, results in world space |
| `splineAnimate.play()`, `pause()`, `restart(autoplay)`, `normalizedTime`, `elapsedTime`, `duration`, `maxSpeed`, `isPlaying` | `TOOLKIT.SplineAnimate`; seconds and metres per second |

### Example

```typescript
/** Cuts to a close-up camera on demand, retargets it, and builds a fallback rig in code when the scene has no brain. */
export class ShotDirector extends TOOLKIT.ScriptComponent {
    /** Priority that beats every authored camera in the scene. */
    private static readonly CLOSE_UP_PRIORITY: number = 50;
    /** Behind-and-above offset of the code-built follow camera, in metres (an exported-bag vector). */
    private static readonly FOLLOW_OFFSET: { x: number; y: number; z: number } = { x: 0, y: 2, z: -6 };
    /** The close-up camera on this node, or null. */
    private closeUp: TOOLKIT.CinemachineCamera = null;
    /** The active brain, or null. */
    private brain: TOOLKIT.CinemachineBrain = null;

    /** Finds the brain and the close-up camera, and logs every finished blend. */
    protected start(): void {
        this.brain = TOOLKIT.CinemachineCore.GetActiveBrain(this.scene);
        this.closeUp = TOOLKIT.SceneManager.GetComponent<TOOLKIT.CinemachineCamera>(this.transform, "TOOLKIT.CinemachineCamera");
        if (this.brain == null) return;
        this.brain.onBlendFinishedObservable.add((blendEvent: TOOLKIT.ICinemachineCameraEvent) => {
            console.log("Now live: " + blendEvent.camera.name);
        });
    }

    /**
     * Makes the close-up live (the brain blends with its default or custom blend) and points it at a new subject.
     * @param subject The node the close-up follows and frames.
     */
    public showCloseUp(subject: BABYLON.TransformNode): void {
        if (this.closeUp == null) return;
        this.closeUp.follow = subject;
        this.closeUp.priority = ShotDirector.CLOSE_UP_PRIORITY;
    }

    /**
     * Builds a follow camera entirely in code: a CinemachineCamera, a Follow body and a Rotation Composer aim on a new node.
     * The scene's main camera node needs a brain (`new TOOLKIT.CinemachineBrain(mainCameraNode, scene, {})`) when none was exported.
     * @param subject The node to follow.
     * @returns The new camera.
     */
    public buildFollowRig(subject: BABYLON.TransformNode): TOOLKIT.CinemachineCamera {
        const rigNode: BABYLON.TransformNode = new BABYLON.TransformNode("Code Follow Camera", this.scene);
        const rigCamera: TOOLKIT.CinemachineCamera = new TOOLKIT.CinemachineCamera(rigNode, this.scene, { priority: { enabled: true, value: ShotDirector.CLOSE_UP_PRIORITY } });
        // Settings go in the properties bag: a component reads it on its first frame, so a field set right after `new` would be overwritten.
        new TOOLKIT.CinemachineFollow(rigNode, this.scene, { followOffset: ShotDirector.FOLLOW_OFFSET });
        new TOOLKIT.CinemachineRotationComposer(rigNode, this.scene, {});
        rigCamera.follow = subject; // a target set in code before the first frame wins over the bag
        return rigCamera;
    }
}
```

### Units

Positions and offsets in metres, angles and field of view in degrees (`lens.fieldOfView` is vertical), blend and damping times in seconds, axis speeds as authored in Unity, spline positions normalized 0–1 unless a unit is named (`PathIndexUnit` Distance / Normalized / Knot). Vectors use Unity's axes as exported (left-handed, Y up).

### Coexistence

- The brain owns its camera node and rig. It stands down while a `TOOLKIT.PlayableDirector` binds a camera track to that camera, and while the Starter Assets first-person controller holds the rig; it resumes with a cut when they release it.
- A Starter Assets `DefaultCameraSystem` in control mode 1–3 also moves the camera: the brain warns once and keeps writing it (use control mode 0).
- Without a physics engine the Deoccluder, Decollider, Third Person Follow obstacle avoidance and collision impulses run as "no obstacles" and warn once.
- Per-camera post-processing blends a Cinemachine volume (priority 999, role `"cinemachine"`) on top of the scene's `TOOLKIT.PostProcessor` volumes; edit it like any other volume.

### Deviations from Unity

- A **ManualUpdate** brain places its camera once when it starts (Cinemachine 2's first-scene-load update), then moves only on `manualUpdate()`. Cinemachine 3 skips that update; the exported data does not say which version authored the brain, so every ManualUpdate brain does it.
- Cinemachine 2 lenses whose mode follows the camera take the output camera's **sensor size and gate fit** at export (Cinemachine 2 reads them from the camera every frame).
- Deoccluder / Decollider / Third Person obstacle casts use `TOOLKIT.RigidbodyPhysics` ray and sphere casts (Havok) instead of PhysX overlap tests; a tag-ignored hit re-casts past it (up to 16 times). Re-enabling a Deoccluder or Decollider keeps its per-camera state.
- Confiner 2D does not bake `CircleCollider2D` shapes (Unity's does not either); its skeleton bake spends up to 1/120 s per frame.
- Collision impulses take Unity's trigger path for both collisions and triggers (Babylon contacts carry no relative velocity); `ignoreTimeScale` impulses use `performance.now()`. `TargetPositionCache` (Timeline scrubbing cache) is not ported.
- Perlin noise and impulse reactions are seeded per node, so a shake is the same on every load.
- Timeline: shots play live through `TOOLKIT.CinemachineTimeline`; the `TOOLKIT.PlayableDirector` bake stays the fallback. Behaviours on a shot camera that was never enabled keep their defaults until it is enabled.
- A spline with no knots evaluates to `+Infinity` (as Unity); exported knots keep their stored tangents (auto-smoothing runs only for code-built splines). Unity's `BezierCurve` is `TOOLKIT.SplineCurve`.
- Code-built rigs with no input controller get the Cinemachine editor's default controls.

Change cameras, blends and splines in Unity and re-export; set priorities, targets and axes from code at run time.

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
