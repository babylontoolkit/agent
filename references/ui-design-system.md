# User Interface Instructions (1.0.0)

**IMPORTANT. THIS DOCUMENT PROVIDES CRUCIAL USER INTERFACE INSTRUCTIONS. ALWAYS READ THIS ENTIRE DOCUMENT TO THE END OF FILE BEFORE CREATING, EDITING, OR REVIEWING UI CODE**

## Frontend Design Skill

When asked to `Use Babylon Toolkit Frontend Design Skill` or `Enable Frontend Design Skill` or something close to that, unless otherwise instructed to use another `frontend design` skill, use the `Babylon Toolkit Frontend Design Skill` located at https://raw.githubusercontent.com/babylontoolkit/agent/main/references/ui-frontend-design.md.

Use `frontend design` skills for:

* visual hierarchy
* layout quality
* responsiveness
* interaction polish
* production-grade UI details

### Host Platform Design Skill

Make sure to use any specialty host platform design skills. Like any moredern and create 3D interavtive web content design skills.

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

**File:** `src/babylon/custom/loading.tsx`

**What it is:** The `DefaultBabylonPreloader` is a React `Suspense` fallback component. It is shown immediately when the user navigates to the `/play` route — **before** any Babylon code, engine, or scene has loaded. Its purpose is to communicate the *initial download suspense state*: the moment the user is waiting for the Babylon runtime bundle, wasm physics, and other heavy JavaScript to arrive from the network.

**When it appears:**
- Shown by React's `<Suspense fallback={<DefaultBabylonPreloader />}>` boundary
- Displayed while the lazy-loaded `BabylonMount` chunk downloads over the network
- Replaced by the SplashScreen once the engine initializes

**Design intent:** Minimal, branded, non-interactive. It should convey "the game is loading" with a sense of *downloading suspense* — something is coming, it is heavy, and it is worth waiting for. Think of a game's very first loading bar before the title screen even appears. Use the project's `babylon.png` logo and `spinner.png` (both copied to `/public/`) as the default branded assets.

**Customization example:**
```tsx
// src/babylon/custom/loading.tsx
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

**File:** `src/babylon/custom/splash.tsx` + `src/babylon/custom/splash.css`

**What it is:** The `SplashScreen` is the full-screen animated loading screen shown *inside* the `BabylonSceneViewer` while the engine initializes, the GLTF scene loads from CDN/S3, the physics engine starts, and the `SceneController.createScene()` method runs. It subscribes to `GameManager.EventBus.OnMessage("OnLoadProgress", ...)` and shows live progress messages.

**When it appears:**
- Immediately after the Babylon engine is created (replaces the preloader)
- Covers the canvas at `z-index 9999` for the full duration of asset loading
- Auto-hidden by `TOOLKIT.SceneManager.HideSplashScreen()` after `hideSplashScreenDelayMs` (default 3000ms) once `createScene()` completes

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
// src/babylon/custom/splash.tsx
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
  this.hideSplashScreenDelayMs = 2000; // ms after createScene() completes
}
```

* Important: The `preloader` and `splash screen` **SHOULD** look very similar if not the same. The only differene is the preloader should be less animated than the splash screen because it is the `React Suspense` or downloading state.

---

### Layer 3 — CustomOverlay (Master In-Game UI Layer)

**File:** `src/babylon/custom/overlay.tsx` + `src/babylon/custom/overlay.css`

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
// src/babylon/custom/overlay.tsx
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

## BabylonJS GUI

### Overview — Native GPU-Accelerated GUI

The `@babylonjs/gui` package provides a **fully GPU-accelerated user interface system** built on top of a `DynamicTexture`. Unlike DOM-based React components, BabylonJS GUI controls are rendered by the WebGPU/WebGL engine directly — making them ideal for UI that must live **in 3D space**, must be **immune to browser compositing**, or must **render inside the scene** (on mesh surfaces, cockpit screens, world-space labels, etc.).

**Package:** Already installed as part of the Babylon Toolkit library stack.
```bash
npm install @babylonjs/gui
```

**Import:**
```typescript
import * as GUI from '@babylonjs/gui';
// or use the global BABYLON.GUI namespace (available after toolkit initialization)
```

**Official docs:** https://doc.babylonjs.com/features/featuresDeepDive/gui/gui

---

### AdvancedDynamicTexture — The Root Container

All BabylonJS GUI begins with an `AdvancedDynamicTexture`. It is the root surface onto which all controls are drawn. There are two modes:

#### Fullscreen Mode (2D Overlay)
Creates a full-viewport GUI layer rendered by the GPU above the scene. Rescales automatically to match canvas resolution. Only **one fullscreen ADT per scene** is allowed.

