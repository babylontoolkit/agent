# TOOLKIT.RigidbodyPhysics — Agent Reference

> **Extends:** `TOOLKIT.ScriptComponent`  
> **Namespace:** `TOOLKIT`  
> **Physics Engine:** Havok (accessed via `globalThis.HK` / `globalThis.HKP`)  
> **Role:** Wraps a Havok physics body for a TransformNode. Also serves as the host component for vehicle physics (`RaycastVehicle`). Exposes static methods for raycasting and shapecasting.

---

## Import

```typescript
import * as TOOLKIT from "@babylonjs-toolkit/next";
// named imports are equivalent: import { RigidbodyPhysics, RaycastVehicle, CollisionFilters } from "@babylonjs-toolkit/next";
```

---

## Engine Initialization

Must be called once before any physics components are created, typically in your scene setup.

```typescript
static async RigidbodyPhysics.ConfigurePhysicsEngine(
    scene: BABYLON.Scene,
    fixedTimeStep?: boolean,     // use a fixed physics timestep
    subTimeStep?: number,        // substeps per frame (default 1)
    maxWorldSweep?: number,      // max CCD sweep (default 100)
    ccdEnabled?: boolean,        // continuous collision detection (default true)
    ccdPenetration?: number,     // CCD penetration depth (default 0)
    gravityLevel?: BABYLON.Vector3  // default (0, -9.81, 0)
): Promise<void>
```

**Example (scene setup):**
```typescript
await TOOLKIT.RigidbodyPhysics.ConfigurePhysicsEngine(
    scene,
    true,    // fixed timestep
    2,       // 2 substeps for smoother simulation
    100,
    true
);
```

---

## Static Raycasting

### `Raycast`
Quick single-result ray cast.

```typescript
static Raycast(
    origin: BABYLON.Vector3,
    direction: BABYLON.Vector3,
    length: number,
    query?: BABYLON.IRaycastQuery
): BABYLON.PhysicsRaycastResult
```

**Result properties:**
```typescript
result.hasHit           // boolean
result.hitPointWorld    // BABYLON.Vector3
result.hitNormalWorld   // BABYLON.Vector3
result.hitDistance      // number
result.body             // BABYLON.PhysicsBody | null
result.body?.transformNode  // BABYLON.TransformNode — the hit object
```

**Example:**
```typescript
// Ground check ray
const hit = TOOLKIT.RigidbodyPhysics.Raycast(
    this.transform.position,
    BABYLON.Vector3.Down(),
    2.0
);
if (hit.hasHit) {
    console.log("Ground at Y:", hit.hitPointWorld.y);
}
```

### `RaycastToRef`
Reuses an existing result object to avoid GC pressure — preferred in `update()`.

```typescript
static RaycastToRef(
    from: BABYLON.Vector3,
    to: BABYLON.Vector3,   // absolute end point (not direction + length)
    result: BABYLON.PhysicsRaycastResult,
    query?: BABYLON.IRaycastQuery
): void
```

```typescript
// Pre-allocate in awake/start
private rayResult = new BABYLON.PhysicsRaycastResult();
private rayEnd    = new BABYLON.Vector3();

protected update(): void {
    const origin = this.transform.position;
    BABYLON.Vector3.AddToRef(origin, BABYLON.Vector3.Down().scale(2), this.rayEnd);
    TOOLKIT.RigidbodyPhysics.RaycastToRef(origin, this.rayEnd, this.rayResult);

    if (this.rayResult.hasHit) {
        // handle ground
    }
}
```

---

## Static Shapecasting

### `Shapecast`
Cast a physics shape through the scene.

```typescript
static Shapecast(
    query: BABYLON.IPhysicsShapeCastQuery
): BABYLON.IPhysicsShapeCastResult
```

### `ShapecastToRef`
Reusable version for per-frame use.

```typescript
static ShapecastToRef(
    query: BABYLON.IPhysicsShapeCastQuery,
    localShapeResult: BABYLON.ShapeCastResult,
    worldShapeResult: BABYLON.ShapeCastResult
): void
```

---

## Velocity Limits (Global)

Direct Havok WASM memory manipulation — applies to all bodies.

```typescript
static SetMaxVelocities(
    maxLinearVelocity: number,    // m/s (default is Havok's internal max)
    maxAngularVelocity: number    // rad/s
): void
```

---

## Instance Usage (attached to a node)

When `RigidbodyPhysics` is attached to a node with a standard physics shape (box, sphere, convex, mesh), it creates the `BABYLON.PhysicsBody` automatically in `awake()`.

```typescript
// Get the Babylon PhysicsBody (attached to the transform node)
const body = rigidbodyComponent.transform.physicsBody;

// Common body operations
body.setLinearVelocity(new BABYLON.Vector3(0, 10, 0));
body.setAngularVelocity(BABYLON.Vector3.Zero());
body.applyImpulse(impulse, position);
body.applyForce(force, position);
body.setMassProperties({ mass: 5.0, centerOfMass: BABYLON.Vector3.Zero() });

// Shape / collision
body.shape.filterMembershipMask = TOOLKIT.CollisionFilters.DefaultFilter;
body.shape.filterCollideMask    = TOOLKIT.CollisionFilters.StaticFilter | TOOLKIT.CollisionFilters.DefaultFilter;
```

