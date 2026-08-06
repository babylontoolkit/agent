# TOOLKIT.NavigationAgent — Agent Reference

> **Extends:** `TOOLKIT.ScriptComponent`  
> **Namespace:** `TOOLKIT`  
> **Role:** Unity-style AI navigation agent using the Recast/Detour crowd system (`ADDONS.RecastNavigationJSPluginV2`). Assigns the node to the crowd, computes paths, moves the agent, and manages rotation.

---

## Import

```typescript
import * as TOOLKIT from "@babylonjs-toolkit/next";
// named imports are equivalent: import { NavigationAgent, ScriptComponent, SceneManager } from "@babylonjs-toolkit/next";
```

---

## Prerequisites

The navigation plugin and navmesh must be baked and loaded before agents can navigate.

```typescript
// Check navigation is ready before creating agents
if (TOOLKIT.SceneManager.HasNavigationData()) {
    const crowd = TOOLKIT.SceneManager.GetCrowdInterface(scene);
    // agent.setDestination() will now work
}

// Maximum agents supported
TOOLKIT.SceneManager.MAX_AGENT_COUNT   // number (e.g. 256)
TOOLKIT.SceneManager.MAX_AGENT_RADIUS  // number (e.g. 4.0)
```

---

## Quick-Start

```typescript
// 1. Find the agent
const agent: TOOLKIT.NavigationAgent = TOOLKIT.SceneManager.FindScriptComponent(
    enemyNode, "TOOLKIT.NavigationAgent"
);

// 2. Navigate to the player
agent.setDestination(playerTransform.position);

// 3. React when path is reached
agent.onNavCompleteObservable.add(() => {
    agent.cancelNavigation();
    startIdleBehavior();
});
```

---

## Instance Properties

```typescript
// Movement
agent.speed            // number — movement speed (m/s)
agent.angularSpeed     // number — max rotation speed (deg/s, default 120)
agent.stoppingDistance // number — distance from target to stop (m, default 0.5)

// Precision
agent.distanceEpsilon  // number — arrival precision (default 0.01)
agent.velocityEpsilon  // number — stopped detection threshold (default 0.01)

// Agent shape
// (read from Unity metadata; set via methods below for runtime changes)

// Position sync
agent.updatePosition   // boolean — auto-sync transform from crowd (default true)
agent.updateRotation   // boolean — auto-rotate toward velocity direction (default true)
agent.heightOffset     // number — vertical offset between navmesh surface and transform (default 0)
```

---

## Navigation Methods

### `setDestination`
Main pathfinding call — equivalent to Unity's `NavMeshAgent.SetDestination`.

```typescript
setDestination(
    destination: BABYLON.Vector3,
    closetPoint?: boolean    // snap destination to nearest navmesh point (default true)
): void
```

```typescript
// Send AI to patrol waypoint
agent.setDestination(waypointNode.position);

// Force a world-space position even if off navmesh
agent.setDestination(rawWorldPos, false);
```

### `move`
Apply a manual velocity offset to the agent crowd position (relative teleport).

```typescript
move(
    offset: BABYLON.Vector3,
    closetPoint?: boolean
): void
```

### `teleport`
Instantly move to a position without pathfinding.

```typescript
teleport(
    destination: BABYLON.Vector3,
    closetPoint?: boolean    // default true
): void
```

### `cancelNavigation`
Stop all movement and clear current path.

```typescript
cancelNavigation(): void
```

---

## Agent Parameter Methods (runtime overrides)

```typescript
agent.setMovementSpeed(speed: number): void       // m/s
agent.setAcceleration(speed: number): void        // m/s²
agent.angularSpeed = 180;                         // deg/s — public property, set directly
agent.stoppingDistance = 1.0;                     // m — public property, set directly

agent.setAgentRadius(radius: number): void        // capsule radius
agent.setAgentHeight(height: number): void        // capsule height
agent.setSeparationWeight(weight: number): void   // crowd separation (0 = disabled)
agent.setOptimizationRange(range: number): void   // path optimization range
agent.setCollisionQueryRange(range: number): void // neighbourhood query range
```

---

## Position and Velocity Queries

```typescript
agent.getAgentPosition(): BABYLON.Vector3    // navmesh crowd position
agent.getAgentVelocity(): BABYLON.Vector3    // navmesh crowd velocity
agent.getAgentWaypoint(): BABYLON.Vector3    // next waypoint on current path
agent.getCurrentPosition(): BABYLON.Vector3  // transform world position
agent.getCurrentRotation(): BABYLON.Quaternion
agent.getCurrentVelocity(): BABYLON.Vector3
agent.getTargetDistance(): number            // distance from target
agent.getAgentState(): number                // raw crowd agent state
```

---

## Status Methods

```typescript
agent.isReady(): boolean        // crowd agent has been assigned
agent.isNavigating(): boolean   // agent has an active path
agent.isTeleporting(): boolean  // currently in mid-teleport
agent.isOnOffMeshLink(): boolean // traversing an off-mesh link
```

---

## Observables

