# TOOLKIT.Animator — Agent Reference

> **Extends:** `TOOLKIT.ScriptComponent`  
> **Namespace:** `TOOLKIT`  
> **Role:** A port of Unity's Animator (Mecanim). Every Unity Animator exports as this component automatically, with nothing added in Unity: its controller or override controller, avatar, layers, masks, state machines, blend trees, transitions, parameters, events, StateMachineBehaviours, root motion and humanoid IK. The scripting API is Unity's `Animator` API in camelCase (`SetFloat` → `setFloat`, `CrossFade` → `crossFade`, `GetCurrentAnimatorStateInfo` → `getCurrentAnimatorStateInfo`), and the hashes are Unity's, so C# Animator code ports line by line.

---

## Import

```typescript
import * as TOOLKIT from "@babylonjs-toolkit/next";
// named imports are equivalent: import { Animator, AnimatorStateInfo, ScriptComponent, SceneManager } from "@babylonjs-toolkit/next";
```

---

## 1. Quick-Start Lookup

```typescript
// 1. Get the component from the character node (the node that had the Unity Animator)
const animator: TOOLKIT.Animator = TOOLKIT.SceneManager.GetComponent<TOOLKIT.Animator>(characterNode, "TOOLKIT.Animator");
// inside a script component on the same node (pass true to search the children too):
// const animator: TOOLKIT.Animator = this.getComponent<TOOLKIT.Animator>(TOOLKIT.Animator.ClassName);

// 2. Drive parameters by name, exactly like Unity's Animator
animator.setFloat("Speed", 1.0);
animator.setBool("Grounded", true);
animator.setInteger("WeaponIndex", 2);
animator.setTrigger("Attack");

// 3. Or by hash: hash once, reuse every frame (the hashes equal Unity's Animator.StringToHash)
const SPEED_HASH: number = TOOLKIT.Animator.stringToHash("Speed");
animator.setFloat(SPEED_HASH, 1.0);

// 4. Damped float, called every frame like Unity's SetFloat(name, value, dampTime, deltaTime)
animator.setFloat("Speed", targetSpeed, 0.1, deltaTime);

// 5. Jump to or cross-fade into a state (a short name, a full path, or either hash)
animator.play("Idle");
animator.crossFadeInFixedTime("Run", 0.25);   // 0.25 seconds
animator.crossFade("Base Layer.Run", 0.1);     // 10 % of the current state's length

// 6. Read the state
const stateInfo: TOOLKIT.AnimatorStateInfo = animator.getCurrentAnimatorStateInfo(0);
const isRunning: boolean = stateInfo.isName("Run");
```

---

## 2. What Exports Automatically

Every Unity `Animator` in the scene (enabled or not) exports as one `TOOLKIT.Animator` (schema `version: 1`). Nothing needs to be added in Unity.