---

## Vehicle Physics (RaycastVehicle)

When the node has wheel collider metadata (`hasWheelColliders() === true`), the `RigidbodyPhysics` component automatically creates a `TOOLKIT.RaycastVehicle`.

```typescript
// Check if this rigidbody is a vehicle
rigidbody.hasWheelColliders(): boolean

// Get the vehicle controller
const vehicle = rigidbody.getRaycastVehicle();
```

### `TOOLKIT.RaycastVehicle` Quick Reference

```typescript
vehicle.setEngineForce(power: number, wheel: number): void
vehicle.setBrakingForce(brake: number, wheel: number): void
vehicle.setPhysicsSteeringAngle(angle: number, wheel: number): void  // radians — steers the physics wheel
vehicle.setVisualSteeringAngle(angle: number, wheel: number): void   // wheel mesh display only

vehicle.getNumWheels(): number
vehicle.getWheelInfo(wheel: number): TOOLKIT.btWheelInfo
// wheelInfo.rotation           — number (radians)
// wheelInfo.raycastInfo.isInContact   — boolean
// wheelInfo.raycastInfo.contactPointWS — BABYLON.Vector3
vehicle.getWheelTransformPosition(wheel: number): BABYLON.Vector3
vehicle.getWheelTransformRotation(wheel: number): BABYLON.Quaternion

vehicle.getForwardVector(): BABYLON.Vector3
vehicle.getRawCurrentSpeedKph(): number   // signed km/h (negative = reversing)
vehicle.getRawCurrentSpeedMph(): number   // signed mph
vehicle.getAbsCurrentSpeedKph(): number   // absolute km/h
vehicle.getAbsCurrentSpeedMph(): number   // absolute mph

vehicle.resetSuspension(): void
```

**Basic vehicle controller pattern:**
```typescript
namespace TOOLKIT {
    export class CarController extends TOOLKIT.ScriptComponent {
        private vehicle: TOOLKIT.RaycastVehicle = null;
        private engineForce: number = 0;
        private steerValue: number = 0;
        private maxEngineForce: number = 2000;
        private maxSteer: number = 0.5;

        constructor(t: BABYLON.TransformNode, s: BABYLON.Scene, p: any = {}) {
            super(t, s, p, "TOOLKIT.CarController");
        }

        protected start(): void {
            const rb: TOOLKIT.RigidbodyPhysics = this.getComponent("TOOLKIT.RigidbodyPhysics");
            this.vehicle = rb?.getRaycastVehicle();
        }

        protected update(): void {
            const accel = TOOLKIT.InputController.GetUserInput(TOOLKIT.UserInputAxis.Vertical);
            const steer = TOOLKIT.InputController.GetUserInput(TOOLKIT.UserInputAxis.Horizontal);

            this.engineForce = accel * this.maxEngineForce;
            this.steerValue  = steer * this.maxSteer;

            // Rear-wheel drive (wheels 2 and 3)
            this.vehicle?.setEngineForce(this.engineForce, 2);
            this.vehicle?.setEngineForce(this.engineForce, 3);

            // Front-wheel steering (wheels 0 and 1)
            this.vehicle?.setPhysicsSteeringAngle(-this.steerValue, 0);
            this.vehicle?.setPhysicsSteeringAngle(-this.steerValue, 1);

            // Braking
            const braking = TOOLKIT.InputController.GetKeyboardInput(TOOLKIT.UserInputKey.SpaceBar) ? 50 : 0;
            for (let i = 0; i < 4; i++) this.vehicle?.setBrakingForce(braking, i);
        }
    }
}
```

---

## PhysicsBody Force / Impulse Quick Reference

```typescript
// Instant velocity change (fire-and-forget)
body.applyImpulse(
    impulse: BABYLON.Vector3,
    applyPoint: BABYLON.Vector3  // world position to apply at
): void

// Continuous force (applied over fixedDeltaTime)
body.applyForce(
    force: BABYLON.Vector3,
    applyPoint: BABYLON.Vector3
): void

// Zero out velocities
body.setLinearVelocity(BABYLON.Vector3.Zero());
body.setAngularVelocity(BABYLON.Vector3.Zero());
```

---

## CollisionFilters Enum

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

---

## Notes For AI Agents

1. **`ConfigurePhysicsEngine` must be awaited** before any scene loads that contain physics objects.
2. **Prefer `RaycastToRef`** over `Raycast` in per-frame code to avoid allocating a new result object each frame.
3. **Wheel index convention** — typically 0/1 are front-left/right, 2/3 are rear-left/right, but verify against the Unity WheelCollider export.
4. **Collision filter mask** — if a rigidbody's shape `filterCollideMask` does not include the other body's `filterMembershipMask`, they will not collide.
