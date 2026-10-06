# Enums & Interfaces Reference

> All enums and interfaces are in the `TOOLKIT` namespace unless otherwise noted.

---

## Import

```typescript
import * as TOOLKIT from "@babylonjs-toolkit/next";
// named imports are equivalent: import { SearchType, PlayerNumber, UserInputKey, CollisionFilters } from "@babylonjs-toolkit/next";
```

---

## Core Enums

### `System` (Constants Enum)

```typescript
enum System {
    // Math
    Deg2Rad,                        // Math.PI / 180
    Rad2Deg,                        // 180 / Math.PI
    Epsilon = 0.000001,
    SingleEpsilon = 1.401298e-45,
    EpsilonNormalSqrt = 1e-15,

    // Unit conversion
    Kph2Mph = 0.621371,
    Mph2Kph = 1.60934,
    Mps2Kph = 3.6,
    Mps2Mph = 2.23694,
    Meter2Inch = 39.3701,
    Inch2Meter = 0.0254,

    // Physics
    Gravity = 9.81,
    Gravity3G = 29.4,
    SkidFactor = 0.25,
    WalkingVelocity = 4.4,          // 4 km/h
    TerminalVelocity = 55,

    // Misc
    MaxInteger = 2147483647,
    SmoothDeltaFactor = 0.2,
    ToLinearSpace = 2.2,
    ToGammaSpace = 0.45454545454545453,
}
```

> Layer-mask constants live on `TOOLKIT.SceneManager`, not `System`:
> `SceneManager.AllLayerMask`, `SceneManager.DefaultLayerMask`, `SceneManager.HiddenLayerMask`,
> plus `SceneManager.GetLayerMask(layer)` / `SceneManager.IsLayerMasked(mask, layer)`.

---

### `SearchType`

```typescript
enum SearchType {
    ExactMatch    = 0,   // transform.name === query
    StartsWith    = 1,   // transform.name.startsWith(query)
    EndsWith      = 2,   // transform.name.endsWith(query)
    IndexOf       = 3,   // transform.name.includes(query)
}
```

Used in all `FindChildTransformNode`, `getChildNode` calls.

---

### `PlayerNumber`

```typescript
enum PlayerNumber {
    Auto  = 0,
    One   = 1,
    Two   = 2,
    Three = 3,
    Four  = 4
}
```

---

### `PlayerControl`

```typescript
enum PlayerControl {
    FirstPerson = 0,
    ThirdPerson = 1
}
```

---

### `RenderQuality`

```typescript
enum RenderQuality {
    High   = 0,
    Medium = 1,
    Low    = 2
}
```

Used with `TOOLKIT.SceneManager.SetRenderQuality(q)`.

---

### `GamepadType`

```typescript
enum GamepadType {
    None           = -1,
    Generic        = 0,
    Xbox360        = 1,
    DualShock      = 2,
    PoseController = 3
}
```

---

### `UserInputAxis`

```typescript
enum UserInputAxis {
    Horizontal   = 0,   // WASD / left stick X
    Vertical     = 1,   // WASD / left stick Y
    ClientX      = 2,   // mouse absolute X
    ClientY      = 3,   // mouse absolute Y
    MouseX       = 4,   // mouse delta X (also right stick X)
    MouseY       = 5,   // mouse delta Y (also right stick Y)
    Wheel        = 6,   // scroll wheel
}
```

> ⚠️ These 7 members are the whole enum — there are no right-stick, D-pad, or trigger axes.
> Triggers: `InputController.GetGamepadTriggerInput(trigger, player)`. D-pad:
> `InputController.GetGamepadDirectionInput(direction, player)`.

---

### `UserInputKey`

Selected important values:

