# TOOLKIT.AnimationState — Agent Reference

> **Extends:** `TOOLKIT.ScriptComponent`  
> **Namespace:** `TOOLKIT`  
> **Role:** Unity Mechanim-compatible animation state machine. Reads serialized `AnimatorController` metadata exported from Unity, drives `BABYLON.AnimationGroup` clips, supports transitions, conditions, blend trees, layers, root motion, IK callbacks, smooth damping, and Vertex Animation Textures (VAT).

---

## Import

```typescript
import * as TOOLKIT from "@babylonjs-toolkit/next";
// named imports are equivalent: import { AnimationState, ScriptComponent, SceneManager } from "@babylonjs-toolkit/next";
```

---

## Quick-Start Lookup

```typescript
// 1. Get the component from a node
const anim: TOOLKIT.AnimationState = TOOLKIT.SceneManager.FindScriptComponent(
    characterNode, "TOOLKIT.AnimationState"
);

// 2. Drive parameters (exactly like Unity's Animator)
anim.setFloat("Speed", 1.0);
anim.setBool("IsAiming", true);
anim.setTrigger("Attack");
anim.setInteger("WeaponIndex", 2);

// 3. Play a specific state directly
anim.playAnimation("Run", 0.25);  // blends in over 0.25s

// 4. Smooth float parameter (Unity-style with dampTime)
anim.setSmoothFloat("Speed", targetSpeed, 0.15);
```

---

## Static Constants

```typescript
TOOLKIT.AnimationState.FPS   // number = 30 — default animation sample rate
TOOLKIT.AnimationState.EXIT  // string = "[EXIT]" — exit state marker
TOOLKIT.AnimationState.TIME  // number = 1.0 — normalized time constant
```

---

## Instance Properties (Public)

```typescript
animator.speedRatio           // number — global playback speed multiplier (default 1.0)
animator.delayStart           // number — delay before state machine starts (ms)
animator.enableAnimations     // boolean — master enable/disable for clip playback
animator.applyRootMotion      // boolean — apply root motion delta to transform
animator.delayUpdateUntilReady // boolean — wait for ready() before first update
```

---

## State Machine Parameters

These mirror Unity's `Animator.SetFloat`, `SetBool`, `SetTrigger`, `SetInteger` exactly.

### Float Parameters
```typescript
anim.hasFloat(name: string): boolean
anim.getFloat(name: string): number
anim.setFloat(name: string, value: number): void

// Smooth damp (set-and-forget, spring-based — matches Unity's Animator.SetFloat with dampTime)
anim.setSmoothFloat(name: string, targetValue: number, dampTime?: number, _deltaTime?: number): void
// dampTime = approximate seconds to reach target (default 0.1)
// Call once and the spring drives automatically each frame until it converges
```

### Integer Parameters
```typescript
anim.hasInteger(name: string): boolean
anim.getInteger(name: string): number
anim.setInteger(name: string, value: number): void
anim.setSmoothInteger(name: string, targetValue: number, dampTime?: number): void
```

### Boolean Parameters
```typescript
anim.hasBool(name: string): boolean
anim.getBool(name: string): boolean
anim.setBool(name: string, value: boolean): void
```

### Trigger Parameters
```typescript
anim.hasTrigger(name: string): boolean
anim.getTrigger(name: string): boolean
anim.setTrigger(name: string): void      // sets to true, state machine resets it
anim.resetTrigger(name: string): void   // manually reset
```

---

## Playback Control

### Direct Playback (bypasses state machine)
```typescript
// Play default entry state
anim.playDefault(transitionDuration?: number, animationLayer?: number, frameRate?: number): boolean

// Play named state
anim.playAnimation(
    state: string,
    transitionDuration?: number,   // blend duration in seconds (default 0.1)
    animationLayer?: number,       // layer index (default 0)
    frameRate?: number
): boolean

// Stop current state on a layer
anim.stopAnimation(animationLayer?: number): boolean

// Kill all layers immediately
anim.killAnimations(): boolean
```

### Timeline Scrubbing (VAT / editor preview)
```typescript
anim.setTimelineScrubbing(isScrubbing: boolean): void
anim.getIsTimelineScrubbing(): boolean
anim.setAnimationTime(seconds: number): boolean   // seek to time (VAT only)
anim.setAnimationSpeed(speed: number): boolean    // set playback speed (VAT only)
anim.setAnimationLoop(loop: boolean): boolean     // set loop mode (VAT only)
```

---

## State Machine Inspection

