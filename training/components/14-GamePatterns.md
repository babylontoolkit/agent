# Game Code Patterns — Complete Examples

> This document contains complete, copy-paste-ready examples that combine multiple Babylon Toolkit systems into real game scenarios. All code uses the `TOOLKIT` namespace conventions.

---

## Import

```typescript
import * as TOOLKIT from "@babylonjs-toolkit/next";
// named imports are equivalent: import { SceneManager, ScriptComponent, InputController, CharacterController } from "@babylonjs-toolkit/next";
```

---

## Pattern 1 — Third-Person Player Controller

Full third-person controller: input → CharacterController movement → AnimationState → camera follow.

```typescript
namespace TOOLKIT {
    export class ThirdPersonPlayer extends TOOLKIT.ScriptComponent {
        // Inspector properties
        private moveSpeed: number = 5.0;
        private sprintMultiplier: number = 1.8;
        private jumpForce: number = 8.0;
        private rotationSpeed: number = 10.0;
        private cameraPivotName: string = "CameraPivot";
        private cameraDistance: number = 4.0;
        private cameraSensitivity: number = 0.3;
        private cameraPitchMin: number = -30;
        private cameraPitchMax: number = 60;

        // Runtime references
        private cc: TOOLKIT.CharacterController = null;
        private anim: TOOLKIT.AnimationState = null;
        private cameraPivot: BABYLON.TransformNode = null;

        // State
        private yaw: number = 0;
        private pitch: number = 30;
        private moveDir: BABYLON.Vector3 = BABYLON.Vector3.Zero();

        constructor(t: BABYLON.TransformNode, s: BABYLON.Scene, p: any = {}) {
            super(t, s, p, "TOOLKIT.ThirdPersonPlayer");
        }

        protected awake(): void {
            this.moveSpeed        = this.getProperty("moveSpeed", 5.0);
            this.sprintMultiplier = this.getProperty("sprintMultiplier", 1.8);
            this.jumpForce        = this.getProperty("jumpForce", 8.0);
            this.rotationSpeed    = this.getProperty("rotationSpeed", 10.0);
            this.cameraSensitivity = this.getProperty("cameraSensitivity", 0.3);
        }

        protected start(): void {
            this.cc   = this.getComponent("TOOLKIT.CharacterController");
            this.anim = this.getComponent("TOOLKIT.AnimationState");

            this.cameraPivot = TOOLKIT.SceneManager.FindChildTransformNode(
                this.transform, this.cameraPivotName, TOOLKIT.SearchType.ExactMatch
            );

            // Start camera yaw at character's current Y rotation
            this.yaw = this.transform.rotation.y * TOOLKIT.System.Rad2Deg;

            // Lock mouse on click
            this.scene.onPointerObservable.add((info) => {
                if (info.type === BABYLON.PointerEventTypes.POINTERDOWN) {
                    TOOLKIT.InputController.LockMousePointer(this.scene, true);
                }
            });
        }

        protected update(): void {
            const dt = this.getDeltaSeconds();

            // ── Camera rotation ─────────────────────────────────────────────
            const mx = TOOLKIT.InputController.GetUserInput(TOOLKIT.UserInputAxis.MouseX);
            const my = TOOLKIT.InputController.GetUserInput(TOOLKIT.UserInputAxis.MouseY);

            this.yaw   += mx * this.cameraSensitivity;
            this.pitch  = BABYLON.Scalar.Clamp(
                this.pitch + my * this.cameraSensitivity * 0.5,
                this.cameraPitchMin, this.cameraPitchMax
            );

            if (this.cameraPivot) {
                this.cameraPivot.rotation.x = this.pitch * TOOLKIT.System.Deg2Rad;
                this.cameraPivot.rotation.y = this.yaw   * TOOLKIT.System.Deg2Rad;
            }

            // ── Movement ─────────────────────────────────────────────────────
            const fwd    = TOOLKIT.InputController.GetUserInput(TOOLKIT.UserInputAxis.Vertical);
            const horiz  = TOOLKIT.InputController.GetUserInput(TOOLKIT.UserInputAxis.Horizontal);
            const isSprinting = TOOLKIT.InputController.GetKeyboardInput(TOOLKIT.UserInputKey.Shift);
            const speed = this.moveSpeed * (isSprinting ? this.sprintMultiplier : 1.0);

            // Move relative to camera yaw, not character yaw
            const camYawRad = this.yaw * TOOLKIT.System.Deg2Rad;
            const camFwd  = new BABYLON.Vector3(Math.sin(camYawRad), 0, Math.cos(camYawRad));
            const camRight = new BABYLON.Vector3(Math.cos(camYawRad), 0, -Math.sin(camYawRad));

            this.moveDir = camFwd.scale(fwd).add(camRight.scale(horiz));
            const hasInput = this.moveDir.lengthSquared() > 0.01;

            if (hasInput) {
                this.moveDir.normalize().scaleInPlace(speed);
                // Rotate character toward movement direction
                const targetYaw = Math.atan2(this.moveDir.x, this.moveDir.z);
                const currentYaw = this.transform.rotation.y;
                this.transform.rotation.y = BABYLON.Scalar.Lerp(
                    currentYaw,
                    targetYaw,
                    this.rotationSpeed * dt
                );
            }

            this.cc?.move(hasInput ? this.moveDir : BABYLON.Vector3.Zero());

            // ── Jump ─────────────────────────────────────────────────────────
            if (TOOLKIT.InputController.WasKeyboardButtonTapped(TOOLKIT.UserInputKey.SpaceBar, true)) {
                if (this.cc?.isGrounded() && this.cc.canJump()) {
                    this.cc.jump(this.jumpForce);
                    this.anim?.setTrigger("Jump");
                }
            }

            // ── Animation parameters ──────────────────────────────────────────
            const actualSpeed = hasInput ? this.moveDir.length() : 0;
            const normalizedSpeed = actualSpeed / (this.moveSpeed * this.sprintMultiplier);
            this.anim?.setSmoothFloat("Speed", normalizedSpeed, 0.1);
            this.anim?.setBool("IsGrounded", this.cc?.isGrounded() ?? true);
            this.anim?.setFloat("VerticalVelocity", this.cc?.getVerticalVelocity() ?? 0);
            this.anim?.setBool("IsSprinting", isSprinting && hasInput);
        }
    }
}
```

