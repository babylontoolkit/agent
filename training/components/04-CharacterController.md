# TOOLKIT.CharacterController — Agent Reference

> **Extends:** `TOOLKIT.ScriptComponent`  
> **Namespace:** `TOOLKIT`  
> **Role:** Physics-based character controller backed by a Havok capsule rigidbody. Mirrors Unity's `CharacterController` API. The capsule is created automatically in `awake()`.

---

## Import

```typescript
import * as TOOLKIT from "@babylonjs-toolkit/next";
// named imports are equivalent: import { CharacterController, InputController, UserInputAxis, UserInputKey } from "@babylonjs-toolkit/next";
```

---

## Quick-Start Pattern

```typescript
// 1. Get component
const cc: TOOLKIT.CharacterController = TOOLKIT.SceneManager.FindScriptComponent(
    playerNode, "TOOLKIT.CharacterController"
);

// 2. Move in update() — pass velocity, not a direction vector
cc.move(new BABYLON.Vector3(0, 0, 3.0)); // 3 m/s forward

// 3. Jump
if (cc.isGrounded() && cc.canJump() && jumpPressed) {
    cc.jump(8.0); // 8 m/s upward impulse
}
```

---

## Instance Properties

```typescript
// Movement
cc.enableGravity          // boolean — default true (Havok applies gravity)
cc.enableUpdate           // boolean — default true (run movement logic)
cc.enableStepOffset       // boolean — default true (step-up small ledges)

// Ground detection tuning
cc.groundCheckDistance    // number — downward ray length for ground detection (default 0.25)
cc.contactHysteresisTime  // number — seconds of contact hysteresis (default 0.1)
cc.groundedEnterTime      // number — seconds before entering grounded state (default 0.1)
cc.groundedExitTime       // number — seconds before leaving grounded state (default 0.1)

// Velocity clamping
cc.downwardVelocityClamp  // number — maximum fall speed (default -30 m/s)

// Jump cooldown
cc.defaultJumpingTimer    // number — seconds before next jump allowed (default 0.25)
```

---

## Movement Methods

### `move(velocity)`
Main movement call. Call every frame from `update()` or `fixed()`.

```typescript
move(velocity: BABYLON.Vector3): void
```

- **`velocity`** is a **world-space velocity** in metres per second.
- Gravity is accumulated internally when `enableGravity = true`.
- Does **not** accumulate — call with the current desired velocity every frame.

```typescript
protected update(): void {
    const input = TOOLKIT.InputController.GetUserInput(TOOLKIT.UserInputAxis.Vertical);
    const strafe = TOOLKIT.InputController.GetUserInput(TOOLKIT.UserInputAxis.Horizontal);
    const forward = this.transform.forward.scale(input * this.moveSpeed);
    const right = this.transform.right.scale(strafe * this.moveSpeed);
    this.cc.move(forward.add(right));
}
```

### `jump(speed)`
```typescript
jump(speed: number): void
// Applies upward velocity impulse. Call once on button press.
// Internally sets vertical velocity to `speed` and resets jump timer.

if (cc.isGrounded() && cc.canJump() && input.jumpPressed) {
    cc.jump(8.0);
}
```

### `turn(angle)`
```typescript
turn(angle: number): void
// Rotates the character by `angle` degrees around Y axis.
// Equivalent to transform.addRotation(0, angle * DEG2RAD, 0).
```

### `rotate(x, y, z, w)`
```typescript
rotate(x: number, y: number, z: number, w: number): void
// Sets absolute rotation as a quaternion.
```

### `set(px, py, pz, rx?, ry?, rz?, rw?)`
```typescript
set(px: number, py: number, pz: number,
    rx?: number, ry?: number, rz?: number, rw?: number): void
// Teleport — sets both position and optional rotation in one call.
// Bypasses physics integration (no sweeping).
```

---

## Status Methods

```typescript
cc.isGrounded(): boolean         // true when capsule bottom is touching ground
cc.canJump(): boolean            // true when jump timer has expired
cc.getAvatarRadius(): number     // capsule radius
cc.getAvatarHeight(): number     // capsule height
cc.getVerticalVelocity(): number // current Y velocity (negative = falling)
cc.getGroundContactInfo(): any   // raw ground contact data from Havok
```

---

## Physics Settings

```typescript
cc.setRigidBodyMass(mass: number): void
cc.setCollisionState(collision: boolean): void
// Enables/disables collision response on the capsule body.

cc.setCollisionFilters(
    membershipMask: number,   // TOOLKIT.CollisionFilters bits
    collideMask: number       // TOOLKIT.CollisionFilters bits
): void
// Adjust which layers the capsule collides with at runtime.
```

---

## Observables

