# TOOLKIT.SceneManager — Agent Reference

> **Type:** Static class (no instantiation needed)  
> **Namespace:** `TOOLKIT`  
> **Role:** The central hub for all runtime operations — scene loading, component discovery, timing, physics, navigation, shadows, messaging, and utilities.

---

## Import

```typescript
import * as TOOLKIT from "@babylonjs-toolkit/next";
// named imports are equivalent: import { SceneManager, SearchType } from "@babylonjs-toolkit/next";
```

---

## Static Properties

### Global Configuration
```typescript
TOOLKIT.SceneManager.Version              // string — "9.16.1 - R1"
TOOLKIT.SceneManager.Copyright            // string
TOOLKIT.SceneManager.GlobalOptions        // any    — freeform key/value config store
TOOLKIT.SceneManager.WindowState          // any    — window-scoped key/value store
TOOLKIT.SceneManager.ServerEndPoint       // string — network game server URL
TOOLKIT.SceneManager.EnableDebugMode      // boolean
TOOLKIT.SceneManager.EnableUserInput      // boolean
TOOLKIT.SceneManager.RenderLoopReady      // boolean
TOOLKIT.SceneManager.PauseRenderLoop      // boolean
TOOLKIT.SceneManager.ParseScriptComponents  // boolean — auto-parse components (default true)
TOOLKIT.SceneManager.AutoLoadScriptBundles  // boolean
TOOLKIT.SceneManager.AnimationTargetFps     // number — glTF animation FPS (default 60)
TOOLKIT.SceneManager.AnimationStartMode    // number — 0 = NONE
TOOLKIT.SceneManager.PhysicsCapsuleShape   // number — 0 = default Havok capsule
```

### Light Intensity Factors
```typescript
TOOLKIT.SceneManager.AmbientLightIntensity      // number (default 1.0)
TOOLKIT.SceneManager.PointLightIntensity        // number (default 1.0)
TOOLKIT.SceneManager.SpotLightIntensity         // number (default 1.0)
TOOLKIT.SceneManager.DirectionalLightIntensity  // number (default 1.0)
```

### Layer Masks
```typescript
TOOLKIT.SceneManager.AllLayerMask     // 0xFFFFFFFF
TOOLKIT.SceneManager.DefaultLayerMask // 0x0FFFFFFF
TOOLKIT.SceneManager.HiddenLayerMask  // 0x10000000 (Unity layer 28)
```

### Observables (engine.html integration)
```typescript
TOOLKIT.SceneManager.OnPreRenderLoopObservable   // Observable<void>
TOOLKIT.SceneManager.OnPostRenderLoopObservable  // Observable<void>
TOOLKIT.SceneManager.OnSceneReadyObservable      // Observable<string> — fires with filename
TOOLKIT.SceneManager.OnEngineResizeObservable    // Observable<BABYLON.AbstractEngine>
TOOLKIT.SceneManager.OnLoadCompleteObservable    // Observable<BABYLON.AbstractEngine>
TOOLKIT.SceneManager.OnRebuildContextObservable  // Observable<BABYLON.AbstractEngine>
```

---

## Runtime Initialization

### `InitializePlayground` / `InitializeRuntime`
```typescript
static async InitializePlayground(
    engine: BABYLON.Engine | BABYLON.WebGPUEngine,
    options?: TOOLKIT.IRuntimeOptions,
    scene?: BABYLON.Scene,
    inputOptions?: { contextMenu?: boolean, pointerLock?: boolean, preventDefault?: boolean, useCapture?: boolean }
): Promise<void>
```
Both are aliases; call either one. Must be called **before** loading any scenes.

**`IRuntimeOptions` interface:**
```typescript
interface IRuntimeOptions {
    enableUserInput?: boolean;           // default false
    hardwareScalingLevel?: number;       // default (1/devicePixelRatio)
    initSceneFileLoaders?: boolean;      // default true
    loadAsyncRuntimeLibs?: boolean;      // default true
    loadProjectScriptBundle?: boolean;   // default false
    projectScriptBundleUrl?: string;     // custom bundle URL
    showDefaultLoadingScreen?: boolean;  // default false
    hideLoadingUIWithEngine?: boolean;   // default true
    defaultLoadingUIMarginTop?: string;  // default "150px"
}
```

**Example:**
```typescript
const engine = new BABYLON.Engine(canvas, true);
const scene = new BABYLON.Scene(engine);

await TOOLKIT.SceneManager.InitializeRuntime(engine, {
    enableUserInput: true,
    showDefaultLoadingScreen: true,
    hardwareScalingLevel: 1
});
```

---

## Scene Loading

### `LoadRuntimeAssets`
```typescript
static async LoadRuntimeAssets(
    assetsManager: BABYLON.AssetsManager,
    requiredFilenames: string[],
    readyHandler: () => void,
    maxTimeout?: number,   // default 60 seconds
    debugMode?: boolean    // default false
): Promise<void>
```
Sets up the ready handler then calls `assetsManager.loadAsync()`. The `readyHandler` fires when **all** listed filenames have triggered `OnSceneReadyObservable`.

