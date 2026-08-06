# TOOLKIT.ScriptComponent — Agent Reference

> **Type:** Abstract base class  
> **Extends:** Nothing (root of the component hierarchy)  
> **Namespace:** `TOOLKIT`  
> **Role:** Every game-logic script that attaches to a Unity exported node must extend `ScriptComponent`. It manages the full Unity-style component lifecycle, property bag, collision events, and helper utilities.

---

## Import

```typescript
import * as TOOLKIT from "@babylonjs-toolkit/next";
// named imports are equivalent: import { ScriptComponent, SceneManager, SearchType } from "@babylonjs-toolkit/next";
```

---

## Class Declaration Pattern

```typescript
namespace TOOLKIT {
    export class MyPlayerController extends TOOLKIT.ScriptComponent {
        
        // Serialized properties (set in Unity Inspector, read via getProperty)
        private moveSpeed: number = 5.0;
        private jumpForce: number = 8.0;

        constructor(transform: BABYLON.TransformNode, scene: BABYLON.Scene, properties: any = {}) {
            super(transform, scene, properties, "TOOLKIT.MyPlayerController");
        }

        // ─── Lifecycle ─────────────────────────────────────────────────────────
        protected awake(): void {
            // Called once on first enabled frame — read properties, cache references
            this.moveSpeed = this.getProperty("moveSpeed", 5.0);
            this.jumpForce = this.getProperty("jumpForce", 8.0);
        }

        protected start(): void {
            // Called frame after awake — safe to call other components' methods
        }

        protected ready(): void {
            // Called ~100ms after start — cross-component wiring is safe here
        }

        protected update(): void {
            // Called every frame (before render)
        }

        protected late(): void {
            // Called every frame (before render targets) — camera follow goes here
        }

        protected after(): void {
            // Called every frame (after render) — audio position update etc.
        }

        protected step(): void {
            // Called before physics step (onBeforePhysicsObservable)
        }

        protected fixed(): void {
            // Called after physics step (onAfterPhysicsObservable)
        }

        protected destroy(): void {
            // Called on dispose — clean up listeners, timers
        }
    }
}
```

> **Important:** The constructor signature `(transform, scene, properties, alias)` must be preserved. The `alias` string is the class name used for component registration and lookup (e.g. `"TOOLKIT.MyPlayerController"`).

---

## Lifecycle Execution Order

| Method | When | Notes |
|--------|------|-------|
| `awake()` | First frame transform is enabled | Once only. Read serialized properties here. |
| `start()` | Second frame | Once only. Call other components safely. |
| `ready()` | ~100 ms after start | Once only. Best for cross-component wiring. |
| `update()` | Every frame (pre-render) | Main game logic loop. |
| `late()` | Every frame (pre-render-targets) | Camera follow, look-at. |
| `after()` | Every frame (post-render) | Audio 3D update, HUD sync. |
| `step()` | Before physics | Prepare physics inputs. |
| `fixed()` | After physics | Read physics results, apply forces. |
| `destroy()` | On `dispose()` | Cleanup. |

> If a method is not defined in the subclass, the runtime skips it with zero overhead (checked via `instance["update"]` guard).

---

## Core Properties

```typescript
// Read-only references (set in constructor, never null during lifecycle)
this.scene      // BABYLON.Scene
this.transform  // BABYLON.TransformNode (the Unity GameObject equivalent)

// Component state
this.isReady()        // boolean — true after ready() has fired
this.getClassName()   // string — registered alias name
```

---

## Property Bag (Serialized Unity Inspector Values)

Properties are exported from Unity's Inspector and stored in the node's metadata. Read them in `awake()`.

```typescript
// Read a property with an optional default value
getProperty<T>(name: string, defaultValue?: T): T

// Write a property at runtime
setProperty(name: string, value: any): void

// Access the raw property bag object
getProperties(): any
```