```typescript
anim.awakened(): boolean         // state machine has been awoken
anim.initialized(): boolean      // default skeleton animation group set up successfully
anim.hasRootMotion(): boolean    // clip has root motion data
anim.isFirstFrame(): boolean     // current frame is first frame
anim.isLastFrame(): boolean      // current frame >= 98.5% through clip
anim.ikFrameEnabled(): boolean   // IK callback is pending this frame
anim.getAnimationTime(): number  // normalized time [0..1] of current state
anim.getFrameLoopTime(): boolean // is current state looping by time
anim.getFrameLoopBlend(): boolean // is looping by blend
anim.getAnimationPlaying(): boolean
anim.getRuntimeController(): string  // animator controller asset name

// Current state on a layer
anim.getCurrentState(layer: number): TOOLKIT.MachineState
```

---

## Root Motion

When `applyRootMotion = true`, the state machine computes per-frame delta transforms extracted from the root bone animation curves and can drive the character transform.

```typescript
anim.applyRootMotion: boolean               // enable root motion application
anim.getDeltaRootMotionSpeed(): number       // forward speed delta this frame (m/s)
anim.getDeltaRootMotionAngle(): number       // angular velocity Y (radians)
anim.getDeltaRootMotionPosition(): BABYLON.Vector3
anim.getDeltaRootMotionRotation(): BABYLON.Quaternion
anim.getFixedRootMotionPosition(): BABYLON.Vector3  // null if not in dirty matrix frame
anim.getFixedRootMotionRotation(): BABYLON.Quaternion
anim.getRootBoneTransform(): BABYLON.TransformNode
```

**Root motion usage pattern:**
```typescript
protected fixed(): void {
    if (this.anim.applyRootMotion) {
        // let state machine move the character
        const speed = this.anim.getDeltaRootMotionSpeed();
        const angle = this.anim.getDeltaRootMotionAngle();
        // ... drive CharacterController or directly apply to transform
    }
}
```

---

## Observables

```typescript
anim.onAnimationAwakeObservable    // Observable<BABYLON.TransformNode> — state machine awakened
anim.onAnimationInitObservable     // Observable<BABYLON.TransformNode> — initialized
anim.onAnimationIKObservable       // Observable<number> — IK callback (layer index)
anim.onAnimationEndObservable      // Observable<number> — clip ended (layer index)
anim.onAnimationLoopObservable     // Observable<number> — clip looped (layer index)
anim.onAnimationEventObservable    // Observable<TOOLKIT.IAnimatorEvent> — Unity animation event
anim.onAnimationUpdateObservable   // Observable<BABYLON.TransformNode> — frame updated
anim.onAnimationTransitionObservable // Observable<BABYLON.TransformNode> — transitioning
```

**IK callback pattern:**
```typescript
anim.onAnimationIKObservable.add((layerIndex: number) => {
    // Position hand IK targets this frame
    ikRig.updateHandIK(layerIndex);
});
```

**Animation events (Unity-style):**
```typescript
anim.onAnimationEventObservable.add((evt: TOOLKIT.IAnimatorEvent) => {
    // evt.function — string function name set in Unity Animation Event
    // evt.time — float (normalized clip time)
    if (evt.function === "FootstepLeft") { playFootstep("left"); }
    if (evt.function === "SpawnProjectile") { spawnBullet(); }
});
```

---

## Vertex Animation Texture (VAT) Mode

Some exported characters use VAT (baked skinning in a texture). The `AnimationState` detects this automatically from metadata.

```typescript
anim.isVertexAnimationModeEnabled(): boolean
anim.getVertexAnimationController(): TOOLKIT.VertexAnimationController

// Get the material for a specific renderer/sub-mesh
anim.getVertexAnimationMaterial(rendererIndex?: number, subMeshIndex?: number): TOOLKIT.VertexAnimationMaterial
// Returns null if not in VAT mode or no VertexAnimationMaterial found

// Swap albedo texture on a VAT instance (per-instance, non-destructive)
const mat = anim.getVertexAnimationMaterial();
mat.albedoTexture = new BABYLON.Texture("skins/skin2.png", scene);
```

---

## Animation Layers

Babylon Toolkit supports multi-layer animation (additive / override) matching Unity's Animator Layers.

```typescript
// Play on a specific layer
anim.playAnimation("WaveArm", 0.1, 1);  // layer 1

// Stop layer
anim.stopAnimation(1);

// Get state on layer
const state = anim.getCurrentState(1);
console.log("Layer 1 state:", state?.name);
```

---

