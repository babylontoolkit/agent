# Babylon Toolkit React Framework — Agentic AI Game Builder Reference

**IMPORTANT. THIS DOCUMENT PROVIDES CRUCIAL REACT FRAMEWORK TRAINING REFERENCES. ALWAYS READ THIS ENTIRE DOCUMENT TO THE END OF FILE**

> **Version:** 1.0.0  
> **Namespace:** `BABYLON` (BabylonJS UMD) · `TOOLKIT` (Babylon Toolkit UMD) · `PROJECT` (Starter Content UMD)  
> **Submodule:** `https://github.com/babylontoolkit/ReactFramework.git` → `src`  
> **Component Reference:** `https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/README.md`  
> **Purpose:** Complete architectural guide for AI agents building AAA web game experiences from design to publishing.

---

## Table of Contents

1. [Framework Architecture Overview](#1-framework-architecture-overview)
2. [Component Hierarchy](#2-component-hierarchy)
3. [SceneController — The Heart of Every Scene](#3-SceneController--the-heart-of-every-scene)
4. [BabylonSceneViewer — Embedded Div vs Full Page](#4-babylonsceneviewer--embedded-div-vs-full-page)
5. [Navigation System — Scene-to-Scene Routing](#5-navigation-system--scene-to-scene-routing)
6. [GameManager — Global Services](#6-gamemanager--global-services)
7. [Custom Overlay Div — Game UI Layer](#7-custom-overlay-div--game-ui-layer)
8. [HUD Design — DOM HUDs vs GPU HUDs](#8-hud-design--dom-huds-vs-gpu-huds)
9. [Interactive Scene Content — S3 / CDN Assets](#9-interactive-scene-content--s3--cdn-assets)
10. [Splash Screen and Loading Progress](#10-splash-screen-and-loading-progress)
11. [Pre-Built Game Mode Examples](#11-pre-built-game-mode-examples)
12. [Building a Complete Multi-Scene Game](#12-building-a-complete-multi-scene-game)
13. [Project Setup and Configuration](#13-project-setup-and-configuration)
14. [Platform Adapters — React Router, Next.js, TanStack](#14-platform-adapters--react-router-nextjs-tanstack)
15. [Quick-Reference Card](#15-quick-reference-card)

---

## 1. Framework Architecture Overview

The Babylon Toolkit React Framework is a **ES6** submodule that bridges React's component model with the Babylon Toolkit game runtime. It provides a clean, reusable 3D viewer that works inside any div on a page or as a full-screen interactive experience.

```
Host React App (Vite / Next.js / Remix)
│
├── NavigationAdapter              ← wires host router to GameManager.NavigateTo
│   └── NavigationProvider         ← React context for cross-platform routing
│
└── <BabylonMount>                 ← Suspense boundary + lazy loads everything below
        └── <BabylonSceneViewer>   ← Props: fullPage, gameMode, sceneUrl, scriptUrl
            │
            ├── <SplashScreen />   ← Animated loading overlay (z-index 9999)
            ├── <BaseSceneViewer> → <canvas />   ← WebGPU→WebGL engine + render loop
            └── <CustomOverlay /> (optional)     ← Game UI layer (z-index 1002)
```

### Key Mental Models

| Concept | Description |
|---------|-------------|
| **SceneController** | The single entry point for ALL scene logic. Every viewer instance gets exactly one game mode. |
| **`createScene()`** | The async function called by the framework when it's time to set up game content. Works like the BabylonJS Playground. |
| **Interactive Scene Content** | Pre-built GLTF scenes, car models, player armatures, and prefabs hosted on S3/CDN. The game mode activates and controls them. |
| **Script Bundle** | A JavaScript file (e.g. `default.playground.js`) loaded at runtime that registers pre-built components like `ThirdPersonPlayerController` onto the `PROJECT` namespace. |
| **`TOOLKIT.SceneManager`** | Static singleton that initializes the runtime, parses metadata, manages component lifecycles, and provides utilities. |

### UMD Global Namespaces

```typescript
// Always available after GameManager.InitializeRuntime() is called
BABYLON   // Full BabylonJS API
TOOLKIT   // Babylon Toolkit API — SceneManager, SceneController, etc.
PROJECT   // Script bundle exports — ThirdPersonPlayerController, VehicleController, etc.
```

---

## 2. Component Hierarchy

```
src/babylon/
├── mount.tsx               ← BabylonMount — top-level entry; use this in host apps
├── globals.ts              ← GameManager class + StorageType enum
├── globals.d.ts            ← TypeScript ambient types for BABYLON / TOOLKIT / PROJECT
│
├── system/
│   ├── babylon.tsx         ← BabylonSceneViewer — the 3D viewer React component
│   ├── viewer.tsx          ← BaseSceneViewer — raw canvas + engine + render loop
│   ├── platform.tsx        ← NavigationProvider, useUnifiedNavigation, INavigationState
│   └── babylon.css         ← .page-viewer / .div-viewer / .canvas styles
│
├── custom/
│   ├── loading.tsx         ← DefaultBabylonPreloader (Suspense fallback)
│   ├── splash.tsx          ← SplashScreen (animated loading screen)
│   ├── splash.css          ← Splash animation (spin, purple background)
│   ├── overlay.tsx         ← CustomOverlay — game UI layer (CUSTOMIZE THIS)
│   └── overlay.css         ← Overlay CSS (pointer-events: none by default)
│
├── classes/
│   ├── DefaultGameMode.ts      ← Empty skeleton — all lifecycle hooks
│   ├── FreeCameraMode.ts       ← Free-fly camera with keyboard/mouse control
│   ├── PlayerControllerDemo.ts ← Third-person player with armature prefab
│   ├── VehicleControllerDemo.ts← Vehicle scene skeleton
│   └── PlaygroundDemoScene.ts  ← Playground-style scene (sphere + ground)
│
└── assets/
    ├── babylon.png         ← Logo shown during loading (copy to public/)
    └── spinner.png         ← Spinner shown during loading (copy to public/)
```

The `custom` folder allows easy customization of the `preloader`, `splash` and the master game view `overlay` user interface systems.

---

## 3. SceneController — The Heart of Every Scene

### What Is It?

`TOOLKIT.SceneController` is a `TOOLKIT.ScriptComponent` subclass that acts as the **master controller for a scene**. The framework instantiates exactly one per viewer, attaches it to a `TransformNode` named `"GameMode"`, and calls its lifecycle methods automatically.

**Think of it as: the BabylonJS Playground `createScene` function — but as a class with a full game lifecycle.**

### Lifecycle Methods

```typescript
export class MyGameMode extends TOOLKIT.SceneController {
    constructor(transform: BABYLON.TransformNode, scene: BABYLON.Scene, properties: any = {}, alias: string = "MyGameMode") {
        super(transform, scene, properties, alias);
        // Optional: override splash hide delay in milliseconds
        this.hideSplashScreenDelayMs = 3000;
    }

    // ── Initialization ────────────────────────────────────────────────────────
    protected awake(): void {
        // Called first, before start(). Use for component initialization.
        // this.scene, this.transform are available.
    }

    protected start(): void {
        // Called the frame after awake(). Use for cross-component wiring.
    }

    protected ready(): void {
        // Called ~100ms after start(). Safe for final cross-component setup.
    }

    // ── Per-Frame ─────────────────────────────────────────────────────────────
    protected update(): void {
        // Called every render frame BEFORE the scene renders.
        // Core gameplay logic goes here.
    }

    protected late(): void {
        // Called every frame, after update(), before render targets.
        // Good for camera follow logic (apply after character moves).
    }

    protected after(): void {
        // Called every frame AFTER the scene renders.
    }

    // ── Physics ───────────────────────────────────────────────────────────────
    protected step(): void {
        // Called BEFORE each physics step. Remove if unused (saves CPU).
    }

    protected fixed(): void {
        // Called AFTER each physics step. Remove if unused (saves CPU).
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────
    protected reset(): void {
        // Called on scene reset. Re-initialize state here.
    }

    protected destroy(): void {
        // Called on dispose. Clean up timers, observers, event listeners.
    }

    // ── THE MAIN ENTRY POINT ──────────────────────────────────────────────────
    protected async createScene(data?: any): Promise<void> {
        // Called by the framework AFTER the base scene (sceneUrl) is loaded.
        // `data` = auxiliaryData passed from navigation state.
        // Build your game content here.
    }
}

// REQUIRED: Register so the framework can instantiate by name string
TOOLKIT.SceneManager.RegisterClass("MyGameMode", MyGameMode);
```

### When `createScene` Is Called

```
Framework flow:
1. Engine + Scene created (WebGPU → WebGL fallback)
2. GameManager.InitializeRuntime() — loads TOOLKIT, physics, script bundle
3. SceneController instantiated + attached (BEFORE scene load)
4. If sceneUrl provided: BABYLON.ImportMeshAsync() loads the GLTF
5. ► gameMode.createScene(auxiliaryData) called  ◄  ← YOUR CODE HERE
6. Splash screen hidden (after hideSplashScreenDelayMs)
```

### Accessing Scene and Helpers

Inside any `SceneController` method:

```typescript
this.scene          // BABYLON.Scene
this.transform      // BABYLON.TransformNode ("GameMode" node)
this.engine         // BABYLON.AbstractEngine  (via this.scene.getEngine())
this.scene.getEngine().getRenderingCanvas()  // HTMLCanvasElement
```

---

## 4. BabylonSceneViewer — Embedded Div vs Full Page

`BabylonSceneViewer` is the core React component. It accepts props that control rendering mode and scene content.

### Props Reference

```typescript
type SceneViewerProps = {
    fullPage?: boolean;         // true = fills viewport (position:absolute); false = fills parent div (position:relative)
    gameMode?: string;          // Class name string registered via TOOLKIT.SceneManager.RegisterClass()
    sceneUrl?: string;          // Full URL to the GLTF/GLB base scene. Use "_blank" or omit for code-only scenes.
    scriptUrl?: string;         // URL to the script bundle JS file (e.g. default.playground.js)
    auxiliaryData?: any;        // Arbitrary data passed to createScene(data)
    allowQueryParams?: boolean; // If true, reads gameMode/sceneUrl/scriptUrl from navigation state
    enableCustomOverlay?: boolean; // If true, renders <CustomOverlay /> on top of the canvas
};
```

### Layout Mode 1: Full Page (default)

The viewer fills 100% of the viewport. Use this for dedicated game routes.

```tsx
// In your /play route component:
<BabylonSceneViewer
    fullPage={true}
    gameMode="RacingGameMode"
    sceneUrl="https://cdn.mygame.com/levels/level1.gltf"
    allowQueryParams={true}
    enableCustomOverlay={true}
/>
```

CSS applied: `.page-viewer` — `position: absolute; inset: 0;`

### Layout Mode 2: Embedded Div

The viewer fills its parent container. Use this for 3D content embedded in a regular web page (e.g., a product viewer, map, mini-game in a sidebar).

```tsx
// Embedded in a page layout:
<div style={{ width: "800px", height: "500px", position: "relative" }}>
    <BabylonSceneViewer
        fullPage={false}
        gameMode="ShowroomMode"
        sceneUrl="https://cdn.mygame.com/showroom/car.gltf"
        enableCustomOverlay={true}
    />
</div>
```

CSS applied: `.div-viewer` — `position: relative; width: 100%; height: 100%;`

### BabylonMount — The Safe Entry Point

Always use `BabylonMount` from `mount.tsx` as the top-level import in host apps. It:
- Lazy-loads the entire Babylon stack (engine, runtime) only in the browser
- Provides a Suspense boundary with `DefaultBabylonPreloader`
- Prevents SSR issues in Next.js, Remix, etc.

```tsx
// In a Next.js page (dynamic import with ssr: false):
const GameViewer = dynamic(() => import('@/src/babylon/mount'), { ssr: false });

// In a React SPA route:
import BabylonMount from './babylon/mount';

<BabylonMount
    fullPage={true}
    allowQueryParams={true}
    enableCustomOverlay={true}
/>
```

### Blank Scene Mode

Set `sceneUrl` to `"_blank"` (or omit entirely) to skip GLTF loading. The game mode's `createScene()` runs immediately — build everything programmatically.

```typescript
protected async createScene(data?: any): Promise<void> {
    // No GLTF loaded — build the scene entirely in code
    const camera = new BABYLON.FreeCamera("cam", new BABYLON.Vector3(0,5,-10), this.scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(this.scene.getEngine().getRenderingCanvas(), true);
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0,1,0), this.scene);
    // ... build level geometry, load prefabs, etc.
}
```

---

## 5. Navigation System — Scene-to-Scene Routing

### Navigation State Shape

All navigation between scenes passes through a typed state object:

```typescript
interface INavigationState {
    gameMode?: string;       // Game mode class name (registered string)
    sceneUrl?: string;       // GLTF URL for the destination scene
    scriptUrl?: string;      // Script bundle URL (reuse same bundle across scenes)
    auxiliaryData?: any;     // Level config, difficulty, player data, etc.
}
```

### Navigating from React UI (home screen, menus)

**Use `useUnifiedNavigation` — do NOT import GameManager in React UI components** (it would pull in the heavy Babylon runtime and bloat the initial bundle). `useUnifiedNavigation` supports the sessionStorage fallback required for cross-platform routing.

```tsx
// src/screens/HomeScreen.tsx
import { useUnifiedNavigation } from "../babylon/system/platform";

function HomeScreen() {
    const { navigate } = useUnifiedNavigation();

    const handlePlayLevel1 = () => {
        navigate('/play', {
            gameMode: 'RacingGameMode',
            sceneUrl: 'https://cdn.mygame.com/levels/raceway.gltf',
            auxiliaryData: { difficulty: 'hard', lap: 1 }
        });
    };

    const handlePlayLevel2 = () => {
        navigate('/play', {
            gameMode: 'CombatGameMode',
            sceneUrl: 'https://cdn.mygame.com/levels/arena.gltf',
        });
    };

    return (
        <div>
            <button onClick={handlePlayLevel1}>Start Race</button>
            <button onClick={handlePlayLevel2}>Enter Arena</button>
        </div>
    );
}
```

### Navigating from Game Code (in-scene, mid-gameplay)

Inside any `SceneController` or `ScriptComponent`, use `GameManager.NavigateTo`:

```typescript
import GameManager from "../globals";

// Navigate to the next level after winning:
GameManager.NavigateTo('/play', {
    gameMode: 'Level2GameMode',
    sceneUrl: 'https://cdn.mygame.com/levels/level2.gltf',
    auxiliaryData: { score: this.currentScore, lives: this.livesRemaining }
});

// Navigate back to the main menu:
GameManager.NavigateTo('/');

// Navigate to a game-over screen:
GameManager.NavigateTo('/gameover', {
    auxiliaryData: { finalScore: this.currentScore }
});
```

### Multi-Scene Game Flow Pattern

```
/ (Home)
│  ├─ [Play Button] → navigate('/play', { gameMode: 'MainMenuMode' })
│
/play (BabylonSceneViewer)
│  ├─ MainMenuMode.createScene()  → 3D main menu world
│  │    └─ GameManager.NavigateTo('/play', { gameMode: 'Level1Mode', sceneUrl: 'level1.gltf' })
│  │
│  ├─ Level1Mode.createScene()    → racing level 1
│  │    └─ on win: GameManager.NavigateTo('/play', { gameMode: 'Level2Mode', sceneUrl: 'level2.gltf', auxiliaryData: { score } })
│  │    └─ on lose: GameManager.NavigateTo('/play', { gameMode: 'GameOverMode' })
│  │
│  ├─ Level2Mode.createScene()    → racing level 2
│  └─ GameOverMode.createScene()  → game over screen with score + retry
│       └─ GameManager.NavigateTo('/')  → back to React home
```

---

## 6. GameManager — Global Services

`GameManager` is the static singleton bridge between React and the game runtime. Defined in `globals.ts`.

### Key Static API

```typescript
import GameManager from '../babylon/globals';
import { StorageType } from '../babylon/globals';

// ── Runtime ───────────────────────────────────────────────────────────────────
GameManager.InitializeRuntime(scene, scriptBundleUrl, enablePhysics?, showLoadingScreen?, hideEngineLoadingUI?)
// Called automatically by BabylonSceneViewer — do NOT call manually.

// ── Navigation ────────────────────────────────────────────────────────────────
GameManager.NavigateTo('/play', { gameMode: 'MyMode', sceneUrl: '...', auxiliaryData: {} });
GameManager.HasReactNavigationHook()   // → boolean
GameManager.SetReactNavigationHook(fn) // Set by NavigationAdapter automatically
GameManager.DeleteReactNavigationHook()

// ── Global Game State ─────────────────────────────────────────────────────────
GameManager.GlobalState                         // Get live state object (any)
GameManager.GlobalState.playerScore = 500;      // Set arbitrary key/value
GameManager.SaveGameState(StorageType.Local);   // Persist to localStorage
GameManager.LoadGameState(StorageType.Local);   // Restore from localStorage
GameManager.SaveGameState(StorageType.Session); // Persist to sessionStorage
GameManager.ResetGameState();                   // Clear all state

// ── Event Bus (cross-component messaging) ─────────────────────────────────────
GameManager.EventBus.OnMessage("player:scored", (data: { points: number }) => {
    console.log("Score:", data.points);
});
GameManager.EventBus.PostMessage("player:scored", { points: 100 });
GameManager.EventBus.RemoveHandler("player:scored", handlerRef);

// ── Loading Progress ──────────────────────────────────────────────────────────
GameManager.PostProgressStatus("Spawning enemies ...");  // Updates splash screen text

// ── URLs and Environment ──────────────────────────────────────────────────────
GameManager.PlaygroundRepo      // "https://repo.babylontoolkit.com/playground/"
GameManager.HavokEngineUrl      // "scripts/havok.js" (overrideable)
GameManager.IsDevelopmentMode   // true if NODE_ENV === "development"
```

### Global State Pattern for Level Transitions

```typescript
// In Level1Mode — save progress before navigating
protected async createScene(): Promise<void> {
    this.score = 0;
    // ... gameplay ...
}

// When player wins:
private onLevelComplete(): void {
    GameManager.GlobalState.level1Score = this.score;
    GameManager.GlobalState.level1Completed = true;
    GameManager.SaveGameState(StorageType.Local); // Survive page refresh
    GameManager.NavigateTo('/play', {
        gameMode: 'Level2Mode',
        sceneUrl: 'https://cdn.mygame.com/levels/level2.gltf',
        auxiliaryData: { previousScore: this.score }
    });
}
```

### Event Bus Pattern for React ↔ Game Communication

The `EventBus` bridges game code and React UI components:

```typescript
// From game code (SceneController):
GameManager.EventBus.PostMessage("hud:updateScore", { score: 1500, multiplier: 2 });
GameManager.EventBus.PostMessage("hud:showMessage", { text: "SPEED BOOST!", duration: 2 });

// From React overlay (CustomOverlay.tsx):
useEffect(() => {
    const handler = (data: { score: number, multiplier: number }) => {
        setScore(data.score);
        setMultiplier(data.multiplier);
    };
    GameManager.EventBus.OnMessage("hud:updateScore", handler);
    return () => GameManager.EventBus.RemoveHandler("hud:updateScore", handler);
}, []);
```

---

## 7. Custom Overlay Div — Game UI Layer

The `CustomOverlay` component renders an absolutely-positioned `<div>` on top of the canvas. It's the **primary container for DOM-based Game UI**: HUDs, pause menus, win/lose screens, dialogue boxes, minimap, etc.

### Enabling the Overlay

```tsx
<BabylonSceneViewer
    fullPage={true}
    allowQueryParams={true}
    enableCustomOverlay={true}   // ← enables <CustomOverlay />
/>
```

### CSS z-index Stack

```
z-index 9999   SplashScreen    ← shown during loading, hidden after
z-index 1002   CustomOverlay   ← Game UI, HUD, menus
z-index 1001   Canvas          ← WebGPU/WebGL render surface
z-index 1000   page-viewer / div-viewer container
```

### Customizing the Overlay (custom/overlay.tsx)

Replace the placeholder content with actual game UI:

```tsx
'use client';

import { useState, useEffect, useCallback } from "react";
import { useUnifiedNavigation } from "../system/platform";
import GameManager from "../globals";
import "./overlay.css";

function CustomOverlay() {
    const { navigate } = useUnifiedNavigation();
    const [score, setScore] = useState(0);
    const [speed, setSpeed] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [showPauseMenu, setShowPauseMenu] = useState(false);

    // Listen for game events from the SceneController
    useEffect(() => {
        const onScore = (data: { score: number }) => setScore(data.score);
        const onSpeed = (data: { speed: number }) => setSpeed(data.speed);
        const onPause = (data: { paused: boolean }) => {
            setIsPaused(data.paused);
            setShowPauseMenu(data.paused);
        };

        GameManager.EventBus.OnMessage("hud:score", onScore);
        GameManager.EventBus.OnMessage("hud:speed", onSpeed);
        GameManager.EventBus.OnMessage("game:pause", onPause);

        return () => {
            GameManager.EventBus.RemoveHandler("hud:score", onScore);
            GameManager.EventBus.RemoveHandler("hud:speed", onSpeed);
            GameManager.EventBus.RemoveHandler("game:pause", onPause);
        };
    }, []);

    const handleResume = useCallback(() => {
        GameManager.EventBus.PostMessage("game:resume", {});
        setShowPauseMenu(false);
    }, []);

    const handleQuit = useCallback(() => {
        navigate('/');  // ← use native navigate (not GameManager) in React UI
    }, [navigate]);

    return (
        <div className="overlay" style={{ pointerEvents: showPauseMenu ? "auto" : "none" }}>
            {/* HUD Layer (always visible during play) */}
            {!showPauseMenu && (
                <div className="hud">
                    <div className="hud-score">Score: {score}</div>
                    <div className="hud-speed">{Math.round(speed)} km/h</div>
                    <button
                        style={{ pointerEvents: "auto" }}
                        onClick={() => GameManager.EventBus.PostMessage("game:pause", { paused: true })}
                    >
                        ❚❚
                    </button>
                </div>
            )}

            {/* Pause Menu */}
            {showPauseMenu && (
                <div className="pause-menu">
                    <h2>PAUSED</h2>
                    <button onClick={handleResume}>Resume</button>
                    <button onClick={handleQuit}>Quit to Menu</button>
                </div>
            )}
        </div>
    );
}

export default CustomOverlay;
```

### Critical: pointer-events

The overlay div has `pointer-events: none` by default so mouse/touch events pass through to the canvas. **Only set `pointer-events: auto` on interactive UI elements** (buttons, menus) that need to capture input.

---

## 8. HUD Design — DOM HUDs vs GPU HUDs

### DOM HUDs (React / HTML/CSS)

Best for: scores, speedometers, health bars, minimaps, popup menus, chat, inventory, text overlays.

- Live inside `CustomOverlay`
- Driven by `GameManager.EventBus` messages from game code
- React state (`useState`) rerenders only the changed elements
- Zero GPU cost for the canvas render loop

```typescript
// In SceneController — post HUD data each frame or on change:
protected update(): void {
    const speed = this.vehicleController?.currentSpeed ?? 0;
    if (Math.abs(speed - this._lastSpeed) > 0.5) {
        GameManager.EventBus.PostMessage("hud:speed", { speed });
        this._lastSpeed = speed;
    }
}
```

### GPU HUDs (BabylonJS GUI — `babylonjs-gui`)

Best for: 3D-anchored labels (enemy health bars above characters), world-space markers, GPU-rendered minimaps, cockpit displays rendered in-scene.

The `babylonjs-gui` package is loaded as a side effect in `globals.ts` and is available globally.

```typescript
// In createScene() — AdvancedDynamicTexture for fullscreen GUI:
protected async createScene(): Promise<void> {
    // Fullscreen GUI (2D overlay rendered by GPU, not DOM)
    const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("GameHUD", true, this.scene);

    const scoreText = new BABYLON.GUI.TextBlock("scoreText");
    scoreText.text = "Score: 0";
    scoreText.color = "white";
    scoreText.fontSize = 24;
    scoreText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    scoreText.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    scoreText.paddingTop = "20px";
    scoreText.paddingLeft = "20px";
    advancedTexture.addControl(scoreText);

    // Update from game events:
    GameManager.EventBus.OnMessage("hud:score", (data: { score: number }) => {
        scoreText.text = `Score: ${data.score}`;
    });

    // World-space GUI anchored to a mesh (e.g., enemy health bar):
    const enemyLabel = new BABYLON.GUI.Rectangle("enemyHealth");
    enemyLabel.width = "200px";
    enemyLabel.height = "20px";
    enemyLabel.cornerRadius = 5;
    enemyLabel.color = "red";
    advancedTexture.addControl(enemyLabel);
    advancedTexture.moveTo(enemyLabel, enemyMesh, new BABYLON.Vector3(0, 2.5, 0));
}
```

### Choosing Between DOM and GPU HUDs

| Feature | DOM HUD (React) | GPU HUD (BabylonJS GUI) |
|---------|-----------------|------------------------|
| Performance | ✅ Zero GPU cost | ⚠️ Extra draw calls |
| Styling | ✅ Full CSS / Tailwind | ❌ Limited built-in styles |
| Animation | ✅ CSS transitions | ✅ BabylonJS animations |
| 3D world anchoring | ❌ Not native | ✅ Attach to 3D mesh |
| Font rendering | ✅ Browser native | ⚠️ Canvas text |
| Input handling | ✅ Native events | ✅ BabylonJS pointer events |
| **Best for** | Menus, scores, maps | Enemy bars, cockpits |

---

## 9. Interactive Scene Content — S3 / CDN Assets

### What Is Interactive Scene Content?

Pre-built, rigged, and fully-configured 3D scenes exported from Unity using the Babylon Toolkit exporter. The GLTF files contain embedded `CVTOOLS_unity_metadata` extras that the Babylon Toolkit runtime parses to re-hydrate script components, animations, physics, and navigation.

Examples:
- A racing track with pre-placed vehicle spawn points, checkpoints, and camera rails
- A rigged car model with `RaycastVehicle` physics and car controller already configured
- A player armature with `ThirdPersonPlayerController` component
- An arena level with AI navigation meshes, enemy spawn data, and colliders

### Asset URL Patterns

```typescript
// Playground repository (official demo assets)
const repo = GameManager.PlaygroundRepo; // "https://repo.babylontoolkit.com/playground/"

// Your own CDN / S3 bucket
const cdn = "https://cdn.mygame.com/";
const s3  = "https://my-bucket.s3.us-east-1.amazonaws.com/game/";

// Scene URL format: rootPath + fileName
const sceneUrl = "https://cdn.mygame.com/levels/raceway.gltf";
// rootPath → "https://cdn.mygame.com/levels/"
// fileName → "raceway.gltf"
```

### Loading the Base Scene (Automatic)

Pass `sceneUrl` as a prop or via navigation state. The framework handles the load automatically before calling `createScene()`:

```tsx
<BabylonSceneViewer
    sceneUrl="https://cdn.mygame.com/levels/raceway.gltf"
    gameMode="RacingGameMode"
/>
```

### Loading Additional Prefabs in createScene()

Use `BABYLON.AssetsManager` + `TOOLKIT.SceneManager.LoadRuntimeAssets` to load additional GLTF prefabs **after** the base scene. This registers their script components and starts their lifecycles.

```typescript
protected async createScene(data?: any): Promise<void> {
    const repo = GameManager.PlaygroundRepo;
    const assetsManager = new BABYLON.AssetsManager(this.scene);

    // Queue additional prefabs to load
    assetsManager.addMeshTask("playerArmature", null, repo, "playerarmature.gltf");
    assetsManager.addMeshTask("enemyA",          null, repo, "enemy_grunt.gltf");

    // LoadRuntimeAssets: loads + parses metadata + starts component lifecycles
    await TOOLKIT.SceneManager.LoadRuntimeAssets(assetsManager, ["playerarmature.gltf", "enemy_grunt.gltf"], () => {
        // Setup callback — called once all assets are parsed and components are running
        const player = this.scene.getNodeByName("PlayerArmature") as BABYLON.TransformNode;
        const controller = new PROJECT.ThirdPersonPlayerController(player, this.scene, {
            arrowKeyRotation: true,
            smoothMotionSpeed: true,
            smoothChangeRate: 25.0
        });
        controller.enableInput = true;
        controller.attachCamera = true;
        controller.moveSpeed = 5.335;
        controller.walkSpeed = 2.0;
        controller.jumpSpeed = 12.0;
    });
}
```

### Loading a Rigged Car with Built-In Controller

The Babylon Toolkit ships an AAA-quality car controller in the script bundle. A rigged car GLTF (e.g., `sportscar.gltf`) already contains wheel node naming conventions that the vehicle controller understands.

```typescript
protected async createScene(data?: any): Promise<void> {
    GameManager.PostProgressStatus("Loading Vehicle ...");

    // The base scene (sceneUrl) might already contain the track.
    // Load the car prefab on top:
    const assetsManager = new BABYLON.AssetsManager(this.scene);
    assetsManager.addMeshTask("car", null, "https://cdn.mygame.com/vehicles/", "sportscar.gltf");

    await TOOLKIT.SceneManager.LoadRuntimeAssets(assetsManager, ["sportscar.gltf"], () => {
        const carNode = this.scene.getNodeByName("SportsCar") as BABYLON.TransformNode;
        if (carNode == null) return;

        // PROJECT.VehicleController is from the script bundle (default.playground.js)
        const vehicle = new PROJECT.VehicleController(carNode, this.scene, {
            topSpeed: 250,           // km/h
            acceleration: 0.85,
            brakeForce: 0.95,
            steeringSensitivity: 0.8,
            antiRollBar: 0.5,
            enableDrift: true,
            cameraMode: "chase",
        });
        vehicle.enableInput = true;

        // Post initial HUD state
        GameManager.EventBus.PostMessage("hud:speed", { speed: 0 });
    });
}
```

---

## 10. Splash Screen and Loading Progress

### Loading Flow

```
Scene starts loading
    │
    ├── SplashScreen visible (z-index 9999, purple background)
    ├── TOOLKIT.SceneManager.ShowSplashScreen()
    │
    ├── GameManager.InitializeRuntime()
    │     ├── Events: "OnLoadProgress" → { message: "Loading Scene ..." }
    │     └── Events: "OnLoadProgress" → { message: "Loading Scene 42%" }
    │
    ├── BABYLON.ImportMeshAsync (base scene) — progress events posted
    │
    ├── createScene() called
    │     └── GameManager.PostProgressStatus("Loading Player ...") — custom messages
    │
    └── TOOLKIT.SceneManager.HideSplashScreen() — after hideSplashScreenDelayMs
```

### Customizing Loading Messages

```typescript
protected async createScene(data?: any): Promise<void> {
    GameManager.PostProgressStatus("Preparing game world ...");
    await loadStep1();

    GameManager.PostProgressStatus("Spawning enemies ...");
    await loadStep2();

    GameManager.PostProgressStatus("Starting game ...");
    // Splash hides automatically after hideSplashScreenDelayMs (default 3000ms)
}
```

### Splash Screen Delay

```typescript
constructor(transform: BABYLON.TransformNode, scene: BABYLON.Scene, properties: any = {}) {
    super(transform, scene, properties);
    this.hideSplashScreenDelayMs = 1500; // Shorten or lengthen the splash display
}
```

### Custom Splash Screen

Replace `custom/splash.tsx` with a branded version. The component subscribes to `GameManager.EventBus.OnMessage("OnLoadProgress", ...)` automatically.

---

## 11. Pre-Built Game Mode Examples

### DefaultGameMode — Empty Skeleton

The fallback if no `gameMode` prop is provided. Use as a starting template for any new game mode.

```typescript
// classes/DefaultGameMode.ts
export class DefaultGameMode extends TOOLKIT.SceneController {
    constructor(transform: BABYLON.TransformNode, scene: BABYLON.Scene, properties: any = {}) {
        super(transform, scene, properties);
    }

    protected async createScene(data?: any): Promise<void> {
        /* Your game here */
    }
}
TOOLKIT.SceneManager.RegisterClass("DefaultGameMode", DefaultGameMode);
```

### FreeCameraMode — Free-fly Debug Camera

Instantly navigable free camera — ideal for prototyping and scene inspection.

```typescript
export class FreeCameraMode extends TOOLKIT.SceneController {
    private camera: BABYLON.FreeCamera | null = null;

    protected async createScene(data?: any): Promise<void> {
        this.camera = new BABYLON.FreeCamera("FreeCamera", new BABYLON.Vector3(0, 5, -10), this.scene);
        const canvas = this.scene.getEngine().getRenderingCanvas();
        if (canvas) this.camera.attachControl(canvas, true);
    }

    protected destroy(): void {
        this.camera?.dispose();
        this.camera = null;
    }
}
TOOLKIT.SceneManager.RegisterClass("FreeCameraMode", FreeCameraMode);
```

### PlayerControllerDemo — Third-Person Character

Loads a rigged player armature and wires up `PROJECT.ThirdPersonPlayerController`.

```typescript
export class PlayerControllerDemo extends TOOLKIT.SceneController {
    protected async createScene(data?: any): Promise<void> {
        GameManager.PostProgressStatus("Loading Player Armature ...");
        const assetsManager = new BABYLON.AssetsManager(this.scene);
        assetsManager.addMeshTask("playerarmature", null, GameManager.PlaygroundRepo, "playerarmature.gltf");
        await TOOLKIT.SceneManager.LoadRuntimeAssets(assetsManager, ["playerarmature.gltf"], () => {
            const player = this.scene.getNodeByName("PlayerArmature") as BABYLON.TransformNode;
            if (player != null) {
                const controller = new PROJECT.ThirdPersonPlayerController(player, this.scene, {
                    arrowKeyRotation: true,
                    smoothMotionSpeed: true,
                    smoothChangeRate: 25.0
                });
                controller.enableInput = true;
                controller.attachCamera = true;
                controller.moveSpeed = 5.335;
                controller.walkSpeed = 2.0;
                controller.jumpSpeed = 12.0;
            }
        });
    }
}
TOOLKIT.SceneManager.RegisterClass("PlayerControllerDemo", PlayerControllerDemo);
```

### VehicleControllerDemo / PlaygroundDemoScene — Blank Canvas

Both are playground-style starters that build a minimal BabylonJS scene (sphere + ground + light + camera) entirely in code — good templates for procedural scene generation.

---

## 12. Building a Complete Multi-Scene Game

### Design Pattern: Game Architecture

```
Game Root (React)
├── / → HomeScreen (React UI — NO Babylon imports)
│         └── Play button → navigate('/play', state)
│
├── /play → BabylonSceneViewer (allowQueryParams: true)
│    │         ↕ all game modes share this single route
│    │
│    ├── MainMenuGameMode      (sceneUrl: "mainmenu.gltf"    or "_blank")
│    ├── Level1GameMode        (sceneUrl: "level1_track.gltf")
│    ├── Level2GameMode        (sceneUrl: "level2_city.gltf")
│    ├── BossLevel GameMode    (sceneUrl: "boss_arena.gltf")
│    ├── GameOverGameMode      (sceneUrl: "_blank")
│    └── CreditsGameMode       (sceneUrl: "_blank")
│
└── /leaderboard → React page (no Babylon)
```

### Step 1: Define All Game Modes

Create one `SceneController` subclass per scene/level. Register each one.

```typescript
// src/babylon/classes/Level1GameMode.ts
import GameManager from "../globals";

export class Level1GameMode extends TOOLKIT.SceneController {
    private playerController: any = null;
    private raceTimer: number = 0;
    private lapCount: number = 0;

    protected async createScene(data?: any): Promise<void> {
        // data = auxiliaryData from navigation (difficulty, previous score, etc.)
        const difficulty: string = data?.difficulty ?? "normal";

        GameManager.PostProgressStatus("Loading Race Track ...");

        // The base scene (level1_track.gltf) is already loaded.
        // Load the player car prefab:
        const assetsManager = new BABYLON.AssetsManager(this.scene);
        assetsManager.addMeshTask("car", null, "https://cdn.mygame.com/vehicles/", "racecar.gltf");

        await TOOLKIT.SceneManager.LoadRuntimeAssets(assetsManager, ["racecar.gltf"], () => {
            const carNode = this.scene.getNodeByName("RaceCar") as BABYLON.TransformNode;
            this.playerController = new PROJECT.VehicleController(carNode, this.scene, {
                topSpeed: difficulty === "hard" ? 320 : 250
            });
            this.playerController.enableInput = true;
        });

        // Set up checkpoint listeners
        this.setupCheckpoints();

        // Announce HUD that game started
        GameManager.EventBus.PostMessage("hud:gameStart", { lapTotal: 3, difficulty });
    }

    private setupCheckpoints(): void {
        // Listen for checkpoint trigger events from the loaded scene's script components
        GameManager.EventBus.OnMessage("checkpoint:lap", (data: { lapNumber: number }) => {
            this.lapCount = data.lapNumber;
            GameManager.EventBus.PostMessage("hud:lap", { current: this.lapCount, total: 3 });

            if (this.lapCount >= 3) {
                this.onRaceComplete();
            }
        });
    }

    protected update(): void {
        this.raceTimer += this.scene.getEngine().getDeltaTime() / 1000;

        // Push speed to HUD every frame
        const speed = this.playerController?.currentSpeed ?? 0;
        GameManager.EventBus.PostMessage("hud:speed", { speed });
        GameManager.EventBus.PostMessage("hud:time", { time: this.raceTimer });
    }

    private onRaceComplete(): void {
        const finalScore = Math.round(10000 - this.raceTimer * 10);
        GameManager.GlobalState.level1Score = finalScore;
        GameManager.GlobalState.level1Time = this.raceTimer;
        GameManager.SaveGameState(StorageType.Local);

        // Navigate to next level
        GameManager.NavigateTo('/play', {
            gameMode: 'Level2GameMode',
            sceneUrl: 'https://cdn.mygame.com/levels/level2_city.gltf',
            auxiliaryData: { score: finalScore, previousLevel: 1 }
        });
    }

    protected destroy(): void {
        GameManager.EventBus.RemoveHandler("checkpoint:lap", null); // clean up
    }
}

TOOLKIT.SceneManager.RegisterClass("Level1GameMode", Level1GameMode);
```

### Step 2: Register All Game Modes in globals.ts

Add your game mode imports alongside the built-in ones:

```typescript
// In GameManager.InitializeRuntime (called by globals.ts):
await import("./classes/DefaultGameMode");
await import("./classes/FreeCameraMode");
await import("./classes/PlayerControllerDemo");
await import("./classes/PlaygroundDemoScene");
await import("./classes/VehicleControllerDemo");

// ADD YOUR GAME MODES:
await import("./classes/MainMenuGameMode");
await import("./classes/Level1GameMode");
await import("./classes/Level2GameMode");
await import("./classes/BossLevelGameMode");
await import("./classes/GameOverGameMode");
```

### Step 3: Wire Up the React Home Screen

```tsx
// src/screens/HomeScreen.tsx
import { useUnifiedNavigation } from "../babylon/system/platform";

export function HomeScreen() {
    const { navigate } = useUnifiedNavigation();

    const startGame = () => navigate('/play', {
        gameMode: 'MainMenuGameMode',
        sceneUrl: 'https://cdn.mygame.com/mainmenu/mainmenu.gltf',
    });

    return (
        <div className="home">
            <h1>My Racing Game</h1>
            <button onClick={startGame}>Play</button>
        </div>
    );
}
```

### Step 4: Wire Up the Game UI Overlay

```tsx
// src/chrome/overlay.tsx
// Full HUD: speed, laps, timer, pause menu
// See Section 7 above for the full implementation pattern.
```

### Step 5: Set Up the App Router

```tsx
// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { DefaultBabylonPreloader } from './chrome/loading';
import { HomeScreen } from './screens/HomeScreen';

const PlayRoute = lazy(() => import('./routing/router'));

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/"     element={<HomeScreen />} />
                <Route path="/play" element={
                    <Suspense fallback={<DefaultBabylonPreloader />}>
                        <PlayRoute />
                    </Suspense>
                } />
                <Route path="/leaderboard" element={<LeaderboardScreen />} />
            </Routes>
        </BrowserRouter>
    );
}
```

---

## 13. Project Setup and Configuration

### Required npm Packages

```bash
npm install babylonjs babylonjs-gui babylonjs-addons babylonjs-loaders babylonjs-materials babylonjs-inspector babylonjs-toolkit
```

### Submodule Installation

```bash
git submodule add https://github.com/babylontoolkit/ReactFramework.git src
git commit -m "Add Babylon Toolkit React Framework submodule"
```

### Required Public Assets

Copy to `public/` folder (served at root):

```
public/
├── babylon.png         ← from src/babylon/assets/babylon.png
├── spinner.png         ← from src/babylon/assets/spinner.png
├── scripts/
│   ├── havok.js        ← Havok physics (from babylonjs package)
│   ├── glslang.js      ← WebGPU shader compiler
│   ├── glslang.wasm
│   ├── twgsl.js        ← WebGPU shader compiler
│   └── twgsl.wasm
```

### Required tsconfig.json Settings

```json
{
    "compilerOptions": {
        "skipLibCheck": true,
        "noImplicitAny": false,
        "esModuleInterop": true,
        "strictNullChecks": false,
        "allowSyntheticDefaultImports": true,
        "moduleResolution": "bundler",
        "allowImportingTsExtensions": true,
        "verbatimModuleSyntax": false,
        "isolatedModules": true,
        "moduleDetection": "force",
        "noEmit": true,
        "strict": true,
        "noUnusedLocals": false,
        "noUnusedParameters": false
    }
}
```

### Vite Config Key Points

```typescript
// vite.config.ts
build: {
    rollupOptions: {
        output: {
            manualChunks(id) {
                // Keep ALL BabylonJS in ONE chunk — critical for babylon to work
                if (id.includes("babylonjs")) return "babylon";
            }
        }
    }
},
  optimizeDeps: {
    exclude: [
      "@babylonjs/core",
      "@babylonjs/loaders",
      "@babylonjs/gui",
      "@babylonjs/materials",
      "@babylonjs/serializers",
      "@babylonjs/addons",
      "@babylonjs/havok",
      "@babylonjs/inspector",
      "@babylonjs-toolkit/next",
      "@babylonjs-toolkit/next/project",
    ],
    include: mode === 'development' ? [
      "scheduler",
      "use-sync-external-store/shim"
    ] : [],
  },
server: {
    headers: {
        "Cross-Origin-Embedder-Policy": "credentialless",  // Required for SharedArrayBuffer (Havok)
        "Cross-Origin-Opener-Policy": "same-origin"
    }
}
```

### Next.js Requirements

```typescript
// next.config.ts
const nextConfig = {
    turbopack: {},
    images: { disableStaticImages: true },  // Patch 1: PNG type fix
    async headers() {
        return [{ source: "/(.*)", headers: [
            { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
            { key: "Cross-Origin-Opener-Policy", value: "same-origin" }
        ]}];
    },
    webpack(config, { webpack }) {
        config.plugins.push(
            new webpack.NormalModuleReplacementPlugin(/assets[/\\]babylon\.png$/, (res) => {
                res.request = "data:text/javascript,export default '/babylon.png'";
            }),
            new webpack.NormalModuleReplacementPlugin(/assets[/\\]spinner\.png$/, (res) => {
                res.request = "data:text/javascript,export default '/spinner.png'";
            })
        );
        return config;
    }
};
```

```bash
# Force webpack (not Turbopack) for Next.js dev and build:
next dev --webpack
next build --webpack
```

---

## 14. Platform Adapters — React Router, Next.js, TanStack

Every host application must provide a **Navigation Adapter** that bridges the host router into the Babylon Toolkit's `UnifiedNavigation` context. The adapter:
1. Provides `navigate(path, options)` to the context
2. Provides `location` (pathname, state) to the context
3. Calls `GameManager.SetReactNavigationHook(navigate)` so game code can trigger navigation

### React Router DOM Adapter

```tsx
// src/routing/adapter.tsx
'use client';

/*
 * =================================================================
 * Host Navigation Adapter - React Router DOM
 * =================================================================
 * Bridges react router hooks into the babylon toolkit's
 * UnifiedNavigation context. Replace this file (or pick a different
 * adapter) when porting to TanStack Router, Next.js, etc.
 * =================================================================
 */

import { createElement, ReactNode, useCallback, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { NavigationProvider, UnifiedNavigateFunction, LocationState, NavigationState, NAV_STATE_STORE_KEY } from "../babylon/system/platform";
import GameManager from "../babylon/globals";

export function ReactRouterNavAdapter({ children }: { children: ReactNode }) {
  const rrNavigate = useNavigate();
  const rrLocation = useLocation();

  const navigate: UnifiedNavigateFunction = useCallback(
    (path, state) => {
      // Bridge: persist state to sessionStorage so it survives iframe reloads.
      // This is intentionally NOT in the URL — users cannot craft a shareable link
      // with a spoofed gameMode/sceneUrl. sessionStorage is origin-scoped and
      // session-scoped; modifying it only affects the user's own browser tab.
      if (state) {
        // Strip reload flag from stored state so it doesn't re-trigger on restore.
        const { reloadPage, ...storedState } = state;
        try { sessionStorage.setItem(NAV_STATE_STORE_KEY, JSON.stringify(storedState)); } catch { /* ignore */ }
        // Force a full DOM reload to release all resources from the previous page
        // and give the new scene a fresh slate.
        if (reloadPage === undefined || reloadPage === true) {
          window.location.href = path;
          return;
        }
      }
      rrNavigate(path, { state });
    },
    [rrNavigate]
  );

  // Note: Register the navigation hook globally so GameManager.NavigateTo works on
  // every page, even before the Babylon runtime has initialized. ReactRouterNavAdapter
  // wraps the whole app (inside BrowserRouter) and already owns the navigate function.
  useEffect(() => {
    GameManager.SetReactNavigationHook(navigate);
    return () => GameManager.DeleteReactNavigationHook();
  }, [navigate]);

  const location: LocationState = useMemo(
    () => ({
      pathname: rrLocation.pathname,
      search: rrLocation.search,
      state: rrLocation.state as NavigationState | undefined,
    }),
    [rrLocation]
  );

  const value = useMemo(() => ({ navigate, location }), [navigate, location]);

  return createElement(NavigationProvider, { value }, children);
}
```

### Next.js App Router Adapter

```tsx
// app/adapter.tsx
// Uses sessionStorage to bridge Next.js's stateless navigation with BT's stateful system.
// See: Section 14 full source in the Babylon Toolkit React Framework reference doc.
```

### TanStack Router Adapter (Lovable)

```tsx
// src/router.tsx
// Stashes navigation state in window.history.state via replaceState.
// See: Section 14 full source in the Babylon Toolkit React Framework reference doc.
```

### Play Route Component

```tsx
// src/routing/router.tsx
'use client';

import BabylonSceneViewer from '../babylon/system/babylon';
import { ReactRouterNavAdapter } from "./adapter";

export default function PlayRoute() {
    return (
        <ReactRouterNavAdapter>
            <BabylonSceneViewer
                fullPage={true}
                allowQueryParams={true}
                enableCustomOverlay={true}
            />
        </ReactRouterNavAdapter>
    );
}
```

---

## 15. Quick-Reference Card

### Navigation State Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `gameMode` | `string` | Registered class name (e.g. `"Level1GameMode"`). Defaults to `"DefaultGameMode"`. |
| `sceneUrl` | `string` | Full URL to the base GLTF scene. Use `"_blank"` for code-only scenes. |
| `scriptUrl` | `string` | Script bundle URL. Loaded once globally and cached. |
| `auxiliaryData` | `any` | Arbitrary data passed to `createScene(data)`. |

### SceneController Lifecycle Order

```
awake → start → ready
                    ↓
          update → late → after      (every render frame)
          step  → fixed              (every physics step)
                    ↓
               destroy               (on scene dispose)
```

### CSS z-index Stack

| Layer | z-index | Component |
|-------|---------|-----------|
| Splash Screen | 9999 | `<SplashScreen />` |
| Custom Overlay | 1002 | `<CustomOverlay />` |
| Canvas | 1001 | `<canvas>` (WebGPU / WebGL) |
| Viewer Container | 1000 | `.page-viewer` / `.div-viewer` |

### Event Bus Standard Message Names (Recommended Convention)

```typescript
// Loading
"OnLoadProgress"     → { message: string, percent?: number, ... }
"OnAssetComplete"    → { fileName: string, ... }
"OnLoadComplete"     → { message: string, ... }
"OnAssetDependency"  → { dependencyUrl: string, ... }

// HUD
"hud:score"    → { score: number }
"hud:speed"    → { speed: number }
"hud:lap"      → { current: number, total: number }
"hud:time"     → { time: number }
"hud:health"   → { health: number, maxHealth: number }
"hud:message"  → { text: string, duration?: number }
"hud:gameStart"→ { ... }
"hud:gameOver" → { finalScore: number }

// Game
"game:pause"   → { paused: boolean }
"game:resume"  → {}
"checkpoint:lap" → { lapNumber: number }
"player:died"  → { ... }
"player:scored"→ { points: number }
```

### File Checklist for a New Game Mode

```
✅ Create  src/babylon/classes/MyGameMode.ts
✅ Extend  TOOLKIT.SceneController
✅ Call    TOOLKIT.SceneManager.RegisterClass("MyGameMode", MyGameMode)
✅ Import  in globals.ts → await import("./classes/MyGameMode")
✅ Navigate with  gameMode: "MyGameMode"  in state
✅ Optional: add HUD events to CustomOverlay
✅ Optional: set this.hideSplashScreenDelayMs in constructor
```

### Blank Scene Template

```typescript
import GameManager from "../globals";

export class MyGameMode extends TOOLKIT.SceneController {

    constructor(transform: BABYLON.TransformNode, scene: BABYLON.Scene, properties: any = {}) {
        super(transform, scene, properties);
        this.hideSplashScreenDelayMs = 2000;
    }

    protected async createScene(data?: any): Promise<void> {
        // data = auxiliaryData from navigation state

        // 1. Setup camera
        const camera = new BABYLON.FreeCamera("cam", new BABYLON.Vector3(0, 5, -10), this.scene);
        camera.setTarget(BABYLON.Vector3.Zero());
        camera.attachControl(this.scene.getEngine().getRenderingCanvas(), true);

        // 2. Setup lighting
        const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), this.scene);
        light.intensity = 0.9;

        // 3. Load additional prefabs if needed
        const assetsManager = new BABYLON.AssetsManager(this.scene);
        assetsManager.addMeshTask("prefab", null, "https://cdn.mygame.com/", "myprefab.gltf");
        await TOOLKIT.SceneManager.LoadRuntimeAssets(assetsManager, ["myprefab.gltf"], () => {
            // Components on prefab nodes are now running
        });

        // 4. Subscribe to events
        GameManager.EventBus.OnMessage("game:pause", (d: { paused: boolean }) => {
            // handle pause
        });

        // 5. Announce to HUD
        GameManager.EventBus.PostMessage("hud:gameStart", {});
    }

    protected update(): void {
        // Per-frame logic
    }

    protected destroy(): void {
        // Cleanup
    }
}

TOOLKIT.SceneManager.RegisterClass("MyGameMode", MyGameMode);
```

---

> **Full Babylon Toolkit Component Reference:**  
> `https://raw.githubusercontent.com/babylontoolkit/agent/main/training/components/README.md`
>
> **SceneManager, AnimationState, CharacterController, RaycastVehicle, InputController, AudioSource and all other component APIs are documented in that reference.**  
>
> **Important:** Default UMD namespaces for BabylonJS and the Babylon Toolkit (`BABYLON.*`, `TOOLKIT.*`, `PROJECT.*`).