---

## Pattern 2 — AI Enemy (Navigation + Animation + Health)

Full enemy: patrol → detect player → chase → attack → play death animation.

```typescript
namespace TOOLKIT {
    export class EnemyController extends TOOLKIT.ScriptComponent {
        // Inspector properties
        private detectionRange: number = 15.0;
        private attackRange: number = 2.0;
        private attackDamage: number = 10;
        private attackCooldown: number = 1.5;
        private patrolSpeed: number = 2.0;
        private chaseSpeed: number = 5.0;
        private maxHitPoints: number = 100;

        // Runtime references
        private agent: TOOLKIT.NavigationAgent = null;
        private anim: TOOLKIT.AnimationState = null;
        private audio: TOOLKIT.AudioSource = null;
        private playerNode: BABYLON.TransformNode = null;

        // State
        private hitPoints: number = 100;
        private state: "patrol"|"chase"|"attack"|"dead" = "patrol";
        private patrolPoints: BABYLON.TransformNode[] = [];
        private patrolIndex: number = 0;
        private attackTimer: number = 0;
        private navRefreshTimer: number = 0;
        private readonly NAV_REFRESH = 0.5;

        constructor(t: BABYLON.TransformNode, s: BABYLON.Scene, p: any = {}) {
            super(t, s, p, "TOOLKIT.EnemyController");
        }

        protected awake(): void {
            this.detectionRange = this.getProperty("detectionRange", 15.0);
            this.attackRange    = this.getProperty("attackRange", 2.0);
            this.attackDamage   = this.getProperty("attackDamage", 10);
            this.attackCooldown = this.getProperty("attackCooldown", 1.5);
            this.patrolSpeed    = this.getProperty("patrolSpeed", 2.0);
            this.chaseSpeed     = this.getProperty("chaseSpeed", 5.0);
            this.maxHitPoints   = this.getProperty("maxHitPoints", 100);
            this.hitPoints      = this.maxHitPoints;
        }

        protected start(): void {
            this.agent = this.getComponent("TOOLKIT.NavigationAgent");
            this.anim  = this.getComponent("TOOLKIT.AnimationState");
            this.audio = this.getComponent("TOOLKIT.AudioSource");

            this.playerNode = TOOLKIT.SceneManager.FindGameObjectWithTag(this.scene, "Player");

            const ptNodes = TOOLKIT.SceneManager.FindGameObjectsWithTag(this.scene, "PatrolPoint");
            this.patrolPoints = ptNodes ?? [];

            // Animation events
            this.anim?.onAnimationEventObservable.add((evt) => {
                if (evt.function === "DealDamage") this.dealMeleeDamage();
            });

            // Nav complete
            this.agent?.onNavCompleteObservable.add(() => {
                if (this.state === "patrol") {
                    TOOLKIT.SceneManager.WaitForSeconds(2).then(() => this.nextPatrol());
                }
            });

            this.agent?.onReadyObservable.add(() => this.nextPatrol());
        }

        protected update(): void {
            if (this.state === "dead") return;
            const dt = this.getDeltaSeconds();

            this.attackTimer     -= dt;
            this.navRefreshTimer -= dt;

            const distToPlayer = this.playerNode
                ? BABYLON.Vector3.Distance(this.transform.position, this.playerNode.position)
                : Infinity;

            // State transitions
            if (distToPlayer <= this.attackRange) {
                this.enterState("attack");
            } else if (distToPlayer <= this.detectionRange) {
                this.enterState("chase");
            } else {
                this.enterState("patrol");
            }

            // Per-state update
            if (this.state === "chase" && this.navRefreshTimer <= 0) {
                this.navRefreshTimer = this.NAV_REFRESH;
                this.agent?.setDestination(this.playerNode!.position);
            } else if (this.state === "attack") {
                this.agent?.cancelNavigation();
                if (this.attackTimer <= 0) {
                    this.attackTimer = this.attackCooldown;
                    this.anim?.setTrigger("Attack");
                }
                // Face the player
                const toPlayer = this.playerNode!.position.subtract(this.transform.position);
                toPlayer.y = 0;
                if (toPlayer.lengthSquared() > 0.01) {
                    this.transform.lookAt(this.transform.position.add(toPlayer));
                }
            }

            // Animation sync
            const vel = this.agent?.getAgentVelocity() ?? BABYLON.Vector3.Zero();
            this.anim?.setSmoothFloat("Speed", vel.length(), 0.1);
        }

        private enterState(s: "patrol"|"chase"|"attack"|"dead"): void {
            if (this.state === s) return;
            this.state = s;
            if (s === "chase") {
                this.agent?.setMovementSpeed(this.chaseSpeed);
                this.agent?.setDestination(this.playerNode!.position);
            } else if (s === "patrol") {
                this.agent?.setMovementSpeed(this.patrolSpeed);
                this.nextPatrol();
            }
        }

        private nextPatrol(): void {
            if (this.patrolPoints.length === 0) return;
            const pt = this.patrolPoints[this.patrolIndex % this.patrolPoints.length];
            this.agent?.setDestination(pt.position);
            this.patrolIndex++;
        }

        private dealMeleeDamage(): void {
            if (!this.playerNode) return;
            const dist = BABYLON.Vector3.Distance(this.transform.position, this.playerNode.position);
            if (dist > this.attackRange * 1.5) return;
            const playerHealth: PlayerHealth = TOOLKIT.SceneManager.FindScriptComponent(
                this.playerNode, "TOOLKIT.PlayerHealth"
            );
            playerHealth?.takeDamage(this.attackDamage);
        }

        public takeDamage(amount: number): void {
            if (this.state === "dead") return;
            this.hitPoints -= amount;
            this.audio?.play();
            if (this.hitPoints <= 0) this.die();
        }

        private die(): void {
            this.enterState("dead");
            this.agent?.cancelNavigation();
            this.anim?.setTrigger("Die");
            this.anim?.onAnimationEndObservable.addOnce(() => {
                TOOLKIT.SceneManager.SafeDestroy(this.transform, 3000, true);
            });
            TOOLKIT.SceneManager.EventBus.PostMessage("enemy:killed", {
                position: this.transform.position.clone()
            });
        }
    }
}
```