```typescript
// In SceneController.createScene():
const adt = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI('GameHUD', true, this.scene);
// Second param: true = foreground (default), false = background

// Set ideal resolution for consistent pixel math:
adt.idealWidth = 1920;
adt.idealHeight = 1080;
// All px values now resolve relative to 1920x1080, scaled to actual canvas size.

// Force the texture to render at ideal resolution (crispness vs performance):
adt.renderAtIdealSize = true;

// For mixed portrait/landscape: use smallest ideal dimension
adt.useSmallestIdeal = true;
```

#### Texture Mode (In-World Surface)
Renders the GUI onto a mesh surface. Use for cockpit displays, in-game monitors, interactive panels, billboards.

```typescript
const plane = BABYLON.MeshBuilder.CreatePlane('screen', { width: 2, height: 1 }, this.scene);
const adt2 = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(plane, 1024, 512);
// Optional 4th param false = disable pointer move events (performance)
const adt2 = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(plane, 1024, 512, false);
```

#### Camera-Facing Texture Mode (Billboard GUI)
GUI on a mesh that always faces the camera — ideal for floating health bars or name labels above characters.

```typescript
plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
const adt3 = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(plane, 512, 128);
```

---

### Controls Reference

All controls share these base properties:

| Property | Type | Default | Notes |
|----------|------|---------|-------|
| `alpha` | number | 1 | Transparency: 0 = invisible, 1 = opaque |
| `color` | string | "Black" | Foreground color |
| `background` | string | — | Background color |
| `fontSize` | number | 18 | Inheritable from parent |
| `fontFamily` | string | "Arial" | Inheritable |
| `fontWeight` | string | — | Inheritable |
| `zIndex` | number | 0 | Z-order within the ADT |
| `isPointerBlocker` | boolean | false | Prevent scene pointer events from passing through |
| `isVisible` | boolean | true | Hidden controls hide all children too |
| `notRenderable` | boolean | false | Hide control but keep children visible |
| `useBitmapCache` | boolean | false | Cache complex controls to a bitmap for performance |

#### TextBlock
```typescript
const label = new BABYLON.GUI.TextBlock('score', 'Score: 0');
label.color = 'white';
label.fontSize = 32;
label.fontWeight = 'bold';
label.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
label.textVerticalAlignment   = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
label.paddingTop    = '20px';
label.paddingLeft   = '20px';
label.textWrapping  = true;
label.resizeToFit   = false;
label.outlineWidth  = 2;
label.outlineColor  = 'black';
// Shadow
label.shadowBlur    = 4;
label.shadowOffsetX = 2;
label.shadowOffsetY = 2;
label.shadowColor   = '#000';
adt.addControl(label);
```

#### Button (Simple, Image, Custom)
```typescript
// Simple text button
const btn = BABYLON.GUI.Button.CreateSimpleButton('btn', 'PLAY');
btn.width = '200px';
btn.height = '60px';
btn.color = 'white';
btn.background = '#7c3aed';
btn.cornerRadius = 8;
btn.fontSize = 20;
btn.onPointerClickObservable.add(() => { /* handle click */ });
btn.onPointerEnterObservable.add(() => { btn.background = '#6d28d9'; });
btn.onPointerOutObservable.add(() => { btn.background = '#7c3aed'; });
adt.addControl(btn);

// Image button (icon + text side by side)
const imgBtn = BABYLON.GUI.Button.CreateImageButton('iconBtn', 'Attack', '/icons/sword.png');

// Image with centered text overlay
const heroBtn = BABYLON.GUI.Button.CreateImageWithCenterTextButton('heroBtn', 'START GAME', '/bg/button_bg.png');

// Custom composite button
BABYLON.GUI.Button.CreateMyCustomButton = (name, text, imageUrl) => {
  const btn = new BABYLON.GUI.Button(name);
  const icon = new BABYLON.GUI.Image(name + '_icon', imageUrl);
  icon.width = '30px'; icon.stretch = BABYLON.GUI.Image.STRETCH_UNIFORM;
  icon.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  const txt = new BABYLON.GUI.TextBlock(name + '_txt', text);
  txt.paddingLeft = '40px';
  btn.addControl(icon);
  btn.addControl(txt);
  return btn;
};
```

