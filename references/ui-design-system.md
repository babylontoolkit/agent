# User Interface Instructions (1.0.0)

**IMPORTANT. THIS DOCUMENT PROVIDES CRUCIAL USER INTERFACE INSTRUCTIONS. ALWAYS READ THIS ENTIRE DOCUMENT TO THE END OF FILE BEFORE CREATING, EDITING, OR REVIEWING UI CODE**

> **ENFORCED — Live HUD Values.** A HUD value that changes every frame (speed, RPM, needles, timers, bars, markers)
> **never goes through React state, props, context, a store or a per-frame EventBus message.** The HUD renders once;
> one frame loop writes those values into the DOM through refs, only when what is shown changes.
> **And nothing runs per frame that does not need to.** Every UI element gets the cheapest update cadence that shows
> it correctly — events for state, CSS for decorative motion, the frame loop only for telemetry, throttled for
> readouts nobody reads at 60 Hz, and nothing at all for what is not on screen. Menus, splash screens and landing pages
> have no frame loop. UI code that breaks either rule is not finished. Read **Live HUD Values — ENFORCED** and
> **Per frame or not** below before writing or reviewing any UI.

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

**What it is:** The `SplashScreen` is the full-screen animated loading screen shown *inside* the `BabylonSceneViewer` while the engine initializes, the GLTF scene loads from CDN/S3, the physics engine starts, and the `SceneController.createScene()` method runs. It subscribes to `GameManager.EventBus.OnMessage("OnLoadProgress", ...)` (the scene download) and to `TOOLKIT.SceneManager.OnLoaderStatusObservable` (everything after the download — the asset preloader, then the shader compile) and shows live progress messages.

**When it appears:**
- Immediately after the Babylon engine is created (replaces the preloader)
- Covers the canvas at `z-index 9999` for the full duration of asset loading
- Stays up until `TOOLKIT.SceneManager.WhenSceneReady(scene)` resolves: the asset preloader finished (terrains, skins, animations, navigation, water, ray tracing, probes, audio, video, post-processing), then the scene's shaders compiled, then the scene rendered a few smooth frames. `SceneController.scenePrewarmDurationMs` (default 2500 ms) is only the **minimum** time the splash stays up; `sceneReadyTimeoutMs` (default 120000 ms) is the upper bound after which it is hidden anyway. The `SceneController` then calls `TOOLKIT.SceneManager.HideSplashScreen()` for you

**Progress message flow:**
```
"Loading Scene ..."           ← framework emits via OnLoadProgress
"Loading Scene 0%"            ← ImportMeshAsync progress
"Loading Scene 42%"
"Loading Scene 100%"          ← the scene file is in; from here the toolkit reports the real work
"BUILDING SCENE 40%"          ← building meshes and materials (state 1) via SceneManager.OnLoaderStatusObservable
"SETTING UP SCENE"            ← scene components, levels of detail, lights (state 2)
"Preparing game world ..."    ← your custom messages via GameManager.PostProgressStatus()
"Spawning enemies ..."
"LOADING ASSETS 40%"          ← asset preloader (state 3) via SceneManager.OnLoaderStatusObservable
"LOADING TERRAIN 45%"         ← a heavy system in the asset preloader (state 3)
"COMPILING SHADERS 67%"       ← preparing scene view (state 4) via SceneManager.OnLoaderStatusObservable
"STARTING SCENE"              ← every shader compiled, the last moment before the reveal
```

The runtime posts the loader status in upper case (like the engine.html loader); the default React splash converts it to sentence case. See *Loading progress you can show* below for every state.

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
import GameManager from '../babylon/globals';
import { SceneManager } from '@babylonjs-toolkit/next/scenemanager';
import './splash.css';

/** Scene download progress posted on GameManager.EventBus "OnLoadProgress". */
type LoadProgressMessage = { message?: string; percent?: number; overallPercent?: number };

/** TOOLKIT.ILoaderStatus from SceneManager.OnLoaderStatusObservable (null fields are unchanged since the last update). */
type LoaderStatus = { status: string | null; details: string | null; progress: number | null; state: number };

/**
 * Converts a progress fraction to the whole percent the bar shows (0..100). Progress is kept as this integer so
 * React skips the re-render when an update does not change what is shown — the download fires many updates a second.
 */
const toShownPercent = (fraction: number): number => Math.round(Math.max(0, Math.min(1, fraction)) * 100);