---

## Pattern 3 — Racing Car Controller

Full car: input → RaycastVehicle → speed-based audio + animation.

```typescript
namespace TOOLKIT {
    export class RacingCarController extends TOOLKIT.ScriptComponent {
        // Inspector properties
        private maxEngineForce: number = 2000;
        private maxBrakingForce: number = 100;
        private maxSteeringAngle: number = 0.5;
        private steeringSpeed: number = 3.0;
        private downforce: number = 50;

        // Runtime references
        private vehicle: TOOLKIT.RaycastVehicle = null;
        private engineAudio: TOOLKIT.AudioSource = null;

        // State
        private steerValue: number = 0;
        private engineForce: number = 0;
        private brakeForce: number = 0;

        constructor(t: BABYLON.TransformNode, s: BABYLON.Scene, p: any = {}) {
            super(t, s, p, "TOOLKIT.RacingCarController");
        }

        protected awake(): void {
            this.maxEngineForce    = this.getProperty("maxEngineForce", 2000);
            this.maxBrakingForce   = this.getProperty("maxBrakingForce", 100);
            this.maxSteeringAngle  = this.getProperty("maxSteeringAngle", 0.5);
            this.steeringSpeed     = this.getProperty("steeringSpeed", 3.0);
        }

        protected start(): void {
            const rb: TOOLKIT.RigidbodyPhysics = this.getComponent("TOOLKIT.RigidbodyPhysics");
            this.vehicle = rb?.getRaycastVehicle();
            this.engineAudio = this.getComponent("TOOLKIT.AudioSource");
        }

        protected update(): void {
            if (!this.vehicle) return;
            const dt = this.getDeltaSeconds();

            const accel  = TOOLKIT.InputController.GetUserInput(TOOLKIT.UserInputAxis.Vertical);
            const steer  = TOOLKIT.InputController.GetUserInput(TOOLKIT.UserInputAxis.Horizontal);
            const braking = TOOLKIT.InputController.GetKeyboardInput(TOOLKIT.UserInputKey.SpaceBar);

            // Smooth steering
            const targetSteer = steer * this.maxSteeringAngle;
            this.steerValue = BABYLON.Scalar.Lerp(this.steerValue, targetSteer, this.steeringSpeed * dt);

            // Engine force (rear wheel drive)
            this.engineForce = accel * this.maxEngineForce;
            this.brakeForce  = braking ? this.maxBrakingForce : 0;

            // Apply to vehicle
            this.vehicle.setEngineForce(this.engineForce, 2);
            this.vehicle.setEngineForce(this.engineForce, 3);
            this.vehicle.setPhysicsSteeringAngle(-this.steerValue, 0);
            this.vehicle.setPhysicsSteeringAngle(-this.steerValue, 1);
            for (let i = 0; i < 4; i++) {
                this.vehicle.setBrakingForce(this.brakeForce + (braking ? 0 : (accel === 0 ? 5 : 0)), i);
            }

            // Engine audio pitch based on speed
            const speedKmh = this.vehicle.getAbsCurrentSpeedKph();
            const pitchFactor = 0.8 + (speedKmh / 150) * 1.2; // 0.8 to 2.0
            // Note: accessing raw sound for pitch
            const sound = this.engineAudio?.getSoundClip() as BABYLON.Sound;
            if (sound) sound.setPlaybackRate(BABYLON.Scalar.Clamp(pitchFactor, 0.8, 2.0));
        }
    }
}
```

