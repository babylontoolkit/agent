# HTML5 Gamepad Support — Gameplay And Every Screen (1.0.0)

**IMPORTANT. READ THIS WHOLE DOCUMENT BEFORE YOU ADD, SPEC, PLAN, BUILD OR REVIEW GAMEPAD SUPPORT.** That applies
whatever form the request takes: a prompt ("add gamepad support", "make it work with a controller", "Xbox / PlayStation
pad"), a line in a spec or plan, a follow-up, or a bug ("my pad does nothing", "can't use the menus with a controller").

**Gamepad support is opt-in.** Never add it to a design, landing page, prototype or game that did not ask for it. **When
it is asked for, this is what it means: the whole game, at the level this document sets.** It always covers both halves
together:

1. **Gameplay input.** Every action the player can take with the keyboard also has a pad input. Sticks and triggers are
   analog, and toggles fire once per press. All of it is read through `TOOLKIT.InputController`.
2. **Interface input and navigation.** Every screen can be driven with the pad alone: home or title, menus, steps, lobby,
   pause, results, settings, How to Play, dialogs and the error card. The D-pad or left stick moves focus spatially, A
   chooses, B goes back, and screens stacked on top of each other (the pause menu over the HUD) hand the pad to the
   top one. A clear focus cursor shows while the pad drives. Button prompts swap between pad glyphs (a circled **A**
   OK, a circled **B** Back) and keyboard keys (**Enter** OK, **Esc** Back) depending on the last input used.

Gamepad support that covers only gameplay, or only menus, is not finished. A screen the pad cannot reach is treated
like a build error: the task is not done until it is fixed.

The pattern in this document was built and verified in a shipped Babylon Toolkit game, then refined through hands-on
review. Copy the code here as written (only the CSS class names are project-specific) instead of inventing a new
navigator. It follows **Coding Practices — ENFORCED** and **Game UI Performance — ENFORCED**. Read this together with
`ui-design-system.md` (layer choice, HUD performance) and `scene-components.md` (`TOOLKIT.InputController`).

---

## 1. The architecture at a glance

| Half | Owner | Runs when | Reads the pad with |
|---|---|---|---|
| Gameplay | The game's input reader module (`src/scripts/input/GameInput.ts` or the project's equivalent), polled by script components | The scene is playing | `TOOLKIT.InputController` (slots, triggers, D-pad, dead zones, up to 4 players) |
| Interface | `GamepadMenuNavigator` (one shared poller) + `GamepadMenuRules` (pure) + `useGamepadMenuNavigation` (the React hook) in `src/chrome/input/` (or `src/ui/input/`) | At least one navigable surface is mounted, a pad is connected and the tab is visible | `navigator.getGamepads()`, standard mapping only |

**The hand-over is automatic.** While the player is playing, no surface is mounted, so the navigator's poll is stopped
and the toolkit owns the pad. When the pause menu (or results, or any overlay) mounts, it registers as the top-most
surface and the navigator drives it. When it unmounts, the poll stops again. The two never fight over a button. The
navigator ignores whatever was already held on its first frame, so the Start that opened the pause menu is not acted
on.

Why two readers: `TOOLKIT.InputController` exists only once a Babylon scene is running, and the front end (home page,
menus, a disclaimer page) runs before any scene is loaded and without one. The DOM navigator needs no scene.

---

## 2. Gameplay input

### 2.1 The toolkit owns the pad — never write your own gameplay pad reader

Enable input once (`SceneManager.InitializeRuntime(engine, { enableUserInput: true })` or
`InputController.EnableUserInput(...)`), then read the pad only through `TOOLKIT.InputController`
(`training/components/09-InputController.md`). The toolkit already handles what breaks hand-written readers:

- **First-free player slots.** A connecting pad takes the lowest empty player slot, whatever index the browser gave
  it. A lone pad that Chrome numbers 1 or higher (after a reconnect, or with a virtual device holding index 0) is still
  player one.
- **Generic standard-mapped pads behave like Xbox pads.** Babylon makes an Xbox pad only from an "Xbox"/"xinput" id and
  a DualShock only from Sony's vendor id; everything else (8BitDo, Logitech, PowerA, Switch Pro, DualSense, most USB pads)
  is a `GenericPad`. For a generic pad whose browser mapping is `"standard"`, the toolkit feeds buttons 6 and 7 into
  the analog triggers and buttons 12–15 into the D-pad, so `GetGamepadTriggerInput` and `GetGamepadDirectionInput` work.
- **Clean disconnects.** Unplugging a pad frees its slot and clears its held state, so nothing stays stuck and the
  next pad takes the slot.
- **Logging.** The console shows `Gamepad One Connected: <id>` / `Gamepad One Disconnected: <id>`, which is the first
  thing to check on a "my pad does nothing" report.

Babylon quirks that are not bugs in your code: a DualSense (`054c`/`0ce6`) is a `GenericPad` (fine, because it is
standard-mapped), and Babylon keeps the pad class of the first pad seen at a browser index until the page reloads.

### 2.2 One input reader module — every action reads keyboard OR pad

Put every gameplay input behind one small module of named readers. Script components call
`isJumpHeld()`, `readMoveX()` and so on, and never touch key codes or button indices themselves. The keyboard bindings
are **pure data** in their own file (`KeyBindings.ts`, no Babylon import), so the How to Play page (§3.8) can render
from the same table and can never show a key the game does not bind.

```typescript
import { Xbox360Button } from "@babylonjs/core/Gamepads/xboxGamepad";
import * as TOOLKIT from "@babylonjs-toolkit/next";
import { KEY_BINDINGS } from "./KeyBindings";

/** Toolkit trigger index of the left trigger. */
const LEFT_TRIGGER: number = 0;

/** Toolkit trigger index of the right trigger. */
const RIGHT_TRIGGER: number = 1;

/** Trigger travel below this counts as released (0 to 1). */
const TRIGGER_DEADZONE: number = 0.1;

/** Stick deflection below this counts as centred (0 to 1). */
const STICK_DEADZONE: number = 0.15;

/**
 * Tells whether any of the keys is down.
 * @param keyCodes Toolkit key codes.
 * @returns True when at least one key is held.
 */
function isAnyKeyDown(keyCodes: readonly number[]): boolean {
    return keyCodes.some((keyCode: number) => TOOLKIT.InputController.GetKeyboardInput(keyCode) === true);
}

/**
 * Tells whether a gamepad button is down (player one).
 * @param button `Xbox360Button` index; any standard-mapped pad uses the same indices.
 * @returns True while the button is held.
 */
function isButtonDown(button: number): boolean {
    return TOOLKIT.InputController.GetGamepadButtonInput(button) === true;
}

/**
 * Tells whether a trigger is pulled past the dead zone.
 * @param trigger Trigger index (0 left, 1 right).
 * @returns True when pulled.
 */
function isTriggerPulled(trigger: number): boolean {
    return TOOLKIT.InputController.GetGamepadTriggerInput(trigger) > TRIGGER_DEADZONE;
}

/** Primary action: Space / gamepad A. */
export function isPrimaryHeld(): boolean {
    return isAnyKeyDown(KEY_BINDINGS.primary) || isButtonDown(Xbox360Button.A);
}

/** Fire: J / gamepad right trigger (analog). */
export function isFireHeld(): boolean {
    return isAnyKeyDown(KEY_BINDINGS.fire) || isTriggerPulled(RIGHT_TRIGGER);
}

/**
 * Horizontal movement in [-1, 1], positive right: keys are digital, the left stick is analog.
 * @returns The movement input.
 */
export function readMoveX(): number {
    const leftHeld: boolean = isAnyKeyDown(KEY_BINDINGS.moveLeft);
    const rightHeld: boolean = isAnyKeyDown(KEY_BINDINGS.moveRight);
    if (leftHeld !== rightHeld) return rightHeld ? 1 : -1;
    const stick: number = TOOLKIT.InputController.GetUserInput(TOOLKIT.UserInputAxis.Horizontal);
    if (Math.abs(stick) < STICK_DEADZONE) return 0;
    return Math.max(-1, Math.min(1, stick));
}

/** Pause on the gamepad (Start). Keyboard pause keys are read from window key events (§2.4). */
export function isPauseButtonHeld(): boolean {
    return isButtonDown(Xbox360Button.Start);
}

/** Turns a held signal into a one-frame press, so toggles fire once per press. */
export class PressDetector {
    /** Whether the signal was held on the previous sample. */
    private wasHeld: boolean = false;

    /**
     * Samples the signal.
     * @param isHeld Whether the signal is held now.
     * @returns True only on the sample where the signal goes from released to held.
     */
    public sample(isHeld: boolean): boolean {
        const pressed: boolean = isHeld && !this.wasHeld;
        this.wasHeld = isHeld;
        return pressed;
    }
}
```