```typescript
enum UserInputKey {
    BackSpace = 8,   Tab = 9,    Enter = 13,  Shift = 16,
    Ctrl = 17,       Alt = 18,   Escape = 27, SpaceBar = 32,
    LeftArrow = 37,  UpArrow = 38, RightArrow = 39, DownArrow = 40,
    Insert = 45,     Delete = 46,
    Num0 = 48, Num1 = 49, Num2 = 50, Num3 = 51, Num4 = 52,
    Num5 = 53, Num6 = 54, Num7 = 55, Num8 = 56, Num9 = 57,
    A = 65, B = 66, C = 67, D = 68, E = 69, F = 70,
    G = 71, H = 72, I = 73, J = 74, K = 75, L = 76,
    M = 77, N = 78, O = 79, P = 80, Q = 81, R = 82,
    S = 83, T = 84, U = 85, V = 86, W = 87, X = 88,
    Y = 89, Z = 90,
    F1 = 112, F2 = 113, F3 = 114, F4 = 115,
    F5 = 116, F6 = 117, F7 = 118, F8 = 119,
    F9 = 120, F10 = 121, F11 = 122, F12 = 123,
    Numpad0 = 96, Numpad1 = 97, Numpad2 = 98, Numpad3 = 99,
    Numpad4 = 100, Numpad5 = 101, Numpad6 = 102, Numpad7 = 103,
    Numpad8 = 104, Numpad9 = 105,
    Multiply = 106, Add = 107, Subtract = 109,
    DecimalPoint = 110, Divide = 111,
}
```

> ⚠️ The space key is **`SpaceBar`** (not `Space`), digits are **`Num0`–`Num9`** (not `Alpha0`–`Alpha9`),
> and the numpad operators are **`Multiply`/`Add`/`Subtract`/`DecimalPoint`/`Divide`** (no `Numpad` prefix).

---

### `CollisionFilters`

```typescript
enum CollisionFilters {
    DefaultFilter    = 1,
    StaticFilter     = 2,
    KinematicFilter  = 4,
    DebrisFilter     = 8,
    SensorTrigger    = 16,
    CharacterFilter  = 32,
    AllFilter        = -1
}
```

Used with `setCollisionFilters(group, mask)`.

---

### `CollisionState`

```typescript
enum CollisionState {
    ACTIVE_TAG           = 1,   // normal active dynamic body
    ISLAND_SLEEPING      = 2,   // sleeping / deactivated
    WANTS_DEACTIVATION   = 3,   // pending deactivation
    DISABLE_DEACTIVATION = 4,   // never deactivate
    DISABLE_SIMULATION   = 5    // simulation disabled
}
```

Bullet-style activation states for physics bodies.

---

### `CollisionFlags`

```typescript
enum CollisionFlags {
    CF_STATIC_OBJECT                    = 1,
    CF_KINEMATIC_OBJECT                 = 2,
    CF_NO_CONTACT_RESPONSE              = 4,
    CF_CUSTOM_MATERIAL_CALLBACK         = 8,
    CF_CHARACTER_OBJECT                 = 16,
    CF_DISABLE_VISUALIZE_OBJECT         = 32,
    CF_DISABLE_SPU_COLLISION_PROCESSING = 64,
    CF_HAS_CONTACT_STIFFNESS_DAMPING    = 128,
    CF_HAS_CUSTOM_DEBUG_RENDERING_COLOR = 256,
    CF_HAS_FRICTION_ANCHOR              = 512,
    CF_HAS_COLLISION_SOUND_TRIGGER      = 1024
}
```

---

### `AnimatorParameterType`

```typescript
enum AnimatorParameterType {
    Float   = 1,
    Int     = 3,
    Bool    = 4,
    Trigger = 9
}
```

---

## Runtime Option Interfaces

### `IRuntimeOptions`

```typescript
interface IRuntimeOptions {
    enableUserInput?: boolean;
    hardwareScalingLevel?: number;
    initSceneFileLoaders?: boolean;
    loadAsyncRuntimeLibs?: boolean;
    loadProjectScriptBundle?: boolean;
    projectScriptBundleUrl?: string;
    showDefaultLoadingScreen?: boolean;
    hideLoadingUIWithEngine?: boolean;
    defaultLoadingUIMarginTop?: string;
}
```

---

### `IAssetPreloader`

```typescript
interface IAssetPreloader {
    addPreloaderTasks(assetsManager: TOOLKIT.PreloadAssetsManager): void;
}
```

Implement on a component to hook into the asset loading pipeline.

---

## Loading Progress Interfaces

### `ILoaderStatus`