**Example — reading Unity Inspector values:**
```typescript
protected awake(): void {
    // Unity: public float moveSpeed = 5;
    this.moveSpeed = this.getProperty("moveSpeed", 5.0);

    // Unity: public bool enableSprint = true;
    this.enableSprint = this.getProperty("enableSprint", true);

    // Unity: public string enemyTag = "Enemy";
    this.enemyTag = this.getProperty("enemyTag", "Enemy");

    // Unity: public Transform spawnPoint;  → IUnityTransform
    const spawnData = this.getProperty<TOOLKIT.IUnityTransform>("spawnPoint");
    if (spawnData != null) {
        const spawnNode = TOOLKIT.SceneManager.GetTransformNode(this.scene, spawnData.name);
    }

    // Unity: public AudioClip gunshot;  → IUnityAudioClip
    const clipData = this.getProperty<TOOLKIT.IUnityAudioClip>("gunshot");
    // clipData.filename gives the asset filename
}
```

---

## Timing Helpers (thin wrappers over SceneManager)

```typescript
this.getTime()              // wall clock seconds
this.getTimeMs()            // wall clock milliseconds
this.getGameTime()          // game time seconds
this.getGameTimeMs()        // game time ms
this.getDeltaTime()         // delta seconds (preferred)
this.getDeltaSeconds()      // delta seconds
this.getDeltaMilliseconds() // delta ms
this.getAnimationRatio()    // 60fps animation ratio
```

---

## Mesh Entity Helpers

```typescript
this.getTransformMesh()   // BABYLON.Mesh | null — cast if transform is a Mesh
this.getAbstractMesh()    // BABYLON.AbstractMesh | null
this.getInstancedMesh()   // BABYLON.InstancedMesh | null
this.getSkinnedMesh()     // BABYLON.AbstractMesh | null — the .Skin child node
this.hasSkinnedMesh()     // boolean
this.getPrimitiveMeshes() // BABYLON.AbstractMesh[] — all child primitive meshes
```

---

## Scene Search Helpers

```typescript
// Metadata of this node
this.getMetadata(): any  // returns this.transform.metadata.toolkit

// Find components on THIS node (or descendants)
this.getComponent<T>(klass: string, recursive?: boolean): T
this.getComponents<T>(klass: string, recursive?: boolean): T[]

// Light / Camera rigs
this.getLightRig(): BABYLON.Light
this.getCameraRig(): BABYLON.FreeCamera
```

---

## Tag Helpers (Unity Tag System)

```typescript
this.getTransformTag(): string             // primary tag string on this transform
this.hasTransformTags(query: string): boolean  // tag query match
```

---

## Child Node Helpers

```typescript
// Find a direct or recursive child by name
this.getChildNode(
    name: string,
    searchType: TOOLKIT.SearchType = TOOLKIT.SearchType.ExactMatch,
    directDecendantsOnly: boolean = true,
    predicate?: (node: BABYLON.Node) => boolean
): BABYLON.TransformNode

// Find children by tag
this.getChildWithTags(query, directOnly?, predicate?): BABYLON.TransformNode
this.getChildrenWithTags(query, directOnly?, predicate?): BABYLON.TransformNode[]

// Find children by component
this.getChildWithScript(klass, directOnly?, predicate?): BABYLON.TransformNode
this.getChildrenWithScript(klass, directOnly?, predicate?): BABYLON.TransformNode[]
```

**Example — finding child bones:**
```typescript
const rightHand = this.getChildNode("RightHand", TOOLKIT.SearchType.EndsWith, false);
const allWeapons = this.getChildrenWithScript("TOOLKIT.WeaponComponent", false);
```

---

## Physics Collision Events

To receive collision events, call `enableCollisionEvents()` in `awake()` or `start()`.

