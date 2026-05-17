# TOOLKIT Input Controller — Agent Reference

> **Class:** `TOOLKIT.InputController` (static class — no instantiation)  
> **Namespace:** `TOOLKIT`  
> **Role:** Unified keyboard, mouse, and gamepad input for up to 4 players. Must be enabled by calling `EnableUserInput` once during initialization (or via `IRuntimeOptions.enableUserInput = true`).

---

## Enabling Input

```typescript
// Option A — via InitializeRuntime options (recommended)
await TOOLKIT.SceneManager.InitializeRuntime(engine, { enableUserInput: true });

// Option B — direct call
TOOLKIT.InputController.EnableUserInput(engine, scene, {
    contextMenu: false,      // disable right-click context menu
    pointerLock: false,      // lock mouse pointer
    preventDefault: true,    // prevent default keyboard/mouse events
    useCapture: false
});
```

---

## Axis Input (Analog — Joystick / WASD)

### `GetUserInput`
Returns a value in **[-1..1]** for the specified axis.

```typescript
static GetUserInput(
    axis: TOOLKIT.UserInputAxis,
    player: TOOLKIT.PlayerNumber = TOOLKIT.PlayerNumber.One
): number
```

**Axes:**
```typescript
enum UserInputAxis {
    Horizontal      = 0,  // A/D keys or left joystick X
    Vertical        = 1,  // W/S keys or left joystick Y
    ClientX         = 2,  // mouse X (pixels)
    ClientY         = 3,  // mouse Y (pixels)
    MouseX          = 4,  // mouse delta X
    MouseY          = 5,  // mouse delta Y
    Wheel           = 6,  // scroll wheel delta
    RightStickX     = 7,  // right joystick X
    RightStickY     = 8,  // right joystick Y
    DPadX           = 9,  // D-pad X
    DPadY           = 10, // D-pad Y
    LeftTrigger     = 11, // left trigger [0..1]
    RightTrigger    = 12, // right trigger [0..1]
}
```

**Examples:**
```typescript
const fwd    = TOOLKIT.InputController.GetUserInput(TOOLKIT.UserInputAxis.Vertical);
const strafe = TOOLKIT.InputController.GetUserInput(TOOLKIT.UserInputAxis.Horizontal);
const camX   = TOOLKIT.InputController.GetUserInput(TOOLKIT.UserInputAxis.MouseX);
const camY   = TOOLKIT.InputController.GetUserInput(TOOLKIT.UserInputAxis.MouseY);

// Player 2 input
const p2Fwd = TOOLKIT.InputController.GetUserInput(TOOLKIT.UserInputAxis.Vertical, TOOLKIT.PlayerNumber.Two);
```

---

## Keyboard Input

```typescript
// Returns true every frame the key is held
static GetKeyPress(keyCode: TOOLKIT.UserInputKey, player?: TOOLKIT.PlayerNumber): boolean

// Returns true only on the frame the key went down
static GetKeyDown(keyCode: TOOLKIT.UserInputKey, player?: TOOLKIT.PlayerNumber): boolean

// Returns true only on the frame the key was released
static GetKeyUp(keyCode: TOOLKIT.UserInputKey, player?: TOOLKIT.PlayerNumber): boolean
```

**Common Key Codes:**
```typescript
enum UserInputKey {
    BackSpace = 8,   Tab = 9,    Enter = 13,  Shift = 16,
    Ctrl = 17,       Alt = 18,   Pause = 19,  CapsLock = 20,
    Escape = 27,     Space = 32, PageUp = 33, PageDown = 34,
    End = 35,        Home = 36,  LeftArrow = 37, UpArrow = 38,
    RightArrow = 39, DownArrow = 40,
    Delete = 46,
    // Numbers 0–9 = 48–57
    // Letters A–Z = 65–90
    A = 65, B = 66, C = 67, D = 68, E = 69, F = 70,
    G = 71, H = 72, I = 73, J = 74, K = 75, L = 76,
    M = 77, N = 78, O = 79, P = 80, Q = 81, R = 82,
    S = 83, T = 84, U = 85, V = 86, W = 87, X = 88,
    Y = 89, Z = 90,
    // F keys
    F1 = 112, F2 = 113, F3 = 114, F4 = 115,
    F5 = 116, F6 = 117, F7 = 118, F8 = 119,
    F9 = 120, F10 = 121, F11 = 122, F12 = 123,
    // Numpad
    Numpad0 = 96, Numpad1 = 97, Numpad2 = 98, Numpad3 = 99,
    // Etc.
    LeftBracket = 219,  BackSlash = 220,  RightBracket = 221,
}
```

