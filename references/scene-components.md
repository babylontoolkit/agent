# Interactive Scene Content (1.0.0)

**IMPORTANT. THIS DOCUMENT PROVIDES CRUCIAL SCENE COMPONENT INFORMATION. ALWAYS READ THIS ENTIRE DOCUMENT TO THE END OF FILE**

* Always reference the `Babylon Toolkit Component Reference` at https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/README.md for details regarding the script component model api.

* Important: Always use the default ES6 versions of BabylonJS, Babylon Toolkit, Babylon Toolkit React Framework and Babylon Toolkit Starter Projects, unless otherwise instructed to use the UMD versions.

## Interactive GLTF FILES

When asked to create a scene `component reference` for interfactive gltf scene files, please scan the gltf json looking for node `extras` metadata components. For example:
```
"name": "DefaultPlayer",
"extras": {
"metadata": {
    "guid": "d601760b-5a69-4393-b691-d72cd9f0c1ce",
    "components": [
    {
        "alias": "script",
        "order": -1,
        "klass": "TOOLKIT.CharacterController",
        "properties": {
        "avatarRadius": 0.28,
        "avatarHeight": 1.8,
        "centerOffset": {
            "x": 0.0,
            "y": 0.94,
            "z": 0.0
        },
        "skinWidth": 0.025,
        "slopeLimit": 45.0,
        "stepOffset": 0.25,
        "minMoveDistance": 0.0,
        "capsuleSegments": 16,
        "useGhostSweepTest": false
        },
        "instanceID": 157188,
        "instance": null
    },
    {
        "alias": "script",
        "order": 0,
        "klass": "PROJECT.ThirdPersonPlayerController",
        "properties": {
        "enableInput": true,
        "attachCamera": true,
        "playerNumber": 1,
        "playerControl": 0,
        "runKeyRequired": true,
        "arrowKeyRotation": true,
        "postNetworkAttribs": false,
        "rigidBodyMass": 85.0,
        "gravityMultiplier": 3.0,
        "stepUpVelocity": 1.0,
        "minStepHeight": 0.15,
        "minFallVelocity": 2.5,
        "airbornTimeout": 0.5,
        "groundCheckDist": 0.25,
        "moveSpeed": 5.335,
        "walkSpeed": 2.0,
        "jumpSpeed": 12.0,
        "jumpDelay": 0.25,
        "rootMotion": false,
        "lowTurnSpeed": 15.0,
        "highTurnSpeed": 25.0,
        "hasCharacterController": true,
        "maxAngle": 45.0,
        "useClimbSystem": false,
        "vaultVolumeTag": "Vault",
        "climbVolumeTag": "Climb",
        "rayClimbOffset": 0.35,
        "rayClimbLength": 0.85,
        "rayHeightOffset": 5.0,
        "rayHeightLength": 6.0,
        "maxHeightRanges": {
            "stepUpRange": {
            "minimumHeight": 0.25,
            "maximumHeight": 0.85,
            "rotationSpeed": 10.0,
            "rotateTowards": false,
            "matchHeight": false,
            "startTime": 0.0,
            "targetTime": 0.0,
            "targetOffset": 0.0
            },
            "jumpUpRange": {
            "minimumHeight": 0.85,
            "maximumHeight": 1.5,
            "rotationSpeed": 10.0,
            "rotateTowards": true,
            "matchHeight": false,
            "startTime": 0.0,
            "targetTime": 0.0,
            "targetOffset": 0.0
            },
            "climbUpRange": {
            "minimumHeight": 1.5,
            "maximumHeight": 2.5,
            "rotationSpeed": 10.0,
            "rotateTowards": true,
            "matchHeight": false,
            "startTime": 0.0,
            "targetTime": 0.0,
            "targetOffset": 0.0
            },
            "vaultOverRange": {
            "minimumHeight": 0.75,
            "maximumHeight": 1.25,
            "rotationSpeed": 10.0,
            "rotateTowards": true,
            "matchHeight": false,
            "startTime": 0.0,
            "targetTime": 0.0,
            "targetOffset": 0.0
            }
        },
        "createFootIKRig": false,
        "abstractSkinMesh": null,
        "rootBoneTransform": null,
        "leftFootTransform": null,
        "leftFootPoleOffset": {
            "x": -0.1,
            "y": 0.5,
            "z": 0.5
        },
        "leftFootMaxAngle": 180.0,
        "rightFootTransform": null,
        "rightFootMaxAngle": 180.0,
        "rightFootPoleOffset": {
            "x": 0.1,
            "y": 0.5,
            "z": 0.5
        },
        "displayHandles": false,
        "updateStateParams": true,
        "smoothMotionSpeed": true,
        "smoothInputVectors": false,
        "smoothDampTime": 0.1,
        "animationStateParams": {
            "moveDirection": "Direction",
            "inputMagnitude": "Magnitude",
            "horizontalInput": "Horizontal",
            "verticalInput": "Vertical",
            "mouseXInput": "MouseX",
            "mouseYInput": "MouseY",
            "heightInput": "Height",
            "speedInput": "Speed",
            "jumpFrame": "Jumped",
            "jumpState": "Jump",
            "actionState": "Action",
            "fallingState": "FreeFall",
            "slidingState": "Sliding",
            "groundedState": "Grounded"
        }
        },
        "instanceID": 157188,
        "instance": null
    }
    ]
  }
}
```