#### InputText / InputPassword / InputTextArea
```typescript
const input = new BABYLON.GUI.InputText('playerName', 'Enter name...');
input.width = '300px';
input.height = '44px';
input.color = 'white';
input.background = '#1e1e2e';
input.focusedBackground = '#2a2a3e';
input.thickness = 1;
input.fontSize = 16;
input.autoStretchWidth = false;
input.onTextChangedObservable.add(evt => console.log(evt.target.text));
input.onFocusObservable.add(() => { /* show virtual keyboard? */ });

const password = new BABYLON.GUI.InputPassword('pwd');
const textarea = new BABYLON.GUI.InputTextArea('bio');
textarea.autoStretchHeight = true;
```

#### Slider
```typescript
const slider = new BABYLON.GUI.Slider('volume');
slider.minimum = 0;
slider.maximum = 1;
slider.value = 0.75;
slider.width = '200px';
slider.height = '20px';
slider.color = '#7c3aed';
slider.background = '#1e1e2e';
slider.borderColor = '#ffffff';
slider.thumbWidth = '24px';
slider.isThumbCircle = true;
slider.isVertical = false;
slider.onValueChangedObservable.add(value => { /* set volume */ });

// Image-based slider (custom track + thumb textures)
const imgSlider = new BABYLON.GUI.ImageBasedSlider('healthSlider');
imgSlider.backgroundImage = '/ui/slider_track.png';
imgSlider.valueBarImage = '/ui/slider_fill.png';
imgSlider.thumbImage = '/ui/slider_thumb.png';
```

#### Checkbox / RadioButton
```typescript
// Checkbox
const check = new BABYLON.GUI.Checkbox('mute');
check.width = '24px';
check.height = '24px';
check.color = '#7c3aed';
check.background = '#1e1e2e';
check.isChecked = false;
check.onIsCheckedChangedObservable.add(val => { /* toggle */ });

// Checkbox with auto header label
const checkWithLabel = BABYLON.GUI.Checkbox.AddCheckBoxWithHeader('Enable Music', val => { /* */ });

// RadioButton group
const radio1 = new BABYLON.GUI.RadioButton('diff_easy');
radio1.group = 'difficulty';
radio1.isChecked = true;
const radio2 = new BABYLON.GUI.RadioButton('diff_hard');
radio2.group = 'difficulty';
radio2.isChecked = false;
radio2.onIsCheckedChangedObservable.add(val => { if (val) setDifficulty('hard'); });
```

#### Image
```typescript
const img = new BABYLON.GUI.Image('logo', '/ui/logo.png');
img.width = '256px';
img.height = '64px';
img.stretch = BABYLON.GUI.Image.STRETCH_UNIFORM;
// STRETCH_NONE / STRETCH_FILL / STRETCH_UNIFORM / STRETCH_EXTEND / STRETCH_NINE_PATCH
img.detectPointerOnOpaqueOnly = true; // Only fire events on non-transparent pixels

// Sprite sheet animation
img.cellId = 0;
img.cellWidth = 64;
img.cellHeight = 64;
// Increment cellId each frame to animate

// Nine-patch for scalable UI panels
img.stretch = BABYLON.GUI.Image.STRETCH_NINE_PATCH;
img.sliceLeft = 10; img.sliceRight = 10;
img.sliceTop  = 10; img.sliceBottom = 10;
```

#### Line / MultiLine
```typescript
// Draw a line between two screen points
const line = new BABYLON.GUI.Line('connector');
line.x1 = 100; line.y1 = 100;
line.x2 = 400; line.y2 = 300;
line.lineWidth = 2;
line.color = '#7c3aed';
line.dash = [5, 3]; // Dashed line pattern
adt.addControl(line);

// MultiLine connecting meshes, controls, and points
const multi = new BABYLON.GUI.MultiLine('pathLine');
multi.lineWidth = 1;
multi.color = 'yellow';
adt.addControl(multi);
multi.push({ mesh: enemyMesh });
multi.push({ control: mapIcon });
multi.push({ x: '50%', y: '50%' });
```

#### ColorPicker
```typescript
const picker = new BABYLON.GUI.ColorPicker('skinColor');
picker.size = '200px';
picker.onValueChangedObservable.add((color: BABYLON.Color3) => {
  material.diffuseColor = color;
});
```

#### VirtualKeyboard
```typescript
const keyboard = BABYLON.GUI.VirtualKeyboard.CreateDefaultLayout();
keyboard.connect(inputField); // Auto-shows when inputField is focused
// or manual layout:
const kb = new BABYLON.GUI.VirtualKeyboard();
kb.addKeysRow(['1','2','3','4','5','6','7','8','9','0','\u2190']);
kb.addKeysRow(['q','w','e','r','t','y','u','i','o','p']);
kb.onKeyPressObservable.add(key => console.log('Pressed:', key));
```