```typescript
// One scene loader status update (SceneManager.OnLoaderStatusObservable). Null fields are unchanged since the last update.
interface ILoaderStatus {
    status: string;     // status line, e.g. "LOADING TERRAIN 45%" or "COMPILING SHADERS 67%"
    details: string;    // detail line, e.g. "LOADING TERRAIN TEXTURES", "LOADING 3 OF 7 ASSETS" or "140 OF 210 READY"
    progress: number;   // progress of the current loading state, 0 to 1 (null when the update carries none)
    state: number;      // TOOLKIT.Utilities loading state (0 load content, 1 parse transforms, 2 parse metadata, 3 asset preloader, 4 prepare viewport)
}
```

### `ILoadingJobProgress`

```typescript
// One loading-job update, published on LoadingProgress.OnProgressObservable
interface ILoadingJobProgress {
    scene: BABYLON.Scene;   // the scene being loaded
    key: string;            // unique job key within the scene, e.g. "terrain:Terrain_0_0" or "skins"
    title: string;          // display group: "Terrain", "Skins", "Animations", "Navigation", "Water" or "Ray tracing"
    stageLabel: string;     // what the job is doing now, e.g. "Loading terrain textures"
    jobProgress: number;    // progress of this job, 0 to 1 (never goes back)
    groupProgress: number;  // combined progress of every job with this title, 0 to 1
    sceneProgress: number;  // weighted progress of every job in the scene, 0 to 1 (what the splash bar shows)
    complete: boolean;      // true on the job's final update
}
```

### `ITerrainLoadProgress`

```typescript
// One terrain loading update (TerrainBuilder.onLoadProgressObservable per terrain, TerrainBuilder.OnLoadProgressObservable for all)
interface ITerrainLoadProgress {
    terrain: TOOLKIT.TerrainBuilder;  // the terrain reporting
    stage: string;          // heightmap, collision, textures, surface, trees, details, settle, shaders or complete
    label: string;          // readable stage label, e.g. "Loading terrain textures"
    stageProgress: number;  // progress inside the stage, 0 to 1
    progress: number;       // progress of this terrain's whole load, 0 to 1 (never goes back)
    complete: boolean;      // true on the final update (loaded, failed or disposed)
    failed: boolean;        // true when the terrain could not be built (complete is true as well)
}
```

---

## Unity-Exported Data Interfaces

These interfaces describe how Unity component references are serialized into script property bags.

### `IUnityTransform`

```typescript
interface IUnityTransform {
    type: string;        // "Transform"
    id: string;          // Unity object id
    tag: string;         // Unity tag
    name: string;        // Unity GameObject name (use GetTransformNode to look up)
    layer: number;       // Unity layer number
}
```

**Usage:**
```typescript
const spawnData = this.getProperty<TOOLKIT.IUnityTransform>("spawnPoint");
const spawnNode = TOOLKIT.SceneManager.GetTransformNode(this.scene, spawnData.name);
```

---

### `IUnityCurve`

```typescript
interface IUnityCurve {
    type: string;         // "AnimationCurve"
    length: number;       // number of keyframes
    prewrapmode: string;
    postwrapmode: string;
    animation: any;       // serialized animation curve data
}
```

> ⚠️ There is no `SceneManager.EvaluateCurve` helper. The keyframe data arrives in the
> `animation` field; parsed `BABYLON.Animation` objects can be sampled with
> `TOOLKIT.Utilities.SampleAnimationFloat(animation, time)`.

---

### `IUnityMaterial`

```typescript
interface IUnityMaterial {
    type: string;        // "Material"
    id: string;          // Unity asset id
    name: string;        // material name in Babylon.js scene
    shader: string;      // Unity shader name
    gltf: number;        // glTF material index
}
```

**Usage:**
```typescript
const matData = this.getProperty<TOOLKIT.IUnityMaterial>("targetMaterial");
const mat = this.scene.getMaterialByName(matData.name) as TOOLKIT.CustomShaderMaterial;
```

---

### `IUnityTexture`

