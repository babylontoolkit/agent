# User Interface Instructions (1.0.0)

**IMPORTANT. THIS DOCUMENT PROVIDES CRUCIAL USER INTERFACE INSTRUCTIONS. ALWAYS READ THIS ENTIRE DOCUMENT TO THE END OF FILE BEFORE CREATING, EDITING, OR REVIEWING UI CODE**

## Frontend Design Skills

When enabled, use the `Babylon Toolkit Design Skill` for all user interface design, including things like:

* visual hierarchy
* layout quality
* responsiveness
* interaction polish
* production-grade UI details
* high quality in-game user interfaces

## Project Design System

If this project contains `/DESIGN.md`, treat it as the canonical design system.

Before creating, editing, or reviewing UI code:

1. Read `/DESIGN.md`.
2. Follow its rules for:

   * colors
   * typography
   * spacing
   * border radius
   * shadows and elevation
   * buttons
   * forms
   * cards
   * layout patterns
   * dark mode, if specified
3. Prefer existing project components and styles.
4. Do not introduce new visual tokens unless explicitly asked.
5. If the implementation conflicts with `/DESIGN.md`, update the implementation, not the design system.
6. When unsure, explain the missing design decision and choose the closest option already defined in `/DESIGN.md`.

## UI Implementation

When building UI, prefer existing project components, styles, and patterns.

If using Tailwind, translate the `/DESIGN.md` tokens into Tailwind classes, theme values, or CSS variables.

If the frontend design skill suggests a style that conflicts with `/DESIGN.md`, `/DESIGN.md` wins.

## Babylon Scene Viewer

The Babylon Scene Viewer is composed of **three distinct UI layers** that together form the complete in-game user interface system. Each layer has a distinct lifecycle, purpose, and z-index level. Always understand which layer is responsible for what before building any in-game UI.

* **ALWAYS** Prefer full width and height containers when rendering the scene. Use full page containers whenever appropriate.

### Z-Index Stack (top to bottom)

```
z-index 9999   SplashScreen (asset loading screen)     ← auto-hidden when scene is ready
z-index 1002   CustomOverlay (master game UI layer)    ← HUDs, menus, modal dialogs
z-index 1001   <canvas> (WebGPU / WebGL render surface)
z-index 1000   .page-viewer / .div-viewer container
```

---

### Layer 1 — DefaultBabylonPreloader (Initial Download Suspense State)

**File:** `src/chrome/loading.tsx`

**What it is:** The `DefaultBabylonPreloader` is a React `Suspense` fallback component. It is shown immediately when the user navigates to the `/play` route — **before** any Babylon code, engine, or scene has loaded. Its purpose is to communicate the *initial download suspense state*: the moment the user is waiting for the Babylon runtime bundle, wasm physics, and other heavy JavaScript to arrive from the network.

**When it appears:**
- Shown by React's `<Suspense fallback={<DefaultBabylonPreloader />}>` boundary
- Displayed while the lazy-loaded `BabylonMount` chunk downloads over the network
- Replaced by the SplashScreen once the engine initializes

**Design intent:** Minimal, branded, non-interactive. It should convey "the game is loading" with a sense of *downloading suspense* — something is coming, it is heavy, and it is worth waiting for. Think of a game's very first loading bar before the title screen even appears. Use the project's `babylon.png` logo and `spinner.png` (both copied to `/public/`) as the default branded assets.

**Customization example:**
```tsx
// src/chrome/loading.tsx
export function DefaultBabylonPreloader() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0d0d1a',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
    }}>
      <img src="/babylon.png" alt="Loading" style={{ width: 120, marginBottom: 32 }} />
      <img src="/spinner.png" alt="" className="spin" style={{ width: 48 }} />
      <p style={{ color: '#8b5cf6', marginTop: 24, fontSize: 14, letterSpacing: 2 }}>
        LOADING GAME ENGINE...
      </p>
    </div>
  );
}

export { babylonLogo, spinnerImage };
```

---

### Layer 2 — SplashScreen (Asset Loading + Scene Initialization Screen)

**File:** `src/chrome/splash.tsx` + `src/chrome/splash.css`

**What it is:** The `SplashScreen` is the full-screen animated loading screen shown *inside* the `BabylonSceneViewer` while the engine initializes, the GLTF scene loads from CDN/S3, the physics engine starts, and the `SceneController.createScene()` method runs. It subscribes to `GameManager.EventBus.OnMessage("OnLoadProgress", ...)` and shows live progress messages.

**When it appears:**
- Immediately after the Babylon engine is created (replaces the preloader)
- Covers the canvas at `z-index 9999` for the full duration of asset loading
- Auto-hidden by `TOOLKIT.SceneManager.HideSplashScreen()` after `scenePrewarmDurationMs` (default 2500ms) once `createScene()` completes