---

## Pattern 4 — HUD & UI Manager

Connecting game events to Babylon.js GUI.

```typescript
namespace TOOLKIT {
    export class HUDManager extends TOOLKIT.ScriptComponent {
        private healthBar: BABYLON.GUI.Rectangle = null;
        private healthText: BABYLON.GUI.TextBlock = null;
        private ammoText: BABYLON.GUI.TextBlock = null;
        private crosshair: BABYLON.GUI.Ellipse = null;
        private advancedTexture: BABYLON.GUI.AdvancedDynamicTexture = null;
        private onHealthChanged = (data: any) => this.setHealth(data.current, data.max);
        private onAmmoChanged   = (data: any) => this.setAmmo(data.current, data.reserve);

        constructor(t: BABYLON.TransformNode, s: BABYLON.Scene, p: any = {}) {
            super(t, s, p, "TOOLKIT.HUDManager");
        }

        protected awake(): void {
            this.buildHUD();
        }

        protected start(): void {
            // Subscribe to game events (handlers stored so destroy() can remove them)
            TOOLKIT.SceneManager.EventBus.OnMessage("player:health-changed", this.onHealthChanged);
            TOOLKIT.SceneManager.EventBus.OnMessage("weapon:ammo-changed", this.onAmmoChanged);
        }

        private buildHUD(): void {
            this.advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("HUD");

            // Health bar background
            const hpBg = new BABYLON.GUI.Rectangle("hpBg");
            hpBg.width = "200px";
            hpBg.height = "20px";
            hpBg.color = "white";
            hpBg.background = "gray";
            hpBg.cornerRadius = 4;
            hpBg.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            hpBg.verticalAlignment   = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
            hpBg.left = "20px";
            hpBg.top = "-60px";
            this.advancedTexture.addControl(hpBg);

            // Health bar fill
            this.healthBar = new BABYLON.GUI.Rectangle("hpFill");
            this.healthBar.width = "200px";
            this.healthBar.height = "20px";
            this.healthBar.color = "transparent";
            this.healthBar.background = "#44cc44";
            this.healthBar.cornerRadius = 4;
            this.healthBar.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            hpBg.addControl(this.healthBar);

            // Health text
            this.healthText = new BABYLON.GUI.TextBlock("hpText", "100 / 100");
            this.healthText.color = "white";
            this.healthText.fontSize = 12;
            hpBg.addControl(this.healthText);

            // Ammo text
            this.ammoText = new BABYLON.GUI.TextBlock("ammoText", "30 / 90");
            this.ammoText.color = "white";
            this.ammoText.fontSize = 16;
            this.ammoText.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
            this.ammoText.verticalAlignment   = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
            this.ammoText.left = "-20px";
            this.ammoText.top  = "-60px";
            this.advancedTexture.addControl(this.ammoText);

            // Crosshair
            this.crosshair = new BABYLON.GUI.Ellipse("crosshair");
            this.crosshair.width = "6px";
            this.crosshair.height = "6px";
            this.crosshair.color = "white";
            this.crosshair.background = "white";
            this.advancedTexture.addControl(this.crosshair);
        }

        public setHealth(current: number, max: number): void {
            const pct = Math.max(0, current / max);
            this.healthBar.width = `${pct * 200}px`;
            this.healthBar.background = pct > 0.5 ? "#44cc44" : pct > 0.25 ? "#ccaa00" : "#cc2200";
            this.healthText.text = `${Math.ceil(current)} / ${max}`;
        }

        public setAmmo(current: number, reserve: number): void {
            this.ammoText.text = `${current} / ${reserve}`;
        }

        protected destroy(): void {
            TOOLKIT.SceneManager.EventBus.RemoveHandler("player:health-changed", this.onHealthChanged);
            TOOLKIT.SceneManager.EventBus.RemoveHandler("weapon:ammo-changed", this.onAmmoChanged);
            this.advancedTexture?.dispose();
        }
    }
}
```