- **Controllers.** The Animator's `AnimatorController`, or its `AnimatorOverrideController`. A chain of override controllers (an override of an override) is flattened to its root base controller plus one combined clip map, as Unity itself re-bases it.
- **Avatar.** Humanoid or generic, `humanScale`, every mapped humanoid bone, and the humanoid muscle-zero default pose (the Write Defaults value of human bones).
- **Layers and masks.** Every layer with its weight, blending (override / additive), avatar mask (humanoid body parts and transform paths), sync source, Timing and IK Pass flag.
- **State machines.** States, sub-state machines, Entry / Exit / Any State, transitions with conditions, exit time, fixed or normalized duration, offset, interruption source, ordered interruption, solo / mute, Can Transition To Self; state speed, tags, Write Defaults, Foot IK, mirror, cycle offset and their parameters; Motion Time parameters.
- **Blend trees.** 1D, 2D Simple Directional, 2D Freeform Directional, 2D Freeform Cartesian and Direct, nested trees, child time scale, mirror and Normalize Blend Values.
- **Parameters, events and StateMachineBehaviours** (each behaviour's C# class name and its public / `[SerializeField]` fields).
- **Clips.** Unity's own Animator evaluation samples every clip variant any carried controller can play: override clips, and a mirrored variant of every clip a mirrored state can play. So Bake Into Pose, Based Upon, offsets, Loop Pose, cycle offset, trims and mirror are exactly Unity's. Beside the pose keys each clip carries its root trajectory, the humanoid body / pivot / gravity values, Foot IK goals (when any state of the controller has Foot IK), parameter curves and property curves:
  - GameObject active;
  - the enabled flag of toolkit script components, lights and renderers;
  - material floats and colours;
  - light intensity, colour, range and spot angle (not on HDRP, where `TOOLKIT.HdrpRendering` owns light intensity);
  - camera field of view and near / far planes.
  Any other property curve is listed in the export summary as `unmapped property`.
- **Controller fields on script components (swap targets).** A public `RuntimeAnimatorController` field (or an array / list of them) on an exported script component exports as `{ type: "RuntimeAnimatorController", key, name }`. That controller and its clips travel with every Animator on the field's node and its children (or the nearest Animator above), so the script can assign it at runtime (§10).

Each clip variant has a key unique within its Animator: the clip name, `name#2` on a name collision, `name@mirror` for the mirrored variant. Clips play through the Animator, never through their `BABYLON.AnimationGroup`s directly.

---

## 3. Parameters

Unity's parameter API. `nameOrHash` is the parameter name or `TOOLKIT.Animator.stringToHash(name)`.

```typescript
animator.setFloat(nameOrHash: string | number, value: number, dampTime?: number, deltaTime?: number): void
animator.getFloat(nameOrHash: string | number): number
animator.setBool(nameOrHash: string | number, value: boolean): void      // also sets a Trigger, as in Unity
animator.getBool(nameOrHash: string | number): boolean
animator.setInteger(nameOrHash: string | number, value: number): void   // truncates to an integer
animator.getInteger(nameOrHash: string | number): number
animator.setTrigger(nameOrHash: string | number): void                  // stays set until a transition consumes it
animator.resetTrigger(nameOrHash: string | number): void

animator.parameters: TOOLKIT.AnimatorControllerParameter[]   // a new copy of every definition (name, nameHash, type, defaults)
animator.parameterCount: number
animator.getParameter(index: number): TOOLKIT.AnimatorControllerParameter
animator.isParameterControlledByCurve(nameOrHash: string | number): boolean

// Toolkit extra: true when the controller has the parameter (and, when given, of that type)
animator.hasParameter(nameOrHash: string | number, type?: TOOLKIT.AnimatorControllerParameterType): boolean
```

- **Damping:** `setFloat(name, target, dampTime, deltaTime)` moves the value toward the target with Unity's SmoothDamp over `deltaTime` seconds. Call it **every frame**, as in Unity. Without `deltaTime` it uses this frame's delta.
- A missing parameter or a type mismatch warns once per name (silence with `logWarnings = false`) and does nothing.
- A parameter driven by an Animator curve in a clip cannot be set; the write warns once and is ignored.
- Triggers are consumed only by the transition that fires on them.

```typescript
/** Feeds a character's speed and grounded state to its Animator every frame. */
export class LocomotionAnimation extends TOOLKIT.ScriptComponent {
    /** Seconds the Speed parameter takes to settle on a new target. */
    private static readonly SPEED_DAMP_TIME: number = 0.1;
    /** Hash of the Speed parameter, computed once. */
    private static readonly SPEED_HASH: number = TOOLKIT.Animator.stringToHash("Speed");
    /** The character's Animator. */
    private animator: TOOLKIT.Animator = null;
    /** The character's movement controller. */
    private characterController: TOOLKIT.CharacterController = null;

    /** Finds the Animator and the movement controller on this node. */
    protected start(): void {
        this.animator = this.getComponent<TOOLKIT.Animator>(TOOLKIT.Animator.ClassName);
        this.characterController = this.getComponent<TOOLKIT.CharacterController>("TOOLKIT.CharacterController");
    }

    /** Sends this frame's horizontal speed (damped) and grounded state. */
    protected update(): void {
        if (this.animator == null || this.characterController == null) return;
        const velocity: BABYLON.Vector3 = this.characterController.getInputVelocity();
        const horizontalSpeed: number = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
        this.animator.setFloat(LocomotionAnimation.SPEED_HASH, horizontalSpeed, LocomotionAnimation.SPEED_DAMP_TIME, this.getDeltaSeconds());
        this.animator.setBool("Grounded", this.characterController.isGrounded());
    }
}
```

---

## 4. Playback and State Queries

```typescript
// stateNameOrHash: a short name ("Run"), a full path ("Base Layer.Locomotion.Run"), or either hash
animator.play(stateNameOrHash, layer = -1, normalizedTime = -Infinity): void
animator.playInFixedTime(stateNameOrHash, layer = -1, fixedTime = -Infinity): void
animator.crossFade(stateNameOrHash, normalizedTransitionDuration, layer = -1, normalizedTimeOffset = -Infinity, normalizedTransitionTime = 0): void
animator.crossFadeInFixedTime(stateNameOrHash, fixedTransitionDuration, layer = -1, fixedTimeOffset = 0, normalizedTransitionTime = 0): void
animator.update(deltaTime: number): void   // Unity Animator.Update: evaluates now by deltaTime seconds (not clamped)
animator.rebind(): void                    // layers back to their default states (entered next tick), parameters to defaults
animator.writeDefaultValues(): void        // writes every animated value's default back to the scene
```

- The defaults are Unity's: `layer = -1` is the first layer that has the state; `normalizedTime = -Infinity` keeps the time when the state already plays, else starts at 0.
- `play` and `crossFade` take effect on the **next** tick, as in Unity.
- `update(deltaTime)` evaluates immediately, scaled by `speed`, on top of any automatic tick. It steps the Animator even while `enabled` is false, as in Unity: to drive it only by hand, set `enabled = false` and call `update(deltaTime)` yourself.

```typescript
animator.getCurrentAnimatorStateInfo(layerIndex): TOOLKIT.AnimatorStateInfo   // a new snapshot
animator.getNextAnimatorStateInfo(layerIndex): TOOLKIT.AnimatorStateInfo      // the destination while in transition
animator.getCurrentAnimatorStateInfoToRef(layerIndex, result): boolean        // toolkit extra: no allocation, false when none
animator.getNextAnimatorStateInfoToRef(layerIndex, result): boolean           // toolkit extra
animator.getAnimatorTransitionInfo(layerIndex): TOOLKIT.AnimatorTransitionInfo
animator.getCurrentAnimatorClipInfo(layerIndex): TOOLKIT.AnimatorClipInfo[]   // clip + weight (blend-tree child × transition)
animator.getNextAnimatorClipInfo(layerIndex): TOOLKIT.AnimatorClipInfo[]
animator.getCurrentAnimatorClipInfoCount(layerIndex): number
animator.getNextAnimatorClipInfoCount(layerIndex): number
animator.isInTransition(layerIndex): boolean
animator.hasState(layerIndex, stateHash): boolean

// layers
animator.layerCount: number
animator.getLayerName(layerIndex): string
animator.getLayerIndex(layerName): number            // -1 when missing
animator.getLayerWeight(layerIndex): number
animator.setLayerWeight(layerIndex, weight): void    // 0–1; the base layer is always 1
```

- `stateInfo.isName("Run")` / `stateInfo.isName("Base Layer.Run")` and `stateInfo.isTag("Attack")` compare hashes, as in Unity.
- `stateInfo.normalizedTime` counts cycles: the integer part is the loop count, the fraction the position in the current cycle.
- Before the first tick, the state info reports each layer's default state at normalized time 0.
- In a transition, the current info is the source and the next info the destination. Unity's rule for "the state that is playing" is `isInTransition(layer) ? getNextAnimatorStateInfo : getCurrentAnimatorStateInfo`.

```typescript
/** Locks player input while an attack animation (any state tagged "Attack") plays on the base layer. */
export class AttackInputLock extends TOOLKIT.ScriptComponent {
    /** The base layer index. */
    private static readonly BASE_LAYER: number = 0;
    /** The character's Animator. */
    private animator: TOOLKIT.Animator = null;
    /** Reused snapshot, so the per-frame query allocates nothing. */
    private readonly stateInfo: TOOLKIT.AnimatorStateInfo = new TOOLKIT.AnimatorStateInfo();

    /** Finds the Animator on this node. */
    protected start(): void {
        this.animator = this.getComponent<TOOLKIT.Animator>(TOOLKIT.Animator.ClassName);
    }

    /**
     * True while the playing state (the destination during a transition) is tagged "Attack".
     * @returns True when input should be ignored.
     */
    public isAttacking(): boolean {
        if (this.animator == null) return false;
        const hasState: boolean = this.animator.isInTransition(AttackInputLock.BASE_LAYER)
            ? this.animator.getNextAnimatorStateInfoToRef(AttackInputLock.BASE_LAYER, this.stateInfo)
            : this.animator.getCurrentAnimatorStateInfoToRef(AttackInputLock.BASE_LAYER, this.stateInfo);
        return hasState && this.stateInfo.isTag("Attack");
    }
}
```

---

## 5. Layers, Masks, Write Defaults, Synced and Additive Layers

These follow Unity; there is nothing to call beyond `setLayerWeight`.

- **Override layers** replace the layers below by their weight; **additive layers** add their clip's motion relative to the clip's additive reference pose (its first frame by default). A layer at weight 0 still runs its state machine and fires its events.
- **Avatar masks** apply on every layer, the base layer included (humanoid body parts and transform paths).
- **Write Defaults:** a state with Write Defaults on writes the default value of every property the controller animates but the state does not; with it off, those properties keep their last value. Human bones default to the avatar's muscle-zero pose (Unity's), other properties to their value when the Animator bound.
- **Synced layers** follow their source layer's states with their own motions; with Timing on, the source's playback is stretched by the synced layer's weight.
- One transition can start per layer per tick; Any State transitions are checked first.