**Progress message flow:**
```
"Loading Scene ..."           ← framework emits via OnLoadProgress
"Loading Scene 0%"            ← ImportMeshAsync progress
"Loading Scene 42%"
"Loading Scene 100%"
"Preparing game world ..."    ← your custom messages via GameManager.PostProgressStatus()
"Spawning enemies ..."
"Starting game ..."
```

**Design intent:** This is the full branded in-engine loading screen. It should feel like a AAA game intro — animated, atmospheric, building suspense. Use it to:
- Show animated logo reveal
- Show loading bar or percentage
- Show rotating tips / lore text
- Show a cinematic background image or looping video
- Show ambient particles or shader effects on the background

**Customization example:**
```tsx
// src/chrome/splash.tsx
import { useEffect, useState } from 'react';
import GameManager from '../globals';
import './splash.css';

function SplashScreen({ visible }: { visible: boolean }) {
  const [message, setMessage] = useState('Initializing...');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handler = (data: { message: string; percent?: number }) => {
      setMessage(data.message);
      if (data.percent != null) setProgress(data.percent);
    };
    GameManager.EventBus.OnMessage('OnLoadProgress', handler);
    return () => GameManager.EventBus.RemoveHandler('OnLoadProgress', handler);
  }, []);

  if (!visible) return null;

  return (
    <div className="splash-screen">
      <div className="splash-logo">
        <img src="/babylon.png" alt="Game Logo" />
      </div>
      <div className="splash-progress-bar">
        <div className="splash-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <p className="splash-message">{message}</p>
    </div>
  );
}

export default SplashScreen;
```

**Splash Screen Delay (in SceneController):**
```typescript
constructor(transform: BABYLON.TransformNode, scene: BABYLON.Scene, properties: any = {}) {
  super(transform, scene, properties);
  this.scenePrewarmDurationMs = 2000; // ms after createScene() completes
}
```

* Important: The `preloader` and `splash screen` **SHOULD** look very similar if not the same. The only differene is the preloader should be less animated than the splash screen because it is the `React Suspense` or downloading state.

---

### Layer 3 — CustomOverlay (Master In-Game UI Layer)

**File:** `src/chrome/overlay.tsx` + `src/chrome/overlay.css`

**What it is:** The `CustomOverlay` is the **master controller for ALL in-game view UI content** that overlays the Babylon game engine's rendered scene. It is a React `<div>` positioned absolutely over the canvas at `z-index 1002`. It is the single authoritative container for every piece of game UI that lives in DOM space above the WebGPU/WebGL render surface.

**Enable it on BabylonSceneViewer:**
```tsx
<BabylonSceneViewer
  fullPage={true}
  allowQueryParams={true}
  enableCustomOverlay={true}   // ← REQUIRED to mount the overlay
/>
```

**What it manages:**

#### HUDs (Heads-Up Displays)
Always-visible during gameplay. Lives in the overlay at `pointer-events: none` so input passes through to the canvas. Updated via `GameManager.EventBus` messages from the `SceneController`.

```tsx
// HUD bar at the top of screen
<div className="hud-top">
  <div className="hud-health">
    <span>HP</span>
    <div className="health-bar"><div style={{ width: `${hp}%` }} /></div>
  </div>
  <div className="hud-score">Score: {score}</div>
  <div className="hud-ammo">Ammo: {ammo}</div>
  <div className="hud-minimap">
    {/* Minimap canvas or image */}
  </div>
</div>

// Bottom speed / race HUD
<div className="hud-bottom">
  <div className="hud-speedometer">{Math.round(speed)} km/h</div>
  <div className="hud-lap">Lap {lap} / {totalLaps}</div>
</div>
```

#### Popup Menus
Temporarily shown on game events (level complete, achievement unlocked, etc.). Enable `pointer-events: auto` on the menu container while visible.

```tsx
{showLevelComplete && (
  <div className="popup-menu" style={{ pointerEvents: 'auto' }}>
    <h2>LEVEL COMPLETE!</h2>
    <p>Score: {finalScore}</p>
    <button onClick={handleNextLevel}>NEXT LEVEL</button>
    <button onClick={handleMainMenu}>MAIN MENU</button>
  </div>
)}
```

#### Modal Dialogs
Full-screen blocking UI for pause menus, settings, inventory, dialogue boxes. Set the overlay's root div to `pointer-events: auto` when a modal is active.

```tsx
{isPaused && (
  <div className="modal-backdrop" style={{ pointerEvents: 'auto' }}>
    <div className="pause-menu">
      <h1>PAUSED</h1>
      <button onClick={handleResume}>Resume</button>
      <button onClick={handleSettings}>Settings</button>
      <button onClick={handleQuit}>Quit to Menu</button>
    </div>
  </div>
)}
```