```typescript
// Enable/disable collision callbacks (requires Havok PhysicsBody on transform)
this.enableCollisionEvents(): void
this.disableCollisionEvents(): void

// Observables (subscribe before enabling)
this.onCollisionEnterObservable  // Observable<BABYLON.TransformNode> — first contact
this.onCollisionStayObservable   // Observable<BABYLON.TransformNode> — sustained contact
this.onCollisionExitObservable   // Observable<BABYLON.TransformNode> — contact ended

// Trigger volumes (isTrigger = true on the physics shape)
this.onTriggerEnterObservable    // Observable<BABYLON.TransformNode>
this.onTriggerExitObservable     // Observable<BABYLON.TransformNode>
```

**Example — damage zone trigger:**
```typescript
protected awake(): void {
    this.enableCollisionEvents();
    this.onTriggerEnterObservable.add((other: BABYLON.TransformNode) => {
        const health: HealthComponent = TOOLKIT.SceneManager.FindScriptComponent(
            other, "HealthComponent"
        );
        health?.takeDamage(25);
    });
}
```

---

## Physics Transform Helpers

```typescript
// Manually override physics body position (disablePreStep = false for one frame)
this.setTransformPosition(position: BABYLON.Vector3): void
this.setTransformRotation(rotation: BABYLON.Quaternion): void
```

---

## Click Action Registration

```typescript
// Works only if transform is an AbstractMesh
this.registerOnClickAction(func: () => void): BABYLON.IAction
this.unregisterOnClickAction(action: BABYLON.IAction): boolean
```

---

## Component Dispose

```typescript
this.dispose(): void
// Unregisters all render loop callbacks, removes physics observers,
// clears collision observables, calls destroy(), nulls references.
```

---

## Abstract Methods (Override These)

All lifecycle methods are optional (duck-typed). You only implement what you need:

```typescript
protected awake?(): void
protected start?(): void
protected ready?(): void
protected update?(): void
protected late?(): void
protected after?(): void
protected step?(): void
protected fixed?(): void
protected destroy?(): void
```

---

## ScriptComponent Subclass Pattern — Complete Example

```typescript
namespace TOOLKIT {
    /**
     * A simple pickup item that rotates, plays a sound when collected,
     * and destroys itself.
     */
    export class PickupItem extends TOOLKIT.ScriptComponent {
        private rotateSpeed: number = 90;   // degrees/sec
        private bobHeight: number = 0.2;
        private bobSpeed: number = 2.0;
        private startY: number = 0;
        private audio: TOOLKIT.AudioSource = null;

        constructor(transform: BABYLON.TransformNode, scene: BABYLON.Scene, properties: any = {}) {
            super(transform, scene, properties, "TOOLKIT.PickupItem");
        }

        protected awake(): void {
            this.rotateSpeed = this.getProperty("rotateSpeed", 90);
            this.bobHeight   = this.getProperty("bobHeight", 0.2);
            this.bobSpeed    = this.getProperty("bobSpeed", 2.0);
            this.startY      = this.transform.position.y;

            // Enable trigger detection
            this.enableCollisionEvents();
            this.onTriggerEnterObservable.add((other) => this.onPickup(other));
        }

        protected start(): void {
            // Get the AudioSource sibling component
            this.audio = this.getComponent("TOOLKIT.AudioSource");
        }

        protected update(): void {
            const dt = this.getDeltaSeconds();
            // Spin
            this.transform.addRotation(0, this.rotateSpeed * dt * TOOLKIT.System.Deg2Rad, 0);
            // Bob
            this.transform.position.y = this.startY +
                Math.sin(this.getTime() * this.bobSpeed) * this.bobHeight;
        }

        private onPickup(other: BABYLON.TransformNode): void {
            // Notify global bus
            TOOLKIT.SceneManager.EventBus.PostMessage("item:collected", {
                type: this.getProperty("itemType", "generic"),
                position: this.transform.position.clone()
            });
            // Play audio before destroying
            this.audio?.play();
            // Destroy after short delay (let audio start)
            TOOLKIT.SceneManager.SafeDestroy(this.transform, 500, true);
        }

        protected destroy(): void {
            this.onTriggerEnterObservable.clear();
        }
    }
}
```