(UMD: `TOOLKIT.InputController` and `BABYLON.Xbox360Button`, same calls.) Rules for the readers:

- **Every keyboard action has a pad input.** List the game's actions and check them off. A keyboard-only action (a
  camera toggle on F, say) is a gap: give it a pad input, usually a stick click or a spare face button.
- **Toggles go through a `PressDetector`** (or `InputController.IsGamepadButtonTapped`), so one press toggles once.
- **Analog stays analog.** Triggers are read with `GetGamepadTriggerInput` (0 to 1) and the left stick through
  `GetUserInput(Horizontal / Vertical)`. The right stick arrives on `UserInputAxis.MouseX / MouseY`; there are no trigger or
  right-stick members on `UserInputAxis`.
- **Read the raw stick when the merged axis lies.** `GetUserInput(Vertical)` falls back to the keyboard's part when the
  stick is centred, so a key held into a mode switch can arrive "through the stick". When that matters, read
  `InputController.GetGamepad()?.leftStick` directly and honour `UserInputOptions.GamepadLStickYInverted`.
- **Name every index and threshold** (`STICK_DEADZONE`, `TRIGGER_DEADZONE`) and write the pad inputs into the reader's
  JSDoc, so the mapping can be read in one place.
- **Multiple local players** pass `TOOLKIT.PlayerNumber.Two`… to the same calls. Readers take the player number as a
  parameter when the game has local multiplayer.

### 2.3 The default button map

Use the standard layout below unless the game copies a known reference game, in which case copy that game's mapping
and record the choice as a Decision. Show Xbox names first and the PlayStation name in brackets in every player-facing
text.

| Standard index | Xbox | PlayStation | Default role |
|---|---|---|---|
| 0 | A | Cross | Primary action (jump, accelerate, interact). **Always confirm / choose in menus** |
| 1 | B | Circle | Secondary action (brake, dodge, crouch). **Always back / cancel in menus** |
| 2 | X | Square | Tertiary action (reload, look back, use) |
| 3 | Y | Triangle | Item, ability or weapon switch |
| 4 / 5 | LB / RB | L1 / R1 | Shoulder actions (drift, item back, cycle) |
| 6 / 7 | LT / RT | L2 / R2 | Analog: aim / brake / fire / accelerate |
| 8 | Back (View) | Share / Create | Map, scoreboard, rear view |
| 9 | Start (Menu) | Options | **Always pause / resume** |
| 10 / 11 | L3 / R3 (stick clicks) | L3 / R3 | Sprint, crouch, camera or first-person toggle |
| 12–15 | D-pad | D-pad | Quick select; **moves menu focus** |
| 16 | Home (Guide) | PS | **Never bound**, because the OS or browser owns it |
| axes 0/1 | Left stick | Left stick | Move / steer; **moves menu focus past 0.5** |
| axes 2/3 | Right stick | Right stick | Camera (toolkit `MouseX / MouseY`) |

Every game keeps the bold roles: menus use A / B / D-pad / left stick, and Start pauses.

### 2.4 Pause — the bridge between the two halves