---

### Containers

#### Rectangle
```typescript
const panel = new BABYLON.GUI.Rectangle('statsPanel');
panel.width = '300px';
panel.height = '200px';
panel.background = 'rgba(0,0,0,0.6)';
panel.color = '#7c3aed';
panel.thickness = 2;
panel.cornerRadius = 12;
panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
panel.verticalAlignment   = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
panel.paddingTop = '20px';
panel.paddingRight = '20px';
adt.addControl(panel);
panel.addControl(label);
```

#### Ellipse
```typescript
const dot = new BABYLON.GUI.Ellipse('dot');
dot.width = '12px'; dot.height = '12px';
dot.background = 'red'; dot.thickness = 0;
```

#### StackPanel (vertical or horizontal)
```typescript
const stack = new BABYLON.GUI.StackPanel('menu');
stack.isVertical = true;    // false for horizontal
stack.width = '220px';
stack.adaptHeightToChildren = true;

['Resume', 'Options', 'Quit'].forEach(label => {
  const btn = BABYLON.GUI.Button.CreateSimpleButton(label, label);
  btn.width = '200px'; btn.height = '50px';
  btn.color = 'white'; btn.background = '#4c1d95';
  btn.paddingBottom = '8px';
  stack.addControl(btn);
});

adt.addControl(stack);
```

#### ScrollViewer (scrollable area)
```typescript
const sv = new BABYLON.GUI.ScrollViewer('inventory');
sv.width = '400px';
sv.height = '500px';
sv.color = '#7c3aed';
sv.background = '#0d0d1a';
sv.thickness = 1;
const innerStack = new BABYLON.GUI.StackPanel();
innerStack.width = '100%';
innerStack.adaptHeightToChildren = true;
sv.addControl(innerStack);
// Add any number of children to innerStack — scroll appears automatically
```

#### Grid (rows + columns layout)
```typescript
const grid = new BABYLON.GUI.Grid('layout');
grid.addColumnDefinition(100, true);   // 100px fixed
grid.addColumnDefinition(0.5);         // 50% of remaining
grid.addColumnDefinition(0.5);         // 50% of remaining
grid.addColumnDefinition(100, true);   // 100px fixed
grid.addRowDefinition(0.5);
grid.addRowDefinition(0.5);

const cell = new BABYLON.GUI.Rectangle();
cell.background = 'green';
grid.addControl(cell, 0, 1);   // row 0, col 1
```

---

### Layout, Sizing, and Alignment

```typescript
// Pixel values
control.width = '200px';
control.height = '50px';
control.left = '10px';
control.top = '10px';

// Percentage values (relative to parent)
control.width = '50%';
control.height = '10%';

// Unit-less (treated as percentage)
control.width = 0.5;   // same as "50%"

// Alignment constants
control.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;   // 0
control.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER; // 2
control.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;  // 1
control.verticalAlignment   = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;      // 0
control.verticalAlignment   = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;   // 2
control.verticalAlignment   = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;   // 1

// Padding (internal — reduces usable space)
control.paddingTop    = '10px';
control.paddingBottom = '10px';
control.paddingLeft   = '10px';
control.paddingRight  = '10px';

// Rotation + scale (post-layout transforms)
control.rotation = Math.PI / 6;  // radians
control.scaleX   = 1.2;
control.scaleY   = 1.2;
```

---

### World-Space Tracking (Link GUI to 3D Mesh)

Attach a GUI control to a 3D mesh so it follows the mesh in screen space — perfect for health bars above enemies, tooltip labels, damage numbers, name tags.

```typescript
// In createScene():
const healthBar = new BABYLON.GUI.Rectangle('enemyHP');
healthBar.width = '120px';
healthBar.height = '12px';
healthBar.background = 'red';
healthBar.thickness = 0;
adt.addControl(healthBar);   // Must be at ROOT level of ADT (not in a container)

// Link to mesh — control follows mesh position in screen space
healthBar.linkWithMesh(enemyMesh);
healthBar.linkOffsetY = -80;    // Offset upward above the character

// Disconnect tracking:
healthBar.linkWithMesh(null);

// Move to an exact 3D world position (one-shot, no tracking):
damageLabelControl.moveToVector3(hitPosition, this.scene);
```

---

### Styles (Shared Visual Tokens)

```typescript
const style = adt.createStyle();
style.fontSize = 20;
style.fontFamily = 'Rajdhani, sans-serif';
style.fontStyle = 'normal';
style.fontWeight = '600';

// Apply to multiple controls
[scoreLabel, healthLabel, ammoLabel].forEach(c => c.style = style);
// Style values override per-control values
```

