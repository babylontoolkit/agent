# Babylon Toolkit — Racing Game System
## AI Agent Component Reference (v2024)

> **Purpose:** This document is a complete technical reference for agentic AI systems. It covers every class, property, method, enum, interface, and architectural pattern in the Racing Game System. Use this document to design, scaffold, wire, and publish racing games built on the Babylon Toolkit.

---

## Import

```typescript
import * as TOOLKIT from "@babylonjs-toolkit/next";
import { StandardCarController, VehicleInputController, VehicleCameraManager, RaceTrackManager, CheckpointManager, SkidMarkManager, RemoteCarController } from "@babylonjs-toolkit/next/project";
// PROJECT racing classes are ONLY available from "@babylonjs-toolkit/next/project" — they are NOT exported from the root import.
// There is NO "@babylonjs-toolkit/next/racing/..." subpath — it does not exist and importing it crashes.
```

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Core Concepts](#2-core-concepts)
3. [Component Registry](#3-component-registry)
4. [CLASS: `StandardCarController`](#4-class-standardcarcontroller)
5. [CLASS: `VehicleInputController`](#5-class-vehicleinputcontroller)
6. [CLASS: `VehicleCameraManager`](#6-class-vehiclecameramanager)
7. [CLASS: `SideCameraController`](#7-class-sidecameracontroller)
8. [CLASS: `CheckpointManager`](#8-class-checkpointmanager)
9. [CLASS: `RaceTrackManager`](#9-class-racetrackmanager)
10. [CLASS: `SkidMarkManager`](#10-class-skidmarkmanager)
11. [CLASS: `RemoteCarController`](#11-class-remotecarcontroller)
12. [CLASS: `NetworkCarPrediction`](#12-class-networkcarprediction)
13. [CLASS: `VehicleNetworkLabel`](#13-class-vehiclenetworklabel)
14. [Interfaces & Data Structures](#14-interfaces--data-structures)
15. [Enums](#15-enums)
16. [Game Architecture Blueprint](#16-game-architecture-blueprint)
17. [Scene Setup Checklist](#17-scene-setup-checklist)
18. [Code Examples](#18-code-examples)

---

## 1. System Architecture Overview

The Racing Game System is a complete, production-ready vehicle racing framework for Babylon.js, authored in UMD TypeScript under the `PROJECT` namespace. All components extend `TOOLKIT.ScriptComponent` and follow the Unity-like lifecycle: `awake → start → update → late → destroy`.

```
Scene
├── TrackManager (GameObject)
│   ├── PROJECT.RaceTrackManager        ← Track spline + checkpoints + leaderboard
│   └── PROJECT.SkidMarkManager         ← GPU skidmark decals
│
├── PlayerCar (Prefab)
│   ├── PROJECT.StandardCarController   ← Physics vehicle simulation
│   ├── PROJECT.VehicleInputController  ← Human / AI autopilot input
│   ├── PROJECT.VehicleCameraManager    ← Follow camera + motion blur
│   └── PROJECT.CheckpointManager       ← Per-player lap/checkpoint tracking
│
├── RemoteCar (Network Prefab)
│   ├── PROJECT.RemoteCarController     ← Visual-only remote car
│   ├── PROJECT.NetworkCarPrediction    ← Client-side interpolation
│   └── PROJECT.VehicleNetworkLabel     ← Floating player name plate
│
└── SideCam (optional child of PlayerCar)
    └── PROJECT.SideCameraController    ← Picture-in-picture side view
```

### Key System Dependencies

| System | Depends On |
|---|---|
| `StandardCarController` | `TOOLKIT.RigidbodyPhysics`, `TOOLKIT.RaycastVehicle`, `TOOLKIT.AudioSource`, `TOOLKIT.AnimationState` |
| `VehicleInputController` | `PROJECT.StandardCarController`, `PROJECT.RaceTrackManager` |
| `VehicleCameraManager` | `PROJECT.StandardCarController`, `PROJECT.VehicleInputController`, `PROJECT.DefaultCameraSystem` |
| `CheckpointManager` | `PROJECT.RaceTrackManager` (static) |
| `SkidMarkManager` | `PROJECT.StandardCarController` (calls `AddSkidMarkSegment` statically) |
| `RemoteCarController` | `TOOLKIT.AnimationState`, `TOOLKIT.AudioSource`, `BABYLON.NetworkManager` |

---

## 2. Core Concepts

### ScriptComponent Lifecycle
All PROJECT classes inherit `TOOLKIT.ScriptComponent`. The execution order every frame is:
```
awake() → start() → fixed() → update() → late() → after()
```
- `awake()` — Read serialized properties via `this.getProperty(key, default)`. Never assume other components exist here.
- `start()` — Safely acquire references to other components with `this.getComponent("FULL.ClassName")`.
- `update()` — Main game logic per render frame.
- `late()` — Post-physics, post-update. Use for camera follow, HUD updates.
- `after()` — Post-everything. Used by `RaceTrackManager` to sort the leaderboard.
- `fixed()` — Fixed-timestep physics step.

### Property Serialization
Properties set in Unity Inspector are serialized into the `.babylon` file and read at runtime:
```typescript
this.myValue = this.getProperty("myValue", this.myValue);
```
This pattern is present in every `awake()` of every class. When creating a component, always call `getProperty` for every configurable field.

### Component Access Patterns
```typescript
// Get a component on the same transform node
const car = this.getComponent("PROJECT.StandardCarController") as PROJECT.StandardCarController;

// Find anywhere in the scene
const trackMgr = TOOLKIT.SceneManager.SearchForScriptComponentByName(this.scene, "PROJECT.RaceTrackManager") as PROJECT.RaceTrackManager;

// Get first child with a matching script
const animNode = this.getChildWithScript("TOOLKIT.AnimationState");
```

### Class Registration
Every class **must** be registered at the bottom of its file:
```typescript
TOOLKIT.SceneManager.RegisterClass("PROJECT.StandardCarController", StandardCarController);
```

---

## 3. Component Registry

| Class | Purpose | Required On |
|---|---|---|
| `StandardCarController` | Raycast vehicle physics, engine, gearbox, burnout | Player/AI car prefab |
| `VehicleInputController` | Human input OR AI autopilot | Player/AI car prefab |
| `VehicleCameraManager` | Third/first person follow camera | Player car prefab |
| `SideCameraController` | Secondary PiP viewport | Optional child camera on car |
| `CheckpointManager` | Lap counting, checkpoint tracking | Each racing entity |
| `RaceTrackManager` | Track spline, checkpoints, leaderboard | Singleton on TrackManager object |
| `SkidMarkManager` | GPU skidmark decals | Singleton on TrackManager object |
| `RemoteCarController` | Visual-only replicated car | Network remote car prefab |
| `NetworkCarPrediction` | Client-side transform interpolation | Network remote car prefab |
| `VehicleNetworkLabel` | Floating nameplate over car | Network remote car prefab |

---

## 4. CLASS: `StandardCarController`

**Namespace:** `PROJECT`  
**Extends:** `TOOLKIT.ScriptComponent`  
**File:** `Assets/[Racing]/Scripts/StandardCarController.ts`  
**Unity Editor Class:** `StandardCarController : EditorScriptComponent`

The core vehicle simulation component. Uses Bullet Physics raycast vehicle (`TOOLKIT.RaycastVehicle`) with a fully custom NFS-style gearbox, burnout/donut state machine, and chassis tilt system.

### Static Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `DEFAULT_SKID_FACTOR` | `number` | `1.0` | Global skid intensity multiplier |
| `DEFAULT_PITCH_FACTOR` | `number` | `1.0` | Global pitch intensity multiplier |
| `DEFAULT_SPEED_FACTOR` | `number` | `1.0` | Global speed multiplier |
| `DEFAULT_DONUT_FACTOR` | `number` | `1.0` | Global donut intensity multiplier |
| `DEFAULT_BRAKE_DEADZONE` | `number` | `0.5` | Brake input deadzone |
| `SimplexNoise2D` | `TOOLKIT.NoiseFunction2D` | — | Simplex noise used for idle chassis shake |

### Core Speed & Power Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `topEngineSpeed` | `number` | `200` | Max speed in mph (normal) |
| `topBoosterSpeed` | `number` | `150` | Max speed while NOS booster active |
| `powerCoefficient` | `number` | `1.0` | Engine power scale multiplier (0.0–3.0) |
| `powerBooster` | `boolean` | `true` | Enable NOS/booster system |
| `boosterCoefficient` | `number` | `8.0` | Booster force scale (0.0–80.0) |
| `maxBoosterTime` | `number` | `10.0` | Seconds of boost available |
| `minBoosterSpeed` | `number` | `25.0` | Minimum speed to activate boost |
| `powerChangeRate` | `number` | `5.0` | Rate of boost power change (1.0–50.0) |
| `stationaryBoost` | `number` | `1.1` | Engine force boost multiplier from standstill |
| `maxReversePower` | `number` | `0.5` | Max throttle fraction in reverse |
| `maxFrontBraking` | `number` | `0.0` | Max front wheel braking force coefficient |

### Gearbox Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `gearBoxMultiplier` | `number` | `1.0` | Gearbox force multiplier |
| `gearBoxShiftDelay` | `number` | `0.5` | Seconds between possible gear shifts |
| `gearBoxPitchScale` | `number` | `1.0` | Engine audio pitch scaling multiplier |
| `gearBoxShiftRatios` | `number[]` | `[4.20, 2.64, 1.78, 1.31, 1.00, 0.82]` | Per-gear ratios (6-speed default) |
| `gearBoxShiftUpRanges` | `number[]` | `[45, 75, 105, 135, 160, 999]` | MPH to upshift at each gear |
| `gearBoxShiftDownRanges` | `number[]` | `[0, 25, 50, 80, 110, 135]` | MPH to downshift at each gear |
| `transmissionRatio` | `number` | `0.75` | Transmission efficiency ratio |
| `differentialRatio` | `number` | `3.55` | Alternative differential ratio |
| `MIN_RPM` | `number` | `800` | Engine minimum RPM |
| `MAX_RPM` | `number` | `8000` | Engine maximum RPM |

### Handling Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `wheelDriveType` | `number` | `0` (RWD) | 0=RWD, 1=FWD, 2=AWD |
| `gravitationalForce` | `number` | `1.0` | Gravity multiplier for vehicle |
| `frictionLerpSpeed` | `number` | `0.2` | Tire friction interpolation speed |
| `stableDownImpulse` | `number` | `0.8` | Downforce when all wheels grounded |
| `constImpulseForce` | `number` | `0.1` | Constant downforce always applied |
| `roadConnectAccel` | `number` | `6.0` | Road reconnect acceleration when landing |
| `smoothFlyingImpulse` | `number` | `8.0` | Smoothing impulse while airborne |
| `burnoutTimeDelay` | `number` | `1.5` | Time delay before burnout friction applies |
| `lowGearCoefficient` | `number` | `0.8` | Low-gear traction coefficient |
| `lowGearDampener` | `number` | `0.1` | Low-gear angular damping |
| `maximumYawRateLow` | `number` | `60.0` | Max yaw rotation rate at low speed (deg/s) |
| `maximumYawRateHigh` | `number` | `30.0` | Max yaw rotation rate at high speed (deg/s) |
| `driftSpeedDampener` | `number` | `1.0` | Drift speed dampening coefficient |
| `grassPenaltyMask` | `number` | `0x00800000` | Collision layer mask for grass offroad |
| `curbPenaltyMask` | `number` | `0x01000000` | Collision layer mask for curbs |
| `minPenaltySpeed` | `number` | `65` | Min speed (mph) offroad penalty triggers |
| `linearWheelDrag` | `number` | `0.05` | Additional linear drag offroad |
| `frictionWheelSlip` | `number` | `0.195` | Offroad wheel friction slip |

### Steering Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `steeringInputCurve` | `number` | `1.8` | Input exponent (1.0=linear, 1.8=expo arcade) |
| `skidSteeringKick` | `number` | — | Steering kick applied during skid |
| `skidSteeringAngle` | `number` | — | Steering angle used during skid |
| `lowSpeedSteering` | `number` | `0.1` | Understeer factor at low speed |
| `highSpeedSteering` | `number` | `1.0` | Understeer factor at high speed |
| `skidTurningAssist` | `number` | `2.0` | Counter-steer assist during skid |
| `ackermanWheelBase` | `number` | `2.5` | Ackermann wheelbase (m) |
| `ackermanRearTrack` | `number` | `1.5` | Ackermann rear track width (m) |
| `ackermanTurnRadius` | `number` | `8.0` | Minimum turn radius (m) |
| `ackermanMaxRadius` | `number` | `16.0` | Dampened max turn radius (m) |
| `steeringSlewTau` | `number` | `0.08` | Steering slew low-pass time constant (sec) |
| `minSteeringSlew` | `number` | `0.6` | Minimum steering slew rate floor (rad/s) |

### Braking Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `minBrakingForce` | `number` | `250` | Minimum braking force |
| `maxBrakingForce` | `number` | `500` | Maximum braking force |
| `handBrakingForce` | `number` | `1500` | Handbrake force |
| `radiusBrakingForce` | `number` | `0.5` | Radius-based braking contribution |
| `linearBrakingForce` | `number` | `0.85` | Linear velocity braking contribution |
| `angularBrakingForce` | `number` | `0.01` | Angular velocity braking contribution |
| `defaultBrakingWindow` | `number` | `0.65` | Braking input window (sec) |
| `counterSteerLockoutWindowPercent` | `number` | `1.0` | Lock out counter-steer during skid init |

### Burnout & Donut State Machine Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `burnoutCoefficient` | `number` | `5.0` | Burnout force multiplier |
| `burnoutTriggerMark` | `number` | `20.0` | Max speed (mph) to initiate burnout |
| `burnoutTurnFactor` | `number` | `1.0` | Yaw assist multiplier during burnout |
| `enableAutoBurnouts` | `boolean` | `false` | AI auto-burnout enable |
| `donutTurningRadius` | `number` | `5.0` | Turning radius during donut (m) |
| `donutSpeedScaling` | `number` | `1.0` | Engine power scale during donut |
| `donutRotationBoost` | `number` | `8.0` | Visual wheel-spin boost during donut |
| `donutAngularDamping` | `number` | `0.0` | Angular damping override during donut |
| `donutFrontFriction` | `number` | `0.85` | Front tire grip during donut |
| `donutRearFriction` | `number` | `0.35` | Rear tire grip during donut |
| `donutFrontWheelPull` | `number` | `0.2` | Front wheel engine force fraction in donut |
| `donutYawDegPerSec` | `number` | `60.0` | Target body yaw rate during donut |
| `donutYawResponse` | `number` | `4.0` | Lerp speed toward target yaw |
| `donutVelocityPinEnabled` | `boolean` | `true` | Enable NFS-style orbit velocity pin |
| `donutVelocityPinResponse` | `number` | `5.0` | Orbit velocity pin lerp rate |
| `stationaryBurnoutPrimeSpeedMph` | `number` | `0.25` | Max speed to prime stationary burnout |
| `stationaryBurnoutPrimeHoldTime` | `number` | `0.1` | Time to hold before burnout primes |
| `burnoutLaunchKickDuration` | `number` | `0.80` | Seconds of launch kick after grid release |
| `burnoutLaunchKickMultiplier` | `number` | `3.0` | Engine force multiplier during launch kick |
| `burnoutFirstGearMultiplier` | `number` | `1.0` | First gear force multiplier post-burnout |

### Visual Effects Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `smokeTexture` | `BABYLON.Texture` | `null` | Tire smoke particle texture |
| `smokeIntensity` | `number` | `150` | Particle emission count |
| `smokeOpacity` | `number` | `0.1` | Smoke particle opacity |
| `smokeDonuts` | `number` | `2.0` | Smoke multiplier during donuts |
| `skidThreashold` | `number` | `0.65` | Skid detect threshold (0.45–0.85) |
| `wheelDrawVelocity` | `number` | `0.02` | Wheel skid velocity threshold |
| `maxSteerBoost` | `number` | `4` | Max visual steer boost integer |
| `overSteerSpeed` | `number` | `1.0` | Oversteer visual speed |
| `overSteerTimeout` | `number` | `0.2` | Oversteer visual duration |

### Chassis Tilt Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `movementTilting` | `boolean` | `false` | Enable chassis pitch/roll tilting |
| `surfaceDetection` | `boolean` | `false` | Enable surface-normal alignment |
| `chassisTransform` | `BABYLON.TransformNode` | `null` | The chassis mesh to tilt |
| `idleShakeRate` | `number` | `5.0` | Idle engine shake frequency |
| `idleShakeNoise` | `number` | `0.01` | Idle engine shake amplitude |
| `maxForwardAngle` | `number` | `6.0` | Max forward pitch angle (degrees) |
| `maxLateralAngle` | `number` | `3.0` | Max lateral roll angle (degrees) |
| `forwardPitchFactor` | `number` | `0.2` | Pitch sensitivity to acceleration |
| `lateralRollFactor` | `number` | `0.3` | Roll sensitivity to turning |

### Public API Methods

#### State Query Methods

```typescript
isBraking(): boolean              // True if foot or hand braking
isBoosting(): boolean             // True if NOS booster active
getFootBraking(): boolean         // Foot brake input state
getHandBraking(): boolean         // Handbrake input state
getCurrentForward(): number       // Current throttle input (-1 to 1)
getCurrentTurning(): number       // Current steering input (-1 to 1)
getCurrentSkidding(): boolean     // True when any wheel is skidding
getBurnoutButton(): boolean       // Burnout input state
getDonutButton(): boolean         // Donut input state
getCurrentBurnout(): boolean      // True during burnout or restore window
getReverseThrottle(): boolean     // True in reverse under power
```

#### Speed & Physics Methods

```typescript
getForwardSpeed(): number         // Signed forward speed (m/s)
getAbsoluteSpeed(): number        // Absolute speed (m/s)
getAmericanSpeed(): number        // Speed in MPH
getGradientSpeed(): number        // Speed normalized 0..1 over topEngineSpeed
getNormalizedSpeed(): number      // americanSpeed / topEngineSpeed
getTopEngineSpeed(): number       // Returns boost or normal top speed
getLinearVelocity(): BABYLON.Vector3  // Current physics linear velocity
getWheelVelocityOffset(): BABYLON.Vector3  // Wheel velocity offset
getRigidbodyPhysics(): TOOLKIT.RigidbodyPhysics   // Physics body reference
getRaycastVehicle(): TOOLKIT.RaycastVehicle        // Raycast vehicle reference
```

#### Engine & Gear Methods

```typescript
getCurrentGearIndex(): number      // Current gear (0 = 1st)
getCurrentEngineRPM(): number      // Engine RPM
getCurrentEngineForce(): number    // Applied engine force
getCurrentEnginePitch(): number    // Normalized pitch value 0..1
getGearShiftRatioCount(): number   // Number of gears
getEnginePitchLevel(): number      // Raw engine pitch level
```

#### Wheel Methods

```typescript
getFrontLeftSkid(): number         // FL wheel skid factor
getFrontRightSkid(): number        // FR wheel skid factor
getBackLeftSkid(): number          // RL wheel skid factor
getBackRightSkid(): number         // RR wheel skid factor
getWheelSkidPitch(): number        // Combined wheel skid pitch
getWheelBurnoutEnabled(): boolean  // Burnout state
getWheelDonutsEnabled(): boolean   // Donut state
getCurrentDonutSpinTime(): number  // Elapsed donut spin time
getFrontLeftWheelNode(): BABYLON.TransformNode   // FL wheel transform
getFrontRightWheelNode(): BABYLON.TransformNode  // FR wheel transform
getBackLeftWheelNode(): BABYLON.TransformNode    // RL wheel transform
getBackRightWheelNode(): BABYLON.TransformNode   // RR wheel transform
getBrakeLightsMesh(): BABYLON.TransformNode      // Brake lights node
getReverseLightsMesh(): BABYLON.TransformNode    // Reverse lights node
```

#### Burnout / Meter Methods

```typescript
readBurnoutMeter(): number         // 0..1 burnout meter value
resetBurnoutMeter(): void          // Reset burnout meter to 0
readDonutMeter(): number           // 0..1 donut meter value
resetDonutMeter(): void            // Reset donut meter to 0
getBoosterTime(): number           // Remaining booster time (sec)
setBoosterTime(time: number): void // Set booster time remaining
resetBoosterTime(): void           // Restore to maxBoosterTime
getSmokeIntensityFactor(): number  // 0..1 smoke emission factor
getSmokeTextureMask(): BABYLON.Texture // Smoke texture reference
```

#### Grid Start Lock Methods

```typescript
lockStartPosition(): void
// Snap & lock car at current position for grid countdown.
// Engine revs, burnout RPM build-up, and wheel spin visuals still run.
// Call this before the race countdown starts.

unlockStartPosition(): void
// Release the position lock on GO signal.
// If a stationary burnout was primed, fires burnout launch kick immediately.

isStartPositionLocked(): boolean  // True if position is currently locked
```

### Lifecycle Hooks (override for extension)

```typescript
protected awake(): void    // → awakeVehicleState()
protected start(): void    // → initVehicleState()
protected update(): void   // → updateVehicleState()
protected destroy(): void  // → destroyVehicleState()
```

Subclass `StandardCarController` and override these hooks to extend behavior:
```typescript
export class MyCustomCar extends PROJECT.StandardCarController {
    protected awake(): void {
        super.awake(); // always call super
        // custom init
    }
    protected update(): void {
        super.update(); // always call super
        // custom per-frame logic
    }
}
```

---

## 5. CLASS: `VehicleInputController`

**Namespace:** `PROJECT`  
**Extends:** `TOOLKIT.ScriptComponent`  
**File:** `Assets/[Racing]/Scripts/VehicleInputController.ts`

Drives `StandardCarController` from either human input (keyboard/gamepad/steering wheel) or a fully autonomous AI chase-rabbit autopilot with collision avoidance sensors.

### Interface: `ISteeringWheelDevice`

```typescript
export interface ISteeringWheelDevice {
    deviceName: string;
    forwardButton: number;
    backwardButton: number;
    leftHandBrake: number;
    rightHandBrake: number;
    leftBurnoutBoost: number;
    rightBurnoutBoost: number;
    leftDonutBoost: number;
    rightDonutBoost: number;
}
```

### Input Configuration Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `enableInput` | `boolean` | `false` | Enable input processing |
| `playerNumber` | `TOOLKIT.PlayerNumber` | `One` | Player 1–4 slot |
| `resetTiming` | `number` | `3.0` | Seconds before stuck vehicle resets |
| `triggerForward` | `number` | `Xbox360Trigger.Right` | Gamepad throttle trigger |
| `keyboardForawrd` | `number` | `UserInputKey.W` | Keyboard throttle |
| `auxKeyboardForawrd` | `number` | `UserInputKey.UpArrow` | Alt keyboard throttle |
| `triggerBackwards` | `number` | `Xbox360Trigger.Left` | Gamepad brake/reverse |
| `keyboardBackwards` | `number` | `UserInputKey.S` | Keyboard brake |
| `buttonHandbrake` | `number` | `Xbox360Button.X` | Gamepad handbrake button |
| `keyboardHandbrake` | `number` | `UserInputKey.SpaceBar` | Keyboard handbrake |
| `keyboardBurnout` | `number` | `UserInputKey.Shift` | Keyboard burnout button |
| `buttonBurnout` | `number` | `Xbox360Button.B` | Gamepad burnout button |
| `keyboardDonut` | `number` | `UserInputKey.Alt` | Keyboard donut button |
| `buttonDonut` | `number` | `Xbox360Button.LeftStick` | Gamepad donut button |
| `keyboardBooster` | `number` | `UserInputKey.Ctrl` | Keyboard booster |
| `leftButtonBooster` | `number` | `Xbox360Button.LB` | Gamepad left bumper booster |
| `rightButtonBooster` | `number` | `Xbox360Button.RB` | Gamepad right bumper booster |

### AI Autopilot Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `raceLineNode` | `number` | `0` | Which race line (0–4) to follow |
| `minLookAhead` | `number` | `5` | Min chase rabbit look-ahead distance (m) |
| `maxLookAhead` | `number` | `50` | Max chase rabbit look-ahead distance (m) |
| `driverSkillLevel` | `number` | `1` | AI skill tier |
| `chaseRabbitSpeed` | `number` | `1.0` | Speed of rabbit point along track |
| `throttleSensitivity` | `number` | `1` | AI throttle response |
| `steeringSensitivity` | `number` | `1` | AI steering response |
| `brakingSensitivity` | `number` | `1` | AI braking response |
| `brakingTurnAngle` | `number` | `15` | Degrees of turn to trigger braking |
| `brakingSpeedLimit` | `number` | `90` | Speed (mph) to start corner braking |
| `skiddingSpeedLimit` | `number` | `100` | Speed above which AI allows skidding |
| `driveSpeedMultiplier` | `number` | `5.0` | AI speed multiplier along spline |
| `trackManagerIdentity` | `string` | `"TrackManager"` | Name of TrackManager game object |
| `maxRaceTrackSpeed` | `number` | `0` | Max speed cap for AI (0 = no cap) |

### AI Collision Avoidance Sensors

| Property | Type | Default | Description |
|---|---|---|---|
| `sensorLength` | `number` | `12` | Raycast sensor length (m) |
| `spacerWidths` | `number` | `0.85` | Side sensor spacing |
| `angleFactors` | `number` | `1.5` | Angled sensor spread factor |
| `initialOffsetX/Y/Z` | `number` | `1/0.5/2` | Sensor origin offset from car center |
| `avoidanceFactor` | `number` | `0.5` | Avoidance steering strength |
| `avoidanceSpeed` | `number` | `3.0` | Avoidance lerp speed |
| `avoidanceTimeout` | `number` | `3.0` | Time avoidance remains active (sec) |
| `avoidanceDistance` | `number` | `2.0` | Avoidance activation distance (m) |
| `avoidanceSteeringGain` | `number` | `0.60` | Steering nudge at low speed |
| `avoidanceSteeringGainHigh` | `number` | `0.30` | Steering nudge at high speed |
| `avoidanceProximityBoost` | `number` | `1.5` | Proximity-weighted steer multiplier |
| `frontBrakeProximity` | `number` | `0.45` | Proximity fraction to start braking |
| `frontBrakeForce` | `number` | `0.7` | Brake force at front proximity |
| `frontHardBrakeProximity` | `number` | `0.75` | Proximity for panic reverse braking |
| `frontHardBrakeStrength` | `number` | `0.8` | Panic brake reverse throttle magnitude |
| `vehicleTag` | `string` | `"Vehicle"` | Tag identifying other vehicles |
| `obstacleTag` | `string` | `"Obstacle"` | Tag identifying obstacles |

### Public API Methods

```typescript
getPlayerDeltaX(): number          // Raw horizontal axis input
getPlayerDeltaY(): number          // Raw vertical axis input
getPlayerMouseX(): number          // Mouse X axis
getPlayerMouseY(): number          // Mouse Y axis
getWaypointIndex(): number         // Current AI waypoint index
getChaseRabbitMesh(): BABYLON.Mesh // Chase rabbit debug mesh
resetChaseRabbitMesh(): void       // Teleport rabbit to car position
getChasePointMesh(): BABYLON.Mesh  // Chase point debug mesh
resetChasePointMesh(): void        // Teleport chase point to car position
```

---

## 6. CLASS: `VehicleCameraManager`

**Namespace:** `PROJECT`  
**Extends:** `TOOLKIT.ScriptComponent`  
**File:** `Assets/[Racing]/Scripts/VehicleCameraManager.ts`

Manages the third-person follow camera and first-person cockpit camera with speed-based motion blur and shake effects.

### Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `enableCamera` | `boolean` | `false` | Enable camera management |
| `followTarget` | `boolean` | `false` | Enable smooth follow behavior |
| `followHeight` | `number` | `1.25` | Camera height above car |
| `pitchingAngle` | `number` | `0.0` | Camera pitch look-down angle |
| `rotationDamping` | `number` | `5.0` | Follow rotation damping (higher=slower) |
| `minimumDistance` | `number` | `4.0` | Min camera boom distance (m) |
| `maximumDistance` | `number` | `5.0` | Max camera boom distance (m) |
| `buttonCamera` | `number` | `Xbox360Button.Y` | Toggle camera view button |
| `keyboardCamera` | `number` | `UserInputKey.P` | Toggle camera view key |
| `autoAttachCamera` | `boolean` | `false` | Auto-attach to player camera slot |
| `tickRemoteEntities` | `boolean` | `false` | Update remote entity cameras |
| `fastMotionBlur` | `boolean` | `false` | Enable speed-based motion blur |
| `lowSpeedBlurring` | `number` | `0.0` | Motion blur at slow speed |
| `highSpeedBlurring` | `number` | `20.0` | Motion blur at high speed |
| `motionBlurSamples` | `number` | `32` | Motion blur quality samples |
| `isObjectBasedBlur` | `boolean` | `true` | Object-based vs. screen-based blur |
| `fastCameraShake` | `boolean` | `false` | Enable speed-based camera shake |
| `lowSpeedShaking` | `number` | `1.0` | Shake intensity at low speed |
| `highSpeedShaking` | `number` | `1.0` | Shake intensity at high speed |

### Protected Fields (available in subclasses)

```typescript
protected m_freeCamera: BABYLON.FreeCamera
protected m_motionBlur: BABYLON.MotionBlurPostProcess
protected m_cameraTransform: BABYLON.TransformNode
protected m_inputController: PROJECT.VehicleInputController
protected m_standardController: PROJECT.StandardCarController
protected m_firstPersonOffset: BABYLON.Vector3  // default: (0, 1.15, 0.15)
```

### Public API Methods

```typescript
attachPlayerCamera(player: TOOLKIT.PlayerNumber): void
// Attach scene camera to this vehicle for the given player slot.

togglePlayerCamera(): void
// Switch between third-person and first-person view.

firstPersonCamera(): void
// Force first-person cockpit view.

thirdPersonCamera(): void
// Force third-person follow view.
```

---

## 7. CLASS: `SideCameraController`

**Namespace:** `PROJECT`  
**Extends:** `TOOLKIT.ScriptComponent`  
**File:** `Assets/[Racing]/Scripts/SideCameraController.ts`

Renders a secondary picture-in-picture viewport in the top-right corner. The camera is already parented to the car transform in Unity and moves with it automatically — no per-frame sync required.

### Behavior

- On `awake()`: Gets the camera rig via `this.getCameraRig()`, sets viewport to top-right (75%, 75%, 25%, 25%), detaches input controls, and adds to `scene.activeCameras`.
- On `destroy()`: Removes camera from `scene.activeCameras`.

### Configuration

Viewport is hardcoded to `new BABYLON.Viewport(0.75, 0.75, 0.25, 0.25)`. The internal `enableWindowView()` is **private** — to customize the viewport, adjust the camera's `viewport` on `scene.activeCameras` after the component is ready.

---

## 8. CLASS: `CheckpointManager`

**Namespace:** `PROJECT`  
**Extends:** `TOOLKIT.ScriptComponent`  
**File:** `Assets/[Racing]/Scripts/CheckpointManager.ts`

Per-player race progression tracker. Detects checkpoint intersections, counts laps, records lap times, and posts to the leaderboard. Each racing entity (player or AI) needs one.

### Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `playerID` | `number` (private) | `0` | Unique player identifier |
| `playerName` | `string` (private) | `"Player"` | Display name |
| `lapNumber` | `number` (private) | `0` | Current lap |
| `checkPointIndex` | `number` (private) | `0` | Last completed checkpoint index |
| `raceOver` | `boolean` (private) | `false` | Race completion flag |

### Public API Methods

```typescript
register(id: number, name: string): void
// Register this player with the race track system.
// Must be called before the race starts.
// id: unique integer per car (1, 2, 3...)
// name: display name string

startRaceTimer(): void
// Begin recording race time. Call on the GO signal.

getLapTimes(): number[]     // Array of completed lap times (seconds)
getLapNumber(): number      // Current lap number (1-based)
getCheckPoint(): number     // Index of last crossed checkpoint
getPlayerName(): string     // Player display name
getPlayerID(): number       // Unique player ID
getRaceTime(): number       // Total elapsed race time (seconds)
getRaceOver(): boolean      // True when race is complete
```

### How Checkpoints Work

1. `RaceTrackManager` collects all meshes tagged `"Checkpoint"` in the scene.
2. Each frame, `CheckpointManager` calls `intersectsPoint()` against the next expected checkpoint mesh.
3. Crossing checkpoint index `0` (the start/finish line) increments the lap counter.
4. When `lapNumber > RaceTrackManager.TotalLapCount`, `raceOver = true` and a `"GameOver"` event is posted to `RaceTrackManager.EventBus`.

### Checkpoint Setup in Scene

1. Create trigger volumes (invisible mesh colliders) along the track.
2. Tag each mesh with `"Checkpoint"`.
3. Name them in order: `Checkpoint_00`, `Checkpoint_01`, ... (order is inferred by array index from `getMeshesByTags`).
4. The first checkpoint in the array is the start/finish line.

---

## 9. CLASS: `RaceTrackManager`

**Namespace:** `PROJECT`  
**Extends:** `TOOLKIT.ScriptComponent`  
**File:** `Assets/[Racing]/Scripts/RaceTrackManager.ts`

Singleton manager for the entire race. Holds the track spline, up to 5 race lines for AI, checkpoint registry, leaderboard, vehicle registry, and an event bus.

### Static Fields

| Field | Type | Description |
|---|---|---|
| `TrackLength` | `number` | Total track length in meters (computed from nodes) |
| `TotalLapCount` | `number` | Number of laps to complete the race (default: 3) |
| `WinnerTransform` | `BABYLON.TransformNode` | Transform of the first car to finish |
| `EventBus` | `TOOLKIT.LocalMessageBus` | Lazy-created event bus (singleton) |

### Data Interfaces

```typescript
interface ITrackNode {
    radius: number;
    position: TOOLKIT.IUnityVector3;       // World position
    rotation: TOOLKIT.IUnityVector4;       // World rotation (quaternion)
    localPosition: BABYLON.Vector3;        // Parsed at runtime
    localRotation: BABYLON.Quaternion;     // Parsed at runtime
    localDistance: number;                 // Cumulative distance along track
}

interface IControlPoint {
    speed: number;                         // Suggested AI speed at this point
    tvalue: number;                        // Parametric t value along spline
    position: TOOLKIT.IUnityVector3;       // World position
}

class RoutePoint {
    position: BABYLON.Vector3;
    direction: BABYLON.Vector3;            // Forward direction along route
}

class PlayerRaceStats {
    id: number;
    name: string;
    position: number;                      // Race position (1st, 2nd, etc.)
}
```

### Instance Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `drawDebugLines` | `boolean` | `false` | Render track nodes + race lines as debug meshes |

### Route Point API (Spline Navigation)

```typescript
getRoutePoint(distance: number): PROJECT.RoutePoint
// Get a RoutePoint (position + forward direction) at a distance along the track.

getRoutePointToRef(distance: number, result: PROJECT.RoutePoint): void
// Non-allocating version.

getRoutePosition(distance: number): BABYLON.Vector3
// Get just the world position at a given track distance.

getRoutePositionToRef(distance: number, result: BABYLON.Vector3): void
// Non-allocating version.

getControlPoints(line: number): PROJECT.IControlPoint[]
// Get AI race line control points for race line 0–4.

getTrackNodes(): PROJECT.ITrackNode[]
// Get all track spline nodes.
```

### Static Checkpoint API

```typescript
static GetCheckpointTag(): string              // Returns "Checkpoint"
static GetCheckpointList(): BABYLON.AbstractMesh[]  // All checkpoint meshes
static GetCheckpointCount(): number            // Total checkpoint count
```

### Static Vehicle API

```typescript
static RegisterVehicle(vehicle: BABYLON.TransformNode): void
// Register a vehicle so the leaderboard can track its position.

static GetPlayerVehicles(): BABYLON.TransformNode[]
// Get all registered vehicles.
```

### Static Leaderboard API

```typescript
static RegisterPlayer(id: number, name: string): void
// Register player for leaderboard (called by CheckpointManager.register).

static UpdateLeaderboard(id: number, lap: number, checkpoint: number, position: BABYLON.Vector3): void
// Update a player's race standing. Called every frame by CheckpointManager.

static GetLeaderboardPosition(id: number): number
// Get a player's current race position (1st, 2nd, ...).

static GetLeaderboardPositionList(): PROJECT.PlayerRaceStats[]
// Get the ranked leaderboard entries.
```

### Event Bus Usage

```typescript
// Post the race end event
PROJECT.RaceTrackManager.EventBus.PostMessage("GameOver");

// Subscribe
PROJECT.RaceTrackManager.EventBus.OnMessage("GameOver", () => {
    console.log("Race over! Show results screen.");
});
```

---

## 10. CLASS: `SkidMarkManager`

**Namespace:** `PROJECT`  
**Extends:** `TOOLKIT.ScriptComponent`  
**File:** `Assets/[Racing]/Scripts/SkidMarkManager.ts`

GPU-based skidmark decal system using a shared ring-buffer mesh. Place one `SkidMarkManager` in the scene. `StandardCarController` calls `AddSkidMarkSegment` statically — no direct reference needed.

### Static Configuration (Set via Inspector)

| Property | Inspector Key | Default | Description |
|---|---|---|---|
| `MAX_MARKS` | `maxSections` | `1024` | Total segment ring-buffer size |
| `MARK_COLOR` | `textureColor` | Black | Skid mark color |
| `MARK_WIDTH` | `textureWidth` | `0.3` | Mark width in meters |
| `GROUND_OFFSET` | `groundOffset` | `0.01` | Z-fighting prevention offset |
| `GPU_TRIANGLES` | `gpuQuadIndices` | `true` | GPU quad triangle index mode |
| `TEXTURE_MARKS` | `textureMarks` | `null` | Skid texture asset reference |
| `TEX_INTENSITY` | `textureIntensity` | `1.0` | Texture alpha intensity coefficient |
| `MIN_DISTANCE` | `textureDistance` | `0.1` | Min distance between skid sections (m) |

### Static API

```typescript
static AddSkidMarkSegment(
    pos: BABYLON.Vector3,
    normal: BABYLON.Vector3,
    intensity: number,        // 0..1
    lastIndex: number         // -1 for new mark, or previous segment index
): BABYLON.Nullable<number>
// Returns the new segment index, or null if manager not initialized,
// or -1 if intensity < 0. Pass returned value back as lastIndex next frame.
```

### Usage from StandardCarController

```typescript
// Per wheel in StandardCarController update:
this.m_frontLeftWheelSkid = PROJECT.SkidMarkManager.AddSkidMarkSegment(
    wheelContactPos,
    wheelContactNormal,
    skidIntensity,
    this.m_frontLeftWheelSkid
);
```

---

## 11. CLASS: `RemoteCarController`

**Namespace:** `PROJECT`  
**Extends:** `TOOLKIT.ScriptComponent`  
**File:** `Assets/[Racing]/Scripts/RemoteCarController.ts`

Visual-only controller for remotely networked cars. Does not simulate physics — only plays animations, audio, particle effects, and skidmarks for cars owned by other clients.

### Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `centerOfMass` | `number` | `0.4` | Visual center-of-mass offset |
| `burnoutWheelPitch` | `number` | `0.85` | Burnout audio pitch |
| `linkTrackManager` | `boolean` | `true` | Register with track manager |
| `playVehicleSounds` | `boolean` | `true` | Enable audio playback |
| `smokeTexture` | `BABYLON.Texture` | `null` | Smoke particle texture |
| `skidThreashold` | `number` | `0.65` | Skid detection threshold |
| `smokeIntensity` | `number` | `150` | Smoke emission count |
| `smokeOpacity` | `number` | `0.1` | Smoke opacity |
| `smokeDonuts` | `number` | `2.0` | Smoke multiplier during donuts |

### Wheel Contact API

```typescript
getFrontLeftWheelContact(): boolean
getFrontRightWheelContact(): boolean
getRearLeftWheelContact(): boolean
getRearRightWheelContact(): boolean
getFrontLeftWheelContactTag(): string     // Surface tag
getFrontLeftWheelContactPoint(): BABYLON.Vector3
getFrontLeftWheelContactNormal(): BABYLON.Vector3
// (same pattern for all 4 wheels)
```

### Network Attributes Read (via `TOOLKIT.EntityController.QueryBufferedAttribute`)

The remote car reads these from the network entity buffer:
- Index 0: `pitchLevel` — Engine audio pitch
- Index 1: `brakeState` — Brake lights flag
- Index 2: `reverseState` — Reverse lights flag
- Index 3: `burnoutState` — Burnout flag
- Index 4: `steerAngle` — Steering wheel angle
- Index 5–8: `SKID_FL/FR/RL/RR` — Per-wheel skid intensities
- Index 9–12: `SPIN_FL/FR/RL/RR` — Per-wheel rotation speeds

---

## 12. CLASS: `NetworkCarPrediction`

**Namespace:** `PROJECT`  
**Extends:** `TOOLKIT.ScriptComponent`  
**File:** `Assets/[Racing]/Scripts/NetworkCarPrediction.ts`

> ⚠️ **Script-bundle only:** `NetworkCarPrediction` (like `BABYLON.NetworkManager` it depends on)
> ships in the starter script bundle — it is **not** in the `@babylonjs-toolkit/next` npm package
> and cannot be imported from `"@babylonjs-toolkit/next/project"`.

Registers a custom interpolation handler with `BABYLON.NetworkManager` for vehicle client-side prediction. The actual prediction algorithm is a stub for custom implementation.

### Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `autoRegister` | `boolean` | `true` | Auto-register handler on awake |
| `handlerName` | `string` | `"VehiclePrediction"` | Key to register handler under |
| `extrapolateTimeMs` | `number` | `200` | Max extrapolation window (ms) |

### Public API

```typescript
register(): void
// Manually register the interpolation handler.
// Called automatically on awake if autoRegister is true.
```

### Extension Pattern

Override `HandleUpdate` to implement custom prediction:
```typescript
private HandleUpdate(
    networkEntity: BABYLON.IColyseusNetworkEntity,
    remoteTransform: BABYLON.TransformNode,
    deltaTime: number
): void {
    // Implement position/rotation interpolation here
    // Use extrapolateTimeMs to bound your prediction window
}
```

---

## 13. CLASS: `VehicleNetworkLabel`

**Namespace:** `PROJECT`  
**Extends:** `TOOLKIT.ScriptComponent`  
**File:** `Assets/[Racing]/Scripts/VehicleNetworkLabel.ts`

Creates a floating GUI nameplate over networked cars using Babylon.js GUI `AdvancedDynamicTexture`. Auto-creates from `TOOLKIT.EntityController.QueryNetworkAttribute(transform, "ownerName")`.

### Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `autoCreate` | `boolean` | `true` | Auto-create label when room joined |
| `offsetX` | `number` | `0` | Pixel offset X from car center |
| `offsetY` | `number` | `0` | Pixel offset Y (height above car) |
| `labelColor` | `BABYLON.Color3` | White | Name text color |
| `borderColor` | `BABYLON.Color3` | Teal (#00D7D3) | Rectangle border color |
| `backgroundColor` | `BABYLON.Color3` | Dark teal (#007977) | Rectangle fill color |
| `label` | `BABYLON.GUI.TextBlock` | `null` | Text block (public, accessible) |
| `rect` | `BABYLON.GUI.Rectangle` | `null` | Background rectangle (public) |

### Public API

```typescript
createLabel(name: string): void
// Manually create a nameplate. Automatically called with ownerName from network.

static GetFullscreenUI(scene: BABYLON.Scene, sampling?: number): BABYLON.GUI.AdvancedDynamicTexture
// Get or create the shared fullscreen Advanced Dynamic Texture.
// Singleton — all labels share the same ADT instance.
```

---

## 14. Interfaces & Data Structures

### `ITrackNode`
```typescript
interface ITrackNode {
    radius: number;
    position: TOOLKIT.IUnityVector3;
    rotation: TOOLKIT.IUnityVector4;
    localPosition: BABYLON.Vector3;    // Set at runtime
    localRotation: BABYLON.Quaternion; // Set at runtime
    localDistance: number;             // Set at runtime
}
```

### `IControlPoint`
```typescript
interface IControlPoint {
    speed: number;
    tvalue: number;
    position: TOOLKIT.IUnityVector3;
}
```

### `RoutePoint`
```typescript
class RoutePoint {
    position: BABYLON.Vector3;
    direction: BABYLON.Vector3;
}
```

### `PlayerRaceStats`
```typescript
class PlayerRaceStats {
    id: number;
    name: string;
    position: number;  // Race position ranking
}
```

### `ISteeringWheelDevice`
```typescript
interface ISteeringWheelDevice {
    deviceName: string;
    forwardButton: number;
    backwardButton: number;
    leftHandBrake: number;
    rightHandBrake: number;
    leftBurnoutBoost: number;
    rightBurnoutBoost: number;
    leftDonutBoost: number;
    rightDonutBoost: number;
}
```

### `SkidMarkSection`
```typescript
class SkidMarkSection {
    Pos: BABYLON.Vector3;     // World position
    Normal: BABYLON.Vector3;  // Surface normal
    Tangent: BABYLON.Vector4; // Cross-direction tangent
    Posl: BABYLON.Vector3;    // Left edge position
    Posr: BABYLON.Vector3;    // Right edge position
    Intensity: number;        // Mark opacity (0..1)
    LastIndex: number;        // Previous segment index (-1 = new mark)
}
```

---

## 15. Enums

### `WheelDriveType` (C# / TS mirrored as numeric)
```typescript
// Property: wheelDriveType: number
const RearWheelDrive = 0;
const FrontWheelDrive = 1;
const AllWheelDrive = 2;
```

### `SteeringWheelAxis` (C# / TS mirrored as numeric)
```typescript
// Property: steeringWheelAxis: number
const XAxis = 0;
const YAxis = 1;
const ZAxis = 2;  // Default
```

---

## 16. Game Architecture Blueprint

### Single-Player Race

```
[Scene]
  TrackManager
    ├── RaceTrackManager (TotalLapCount=3)
    └── SkidMarkManager

  PlayerCar (Prefab with physics body)
    ├── StandardCarController
    │     wheelDriveType=0 (RWD)
    │     topEngineSpeed=200
    ├── VehicleInputController
    │     enableInput=true
    │     playerNumber=One
    ├── VehicleCameraManager
    │     enableCamera=true
    │     autoAttachCamera=true
    └── CheckpointManager
          (register called from game manager on start)

  [Checkpoints] - N meshes tagged "Checkpoint"
```

### Multiplayer Race (4-player split-screen)

```
[Scene]
  TrackManager
    ├── RaceTrackManager
    └── SkidMarkManager

  Player1Car
    ├── StandardCarController
    ├── VehicleInputController (playerNumber=One)
    ├── VehicleCameraManager (autoAttachCamera=true)
    └── CheckpointManager

  Player2Car ... Player4Car (same structure, playerNumber=Two/Three/Four)
```

### Online Multiplayer Race

```
[Scene]
  NetworkManager
    └── ColyseusGameServer (from Starter system)

  LocalPlayerCar
    ├── StandardCarController
    ├── VehicleInputController (enableInput=true)
    ├── VehicleCameraManager
    ├── CheckpointManager
    └── ColyseusNetworkEntity (from Starter)
          postNetworkAttributes=true on StandardCarController

  [RemoteCar Prefab — spawned by NetworkManager]
    ├── RemoteCarController
    ├── NetworkCarPrediction
    └── VehicleNetworkLabel
```

---

## 17. Scene Setup Checklist

### Track Setup
- [ ] Create `TrackManager` empty GameObject
- [ ] Attach `PROJECT.RaceTrackManager` — set `TotalLapCount`
- [ ] Attach `PROJECT.SkidMarkManager` — assign `textureMarks`
- [ ] Export track spline nodes from Unity into `TrackNodes` property
- [ ] Export up to 5 race lines as control point arrays
- [ ] Tag all checkpoint volumes with `"Checkpoint"` tag
- [ ] Ensure checkpoint index 0 is the start/finish line

### Vehicle Setup
- [ ] Add physics body (`TOOLKIT.RigidbodyPhysics`) to car root
- [ ] Assign 4 wheel colliders to `StandardCarController`
- [ ] Assign 4 wheel mesh nodes for visual rotation
- [ ] Assign steering wheel hub (optional)
- [ ] Assign `smokeTexture` for tire smoke
- [ ] Assign brake light and reverse light meshes
- [ ] Assign `boosterTransform` for NOS visual effect
- [ ] Assign `chassisTransform` for tilt system

### Input Setup
- [ ] Set `enableInput=true` on `VehicleInputController` for human players
- [ ] For AI cars: set `trackManagerIdentity` to TrackManager object name, set `raceLineNode`
- [ ] Set `playerNumber` appropriately per car

### Camera Setup
- [ ] Ensure `DefaultCameraSystem` is in the scene (from Starter system)
- [ ] Set `enableCamera=true` and `autoAttachCamera=true` on `VehicleCameraManager`
- [ ] Configure `followHeight`, `minimumDistance`, `maximumDistance`

### Race Start Sequence
```typescript
// 1. Lock all cars on grid
cars.forEach(car => car.lockStartPosition());

// 2. Register all players
checkpointManagers.forEach((cm, i) => cm.register(i + 1, playerNames[i]));

// 3. Start countdown (3, 2, 1, GO...)

// 4. On GO:
cars.forEach(car => car.unlockStartPosition());
checkpointManagers.forEach(cm => cm.startRaceTimer());
```

---

## 18. Code Examples

### Extending StandardCarController for Nitrous Boost UI

```typescript
namespace PROJECT {
    export class MyRaceCar extends PROJECT.StandardCarController {
        private uiBoostBar: BABYLON.GUI.Rectangle = null;

        protected update(): void {
            super.update();
            this.updateBoostUI();
        }

        private updateBoostUI(): void {
            if (this.uiBoostBar != null) {
                const pct: number = this.getBoosterTime() / this.maxBoosterTime;
                this.uiBoostBar.width = (pct * 200).toFixed(0) + "px";
            }
        }
    }
    TOOLKIT.SceneManager.RegisterClass("PROJECT.MyRaceCar", MyRaceCar);
}
```

### Querying Race Position

```typescript
// In your HUD script:
const stats: PROJECT.PlayerRaceStats[] = PROJECT.RaceTrackManager.GetLeaderboardPositionList();
stats.forEach((s, i) => {
    console.log(`P${i+1}: ${s.name} — Position ${s.position}`);
});
```

### Listening for Race Over

```typescript
PROJECT.RaceTrackManager.EventBus.OnMessage("GameOver", () => {
    const winner: BABYLON.TransformNode = PROJECT.RaceTrackManager.WinnerTransform;
    console.log("Race won by: " + winner.name);
    // Show finish screen
});
```

### AI Car Setup (Autopilot)

```typescript
// In your AI car init script:
const input = TOOLKIT.SceneManager.GetComponent(carTransform, "PROJECT.VehicleInputController") as PROJECT.VehicleInputController;
input.enableInput = true;               // AI uses this flag too
input.raceLineNode = 0;                 // Race line index 0
input.driverSkillLevel = 2;             // Difficulty
input.chaseRabbitSpeed = 1.2;           // Faster rabbit = more aggressive
input.brakingTurnAngle = 20;            // Brake earlier on corners
```

### Reading Skid Data for Custom Effects

```typescript
const car = this.getComponent("PROJECT.StandardCarController") as PROJECT.StandardCarController;
const skidFL: number = car.getFrontLeftSkid();
const skidFR: number = car.getFrontRightSkid();
const isSkidding: boolean = car.getCurrentSkidding();
const burnoutActive: boolean = car.getCurrentBurnout();
```

### Grid Lock / Race Start Pattern

```typescript
// Game manager start:
protected start(): void {
    const cars = PROJECT.RaceTrackManager.GetPlayerVehicles();
    cars.forEach(carNode => {
        const ctrl = TOOLKIT.SceneManager.GetComponent(carNode, "PROJECT.StandardCarController") as PROJECT.StandardCarController;
        if (ctrl != null) ctrl.lockStartPosition();
    });
}

// On countdown complete:
public onRaceStart(): void {
    const cars = PROJECT.RaceTrackManager.GetPlayerVehicles();
    cars.forEach(carNode => {
        const ctrl = TOOLKIT.SceneManager.GetComponent(carNode, "PROJECT.StandardCarController") as PROJECT.StandardCarController;
        const cm = TOOLKIT.SceneManager.GetComponent(carNode, "PROJECT.CheckpointManager") as PROJECT.CheckpointManager;
        if (ctrl != null) ctrl.unlockStartPosition();
        if (cm != null) cm.startRaceTimer();
    });
}
```