function SplashScreen({ visible }: { visible: boolean }) {
  const [message, setMessage] = useState<string>('Initializing...');
  const [details, setDetails] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);

  useEffect(() => {
    // the toolkit's scene build stages (Building scene, Setting up scene) take over the status line and bar once the scene file
    // is in - without this flag the runtime only fills the detail line there, so a splash still showing its download percent
    // never fights it
    SceneManager.HostDefersSceneStatus = true;
    let loaderState = -1;
    // 1. the scene download (glTF + bin), until the toolkit posts its own stages (state 1 on)
    const onLoadProgress = (data: LoadProgressMessage): void => {
      if (data == null || loaderState >= 1) return;
      if (data.message != null) setMessage(data.message);
      const percent: number | undefined = data.overallPercent ?? data.percent;
      if (typeof percent === 'number' && isFinite(percent)) setProgressPercent(toShownPercent(percent / 100));
    };
    // 2. everything after the download: building (1), setting up (2), the asset preloader (3), the shader compile (4).
    //    progress is the fraction of the current state, so the bar starts over when data.state changes
    const onLoaderStatus = (data: LoaderStatus): void => {
      if (data == null) return;
      if (typeof data.progress === 'number') loaderState = data.state;
      if (data.status != null && data.status !== '') setMessage(data.status);
      if (data.details != null) setDetails(data.details);
      if (typeof data.progress === 'number' && isFinite(data.progress)) setProgressPercent(toShownPercent(data.progress));
    };
    GameManager.EventBus.OnMessage('OnLoadProgress', onLoadProgress);
    const loaderObserver = SceneManager.OnLoaderStatusObservable.add(onLoaderStatus);
    return () => {
      GameManager.EventBus.RemoveHandler('OnLoadProgress', onLoadProgress);
      SceneManager.OnLoaderStatusObservable.remove(loaderObserver);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="splash-screen">
      <div className="splash-logo">
        <img src="/babylon.png" alt="Game Logo" />
      </div>
      <div className="splash-progress-bar">
        {/* full width, scaled from the left (transform-origin: left in splash.css): progress never re-lays out the page */}
        <div className="splash-progress-fill" style={{ transform: `scaleX(${progressPercent / 100})` }} />
      </div>
      <p className="splash-message">{message}</p>
      <p className="splash-details">{details}</p>
    </div>
  );
}

export default SplashScreen;
```

**Splash Screen Delay (in SceneController):**
```typescript
constructor(transform: BABYLON.TransformNode, scene: BABYLON.Scene, properties: any = {}) {
  super(transform, scene, properties);
  this.scenePrewarmDurationMs = 2000; // minimum ms the splash stays up; it still waits for WhenSceneReady
  this.sceneReadyTimeoutMs = 60000;   // upper bound: hide the splash anyway after this many ms
}
```

#### Loading progress you can show

| Stage (state) | Status line (example) | Detail line (example) | Progress |
| --- | --- | --- | --- |
| Scene download (`OnLoadProgress`) | Loading Scene 45% | — | file percent |
| Building the scene (1) | Building scene 40% | Downloading scene geometry · Building 1200 of 3908 meshes · Loading 120 of 177 textures | meshes built + textures loaded |
| Setting up the scene (2) | Setting up scene | Creating scene components | full |
| Asset preloader (3) | Loading assets 40% · Loading terrain 45% · Loading skins 20% · Loading animations · Loading navigation · Loading water · Loading ray tracing | Loading 12 of 25 assets (before any heavy system starts) · then the stage the system is waiting on, e.g. Loading terrain textures (steady, forward only) | one combined scene fraction |
| Preparing scene view (4) | Compiling shaders 67% · then Starting scene | 140 of 210 shaders compiled · then All 210 shaders compiled | shader fraction (full at Starting scene) |

**You have full creative freedom.** These are the states the runtime reports, and the default splash screens show
them as a status line, a bar and a corner detail line. A custom splash may present them in any way that fits the
design — different wording, layout, animation, illustration, a single combined bar, per-system indicators, or none
of the raw text at all. Do give the player a sense of real progress during heavy loading: show something that moves
with the load (a bar, stage names, counts), never an endless "please wait".

**Where each value comes from:**
- `GameManager.EventBus.OnMessage("OnLoadProgress", ...)` — the scene download (`message`, `percent` / `overallPercent`), plus your own `GameManager.PostProgressStatus()` messages.
- `TOOLKIT.SceneManager.OnLoaderStatusObservable` — every `TOOLKIT.ILoaderStatus` after the download: `status` (status line), `details` (detail line), `progress` (0..1 fraction of the current state, or `null`) and `state` (the loading state: 1 building the scene, 2 setting up the scene, 3 asset preloader, 4 preparing scene view). Text arrives in upper case.
- `TOOLKIT.SceneManager.HostDefersSceneStatus = true` — set it in a splash that hands its status line and bar to the toolkit once the scene file is in (the default engine.html and React splashes do) and stop showing the download percent after the first toolkit update with `state >= 1`. Without it the runtime posts only the detail line during states 1 and 2.
- During the asset preloader the status line names one heavy system at a time (Terrain, Skins, Animations, Navigation, Water, Ray tracing) for at least 750 ms unless it completes; the bar is one weighted fraction of every heavy system in the scene. Small assets (light probes, audio, video, ordinary files) never get their own stage — they only count in "Loading n of m assets", which shows until the first heavy system starts.
- For per-system indicators, subscribe to `TOOLKIT.LoadingProgress.OnProgressObservable` (`TOOLKIT.ILoadingJobProgress`: `title`, `stageLabel`, `jobProgress`, `groupProgress`, `sceneProgress`, `complete`) or read `TOOLKIT.LoadingProgress.GetSceneProgress(scene)` / `GetGroupProgress(scene, title)`; a terrain's own stages arrive on `TOOLKIT.TerrainBuilder.OnLoadProgressObservable` (`TOOLKIT.ITerrainLoadProgress`).
- **Never let the splash look stuck.** A custom splash may show progress in any form and wording it likes, but it should always show *some* progress that keeps moving through every stage, not just the download. To keep that data arriving, keep `SceneManager.HostDefersSceneStatus = true`, both subscriptions (removed on cleanup) and the check that stops using `"OnLoadProgress"` once a toolkit update reports `state >= 1`, as in the example above. Without them the splash sits on "Loading Scene 100%" while the scene builds and sets up, which reads as a hang.
- The page stays responsive for the whole load (the scene is built and set up in short slices), so the splash's own animation keeps running. Keep something visibly moving in every state, including the moments after a bar reaches 100% and the short hold on "Starting scene" while the last background work (GPU pipelines, particle pre-warm, LOD cross-fade materials) finishes before the reveal. **The splash's atmosphere is CSS, never a frame loop:** spinners, pulses, drifting particles, parallax layers, scanlines and shimmer are `@keyframes` on `transform` and `opacity`, which the compositor keeps playing even while a scene-build slice holds the main thread. A `requestAnimationFrame` loop or React state driving that motion stutters exactly when the load is heaviest and steals time from the load itself. Progress is event-driven: set it only when the whole percent shown changes (as the example above does) and draw the bar with `scaleX`, never `width` (**Per frame or not** below).
- Game code can await the same gate the splash uses: `await TOOLKIT.SceneManager.WhenSceneReady(scene, timeoutMs)` resolves `true` when the scene really finished, `false` on timeout or disposal, and never rejects.

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
Always-visible during gameplay. Lives in the overlay at `pointer-events: none` so input passes through to the canvas. **Discrete state** (score, health, ammo, lap, position) arrives through `GameManager.EventBus` messages from the `SceneController` and lives in React state. **Per-frame telemetry** (speed, RPM, timers, bars, markers) never does: it is read by the HUD's frame loop and written through refs — see **Live HUD Values — ENFORCED**.

```tsx
// HUD bar at the top of screen — discrete state, set from EventBus messages
<div className="hud-top">
  <div className="hud-health">
    <span>HP</span>
    {/* a bar scales, it never changes width */}
    <div className="health-bar"><div className="health-fill" style={{ transform: `scaleX(${hp / 100})` }} /></div>
  </div>
  <div className="hud-score">Score: {score}</div>
  <div className="hud-ammo">Ammo: {ammo}</div>
  <div className="hud-minimap">
    {/* Minimap canvas or image; the player marker moves through the frame loop */}
  </div>
</div>

// Bottom speed / race HUD — the speedometer is telemetry (frame loop + refs); the lap is state
<div className="hud-bottom">
  <Speedometer />
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
import { Speedometer } from './speedometer';   // telemetry: frame loop + refs (Live HUD Values — ENFORCED)
import './overlay.css';

function CustomOverlay() {
  const { navigate } = useUnifiedNavigation();

  // HUD state — discrete values only, each set by an event. Speed is telemetry: it is NOT state (see <Speedometer />).
  const [score, setScore]   = useState(0);
  const [hp, setHp]         = useState(100);
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
    const onAmmo   = (d: { ammo: number })     => setAmmo(d.ammo);
    const onPause  = (d: { paused: boolean })  => setIsPaused(d.paused);
    const onWin    = ()                        => setLevelComplete(true);
    const onDead   = ()                        => setGameOver(true);

    GameManager.EventBus.OnMessage('hud:score',    onScore);
    GameManager.EventBus.OnMessage('hud:hp',       onHp);
    GameManager.EventBus.OnMessage('hud:ammo',     onAmmo);
    GameManager.EventBus.OnMessage('game:pause',   onPause);
    GameManager.EventBus.OnMessage('game:win',     onWin);
    GameManager.EventBus.OnMessage('game:over',    onDead);

    return () => {
      GameManager.EventBus.RemoveHandler('hud:score',  onScore);
      GameManager.EventBus.RemoveHandler('hud:hp',     onHp);
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
            <div className="hud-health-fill" style={{ transform: `scaleX(${hp / 100})` }} />
          </div>
          <Speedometer />
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

## Live HUD Values — ENFORCED

> **A value that changes every frame NEVER goes through React.** Speed, RPM, needle angles, timers, boost and
> charge bars, distance, altitude, a moving minimap marker: none of them may be React state (`useState`,
> `useReducer`, `setState`), a prop, a context value, a store update (Zustand, Redux, signals wired into
> React), or a per-frame `GameManager.EventBus` message. The HUD renders its markup **once** and **one frame loop**
> writes the live values straight into the DOM through refs, **only when what is shown changes**.
>
> **This is a requirement, not a preference.** HUD code that pushes per-frame values through React is not
> finished, exactly like code that does not compile: fix it before you report the task done. It applies to every
> HUD you create, edit or review, in every skill, prototype and quick fix, with no exception for speed or demos.

**Why it is enforced.** A per-frame `setState` makes React re-render the HUD 60 times a second: every gauge,
every SVG tick and label is rebuilt as JSX, diffed and garbage-collected, even when nothing visible changed. In a
profiled racing game (Park City, BurnTheAphalt) the HUD's five per-frame `setState` calls cost **1.8 ms of every
frame — 36% of the main thread's work, as much as BabylonJS itself — and 34 MB/s of garbage**. The same HUD written
to these rules costs **0 ms of React per frame**: main thread 37% → 20% busy, allocations 41.7 → 8 MB/s, same look,
same 60 fps. The development build exaggerates React's share, but the production build pays the same way.

### State or telemetry — decide for every HUD value

| Kind | What it is | Examples | How it reaches the screen |
|---|---|---|---|
| **State** | Changes on a discrete event, a few times a second at most | which screen or modal is open, pause, gear, lap 2 / 3, race position, score after a hit, health after damage, ammo after a shot, an achievement toast | React state, set from a `GameManager.EventBus` message or a callback — **set only when the value actually changed** |
| **Telemetry** | Changes continuously, potentially every frame | speed, RPM, needle and arc positions, lap and countdown timers, boost / nitro / stamina / charge bars, distance, altitude, a minimap marker, a reticle that follows a target | **Never React.** One frame loop reads it and writes it to the DOM through refs (rules below) |

When unsure, it is telemetry. A value the game changes in `update()` is telemetry.

### Per frame or not — choose the update cadence for every UI element

Classifying a value tells you how it reaches the screen. It does **not** mean the value earns a frame loop.
Per-frame code is the most expensive way to show anything, so it is the last choice, not the default. For every
element in a HUD, menu, splash or page, pick the **cheapest cadence that still shows it correctly**:

| Cadence | Use it for | How | Violations |
|---|---|---|---|
| **1. On events — no loop** | Discrete **state**: screens, menus, pause, gear, lap, race position, score, health / ammo after a change, toasts, achievement pop-ups, settings, splash progress | React state set from an EventBus message or callback, **only when the value changed**. The game posts the message on the frame the value changes, never every frame | Polling state in a frame loop and setting it every frame "in case it changed"; a game `update()` that posts `hud:position` / `hud:gear` every frame |
| **2. CSS — no JS loop** | Decorative motion and fixed transitions: spinners, pulses, glows, shimmer, scanlines, ambient particles and parallax drift on menus and splash screens, hover and focus, modal / toast enter and exit, a health bar easing to its new value after a hit, a one-off needle sweep on HUD intro | `@keyframes` / `transition` on `transform` and `opacity`. Set the end value once and the browser animates it on the compositor, which keeps playing while the main thread is busy | A `requestAnimationFrame`, `useFrameLoop`, `setInterval` or animation library tick for motion CSS can do; animating `width`, `height`, `top`, `left` or a large `filter: blur` |
| **3. Every frame — the frame loop** | **Telemetry** the player watches track the game: speed, RPM, needles, arcs, timers that show tenths or hundredths, boost / nitro / charge bars, reticles and markers that follow moving things, a scroll-scrubbed hero while it is scrolling | One `useFrameLoop` per HUD, refs, quantize, compare, write only on change (**The rules** below) | React state, props, a store or a per-frame EventBus message; a second loop |
| **4. Throttled — a few times a second** | Telemetry that changes continuously but that nobody reads at 60 Hz: FPS / ping / debug counters (2–4 Hz), distance-to-target text (~10 Hz), live standings (~4 Hz, or on events), minimap markers for distant or non-player entities (10–15 Hz), objective arrows that point at slow targets | The same single frame loop with a time check (`timeMs - lastSlowWriteMs < SLOW_WRITE_INTERVAL_MS` → skip). A timer that shows whole seconds needs no throttle: its change check writes once a second | 60 Hz writes of text no one can read at 60 Hz; `setInterval`; a separate slow loop |
| **5. Not at all** | What is not on screen: a hidden or collapsed HUD, a HUD behind a pause / settings / results modal, a paused game, a menu or landing page with no live game value, a landing-page canvas or section scrolled out of view, a background tab | Unmount the HUD (its loop stops with it) or skip the loop on a visibility flag kept in a ref. Pause landing-page canvases and WebGL heroes with `IntersectionObserver` and `document.visibilitychange`. A scroll-driven loop writes nothing while the scroll is at rest. Honor `prefers-reduced-motion` | A frame loop running behind a modal, while paused, or for an element no one can see |

**How to decide.** *Does it change on a moment (a hit, a lap, a click)?* It is an event (1). *Is the motion decoration,
or a transition between two known values?* It is CSS (2). *Does it change continuously and would a player notice it
lagging?* Frame loop (3). *Would they notice it at 10 Hz?* If not, throttle (4). *Can anyone see it right now?* If not,
nothing (5).

**What this means in practice:**
- **Menus, pause, settings, results, inventory, store, landing pages, splash screens and preloaders have no frame loop.**
  They are events (1) and CSS (2). The only per-frame code allowed on a landing page is a real-time 3D, canvas or
  scroll-scrubbed hero, and it stops off-screen and does no writes while the scroll is at rest.
- **Static never updates.** Labels, ticks, numerals, bezels, icons, frames and copy render once and never re-render.
- **A property the frame loop writes has no CSS `transition`.** A `transition: transform` on a needle written every frame
  restarts each frame and trails the game. Smooth in the loop (ease toward the target) or in the game. CSS transitions
  are for values that change on events (2).
- **The game follows the same cadence.** `update()` writes telemetry onto `GameManager.GlobalState` every frame (setting
  a number is free) and posts an EventBus message only on the frame a discrete value changes:
  `if (gear !== this.postedGear) { this.postedGear = gear; GameManager.EventBus.PostMessage('hud:gear', { gear }); }`.
- **`@babylonjs/gui` and exported Unity UI follow it too.** A GUI control or `TOOLKIT.UserInterface.SetText` /
  `SetValue` is a per-frame write only for cadence 3 telemetry, and even then only on change. Everything else is set on
  events, and a control that is hidden is not updated at all (`babylon-gui.md` › Performance Optimization).

### The rules

1. **No React for telemetry.** Never put a telemetry value in React state, props, context or a store, and never post
   it on the EventBus per frame (each post allocates and wakes every listener). Discrete **state** stays in React.
2. **The game publishes, the HUD polls.** The game writes plain numbers onto `GameManager.GlobalState` (setting a
   number allocates nothing), or the HUD keeps a reference to the script component it shows and calls its getters
   (`controller.getAmericanSpeed()`). The HUD reads them in its frame loop. Nothing is pushed per frame.
3. **One frame loop per HUD**, `useFrameLoop` below (`requestAnimationFrame`, stopped on unmount). Not one loop per
   widget, never `setInterval`.
4. **Render once, write through refs.** HUD components render their markup a single time. Static furniture — dial
   ticks, numerals, bezels, labels, frames — is `memo`-ized or static SVG / CSS and never re-renders. The frame loop
   writes only the live elements, through `useRef` refs.
5. **Write only when the shown value changes.** Quantize first (an integer speed, a needle angle to 0.1°, a timer to
   the digits it shows, a bar to 0.1% or 1 px), compare with the last value written, and skip the DOM write when it
   is the same.
6. **Only cheap properties, never layout.**
   - **Numbers and text:** `element.textContent` (the `writeText` helper below).
   - **Needles, markers, reticles:** `style.transform` (`rotate`, `translate`).
   - **Bars:** `style.transform = scaleX(fraction)` with `transform-origin: left`.
   - **Arcs, rings and circular progress:** draw the full shape once with `pathLength={1}` and `strokeDasharray="1 1"`,
     then write `style.strokeDashoffset = 1 - fraction`.
   - **Fades:** `style.opacity`. **State styles** (redline, low fuel): `classList.toggle`, and only when the state flips.
   - **Never write per frame:** `width`, `height`, `top`, `left`, `margin`, `font-size`, `innerHTML`, or SVG geometry
     (`d`, `points`, `x` / `y`).
   - **Never read layout in the loop:** `offsetWidth`, `getBoundingClientRect`, `getComputedStyle` force a reflow.
7. **No allocation in the loop.** No per-frame objects, arrays, closures or JSX. Build a string only after the
   quantized value changed.
8. **Per frame only when it must be.** Each element takes the cheapest cadence in **Per frame or not** above: events
   for state, CSS for decorative motion, the frame loop only for telemetry, throttled for readouts nobody reads at
   60 Hz. The loop does nothing while nothing is shown — the HUD is unmounted or hidden, a modal covers it, or the
   game is paused — and no element the loop writes carries a CSS `transition`.
9. **Budget:** the HUD costs at most **0.5 ms of main-thread time per frame** and allocates nothing in steady
   play. Proof: profile the gameplay (`bt-profile`) — the `react` owner must sit near **0%** during play phases.

The same rule holds in `@babylonjs/gui`: every property change marks the GUI dirty, and the next frame re-lays it
out, redraws its canvas and re-uploads the whole texture to the GPU. Change a GUI control only when its shown value
changes (`babylon-gui.md` › Performance Optimization).

### The canonical pattern — copy it

```tsx
// src/chrome/hud-frame.ts — the HUD's frame loop and write helper
import { useEffect, useRef } from 'react';

/**
 * Runs `onFrame` once per browser frame while the component is mounted: the HUD's single telemetry loop.
 * The latest callback is always the one called, so it can read fresh props without restarting the loop.
 * @param onFrame - called every frame with the frame's timestamp in milliseconds
 */
export function useFrameLoop(onFrame: (timeMs: number) => void): void {
  const latestOnFrame = useRef(onFrame);
  useEffect(() => { latestOnFrame.current = onFrame; });
  useEffect(() => {
    let frameHandle = 0;
    const loop = (timeMs: number): void => {
      latestOnFrame.current(timeMs);
      frameHandle = requestAnimationFrame(loop);
    };
    frameHandle = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameHandle);
  }, []);
}

/**
 * Writes text into an element only when it differs from what is already shown.
 * @param element - the live text element, or null before it mounts
 * @param text - the text to show
 */
export function writeText(element: HTMLElement | null, text: string): void {
  if (element !== null && element.textContent !== text) element.textContent = text;
}
```

```tsx
// src/chrome/speedometer.tsx — a gauge whose needle, arc and readout never re-render React
import { memo, useRef } from 'react';
import GameManager from '../globals';
import { useFrameLoop, writeText } from './hud-frame';

/** Full-scale speed of the dial, in km/h. */
const MAX_SPEED_KMH = 240;
/** Needle angle at zero speed, and the dial's total sweep, in degrees. */
const NEEDLE_REST_DEGREES = -135;
const NEEDLE_SWEEP_DEGREES = 270;
/** The dial's full sweep arc (300 × 300 view box), drawn once and lit up to the needle by stroke-dashoffset. */
const FULL_SWEEP_ARC = 'M 44 256 A 150 150 0 1 1 256 256';

/** The dial's ticks, numerals and bezel: static, so they render once and never again. */
const DialFace = memo(function DialFace() {
  return <svg className="dial-face" viewBox="0 0 300 300">{/* ticks + numerals */}</svg>;
});

/** Speedometer: the frame loop writes the needle, the lit arc and the readout — React renders it once. */
export function Speedometer() {
  const needleRef = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<SVGPathElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const shown = useRef({ speed: -1, angle: Number.NaN });

  useFrameLoop(() => {
    // The game writes GlobalState.playerSpeedKmh in its update(); reading it allocates nothing.
    const speedKmh: number = GameManager.GlobalState.playerSpeedKmh ?? 0;
    const fraction = Math.min(1, Math.max(0, speedKmh / MAX_SPEED_KMH));

    const roundedSpeed = Math.round(speedKmh);
    if (roundedSpeed !== shown.current.speed) {
      shown.current.speed = roundedSpeed;
      writeText(readoutRef.current, String(roundedSpeed));
    }
    const angle = Math.round((NEEDLE_REST_DEGREES + NEEDLE_SWEEP_DEGREES * fraction) * 10) / 10;
    if (angle !== shown.current.angle) {
      shown.current.angle = angle;
      if (needleRef.current) needleRef.current.style.transform = `rotate(${angle}deg)`;
      if (sweepRef.current) sweepRef.current.style.strokeDashoffset = String(1 - fraction);
    }
  });

  return (
    <div className="speedometer">
      <DialFace />
      <svg className="dial-sweep" viewBox="0 0 300 300">
        <path ref={sweepRef} d={FULL_SWEEP_ARC} pathLength={1} strokeDasharray="1 1" style={{ strokeDashoffset: 1 }} />
      </svg>
      <div ref={needleRef} className="dial-needle" />
      <span ref={readoutRef} className="dial-readout">0</span>
    </div>
  );
}
```

```typescript
// The game side, in the SceneController or the vehicle's own component: publish, never push.
protected update(): void {
    GameManager.GlobalState.playerSpeedKmh = this.vehicle.getSpeedKmh();
}
```

A bar is the same pattern with one line: `fillRef.current.style.transform = \`scaleX(${fraction})\`` (CSS
`transform-origin: left`). A timer writes `writeText(timerRef.current, formatted)` only when its shown digits change.
Several widgets share the HUD's one `useFrameLoop`, or each calls it in its own component — never `setInterval`, never
a loop per value.

Throttled readouts and a hidden HUD go through the same loop (cadences 4 and 5):

```tsx
// src/chrome/race-info.tsx — standings and distance refresh at 10 Hz, and nothing runs while the HUD is hidden
import { useEffect, useRef } from 'react';
import GameManager from '../globals';
import { useFrameLoop, writeText } from './hud-frame';

/** Distance and standings are read, not watched: 10 writes a second is all the eye can use. */
const SLOW_WRITE_INTERVAL_MS = 100;

/** Distance to the finish and the player's place, written by the HUD's frame loop at a throttled rate. */
export function RaceInfo() {
  const distanceRef = useRef<HTMLSpanElement>(null);
  const placeRef = useRef<HTMLSpanElement>(null);
  const lastSlowWriteMs = useRef(0);
  // Kept in a ref, not React state: the loop reads it every frame and a pause must not re-render the HUD.
  const isHudVisible = useRef(true);

  useEffect(() => {
    const onPause = (data: { paused: boolean }): void => { isHudVisible.current = !data.paused; };
    GameManager.EventBus.OnMessage('game:pause', onPause);
    return () => GameManager.EventBus.RemoveHandler('game:pause', onPause);
  }, []);

  useFrameLoop((timeMs) => {
    if (!isHudVisible.current) return;                                   // cadence 5: nothing shown, no work
    if (timeMs - lastSlowWriteMs.current < SLOW_WRITE_INTERVAL_MS) return; // cadence 4: throttled
    lastSlowWriteMs.current = timeMs;
    const distanceMeters: number = GameManager.GlobalState.distanceToFinishMeters ?? 0;
    writeText(distanceRef.current, `${Math.round(distanceMeters)} m`);
    writeText(placeRef.current, String(GameManager.GlobalState.racePlace ?? 1));
  });

  return (
    <div className="race-info">
      <span ref={distanceRef} className="race-distance">0 m</span>
      <span ref={placeRef} className="race-place">1</span>
    </div>
  );
}
```

When the overlay unmounts the HUD behind a modal (as the `CustomOverlay` example above does with `{!hasModal && …}`),
the loop stops with it and no flag is needed.

### Self-check before you report a HUD done

- [ ] Every per-frame value is classified as telemetry and reaches the screen only through the frame loop and refs.
- [ ] Inside `requestAnimationFrame` callbacks, `useFrameLoop`, `scene.onBeforeRenderObservable` / `onAfterRenderObservable`
      and a component's `update()` / `late()` / `after()`, there is no `set…(` state setter, no `dispatch(`, no store
      update and no unconditional `EventBus.PostMessage(` (a post guarded by a changed-value check is an event, and allowed).
      Search for them; any hit is a violation to fix.
- [ ] No HUD element writes `width`, `height`, `top`, `left`, `innerHTML` or SVG geometry per frame, and the loop reads no layout.
- [ ] Static furniture is memoized or static, and the loop skips unchanged values.
- [ ] Every element has the cheapest cadence that shows it correctly (**Per frame or not**): state on events,
      decorative motion in CSS, the frame loop only for telemetry, throttled readouts at a few hertz.
- [ ] Menus, pause / settings / results screens, the splash, the preloader and the landing page run no frame loop
      (a real-time hero excepted, and it stops off-screen and at rest). Search them for `requestAnimationFrame`,
      `useFrameLoop`, `setInterval` and animation-library ticks; motion there is CSS.
- [ ] The HUD's loop does nothing while the HUD is hidden, covered by a modal or the game is paused, and no element
      the loop writes has a CSS `transition`.
- [ ] When the game can be profiled, `bt-profile` shows the `react` owner near 0% during play.

## Choosing the UI Layer — Native GPU GUI vs DOM React vs Raw HTML

This is the **most critical architectural decision** when building game UI. Choose the wrong layer and you will fight z-ordering, compositing, input event conflicts, or severe performance issues.

#### Decision Matrix

| Requirement | DOM Overlay (React/CustomOverlay) | GPU GUI (@babylonjs/gui) | Raw HTML / CSS |
|-------------|----------------------------------|--------------------------|----------------|
| Score, ammo, lap, position HUD (discrete state) | ✅ Best — zero GPU cost | ✅ OK | ❌ Avoid |
| Speed, RPM, needles, timers, bars — values that change every frame | ✅ Best — refs + one frame loop, **never React state** (Live HUD Values — ENFORCED) | ⚠️ Each change re-lays out, redraws and re-uploads the whole GUI texture | ❌ Avoid |
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

5. **Whatever the layer, per-frame values follow Live HUD Values — ENFORCED.** In the DOM: refs and one frame loop, never React state. In `@babylonjs/gui`: change a control's property only when its shown value changes. Choosing GPU GUI is never a way to make per-frame updates cheap — it makes them dearer.

#### Unity-authored UI (exported Canvas / UIDocument)

A Unity level can carry its own UI. uGUI Canvases (Overlay, Camera and World Space) and UI Toolkit documents export (Pro) and are rebuilt in Babylon GUI with Unity's layout rules (`unity-authoring-recipes.md` §17; scripting API `TOOLKIT.UserInterface` in `10-ProComponents.md`).

| Situation | Layer |
|---|---|
| The scene (incl. an Asset Store scene) already has a Canvas / UIDocument | Keep it — it exports as authored; script it with `TOOLKIT.UserInterface` |
| In-world panels, terminals, cockpit screens designed in the level | World Space Canvas / UIDocument |
| A HUD the level designer positions and previews in Unity | Overlay Canvas |
| Text-heavy menus, settings, store, chat, front-end pages | DOM React (`CustomOverlay`) |
| UI built at runtime from data; labels tracking characters | `@babylonjs/gui` from a script (`linkWithMesh`); reuse `TOOLKIT.UserInterface.GetForegroundTexture(scene)` as the fullscreen ADT |

Overlay Unity UI is drawn after post-processing; Camera / World Space canvases are post-processed, as in Unity. Never rebuild an exported Unity UI in DOM as well — one layer per logical UI (rule 4).

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