**Example:**
```typescript
protected update(): void {
    // Hold to sprint
    const isSprinting = TOOLKIT.InputController.GetKeyPress(TOOLKIT.UserInputKey.Shift);

    // Single-frame jump
    if (TOOLKIT.InputController.GetKeyDown(TOOLKIT.UserInputKey.Space)) {
        this.cc.jump(8.0);
    }

    // Reload on tap
    if (TOOLKIT.InputController.GetKeyDown(TOOLKIT.UserInputKey.R)) {
        this.weapon.reload();
    }
}
```

---

## Mouse Input

```typescript
// Mouse buttons — true every frame button is held
static GetLeftButtonDown(player?): boolean
static GetRightButtonDown(player?): boolean
static GetMiddleButtonDown(player?): boolean

// Positions
static GetClientX(player?): number    // absolute X in pixels
static GetClientY(player?): number    // absolute Y in pixels
static GetMouseX(player?): number     // delta X this frame
static GetMouseY(player?): number     // delta Y this frame
static GetMouseWheelDelta(player?): number  // scroll delta
```

---

## Mouse Pointer Lock

```typescript
static LockMousePointer(scene: BABYLON.Scene, lock: boolean): void
// lock = true  → request pointer lock (mouse hidden, infinite delta)
// lock = false → exit pointer lock

// Usage: lock on click, unlock on Escape
TOOLKIT.InputController.LockMousePointer(scene, true);
```

---

## Gamepad Input

```typescript
// Check gamepad buttons (pressed state)
static GetGamepadButtonDown(button: number, player?): boolean
static GetGamepadButtonUp(button: number, player?): boolean
static GetGamepadButtonPress(button: number, player?): boolean

// Button mappings (standard)
// 0 = A/Cross, 1 = B/Circle, 2 = X/Square, 3 = Y/Triangle
// 4 = LB, 5 = RB, 6 = LT, 7 = RT
// 8 = Back/Select, 9 = Start
// 10 = L3, 11 = R3
// 12 = DPad Up, 13 = DPad Down, 14 = DPad Left, 15 = DPad Right
```

**Gamepad type detection:**
```typescript
static GetGamepadType(player?: TOOLKIT.PlayerNumber): TOOLKIT.GamepadType

enum GamepadType {
    None        = -1,
    Generic     = 0,
    Xbox360     = 1,
    DualShock   = 2,
    Switch      = 4
}
```

---

## Virtual Joystick (Mobile)

```typescript
// Set left joystick position from virtual stick UI
static SetLeftJoystickBuffer(xAxis: number, yAxis: number, player?): void

// Set right joystick position
static SetRightJoystickBuffer(xAxis: number, yAxis: number, player?): void

// Enable virtual joystick (disables physical input for the axis)
TOOLKIT.SceneManager.VirtualJoystickEnabled = true;
```

---

## Player Number Enum

```typescript
enum PlayerNumber {
    One   = 1,
    Two   = 2,
    Three = 3,
    Four  = 4
}
```

---

## UserInputOptions (Sensitivity Config)

```typescript
class UserInputOptions {
    // Keyboard movement sensibility (default 1.0)
    static keyboardMoveDeadZone: number;
    static keyboardMoveEngaged: number;
    static keyboardMoveSensibility: number;

    // Gamepad axis sensibility
    static gamepadDeadStickValue: number;       // default 0.1
    static gamepadLeftSensibility: number;
    static gamepadRightSensibility: number;
    static gamepadLefTriggerValue: number;
    static gamepadRightTriggerValue: number;

    // Mouse
    static mouseRightClickButton: number;       // default 2
    static mouseMiddleClickButton: number;      // default 1
    static mouseSensibility: number;            // default 1.0
    static mouseWheelDeadZone: number;          // default 0.1
    static mouseMoveDeadZone: number;

    // Pointer
    static pointerAngularSensibility: number;
    static pointerWheelDeadZone: number;
}
```