**Critical pointer-events rule:**
```css
/* overlay.css */
.overlay {
  position: absolute;
  inset: 0;
  z-index: 1002;
  pointer-events: none;      /* ALWAYS none at root — pass input to canvas */
}

.overlay button,
.overlay .interactive {
  pointer-events: auto;      /* Only interactive children capture input */
}
```

**Full overlay architecture pattern:**
```tsx
// src/chrome/overlay.tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useUnifiedNavigation } from '../system/platform';
import GameManager from '../globals';
import './overlay.css';

function CustomOverlay() {
  const { navigate } = useUnifiedNavigation();

  // HUD state
  const [score, setScore]   = useState(0);
  const [hp, setHp]         = useState(100);
  const [speed, setSpeed]   = useState(0);
  const [ammo, setAmmo]     = useState(30);

  // Modal/popup state
  const [isPaused, setIsPaused]             = useState(false);
  const [showSettings, setShowSettings]     = useState(false);
  const [showLevelComplete, setLevelComplete] = useState(false);
  const [showGameOver, setGameOver]         = useState(false);

  // Wire up all game events
  useEffect(() => {
    const onScore  = (d: { score: number })    => setScore(d.score);
    const onHp     = (d: { hp: number })       => setHp(d.hp);
    const onSpeed  = (d: { speed: number })    => setSpeed(d.speed);
    const onAmmo   = (d: { ammo: number })     => setAmmo(d.ammo);
    const onPause  = (d: { paused: boolean })  => setIsPaused(d.paused);
    const onWin    = ()                        => setLevelComplete(true);
    const onDead   = ()                        => setGameOver(true);

    GameManager.EventBus.OnMessage('hud:score',    onScore);
    GameManager.EventBus.OnMessage('hud:hp',       onHp);
    GameManager.EventBus.OnMessage('hud:speed',    onSpeed);
    GameManager.EventBus.OnMessage('hud:ammo',     onAmmo);
    GameManager.EventBus.OnMessage('game:pause',   onPause);
    GameManager.EventBus.OnMessage('game:win',     onWin);
    GameManager.EventBus.OnMessage('game:over',    onDead);

    return () => {
      GameManager.EventBus.RemoveHandler('hud:score',  onScore);
      GameManager.EventBus.RemoveHandler('hud:hp',     onHp);
      GameManager.EventBus.RemoveHandler('hud:speed',  onSpeed);
      GameManager.EventBus.RemoveHandler('hud:ammo',   onAmmo);
      GameManager.EventBus.RemoveHandler('game:pause', onPause);
      GameManager.EventBus.RemoveHandler('game:win',   onWin);
      GameManager.EventBus.RemoveHandler('game:over',  onDead);
    };
  }, []);

  const hasModal = isPaused || showSettings || showLevelComplete || showGameOver;

  return (
    <div className="overlay" style={{ pointerEvents: hasModal ? 'auto' : 'none' }}>
      {/* === HUD LAYER (always visible, pointer-events none) === */}
      {!hasModal && (
        <div className="hud" style={{ pointerEvents: 'none' }}>
          <div className="hud-score">Score: {score}</div>
          <div className="hud-health-bar">
            <div className="hud-health-fill" style={{ width: `${hp}%` }} />
          </div>
          <div className="hud-speed">{Math.round(speed)} km/h</div>
          <button style={{ pointerEvents: 'auto' }}
            onClick={() => GameManager.EventBus.PostMessage('game:pause', { paused: true })}>
            ❚❚
          </button>
        </div>
      )}

      {/* === PAUSE MENU MODAL === */}
      {isPaused && !showSettings && (
        <div className="modal-backdrop">
          <div className="pause-menu">
            <h2>PAUSED</h2>
            <button onClick={() => { setIsPaused(false); GameManager.EventBus.PostMessage('game:resume', {}); }}>Resume</button>
            <button onClick={() => setShowSettings(true)}>Settings</button>
            <button onClick={() => navigate('/')}>Quit to Menu</button>
          </div>
        </div>
      )}

      {/* === SETTINGS MODAL === */}
      {showSettings && (
        <div className="modal-backdrop">
          <div className="settings-menu">
            <h2>SETTINGS</h2>
            {/* settings controls */}
            <button onClick={() => setShowSettings(false)}>Back</button>
          </div>
        </div>
      )}

      {/* === LEVEL COMPLETE POPUP === */}
      {showLevelComplete && (
        <div className="popup-overlay">
          <div className="level-complete-card">
            <h1>LEVEL COMPLETE!</h1>
            <p>Final Score: {score}</p>
            <button onClick={() => { setLevelComplete(false); GameManager.NavigateTo('/play', { gameMode: 'NextLevel' }); }}>
              Next Level
            </button>
          </div>
        </div>
      )}

      {/* === GAME OVER SCREEN === */}
      {showGameOver && (
        <div className="modal-backdrop game-over">
          <div className="game-over-screen">
            <h1>GAME OVER</h1>
            <p>Score: {score}</p>
            <button onClick={() => navigate('/')}>Main Menu</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomOverlay;
```