```typescript
agent.onReadyObservable         // Observable<BABYLON.TransformNode> — agent joined crowd
agent.onPreUpdateObservable     // Observable<BABYLON.TransformNode> — before crowd step
agent.onPostUpdateObservable    // Observable<BABYLON.TransformNode> — after crowd step
agent.onNavCompleteObservable   // Observable<BABYLON.TransformNode> — destination reached
```

---

## AI Enemy — Complete Example

```typescript
namespace TOOLKIT {
    export class EnemyAI extends TOOLKIT.ScriptComponent {
        private agent: TOOLKIT.NavigationAgent = null;
        private anim: TOOLKIT.AnimationState = null;
        private playerTransform: BABYLON.TransformNode = null;
        private patrolPoints: BABYLON.TransformNode[] = [];
        private currentPatrol: number = 0;
        private detectionRange: number = 15.0;
        private attackRange: number = 2.0;
        private state: "patrol" | "chase" | "attack" = "patrol";
        private navUpdateInterval: number = 0.5;
        private navUpdateTimer: number = 0;

        constructor(t: BABYLON.TransformNode, s: BABYLON.Scene, p: any = {}) {
            super(t, s, p, "TOOLKIT.EnemyAI");
        }

        protected awake(): void {
            this.detectionRange = this.getProperty("detectionRange", 15.0);
            this.attackRange    = this.getProperty("attackRange", 2.0);
        }

        protected start(): void {
            this.agent = this.getComponent("TOOLKIT.NavigationAgent");
            this.anim  = this.getComponent("TOOLKIT.AnimationState");

            // Find patrol points by tag
            const pointNodes = TOOLKIT.SceneManager.FindGameObjectsWithTag(this.scene, "PatrolPoint");
            this.patrolPoints = pointNodes;

            // Find player
            const playerNode = TOOLKIT.SceneManager.FindGameObjectWithTag(this.scene, "Player");
            this.playerTransform = playerNode;

            // Navigation events
            this.agent?.onNavCompleteObservable.add(() => this.onArrived());
            this.agent?.onReadyObservable.add(() => this.goToNextPatrolPoint());
        }

        protected update(): void {
            if (!this.agent?.isReady()) return;
            const dt = this.getDeltaSeconds();

            const distToPlayer = this.playerTransform
                ? BABYLON.Vector3.Distance(
                    this.transform.position,
                    this.playerTransform.position
                  )
                : Infinity;

            // State machine
            if (distToPlayer <= this.attackRange) {
                this.setState("attack");
            } else if (distToPlayer <= this.detectionRange) {
                this.setState("chase");
            } else {
                this.setState("patrol");
            }

            // Re-issue destination periodically during chase
            if (this.state === "chase") {
                this.navUpdateTimer -= dt;
                if (this.navUpdateTimer <= 0) {
                    this.navUpdateTimer = this.navUpdateInterval;
                    this.agent.setDestination(this.playerTransform!.position);
                }
            }

            // Animate
            const speed = this.agent.getAgentVelocity().length();
            this.anim?.setSmoothFloat("Speed", speed, 0.1);
            this.anim?.setBool("IsAttacking", this.state === "attack");
        }

        private setState(s: "patrol" | "chase" | "attack"): void {
            if (this.state === s) return;
            this.state = s;
            if (s === "chase") {
                this.agent?.setMovementSpeed(4.5);
                this.agent?.setDestination(this.playerTransform!.position);
            } else if (s === "patrol") {
                this.agent?.setMovementSpeed(2.0);
                this.goToNextPatrolPoint();
            } else if (s === "attack") {
                this.agent?.cancelNavigation();
            }
        }

        private goToNextPatrolPoint(): void {
            if (this.patrolPoints.length === 0) return;
            const pt = this.patrolPoints[this.currentPatrol % this.patrolPoints.length];
            this.agent?.setDestination(pt.position);
            this.currentPatrol++;
        }

        private onArrived(): void {
            if (this.state === "patrol") {
                // wait briefly then go to next patrol point
                TOOLKIT.SceneManager.WaitForSeconds(2).then(() => this.goToNextPatrolPoint());
            }
        }
    }
}
```

---

## Off-Mesh Links

Off-mesh links allow agents to traverse gaps, jump, or use doors. When an agent begins traversing one:

```typescript
agent.isOnOffMeshLink()  // returns true
agent.onPreUpdateObservable.add((t) => {
    if (agent.isOnOffMeshLink()) {
        // play a jump or climb animation
        anim.setTrigger("Jump");
    }
});
```

---

## Notes For AI Agents

1. **Call `setDestination` only when the target changes** — not every frame (unless chasing; even then throttle with a timer).
2. **`isReady()`** must be true before calling any navigation methods.
3. **`stoppingDistance`** — the agent stops when `getTargetDistance() <= stoppingDistance`, then `onNavCompleteObservable` fires.
4. **Navmesh must be present** — check `TOOLKIT.SceneManager.HasNavigationData()` before creating agents.
5. **Crowd limit** — max agents is `TOOLKIT.SceneManager.MAX_AGENT_COUNT`; pool and disable distant agents.