**Example:**
```typescript
const am = new BABYLON.AssetsManager(scene);
am.addContainerTask("town", "", "assets/", "town.gltf");
am.addContainerTask("player", "", "assets/", "player.gltf");

await TOOLKIT.SceneManager.LoadRuntimeAssets(am, ["town.gltf", "player.gltf"], () => {
    console.log("All scenes ready!");
    // wire up game logic here
});
```

### `SetOnSceneReadyHandler`
```typescript
static SetOnSceneReadyHandler(
    filenames: string[],
    handler: () => void,
    timeout?: number,   // default 60
    debug?: boolean
): void
```
Lower-level alternative when you call `assetsManager.loadAsync()` yourself.

### `InitializeSceneLoaderPlugin`
```typescript
static InitializeSceneLoaderPlugin(): void
```
Must be called before loading glTF files. Hooks into `BABYLON.SceneLoader.OnPluginActivatedObservable` to configure animation fps and skin node naming.

---

## Loading Screen

```typescript
static ShowLoadingScreen(engine, hideWithEngine?: boolean, marginTop?: string): void
static HideLoadingScreen(engine, fade?: boolean): void
static ForceHideLoadingScreen(): void
```

### Splash Screen (React Integration)
```typescript
static ShowSplashScreen(): void
static HideSplashScreen(scene?: BABYLON.Scene, delayMs?: number): void
static UpdateSplashScreenStatus(text: string): void
```

---

## Scene Query Functions

### Finding Nodes
```typescript
// By name (exact) or hierarchy path
static GetTransformNode(scene, name): BABYLON.TransformNode
static GetTransformNodeByID(scene, id): BABYLON.TransformNode
static FindGameObject(scene, path): BABYLON.TransformNode  // "Parent/Child/Node" path search

// By tag (Unity tag system)
static FindGameObjectWithTag(scene, tag): BABYLON.TransformNode
static FindGameObjectsWithTag(scene, tag): BABYLON.TransformNode[]
static GetTransformTag(transform): string
static HasTransformTags(transform, query): boolean

// By script component
static FindTransformWithScript(scene, klass): BABYLON.TransformNode
static FindAllTransformsWithScript(scene, klass): BABYLON.TransformNode[]

// Children of a node
static FindChildTransformNode(parent, name, searchType?, directOnly?, predicate?): BABYLON.TransformNode
static FindChildTransformWithTags(parent, query, directOnly?, predicate?): BABYLON.TransformNode
static FindAllChildTransformsWithTags(parent, query, directOnly?, predicate?): BABYLON.TransformNode[]
static FindChildTransformWithScript(parent, klass, directOnly?, predicate?): BABYLON.TransformNode
static FindAllChildTransformsWithScript(parent, klass, directOnly?, predicate?): BABYLON.TransformNode[]
```

### Finding Script Components
```typescript
static FindScriptComponent<T extends TOOLKIT.ScriptComponent>(
    transform: BABYLON.TransformNode,
    klass: string,
    recursive?: boolean
): T

static FindAllScriptComponents<T extends TOOLKIT.ScriptComponent>(
    transform: BABYLON.TransformNode,
    klass: string,
    recursive?: boolean
): T[]
```

**Example:**
```typescript
// Get the AnimationState on a character
const anim: TOOLKIT.AnimationState = TOOLKIT.SceneManager.FindScriptComponent(
    characterNode, "TOOLKIT.AnimationState"
);

// Get all audio sources in a level
const sounds: TOOLKIT.AudioSource[] = TOOLKIT.SceneManager.FindAllScriptComponents(
    levelRoot, "TOOLKIT.AudioSource", true
);
```

### Meshes and Lights
```typescript
static GetPrimitiveMeshes(transform): BABYLON.AbstractMesh[]
static GetSkinnedMesh(transform): BABYLON.AbstractMesh
static FindSceneLightRig(transform): BABYLON.Light
static FindSceneCameraRig(transform): BABYLON.FreeCamera
static GetDefaultSkybox(scene): BABYLON.AbstractMesh
```

### Metadata
```typescript
static FindSceneMetadata(transform): any  // returns transform.metadata.toolkit
static GetAuxiliaryData(scene): string
static SetAuxiliaryData(scene, data: string): void
```

---

## Timing Functions

```typescript
static GetTime(): number           // wall clock seconds (window.performance.now * 0.001)
static GetTimeMs(): number         // wall clock milliseconds
static GetGameTime(): number       // seconds since GameTimeMilliseconds was set
static GetGameTimeMs(): number     // ms since GameTimeMilliseconds was set
static GetDeltaTime(scene, applyAnimationRatio?): number     // delta seconds
static GetDeltaSeconds(scene, applyAnimationRatio?): number  // delta seconds
static GetDeltaMilliseconds(scene, applyAnimationRatio?): number
static GetAnimationRatio(scene): number  // ratio for 60fps normalization
static GameTimeMilliseconds: number      // timestamp of game start (set manually)
```

