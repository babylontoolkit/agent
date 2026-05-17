# Enums & Interfaces Reference

> All enums and interfaces are in the `TOOLKIT` namespace unless otherwise noted.

---

## Core Enums

### `System` (Constants Object)

```typescript
namespace TOOLKIT {
    const System = {
        // Math
        Deg2Rad: 0.017453292519943295,   // Math.PI / 180
        Rad2Deg: 57.29577951308232,      // 180 / Math.PI
        
        // Common layer constants
        AllLayerMask:     0xFFFFFFFF,
        DefaultLayerMask: 0x0FFFFFFF,
        HiddenLayerMask:  0x10000000,

        // Named layer bits (Unity layer numbers)
        DefaultLayer:     0x00000001,  // layer 0
        TransparentFXLayer: 0x00000002, // layer 1
        IgnoreRaycastLayer: 0x00000004, // layer 2
        WaterLayer:       0x00000010,  // layer 4
        UILayer:          0x00000020,  // layer 5

        // Physics
        DefaultGravity:   -9.81,
        MeterToUnit:      1.0,
        UnitToMeter:      1.0,
    };
}
```

---

### `SearchType`

```typescript
enum SearchType {
    ExactMatch    = 0,   // transform.name === query
    StartsWith    = 1,   // transform.name.startsWith(query)
    EndsWith      = 2,   // transform.name.endsWith(query)
    Contains      = 3,   // transform.name.includes(query)
}
```

Used in all `FindChildTransformNode`, `getChildNode` calls.

---

### `PlayerNumber`

```typescript
enum PlayerNumber {
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
    FirstPersonCamera  = 0,
    ThirdPersonCamera  = 1,
    UniversalCamera    = 2,
    FollowCamera       = 3,
    ArcRotateCamera    = 4,
    VirtualJoystick    = 5,
    FreeCameraDevice   = 6,
    GamepadTeleporter  = 7,
    CustomController   = 8,
    NavigationMesh     = 9,
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
    None      = -1,
    Generic   = 0,
    Xbox360   = 1,
    DualShock = 2,
    Switch    = 4
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
    MouseX       = 4,   // mouse delta X
    MouseY       = 5,   // mouse delta Y
    Wheel        = 6,   // scroll wheel
    RightStickX  = 7,
    RightStickY  = 8,
    DPadX        = 9,
    DPadY        = 10,
    LeftTrigger  = 11,
    RightTrigger = 12,
}
```

---

### `UserInputKey`

Selected important values:

```typescript
enum UserInputKey {
    BackSpace = 8,   Tab = 9,    Enter = 13,  Shift = 16,
    Ctrl = 17,       Alt = 18,   Escape = 27, Space = 32,
    LeftArrow = 37,  UpArrow = 38, RightArrow = 39, DownArrow = 40,
    Delete = 46,
    Alpha0 = 48, Alpha1 = 49, Alpha2 = 50, Alpha3 = 51, Alpha4 = 52,
    Alpha5 = 53, Alpha6 = 54, Alpha7 = 55, Alpha8 = 56, Alpha9 = 57,
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
    NumpadMultiply = 106, NumpadAdd = 107, NumpadSubtract = 109,
    NumpadDecimal = 110,  NumpadDivide = 111,
}
```

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
    Active          = 0,   // normal dynamic simulation
    Inactive        = 1,   // frozen / sleeping
    ActiveVelocity  = 2,   // kinematic, driven by velocity
    ActiveTransform = 3    // kinematic, driven by transform
}
```

Used with `setCollisionState(state)`.

---

### `CollisionFlags`

```typescript
enum CollisionFlags {
    Static    = 0,
    Kinematic = 1,
    Dynamic   = 2
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
    addSceneAssets(manager: BABYLON.AssetsManager): void;
}
```

Implement on a component to hook into the asset loading pipeline.

---

## Unity-Exported Data Interfaces

These interfaces describe how Unity component references are serialized into script property bags.

### `IUnityTransform`

```typescript
interface IUnityTransform {
    type: string;        // "Transform"
    name: string;        // Unity GameObject name (use FindTransformNode to look up)
    tag: string;         // Unity tag
    layer: number;       // Unity layer number
}
```

**Usage:**
```typescript
const spawnData = this.getProperty<TOOLKIT.IUnityTransform>("spawnPoint");
const spawnNode = TOOLKIT.SceneManager.FindTransformNode(this.scene, spawnData.name);
```

---

### `IUnityCurve`

```typescript
interface IUnityCurve {
    type: string;        // "AnimationCurve"
    length: number;      // number of keyframes
    preWrapMode: number;
    postWrapMode: number;
    keys: Array<{
        time: number;
        value: number;
        inTangent: number;
        outTangent: number;
    }>;
}
```

**Evaluating a curve:**
```typescript
const curve = this.getProperty<TOOLKIT.IUnityCurve>("damageCurve");
// Evaluate at normalized time t
const value = TOOLKIT.SceneManager.EvaluateCurve(curve, t);
```

---

### `IUnityMaterial`

```typescript
interface IUnityMaterial {
    type: string;        // "Material"
    name: string;        // material name in Babylon.js scene
    filename: string;    // Unity asset path
    embedded: boolean;   // embedded in glTF buffer
    shader: string;      // Unity shader name
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
    type: string;        // "Texture2D" | "RenderTexture" | "Cubemap"
    name: string;
    filename: string;
    embedded: boolean;
    wrapU: number;       // 0=Repeat, 1=Clamp, 2=Mirror
    wrapV: number;
    filterMode: number;  // 0=Point, 1=Bilinear, 2=Trilinear
    anisoLevel: number;
    width: number;
    height: number;
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
    width: number;
    height: number;
    frameRate: number;
    length: number;      // duration in seconds
    frameCount: number;
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
    source: string;    // sender identifier
    message: string;   // event name / type
    payload?: any;     // arbitrary data
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
    particles: any;          // Shuriken particle system data
    postprocessing: any;     // Volume effects data
    terrain: any;            // Terrain data
    vehicle: any;            // WheelCollider / vehicle data
}
```

---

## `GlobalMessageBus`

```typescript
class GlobalMessageBus {
    OnMessage(event: string, handler: (payload: any) => void): void
    OffMessage(event: string, handler: (payload: any) => void): void
    PostMessage(event: string, payload?: any): void
    ClearMessage(event: string): void
    ClearAllMessages(): void
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
TOOLKIT.SceneManager.EventBus.OffMessage("item:collected", handler);
```

---

## `IAnimatorEvent` Interface

Returned by `AnimationState.onAnimationEventObservable`:

```typescript
interface IAnimatorEvent {
    name: string;        // function name set in Unity Animation Event
    time: number;        // float parameter
    intParameter?: number;
    stringParameter?: string;
    objectParameter?: any;  // Unity Object reference
}
```