You can then generate a `component reference` markdown result breakdown of all the components in the scene. Be sure to include anything need that other AI can use to create game logic using interactive scene components. Cross reference any components found with with the AI Training Example Reference at https://raw.githubusercontent.com/babylontoolkit/agent/main/references/training-reference.md for detailed class information.

## Declaration File Class Information

Check the declaration files for detail class information

- https://raw.githubusercontent.com/babylontoolkit/agent/main/training/declarations/babylon.toolkit.d.ts: Babylon Toolkit type and API declarations.
- https://raw.githubusercontent.com/babylontoolkit/agent/main/training/declarations/default.playground.d.ts: Default playground project declarations.

---

## Babylon Toolkit Component Authority

Supplied GLTF and GLB files may contain interactive Babylon Toolkit and project script components serialized in node `extras.metadata.components` (see the example above). These files are not just art assets — they are **interactive prefabs** carrying configured physics, component types, serialized properties, animation setup, and gameplay intent.

Before implementing gameplay:

1. Scan all supplied scene and asset files for component metadata.
2. Produce a component inventory grouped by scene node.
3. Identify each component class, execution order (`order`), serialized properties and intended responsibility.
4. Cross-reference every `TOOLKIT.*` class against the declaration files listed above under **Declaration File Class Information** (`babylon.toolkit.d.ts`) and against the `Babylon Toolkit Component Reference` at https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/README.md — the component reference documents the Unity-style script component lifecycle every component follows (`awake`, `start`, `update`, `late`, `after`, `step`, `fixed`, `ready`, `destroy`).
5. Do not invent component APIs, methods or properties.
6. Do not bypass an existing component with direct transform manipulation or duplicate runtime systems.

Treat `TOOLKIT.*` components as the preferred engine-level implementation for functionality they already provide, including character control, animation state machines, Havok physics integration, navigation and raycast vehicles.

Build game-specific behavior through `PROJECT.*` ScriptComponents that orchestrate existing Toolkit systems. Register every project class with `TOOLKIT.SceneManager.RegisterClass("PROJECT.MyClass", MyClass)` so exported metadata can re-hydrate it at load time.

For example:

* Player scripts should calculate desired movement and invoke the existing character controller.
* Animation drivers should update parameters on the existing animation state component (`setFloat`, `setBool`, `setInteger`, `setTrigger`) instead of starting or stopping animation groups directly.
* Vehicle input and AI scripts should command the existing raycast vehicle and car controller components.
* Enemy logic should use existing navigation and character-control components where supplied.
* Gameplay scripts must follow the Babylon Toolkit component lifecycle and cleanup conventions (release observers, timers, input handlers and temporary resources in `destroy()`).