---

## Pattern 5 — Object Pooling

Efficient bullet/particle pooling using `ScriptComponent` lifecycle.

```typescript
namespace TOOLKIT {
    export class ObjectPool<T extends TOOLKIT.ScriptComponent> {
        private pool: T[] = [];
        private scene: BABYLON.Scene;
        private prefabNode: BABYLON.TransformNode;
        private componentClass: string;

        constructor(scene: BABYLON.Scene, prefabNode: BABYLON.TransformNode, componentClass: string, initialSize: number) {
            this.scene = scene;
            this.prefabNode = prefabNode;
            this.componentClass = componentClass;
            this.expand(initialSize);
        }

        private expand(count: number): void {
            for (let i = 0; i < count; i++) {
                const clone = this.prefabNode.clone(`${this.prefabNode.name}_pool_${i}`, null);
                clone.setEnabled(false);
                const comp: T = TOOLKIT.SceneManager.FindScriptComponent(clone, this.componentClass);
                if (comp) this.pool.push(comp);
            }
        }

        get(): T | null {
            for (const item of this.pool) {
                if (!item.transform.isEnabled()) {
                    item.transform.setEnabled(true);
                    return item;
                }
            }
            this.expand(5); // auto-expand by 5
            return this.get();
        }

        release(item: T): void {
            item.transform.setEnabled(false);
        }
    }

    // Usage
    export class BulletShooter extends TOOLKIT.ScriptComponent {
        private bulletPool: ObjectPool<BulletBehavior> = null;

        protected start(): void {
            const bulletPrefab = TOOLKIT.SceneManager.GetTransformNode(this.scene, "BulletPrefab");
            this.bulletPool = new ObjectPool<BulletBehavior>(
                this.scene, bulletPrefab, "TOOLKIT.BulletBehavior", 20
            );
        }

        public shoot(): void {
            const bullet = this.bulletPool.get();
            if (!bullet) return;
            bullet.transform.position = this.transform.position.clone();
            bullet.transform.rotation = this.transform.rotation.clone();
            bullet.launch(this.transform.forward.scale(30), () => {
                this.bulletPool.release(bullet);
            });
        }
    }
}
```