- **Start toggles pause.** Poll it from the game (`scene.onBeforeRenderObservable`, or the session's `update()`)
  through a `PressDetector`. The game keeps reading Start while paused, so Start closes the pause menu too. Skip the
  toggle while a non-interactive sequence (a flyover, a cutscene) owns the screen.
- **Keyboard pause keys (Escape, P) are read from a `window` `keydown` listener in the capture phase**, not from the
  toolkit's keyboard state. Once the pause menu takes DOM focus, the toolkit stops seeing keys.
- **The pause menu is a navigable surface** (§3.2): it opens focused on Resume, B resumes, and A runs the focused button.
  A compact controller diagram above its buttons (non-interactive, so focus moves only between the buttons) is a
  welcome extra.
- **Also pause on `visibilitychange` (hidden) and on window `blur`**, and release every held input then, so nothing
  stays held when the player comes back.

---

## 3. Interface input and navigation

### 3.1 The three files — copy them

**`GamepadMenuRules.ts`** is pure: no DOM, React or Babylon import, so it can be unit-tested in Node.

```typescript
/**
 * The pure rules of gamepad menu navigation: which direction the pad points, when a held direction repeats, and
 * which focusable element lies next in a direction. No DOM or Babylon import, so the rules are tested in Node.
 */

/** A direction the pad moves menu focus in. */
export type MenuDirection = "up" | "down" | "left" | "right";

/** The part of a W3C `GamepadButton` the rules read. */
export interface IPadButtonState {
    /** True while the button is held down. */
    readonly pressed: boolean;
    /** Analog travel, 0 (released) to 1 (fully pressed). */
    readonly value: number;
}

/** An element's box in viewport pixels; a `DOMRect` satisfies it. */
export interface IMenuRect {
    /** Left edge, pixels. */
    readonly x: number;
    /** Top edge, pixels. */
    readonly y: number;
    /** Width, pixels. */
    readonly width: number;
    /** Height, pixels. */
    readonly height: number;
}

/** Left-stick travel past which the stick counts as a direction (0 to 1). */
export const MENU_STICK_THRESHOLD: number = 0.5;

/** Delay before a held direction repeats for the first time, milliseconds. */
export const MENU_REPEAT_FIRST_MS: number = 400;

/** Delay between later repeats of a held direction, milliseconds. */
export const MENU_REPEAT_NEXT_MS: number = 120;

/** Weight of the cross-axis distance in the focus score: a candidate off to the side counts as twice as far. */
const CROSS_AXIS_WEIGHT: number = 2;

/** Standard-mapping indices of the D-pad buttons, with the direction each one moves. */
const DPAD_DIRECTIONS: readonly { button: number; direction: MenuDirection }[] = [
    { button: 12, direction: "up" },
    { button: 13, direction: "down" },
    { button: 14, direction: "left" },
    { button: 15, direction: "right" },
];

/** Standard-mapping index of the left stick's horizontal axis (negative left). */
const LEFT_STICK_X_AXIS: number = 0;

/** Standard-mapping index of the left stick's vertical axis (negative up). */
const LEFT_STICK_Y_AXIS: number = 1;

/** Unit vector of each direction in screen space (y grows downwards). */
const DIRECTION_VECTORS: Readonly<Record<MenuDirection, { x: number; y: number }>> = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
};

/**
 * Reads the direction a standard-mapped pad points: the D-pad first, else the left stick past `MENU_STICK_THRESHOLD`
 * along its dominant axis.
 * @param buttons The pad's buttons, standard mapping.
 * @param axes The pad's axes, standard mapping.
 * @returns The direction, or null when the pad points nowhere.
 */
export function readMenuDirection(buttons: readonly IPadButtonState[], axes: readonly number[]): MenuDirection | null {
    for (const entry of DPAD_DIRECTIONS) {
        if (buttons[entry.button]?.pressed === true) return entry.direction;
    }
    return readStickDirection(axes[LEFT_STICK_X_AXIS] ?? 0, axes[LEFT_STICK_Y_AXIS] ?? 0);
}

/**
 * The delay until a held direction moves focus again.
 * @param heldMs How long the direction has been held, milliseconds.
 * @returns `MENU_REPEAT_FIRST_MS` before the first repeat, then `MENU_REPEAT_NEXT_MS`.
 */
export function nextRepeatDelay(heldMs: number): number {
    return heldMs < MENU_REPEAT_FIRST_MS ? MENU_REPEAT_FIRST_MS : MENU_REPEAT_NEXT_MS;
}

/**
 * Chooses the element focus moves to: the nearest candidate whose centre lies strictly in the direction's half-plane
 * from the current element's centre, scored by the distance along the direction plus twice the distance across it.
 * @param fromRect The focused element's box.
 * @param candidates The boxes of the focusable elements.
 * @param direction The direction focus moves in.
 * @returns The index of the chosen candidate, or -1 when none lies in that direction.
 */
export function chooseNextFocus(fromRect: IMenuRect, candidates: readonly IMenuRect[], direction: MenuDirection): number {
    const vector: { x: number; y: number } = DIRECTION_VECTORS[direction];
    const fromCentreX: number = fromRect.x + fromRect.width / 2;
    const fromCentreY: number = fromRect.y + fromRect.height / 2;
    let bestIndex: number = -1;
    let bestScore: number = Number.POSITIVE_INFINITY;
    for (let i = 0; i < candidates.length; i++) {
        const candidate: IMenuRect = candidates[i];
        const offsetX: number = candidate.x + candidate.width / 2 - fromCentreX;
        const offsetY: number = candidate.y + candidate.height / 2 - fromCentreY;
        const alongDistance: number = offsetX * vector.x + offsetY * vector.y;
        if (alongDistance <= 0) continue;
        const acrossDistance: number = Math.abs(offsetX * vector.y - offsetY * vector.x);
        const score: number = alongDistance + CROSS_AXIS_WEIGHT * acrossDistance;
        if (score < bestScore) {
            bestScore = score;
            bestIndex = i;
        }
    }
    return bestIndex;
}

/**
 * The direction of the left stick along its dominant axis, when that axis is past the threshold.
 * @param stickX Horizontal travel, -1 (left) to 1 (right).
 * @param stickY Vertical travel, -1 (up) to 1 (down).
 * @returns The direction, or null inside the threshold.
 */
function readStickDirection(stickX: number, stickY: number): MenuDirection | null {
    const isHorizontal: boolean = Math.abs(stickX) >= Math.abs(stickY);
    const dominantTravel: number = isHorizontal ? stickX : stickY;
    if (Math.abs(dominantTravel) <= MENU_STICK_THRESHOLD) return null;
    if (isHorizontal) return stickX > 0 ? "right" : "left";
    return stickY > 0 ? "down" : "up";
}
```

**`GamepadMenuNavigator.ts`** is the one shared poller. It is framework-agnostic: a plain class with no React import.
Change only `PROMPT_BAR_OK_SELECTOR` to match the project's prompt-bar class.

```typescript
import { chooseNextFocus, nextRepeatDelay, readMenuDirection, type IMenuRect, type MenuDirection } from "./GamepadMenuRules";

/**
 * The shared gamepad poller of the DOM screens: it moves focus and clicks inside the top-most registered surface
 * (the title, a menu step, the pause menu, the results, a lobby).
 *
 * The Gamepad API has no button events, so a pad can only be read by polling. That makes this the one deliberate
 * exception to "menus run no frame loop", kept as narrow as it can be:
 * - its `requestAnimationFrame` poll runs only while a surface is registered, a pad is connected and the tab is visible;
 * - it writes to the DOM only on a button press or a direction change (or repeat): `focus()`, `click()` and the
 *   `data-input` attribute on the root element;
 * - it reads layout only when focus moves, holds no React state and posts nothing on the EventBus.
 *
 * During gameplay no surface is mounted, so the poller is stopped and the toolkit `InputController` owns the pad.
 *
 * It also gives the keyboard's Enter the meaning the prompt bar's "Enter OK" promises when no control has focus
 * (focus left on the page, e.g. after a click on the backdrop): Enter clicks the top-most surface's default control —
 * the element marked `data-ok-default` inside it, else the docked prompt bar's OK tab when that tab has an action. A
 * focused control keeps its own Enter, and a game canvas or a text field with focus is left alone.
 */

/** A navigable screen, registered by `useGamepadMenuNavigation`. */
export interface IGamepadMenuSurface {
    /** The surface's root element; read on each move or press, so a re-rendered root is followed. */
    readonly containerRef: { readonly current: HTMLElement | null };
    /** Called on B; a surface with no Back does nothing on B. */
    readonly goBack: () => void;
}

/** Standard-mapping index of the A button (choose). */
const BUTTON_A: number = 0;

/** Standard-mapping index of the B button (back). */
const BUTTON_B: number = 1;

/**
 * A pad whose state changed this recently when the poll starts is the input in use, milliseconds: the Start tap that
 * opened the pause menu is usually released before the menu mounts.
 */
const RECENT_PAD_INPUT_MS: number = 500;

/** The W3C Gamepad mapping the navigator reads. */
const STANDARD_MAPPING: string = "standard";

/** The root element's `data-input` value while the pad is the last input used (the focus look and glyphs key off it). */
const GAMEPAD_INPUT_MODE: string = "gamepad";

/** A surface's default control, the one Enter clicks when nothing has focus (the screen's OK). */
const OK_DEFAULT_SELECTOR: string = "[data-ok-default]:not([disabled])";

/** The docked prompt bar's OK tab when it has an action (PromptBar marks it), the fallback of {@link OK_DEFAULT_SELECTOR}. */
const PROMPT_BAR_OK_SELECTOR: string = ".prompt-bar--docked [data-ok-default]:not([disabled])";

/** Focused elements that handle Enter themselves (or must not lose it): controls, text entry and the game canvas. */
const OWNS_ENTER_SELECTOR: string = 'button, a[href], input, select, textarea, [contenteditable="true"], canvas';

/** The keyboard key of OK. */
const OK_KEY: string = "Enter";

/** The elements focus can move between inside a surface. */
const FOCUSABLE_SELECTOR: string = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The shared gamepad poller; use the `GamepadMenuNavigator` instance. */
class GamepadMenuNavigatorService {
    /** Registered surfaces, oldest first; the last one is top-most and receives the pad. */
    private readonly surfaces: IGamepadMenuSurface[] = [];

    /** Pads the browser reports connected. */
    private connectedPadCount: number = 0;

    /** The pending animation-frame request, or null while the poll is stopped. */
    private frameRequest: number | null = null;

    /** True until the first frame after the poll starts, which only records what is already held. */
    private isFirstFrame: boolean = true;

    /** Whether A was held on the previous frame (A acts on its press, not while held). */
    private wasChooseHeld: boolean = false;

    /** Whether B was held on the previous frame. */
    private wasBackHeld: boolean = false;

    /** The direction held on the previous frame, or null. */
    private heldDirection: MenuDirection | null = null;

    /** When the held direction was first pressed, animation-frame milliseconds. */
    private directionPressedAt: number = 0;

    /** When the held direction moves focus again, animation-frame milliseconds. */
    private nextRepeatAt: number = Number.POSITIVE_INFINITY;

    /** Whether the root element carries `data-input="gamepad"`. */
    private isGamepadInputMode: boolean = false;

    /**
     * Registers a surface as the top-most one. When the pad is the input in use and nothing in the surface has focus
     * (no `autoFocus` element), its first focusable element is focused, so the pad can act on it at once.
     * @param surface The surface.
     * @returns Unregisters the surface.
     */
    public register(surface: IGamepadMenuSurface): () => void {
        if (this.surfaces.length === 0) this.addWindowListeners();
        this.surfaces.push(surface);
        if (this.isGamepadInputMode) this.focusInitialElement(surface);
        this.updatePoll();
        return (): void => this.unregister(surface);
    }

    /**
     * Removes a surface; the last removal stops the poll and the window listeners.
     * @param surface The surface.
     */
    private unregister(surface: IGamepadMenuSurface): void {
        const surfaceIndex: number = this.surfaces.indexOf(surface);
        if (surfaceIndex < 0) return;
        this.surfaces.splice(surfaceIndex, 1);
        if (this.surfaces.length === 0) this.removeWindowListeners();
        this.updatePoll();
    }

    /** Listens for pads, tab visibility and the pointer / keyboard input that ends gamepad mode. */
    private addWindowListeners(): void {
        window.addEventListener("gamepadconnected", this.onPadsChanged);
        window.addEventListener("gamepaddisconnected", this.onPadsChanged);
        document.addEventListener("visibilitychange", this.onVisibilityChange);
        window.addEventListener("pointermove", this.onPointerMove, { passive: true });
        // Not passive: an Enter this navigator answers cancels its default, so the same key press cannot also
        // activate the control the next screen focuses on arrival.
        window.addEventListener("keydown", this.onKeyDown);
        this.connectedPadCount = countConnectedPads();
    }

    /** Stops listening once no surface is registered. */
    private removeWindowListeners(): void {
        window.removeEventListener("gamepadconnected", this.onPadsChanged);
        window.removeEventListener("gamepaddisconnected", this.onPadsChanged);
        document.removeEventListener("visibilitychange", this.onVisibilityChange);
        window.removeEventListener("pointermove", this.onPointerMove);
        window.removeEventListener("keydown", this.onKeyDown);
    }

    /** A pad connected or disconnected: recounts the pads and starts or stops the poll. */
    private readonly onPadsChanged = (): void => {
        this.connectedPadCount = countConnectedPads();
        this.updatePoll();
    };

    /** The tab was shown or hidden: starts or stops the poll. */
    private readonly onVisibilityChange = (): void => {
        this.updatePoll();
    };

    /**
     * The pointer moved: the mouse or touch is the input again, so the gamepad look goes away.
     * Moves with no travel (the browser's own after-layout moves) are ignored.
     * @param event The pointer event.
     */
    private readonly onPointerMove = (event: PointerEvent): void => {
        if (event.movementX === 0 && event.movementY === 0) return;
        this.leaveGamepadInputMode();
    };

    /**
     * A key was pressed: the keyboard is the input again, and its own `:focus-visible` rings take over. Enter with no
     * control focused clicks the top-most surface's default control (a held key's repeats never do).
     * @param event The key event.
     */
    private readonly onKeyDown = (event: KeyboardEvent): void => {
        this.leaveGamepadInputMode();
        if (event.key !== OK_KEY || event.repeat) return;
        if (this.pressDefaultControl()) event.preventDefault();
    };

    /**
     * Clicks the top-most surface's default control when no element that handles Enter itself has focus.
     * @returns True when a default control was clicked.
     */
    private pressDefaultControl(): boolean {
        const surface: IGamepadMenuSurface | undefined = this.surfaces[this.surfaces.length - 1];
        const focused: Element | null = document.activeElement;
        if (surface == null || (focused != null && focused.matches(OWNS_ENTER_SELECTOR))) return false;
        const defaultControl: HTMLElement | null = surface.containerRef.current?.querySelector<HTMLElement>(OK_DEFAULT_SELECTOR)
            ?? document.querySelector<HTMLElement>(PROMPT_BAR_OK_SELECTOR);
        if (defaultControl == null) return false;
        defaultControl.click();
        return true;
    }

    /** Starts the poll when a surface is registered, a pad is connected and the tab is visible; stops it otherwise. */
    private updatePoll(): void {
        const shouldPoll: boolean = this.surfaces.length > 0 && this.connectedPadCount > 0 && document.visibilityState === "visible";
        if (shouldPoll && this.frameRequest == null) {
            this.isFirstFrame = true;
            this.frameRequest = window.requestAnimationFrame(this.pollFrame);
            return;
        }
        if (!shouldPoll && this.frameRequest != null) {
            window.cancelAnimationFrame(this.frameRequest);
            this.frameRequest = null;
        }
    }

    /**
     * One poll: reads the pad and acts on the top-most surface, then asks for the next frame.
     * @param timestamp The animation-frame time, milliseconds.
     */
    private readonly pollFrame = (timestamp: number): void => {
        this.frameRequest = window.requestAnimationFrame(this.pollFrame);
        const pad: Gamepad | null = findStandardPad();
        const surface: IGamepadMenuSurface | undefined = this.surfaces[this.surfaces.length - 1];
        if (pad == null || surface == null) return;
        const isChooseHeld: boolean = pad.buttons[BUTTON_A]?.pressed === true;
        const isBackHeld: boolean = pad.buttons[BUTTON_B]?.pressed === true;
        const direction: MenuDirection | null = readMenuDirection(pad.buttons, pad.axes);
        if (this.isFirstFrame) {
            this.recordHeldInput(pad, isChooseHeld, isBackHeld, direction, timestamp);
            return;
        }
        if (isChooseHeld && !this.wasChooseHeld) this.choose(surface);
        if (isBackHeld && !this.wasBackHeld) this.back(surface);
        this.wasChooseHeld = isChooseHeld;
        this.wasBackHeld = isBackHeld;
        this.followDirection(surface, direction, timestamp);
    };

    /**
     * The first frame after the poll starts: what is already held (the Start that opened the pause menu, the A that
     * chose the previous screen) is recorded, not acted on. A held input, or a pad used in the last
     * `RECENT_PAD_INPUT_MS`, still means the pad is the input in use.
     * @param pad The pad.
     * @param isChooseHeld Whether A is held.
     * @param isBackHeld Whether B is held.
     * @param direction The direction held, or null.
     * @param timestamp The animation-frame time, milliseconds (the clock `Gamepad.timestamp` uses).
     */
    private recordHeldInput(pad: Gamepad, isChooseHeld: boolean, isBackHeld: boolean, direction: MenuDirection | null, timestamp: number): void {
        this.isFirstFrame = false;
        this.wasChooseHeld = isChooseHeld;
        this.wasBackHeld = isBackHeld;
        this.heldDirection = direction;
        this.nextRepeatAt = Number.POSITIVE_INFINITY;
        const isAnyButtonHeld: boolean = pad.buttons.some((button: GamepadButton) => button.pressed);
        const isRecentlyUsed: boolean = timestamp - pad.timestamp < RECENT_PAD_INPUT_MS;
        if (isAnyButtonHeld || direction != null || isRecentlyUsed) this.enterGamepadInputMode();
    }

    /**
     * Moves focus on a new direction, and again while it is held (after `MENU_REPEAT_FIRST_MS`, then every
     * `MENU_REPEAT_NEXT_MS`).
     * @param surface The top-most surface.
     * @param direction The direction held this frame, or null.
     * @param timestamp The animation-frame time, milliseconds.
     */
    private followDirection(surface: IGamepadMenuSurface, direction: MenuDirection | null, timestamp: number): void {
        if (direction == null) {
            this.heldDirection = null;
            return;
        }
        if (direction !== this.heldDirection) {
            this.heldDirection = direction;
            this.directionPressedAt = timestamp;
            this.nextRepeatAt = timestamp + nextRepeatDelay(0);
            this.moveFocus(surface, direction);
            return;
        }
        if (timestamp < this.nextRepeatAt) return;
        this.nextRepeatAt = timestamp + nextRepeatDelay(timestamp - this.directionPressedAt);
        this.moveFocus(surface, direction);
    }

    /**
     * Moves focus to the nearest enabled focusable element in a direction inside the surface; with nothing focused
     * there, focuses its first focusable element. The only place the navigator reads layout.
     * @param surface The surface.
     * @param direction The direction.
     */
    private moveFocus(surface: IGamepadMenuSurface, direction: MenuDirection): void {
        this.enterGamepadInputMode();
        const focusables: HTMLElement[] = listFocusables(surface);
        const focused: HTMLElement | null = focusedElementIn(surface);
        if (focused == null) {
            focusables[0]?.focus();
            return;
        }
        const fromRect: IMenuRect = focused.getBoundingClientRect();
        const candidateRects: IMenuRect[] = focusables.map((element: HTMLElement) => element.getBoundingClientRect());
        const nextIndex: number = chooseNextFocus(fromRect, candidateRects, direction);
        if (nextIndex >= 0) focusables[nextIndex].focus();
    }

    /**
     * A: clicks the focused element; with nothing focused in the surface, focuses its first focusable element instead.
     * @param surface The surface.
     */
    private choose(surface: IGamepadMenuSurface): void {
        this.enterGamepadInputMode();
        const focused: HTMLElement | null = focusedElementIn(surface);
        if (focused == null) {
            listFocusables(surface)[0]?.focus();
            return;
        }
        focused.click();
    }

    /**
     * B: the surface's Back.
     * @param surface The surface.
     */
    private back(surface: IGamepadMenuSurface): void {
        this.enterGamepadInputMode();
        surface.goBack();
    }

    /**
     * Focuses a newly registered surface's first focusable element when nothing in it has focus yet.
     * @param surface The surface.
     */
    private focusInitialElement(surface: IGamepadMenuSurface): void {
        if (focusedElementIn(surface) != null) return;
        listFocusables(surface)[0]?.focus();
    }

    /** Marks the pad as the input in use: `data-input="gamepad"` on the root element shows the pad look and glyphs. */
    private enterGamepadInputMode(): void {
        if (this.isGamepadInputMode) return;
        this.isGamepadInputMode = true;
        document.documentElement.dataset.input = GAMEPAD_INPUT_MODE;
    }

    /** Clears gamepad mode after a pointer move or key press. */
    private leaveGamepadInputMode(): void {
        if (!this.isGamepadInputMode) return;
        this.isGamepadInputMode = false;
        delete document.documentElement.dataset.input;
    }
}

/**
 * Counts the pads the browser reports connected.
 * @returns The count; 0 when the browser has no Gamepad API.
 */
function countConnectedPads(): number {
    if (typeof navigator.getGamepads !== "function") return 0;
    return navigator.getGamepads().filter((pad: Gamepad | null) => pad != null && pad.connected).length;
}

/**
 * The first connected pad with the standard mapping (the only layout whose A, B and D-pad indices are known).
 * @returns The pad, or null.
 */
function findStandardPad(): Gamepad | null {
    for (const pad of navigator.getGamepads()) {
        if (pad != null && pad.connected && pad.mapping === STANDARD_MAPPING) return pad;
    }
    return null;
}

/**
 * The enabled focusable elements of a surface, in document order.
 * @param surface The surface.
 * @returns The elements; empty when the surface has no root element.
 */
function listFocusables(surface: IGamepadMenuSurface): HTMLElement[] {
    const container: HTMLElement | null = surface.containerRef.current;
    if (container == null) return [];
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/**
 * The focused element when it is inside the surface.
 * @param surface The surface.
 * @returns The element, or null when focus is elsewhere (or nowhere).
 */
function focusedElementIn(surface: IGamepadMenuSurface): HTMLElement | null {
    const container: HTMLElement | null = surface.containerRef.current;
    const focused: Element | null = document.activeElement;
    if (container == null || !(focused instanceof HTMLElement) || focused === container) return null;
    return container.contains(focused) ? focused : null;
}

/** The one shared gamepad poller of the DOM screens. */
export const GamepadMenuNavigator: GamepadMenuNavigatorService = new GamepadMenuNavigatorService();
```

**`useGamepadMenuNavigation.ts`** is the React adapter.

```typescript
import { useEffect, useRef, type RefObject } from "react";
import { GamepadMenuNavigator } from "./GamepadMenuNavigator";

/** Options of a gamepad-navigable surface. */
export interface IGamepadMenuOptions {
    /** Called on B (the menu flow's back, or resume on the pause menu); omit it for a surface with no Back. */
    onBack?: () => void;
}

/**
 * Makes a DOM screen navigable with a gamepad: the D-pad or left stick moves focus between its controls, A clicks the
 * focused one and B calls `onBack`. The surface is registered on mount and unregistered on unmount; the newest mounted
 * surface is the one the pad drives, so the pause menu wins over the HUD. It adds no React state and no render: the
 * shared `GamepadMenuNavigator` polls the pad only while a surface is mounted and a pad connected.
 * @param containerRef The surface's root element.
 * @param options The surface's Back.
 */
export function useGamepadMenuNavigation(containerRef: RefObject<HTMLElement | null>, options: IGamepadMenuOptions = {}): void {
    const onBackRef = useRef<(() => void) | undefined>(options.onBack);

    useEffect(() => {
        onBackRef.current = options.onBack;
    }, [options.onBack]);

    useEffect(() => GamepadMenuNavigator.register({ containerRef, goBack: () => onBackRef.current?.() }), [containerRef]);
}
```

**Without React** (vanilla DOM, Vue, Svelte, a static multi-page site), call the navigator directly:
`const unregister = GamepadMenuNavigator.register({ containerRef: { current: screenElement }, goBack: showPreviousScreen });`
when the screen is shown, and `unregister()` when it is hidden. A static **multi-page** site (a mockup, for example)
carries gamepad mode across full page loads by writing `sessionStorage` on `pagehide` and restoring `data-input` on
load.

### 3.2 Surfaces and the stack

A **surface** is one navigable screen: its root element plus its Back. Every screen the player can reach is one. List
them all in a **surface table** in the spec or plan (and in the project's `SPEC.md`), and keep it current:

| Surface | File | B (onBack) | Focus on arrival |
|---|---|---|---|
| Boot / notice dialog | `src/pages/BootNotice.tsx` | none | OK |
| Title / home | `src/pages/Home.tsx` | none | Play |
| Each menu step | `src/pages/menu/*.tsx` | the menu flow's `back` (one step) | the step's primary or last-chosen control |
| Settings, How to Play, Disclaimer and other pages | `src/pages/*.tsx` | back to where it was opened from | Back, or the tab shown |
| Pause menu | `src/chrome/hud/PauseMenu.tsx` | resume | Resume |
| Results (every variant, including the error card) | `src/chrome/hud/Results*.tsx` | none | Next / Restart / Quit |
| Lobby / waiting room | `src/chrome/hud/WaitingRoom.tsx` | none, or leave | Ready / Start |

- **The stack is mount order.** The newest registered surface is top-most and alone receives the pad; when it
  unmounts, the one beneath gets the pad back. A modal opened over a screen registers its own surface, so the pad
  stays inside the modal.
- **Focus on arrival** is an `autoFocus` (or a `focus()` in a layout effect) on the surface's primary control, the one
  its prompt says A does. With no autofocus, the navigator focuses the first control on the first press.
- **The prompt bar sits outside the surface container** and its tabs carry `tabIndex={-1}`, so a D-pad move never
  lands on them: B, A, Escape and Enter already do what the tabs say.
- **The game canvas is never inside a surface.** During gameplay, no surface is mounted.

### 3.3 Make every control reachable

The navigator moves between real focusable elements by their position on screen, so the markup must cooperate:

- **Every control is a real `<button>`, `<a href>`, `<input>` or `<select>`.** A disabled control carries `disabled`, so
  the navigator skips it. `aria-disabled` alone is not enough.
- **Lay controls out on aligned rows and columns** (grids, stacks, steppers), so "nearest in the pressed direction"
  lands where the eye expects. Test every direction from every control on the way through.
- **Nothing is reachable only by mouse.** No hover-only reveals and no drag-only controls. Art or previews that change
  on hover change on `:focus` too: the preview follows focus.
- **Items the player cannot pick are not focusable.** Show them dimmed, with `pointer-events: none`, and render them
  as non-interactive elements, not disabled buttons, unless they really can become enabled.
- **A control that becomes disabled while focused hands focus on.** A stepper's › that hits the maximum focuses its
  sibling ‹ in a layout effect, so the pad cursor is never lost.
- **Long read-only content gets focus stops.** On a How to Play, credits or legal page, give each section
  `tabIndex={0}` so the D-pad can walk down and scroll the page.
- **Nothing focused ends up hidden.** Give the scroll container
  `scroll-padding-bottom: calc(var(--prompt-bar-height) + var(--gutter))` (and a top padding for a top bar), so a
  focused control never sits under a docked bar, especially at phone sizes.
- **Text fields keep their own keys.** Enter in a room-code field submits that field, not the screen's default.

### 3.4 Keyboard parity — the same moves, the same prompts

- **Tab / Shift+Tab** move focus (the browser's own behaviour). **Enter / Space** activate the focused control.
- **Escape is Back.** It calls the same `onBack` as pad B. Wire it once per flow, in the screen shell or the flow owner,
  as one `window` `keydown` listener.
- **Enter is OK even with nothing focused.** Mark each surface's default control with `data-ok-default` (the shown
  choice, Next, Start, Resume, Retry). The navigator clicks it, or the prompt bar's OK tab, and cancels the key's
  default, so one press advances exactly one screen.
- A page-specific Enter handler must call `preventDefault()`, or the same Enter also activates the control the next
  screen autofocuses.

### 3.5 Pointer — one highlighted control at a time

On menu screens the **pointer moves the focus** (`usePointerFocus`), so the hovered control *is* the focused control.
The previews that follow focus then never show two choices at once. Only real pointer travel counts, and moves while
the pad drives or while a text field is being typed into are ignored.

```typescript
import { useEffect, type RefObject } from "react";

/** The controls the pointer can move the menu cursor onto (the same ones the D-pad reaches). */
const POINTER_FOCUSABLE_SELECTOR: string = 'button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

/** The root element's `data-input` value while the pad drives the menus (GamepadMenuNavigator). */
const GAMEPAD_INPUT_MODE: string = "gamepad";

/** Text entry the pointer must never pull the focus out of. */
const TEXT_ENTRY_SELECTOR: string = 'input, textarea, select, [contenteditable="true"]';

/**
 * Whether the user is typing into a text field, which a passing pointer must not interrupt.
 * @returns True while a text entry element has the focus.
 */
function isTyping(): boolean {
    return document.activeElement instanceof Element && document.activeElement.matches(TEXT_ENTRY_SELECTOR);
}

/**
 * Makes the mouse move the menu cursor, as on a console: moving the pointer over a control focuses it, so the focused
 * control is always the one with the cursor. Moves with no distance and moves while the pad drives are ignored, so a
 * resting pointer never steals the autofocus of a screen the pad or keyboard opened. Event-driven: no frame loop and
 * no React state.
 * @param containerRef The menu screen's gamepad container.
 */
export function usePointerFocus(containerRef: RefObject<HTMLElement | null>): void {
    useEffect(() => {
        const container: HTMLElement | null = containerRef.current;
        if (container == null) return undefined;

        const onPointerMove = (event: PointerEvent): void => {
            const hasMoved: boolean = event.movementX !== 0 || event.movementY !== 0;
            const isPadDriving: boolean = document.documentElement.dataset.input === GAMEPAD_INPUT_MODE;
            if (!hasMoved || isPadDriving || isTyping() || !(event.target instanceof Element)) return;
            const control: HTMLElement | null = event.target.closest<HTMLElement>(POINTER_FOCUSABLE_SELECTOR);
            if (control == null || control === document.activeElement || !container.contains(control)) return;
            control.focus({ preventScroll: true });
        };

        container.addEventListener("pointermove", onPointerMove, { passive: true });
        return () => container.removeEventListener("pointermove", onPointerMove);
    }, [containerRef]);
}
```

### 3.6 Input mode and the focus look — CSS on one attribute

The navigator sets `<html data-input="gamepad">` while the pad is the last input used, and removes it on a real
pointer move or any key press. **Everything that depends on the device is CSS on that attribute.** No React state, no
context and no listener of the component's own.

- **The focus look (the cursor)** shows on `:focus-visible` (keyboard), on `:focus` under `[data-input="gamepad"]`
  (pad), and on `:focus` inside a menu screen (pointer moves focus there). It must be bold enough to read across a room:
  scale, fill colour, a pulsing ring or corner brackets. Make sure it shows on every button colour; a highlight the same
  colour as the button is invisible.
- **The hover look is off while the pad drives and on menu screens**, so a pointer resting over another button never
  shows a second cursor.
- **Any other focusable** gets a fallback offset outline while the pad drives.

```css
/* The cursor: keyboard, pad, and pointer-moved focus on menu screens share one look. */
.menu-button:focus-visible,
[data-input="gamepad"] .menu-button:focus,
.menu-screen .menu-button:focus {
    background: var(--button-selected-fill);
    color: var(--button-selected-ink);
    transform: translateX(6px) scale(1.05);
    z-index: 1;
}

.menu-button:focus-visible::after,
[data-input="gamepad"] .menu-button:focus::after,
.menu-screen .menu-button:focus::after {
    opacity: 1;
    animation: focus-ring-pulse 0.9s ease-in-out infinite;
}

/* Hover only when the pad is not driving and not on a menu screen; :where keeps plain :hover specificity. */
@media (hover: hover) {
    .menu-button:where(:not([data-input="gamepad"] *, .menu-screen *)):hover {
        background: var(--button-selected-fill);
        color: var(--button-selected-ink);
    }
}

/* Any other focusable gets the pad's offset ring. */
[data-input="gamepad"] :focus:not(:is(.menu-button, .grid-cursor, .menu-tab)) {
    outline: 3px solid var(--cursor-colour);
    outline-offset: 4px;
}
```

### 3.7 Button prompts — glyphs that follow the input

Every front-end screen docks a **prompt bar** (or prompt row) that says what the buttons do: Back on the left, the
screen's name or selection in the middle, OK on the right. Each prompt carries **both** variants side by side and CSS
shows one:

- **Pad:** a circled letter glyph, **(A)** OK and **(B)** Back (a yellow or white outline circle with the letter on
  dark reads well), plus **(A) Skip**, **(B) Resume**, **(A) Play** as the screen needs.
- **Keyboard:** a key cap, **[Enter]** OK and **[Esc]** Back.

```tsx
import { memo, type ReactNode } from "react";

/** Props of the docked prompt bar. */
export interface IPromptBarProps {
    /** Screen or selection name shown in the centre band. */
    name: ReactNode;
    /** Hint shown beside the name; omitted when empty. */
    hint?: string;
    /** Called by the Back tab (mouse). Omit on screens without Back. */
    onBack?: () => void;
    /** Label of the OK tab; null hides it. Defaults to "OK". */
    okLabel?: string | null;
    /** Called by the OK tab (mouse); without it the tab is a static prompt. */
    onOk?: () => void;
}

/**
 * The OK tab's content: the A glyph (pad) or the Enter key (keyboard), then the label.
 * @param props The label.
 * @returns The tab content.
 */
function OkPrompt(props: { label: string }) {
    return (
        <>
            <span className="glyph" data-device="pad">A</span>
            <span className="key" data-device="keyboard">Enter</span> {props.label}
        </>
    );
}

/**
 * The docked prompt bar: a Back tab, the name band and an OK tab, with pad glyphs (B / A) while
 * `<html data-input="gamepad">` and keyboard keys (Esc / Enter) otherwise — swapped by CSS, no React state. The tabs
 * carry `tabIndex={-1}` and the bar sits outside the screen's gamepad container, so the pad never focuses them. An OK
 * tab with an action carries `data-ok-default`, so Enter with nothing focused does it.
 * @param props The name, hint and tab callbacks.
 * @returns The prompt bar.
 */
function PromptBarComponent(props: IPromptBarProps) {
    const okLabel: string | null = (props.okLabel === undefined) ? "OK" : props.okLabel;
    return (
        <nav className="prompt-bar prompt-bar--docked" aria-label="Button prompts">
            {props.onBack != null && (
                <button type="button" className="prompt-bar__tab prompt-bar__tab--back" tabIndex={-1} onClick={props.onBack}>
                    <span className="glyph" data-device="pad">B</span>
                    <span className="key" data-device="keyboard">Esc</span> Back
                </button>
            )}
            <span className="prompt-bar__band">
                <span className="prompt-bar__name">{props.name}</span>
                {props.hint != null && props.hint !== "" && <span className="prompt-bar__hint">{props.hint}</span>}
            </span>
            {okLabel != null && props.onOk != null && (
                <button type="button" className="prompt-bar__tab prompt-bar__tab--ok" tabIndex={-1} onClick={props.onOk} data-ok-default>
                    <OkPrompt label={okLabel} />
                </button>
            )}
            {okLabel != null && props.onOk == null && (
                <span className="prompt-bar__tab prompt-bar__tab--ok"><OkPrompt label={okLabel} /></span>
            )}
        </nav>
    );
}

/** The docked prompt bar of every front-end screen (memoized: it re-renders only when its labels change). */
export const PromptBar = memo(PromptBarComponent);
```

```css
/* A pad glyph: an outline circle with the letter. */
.glyph {
    display: inline-grid;
    place-items: center;
    width: 1.55em;
    height: 1.55em;
    border: 0.12em solid var(--prompt-accent);
    border-radius: 50%;
    color: var(--prompt-accent);
    font-weight: 900;
    line-height: 1;
}

/* A keyboard key cap. */
.key {
    display: inline-grid;
    place-items: center;
    min-width: 1.6em;
    height: 1.5em;
    padding: 0 0.4em;
    border: 0.1em solid rgba(255, 255, 255, 0.85);
    border-bottom-width: 0.22em;
    border-radius: 0.3em;
    font-size: 0.78em;
    font-weight: 900;
}

/* The swap: keyboard keys by default, pad glyphs while the pad drives. data-show pins one (design sheets). */
[data-device="pad"] { display: none; }
[data-input="gamepad"] [data-device="pad"], [data-show="pad"] [data-device="pad"] { display: inline-grid; }
[data-input="gamepad"] [data-device="keyboard"], [data-show="pad"] [data-device="keyboard"] { display: none; }
[data-show="keyboard"] [data-device="keyboard"] { display: inline-grid; }
[data-show="keyboard"] [data-device="pad"] { display: none; }
```

Any other text that names an input follows the same pattern: "Press **(A)** to start" becomes "Press **[Enter]** to
start", and a pad-specific hint ("‹ › switch tabs") shows only under `[data-input="gamepad"]`. Glyphs use the Xbox
letters by default. PlayStation shapes are an allowed refinement, chosen from the pad id (Sony vendor `054c`) and set
as a second attribute (`data-pad="playstation"`) when the pad connects. Style the prompt bar with the project's own
design system (`ui-design-system.md`, `bt-design`); only the structure and the swap are fixed.

### 3.8 The controls page — one source for both devices

When the game has a front end, give it a **How to Play / Controls** page, opened from the title (and from menu steps)
and never from inside gameplay. Its content comes from one pure module (`src/controls/ControlsContent.ts`, with no
React or Babylon import):

```typescript
/** One action and the inputs that perform it. */
export interface IControlRow {
    /** Stable id: the key-binding action id for gameplay rows, a kebab-case id otherwise. */
    id: string;
    /** What the player does, e.g. "Use item". */
    action: string;
    /** Keyboard keys as shown on screen, built from KEY_BINDINGS through a key-code → label map. */
    keyboardKeys: readonly string[];
    /** Gamepad inputs, Xbox name first with the PlayStation name in brackets, e.g. ["Y (Triangle)"]. */
    gamepadInputs: readonly string[];
}
```

- A **Gamepad / Keyboard tab pair** switches the diagram (a static SVG controller with callouts, a keyboard with the
  bound keys lit). It opens on Gamepad when `data-input="gamepad"` is set at mount, else on Keyboard.
- Sections cover gameplay, any special modes and **Menus** (move: D-pad or left stick / Tab; choose: A / Enter; back:
  B / Esc).
- Unit-test the content: every gameplay action has at least one keyboard key and one gamepad input, and every gamepad
  input except directions names its PlayStation equivalent.
- The page is itself a surface (Back returns to where it was opened), with focus stops on each section (§3.3).

### 3.9 Other UI layers

- **DOM / React is the default** for menus, HUD overlays and dialogs (`ui-design-system.md` decision matrix), and all
  of §3 applies to it.
- **`@babylonjs/gui`** (UI on meshes, in-world screens, WebXR) has no DOM focus. Keep `GamepadMenuRules` as is and
  write a small adapter that keeps a "focused control" index, moves it with `chooseNextFocus` over the controls'
  screen rectangles, highlights it, and clicks on A. Read input through `TOOLKIT.InputController` there, because a
  scene is running.
- **Exported Unity UI** (`TOOLKIT.UserInterface`) does not carry Unity's Selectable navigation. Drive it the same way
  with an adapter script component (`unity-authoring-recipes.md`).

---

## 4. Performance — the one allowed menu poll

`ui-design-system.md` says menus run no frame loop. The navigator's `requestAnimationFrame` poll is the **one
deliberate exception**, because the Gamepad API has no button events and polling is the only way to read a pad. It
is input, not UI animation, and it is kept narrow:

- It runs only while a surface is registered **and** a pad is connected **and** the tab is visible. With no pad, a
  performance trace of a menu shows no animation-frame callbacks from it.
- It writes to the DOM only on a press or a direction step (`focus()`, `click()`, one attribute), and reads layout only
  on a move.
- It holds no React state and posts nothing on the EventBus. Glyph and cursor swaps are pure CSS.
- During gameplay it is stopped, and the toolkit's own input update owns the pad.

Record the exception as a Decision in the spec or plan, so a reviewer does not "fix" it.

---

## 5. Proof — agents test without a physical pad

1. **Unit tests for the rules** (`GamepadMenuRules`): D-pad right gives `"right"`; stick x 0.6 gives `"right"` and 0.3
   gives `null`; the D-pad wins over the stick; `nextRepeatDelay(0)` is 400 and `nextRepeatDelay(500)` is 120; from
   (0, 0), candidates at (100, 0) and (100, 90) going right give the first; with no candidate on the left the result
   is −1; a candidate on the same centre is never chosen.
2. **A surface coverage test.** It reads each file in the surface table from disk and fails if a surface loses its
   `useGamepadMenuNavigation(` call, or its `onBack` where the table says B goes back. A new screen gets added to the
   table and the test in the same change.
3. **Gameplay reader tests** with `TOOLKIT.InputController` stubbed: each pad input makes its reader true, nothing
   held makes them false, and a `PressDetector` over a held toggle fires once.
4. **A live journey with a simulated pad and no mouse**, through `bt-cdp.mjs` (run in place):
   ```javascript
   const page = await openPage({ port: 9341, url: "http://localhost:5173/", gamepad: true });
   await page.gamepad.connect();
   await page.gamepad.press(page.gamepad.BUTTONS.down);   // move focus
   await page.gamepad.press(page.gamepad.BUTTONS.a);      // choose
   await page.gamepad.setAxes([0.8, 0, 0, 0]);            // hold the stick right (repeat: 400 ms, then 120 ms)
   ```
   Walk title → every menu step → gameplay (move, every action, the analog triggers) → Start pauses → B resumes →
   results → back to the title, using the pad alone. Check focus on arrival for every surface, B on every surface that
   has Back, the cursor shown while the pad drives, the glyphs swapping to keyboard keys after a mouse move, and a
   clean console. Hold each press for at least two frames. While a heavy scene renders, hold presses for about 220 ms.
   To prove the toolkit's slot handling, stub the pad at browser index 1.
5. **A real-pad check is owed to the user** and is reported as a follow-up, never claimed: the console line
   `Gamepad One Connected: <id>`, menus driven by D-pad / A / B, every gameplay binding, and Start pause. The check
   takes about two minutes.

---

## 6. When a spec or plan mentions gamepad support

A spec or plan that adds gamepad support (or any feature with UI, in a project that already has it) carries:

- **Decisions:** the gameplay button map (§2.3, or the reference game's); the toolkit as the gameplay reader; one DOM
  navigator for every screen; menu controls (D-pad / stick past 0.5, repeat 400 / 120 ms, A choose, B back, Start
  never acts on menus); the `data-input` CSS look and glyph swap; the poll exception (§4); proof without hardware (§5).
- **The surface table** (§3.2), with B and focus on arrival for every screen.
- **Tasks, in this order:** gameplay readers and the button map (with reader tests) → the three input files and the
  rules tests → every surface wired, with the focus look and prompt bar glyphs, and the coverage test → the controls page
  → the end-to-end simulated-pad journey → the project `SPEC.md` updated (Conventions › Input, the surface table, the
  Decisions).
- **A standing rule for later features:** every new screen is a surface. Every later UI task's acceptance includes
  "driven by the simulated pad alone", and its live check walks the screen with the pad.

---

## 7. Pitfalls already paid for

| Symptom | Cause | Fix |
|---|---|---|
| The pad works on a tester page but not in the game | A hand-written reader takes player one only from browser index 0, or a generic pad gets no triggers or D-pad | Read gameplay through `TOOLKIT.InputController` (§2.1) |
| One Enter skips two screens | A page's own Enter handler did not `preventDefault()`, so the next screen's autofocused button also fired | `preventDefault()` on every Enter you answer; prefer `data-ok-default` (§3.4) |
| The pause menu closes or acts the moment it opens | The Start (or A) that opened it was still held | The navigator's first frame records held input (keep that code) |
| The cursor vanishes after pressing a stepper arrow | The arrow became disabled while focused | Hand focus to the sibling arrow (§3.3) |
| Two controls highlighted at once | The hover look plus the focus look, or a preview that follows hover | `usePointerFocus` on menus; hover look off under `[data-input="gamepad"]` (§3.5, §3.6) |
| The focused control is under the docked bar on a phone | No scroll padding | `scroll-padding-bottom` (§3.3) |
| The focus look cannot be seen on the primary button | The highlight colour matches the button | Add an offset outline or ring in a contrasting colour |
| Keyboard pause stops working once the pause menu shows | The toolkit's keyboard state no longer sees keys after DOM focus moves | Read pause keys from a capture-phase `window` `keydown` (§2.4) |
| The D-pad lands on prompt-bar tabs | The tabs are focusable or inside the surface | `tabIndex={-1}` and render the bar outside the container (§3.2) |
| The lobby or waiting room loses focus once the scene loads | The canvas takes focus when the scene is ready | Re-focus the primary control after the scene's ready event, or accept that the first press lands on it, and record which |

---

## 8. Final check

- [ ] Every gameplay action has a pad input; triggers and sticks are analog; toggles fire once; Start pauses; all of it
      is read through `TOOLKIT.InputController`.
- [ ] Every screen is in the surface table, calls `useGamepadMenuNavigation` (or `register`), has the right B, and opens
      focused on its primary control.
- [ ] Every control is reachable with the D-pad and left stick, with nothing mouse-only, and the cursor is never lost or
      hidden.
- [ ] Prompts show **(A) / (B)** glyphs while the pad drives and **Enter / Esc** otherwise, swapped by CSS on
      `data-input`; Enter and Escape do what the prompts say.
- [ ] The navigator polls only while a surface is mounted, a pad is connected and the tab is visible; it is stopped
      during gameplay.
- [ ] Rules tests, the surface coverage test and gameplay reader tests pass; a simulated-pad journey from the title
      through gameplay, pause and results passed with no mouse; the real-pad check is reported to the user as owed.