---

## 6. Root Motion

Root motion is each clip's baked root trajectory (Bake Into Pose and Based Upon already applied by Unity's evaluation), blended across blend-tree children, transition sides and override layers whose mask includes the root. Additive layers carry none, and a frozen (interrupted) transition source carries none.

**Exposed values** (Unity's names, world space, scaled by the node's absolute scale, read after the tick):

```typescript
animator.deltaPosition: BABYLON.Vector3       // this tick's root translation
animator.deltaRotation: BABYLON.Quaternion    // this tick's root rotation change (applied as rotation × deltaRotation)
animator.velocity: BABYLON.Vector3            // deltaPosition ÷ deltaTime
animator.angularVelocity: BABYLON.Vector3     // radians per second
animator.rootPosition / animator.rootRotation // where the root lands this tick
animator.bodyPosition / animator.bodyRotation // humanoid centre of mass (the root for a generic rig)
animator.pivotPosition / animator.pivotWeight // humanoid feet pivot (0 = left foot … 1 = right foot; 0.5 generic)
animator.gravityWeight: number                // how much gravity should govern the vertical motion (1 generic)
animator.hasRootMotion: boolean
animator.isHuman: boolean, animator.humanScale: number
```

**Who moves the character** (once per tick, Unity's Apply Root Motion rules):

1. **An `onAnimatorMove` taker**, if any: an `onAnimatorMoveObservable` observer, a script component on the Animator's node with an `onAnimatorMove()` method, or a playing state's `onStateMove` behaviour. A taker gets the motion and nothing else moves the character. It can apply the motion the built-in way with `applyBuiltinRootMotion()`.
2. Otherwise, only when **`applyRootMotion`** is true, the first of:
   - a **root-motion receiver** script on the node (one that implements `applyAnimatorRootMotion(deltaPosition, deltaRotation, deltaTime): boolean`). `TOOLKIT.CharacterController` and `TOOLKIT.ThirdPersonController` are receivers: they move their Havok capsule by the horizontal root velocity, so walls stop the character, and keep their own gravity and jumping;
   - a Havok `BABYLON.PhysicsCharacterController` assigned to **`animator.characterController`** in code;
   - the node's **Havok body**: a dynamic body gets velocities (the vertical part blended by `gravityWeight`), an animated body a target transform;
   - the **transform**.

With `applyRootMotion` off and no taker, the character stays in place (the clip's root motion is dropped, as in Unity). A generic clip that animates the Animator node's own transform (a door, a platform) moves the node while `applyRootMotion` is off.

**Example — a taker that applies the motion itself and keeps the character on a floor height:**

```typescript
/** Takes the Animator's root motion over (Unity OnAnimatorMove), applies it the built-in way, then clamps the height. */
export class FloorClampedRootMotion extends TOOLKIT.ScriptComponent {
    /** Lowest world height the character may reach, in metres. */
    private static readonly FLOOR_HEIGHT: number = 0;
    /** The character's Animator. */
    private animator: TOOLKIT.Animator = null;
    /** The registered taker, removed on destroy. */
    private moveObserver: BABYLON.Observer<TOOLKIT.Animator> = null;

    /** Registers the root-motion taker. */
    protected start(): void {
        this.animator = this.getComponent<TOOLKIT.Animator>(TOOLKIT.Animator.ClassName);
        if (this.animator == null) return;
        this.moveObserver = this.animator.onAnimatorMoveObservable.add((animator: TOOLKIT.Animator) => this.applyRootMotion(animator));
    }

    /** Removes the taker so the Animator falls back to its built-in application. */
    protected destroy(): void {
        if (this.animator != null && this.moveObserver != null) this.animator.onAnimatorMoveObservable.remove(this.moveObserver);
        this.moveObserver = null;
    }

    /**
     * Applies this tick's root motion (receiver, character controller, body or transform), then clamps the height.
     * @param animator The Animator that raised the callback.
     */
    private applyRootMotion(animator: TOOLKIT.Animator): void {
        animator.applyBuiltinRootMotion();
        if (this.transform.position.y < FloorClampedRootMotion.FLOOR_HEIGHT) this.transform.position.y = FloorClampedRootMotion.FLOOR_HEIGHT;
    }
}
```

**Example — a NavMesh agent with an animated character ("follow the agent").** The `TOOLKIT.NavigationAgent` owns the position; the taker copies it, so the Animator's root motion never fights the agent, and the agent's speed drives the locomotion blend tree.

```typescript
/** Walks a humanoid along waypoints with a NavigationAgent, animating it from the agent's speed. */
export class AnimatedPatrol extends TOOLKIT.ScriptComponent {
    /** Distance to a waypoint, in metres, below which the next waypoint is chosen. */
    private static readonly ARRIVAL_DISTANCE: number = 0.5;
    /** The node's navigation agent. */
    private agent: TOOLKIT.NavigationAgent = null;
    /** The character's Animator. */
    private animator: TOOLKIT.Animator = null;
    /** The exported waypoint nodes, in visiting order. */
    private waypoints: BABYLON.TransformNode[] = [];
    /** Index of the waypoint the agent is heading to. */
    private waypointIndex: number = 0;
    /** True once the first destination was sent (the agent must have joined the crowd). */
    private isPatrolling: boolean = false;
    /** Reused velocity, so the per-frame read allocates nothing. */
    private readonly agentVelocity: BABYLON.Vector3 = new BABYLON.Vector3();

    /** Reads the waypoints, lets the agent own the position and takes the Animator's root motion over. */
    protected start(): void {
        const waypointReferences: TOOLKIT.IUnityTransform[] = this.getProperty<TOOLKIT.IUnityTransform[]>("waypoints", []);
        this.waypoints = waypointReferences
            .map((reference: TOOLKIT.IUnityTransform) => TOOLKIT.Utilities.ParseTransformByID(reference, this.scene))
            .filter((node: BABYLON.TransformNode) => node != null);
        this.agent = this.getComponent<TOOLKIT.NavigationAgent>("TOOLKIT.NavigationAgent");
        this.animator = this.getComponent<TOOLKIT.Animator>(TOOLKIT.Animator.ClassName);
        if (this.agent == null || this.animator == null || this.waypoints.length === 0) return;
        this.agent.updatePosition = false;
        this.animator.onAnimatorMoveObservable.add(() => {
            this.transform.position.copyFrom(this.agent.getCurrentPosition());
        });
    }

    /** Feeds the agent's speed to the Animator and moves on to the next waypoint on arrival. */
    protected update(): void {
        if (this.agent == null || this.animator == null || this.waypoints.length === 0) return;
        if (!this.isPatrolling) {
            this.startPatrol();
            return;
        }
        this.agent.getAgentVelocityToRef(this.agentVelocity);
        this.animator.setFloat("Speed", this.agentVelocity.length());
        if (this.agent.getTargetDistance() >= AnimatedPatrol.ARRIVAL_DISTANCE) return;
        this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
        this.agent.setDestination(this.waypoints[this.waypointIndex].getAbsolutePosition());
    }

    /** Sends the first destination once the agent has joined the crowd (the navmesh loads after start). */
    private startPatrol(): void {
        if (this.agent.getAgentIndex() < 0) return;
        this.agent.setDestination(this.waypoints[this.waypointIndex].getAbsolutePosition());
        this.isPatrolling = true;
    }
}
```

**Match target** (Unity `MatchTarget`): over the base layer's current state, root motion is corrected so a body part reaches a target at a normalized time — vaulting, climbing onto a ledge.

```typescript
animator.matchTarget(matchPosition, matchRotation, TOOLKIT.AvatarTarget.LeftHand,
    new TOOLKIT.MatchTargetWeightMask(new BABYLON.Vector3(1, 1, 0), 0), startNormalizedTime, targetNormalizedTime = 1, completeMatch = true): void
animator.interruptMatchTarget(completeMatch = true): void   // true: the rest of the error is applied on the next tick
animator.isMatchingTarget: boolean
```

---

## 7. Animation Events

Unity animation events fire from every contributing clip, once each time the clip's time crosses the event (loops, reverse play and an event at time 0 on entry included). A layer at weight 0 still fires.

Each event goes, in order, to:
1. `onAnimatorEventObservable`;
2. every script component on the Animator's node with a method named exactly like the event's function (`OnFootstep`), else its lower-camel form (`onFootstep`), called with the `TOOLKIT.AnimatorEvent`.

`fireEvents = false` silences both. Script methods are found at `start()`; call `refreshMessageReceivers()` after adding a component at runtime.

```typescript
TOOLKIT.AnimatorEvent {
    functionName: string;            // the Unity function name
    floatParameter: number; intParameter: number; stringParameter: string;
    objectReferenceParameter: BABYLON.TransformNode;   // a scene node reference, resolved
    time: number;                    // seconds from clip start
    animatorStateInfo: TOOLKIT.AnimatorStateInfo;      // the state that played the clip
    animatorClipInfo: TOOLKIT.AnimatorClipInfo;        // the clip and its weight
    layerIndex: number;              // toolkit extra
    weight: number;                  // = animatorClipInfo.weight: blend-tree child × transition weight, no layer weight
}
```

**The event object is pooled:** it is valid during the callback only. Copy what you keep.

```typescript
/** Plays footstep sounds only from the clip that dominates the locomotion blend (Unity Starter Assets' rule). */
export class FootstepAudio extends TOOLKIT.ScriptComponent {
    /** Events from clips weighted at or below this are ignored, so blended-out clips stay silent. */
    private static readonly MINIMUM_CLIP_WEIGHT: number = 0.5;
    /** The footstep sound on this node. */
    private footstepSource: TOOLKIT.AudioSource = null;

    /** Finds the audio source. */
    protected start(): void {
        this.footstepSource = this.getComponent<TOOLKIT.AudioSource>("TOOLKIT.AudioSource");
    }

    /**
     * Called by the Animator for every "OnFootstep" event (lower-camel dispatch of the Unity method name).
     * @param animatorEvent The pooled event (valid during this call only).
     */
    public onFootstep(animatorEvent: TOOLKIT.AnimatorEvent): void {
        if (animatorEvent.weight <= FootstepAudio.MINIMUM_CLIP_WEIGHT || this.footstepSource == null) return;
        this.footstepSource.play();
    }
}
```

---

## 8. StateMachineBehaviours

A Unity `StateMachineBehaviour` on a state or sub-state machine exports with its C# class name and serialized fields. Port it by registering a class under the **C# class name** (namespace-qualified name first, then the short name):

- The instance is created lazily, once per Animator per behaviour entry, and the exported fields are copied onto it.
- Extending `TOOLKIT.StateMachineBehaviour` is optional: a plain class with the hook methods works. On a subclass only the hooks it overrides are called.
- The seven hooks: `onStateEnter`, `onStateUpdate`, `onStateExit`, `onStateMove`, `onStateIK` take `(animator, stateInfo, layerIndex)`; `onStateMachineEnter` and `onStateMachineExit` take `(animator, stateMachinePathHash)`. `stateInfo` is pooled (valid during the call).
- A behaviour on a sub-state machine also receives the state hooks of every state inside it.
- **Order per tick (Unity's):** animation events first; then, per layer, machine enter / exit, then exit or update for the states that were active when the tick started, then enter for the states entered this tick; after the pose and root motion, `onStateMove` for every state that played; `onStateIK` in the IK pass of IK Pass layers.
- Implementing `onStateMove` makes the behaviour a root-motion taker (§6).
- `onStateMachineBehaviourObservable` is raised for every hook of every behaviour, ported or not: `{ kind, behaviour, state, layer, properties }`.
- A behaviour class that is not registered warns once per name.

```typescript
/** Port of a Unity StateMachineBehaviour that plays a sound when its state is entered. */
export class PlaySoundOnEnter extends TOOLKIT.StateMachineBehaviour {
    /** Exported field: the name of the AudioSource node to play. */
    public soundNodeName: string = "";

    /**
     * Plays the configured sound when the state starts.
     * @param animator The Animator running the state.
     * @param stateInfo The entered state (pooled: valid during this call).
     * @param layerIndex The state's layer.
     */
    public onStateEnter(animator: TOOLKIT.Animator, stateInfo: TOOLKIT.AnimatorStateInfo, layerIndex: number): void {
        const soundNode: BABYLON.TransformNode = TOOLKIT.SceneManager.FindGameObject(animator.scene, this.soundNodeName);
        const soundSource: TOOLKIT.AudioSource = (soundNode != null) ? TOOLKIT.SceneManager.GetComponent<TOOLKIT.AudioSource>(soundNode, "TOOLKIT.AudioSource") : null;
        if (soundSource != null) soundSource.play();
    }
}
TOOLKIT.SceneManager.RegisterClass("PlaySoundOnEnter", PlaySoundOnEnter);   // the Unity C# class name
```

```typescript
animator.getBehaviour<T>(klass: string | (new () => T)): T      // Unity GetBehaviour<T>: the first instance, or null
animator.getBehaviours<T>(klass: string | (new () => T)): T[]   // every instance; all behaviours exist from this call on
```

---

## 9. Humanoid IK

For humanoid skeleton characters. Scripted IK runs in the IK pass at the end of every tick, for layers with **IK Pass** ticked in Unity (`hasIKPassLayer()` tells whether any has).

- `onAnimatorIKObservable` raises the layer index (Unity `OnAnimatorIK(layerIndex)`). A script method `onAnimatorIK(layerIndex)` on the Animator's node is called too, then the `onStateIK` behaviours.
- Weights reset to 0 every pass: set them every time, as in Unity.
- Solve order: feet (the Foot IK goals, then scripted foot goals), look-at, hands.
- Generic rigs: the IK API warns once and does nothing.

```typescript
animator.setIKPosition(goal: TOOLKIT.AvatarIKGoal, position: BABYLON.Vector3): void
animator.setIKRotation(goal, rotation: BABYLON.Quaternion): void
animator.setIKPositionWeight(goal, weight): void
animator.setIKRotationWeight(goal, weight): void
animator.getIKPosition(goal) / animator.getIKRotation(goal)        // the animated goal before scripted IK
animator.getIKPositionWeight(goal) / animator.getIKRotationWeight(goal)
animator.setIKHintPosition(hint: TOOLKIT.AvatarIKHint, position): void
animator.getIKHintPosition(hint): BABYLON.Vector3
animator.setIKHintPositionWeight(hint, weight) / animator.getIKHintPositionWeight(hint)
animator.setLookAtPosition(position): void
animator.setLookAtWeight(weight, bodyWeight = 0, headWeight = 1, eyesWeight = 0, clampWeight = 0.5): void
animator.getBoneTransform(bone: TOOLKIT.HumanBodyBones): BABYLON.TransformNode
animator.bodyPosition = position; animator.bodyRotation = rotation;   // inside the IK pass only: moves / turns the hips
```

**Foot IK** (the state checkbox): when any contributing state has Foot IK, each foot is solved onto the weighted blend of every contributing clip's baked foot goal, as Unity does. Mirrored clips use their mirrored goals.

```typescript
/** Reaches the right hand toward a target and looks at it while the target is set. */
export class ReachForTarget extends TOOLKIT.ScriptComponent {
    /** Full IK weight. */
    private static readonly FULL_WEIGHT: number = 1;
    /** The character's Animator. */
    private animator: TOOLKIT.Animator = null;
    /** The node to reach for, or null to stop reaching. */
    public reachTarget: BABYLON.TransformNode = null;

    /** Registers the IK callback (runs for every IK Pass layer). */
    protected start(): void {
        this.animator = this.getComponent<TOOLKIT.Animator>(TOOLKIT.Animator.ClassName);
        if (this.animator == null) return;
        this.animator.onAnimatorIKObservable.add((layerIndex: number) => this.applyReach(layerIndex));
    }

    /**
     * Sets this pass's hand and look-at goals (weights reset every pass, so they are set every time).
     * @param layerIndex The IK Pass layer being solved.
     */
    private applyReach(layerIndex: number): void {
        if (layerIndex !== 0 || this.reachTarget == null) return;
        const targetPosition: BABYLON.Vector3 = this.reachTarget.getAbsolutePosition();
        this.animator.setIKPositionWeight(TOOLKIT.AvatarIKGoal.RightHand, ReachForTarget.FULL_WEIGHT);
        this.animator.setIKPosition(TOOLKIT.AvatarIKGoal.RightHand, targetPosition);
        this.animator.setLookAtWeight(ReachForTarget.FULL_WEIGHT);
        this.animator.setLookAtPosition(targetPosition);
    }
}
```

---

## 10. Override Controllers and Runtime Swaps

`animator.runtimeAnimatorController` is the running `TOOLKIT.RuntimeAnimatorController`: a `TOOLKIT.AnimatorController` or a `TOOLKIT.AnimatorOverrideController`.

```typescript
const overrides: TOOLKIT.AnimatorOverrideController = animator.runtimeAnimatorController as TOOLKIT.AnimatorOverrideController;
overrides.runtimeAnimatorController            // the root base controller
overrides.overridesCount                       // one slot per original clip of the base
overrides.getOverride(originalClipName): string | null       // the clip key that plays (the original when not overridden)
overrides.setOverride(originalClipName, overrideClipKey | null): void   // every Animator running it rebinds
overrides.getOverrides(): TOOLKIT.IAnimatorClipOverrideData[]           // { originalClipKey, overrideClipKey }
overrides.applyOverrides(overrides: TOOLKIT.IAnimatorClipOverrideData[]): void
overrides.animationClips: TOOLKIT.AnimatorClipReference[]   // every clip that plays after overrides (any controller has it)
```

- An override clip key must be a clip the Animator carries. Export the override controller (or a controller field that references it) so its clips travel with the character.
- **Swapping controllers** — a weapon switch, a mount, a vehicle seat. In Unity, put the controllers in a public `RuntimeAnimatorController` field of a script component on the character (or a parent). At runtime, resolve the exported reference with `TOOLKIT.AnimatorControllerRegistry.resolve(scene, reference)` and assign it.
- **What a swap keeps (Unity's rule):** assigning an override controller of the running controller's root base (the base itself, or another override of it) only swaps the clips. Every layer keeps its state and time, and the parameters keep their values. Any other assignment (a different base, a plain controller, even the running override's own base) resets every layer and parameter to the new controller's defaults; each layer enters its default state on the next tick.
- Assigning a controller whose clips the Animator does not carry warns once and keeps the current controller.

```typescript
/** An exported RuntimeAnimatorController field. */
interface IControllerReference {
    /** The controller asset's GUID. */
    key: string;
    /** The controller asset's name. */
    name: string;
}

/** Switches the character between its unarmed and sword override controllers (Unity RuntimeAnimatorController fields). */
export class WeaponAnimationSwitcher extends TOOLKIT.ScriptComponent {
    /** The character's Animator (on this node or a child model). */
    private animator: TOOLKIT.Animator = null;
    /** Exported field `unarmedController`, resolved on first use. */
    private unarmedController: TOOLKIT.RuntimeAnimatorController = null;
    /** Exported field `swordController`, resolved on first use. */
    private swordController: TOOLKIT.RuntimeAnimatorController = null;

    /** Finds the Animator on this node or its children. */
    protected start(): void {
        this.animator = this.getComponent<TOOLKIT.Animator>(TOOLKIT.Animator.ClassName, true);
    }

    /**
     * Equips or holsters the sword. Both controllers override the same base, so the character keeps its state and time.
     * @param isEquipped True for the sword controller, false for the unarmed one.
     */
    public equipSword(isEquipped: boolean): void {
        if (this.animator == null) return;
        if (this.unarmedController == null) this.unarmedController = this.resolveController("unarmedController");
        if (this.swordController == null) this.swordController = this.resolveController("swordController");
        const nextController: TOOLKIT.RuntimeAnimatorController = isEquipped ? this.swordController : this.unarmedController;
        if (nextController != null) this.animator.runtimeAnimatorController = nextController;
    }

    /**
     * Looks up the controller an exported field references (every Animator registers the controllers it carries).
     * @param fieldName The script field name.
     * @returns The controller, or null (with one warning) when no Animator carries it.
     */
    private resolveController(fieldName: string): TOOLKIT.RuntimeAnimatorController {
        const reference: IControllerReference = this.getProperty<IControllerReference>(fieldName, null);
        return TOOLKIT.AnimatorControllerRegistry.resolve(this.scene, reference);
    }
}
```

---

## 11. Update Modes, Culling, Enabling and Timeline

- **One tick per frame** after every script's `update` and before every `late` (Unity: Update → Animator → LateUpdate). The frame delta is clamped to `TOOLKIT.Animator.MAX_DELTA_TIME` (1/3 s). The first tick evaluates at time 0, like Unity's first frame. Clocks run in single precision, like Unity's, so exit times land on Unity's frames.
- **`updateMode`** (`TOOLKIT.AnimatorUpdateMode`):
  - `Normal`: the frame delta × `scene.animationTimeScale`.
  - `UnscaledTime`: ignores `animationTimeScale`.
  - `AnimatePhysics`: ticks in the physics step with the physics time step; with no physics engine it ticks with the frame and warns once.
- **`cullingMode`** (`TOOLKIT.AnimatorCullingMode`), while none of the character's meshes is visible:
  - `AlwaysAnimate`: keeps animating;
  - `CullUpdateTransforms`: runs the state machine, events and root motion but skips the pose;
  - `CullCompletely`: stops the Animator.
- **`speed`** multiplies every layer (negative plays backwards).
- **`enabled = false`** stops the automatic ticks (frame or physics) and keeps the state; `true` resumes where it was. A manual `update(deltaTime)` still steps it, as in Unity.
- **Deactivating the node** (`setEnabled(false)`) and activating it again resets layers, parameters and pose, unless `keepAnimatorStateOnDisable` is true.
- **Timeline:** while a `TOOLKIT.PlayableDirector` is bound to the object, it sets the Animator's `enabled = false` and restores the saved value on release.
- **Read-only facts:** `isInitialized`, `isHuman`, `humanScale`, `avatar` (`isHuman`, `humanScale`, `isValid`), `hasRootMotion`, `exportedData` (the validated exported bag).
- **Setting up a character in code:** `new TOOLKIT.Animator(node, scene, sourceAnimator.exportedData)`. The node's animation groups must carry `metadata.toolkit.source` = the node's `metadata.toolkit.animator` id; prefab instances from `InstantiatePrefabFromContainer` already do.

---

## 12. Vertex-Animation (VAT) Characters

A Unity character with the toolkit `AnimatorControlRig` component in vertex-animation mode exports baked vertex animation textures instead of a skeleton. Its `TOOLKIT.Animator` runs the same state machine.

- **The GPU plays the base layer:** the four heaviest base-layer clips (blend-tree children and both transition sides) are blended per instance, written in the Animator's tick.
- Other layers still run their state machines (events, parameters, root motion) without a pose; the export summary and one runtime warning say so. Avatar masks and IK are skeleton-only. Mirrored states play their baked mirrored variants.
- Root motion works as for skeletons.
- Limits: 32 clips per character (more are dropped with an export summary line); a clip of more than 1,023 frames is baked at a lower rate. The vertex animation textures must be one combined texture.

```typescript
animator.getVertexAnimationController(): TOOLKIT.VertexAnimationController   // null for a skeleton rig or before the first tick
animator.getVertexAnimationMaterial(rendererIndex = 0, subMeshIndex = 0): TOOLKIT.VertexAnimationMaterial
animator.addPreloaderTasks(assetsManager: TOOLKIT.PreloadAssetsManager): void   // the splash waits for the VAT textures
```

`getVertexAnimationMaterial` returns this character's own material (a clone when the mesh material is shared), so a skin change affects only this character:

```typescript
const bodyMaterial: TOOLKIT.VertexAnimationMaterial = animator.getVertexAnimationMaterial(0, 0);
if (bodyMaterial != null) bodyMaterial.albedoTexture = new BABYLON.Texture("textures/jockey5_body.png", scene);
```

---

## 13. Types and Enums

```typescript
class AnimatorStateInfo {                 // Unity AnimatorStateInfo (a snapshot)
    fullPathHash: number;                 // hash of "<layer>.<machines>.<state>"
    shortNameHash: number;                // hash of the state name
    normalizedTime: number;               // integer part = loops, fraction = position in the cycle
    length: number;                       // seconds
    speed: number; speedMultiplier: number; tagHash: number; loop: boolean;
    stateName: string;                    // toolkit extra
    machineName: string;                  // toolkit extra: the owning state machine's short name
    isName(name: string): boolean; isTag(tag: string): boolean;
    copyFrom(source: AnimatorStateInfo): AnimatorStateInfo;
}
class AnimatorTransitionInfo {            // Unity AnimatorTransitionInfo
    fullPathHash: number;                 // hash of "<source full path> -> <destination full path>" (Unity's)
    nameHash: number;                     // hash of "<source name> -> <destination name>" (Unity's)
    userNameHash: number;                 // hash of the transition's own name
    normalizedTime: number;               // 0–1 progress
    anyState: boolean; duration: number; durationUnit: DurationUnit;
}
class AnimatorClipReference { name: string; clipKey: string; length: number; frameRate: number; isLooping: boolean; }
class AnimatorClipInfo { clip: AnimatorClipReference; weight: number; }   // weight = blend-tree child × transition
class AnimatorControllerParameter { name; nameHash; type; defaultFloat; defaultInt; defaultBool; }
class AnimatorEvent { /* §7 */ }
class MatchTargetWeightMask { constructor(positionXYZWeight: BABYLON.Vector3, rotationWeight: number) }
class AnimatorAvatarDescription { isHuman: boolean; humanScale: number; isValid: boolean; }
interface IAnimatorStateChange { layerIndex: number; stateInfo: AnimatorStateInfo; }        // onStateEnter/ExitObservable
interface IAnimatorBehaviourEvent { kind; behaviour; state; layer; properties; }            // onStateMachineBehaviourObservable
interface IAnimatorRootMotionReceiver { applyAnimatorRootMotion(deltaPosition, deltaRotation, deltaTime): boolean; }

enum AnimatorControllerParameterType { Float = 1, Int = 3, Bool = 4, Trigger = 9 }
enum AnimatorUpdateMode { Normal = 0, AnimatePhysics = 1, UnscaledTime = 2 }
enum AnimatorCullingMode { AlwaysAnimate = 0, CullUpdateTransforms = 1, CullCompletely = 2 }
enum AvatarTarget { Root = 0, Body = 1, LeftFoot = 2, RightFoot = 3, LeftHand = 4, RightHand = 5 }
enum DurationUnit { Fixed = 0, Normalized = 1 }
enum AvatarIKGoal { LeftFoot = 0, RightFoot = 1, LeftHand = 2, RightHand = 3 }
enum AvatarIKHint { LeftKnee = 0, RightKnee = 1, LeftElbow = 2, RightElbow = 3 }
enum HumanBodyBones { Hips = 0, LeftUpperLeg, RightUpperLeg, … }   // Unity's order and values
```

Observables on the Animator: `onAnimatorEventObservable` (`AnimatorEvent`), `onAnimatorMoveObservable` (the Animator; an observer is a root-motion taker), `onAnimatorIKObservable` (layer index), `onStateEnterObservable` / `onStateExitObservable` (`IAnimatorStateChange`, toolkit extras raised the moment a layer enters or leaves a state), `onStateMachineBehaviourObservable` (`IAnimatorBehaviourEvent`).

Static members: `TOOLKIT.Animator.ClassName` (`"TOOLKIT.Animator"`), `TOOLKIT.Animator.stringToHash(name)` (Unity's CRC-32 `StringToHash`), `MAX_DELTA_TIME` (1/3 s).

---

## 14. Deviations from Unity

- **Humanoid poses blend per bone, not in Unity's muscle space.** Crossfades between humanoid clips can drift a few centimetres from Unity's pose. Additive and synced humanoid layers compose per bone in the bone's frame. On a test character with an additive and a synced layer, the hips sit 8–16 cm from Unity's.
- **Humanoid root motion with Feet Pivot Active.** Root motion equals Unity's exactly when the Unity Animator's `feetPivotActive` is 0. At Unity's default of 1, Unity adds a feet-pivot correction while two or more clips blend (blend trees, transitions) that the runtime does not model. Unity's locomotion blends move about 5 % slower, up to 18 cm apart over a 30 s walk. The runtime reads `feetPivotActive` but evaluates as if it were 0. For exact parity, set `animator.feetPivotActive = 0` from a Unity script's `Awake`.
- **Physics-driven characters differ by engine.** Unity moves Rigidbodies and CharacterControllers with PhysX; the runtime uses Havok. Wall stops, slides and kinematic turns can differ slightly.
- **The hips never move to reach an IK goal** (Unity's full-body solver can shift the body).
- **Synced-layer Timing is an approximation:** the source plays at `lerp(sourceLength, syncedLength, syncedWeight)`.
- **Match target:** hands, and feet without baked goals, use their current offset from the root.
- **Verified equal to Unity**, so they are not deviations: hashes (states, parameters and both transition hashes); override-of-override re-basing; behaviour hook order; event times; blend-tree weights; humanoid Foot IK in the air (Unity has no extra in-air foot correction to port).

---

## 15. Migrating from `TOOLKIT.AnimationState`

`TOOLKIT.AnimationState` is gone. **Scenes exported before the change must be re-exported**: an old export logs one "re-export" error per object and its animation does not play.

| `TOOLKIT.AnimationState` (old) | `TOOLKIT.Animator` (new) |
|---|---|
| `getComponent("TOOLKIT.AnimationState")` | `getComponent<TOOLKIT.Animator>(TOOLKIT.Animator.ClassName)` |
| `enableAnimations` | `enabled` |
| `speedRatio` | `speed` |
| `setSmoothFloat(name, value, dampTime)` | `setFloat(name, value, dampTime, deltaTime)` — every frame |
| `hasFloat` / `hasBool` / `hasInteger` / `hasTrigger(name)` | `hasParameter(name, TOOLKIT.AnimatorControllerParameterType.Float / Bool / Int / Trigger)` |
| `playAnimation(state, transitionDuration, layer)` | `crossFadeInFixedTime(state, transitionDuration, layer)` (or `play(state, layer)` for no blend) |
| `getCurrentState(layer).name` | `getCurrentAnimatorStateInfo(layer).stateName` |
| `getCurrentState(layer)` (`MachineState`) | `getCurrentAnimatorStateInfo(layer)` (`AnimatorStateInfo`) |
| `getAnimationTime()` | `getCurrentAnimatorStateInfo(layer).normalizedTime % 1` |
| `getRuntimeController()` | `runtimeAnimatorController.name` |
| `onAnimationEventObservable` (`IAnimatorEvent`, `.function`, normalized `.time`) | `onAnimatorEventObservable` (`AnimatorEvent`, `.functionName`, `.time` in seconds) or a method named like the event |
| `onAnimationIKObservable` | `onAnimatorIKObservable` |
| `onAnimationEndObservable` | `onStateExitObservable` |
| `ikFrameEnabled()` | `hasIKPassLayer()` / the IK observable |
| `getDeltaRootMotionPosition()` / `getDeltaRootMotionRotation()` | `deltaPosition` / `deltaRotation` |
| `getDeltaRootMotionSpeed()` / `getDeltaRootMotionAngle()` | `velocity` / `angularVelocity` |
| `isVertexAnimationModeEnabled()` | `getVertexAnimationController() != null` |
| `AnimatorParameterType` | `AnimatorControllerParameterType` |

Root motion no longer needs hand wiring: set `applyRootMotion` and the Animator moves the character through its receiver, Havok body or transform (§6). To drive the motion yourself, add an `onAnimatorMoveObservable` taker.

---

## 16. Notes For AI Agents

1. **Never call `play` / `crossFade` every frame.** Set parameters and let the state machine decide; transitions are authored in Unity.
2. **Root motion moves the character only through Unity's rules** (§6): a taker, or with `applyRootMotion` a receiver, `characterController`, the Havok body or the transform. Do not also move the character from the same clip in your own code.
3. **Hashes equal Unity's** (`TOOLKIT.Animator.stringToHash`), so hashes hard-coded in ported C# keep working. Hash once, outside the frame loop.
4. **Events and state-info objects are pooled** inside callbacks; use the `…ToRef` queries in per-frame code.
5. **Swap controllers through exported fields** and `AnimatorControllerRegistry.resolve`. A controller that no exported field or Animator references is not in the scene.
6. **Re-export scenes made before `TOOLKIT.Animator`.** A "re-export" console error names each old object.
7. Everything here is automatic from Unity. Author Animators, controllers, override controllers, masks, events and behaviours in Unity, export, and script only the gameplay (parameters, swaps, IK targets).