## Blend Trees

The state machine automatically evaluates blend trees when you set parameters. You do not manually configure blend trees at runtime — they are defined in the Unity Animator Controller and serialized in metadata.

**1D Blend Tree:**
```typescript
// Unity: BlendTree parameterized on "Speed"
anim.setFloat("Speed", 0.0);  // plays Idle
anim.setFloat("Speed", 0.5);  // blends between Walk and Run
anim.setFloat("Speed", 1.0);  // plays Run
```

**2D Blend Tree (Freeform Directional / Cartesian):**
```typescript
// Unity: 2D BlendTree parameterized on "Horizontal" and "Vertical"
anim.setFloat("Horizontal", 1.0);
anim.setFloat("Vertical", 0.0);  // strafes right
```

---

## Transition Conditions

Transitions are driven automatically by the state machine based on parameters you set. You **do not** call any transition method — just update parameters.

**Unity Animator Controller metadata drives:**
- Condition comparisons (`Greater`, `Less`, `Equals`, `NotEqual`, `true`, `false`)
- Exit time conditions
- Transition duration (cross-fade blending speed)
- Interruption sources

---

## Complete Character Animation Pattern

```typescript
namespace TOOLKIT {
    export class CharacterAnimator extends TOOLKIT.ScriptComponent {
        private anim: TOOLKIT.AnimationState = null;
        private controller: TOOLKIT.CharacterController = null;

        constructor(t: BABYLON.TransformNode, s: BABYLON.Scene, p: any = {}) {
            super(t, s, p, "TOOLKIT.CharacterAnimator");
        }

        protected start(): void {
            this.anim = this.getComponent("TOOLKIT.AnimationState");
            this.controller = this.getComponent("TOOLKIT.CharacterController");

            // Listen for animation events
            this.anim?.onAnimationEventObservable.add((evt) => {
                if (evt.function === "AttackHit") this.dealMeleeDamage();
            });
        }

        protected update(): void {
            if (!this.anim || !this.controller) return;

            const vel = this.controller.getInputVelocity();
            const speed = new BABYLON.Vector2(vel.x, vel.z).length();

            // Smooth speed parameter — Unity-style set-and-forget damping
            this.anim.setSmoothFloat("Speed", speed, 0.1);

            // Grounded state
            this.anim.setBool("IsGrounded", this.controller.isGrounded());

            // Vertical velocity for jump/fall blend
            this.anim.setFloat("VerticalVelocity", this.controller.getVerticalVelocity());
        }

        public playAttack(attackIndex: number = 0): void {
            this.anim?.setInteger("AttackIndex", attackIndex);
            this.anim?.setTrigger("Attack");
        }

        private dealMeleeDamage(): void {
            // Sphere cast from weapon bone
            const wepBone = this.getChildNode("WeaponBone", TOOLKIT.SearchType.EndsWith, false);
            if (!wepBone) return;
            const origin = wepBone.getAbsolutePosition();
            const result = TOOLKIT.RigidbodyPhysics.Raycast(
                origin, this.transform.forward, 1.5
            );
            if (result.hasHit) {
                const victim: HealthSystem = TOOLKIT.SceneManager.FindScriptComponent(
                    result.body?.transformNode, "TOOLKIT.HealthSystem"
                );
                victim?.takeDamage(20);
            }
        }
    }
}
```

---

## AnimatorParameterType Enum

```typescript
enum AnimatorParameterType {
    Float   = 1,
    Int     = 3,
    Bool    = 4,
    Trigger = 9
}
```

---

## MachineState Interface (Partial)

Returned by `getCurrentState(layer)`. Useful for reading the current state name to detect transitions.

```typescript
interface MachineState {
    name: string;        // state name
    tag: string;         // Unity state tag
    time: number;        // normalized playback time [0..1]
    speed: number;       // playback speed multiplier
    length: number;      // clip duration in seconds
    type: number;        // 0=clip, 1=blendtree
    // ... additional internal fields
}
```

---

## Notes For AI Agents

1. **Never call `playAnimation` every frame** — set parameters and let the state machine decide transitions.
2. **`setSmoothFloat` is set-and-forget** — call once when speed changes; the internal spring drives it to the target automatically.
3. **Root motion** — when enabled, the state machine moves the transform; disable `CharacterController.enableGravity` or disable root motion Y for gravity-driven characters.
4. **Triggers auto-reset** — after the state machine consumes a trigger, it is automatically set back to `false`.
5. **Layer 0 is always the base layer** — additive layers start at index 1.
