# Babylon Toolkit — AI Agent Reference Overview

> **Version:** 9.9.1 - R1  
> **Namespace:** `TOOLKIT`  
> **Engine:** Babylon.js 9+  
> **Purpose:** This reference is written for AI coding agents. It describes every class, lifecycle, API method, and common usage pattern in the Babylon Toolkit so an agent can write correct game-logic code without guessing.

---

## What Is The Babylon Toolkit?

The Babylon Toolkit (BT) is a **Unity-to-Babylon game runtime**. It exports Unity scenes, prefabs, and components as glTF files enriched with `CVTOOLS_unity_metadata` extras, then re-hydrates them at runtime in the browser using a TypeScript library compiled into the `TOOLKIT` namespace.

The key mental model: **Unity = editor / authoring tool. Babylon = runtime renderer. BT bridges them.**

Everything lives in the `TOOLKIT` namespace (e.g. `TOOLKIT.SceneManager`, `TOOLKIT.AnimationState`).

---

## Document Index

| File | Contents |
|------|----------|
| [01-SceneManager.md](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/01-SceneManager.md) | Static scene manager — loading, timing, queries, shadow, physics, utilities |
| [02-ScriptComponent.md](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/02-ScriptComponent.md) | Base component class — lifecycle, property bag, collision events, helpers |
| [03-AnimationState.md](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/03-AnimationState.md) | Unity Mechanim-style animator — state machine, parameters, blend trees, root motion |
| [04-CharacterController.md](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/04-CharacterController.md) | Physics-based character controller — move, jump, grounding, collisions |
| [05-NavigationAgent.md](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/05-NavigationAgent.md) | Recast/Detour AI navigation agent — setDestination, crowd, off-mesh links |
| [06-RigidbodyPhysics.md](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/06-RigidbodyPhysics.md) | Havok rigidbody, raycast, shapecast, vehicle physics |
| [07-AudioSource.md](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/07-AudioSource.md) | Spatial and non-spatial audio — play, pause, stop, volume, mute |
| [08-Materials.md](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/08-Materials.md) | CustomShaderMaterial, PBR uniforms, terrain, standard, vertex animation materials |
| [09-InputController.md](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/09-InputController.md) | Keyboard, mouse, gamepad — axis, key state, pointer lock, joystick |
| [10-ProComponents.md](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/10-ProComponents.md) | PostProcessor, TerrainBuilder, ShurikenParticles, WebVideoPlayer, UserInterface |
| [11-Enums-Interfaces.md](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/11-Enums-Interfaces.md) | All TOOLKIT enums and exported interfaces |
| [12-StarterContent.md](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/12-StarterContent.md) | Starter content to superchage game developer |
| [13-RacingSystem.md](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/13-RacingSystem.md) | Need For Speed arcade style racing system |
| [14-GamePatterns.md](https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/14-GamePatterns.md) | Complete coded examples — player controller, AI enemy, vehicle, UI HUD |

---

## Architecture At A Glance

```
Unity Editor (C# Exporter)
    │
    ▼
glTF + CVTOOLS_unity_metadata extras
    │
    ▼
TOOLKIT.SceneManager  ← static singleton — scene lifecycle hub
    │
    ├── Parses gltf extras → creates ScriptComponent instances per node
    │
    └── Each TransformNode may host N ScriptComponents
            │
            ├── awake()    — first frame the transform is enabled
            ├── start()    — second frame
            ├── update()   — every render frame (before render)
            ├── late()     — every frame (before render targets)
            ├── after()    — every frame (after render)
            ├── step()     — before physics step
            ├── fixed()    — after physics step
            ├── ready()    — 100ms after start (good for cross-component wiring)
            └── destroy()  — on dispose
```

---

## Runtime Initialization Pattern

```typescript
// Minimal initialization (Playground / quick start)
await TOOLKIT.SceneManager.InitializePlayground(engine, {
    enableUserInput: true,
    showDefaultLoadingScreen: true
});

// Load scene assets
const assetsManager = new BABYLON.AssetsManager(scene);
const sceneTask = assetsManager.addContainerTask("level", "", "assets/", "level.gltf");
await TOOLKIT.SceneManager.LoadRuntimeAssets(assetsManager, ["level.gltf"], () => {
    // scene is ready — all script components already parsed and running
    console.log("Scene ready!");
});
```

---

## Key Global Configuration Flags

```typescript
TOOLKIT.SceneManager.EnableDebugMode       // boolean — enable console logs
TOOLKIT.SceneManager.EnableUserInput       // boolean — enable input controller
TOOLKIT.SceneManager.ParseScriptComponents // boolean — auto-parse components from metadata
TOOLKIT.SceneManager.AutoLoadScriptBundles // boolean — auto-load project script bundles
TOOLKIT.SceneManager.AnimationTargetFps    // number  — target animation FPS (default 60)
TOOLKIT.SceneManager.GlobalOptions         // any     — key/value global config bag
TOOLKIT.SceneManager.EventBus             // GlobalMessageBus — scene-wide messaging
```

---

## Finding Components On Nodes

```typescript
// Get one component by class name
const anim: TOOLKIT.AnimationState = TOOLKIT.SceneManager.FindScriptComponent(
    transformNode, "TOOLKIT.AnimationState"
);

// Get all components of a class on node + descendants
const all: TOOLKIT.AudioSource[] = TOOLKIT.SceneManager.FindAllScriptComponents(
    node, "TOOLKIT.AudioSource", true
);

// From inside a ScriptComponent subclass:
const anim: TOOLKIT.AnimationState = this.getComponent("TOOLKIT.AnimationState");
const child = this.getChildNode("Head", TOOLKIT.SearchType.ExactMatch);
```

---

## Global Event Bus

```typescript
// Subscribe
TOOLKIT.SceneManager.EventBus.OnMessage("player:died", (data: any) => {
    console.log("Player died with data:", data);
});

// Publish
TOOLKIT.SceneManager.EventBus.PostMessage("player:died", { score: 500 });
```

---

## Metadata System (CVTOOLS)

Every exported Unity node carries metadata under:
```
node.metadata.toolkit
  .components[]     — array of script component descriptors
  .physics          — physics shape, mass, layer info
  .prefab           — prefab source info
  .tag              — Unity tag string
  .layer            — Unity layer number
  .animator         — serialized Animator Controller (for AnimationState)
  .navagent         — navigation agent properties
  .wheels           — wheel collider data (for RaycastVehicle)
```

---

## Layer Masking

```typescript
// Unity layer → bitmask
const mask = TOOLKIT.Utilities.GetLayerMask(8); // Layer 8

// Check membership
const isMasked = TOOLKIT.Utilities.IsLayerMasked(collideMask, 8);

// Built-in masks
TOOLKIT.SceneManager.AllLayerMask     // 0xFFFFFFFF
TOOLKIT.SceneManager.DefaultLayerMask // 0x0FFFFFFF
TOOLKIT.SceneManager.HiddenLayerMask  // 0x10000000 (layer 28)
```

---

## WaitForSeconds Utility

```typescript
// Inside any async method
await TOOLKIT.SceneManager.WaitForSeconds(2.5); // wait 2.5 s
```