```typescript
interface IUnityTexture {
    type: string;        // "Texture2D" | "RenderTexture" | etc.
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

### `IUnityAudioClip`

```typescript
interface IUnityAudioClip {
    type: string;        // "AudioClip"
    name: string;
    filename: string;    // relative URL to audio file
    length: number;      // clip duration in seconds
    channels: number;
    frequency: number;
    samples: number;
}
```

**Usage:**
```typescript
const clipData = this.getProperty<TOOLKIT.IUnityAudioClip>("gunshotClip");
const sound = new BABYLON.Sound(clipData.name, clipData.filename, this.scene, null, {
    loop: false,
    autoplay: false
});
```

---

### `IUnityVideoClip`

```typescript
interface IUnityVideoClip {
    type: string;        // "VideoClip"
    name: string;
    filename: string;    // video file URL
    length: number;      // duration in seconds
    width: number;
    height: number;
    framerate: number;
    framecount: number;
}
```

---

### `IUnityVector2 / IUnityVector3 / IUnityVector4`

```typescript
interface IUnityVector2 { x: number; y: number; }
interface IUnityVector3 { x: number; y: number; z: number; }
interface IUnityVector4 { x: number; y: number; z: number; w: number; }
```

---

### `IUnityColor`

```typescript
interface IUnityColor {
    r: number;  // [0..1]
    g: number;
    b: number;
    a: number;
}
```

**Converting to Babylon:**
```typescript
const colorData = this.getProperty<TOOLKIT.IUnityColor>("tintColor");
const babylonColor = new BABYLON.Color4(colorData.r, colorData.g, colorData.b, colorData.a);
```

---

### `IWindowMessage`

```typescript
interface IWindowMessage {
    source: string;        // sender identifier
    command: string;       // command name / type
    [key: string]: any;    // arbitrary additional data fields
}
```

Used with `window.postMessage` cross-frame communication.

---

## Metadata Structure

Unity scene exports store all component metadata in `node.metadata.toolkit`. The structure is:

```typescript
interface NodeMetadata {
    // Core identity
    prefab: boolean;
    objectId: string;
    objectName: string;
    objectTag: string;
    objectLayer: number;
    
    // Script components
    components: Array<{
        alias: string;       // e.g. "TOOLKIT.AnimationState"
        klass: string;       // full registered class name
        properties: any;     // serialized Inspector values
    }>;
    
    // Specialized sub-objects (if present)
    animator: any;           // AnimatorController metadata
    physics: any;            // Physics shape metadata
    navigation: any;         // Navigation agent parameters
    audio: any;              // AudioSource metadata
    particles: any;          // unused — particles arrive as a components[] entry (TOOLKIT.ShurikenParticles)
    postprocessing: any;     // Volume effects data
    terrain: any;            // Terrain data
    vehicle: any;            // WheelCollider / vehicle data
}
```

---

## `GlobalMessageBus`

```typescript
class GlobalMessageBus {
    OnMessage<T>(message: string, handler: (data: T) => void): void
    PostMessage(message: string, data?: any, target?: string, transfer?: Transferable[]): void
    RemoveHandler(message: string, handler: (data: any) => void): void
    ResetHandlers(): void
    Dispose(): void
}
```

**Usage:**
```typescript
// Subscribe
TOOLKIT.SceneManager.EventBus.OnMessage("player:died", (data) => {
    showDeathScreen(data.position);
});

// Publish
TOOLKIT.SceneManager.EventBus.PostMessage("player:died", {
    position: this.transform.position.clone(),
    killerId: attackerId
});

// Unsubscribe
const handler = (data) => { /* ... */ };
TOOLKIT.SceneManager.EventBus.OnMessage("item:collected", handler);
// ... later:
TOOLKIT.SceneManager.EventBus.RemoveHandler("item:collected", handler);
```

---

## `IAnimatorEvent` Interface

Returned by `AnimationState.onAnimationEventObservable`:

```typescript
interface IAnimatorEvent {
    id: number;                  // event id
    clip: string;                // animation clip name
    time: number;                // event time within the clip
    function: string;            // function name set in Unity Animation Event
    intParameter: number;
    floatParameter: number;
    stringParameter: string;
    objectIdParameter: string;   // Unity Object reference id
    objectNameParameter: string; // Unity Object reference name
}
```
