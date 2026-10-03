# Code Generation Instructions (1.0.0)

**IMPORTANT. THIS DOCUMENT PROVIDES CRUCIAL CODE GENERATION INSTRUCTIONS. ALWAYS READ THIS ENTIRE DOCUMENT TO THE END OF FILE**

## 🧠 Paradigm

- Target: **Babylon.js** games with `babylon.toolkit.js`
- Use **Unity-like MonoBehaviour lifecycle**: `protected awake()`, `start()`, `update()`, `late()`, `fixed()`
- Always reference the `Babylon Toolkit Component Reference` at https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/README.md for details regarding the script component model api.

## 📊 TypeScript Style

- **Node ESM TypeScript**:
	- Use import { Engine, Scene } from '@babylonjs/core'
	- Use import { SceneManager, ScriptComponent, InputController } from '@babylonjs-toolkit/next'
	- Or use import * as TOOLKIT from '@babylonjs-toolkit/next' — this is proper ESM and the canonical way to write the `TOOLKIT.*` style used throughout the training docs; named imports from the root are equivalent
	- Pro/starter/racing classes (DefaultCameraSystem, DebugInformation, StandardCarController, ThirdPersonPlayerController, etc.) are imported from '@babylonjs-toolkit/next/project' (they are NOT in the root package)
	- No triple-slash or decorators or namespaces ("no namespaces" means no UMD/script-tag globals and no TypeScript `namespace` blocks — ESM namespace imports like `import * as TOOLKIT` are fine)
- **Exported classes**:
  - If the original C# `class` extends `MonoBehaviour` or `EditorScriptComponent`, extend `ScriptComponent`
  - Remove **ANY** and **ALL** namespaces
  - Omit empty lifecycle methods
  - C# yield should convert to async/await in TypeScript
  - Unity transform or game object is a `TransformNode`
- **Typing**:  
  - Always fully type variables/functions  
  - Never use `: any` for known/converted types  
  - Never use `this.properties` (use `this.myprop`)  
  - Never auto-correct spelling; use C# names in camelCase