```typescript
cc.onUpdatePositionObservable  // Observable<BABYLON.TransformNode> — fires each frame after position update
cc.onUpdateVelocityObservable  // Observable<BABYLON.TransformNode> — fires each frame after velocity update
```

**Example — footstep audio trigger:**
```typescript
cc.onUpdateVelocityObservable.add((node) => {
    const vel = cc.getInputVelocity();
    if (cc.isGrounded() && Math.abs(vel.x) + Math.abs(vel.z) > 0.5) {
        const stepDist = BABYLON.Vector2.Distance(
            new BABYLON.Vector2(vel.x, vel.z), BABYLON.Vector2.Zero()
        );
        // trigger footstep every N metres
    }
});
```

---

## Internal Architecture

- The capsule `BABYLON.PhysicsBody` is created in `awake()` using the shape from `node.metadata.toolkit.physics`.
- If `TOOLKIT.SceneManager.PhysicsCapsuleShape` is non-zero, that shape index is used.
- The controller reads the Havok body's velocity each physics step and modifies it based on `move()` input.
- Step offset is implemented as a secondary downward/forward ray that auto-translates the capsule over small obstacles.
- Jump is implemented as a vertical impulse set directly on the Havok body's linear velocity.

---

## CollisionFilters Enum

Used with `setCollisionFilters`. Values are bitmasks.

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

## CollisionState Enum

Bullet/Havok-style activation states (informational — `cc.setCollisionState` takes a plain `boolean`).

```typescript
enum CollisionState {
    ACTIVE_TAG           = 1,
    ISLAND_SLEEPING      = 2,
    WANTS_DEACTIVATION   = 3,
    DISABLE_DEACTIVATION = 4,
    DISABLE_SIMULATION   = 5
}
```

---

## CharacterController + AnimationState Full Example

```typescript
namespace TOOLKIT {
    export class PlayerMovement extends TOOLKIT.ScriptComponent {
        private cc: TOOLKIT.CharacterController = null;
        private anim: TOOLKIT.AnimationState = null;
        private moveSpeed: number = 5.0;
        private jumpForce: number = 8.0;
        private rotSpeed: number = 360.0;
        private camera: BABYLON.FreeCamera = null;

        constructor(t: BABYLON.TransformNode, s: BABYLON.Scene, p: any = {}) {
            super(t, s, p, "TOOLKIT.PlayerMovement");
        }

        protected awake(): void {
            this.moveSpeed = this.getProperty("moveSpeed", 5.0);
            this.jumpForce = this.getProperty("jumpForce", 8.0);
            this.rotSpeed  = this.getProperty("rotSpeed", 360.0);
        }

        protected start(): void {
            this.cc   = this.getComponent("TOOLKIT.CharacterController");
            this.anim = this.getComponent("TOOLKIT.AnimationState");
            this.camera = this.getCameraRig() as BABYLON.FreeCamera;
        }

        protected update(): void {
            const dt       = this.getDeltaSeconds();
            const vertical = TOOLKIT.InputController.GetUserInput(TOOLKIT.UserInputAxis.Vertical);
            const horiz    = TOOLKIT.InputController.GetUserInput(TOOLKIT.UserInputAxis.Horizontal);
            const jumpKey  = TOOLKIT.InputController.WasKeyboardButtonTapped(TOOLKIT.UserInputKey.SpaceBar, true);

            // ── Rotation (Y-axis) ────────────────────────────────────────────
            if (Math.abs(horiz) > 0.01) {
                this.cc.turn(horiz * this.rotSpeed * dt);
            }

            // ── Translation ──────────────────────────────────────────────────
            const fwd = this.transform.forward.scale(vertical * this.moveSpeed);
            this.cc.move(fwd);

            // ── Jump ─────────────────────────────────────────────────────────
            if (jumpKey && this.cc.isGrounded() && this.cc.canJump()) {
                this.cc.jump(this.jumpForce);
                this.anim?.setTrigger("Jump");
            }

            // ── Animation Parameters ─────────────────────────────────────────
            const speed = Math.abs(vertical) * this.moveSpeed;
            this.anim?.setSmoothFloat("Speed", speed, 0.1);
            this.anim?.setBool("IsGrounded", this.cc.isGrounded());
            this.anim?.setFloat("VerticalVelocity", this.cc.getVerticalVelocity());
        }
    }
}
```

---

## Slope and Step Offset Notes

- **Slope Limit**: Configured in Unity via the `CharacterController` slope limit. Exported as metadata; the runtime will not allow movement up slopes steeper than this angle.
- **Step Offset**: Configurable in Unity (typical 0.3 m). Small steps up to this height are auto-stepped.
- **Skin Width**: A small buffer (0.08 m default) around the capsule that prevents penetration jitter.