**Tuning example:**
```typescript
TOOLKIT.UserInputOptions.gamepadDeadStickValue = 0.15;
TOOLKIT.UserInputOptions.mouseSensibility = 2.0;
```

---

## First-Person Camera + Input — Full Pattern

```typescript
namespace TOOLKIT {
    export class FPSController extends TOOLKIT.ScriptComponent {
        private cc: TOOLKIT.CharacterController = null;
        private cameraNode: BABYLON.TransformNode = null;
        private moveSpeed: number = 5.0;
        private lookSensitivity: number = 0.15;
        private pitchMin: number = -70;
        private pitchMax: number = 70;
        private yaw: number = 0;
        private pitch: number = 0;

        constructor(t: BABYLON.TransformNode, s: BABYLON.Scene, p: any = {}) {
            super(t, s, p, "TOOLKIT.FPSController");
        }

        protected awake(): void {
            this.moveSpeed        = this.getProperty("moveSpeed", 5.0);
            this.lookSensitivity  = this.getProperty("lookSensitivity", 0.15);
        }

        protected start(): void {
            this.cc = this.getComponent("TOOLKIT.CharacterController");
            this.cameraNode = this.getChildNode("CameraRoot", TOOLKIT.SearchType.ExactMatch, false);

            // Lock mouse on first click
            this.scene.onPointerObservable.add((info) => {
                if (info.type === BABYLON.PointerEventTypes.POINTERDOWN) {
                    TOOLKIT.InputController.LockMousePointer(this.scene, true);
                }
            });
        }

        protected update(): void {
            const dt = this.getDeltaSeconds();

            // ── Look ─────────────────────────────────────────────────────────
            const mx = TOOLKIT.InputController.GetUserInput(TOOLKIT.UserInputAxis.MouseX);
            const my = TOOLKIT.InputController.GetUserInput(TOOLKIT.UserInputAxis.MouseY);

            this.yaw   += mx * this.lookSensitivity;
            this.pitch  = BABYLON.Scalar.Clamp(
                this.pitch - my * this.lookSensitivity,
                this.pitchMin, this.pitchMax
            );

            // Rotate body on Y
            this.transform.rotation.y = this.yaw * TOOLKIT.System.Deg2Rad;
            // Rotate camera on X
            if (this.cameraNode) {
                this.cameraNode.rotation.x = this.pitch * TOOLKIT.System.Deg2Rad;
            }

            // ── Move ─────────────────────────────────────────────────────────
            const fwd    = TOOLKIT.InputController.GetUserInput(TOOLKIT.UserInputAxis.Vertical);
            const horiz  = TOOLKIT.InputController.GetUserInput(TOOLKIT.UserInputAxis.Horizontal);
            const sprint = TOOLKIT.InputController.GetKeyPress(TOOLKIT.UserInputKey.Shift) ? 1.7 : 1.0;

            const worldFwd   = this.transform.forward.scale(fwd * this.moveSpeed * sprint);
            const worldRight = this.transform.right.scale(horiz * this.moveSpeed * sprint);
            this.cc?.move(worldFwd.add(worldRight));

            // ── Jump ─────────────────────────────────────────────────────────
            if (TOOLKIT.InputController.GetKeyDown(TOOLKIT.UserInputKey.Space)) {
                if (this.cc?.isGrounded() && this.cc.canJump()) {
                    this.cc.jump(8.0);
                }
            }

            // ── Escape — unlock mouse ─────────────────────────────────────────
            if (TOOLKIT.InputController.GetKeyDown(TOOLKIT.UserInputKey.Escape)) {
                TOOLKIT.InputController.LockMousePointer(this.scene, false);
            }
        }
    }
}
```

---

## Notes For AI Agents

1. **`GetKeyDown` vs `GetKeyPress`** — use `GetKeyDown` for single-fire actions (jump, shoot, reload); use `GetKeyPress` for continuous actions (sprint, crouch).
2. **`GetUserInput(Vertical)`** returns +1 for W/forward, -1 for S/back — same as Unity's `Input.GetAxis("Vertical")`.
3. **Mouse delta** — `GetUserInput(MouseX/Y)` returns the pixel delta this frame; multiply by sensitivity.
4. **Pointer lock must be requested via a user gesture** (click) — browsers block programmatic pointer lock.
5. **Gamepad triggers** — use `GetUserInput(LeftTrigger/RightTrigger)` for analog [0..1] values.