**Usage inside a ScriptComponent** (preferred):
```typescript
// Inside update():
const dt = this.getDeltaSeconds(); // calls SceneManager.GetDeltaSeconds(this.scene)
```

---

## System / Utility Functions

```typescript
static RunOnce(scene, func, timeout?): void          // execute once before next render
static DisposeScene(scene, clearColor?): void        // dispose + clear buffer
static SafeDestroy(transform, delay?, disable?): void // dispose after delay ms
static WaitForSeconds(seconds): Promise<void>        // async sleep
static GetRootUrl(scene): string                     // root URL of loaded scene
static SetRootUrl(scene, url): void
static GetSceneFile(scene): string
static FocusRenderCanvas(scene): void
```

---

## Shadow Functions

```typescript
// Add a mesh as shadow caster to a shadow light
static AddShadowCaster(light: BABYLON.ShadowLight, transform, children?: boolean): void

// Add multiple meshes to a shadow light
static AddShadowCastersToLight(light, transforms[], includeChildren?): void

// Force cascade refresh (fixes CSM visual glitches after runtime changes)
static RefreshShadowCascades(light): void
static RefreshAllShadowCascades(scene): void
```

---

## Physics Integration

```typescript
// Debug viewer toggle
static TogglePhysicsViewer(scene): void
static IsPhysicsViewerEnabled(): boolean
```

### Navigation (Recast/Detour)
```typescript
static GetNavigationPlugin(): ADDONS.RecastNavigationJSPluginV2
static HasNavigationData(): boolean
static GetCrowdInterface(scene): BABYLON.ICrowd
static MAX_AGENT_COUNT: number
static MAX_AGENT_RADIUS: number
```

---

## Window State (Cross-component Data Store)

```typescript
static SetWindowState(name: string, data: any): void
static GetWindowState<T>(name: string): T
```

**Example (cross-script communication):**
```typescript
// In Script A (store a reference)
TOOLKIT.SceneManager.SetWindowState("playerController", this);

// In Script B (retrieve the reference)
const player = TOOLKIT.SceneManager.GetWindowState<PlayerController>("playerController");
player.takeDamage(10);
```

---

## Global Event Bus

```typescript
// The bus is lazily created on first access
static get EventBus(): TOOLKIT.GlobalMessageBus

// Usage
TOOLKIT.SceneManager.EventBus.OnMessage("event-name", (data) => { /* handle */ });
TOOLKIT.SceneManager.EventBus.PostMessage("event-name", payload);
```

---

## Debug / Logging

```typescript
static IsDebugMode(): boolean
static ConsoleLog(...data): void    // only if debug mode
static ConsoleWarn(...data): void
static ConsoleError(...data): void
static LogMessage(message): void   // via BABYLON.Tools.Log
static LogWarning(warning): void
static LogError(error): void
```

---

## Render Quality

```typescript
enum RenderQuality { High = 0, Medium = 1, Low = 2 }

static GetRenderQuality(): TOOLKIT.RenderQuality
static SetRenderQuality(quality: TOOLKIT.RenderQuality): void
static GetIntensityFactor(): number  // global IBL intensity multiplier
```

---

## Class Registration

```typescript
static GetClass(name: string): any
static RegisterClass(name: string, klass: any): void
// BT uses this internally to register custom GUI controls and script component classes
```

---

## Engine Helper

```typescript
static GetEngine(scene): BABYLON.Engine | BABYLON.WebGPUEngine
static GetEngineVersionString(scene): string  // e.g. "WebGL 2.0 - NVIDIA RTX 3090"
static GetImageBasedLighting(scene): BABYLON.SphericalPolynomial
```

---

## SceneManager Fog Density Scales

```typescript
TOOLKIT.SceneManager.FogExpDensityScale     // number (default 1.0)
TOOLKIT.SceneManager.FogExp2DensityScale    // number (default 1.0)
TOOLKIT.SceneManager.FogLinearDensityScale  // number (default 1.0)
```

---

## Camera / Input Flags

```typescript
TOOLKIT.SceneManager.AllowCameraMovement   // boolean (default true)
TOOLKIT.SceneManager.AllowCameraRotation   // boolean (default true)
TOOLKIT.SceneManager.VirtualJoystickEnabled // boolean (default false)
```

---

## Playground Constants

```typescript
static get PlaygroundCdn(): string
// "https://cdn.jsdelivr.net/gh/BabylonJS/BabylonToolkit@master/Runtime/"

static get PlaygroundRepo(): string
// "https://www.babylontoolkit.com/playground/"
```