- **Format**:
  - Always format class, enums and interface names using pascal naming. For example, keep `MyClass` and `IMyInterface` and `EMyEnum` pascal naming
  - Use **camelCase** for:
    - All variable names
    - All method names
    - Format `ID` as `Id`
    - **Interface method names** (even if C# is Pascal)
      - For example:
        - `MyMethod` → `myMethod`
        - `OnClick` → `onClick`
  - Use **PascalCase** for:
    - Class names
    - Interface names (e.g., `IMyInterface`)
    - Enum names (e.g., `EMyEnum`

## 🧹 Coding Practices (ENFORCED)

These rules apply to all code you generate. Code that breaks them is not finished. The full rules, and what they do
not override, are in **Coding Practices — ENFORCED** in the router `reference.md`.

- **TypeScript and JavaScript are both first-class.** Write in the language the project, folder or file already uses.
  TypeScript is the default only for new code with no precedent and no stated preference. Never convert code from
  one language to the other unless the user asks.
- **Write clean, professional code.** Keep functions small with a single job. Prefer early returns over deep nesting.
  Use named constants, not magic numbers. Use `const` by default, `let` only when reassigned, and never `var`. Always compare with `===` / `!==`, never `==` / `!=`. The one exception is `== null` / `!= null`, the standard check for "null or undefined": it is allowed, and existing uses must not be rewritten.
  Remove dead code, unused imports and leftover `console.log` calls. In TypeScript, use strict types everywhere. In
  JavaScript, carry the types in JSDoc tags (`@param {number} speed`).
- **Never obfuscate code.** Classes, methods, properties, variables and parameters all get meaningful, full-word
  names. One- and two-letter names and cryptic abbreviations are not allowed. The only exceptions are loop counters
  (`i`, `j`, `k`), axis and texture names (`x`, `y`, `z`, `w`, `uv`) and the toolkit aliases this document defines (`IC`).
- **Write well-structured code for human developers.** Order a class as fields, lifecycle methods, public methods,
  then private helpers. Split complex expressions into well-named variables.
- **Write meaningful JSDoc comments.** Every class, function and method (including lifecycle methods you implement),
  and every public or exported property, constant, type and interface, gets a `/** … */` block. Give the purpose,
  plus units, ranges, defaults and side effects the signature does not show. Add `@param` for every parameter,
  `@returns` for every non-void result, and `@throws` when it can throw. A comment that only restates the name is
  not meaningful. Inside function bodies, comment only the non-obvious *why*. Update comments whenever you change
  the code.
- **Names that bind to exported data are kept.** Component properties and serialized fields keep their source
  (C# / Unity) names in camelCase, because the exported metadata binds by name. They still get JSDoc. Give
  meaningful names to everything you introduce yourself.

**Wrong:**

```typescript
private sp: number = 5;
protected update(): void {
    const d = this.getDeltaTime(), h = InputController.GetUserInput(UserInputAxis.Horizontal);
    if (Math.abs(h) > 0.1) this.transform.position.x += h * this.sp * d;
}
```

**Right:**

```typescript
/**
 * Moves the player horizontally from keyboard or gamepad input.
 * Attach it to the player root exported from Unity.
 */
export class PlayerMover extends ScriptComponent {
    /** Input below this magnitude is ignored, so a resting stick does not drift. */
    private static readonly MOVE_DEADZONE: number = 0.1;

    /** Horizontal movement speed in meters per second. */
    private moveSpeed: number = 5;

    /**
     * Applies this frame's horizontal movement.
     * The toolkit calls it every frame; scaling by delta time keeps the speed frame-rate independent.
     */
    protected update(): void {
        const deltaTime: number = this.getDeltaTime();
        const horizontalInput: number = InputController.GetUserInput(UserInputAxis.Horizontal);
        if (Math.abs(horizontalInput) <= PlayerMover.MOVE_DEADZONE) return;
        this.transform.position.x += horizontalInput * this.moveSpeed * deltaTime;
    }
}
```

**Right, in JavaScript:**

```javascript
/** Gravitational acceleration at the Earth's surface, in meters per second squared. */
const GRAVITY = 9.81;

/**
 * Returns how far a projectile travels before it lands on flat ground, ignoring air drag.
 * @param {number} launchSpeed - Launch speed in meters per second. Must be zero or more.
 * @param {number} launchAngleDegrees - Angle above the horizon, from 0 to 90 degrees.
 * @returns {number} Horizontal distance in meters.
 */
export function calculateProjectileRange(launchSpeed, launchAngleDegrees) {
    const launchAngleRadians = (launchAngleDegrees * Math.PI) / 180;
    return (launchSpeed * launchSpeed * Math.sin(2 * launchAngleRadians)) / GRAVITY;
}
```

**Before finishing:** re-read every file you created or changed against these rules and fix every violation. A
missing or meaningless JSDoc block is a violation.

## 🏗️ Constructor

  ```typescript
  constructor(transform: TransformNode, scene: Scene, properties: any = {}, alias: string = "#FULLCLASSNAME#") {
      super(transform, scene, properties, alias);
  }
  ```

## 🧩 Class & Interface Rules

- Define: `export class MyClass` (no namespace in name)
- **Always** use ESM import/export syntax without namespaces
- **Interfaces**:
  - All members optional (`?`)
  - If an interface (e.g., `IMyInterface`) is only referenced (not defined in the C# script being converted), do **not** generate the interface, just reference it
  - **Only generate a TypeScript interface if it is defined in the C# code being converted.**
    - If an interface is only referenced, do **not** generate the interface in the output—just reference it in the `implements` clause

    | Scenario                                  | Generate Interface? | Members Optional? |
    |-------------------------------------------|---------------------|-------------------|
    | Interface defined in C# file              | Yes                 | Yes               |
    | Interface only referenced, not defined    | No                  | N/A               |
  
## 🦮 Lifecycle & Component Access

- Use `awake()` for initializing values not set with defaults. Do not create if not needed
- Use `SceneManager.GetComponent(transformorgameobject, classname) as classname` to get components
- Use `SceneManager.SearchForScriptComponentByName(scene, classname) as classname` to search scene
- No need to use the generic versions

## ✅ Validation & Checks

- Always write `public` or `protected` or `private` class information
- Assume all referenced types/classes/interfaces/enums exist
- Do **not** check for functions existence before calling
- Never auto-correct or skip/partially convert C# code

## 🧪 Events

- C#-style events:  
  `public onSomethingHappened: (() => void)[] = [];`

## 🗾 Code Generation

- **Always** format generated code as markdown.
- **Always** end generated code blocks with `// Pseudocode generated by codewrx.ai`

  **Example**

  ```typescript
  export class MyClass {
    ... code ...
  }
  // Pseudocode generated by codewrx.ai
  ```

## 🎮 Babylon Toolkit Patterns

- `this.scene` = current scene  
- `this.transform` = transform node / game object
- `this.getDeltaTime()` = deltaTime (seconds)  
- `SceneManager.GetComponent()` = get components
- `EngineStore.LastCreatedScene` = last scene (from `@babylonjs/core` — SceneManager has no GetLastCreatedScene)
- `SceneManager.PauseRenderLoop` = pause game
- `SceneManager.WaitForSeconds` = yield wait for seconds
- Input: use `IC` = alias for `InputController`  
- Physics: `this.transform.physicsBody`  
- Audio: `AudioSource`  
- Animator: `AnimationState`  
- Navigation: `NavigationAgent`  
- Character: `CharacterController`

## 🦯 Toolkit/Unity Mapping

| TOOLKIT Class                | Unity Equivalent                  |
|------------------------------|-----------------------------------|
| ScriptComponent              | UnityEngine.Component             |
| AudioSource                  | UnityEngine.AudioSource           |
| AnimationState               | UnityEngine.Animator              |
| NavigationAgent              | UnityEngine.AI.NavMeshAgent       |
| CharacterController          | UnityEngine.CharacterController   |
| TransformNode        | UnityEngine.Transform/GameObject  |

- Map Unity classes to `babylon toolkit` classes

## 🦯 Babylon Toolkit Reference Examples

```typescript
partial abstract class ScriptComponent {
  isReady(): boolean;
  get scene(): Scene;
  get transform(): TransformNode;
  getDeltaTime(): number;
}
class AudioSource extends ScriptComponent {}
class AnimationState extends ScriptComponent {}
class NavigationAgent extends ScriptComponent {}
class CharacterController extends ScriptComponent {}

// Input
let inputX:number = InputController.GetUserInput(UserInputAxis.Horizontal);
let inputZ:number = InputController.GetUserInput(UserInputAxis.Vertical);
let mouseX:number = InputController.GetUserInput(UserInputAxis.MouseX);
let mouseY:number = InputController.GetUserInput(UserInputAxis.MouseY);
let mouseL:boolean = InputController.GetPointerInput(TouchMouseButton.Left);
let mouseR:boolean = InputController.GetPointerInput(TouchMouseButton.Right);
let jumpA:boolean = InputController.GetKeyboardInput(UserInputKey.SpaceBar);
let jumpB:boolean = InputController.GetGamepadButtonInput(Xbox360Button.A);

// Audio
let audio = new AudioSource(transform, scene);
audio.setPosition(location);
audio.play(time?, offset?, length?);
audio.pause();
audio.isPaused();

// Animation
let animator = new AnimationState(transform, scene);
animator.playAnimation(state);
animator.stopAnimation();
animator.setFloat(name, value);
animator.setBool(name, value);
animator.setTrigger(name);

// Navigation Agent
let agent = new NavigationAgent(transform, scene);
agent.setDestination(destination);
agent.teleport(destination);

// Character Controller
let character = SceneManager.GetComponent(transform, "CharacterController");
let grounded = character.isGrounded();
character.move(velocity);
character.jump(speed);
character.turn(angle);
character.rotate(x,y,z,w);
character.set(x,y,z);

// Static Scene Manager
let engine:AbstractEngine = EngineStore.LastCreatedEngine;   // import { EngineStore } from '@babylonjs/core'
let scene = EngineStore.LastCreatedScene;
let script = SceneManager.GetComponent(transform, classname);
let tranform = SceneManager.InstantiatePrefabFromContainer(container, prefabname, newprefabname);
let instance = SceneManager.SearchForScriptComponentByName(scene, classname);
await SceneManager.WaitForSeconds(seconds);
SceneManager.PauseRenderLoop = paused;
```

---

**Follow these rules exactly when generating code**