---

### Performance Optimization

```typescript
// Bitmap cache: pre-render complex controls to a static bitmap.
// Use for controls with many children that don't change every frame.
complexControl.useBitmapCache = true;

// Invalidate rect optimization (on by default): only re-renders changed regions.
// Turn off if you have unclipped children that move across container boundaries.
adt.useInvalidateRectOptimization = false;

// Adaptive scaling: set ideal resolution once and all pixel values scale automatically.
adt.idealWidth = 1920;
adt.renderAtIdealSize = false; // false = render at canvas res (sharp), true = at idealWidth (perf)

// PostProcess isolation: use layerMask + second camera so post-effects don't apply to GUI
const guiCamera = new BABYLON.ArcRotateCamera('guiCam', 0, 0, 10, BABYLON.Vector3.Zero(), scene);
guiCamera.layerMask = 2;
adt.layer.layerMask = 2;
// Main scene meshes and camera use layerMask = 1 (default)

// HighDPI / Retina: enable adaptToDeviceRatio on engine init for crisp text at cost of perf
const engine = new BABYLON.Engine(canvas, true, { adaptToDeviceRatio: true });
adt.renderScale = window.devicePixelRatio; // match device pixel ratio
```

---

### Events Reference

All controls expose these observables:

| Observable | Fires When |
|------------|-----------|
| `onPointerMoveObservable` | Cursor moves over control (fullscreen mode only) |
| `onPointerEnterObservable` | Cursor enters control |
| `onPointerOutObservable` | Cursor leaves control |
| `onPointerDownObservable` | Pointer pressed on control |
| `onPointerUpObservable` | Pointer released on control |
| `onPointerClickObservable` | Complete click (down + up over same control) |

```typescript
btn.onPointerClickObservable.add(() => handleAction());
btn.onPointerEnterObservable.add(() => btn.scaleX = btn.scaleY = 1.05);
btn.onPointerOutObservable.add (() => btn.scaleX = btn.scaleY = 1.0);

// Pointer coordinates (fullscreen mode):
control.onPointerDownObservable.add(vec2 => {
  const local = control.getLocalCoordinates(vec2); // In control's local space
});

// Make a control invisible to pointer events (click-through):
control.isHitTestVisible = false;
```

---

### When to Use Native GPU GUI vs DOM React vs Raw HTML

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

#### Code examples side by side

```typescript
// ── SCENARIO: Player health bar ──────────────────────────────────────────────

// ✅ DOM approach (CustomOverlay) — best for most games
// In overlay.tsx:
<div className="health-bar-bg">
  <div className="health-bar-fill" style={{ width: `${hp}%` }} />
</div>
// Driven by: GameManager.EventBus.PostMessage('hud:hp', { hp: 73 });

// ✅ GPU approach (@babylonjs/gui) — best when anchored to 3D character
// In createScene():
const adt = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI('HUD', true, scene);
const bar = new BABYLON.GUI.Rectangle('hpBar');
bar.width = '120px'; bar.height = '10px';
bar.background = 'red'; bar.thickness = 0;
adt.addControl(bar);
bar.linkWithMesh(playerMesh);
bar.linkOffsetY = -90;
// Update: bar.width = `${hp * 1.2}px`;
```

```typescript
// ── SCENARIO: In-game pause menu ─────────────────────────────────────────────

// ✅ DOM approach (CustomOverlay) — ALWAYS use this for menus
// In overlay.tsx (see full example above)
// Full CSS, Tailwind, animations, transitions — no GPU cost

// ❌ GPU approach — possible but painful; no CSS, limited layout, poor text quality
// Avoid for menus unless building a VR/WebXR experience where DOM is invisible
```

```typescript
// ── SCENARIO: In-game monitor / cockpit screen ───────────────────────────────

// ✅ GPU texture mode — ONLY option for on-mesh rendering
// In createScene():
const screen = BABYLON.MeshBuilder.CreatePlane('cockpitScreen', { width: 0.8, height: 0.5 }, scene);
screen.position = new BABYLON.Vector3(0, 1.2, 0.4); // Position inside cockpit
const cockpitADT = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(screen, 512, 256);
const speedText = new BABYLON.GUI.TextBlock('speed', '0 km/h');
speedText.color = '#00ff88';
speedText.fontSize = 48;
cockpitADT.addControl(speedText);
// Update each frame: speedText.text = `${Math.round(speed)} km/h`;

// ❌ DOM approach — physically impossible to render a DOM element on a 3D mesh
```

---

**Follow these rules exactly when generating user interfaces.**
