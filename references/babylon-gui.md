# BabylonJS GUI Reference (1.0.0)

**IMPORTANT. THIS DOCUMENT IS THE COMPLETE `@babylonjs/gui` API REFERENCE. READ IT TO THE END OF FILE
BEFORE WRITING ANY GPU GUI CODE.**

This is the companion to `references/ui-design-system.md`. That document owns the UI *architecture* —
the Babylon Scene Viewer's three layers, the z-index stack, `CustomOverlay`, and the decision matrix
that tells you **when** to reach for GPU GUI instead of DOM React. Read it first if you have not.

**Most in-game UI does not belong here.** HUDs, menus, popups and dialogs are DOM React in
`CustomOverlay` — zero GPU cost, full CSS. Use this document when the UI must be anchored to a 3D mesh
(health bars, name tags, damage numbers), rendered *onto* a mesh surface (cockpit displays, in-world
screens, VR panels), or composited inside the engine's postprocess pipeline.

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

### Code Examples — DOM vs GPU, Side by Side

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

**Follow these rules exactly when generating GPU GUI.**