Do not remove, replace or reimplement a supplied `TOOLKIT.*` component merely because another architecture is possible.

Replacement is permitted only when:

* A required capability is absent from the declared API;
* A reproducible defect cannot be resolved through configuration or composition;
* Measured performance fails an explicit budget;
* Or a documented architectural requirement makes the supplied component incompatible.

Any proposed replacement must include:

1. The demonstrated limitation;
2. The test that reproduces it;
3. Configuration and composition alternatives attempted;
4. The scope and risks of replacement;
5. A rollback path;
6. Regression tests proving that existing behavior remains intact.

Preserve Unity-authored serialized values unless a measured gameplay, physics or performance issue justifies changing them.

**Agents should improve gameplay by composing and tuning the supplied systems, not by rebuilding foundational engine functionality.**

---

## Toolkit Component Cross-Reference

The `TOOLKIT` namespace ships first-class, production implementations of the systems a game needs. **If a row below covers the functionality you are about to write, the Toolkit component IS the implementation — write a `PROJECT.*` orchestration script around it, never a replacement.** Exact signatures for every class live in `babylon.toolkit.d.ts`; detailed usage lives in the numbered component reference documents at https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/README.md.

| Game functionality | First-class Toolkit components | Reference document |
|---|---|---|
| Scene lifecycle & orchestration | `TOOLKIT.SceneManager` (static hub — loading, timing, queries, event bus, `RegisterClass`, `FindScriptComponent`), `TOOLKIT.SceneController` (per-scene main controller base), `TOOLKIT.ScriptComponent` (Unity-style base class for ALL components) | [01-SceneManager](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/01-SceneManager.md), [02-ScriptComponent](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/02-ScriptComponent.md) |
| Character movement | `TOOLKIT.CharacterController` (Havok capsule — `move`, `jump`, `turn`, `set`, grounding, slope limits, step offsets), `TOOLKIT.RecastCharacterController`, `TOOLKIT.SimpleCharacterController` | [04-CharacterController](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/04-CharacterController.md) |
| Ready-made player controllers | `TOOLKIT.StandardPlayerController` (full first/third person), `TOOLKIT.ThirdPersonPlayerController`, `TOOLKIT.RemotePlayerController` (networked remote player) | [12-StarterContent](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/12-StarterContent.md) §5 |
| Animation | `TOOLKIT.AnimationState` (Unity Mecanim-style state machine — `setFloat`/`setBool`/`setInteger`/`setTrigger`, transitions, blend trees, layers, root motion), `TOOLKIT.AnimationMixer`, the blend-tree system classes | [03-AnimationState](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/03-AnimationState.md) |
| AI & navigation | `TOOLKIT.NavigationAgent` (Recast/Detour — `setDestination`, crowd simulation, `teleport`, off-mesh links) | [05-NavigationAgent](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/05-NavigationAgent.md) |
| Physics | `TOOLKIT.RigidbodyPhysics` (Havok rigidbodies, raycast, shapecast), `TOOLKIT.TriggerVolume`, Havok joint components (`BallSocketJoint`, `DistanceJoint`, `FixedHingeJoint`, `LockedJoint`, `PrismaticJoint`, `SixdofJoint`, `SliderJoint`) | [06-RigidbodyPhysics](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/06-RigidbodyPhysics.md), [12-StarterContent](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/12-StarterContent.md) §8 |
| Vehicles & racing | `TOOLKIT.RaycastVehicle` (wheel raycasts, suspension), `TOOLKIT.StandardCarController` (engine, gearbox, burnout), `TOOLKIT.VehicleInputController` (human input OR AI autopilot), `TOOLKIT.VehicleCameraManager`, `TOOLKIT.CheckpointManager` (laps), `TOOLKIT.RaceTrackManager` (track spline, leaderboard), `TOOLKIT.SkidMarkManager`, `TOOLKIT.RemoteCarController` | [06-RigidbodyPhysics](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/06-RigidbodyPhysics.md), [13-RacingSystem](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/13-RacingSystem.md) |
| Cameras | `TOOLKIT.DefaultCameraSystem` (main camera rig, post-processing pipeline, split-screen), `TOOLKIT.VehicleCameraManager`, `TOOLKIT.SideCameraController` (picture-in-picture) | [12-StarterContent](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/12-StarterContent.md) §4 |
| Input | `TOOLKIT.InputController` (keyboard/mouse/gamepad — axes, key state, pointer lock), `TOOLKIT.MobileInputController` (touch joysticks), `TOOLKIT.UserInputOptions` | [09-InputController](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/09-InputController.md), [12-StarterContent](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/12-StarterContent.md) §10 |
| Audio | `TOOLKIT.AudioSource` (spatial + 2D — play, pause, stop, volume), `TOOLKIT.SoundManager`, `TOOLKIT.SceneSoundSystem` | [07-AudioSource](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/07-AudioSource.md) |
| Particles & VFX | `TOOLKIT.ShurikenParticles` (Unity Shuriken-style), `TOOLKIT.FxParticleSystem`, `TOOLKIT.PostProcessor` | [10-ProComponents](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/10-ProComponents.md) |
| Materials & shaders | `TOOLKIT.CustomShaderMaterial` family, `TOOLKIT.UniversalTerrainMaterial`, `TOOLKIT.WaterMaterialSystem`, `TOOLKIT.SkyMaterialSystem`, `TOOLKIT.VertexAnimationMaterial` (VAT crowds), `TOOLKIT.TextureAtlasSkin` (skin variants), Node Material components (`NodeMaterialInstance`/`Particle`/`Process`/`Texture`) | [08-Materials](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/08-Materials.md), [12-StarterContent](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/12-StarterContent.md) §9 |
| Terrain & environment | `TOOLKIT.TerrainBuilder`, grass/tree/foliage materials (`GrassStandardMaterial`, `GrassBillboardMaterial`, `TreeBranchMaterial`) | [10-ProComponents](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/10-ProComponents.md) |
| UI | `TOOLKIT.UserInterface`, Unity-style GUI controls (`UnityDropdownMenu`, `UnityScrollBar`, `UnitySlider`) | [10-ProComponents](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/10-ProComponents.md), plus the UI Design System and Babylon GUI references |
| Asset pipeline & pooling | `TOOLKIT.AssetPreloader`, `TOOLKIT.PreloadAssetsManager`, `TOOLKIT.PrefabObjectPool` (object pooling), `TOOLKIT.AssetExporter`, the `CVTOOLS_unity_metadata` glTF loader extension | [12-StarterContent](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/12-StarterContent.md) §7 |
| Multiplayer / networking | Starter content `PROJECT.ColyseusGameServer` / `PROJECT.ColyseusNetworkEntity` / `PROJECT.ColyseusNetworkAvatar`, `PROJECT.NetworkCarPrediction` (client-side interpolation), `TOOLKIT.EntityController`, `TOOLKIT.GlobalMessageBus` / `TOOLKIT.LocalMessageBus` (event messaging) | [12-StarterContent](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/12-StarterContent.md) §6, [13-RacingSystem](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/13-RacingSystem.md) |
| Video, debug & utilities | `TOOLKIT.WebVideoPlayer`, `TOOLKIT.DebugInformation` (dev console overlay), `TOOLKIT.Utilities` (layer masks, math, helpers), `TOOLKIT.SceneManager.WaitForSeconds` (coroutine-style waits) | [10-ProComponents](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/10-ProComponents.md), [12-StarterContent](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/12-StarterContent.md) §11 |

Complete, coded game patterns — third-person player, AI enemy (navigation + animation + health), racing car, HUD/UI manager, object pooling, coroutine-style timing — live in [14-GamePatterns](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/14-GamePatterns.md). All TOOLKIT enums and interfaces live in [11-Enums-Interfaces](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/11-Enums-Interfaces.md).

---

**Use these references for details on interactive scene content**