## Choosing the UI Layer — Native GPU GUI vs DOM React vs Raw HTML

This is the **most critical architectural decision** when building game UI. Choose the wrong layer and you will fight z-ordering, compositing, input event conflicts, or severe performance issues.

#### Decision Matrix

| Requirement | DOM Overlay (React/CustomOverlay) | GPU GUI (@babylonjs/gui) | Raw HTML / CSS |
|-------------|----------------------------------|--------------------------|----------------|
| Score, ammo, speed HUD | ✅ Best — zero GPU cost | ✅ OK | ❌ Avoid |
| Health bar above 3D character | ❌ Difficult | ✅ Best — use `linkWithMesh` | ❌ Avoid |
| Pause / settings / inventory menus | ✅ Best — full CSS, Tailwind | ⚠️ Limited styling | ❌ Avoid in-game |
| Cockpit / in-game monitor | ❌ Not possible | ✅ Best — texture mode on mesh | ❌ Avoid |
| Name tags / damage numbers in world | ❌ Not native | ✅ Best — `linkWithMesh` tracking | ❌ Avoid |
| Chat box with rich text input | ✅ Best — native browser input | ⚠️ Limited InputText | ❌ Avoid |
| Minimap as 2D overlay | ✅ Good — React canvas in overlay | ✅ Good — render to texture | ⚠️ OK |
| WebXR / VR interface | ❌ DOM invisible in VR | ✅ Best — texture mode only | ❌ Avoid |
| Complex animated UI (tweens, springs) | ✅ CSS transitions | ✅ BabylonJS animations | ⚠️ Possible |
| Game intro / main menu (marketing site) | ✅ Best — full React | ❌ Not intended for this | ✅ Best |
| Font quality (crisp, anti-aliased) | ✅ Browser native | ⚠️ Canvas text, needs tuning | ✅ Browser native |
| Responsive to browser resize | ✅ CSS media queries | ✅ idealWidth scaling | ✅ CSS |
| Postprocess-immune (no bloom/glow on UI) | ✅ Composited above | Use layerMask camera | ✅ Composited above |

#### Rule of Thumb

1. **Use `CustomOverlay` (DOM React)** for all menus, HUDs, popups, and modal dialogs that contain text-heavy content, complex layouts, or need browser-native input. This is the default for in-game UI. Zero GPU overhead. Full Tailwind/CSS support.

2. **Use `@babylonjs/gui` (GPU GUI)** when the UI must be:
   - Anchored to a 3D mesh position (health bars, labels, damage numbers)
   - Rendered *onto* a mesh surface (cockpit displays, in-world screens, VR panels)
   - Part of the scene's postprocess pipeline in a controlled way (layerMask camera)
   - A fullscreen GPU HUD that must be composited with scene effects at the engine level

3. **Use native HTML/CSS** for everything *outside* the game viewport — landing pages, marketing sites, documentation, pre-game setup screens. The game engine should not be rendering these.

4. **Never mix DOM and GPU GUI for the same logical UI element.** Pick one layer and own it completely. Mixing creates z-ordering battles and double input handling.

---

## The BabylonJS GUI API Reference

The **complete `@babylonjs/gui` API reference** — `AdvancedDynamicTexture` (fullscreen, texture, and
billboard modes), every control (`TextBlock`, `Button`, `InputText`, `Slider`, `Checkbox`, `Image`,
`Line`, `ColorPicker`, `VirtualKeyboard`), the containers (`Rectangle`, `Ellipse`, `StackPanel`,
`ScrollViewer`, `Grid`), layout/sizing/alignment, `linkWithMesh` world-space tracking, shared styles,
performance optimization, the events reference, and side-by-side DOM-vs-GPU examples — lives in a
separate document:

**`references/babylon-gui.md`**

Read it before writing any `@babylonjs/gui` code. Use the decision matrix above to decide *whether* you
need it at all: most in-game UI is DOM React in `CustomOverlay` and needs nothing from that document.

**If you have decided you need the GPU GUI and `references/babylon-gui.md` is not available to you, say
so and stop — do not reconstruct the `@babylonjs/gui` API from general BabylonJS knowledge.** Inventing
a control, a property, or a layout rule that does not exist is far worse than telling the user the
reference is missing.

---

**Follow these rules exactly when generating user interfaces.**
