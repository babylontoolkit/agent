# Babylon Toolkit — Starter Game System
## AI Agent Component Reference (v2024)

> **Purpose:** This document is a complete technical reference for agentic AI systems. It covers every class, property, method, enum, interface, and pattern in the Babylon Toolkit Starter System. Use this document to architect any game genre — first/third-person character games, multiplayer experiences, physics simulations — from design through publishing.

---

## Import

```typescript
import * as TOOLKIT from "@babylonjs-toolkit/next";
import { DefaultCameraSystem, StandardPlayerController, ThirdPersonPlayerController, DebugInformation, AssetPreloader, MobileInputController } from "@babylonjs-toolkit/next/project";
// PROJECT starter classes are ONLY available from "@babylonjs-toolkit/next/project" — they are NOT exported from the root import.
// ⚠️ The Colyseus networking classes (ColyseusGameServer, ColyseusNetworkEntity, ColyseusNetworkAvatar, BABYLON.NetworkManager) ship in the starter script bundle only — they are NOT in the npm package.
```

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Core Concepts & Conventions](#2-core-concepts--conventions)
3. [Component Registry](#3-component-registry)
4. [SYSTEM: Camera](#4-system-camera)
5. [SYSTEM: Player Controllers](#5-system-player-controllers)
6. [SYSTEM: Network / Multiplayer](#6-system-network--multiplayer)
7. [SYSTEM: Asset Loading](#7-system-asset-loading)
8. [SYSTEM: Physics Joints](#8-system-physics-joints)
9. [SYSTEM: Materials](#9-system-materials)
10. [SYSTEM: Mobile Input](#10-system-mobile-input)
11. [SYSTEM: Inspector / Debug](#11-system-inspector--debug)
12. [TOOLKIT Core API Reference](#12-toolkit-core-api-reference)
13. [Game Architecture Blueprints](#13-game-architecture-blueprints)
14. [Publishing Checklist](#14-publishing-checklist)
15. [Code Examples](#15-code-examples)

---

## 1. System Architecture Overview

The Starter System is the foundational layer for all Babylon Toolkit games. It provides camera management, character controllers, network infrastructure, asset loading, physics joints, material systems, and mobile input — everything needed to publish a complete game.

```
Scene
├── CameraSystem (GameObject tagged "MainCamera")
│   └── PROJECT.DefaultCameraSystem      ← Main camera + post-processing
│
├── GameManager (empty GameObject)
│   ├── PROJECT.DebugInformation          ← Dev tools overlay
│   └── PROJECT.AssetPreloader            ← Pre-load meshes & asset containers
│
├── Player (Prefab with physics body)
│   ├── PROJECT.StandardPlayerController  ← Full-featured 3rd/1st person
│   │   OR
│   ├── PROJECT.ThirdPersonPlayerController ← Pure third-person controller
│   └── (Optional) TOOLKIT.AnimationState
│
├── NetworkManager (Multiplayer)
│   └── PROJECT.ColyseusGameServer        ← Server connection & room join
│
├── [Per networked entity]
│   ├── PROJECT.ColyseusNetworkEntity     ← Create entity in room
│   └── PROJECT.ColyseusNetworkAvatar     ← Avatar mesh management + label
│
├── [Remote players — spawned by network]
│   └── PROJECT.RemotePlayerController   ← Replicated animation from server
│
└── [Physics objects]
    ├── PROJECT.BallSocketJoint
    ├── PROJECT.FixedHingeJoint
    ├── PROJECT.SliderJoint
    ├── PROJECT.PrismaticJoint
    ├── PROJECT.SixdofJoint
    ├── PROJECT.DistanceJoint
    └── PROJECT.LockedJoint
```

---

## 2. Core Concepts & Conventions

### ScriptComponent Base Class

All PROJECT classes extend `TOOLKIT.ScriptComponent`. This provides:

```typescript
// Lifecycle (execution order each frame)
protected awake(): void   // Property deserialization — no component refs yet
protected start(): void   // Component acquisition — scene is ready
protected fixed(): void   // Physics timestep
protected update(): void  // Per-frame game logic
protected late(): void    // Post-physics camera / HUD
protected after(): void   // Post-everything
protected ready(): void   // Fired once when scene is fully ready
protected destroy(): void // Cleanup

// Core access
this.scene: BABYLON.Scene
this.transform: BABYLON.TransformNode
this.getDeltaTime(): number         // Delta time in seconds
this.getDeltaSeconds(): number      // Same as getDeltaTime()
this.isReady(): boolean             // Scene ready flag
this.getProperty<T>(key, default): T   // Read serialized Unity property
this.getComponent(fullClassName): T    // Get script on same transform
this.getChildWithScript(className): BABYLON.TransformNode
this.getCameraRig(): BABYLON.FreeCamera
this.getChildNode(name): BABYLON.TransformNode
this.getTransformTag(): string
```

### Property Serialization

All configurable values are set in Unity Inspector and serialized to `.babylon`. Read them in `awake()`:
```typescript
protected awake(): void {
    this.speed = this.getProperty("speed", this.speed);
    this.enabled = this.getProperty("enabled", this.enabled);
}
```

### Class Registration

Every component class must register itself:
```typescript
TOOLKIT.SceneManager.RegisterClass("PROJECT.MyClass", MyClass);
```

### Full Component Pattern

```typescript
namespace PROJECT {
    export class MyComponent extends TOOLKIT.ScriptComponent {
        public myValue: number = 1.0;

        constructor(transform: BABYLON.TransformNode, scene: BABYLON.Scene, properties: any = {}, alias: string = "PROJECT.MyComponent") {
            super(transform, scene, properties, alias);
        }

        protected awake(): void {
            this.myValue = this.getProperty("myValue", this.myValue);
        }

        protected start(): void {
            // Safe to get other components here
        }

        protected update(): void {
            // Per-frame logic
        }

        protected destroy(): void {
            // Cleanup
        }
    }
    TOOLKIT.SceneManager.RegisterClass("PROJECT.MyComponent", MyComponent);
}
```

---

## 3. Component Registry

| Class | Purpose | Location |
|---|---|---|
| `DefaultCameraSystem` | Main camera, post-processing, split-screen | Camera/ |
| `StandardPlayerController` | Full first/third person character | Player/ |
| `ThirdPersonPlayerController` | Third-person only character | Player/ |
| `RemotePlayerController` | Networked remote player animation | Player/ |
| `ColyseusGameServer` | Colyseus network server connection | Network/ |
| `ColyseusNetworkEntity` | Per-entity network sync | Network/ |
| `ColyseusNetworkAvatar` | Avatar mesh + nameplate management | Network/ |
| `AssetPreloader` | Pre-load mesh/container assets | Loader/ |
| `AssetExporter` | Export / runtime asset scaffold | Loader/ |
| `DebugInformation` | Dev console overlay and shortcuts | Inspector/ |
| `BallSocketJoint` | Havok ball-socket constraint | Physics/ |
| `DistanceJoint` | Havok distance constraint | Physics/ |
| `FixedHingeJoint` | Havok fixed hinge constraint | Physics/ |
| `LockedJoint` | Havok locked 6DOF constraint | Physics/ |
| `PrismaticJoint` | Havok prismatic (slider) constraint | Physics/ |
| `SixdofJoint` | Havok 6-DOF constraint | Physics/ |
| `SliderJoint` | Havok slider constraint | Physics/ |
| `NodeMaterialInstance` | Runtime Node Material instantiation | Material/ |
| `NodeMaterialParticle` | Node Material for particle systems | Material/ |
| `NodeMaterialProcess` | Node Material as post-process effect | Material/ |
| `NodeMaterialTexture` | Node Material texture sampling | Material/ |
| `MobileInputController` | Touch joystick UI layer | Mobile/ |
| `MobileOccludeMaterial` | Occlusion material for mobile | Mobile/ |
| `MobileShadowMaterial` | Shadow material for mobile | Mobile/ |

---

## 4. SYSTEM: Camera

### CLASS: `DefaultCameraSystem`

**Namespace:** `PROJECT`  
**Extends:** `TOOLKIT.ScriptComponent`  
**File:** `Assets/[Starter]/Camera/DefaultCameraSystem.ts`

The universal camera manager. Supports Universal, Free, ArcRotate, WebXR cameras; single-player and split-screen multiplayer (up to 4 players); SSAO and Default Rendering Pipeline post-processing.

#### Static Fields

```typescript
static FOLLOW_SPEED: number = 1.0             // Default follow lerp speed
static OnXRExperienceHelperObservable: BABYLON.Observable<BABYLON.WebXRDefaultExperience>

// Per-player camera instances are protected — use the static accessors instead:
static GetPlayerCamera(scene: BABYLON.Scene, player?: TOOLKIT.PlayerNumber, detach?: boolean): BABYLON.FreeCamera
static GetWebXR(): BABYLON.WebXRDefaultExperience
static IsInWebXR(): boolean
```

#### Static Query API

```typescript
static GetRenderingPipeline(): BABYLON.DefaultRenderingPipeline
// Access the default rendering pipeline for bloom, grain, chromatic aberration, etc.

static GetScreenSpacePipeline(): BABYLON.SSAORenderingPipeline
// Access SSAO pipeline.

static IsCameraSystemReady(): boolean
// True once the camera is fully initialized.

static GetMainCamera(scene: BABYLON.Scene): BABYLON.FreeCamera
// Get the primary (Player 1) free camera.

static GetCameraTransform(scene: BABYLON.Scene, playerNumber: number): BABYLON.TransformNode
// Get the camera boom/transform node for a player slot (1–4).
// Used by VehicleCameraManager to attach.
```

#### Static Multiplayer API

```typescript
static SetMultiPlayerViewLayout(scene: BABYLON.Scene, totalNumPlayers: number): boolean
// Set the viewport layout for 1, 2, 3, or 4 players.
// Split-screen viewports are automatically configured.

static IsMultiPlayerView(): boolean
// True when split-screen is active.
```

#### Instance Properties

| Property | Type | Description |
|---|---|---|
| `mainCamera` | `boolean` | True if this transform is tagged "MainCamera" |
| `cameraType` | `number` | 0=Universal, 1=ArcRotate, 2=WebXR Immersive, 3=WebXR Inline, 4=Free |

#### Instance API

```typescript
isMainCamera(): boolean
getCameraType(): number
getTargetTransform(): BABYLON.TransformNode   // Current follow target
setTargetTransform(target: BABYLON.TransformNode): void  // Set follow target
enableSpatialAudio(value: boolean): void       // Enable/disable spatial audio
```

#### Interface: `IEditorPostProcessing`
Deserialized from Unity. Controls all post-processing pipeline settings: `bloom`, `fxaa`, `grain`, `sharpen`, `chromaticAberration`, `imageProcessing`, `depthOfField`, `glowLayer`, etc.

#### Camera Types

| Value | Type | Description |
|---|---|---|
| `0` | `UniversalCamera` | WASD + mouse, gamepad |
| `1` | `ArcRotateCamera` | Orbit camera around target |
| `2` | `WebXR Immersive VR` | XR headset + controllers |
| `3` | `WebXR Inline` | XR inline (desktop) |
| `4` | `FreeCamera` | Simple free camera |

#### Setup in Scene

1. Create a Camera GameObject, tag it `"MainCamera"`.
2. Attach `PROJECT.DefaultCameraSystem`.
3. In Unity Inspector set `mainCameraType` (0–4).
4. Set `setSpatialAudio`, `setPointerLock`, `renderingPipeline` as needed.
5. For XR: fill `immersiveOptions` object.
6. For split-screen: fill `multiPlayerSetup` with `playerStartupMode` and `stereoSideBySide`.

---

## 5. SYSTEM: Player Controllers

### CLASS: `StandardPlayerController`

**Namespace:** `PROJECT`  
**Extends:** `TOOLKIT.ScriptComponent`  
**File:** `Assets/[Starter]/Player/StandardPlayerController.ts`

Full-featured character controller supporting first-person and third-person views, physics-based movement (Havok `TOOLKIT.CharacterController`), jump, sprint, climb, vault, navigation agent, and animation state integration. Supports multiplayer (up to 4 players).

#### Static Constants

```typescript
static MIN_VERTICAL_VELOCITY: number = 0.01
static MIN_GROUND_DISTANCE: number = 0.15
static MIN_MOVE_EPSILON: number = 0.001
static MIN_TIMER_OFFSET: number = 0
static MIN_SLOPE_LIMIT: number = 0
static PLAYER_HEIGHT: string = "playerHeight"   // Inspector key for height
```

#### Movement Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `enableInput` | `boolean` | `false` | Enable player input |
| `moveSpeed` | `number` | `5.335` | Run speed (m/s) |
| `walkSpeed` | `number` | `2.0` | Walk speed (m/s) |
| `jumpSpeed` | `number` | `10.0` | Jump velocity (m/s) |
| `jumpDelay` | `number` | `0.25` | Min time between jumps (sec) |
| `speedFactor` | `number` | `1.0` | Global speed multiplier |
| `gravitationalForce` | `number` | `3.0` | Gravity multiplier |
| `minFallVelocity` | `number` | `1.0` | Min velocity to trigger fall state |
| `verticalStepSpeed` | `number` | `1.0` | Step-up speed |
| `minStepUpHeight` | `number` | `0.15` | Min step height for auto-step |
| `rigidBodyMass` | `number` | `85.0` | Physics body mass (kg) |
| `airbornTimeout` | `number` | `0.5` | Time to wait before fall triggers |
| `maxAngle` | `number` | `45` | Max walkable slope angle (degrees) |
| `rootMotion` | `boolean` | `false` | Use animation root motion |
| `movementAllowed` | `boolean` | `true` | Global movement enable flag |
| `smoothInputVectors` | `boolean` | `false` | Smooth raw input values |
| `smoothAcceleration` | `boolean` | `false` | Smooth acceleration changes |
| `accelerationSpeed` | `number` | `0.1` | Acceleration ramp rate |
| `decelerationSpeed` | `number` | `0.1` | Deceleration ramp rate |

#### Camera Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `attachCamera` | `boolean` | `false` | Auto-attach scene camera |
| `rotateCamera` | `boolean` | `true` | Camera rotates with player look |
| `mouseWheel` | `boolean` | `true` | Scroll wheel controls zoom |
| `toggleView` | `boolean` | `true` | Allow first/third person toggle |
| `freeLooking` | `boolean` | `false` | Decouple look from movement |
| `eyesHeight` | `number` | `1.55` | First-person eye height (m) |
| `pivotHeight` | `number` | `1.35` | Camera pivot height (m) |
| `maxDistance` | `number` | `5.0` | Max camera boom distance |
| `scrollSpeed` | `number` | `25` | Zoom scroll speed |
| `topLookLimit` | `number` | `60.0` | Max look up angle (degrees) |
| `downLookLimit` | `number` | `30.0` | Max look down angle (degrees) |
| `lowTurnSpeed` | `number` | `15.0` | Slow turn rate at rest |
| `highTurnSpeed` | `number` | `25.0` | Fast turn rate while moving |
| `cameraSmoothing` | `number` | `8` | Camera follow smoothing factor |
| `cameraCollisions` | `boolean` | `true` | Camera occlusion avoidance |
| `minimumDistance` | `number` | `0.5` | Min camera distance to wall |
| `distanceFactor` | `number` | `0.85` | Camera pullback factor |

#### Input Bindings

| Property | Type | Default | Description |
|---|---|---|---|
| `buttonJump` | `number` | `Xbox360Button.A` | Gamepad jump |
| `keyboardJump` | `number` | `UserInputKey.SpaceBar` | Keyboard jump |
| `buttonRun` | `number` | `Xbox360Button.LeftStick` | Gamepad sprint |
| `keyboardRun` | `number` | `UserInputKey.Shift` | Keyboard sprint |
| `buttonCamera` | `number` | `Xbox360Button.Y` | Toggle camera view |
| `keyboardCamera` | `number` | `UserInputKey.P` | Toggle camera view |
| `runKeyRequired` | `boolean` | `true` | Require sprint button |
| `requireSprintButton` | `boolean` | `false` | Alt sprint required flag |
| `playerNumber` | `TOOLKIT.PlayerNumber` | `One` | Player 1–4 slot |
| `postNetworkAttributes` | `boolean` | `false` | Broadcast state to network |

#### Climb / Vault System

| Property | Type | Default | Description |
|---|---|---|---|
| `useClimbSystem` | `boolean` | `false` | Enable ledge climbing |
| `climbVolumeTag` | `string` | `"Climb"` | Tag for climbable volumes |
| `vaultVolumeTag` | `string` | `"Vault"` | Tag for vaultable volumes |
| `rayClimbOffset` | `number` | `0.35` | Climb sensor origin Y offset |
| `rayClimbLength` | `number` | `0.85` | Climb sensor ray length |
| `canClimbObstaclePredicate` | `(action: number) => boolean` | `null` | Override climb logic |

#### Height / Surface Detection

| Property | Type | Default | Description |
|---|---|---|---|
| `rayHeightOffset` | `number` | `5.0` | Height sensor origin offset |
| `rayHeightLength` | `number` | `6.0` | Height sensor ray length |
| `maxHeightRanges` | `any` | `null` | Serialized height-range config |

#### State Query API

```typescript
isAnimationEnabled(): boolean
isRunButtonPressed(): boolean
isJumpButtonPressed(): boolean
getPlayerJumped(): boolean         // True on the frame of jump
getPlayerJumping(): boolean        // True while in jump arc
getPlayerFalling(): boolean        // True while falling down
getPlayerSliding(): boolean        // True while sliding on slope
getPlayerGrounded(): boolean       // True when feet on ground
getFallTriggered(): boolean        // True when fall animation fires
getMovementSpeed(): number         // Actual movement speed this frame
getVerticalVelocity(): number      // Signed vertical velocity
getInputMagnitudeValue(): number   // 0..1 input stick magnitude
getInputMovementVector(): BABYLON.Vector3    // World-space move direction
getPlayerLookRotation(): BABYLON.Vector3     // Euler look rotation
getPlayerMoveDirection(): PROJECT.PlayerMoveDirection
getCameraBoomNode(): BABYLON.TransformNode   // Camera boom pivot
getCameraTransform(): BABYLON.TransformNode  // Active camera transform
getCameraPivotPosition(): BABYLON.Vector3
getCameraPivotRotation(): BABYLON.Quaternion
getAnimationState(): TOOLKIT.AnimationState
getCharacterController(): TOOLKIT.CharacterController
```

#### Climb Contact API

```typescript
getClimbContact(): boolean
getClimbContactNode(): BABYLON.TransformNode
getClimbContactPoint(): BABYLON.Vector3
getClimbContactAngle(): number
getClimbContactNormal(): BABYLON.Vector3
getClimbContactDistance(): number
```

#### Height Contact API

```typescript
getHeightContact(): boolean
getHeightContactNode(): BABYLON.TransformNode
getHeightContactPoint(): BABYLON.Vector3
getHeightContactAngle(): number
getHeightContactNormal(): BABYLON.Vector3
getHeightContactDistance(): number
```

#### Public Input Fields (readable per frame)

```typescript
public playerInputX: number   // Raw horizontal input (-1..1)
public playerInputZ: number   // Raw vertical input (-1..1)
public playerMouseX: number   // Mouse/right stick X
public playerMouseY: number   // Mouse/right stick Y
public inputMagnitude: number // Input vector magnitude
public airbornVelocity: BABYLON.Vector3
public movementVelocity: BABYLON.Vector3
public targetCameraOffset: BABYLON.Vector3
public boomPosition: BABYLON.Vector3
```

#### `PlayerMoveDirection` Enum

```typescript
enum PlayerMoveDirection {
    Stationary    = 0,
    Forward       = 1,
    ForwardLeft   = 2,
    ForwardRight  = 3,
    Backward      = 4,
    BackwardLeft  = 5,
    BackwardRight = 6,
    StrafingLeft  = 7,
    StrafingRight = 8
}
```

#### `AnimationStateParams` Interface

```typescript
interface AnimationStateParams {
    moveDirection: string;   // "Direction" — integer enum
    inputMagnitude: string;  // "Magnitude" — 0..1 float
    horizontalInput: string; // "Horizontal"
    verticalInput: string;   // "Vertical"
    mouseXInput: string;     // "MouseX"
    mouseYInput: string;     // "MouseY"
    heightInput: string;     // "Height" — vertical velocity
    speedInput: string;      // "Speed" — movement speed
    jumpFrame: string;       // "Jumped" — bool trigger
    jumpState: string;       // "Jump" — bool
    actionState: string;     // "Action" — integer
    fallingState: string;    // "FreeFall" — bool
    slidingState: string;    // "Sliding" — bool
    groundedState: string;   // "Grounded" — bool
}
```

---

### CLASS: `ThirdPersonPlayerController`

**Namespace:** `PROJECT`  
**Extends:** `TOOLKIT.ScriptComponent`  
**File:** `Assets/[Starter]/Player/ThirdPersonPlayerController.ts`

A pure third-person character controller. Similar to `StandardPlayerController` but without first-person toggle or camera boom distance management. Simpler camera handling — uses just the scene free camera without boom.

#### Key Differences from `StandardPlayerController`

| Feature | Standard | ThirdPerson |
|---|---|---|
| First/third person toggle | ✓ | ✗ |
| Camera boom / max distance | ✓ | ✗ |
| `eyesHeight` / `pivotHeight` | ✓ | ✗ |
| `topLookLimit` / `downLookLimit` | ✓ | ✗ |
| `rotateCamera` | ✓ | ✗ |

All other properties, state methods, and animation integration are identical to `StandardPlayerController`.

---

### CLASS: `RemotePlayerController`

**Namespace:** `PROJECT`  
**Extends:** `TOOLKIT.ScriptComponent`  
**File:** `Assets/[Starter]/Player/RemotePlayerController.ts`

Drives the `TOOLKIT.AnimationState` of a remotely networked character using buffered network attributes. Reads 14 attribute slots from `TOOLKIT.EntityController.QueryBufferedAttribute`.

#### Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `updateStateParams` | `boolean` | `true` | Apply network attributes to animator |
| `smoothMotionTime` | `number` | `0` | Smooth float interpolation time |
| `smoothInputVectors` | `boolean` | `false` | Use smoothed float for input axes |

#### Network Attribute Map (Buffer Index)

| Index | Name | Type | Description |
|---|---|---|---|
| `0` | Direction | `integer` | `PlayerMoveDirection` enum |
| `1` | Magnitude | `float` | Input magnitude 0..1 |
| `2` | Horizontal | `float` | Input X axis |
| `3` | Vertical | `float` | Input Z axis |
| `4` | MouseX | `float` | Mouse/look X |
| `5` | MouseY | `float` | Mouse/look Y |
| `6` | Height | `float` | Vertical velocity |
| `7` | Speed | `float` | Movement speed |
| `8` | Action | `integer` | Action state enum |
| `9` | Jumped | `bool` | Jump frame trigger |
| `10` | Jump | `bool` | Is jumping |
| `11` | FreeFall | `bool` | Is falling |
| `12` | Sliding | `bool` | Is sliding |
| `13` | Grounded | `bool` | Is grounded |

---

## 6. SYSTEM: Network / Multiplayer

The networking stack uses Colyseus Universal Game Room via `BABYLON.NetworkManager`.

> ⚠️ **Script-bundle only:** `ColyseusGameServer`, `ColyseusNetworkEntity`, `ColyseusNetworkAvatar`,
> and `BABYLON.NetworkManager` are provided by the starter script bundle at runtime — they are
> **not** in the `@babylonjs-toolkit/next` npm package and cannot be imported from it.
> Only `TOOLKIT.EntityController` (attribute queries) and `TOOLKIT.RoomErrorMessage` are npm exports.

### CLASS: `ColyseusGameServer`

**Namespace:** `PROJECT`  
**Extends:** `TOOLKIT.ScriptComponent`  
**File:** `Assets/[Starter]/Network/ColyseusGameServer.ts`

Manages the Colyseus server connection, room creation/joining, and network lifecycle. Singleton accessible via `PROJECT.ColyseusGameServer.Instance`.

#### Static Fields

```typescript
static MAX_FRAME_RATE: number = 200   // Max allowed network update rate
static Instance: PROJECT.ColyseusGameServer  // Singleton accessor
```

#### Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `projectName` | `string` | `"Game Project"` | Project identifier |
| `autoJoinRoom` | `boolean` | `true` | Join room automatically on ready |
| `playerUserName` | `string` | `"Player"` | Default display name |
| `defaultRoomName` | `string` | `"default"` | Room to join |
| `roomLogicModule` | `string` | `"DefaultLogic"` | Server-side logic module |
| `maxClientsAllowed` | `number` | `8` | Max clients per room |
| `patchUpdateRateFps` | `number` | `20` | State sync rate (max 200) |
| `roomSimulateRateFps` | `number` | `60` | Server simulation rate (max 200) |
| `networkBufferingTime` | `number` | `0.15` | Interpolation buffer (sec) |

#### URL Parameters (Overrides)

| Parameter | Overrides |
|---|---|
| `?endpoint=wss://...` | `TOOLKIT.SceneManager.ServerEndPoint` |
| `?player=Name` | `playerUserName` |
| `?room=roomname` | `defaultRoomName` |
| `?host=desc` | Creates a new hosted session |
| `?join=roomId` | Joins existing room by ID |
| `?solo=true` | Forces offline solo play (disables Colyseus) |

#### API Methods

```typescript
async joinRoom(): Promise<void>
// Connect to Colyseus server and join/create a room.
// Called automatically if autoJoinRoom=true.

isSoloSession(): boolean   // True if ?solo=true was passed
isHostSession(): boolean   // True if ?host= was set
getColyseusClient(): Colyseus.Client
```

---

### CLASS: `BABYLON.NetworkManager`

**Module:** `BABYLON`  
**File:** `Assets/[Starter]/Network/ColyseusNetworkManager.ts`

Core static network management class. Handles entity creation/removal, interpolation, attribute posting, remote procedure calls.

#### Static Observables

```typescript
static OnConnectObservable: Observable<IColyseusNetworkUser>
static OnDisconnectObservable: Observable<IColyseusNetworkUser>
static OnJoinRoomObservable: Observable<IColyseusNetworkUser>
static OnLeaveRoomObservable: Observable<number>
static OnCreateEntityObservable: Observable<IColyseusNetworkEntity>
static OnRemoveEntityObservable: Observable<IColyseusNetworkEntity>
static OnChatMessageObservable: Observable<IColyseusChatMessage>
static OnPingReceivedObservable: Observable<any>
static OnErrorMessageObservable: Observable<TOOLKIT.RoomErrorMessage>
static OnRemoteProcedureCallObservable: Observable<any>
```

#### Static State API

```typescript
static IsAvailable(): boolean              // Colyseus library loaded
static IsRoomAttached(): boolean           // Room connected to scene
static HasJoinedRoom(): boolean            // Join confirmed
static GetCurrentUser(): IColyseusNetworkUser
static GetDefaultRoom(): UniversalGameRoom
static GetNetworkTime(): number            // Server time in seconds
static InterpolationBuffer: number         // Buffer delay (default 0.15s)
```

#### Entity Type API

```typescript
static IsLocalNetworkEntity(entity: BABYLON.TransformNode): boolean
static IsRemoteNetworkEntity(entity: BABYLON.TransformNode): boolean
static GetNetworkEntityType(entity: BABYLON.TransformNode): number  // 0=None, 1=Local, 2=Remote
```

#### Room Management

```typescript
static AttachDefaultRoom(scene: BABYLON.Scene, room: UniversalGameRoom): void
static DetachDefaultRoom(): void
```

#### Entity Management

```typescript
static CreateNetworkEntity(
    transform: BABYLON.TransformNode,
    remotePrefab: string,          // Prefab name to spawn on remote clients
    assetContainer: string,        // Asset container holding the prefab
    movementEpsilon: number,
    movementMethod: EntityMovementType,
    interpolationMode: EntityInterpolation,
    syncTransformNode: boolean,
    customHandler: string,
    bufferedAttributes: any,
    creationAttributes: any
): void

static RemoveNetworkEntity(entityId: string): void
```

#### Attribute API

```typescript
static PostNetworkAttributes(transform: BABYLON.TransformNode, attributes: number[]): void
// Post an array of numeric attributes (indexed 0..N) for this entity.
// Remote clients read via TOOLKIT.EntityController.QueryBufferedAttribute

static RegisterCustomInterpolationHandler(
    name: string,
    handler: (entity: IColyseusNetworkEntity, transform: BABYLON.TransformNode, deltaTime: number) => void
): void
```

---

### CLASS: `ColyseusNetworkEntity`

**Namespace:** `PROJECT`  
**Extends:** `TOOLKIT.ScriptComponent`  
**File:** `Assets/[Starter]/Network/ColyseusNetworkEntity.ts`

Manages the network entity lifecycle for a single game object. Automatically creates the entity when the room is joined and destroys it on disconnect.

#### Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `autoCreate` | `boolean` | `true` | Create entity automatically |
| `remotePrefab` | `string` | `null` | Prefab name to spawn remotely |
| `assetContainer` | `string` | `null` | Asset container key |
| `movementEpsilon` | `number` | `0.00001` | Minimum movement threshold |
| `movementMethod` | `EntityMovementType` | `ClientAuthority` | 0=Client, 1=Server |
| `interpolationMode` | `EntityInterpolation` | `Default` | 0=Default, 1=Hermite, 2=Custom |
| `interpolationHandler` | `string` | `null` | Custom handler name for Custom mode |
| `syncTransformNode` | `boolean` | `true` | Sync transform to network |
| `runtimeAttributes` | `EntityAttribute[]` | `null` | Key-value attributes on creation |

#### Enums

```typescript
enum EntityMovementType {
    ClientAuthority = 0,  // Client moves authoritatively
    ServerAuthority = 1   // Server controls position
}

enum EntityInterpolation {
    Default = 0,  // Linear interpolation
    Hermite = 1,  // Hermite spline interpolation
    Custom  = 2   // Custom handler (set interpolationHandler)
}
```

#### API

```typescript
createEntity(): void
// Manually trigger network entity creation.
// Called automatically when autoCreate=true and room is joined.
```

---

### CLASS: `ColyseusNetworkAvatar`

**Namespace:** `PROJECT`  
**Extends:** `TOOLKIT.ScriptComponent`, implements `TOOLKIT.IAssetPreloader`  
**File:** `Assets/[Starter]/Network/ColyseusNetworkAvatar.ts`

Manages avatar mesh loading (male/female GLB rigs) and floating nameplates for networked players.

#### Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `manageLabelTexture` | `boolean` | `true` | Create floating nameplate |
| `textureResolution` | `number` | `512` | Label texture size in pixels |
| `maxLabelWidth` | `number` | `960` | Max label pixel width |
| `minLabelWidth` | `number` | `320` | Min label pixel width |
| `labelOffsetX/Y` | `number` | `0 / 2.0` | Label world-space offset |
| `labelHeight` | `number` | `64` | Label box height (pixels) |
| `labelColor` | `BABYLON.Color3` | Green | Text color |
| `labelAlpha` | `number` | `0.85` | Text alpha |
| `rectColor` | `BABYLON.Color3` | Black | Background rectangle color |
| `rectAlpha` | `number` | `0.65` | Background alpha |
| `fontFamily` | `string` | `"Arial"` | Label font family |
| `fontStyle` | `string` | `"Bold"` | Label font style |
| `fontSize` | `number` | `36` | Label font size |
| `fillRect` | `boolean` | `true` | Draw background rectangle |

The component reads `defaultAvatar`, `maleAnimationRig`, and `femaleAnimationRig` from serialized Unity inspector references (as `.glb` filenames).

---

## 7. SYSTEM: Asset Loading

### CLASS: `AssetPreloader`

**Namespace:** `PROJECT`  
**Extends:** `TOOLKIT.ScriptComponent`, implements `TOOLKIT.IAssetPreloader`  
**File:** `Assets/[Starter]/Loader/AssetPreloader.ts`

Pre-loads mesh files and asset containers before the scene becomes interactive. Hooks into the Babylon.js `AssetsManager` task queue.

#### Inspector Properties

| Key | Type | Description |
|---|---|---|
| `importMeshes` | `string[]` | Array of `.glb`/`.gltf` URLs to import |
| `assetContainers` | `string[]` | Array of container URLs to pre-load |
| `parentMeshes` | `boolean` | Automatically parent loaded meshes to this transform |

#### API

```typescript
addPreloaderTasks(assetsManager: TOOLKIT.PreloadAssetsManager): void
// Called by the TOOLKIT scene system to queue loading tasks.
// Do not call manually.
```

#### Accessing Loaded Assets After Load

```typescript
// Meshes loaded via importMeshes:
const meshes: BABYLON.AbstractMesh[] = TOOLKIT.SceneManager.GetImportMeshes(scene, "mymodel.glb");

// Containers loaded via assetContainers:
const container: BABYLON.AssetContainer = TOOLKIT.SceneManager.GetAssetContainer(scene, "myasset.glb");
```

---

### CLASS: `AssetExporter`

**Namespace:** `PROJECT`  
**Extends:** `TOOLKIT.ScriptComponent`  
**File:** `Assets/[Starter]/Loader/AssetExporter.ts`

Empty scaffold component — a full lifecycle template. Use this as the starting point for any new ScriptComponent. Contains all lifecycle stubs: `awake`, `start`, `fixed`, `update`, `late`, `after`, `ready`, `destroy`.

---

## 8. SYSTEM: Physics Joints

All joints follow the same pattern: read two body references from properties in `awake()`, create the Babylon.js Havok constraint, and dispose it in `destroy()`. Bodies must have `physicsBody` components assigned in Unity.

### `BallSocketJoint`

Creates a `BABYLON.BallAndSocketConstraint`. Allows rotation in all axes, no translation.

```typescript
public bodyA: BABYLON.TransformNode      // First physics body
public bodyB: BABYLON.TransformNode      // Second physics body
public pivotA: BABYLON.Vector3           // Pivot point on body A (local)
public pivotB: BABYLON.Vector3           // Pivot point on body B (local)
public axisA: BABYLON.Vector3            // Axis on body A
public axisB: BABYLON.Vector3            // Axis on body B
public constraint: BABYLON.BallAndSocketConstraint
public collisionsEnabled: boolean = false
```

### `FixedHingeJoint`

Creates a `BABYLON.HingeConstraint`. Rotation around a single axis only.

```typescript
public bodyA: BABYLON.TransformNode
public bodyB: BABYLON.TransformNode
public pivotA/B: BABYLON.Vector3
public axisA/B: BABYLON.Vector3
public constraint: BABYLON.HingeConstraint
public collisionsEnabled: boolean = false
```

### `SliderJoint`

Creates a `BABYLON.SliderConstraint`. Linear translation along a single axis.

```typescript
public constraint: BABYLON.SliderConstraint
// Same body/pivot/axis pattern
```

### `PrismaticJoint`

Creates a `BABYLON.PrismaticConstraint`. Constrained linear translation with optional limits.

```typescript
public constraint: BABYLON.PrismaticConstraint
```

### `DistanceJoint`

Creates a `BABYLON.DistanceConstraint`. Maintains a fixed distance between two bodies.

```typescript
public constraint: BABYLON.DistanceConstraint
public maxDistance: number   // Max separation distance
```

### `LockedJoint`

Creates a `BABYLON.LockConstraint`. Completely locks two bodies together (no DOF).

```typescript
public constraint: BABYLON.LockConstraint
```

### `SixdofJoint`

Creates a `BABYLON.Physics6DoFConstraint`. Full 6-DOF with optional per-axis limits.

```typescript
public constraint: BABYLON.Physics6DoFConstraint
public axisLimits: BABYLON.Physics6DoFLimit[]
// Per-axis limits configurable from inspector
```

### Joint Setup Pattern

All joints:
1. Are attached to the **parent** of the constrained bodies (or the root body).
2. Read `bodyA` and `bodyB` as `IUnityTransform` serialized properties.
3. Call `bodyA.physicsBody.addConstraint(bodyB.physicsBody, constraint)` in `awake()`.
4. Call `constraint.dispose()` in `destroy()`.

---

## 9. SYSTEM: Materials

### CLASS: `NodeMaterialInstance`

**File:** `Assets/[Starter]/Material/NodeMaterialInstance.ts`

Parses and instantiates a Babylon.js Node Material from serialized JSON data at runtime.

```typescript
public getMaterialInstance(): BABYLON.NodeMaterial
```

Inspector properties: `nodeMaterialData` (raw JSON from NME), `setCustomRootUrl` (optional root URL override).

---

### CLASS: `NodeMaterialProcess`

**File:** `Assets/[Starter]/Material/NodeMaterialProcess.ts`

Converts a `NodeMaterialInstance` into a `BABYLON.PostProcess` effect, applied to the current camera.

```typescript
public getPostProcess(): BABYLON.PostProcess
```

Points to a `NodeMaterialInstance` component via `nodeMaterialEditor` transform reference. Automatically attaches to `this.getCameraRig()` on `start()`.

---

### CLASS: `NodeMaterialParticle`

**File:** `Assets/[Starter]/Material/NodeMaterialParticle.ts`

Applies a `NodeMaterialInstance` material to a particle system on the same game object.

---

### CLASS: `NodeMaterialTexture`

**File:** `Assets/[Starter]/Material/NodeMaterialTexture.ts`

Applies a `NodeMaterialInstance` material to the mesh renderer on the same game object.

---

## 10. SYSTEM: Mobile Input

### CLASS: `MobileInputController`

**Namespace:** `PROJECT`  
**Extends:** `TOOLKIT.ScriptComponent`  
**File:** `Assets/[Starter]/Mobile/MobileInputController.ts`

Creates a dual-stick virtual joystick UI overlay for touch devices. Feeds into `TOOLKIT.InputController` so standard input polling (e.g., `GetUserInput`) works transparently across keyboard, gamepad, and touch.

Singleton: `PROJECT.MobileInputController.Instance`

#### Key Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `controlType` | `number` | `0` | 0=Auto-detect mobile, 1=Force mobile |
| `parentElement` | `string` | `"root"` | DOM element ID to mount controls on |
| `maxMoveDistance` | `number` | `28` | Max joystick drag distance (pixels) |
| `maxMoveDeadzone` | `number` | `4` | Deadzone radius (pixels) |
| `enableLeftJoystick` | `boolean` | `true` | Show/enable left stick |
| `enableRightJoystick` | `boolean` | `true` | Show/enable right stick |
| `invertLeftStickY` | `boolean` | `true` | Invert Y axis on left stick |
| `invertRightStickY` | `boolean` | `true` | Invert Y axis on right stick |
| `leftStickFactor` | `number` | `1.0` | Left stick magnitude scale |
| `rightStickFactor` | `number` | `1.0` | Right stick magnitude scale |
| `enableMouseAxes` | `boolean` | `false` | Use mouse for look instead of stick |
| `enableVirtualButtons` | `boolean` | `false` | Show virtual action buttons |
| `centerLeftJoystick` | `boolean` | `false` | Re-center on touch down |
| `centerRightJoystick` | `boolean` | `false` | Re-center on touch down |

#### API

```typescript
static get Instance(): PROJECT.MobileInputController

getLeftStick(): TOOLKIT.TouchJoystickHandler
getRightStick(): TOOLKIT.TouchJoystickHandler
getLeftStickEnabled(): boolean
getRightStickEnabled(): boolean
getLeftStickElement(): HTMLDivElement
getRightStickElement(): HTMLDivElement
showLeftStickElement(show: boolean): void
showRightStickElement(show: boolean): void
```

#### Input Integration

The mobile controller feeds directly into `TOOLKIT.InputController`:
```typescript
// Under the hood (in update()):
TOOLKIT.InputController.SetLeftJoystickBuffer(x, y, invertY);
TOOLKIT.InputController.SetRightJoystickBuffer(x, y, invertY);

// In your game code — same API regardless of platform:
const moveX = TOOLKIT.InputController.GetUserInput(TOOLKIT.UserInputAxis.Horizontal);
const moveZ = TOOLKIT.InputController.GetUserInput(TOOLKIT.UserInputAxis.Vertical);
```

---

### CLASS: `MobileOccludeMaterial`

Assigns an optimized occlusion-only material to the mesh for mobile. Reduces overdraw on shadow casters.

### CLASS: `MobileShadowMaterial`

Assigns a lightweight shadow-only receive material for mobile performance.

---

## 11. SYSTEM: Inspector / Debug

### CLASS: `DebugInformation`

**Namespace:** `PROJECT`  
**Extends:** `TOOLKIT.ScriptComponent`  
**File:** `Assets/[Starter]/Inspector/DebugInformation.ts`

Registers keyboard shortcuts for development and debug overlays.

#### Inspector Properties

| Key | Type | Default | Description |
|---|---|---|---|
| `enableDebugKeys` | `boolean` | `true` | Register keyboard shortcuts |
| `showDebugLabels` | `boolean` | `true` | Show debug label overlays |
| `popupDebugPanel` | `boolean` | `false` | Open inspector in popup window |
| `togglePlayerViews` | `boolean` | `false` | Enable 1–4 multiplayer view keys |
| `allowXboxLiveSignIn` | `boolean` | `false` | Enable Xbox Live sign-in key |
| `debugOutputTextColor` | `IUnityColor` | Green | Debug label text color |

#### Default Keyboard Shortcuts

| Key | Action |
|---|---|
| `F` | Toggle fullscreen |
| `I` | Toggle Babylon Inspector (popup or inline) |
| `R` | Reload page |
| `1–4` | Set split-screen player count (if `togglePlayerViews=true`) |

---

## 12. TOOLKIT Core API Reference

### `TOOLKIT.SceneManager` — Static Methods

```typescript
// Scene & Engine
GetEngine(scene): BABYLON.Engine | BABYLON.WebGPUEngine
GetRootUrl(scene): string
GetSceneFile(scene): string
LogMessage(msg): void
LogWarning(msg): void
LogError(msg): void
AlertMessage(msg, title): void
EnterFullscreenMode(scene, pointerLock): void
ToggleFullscreenMode(scene): void
PauseRenderLoop: boolean          // Pause/resume render

// Component System
RegisterClass(alias, classRef): void
GetComponent(transform, classAlias): TOOLKIT.ScriptComponent
FindScriptComponent(transform, classAlias): TOOLKIT.ScriptComponent
SearchForScriptComponentByName(scene, classAlias): TOOLKIT.ScriptComponent

// Time
GetGameTime(): number              // Total game time (seconds)
GetDeltaSeconds(scene): number     // Frame delta time (seconds)
WaitForSeconds(seconds): Promise<void>   // Async wait

// Asset Management
GetImportMeshes(scene, key): BABYLON.AbstractMesh[]
GetAssetContainer(scene, key): BABYLON.AssetContainer
RegisterImportMeshes(scene, key, meshes): void
RegisterAssetContainer(scene, key, container): void
InstantiatePrefabFromContainer(container, prefabName, newName): BABYLON.TransformNode

// Properties
ServerEndPoint: string             // Get/set Colyseus server URL
HiddenLayerMask: number            // Layer mask for hidden objects
VirtualJoystickEnabled: boolean    // Toggle virtual joystick mode
```

### `TOOLKIT.InputController` — Static Methods

```typescript
// Axes (returns -1..1)
GetUserInput(axis: TOOLKIT.UserInputAxis): number
// Axes: Horizontal, Vertical, ClientX, ClientY, MouseX, MouseY, Wheel

// Buttons
GetKeyboardInput(key: TOOLKIT.UserInputKey): boolean
GetGamepadButtonInput(button: BABYLON.Xbox360Button): boolean
GetPointerInput(button: TOOLKIT.TouchMouseButton): boolean

// Trigger axes (0..1)
GetGamepadTriggerInput(trigger: TOOLKIT.Xbox360Trigger): number

// Event callbacks
OnKeyboardPress(key, callback): void
OnKeyboardDown(key, callback): void
OnKeyboardUp(key, callback): void
OnGamepadButtonPress(button, callback): void
OnGamepadButtonDown(button, callback): void
OnGamepadButtonUp(button, callback): void

// Mobile
SetLeftJoystickBuffer(x, y, invertY): void
SetRightJoystickBuffer(x, y, invertY): void
MobileControlsActive: boolean
AllowMobileControls: boolean
```

### `TOOLKIT.EntityController` — Static Methods

```typescript
GetNetworkEntityId(transform): string
GetNetworkEntityType(transform): number
GetNetworkEntitySessionId(transform): string
HasNetworkEntity(transform): boolean
QueryNetworkAttribute(transform, key): string       // Named attribute
QueryBufferedAttribute(transform, index): number    // Indexed attribute
PostBufferedAttribute(transform, index, value): void  // Post ONE indexed attribute
```

### `TOOLKIT.WindowManager` — Static Methods

```typescript
IsMobile(): boolean
IsWindows(): boolean
GetUrlParameter(name): string
SetTimeout(ms, callback): void
ToggleDebug(scene, show, element): void
PopupDebug(scene): void
```

### `TOOLKIT.Utilities` — Static Helpers

```typescript
ParseVector3(v: IUnityVector3): BABYLON.Vector3
ParseVector4(v: IUnityVector4): BABYLON.Vector4
ParseColor3(c: IUnityColor): BABYLON.Color3
ParseTexture(data, scene): BABYLON.Texture
FromEuler(x, y, z): BABYLON.Quaternion
FromEulerToRef(x, y, z, result): void
GetAbsolutePositionToRef(transform, result): void
MoveTowardsVector3ToRef(current, target, maxDelta, result): void
QuaternionDiffToRef(a, b, result): void
HasOwnProperty(obj, key): boolean
DefaultRenderGroup(): number
PrintToScreen(text): void
```

### `TOOLKIT.AudioSource` — Instance Methods

```typescript
// Attach to transform
const audio: TOOLKIT.AudioSource = this.getComponent("TOOLKIT.AudioSource");
audio.setPosition(position): void
audio.play(time?, offset?, length?): void
audio.pause(): void
audio.stop(): void
audio.isPaused(): boolean
audio.isPlaying(): boolean
audio.setVolume(volume): void
audio.setPitch(pitch): void  // 1.0 = normal
static AttachSpatialCamera(camera): void
static IsLegacyEngine(): boolean
```

### `TOOLKIT.AnimationState` — Instance Methods

```typescript
const anim: TOOLKIT.AnimationState = this.getComponent("TOOLKIT.AnimationState");
anim.playAnimation(stateName): void
anim.stopAnimation(): void
anim.setFloat(name, value): void
anim.setBool(name, value): void
anim.setInteger(name, value): void
anim.setTrigger(name): void
anim.setSmoothFloat(name, value, speed): void
anim.getFloat(name): number
anim.getBool(name): boolean
anim.getInteger(name): number
anim.ikFrameEnabled(): boolean
anim.onAnimationUpdateObservable: BABYLON.Observable<BABYLON.TransformNode>
```

### `TOOLKIT.CharacterController` — Instance Methods

```typescript
const cc: TOOLKIT.CharacterController = this.getComponent("TOOLKIT.CharacterController");
cc.isGrounded(): boolean
cc.move(velocity: BABYLON.Vector3): void
cc.jump(speed: number): void
cc.turn(angle: number): void
cc.rotate(x, y, z, w): void
cc.set(x, y, z): void
```

### `TOOLKIT.NavigationAgent` — Instance Methods

```typescript
const agent: TOOLKIT.NavigationAgent = this.getComponent("TOOLKIT.NavigationAgent");
agent.setDestination(destination: BABYLON.Vector3): void
agent.teleport(destination: BABYLON.Vector3): void
agent.isNavigating(): boolean
agent.getTargetDistance(): number
```

---

## 13. Game Architecture Blueprints

### Single-Player 3rd Person Adventure

```
[Scene]
CameraRig (tagged "MainCamera")
  └── DefaultCameraSystem
        mainCameraType=0, setSpatialAudio=true

GameManager
  ├── DebugInformation (enableDebugKeys=true)
  └── AssetPreloader (assetContainers=["level.glb"])

Player (with CharacterController physics)
  ├── StandardPlayerController
  │     enableInput=true, attachCamera=true
  │     moveSpeed=5.335, jumpSpeed=10
  ├── TOOLKIT.AnimationState
  └── TOOLKIT.CharacterController

[Level Geometry with colliders]
```

### Online Multiplayer

```
[Scene]
CameraRig
  └── DefaultCameraSystem

NetworkRoot
  └── ColyseusGameServer
        defaultRoomName="game", autoJoinRoom=true

LocalPlayer
  ├── StandardPlayerController (enableInput=true, postNetworkAttributes=true)
  ├── ColyseusNetworkEntity
  │     remotePrefab="RemotePlayer", autoCreate=true
  └── ColyseusNetworkAvatar (manageLabelTexture=true)

[RemotePlayer Prefab — spawned by NetworkManager per remote client]
  ├── RemotePlayerController (updateStateParams=true)
  └── ColyseusNetworkAvatar (controlMode=1)
```

### Mobile Game

```
[Scene]
CameraRig
  └── DefaultCameraSystem

MobileUI
  └── MobileInputController
        enableLeftJoystick=true (movement)
        enableRightJoystick=true (look)
        enableVirtualButtons=true

Player
  └── StandardPlayerController (enableInput=true)

// Input in StandardPlayerController reads:
// TOOLKIT.InputController.GetUserInput(Horizontal) — works from touch OR keyboard/gamepad
```

### Physics Simulation (Ragdoll / Vehicles)

```
[RagdollRoot]
  ├── BallSocketJoint (spine to hip)
  ├── FixedHingeJoint (knee joints, elbow joints)
  ├── SixdofJoint (shoulder joints with spring limits)
  └── LockedJoint (fused static parts)
```

---

## 14. Publishing Checklist

### Scene Requirements

- [ ] `DefaultCameraSystem` on a `"MainCamera"` tagged object
- [ ] `DebugInformation` component (disable in release: `enableDebugKeys=false`)
- [ ] `AssetPreloader` for any dynamic assets
- [ ] `TOOLKIT.SceneManager.RegisterClass` for every custom component

### Player Setup

- [ ] Physics body (`TOOLKIT.CharacterController` or `TOOLKIT.RigidbodyPhysics`) on player root
- [ ] `enableInput=false` by default; set `true` on game start
- [ ] `attachCamera=true` on `StandardPlayerController` for automatic camera binding
- [ ] `TOOLKIT.AnimationState` on avatar child node for animation
- [ ] `postNetworkAttributes=true` if multiplayer

### Network Setup (if applicable)

- [ ] `ColyseusGameServer` in scene with correct `defaultRoomName`
- [ ] `ColyseusNetworkEntity` on local player — set `remotePrefab` to spawnable prefab name
- [ ] Remote player prefab in asset container with `RemotePlayerController`
- [ ] `animationStateParams` must match animator parameter names
- [ ] Server endpoint configured via inspector OR `?endpoint=` URL param

### Mobile

- [ ] `MobileInputController` added for touch devices
- [ ] `MobileOccludeMaterial` + `MobileShadowMaterial` on heavy shadow-caster meshes
- [ ] `enableMouseAxes=false` to use joystick for look instead of touch-drag

### Post-Processing (DefaultCameraSystem)

- [ ] `renderingPipeline` property on `DefaultCameraSystem` controls all effects
- [ ] Access at runtime: `PROJECT.DefaultCameraSystem.GetRenderingPipeline()`
- [ ] For SSAO: `PROJECT.DefaultCameraSystem.GetScreenSpacePipeline()`

---

## 15. Code Examples

### Creating a New Script Component

```typescript
namespace PROJECT {
    export class PlayerHealth extends TOOLKIT.ScriptComponent {
        public maxHealth: number = 100;
        private currentHealth: number = 100;
        private controller: PROJECT.StandardPlayerController = null;

        constructor(transform: BABYLON.TransformNode, scene: BABYLON.Scene, properties: any = {}, alias: string = "PROJECT.PlayerHealth") {
            super(transform, scene, properties, alias);
        }

        protected awake(): void {
            this.maxHealth = this.getProperty("maxHealth", this.maxHealth);
        }

        protected start(): void {
            this.controller = this.getComponent("PROJECT.StandardPlayerController") as PROJECT.StandardPlayerController;
            this.currentHealth = this.maxHealth;
        }

        public takeDamage(amount: number): void {
            this.currentHealth = Math.max(0, this.currentHealth - amount);
            if (this.currentHealth === 0) this.onDeath();
        }

        public heal(amount: number): void {
            this.currentHealth = Math.min(this.maxHealth, this.currentHealth + amount);
        }

        public getHealth(): number { return this.currentHealth; }
        public getNormalizedHealth(): number { return this.currentHealth / this.maxHealth; }

        private onDeath(): void {
            if (this.controller != null) this.controller.movementAllowed = false;
            console.warn("Player died: " + this.transform.name);
        }
    }
    TOOLKIT.SceneManager.RegisterClass("PROJECT.PlayerHealth", PlayerHealth);
}
```

### Enabling Input at Race/Game Start

```typescript
// In your Game Manager component:
protected start(): void {
    const player = TOOLKIT.SceneManager.SearchForScriptComponentByName(this.scene, "PROJECT.StandardPlayerController") as PROJECT.StandardPlayerController;
    if (player != null) {
        player.enableInput = true;
        player.attachCamera = true;
    }
}
```

### Post-Processing at Runtime

```typescript
// Bloom effect
const pipeline: BABYLON.DefaultRenderingPipeline = PROJECT.DefaultCameraSystem.GetRenderingPipeline();
if (pipeline != null) {
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.8;
    pipeline.bloomWeight = 0.3;
    pipeline.bloomKernel = 64;
}
```

### Loading a Prefab at Runtime

```typescript
const container: BABYLON.AssetContainer = TOOLKIT.SceneManager.GetAssetContainer(this.scene, "enemies.glb");
if (container != null) {
    const enemy: BABYLON.TransformNode = TOOLKIT.SceneManager.InstantiatePrefabFromContainer(container, "EnemyPrefab", "Enemy_01");
    enemy.position.set(10, 0, 5);
}
```

### Async Scene Wait

```typescript
protected async start(): Promise<void> {
    await TOOLKIT.SceneManager.WaitForSeconds(2.0); // Wait 2 seconds
    this.showTitleScreen();
}
```

### Multiplayer Chat Message

```typescript
// Send
BABYLON.NetworkManager.GetDefaultRoom().send("chat", { text: "Hello!", user: "Player1" });

// Receive
BABYLON.NetworkManager.OnChatMessageObservable.add((msg) => {
    console.log(msg.user + ": " + msg.text);
});
```

### Split-Screen Setup (2 Players)

```typescript
// On button press or game mode selection:
PROJECT.DefaultCameraSystem.SetMultiPlayerViewLayout(this.scene, 2);
// Now Player 1 camera is top half, Player 2 camera is bottom half.
```

### Reading Platform Info

```typescript
if (TOOLKIT.WindowManager.IsMobile()) {
    // Show mobile controls
    PROJECT.MobileInputController.Instance.showLeftStickElement(true);
    PROJECT.MobileInputController.Instance.showRightStickElement(true);
}
```

### Physics Joint at Runtime

```typescript
// Example: Create a door hinge in code
const doorHinge: PROJECT.FixedHingeJoint = TOOLKIT.SceneManager.GetComponent(doorTransform, "PROJECT.FixedHingeJoint") as PROJECT.FixedHingeJoint;
// Joints are created automatically in awake() — just ensure the component is attached
// Access the raw constraint:
const constraint = doorHinge.constraint;
constraint.isCollisionsEnabled = false;
```

### Network Entity with Custom Attributes

```typescript
// On local player StandardPlayerController (postNetworkAttributes=true):
// The controller automatically posts these attribute indices:
// [0]=direction, [1]=magnitude, [2]=inputX, [3]=inputZ,
// [4]=mouseX, [5]=mouseY, [6]=verticalVelocity, [7]=moveSpeed
// [8]=actionState, [9]=jumpFrame, [10]=isJumping,
// [11]=isFalling, [12]=isSliding, [13]=isGrounded

// On RemotePlayerController — reads same indices automatically.
// For custom attributes, use EntityController directly (one indexed value per call):
TOOLKIT.EntityController.PostBufferedAttribute(this.transform, 14, myCustomValue1);
TOOLKIT.EntityController.PostBufferedAttribute(this.transform, 15, myCustomValue2);
```
