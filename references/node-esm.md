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

- **Write clean TypeScript.** Use strict types everywhere. Keep functions small with a single job. Prefer early
  returns over deep nesting. Use named constants, not magic numbers. Remove dead code, unused imports and leftover
  `console.log` calls.
- **Never obfuscate code.** Classes, methods, properties, variables and parameters all get meaningful, full-word
  names. One- and two-letter names and cryptic abbreviations are not allowed. The only exceptions are loop counters
  (`i`, `j`, `k`), axis and texture names (`x`, `y`, `z`, `w`, `uv`) and the toolkit aliases this document defines
  (`IC`).
- **Write readable, maintainable code for human developers.** Order a class as fields, lifecycle methods, public
  methods, then private helpers. Split complex expressions into well-named variables. Comment the *why* where it is
  not obvious. Do not comment what the code already says.
- **Names that bind to exported data are kept.** Component properties and serialized fields keep their source
  (C# / Unity) names in camelCase, because the exported metadata binds by name. Give meaningful names to everything
  you introduce yourself.

**Wrong:**

```typescript
private sp: number = 5;
private v: Vector3 = new Vector3();
protected update(): void {
    const d = this.getDeltaTime(), h = InputController.GetUserInput(UserInputAxis.Horizontal);
    this.v.x = h * this.sp * d; if (this.v.x > 0.1) this.transform.position.addInPlace(this.v);
}
```

**Right:**

```typescript
export class PlayerMover extends ScriptComponent {
    private static readonly MOVE_DEADZONE: number = 0.1;
    private moveSpeed: number = 5;
    private readonly frameMovement: Vector3 = new Vector3();

    protected update(): void {
        const deltaTime: number = this.getDeltaTime();
        const horizontalInput: number = InputController.GetUserInput(UserInputAxis.Horizontal);
        this.frameMovement.x = horizontalInput * this.moveSpeed * deltaTime;
        if (this.frameMovement.x <= PlayerMover.MOVE_DEADZONE) return;
        this.transform.position.addInPlace(this.frameMovement);
    }
}
```

**Before finishing:** re-read every file you created or changed against these rules and fix every violation.

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