---

## Pattern 6 — WaitForSeconds Coroutine-Style

Using `async/await` with `SceneManager.WaitForSeconds` for Unity coroutine equivalents.

```typescript
namespace TOOLKIT {
    export class DoorController extends TOOLKIT.ScriptComponent {
        private isOpen: boolean = false;
        private isAnimating: boolean = false;
        private anim: TOOLKIT.AnimationState = null;
        private openSound: TOOLKIT.AudioSource = null;

        constructor(t: BABYLON.TransformNode, s: BABYLON.Scene, p: any = {}) {
            super(t, s, p, "TOOLKIT.DoorController");
        }

        protected start(): void {
            this.anim      = this.getComponent("TOOLKIT.AnimationState");
            this.openSound = this.getComponent("TOOLKIT.AudioSource");

            this.enableCollisionEvents();
            this.onTriggerEnterObservable.add((other) => {
                if (other.metadata?.toolkit?.objectTag === "Player") {
                    if (!this.isOpen) this.open();
                }
            });
            this.onTriggerExitObservable.add((other) => {
                if (other.metadata?.toolkit?.objectTag === "Player") {
                    if (this.isOpen) this.autoClose();
                }
            });
        }

        public async open(): Promise<void> {
            if (this.isAnimating || this.isOpen) return;
            this.isAnimating = true;
            this.isOpen = true;

            this.openSound?.play();
            this.anim?.playAnimation("DoorOpen", 0.1);

            // Wait for animation to finish (~1.5 seconds)
            await TOOLKIT.SceneManager.WaitForSeconds(1.5);
            this.isAnimating = false;
        }

        public async autoClose(): Promise<void> {
            // Wait 3 seconds before auto-closing
            await TOOLKIT.SceneManager.WaitForSeconds(3.0);
            if (!this.isOpen || this.isAnimating) return;
            this.isAnimating = true;
            this.isOpen = false;

            this.openSound?.play();
            this.anim?.playAnimation("DoorClose", 0.1);

            await TOOLKIT.SceneManager.WaitForSeconds(1.5);
            this.isAnimating = false;
        }
    }
}
```

---

## Scene Initialization Template

Complete scene setup: engine → physics → navigation → scene load → gameplay.

```typescript
async function main(): Promise<void> {
    const canvas  = document.getElementById("renderCanvas") as HTMLCanvasElement;
    const engine  = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true });
    const scene   = new BABYLON.Scene(engine);

    // Initialize toolkit runtime
    await TOOLKIT.SceneManager.InitializeRuntime(engine, {
        enableUserInput: true,
        showDefaultLoadingScreen: true,
        hardwareScalingLevel: 1
    });

    // Configure Havok physics
    await TOOLKIT.RigidbodyPhysics.ConfigurePhysicsEngine(scene);

    // Load scenes
    const am = new BABYLON.AssetsManager(scene);
    am.addContainerTask("level",  "", "assets/", "level.gltf");
    am.addContainerTask("player", "", "assets/", "player.gltf");

    await TOOLKIT.SceneManager.LoadRuntimeAssets(am, ["level.gltf", "player.gltf"], () => {
        // All scenes loaded — hide splash, start game
        TOOLKIT.SceneManager.HideSplashScreen(scene, 500);
        TOOLKIT.SceneManager.SetWindowState("gameReady", true);
        TOOLKIT.SceneManager.EventBus.PostMessage("game:ready");
    });

    // Render loop
    engine.runRenderLoop(() => scene.render());
    window.addEventListener("resize", () => engine.resize());
}

main().catch(console.error);
```
