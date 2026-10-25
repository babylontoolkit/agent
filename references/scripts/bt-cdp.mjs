/**
 * bt-cdp.mjs — the headless Chrome rig agents drive pages with. It launches its own headless Chrome (a scratch profile
 * and its own DevTools port — never the user's browser) and drives pages over the DevTools protocol with Node's global
 * WebSocket: screenshots, evaluate / waitFor, keyboard and mouse input, a simulated gamepad, console messages, request
 * logs, and a `timeScale` that runs the page's clock faster. Builders and verifiers import it instead of writing their
 * own harness. Zero dependencies, Node 22+. Run it in place from the installed Agent Reference.
 *
 * Chrome is found through the `CHROME_PATH` environment variable, then the usual macOS, Linux and Windows locations
 * (Google Chrome, Chrome Canary, Chromium, Microsoft Edge).
 *
 * @example
 *   import { launchChrome, openPage } from "<reference>/references/scripts/bt-cdp.mjs";
 *   const chrome = await launchChrome({ port: 9341 });
 *   const page = await openPage({ port: 9341, url: "http://localhost:5173/", width: 1920, height: 1080, gamepad: true, timeScale: 4 });
 *   await page.gamepad.connect();
 *   await page.gamepad.press(page.gamepad.BUTTONS.down);
 *   await page.key("Enter");
 *   await page.click(960, 540);
 *   await page.screenshot("/abs/path/title.png");
 *   console.log(page.consoleErrors(), page.requests.filter((url) => url.includes("babylon")));
 *   await page.close();
 *   chrome.kill();
 *
 * CLI: node bt-cdp.mjs shot <url> <out.png> [--width 1920] [--height 1080] [--wait 1500] [--port 9340] [--time-scale 1]
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** How long to wait for Chrome's DevTools endpoint to answer after launch, in milliseconds. */
const LAUNCH_TIMEOUT_MILLISECONDS = 15000;
/** How often the launch checks the DevTools endpoint, in milliseconds. */
const LAUNCH_POLL_MILLISECONDS = 200;
/** How often `waitFor` evaluates its expression, in milliseconds. */
const WAIT_FOR_POLL_MILLISECONDS = 150;
/** How long `waitFor` waits by default, in milliseconds. */
const DEFAULT_WAIT_FOR_TIMEOUT_MILLISECONDS = 30000;
/** How long a key is held for one press, in milliseconds. */
const KEY_HOLD_MILLISECONDS = 60;
/** How long a gamepad button is held for one press, in milliseconds (at least two frames at 60 Hz). */
const PRESS_HOLD_MILLISECONDS = 90;
/** Pause after a release so the page sees the edge before the next press, in milliseconds. */
const PRESS_GAP_MILLISECONDS = 90;
/** The default viewport width, in CSS pixels. */
const DEFAULT_VIEWPORT_WIDTH = 1920;
/** The default viewport height, in CSS pixels. */
const DEFAULT_VIEWPORT_HEIGHT = 1080;
/** The DevTools port the `shot` CLI uses by default. */
const DEFAULT_CLI_PORT = 9340;
/** How long the `shot` CLI lets the page run before it captures, in milliseconds. */
const DEFAULT_CLI_SETTLE_MILLISECONDS = 1500;
/** The CLI's exit code for bad arguments. */
const EXIT_CODE_USAGE = 2;
/** The `shot` CLI's usage line. */
const CLI_USAGE = "usage: node bt-cdp.mjs shot <url> <out.png> [--width 1920] [--height 1080] [--wait 1500] [--port 9340] [--time-scale 1]";

/** Chrome flags every launch uses: headless, WebGPU allowed, no throttling of a hidden page, sound without a gesture. */
const COMMON_CHROME_ARGUMENTS = Object.freeze([
    "--headless=new", "--enable-unsafe-webgpu", "--ignore-certificate-errors", "--no-first-run",
    "--no-default-browser-check", "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows", "--autoplay-policy=no-user-gesture-required", "--window-size=1920,1080",
]);
/** Graphics flags: Metal on macOS; elsewhere the software fallback is allowed so WebGL still runs without a GPU. */
const GRAPHICS_CHROME_ARGUMENTS = Object.freeze(process.platform === "darwin" ? ["--use-angle=metal"] : ["--enable-unsafe-swiftshader"]);

/** Standard-mapping gamepad button indices. */
const BUTTONS = Object.freeze({
    a: 0, b: 1, x: 2, y: 3, leftBumper: 4, rightBumper: 5, leftTrigger: 6, rightTrigger: 7,
    back: 8, start: 9, leftStick: 10, rightStick: 11, up: 12, down: 13, left: 14, right: 15, home: 16,
});

/** Windows virtual key codes for the named keys `key` sends; a single character uses its upper-case char code. */
const KEY_CODES = Object.freeze({
    Backspace: 8, Tab: 9, Enter: 13, Shift: 16, Control: 17, Alt: 18, Escape: 27, " ": 32,
    ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40,
});

/** Installed before any page script: a stub `navigator.getGamepads()` with one standard pad the rig controls. */
const GAMEPAD_STUB_SOURCE = `(() => {
  const simulatedPad = { id: "Simulated Standard Gamepad (STANDARD GAMEPAD)", index: 0, connected: true, mapping: "standard",
    timestamp: 0, buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })), axes: [0, 0, 0, 0],
    vibrationActuator: null, hapticActuators: [] };
  navigator.getGamepads = () => [simulatedPad, null, null, null];
  window.__simulatedPad = {
    setButton(index, pressed) { simulatedPad.buttons[index] = { pressed, touched: pressed, value: pressed ? 1 : 0 }; simulatedPad.timestamp = performance.now(); },
    setAxes(axes) { simulatedPad.axes = axes.slice(0, 4); simulatedPad.timestamp = performance.now(); },
    connect() { const connectedEvent = new Event("gamepadconnected"); Object.defineProperty(connectedEvent, "gamepad", { value: simulatedPad }); window.dispatchEvent(connectedEvent); },
  };
})();`;

/**
 * Builds the script that runs a page's clock faster. Installed before any page script, it scales `performance.now()`,
 * `Date.now()` and the `requestAnimationFrame` callback timestamp continuously from the moment the document starts —
 * scaled = start + (real − start) × factor — so a game that reads its frame delta from them (Babylon does) runs that
 * many times faster. Timers (`setTimeout`) and `new Date()` keep real time.
 * @param {number} factor The speed-up, a finite number above 0 (checked by the caller).
 * @returns {string} The script source.
 */
function buildTimeScaleSource(factor) {
    return `(() => {
  const factor = ${factor};
  const realPerformanceNow = performance.now.bind(performance);
  const realDateNow = Date.now.bind(Date);
  const realRequestAnimationFrame = window.requestAnimationFrame.bind(window);
  const performanceStart = realPerformanceNow();
  const dateStart = realDateNow();
  const scalePerformanceTime = (realTime) => performanceStart + (realTime - performanceStart) * factor;
  performance.now = () => scalePerformanceTime(realPerformanceNow());
  Date.now = () => Math.floor(dateStart + (realDateNow() - dateStart) * factor);
  window.requestAnimationFrame = (callback) => realRequestAnimationFrame((timestamp) => callback(scalePerformanceTime(timestamp)));
  window.__btTimeScale = factor;
})();`;
}

/**
 * Waits for a number of milliseconds (a Node timer — never a shell sleep).
 * @param {number} milliseconds How long to wait.
 * @returns {Promise<void>}
 */
export function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Lists the places Chrome is usually installed on this platform, most likely first.
 * @returns {string[]} Absolute candidate paths.
 */
function chromeCandidates() {
    if (process.platform === "darwin") {
        const applicationFolders = ["/Applications", join(homedir(), "Applications")];
        const bundles = [
            "Google Chrome.app/Contents/MacOS/Google Chrome",
            "Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
            "Chromium.app/Contents/MacOS/Chromium",
            "Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        ];
        return bundles.flatMap((bundle) => applicationFolders.map((folder) => join(folder, bundle)));
    }
    if (process.platform === "win32") {
        const installRoots = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean);
        const executables = ["Google/Chrome/Application/chrome.exe", "Chromium/Application/chrome.exe", "Microsoft/Edge/Application/msedge.exe"];
        return executables.flatMap((executable) => installRoots.map((root) => join(root, executable)));
    }
    const commandNames = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"];
    const searchFolders = [...(process.env.PATH ?? "").split(delimiter), "/usr/bin", "/usr/local/bin", "/snap/bin"].filter(Boolean);
    return commandNames.flatMap((commandName) => searchFolders.map((folder) => join(folder, commandName)));
}

/**
 * Finds the Chrome binary: `CHROME_PATH` when set, else the first usual install location that exists.
 * @returns {string} The absolute path.
 * @throws {Error} When `CHROME_PATH` points nowhere or no Chrome is installed.
 */
export function findChromeBinary() {
    const override = process.env.CHROME_PATH;
    if (override) {
        if (existsSync(override)) return override;
        throw new Error(`CHROME_PATH is ${override}, which does not exist`);
    }
    const installed = chromeCandidates().find((candidate) => existsSync(candidate));
    if (!installed) throw new Error("No Chrome found: install Google Chrome or set CHROME_PATH to a Chrome/Chromium/Edge binary");
    return installed;
}

/**
 * Asks whether a DevTools endpoint answers on a port.
 * @param {number} port The DevTools port.
 * @returns {Promise<boolean>}
 */
async function isDevToolsListening(port) {
    try {
        const response = await fetch(`http://127.0.0.1:${port}/json/version`);
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Launches a headless Chrome with its own scratch profile and DevTools port.
 * @param {{ port: number, profileDirectory?: string, chromePath?: string }} options The DevTools port, optionally the
 *   profile folder (default `<tmp>/bt-cdp-profile-<port>`) and the Chrome binary (default `findChromeBinary()`).
 * @returns {Promise<{ port: number, process: import("node:child_process").ChildProcess, kill: () => void }>} The
 *   running browser; call `kill()` when done.
 * @throws {Error} When Chrome exits or does not open DevTools within 15 s.
 */
export async function launchChrome({ port, profileDirectory, chromePath }) {
    const profile = profileDirectory ?? join(tmpdir(), `bt-cdp-profile-${port}`);
    mkdirSync(profile, { recursive: true });
    const chromeArguments = [...COMMON_CHROME_ARGUMENTS, ...GRAPHICS_CHROME_ARGUMENTS, `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`];
    const chromeProcess = spawn(chromePath ?? findChromeBinary(), chromeArguments, { stdio: "ignore" });
    let hasExited = false;
    chromeProcess.once("exit", () => { hasExited = true; });
    chromeProcess.once("error", () => { hasExited = true; });
    const deadline = Date.now() + LAUNCH_TIMEOUT_MILLISECONDS;
    while (Date.now() < deadline && !hasExited) {
        if (await isDevToolsListening(port)) return { port, process: chromeProcess, kill: () => chromeProcess.kill("SIGTERM") };
        await delay(LAUNCH_POLL_MILLISECONDS);
    }
    chromeProcess.kill("SIGTERM");
    const reason = hasExited ? "exited before it opened" : "did not open";
    throw new Error(`Chrome ${reason} DevTools on port ${port}`);
}

/** One DevTools WebSocket connection: sends commands, settles their replies, and records console and network events. */
class DevToolsSession {
    /** Console messages, uncaught exceptions and log entries so far: `{ type, text }`. */
    consoleMessages = [];
    /** Every request URL the page has sent so far. */
    requests = [];
    /** @type {WebSocket} */
    #socket;
    #nextMessageId = 0;
    /** @type {Map<number, { resolve: (result: any) => void, reject: (error: Error) => void }>} */
    #pendingReplies = new Map();
    /** @type {Set<(message: object) => void>} */
    #eventListeners = new Set();

    /**
     * Opens a session on a target's WebSocket.
     * @param {string} webSocketUrl The target's `webSocketDebuggerUrl`.
     * @returns {Promise<DevToolsSession>}
     */
    static async connect(webSocketUrl) {
        const socket = new WebSocket(webSocketUrl);
        await new Promise((resolve, reject) => {
            socket.onopen = resolve;
            socket.onerror = reject;
        });
        return new DevToolsSession(socket);
    }

    /**
     * @param {WebSocket} socket An open DevTools WebSocket.
     */
    constructor(socket) {
        this.#socket = socket;
        socket.onmessage = (messageEvent) => this.#handleMessage(JSON.parse(messageEvent.data));
    }

    /**
     * Sends one DevTools command.
     * @param {string} method The protocol method.
     * @param {object} [params] Its parameters.
     * @returns {Promise<any>} The result.
     */
    send(method, params = {}) {
        return new Promise((resolve, reject) => {
            this.#nextMessageId += 1;
            this.#pendingReplies.set(this.#nextMessageId, { resolve, reject });
            this.#socket.send(JSON.stringify({ id: this.#nextMessageId, method, params }));
        });
    }

    /**
     * Resolves on the next event of a method. Call it before the command that causes the event.
     * @param {string} method The event, e.g. "Page.loadEventFired".
     * @returns {Promise<object>} The event's params.
     */
    nextEvent(method) {
        return new Promise((resolve) => {
            const listener = (message) => {
                if (message.method !== method) return;
                this.#eventListeners.delete(listener);
                resolve(message.params);
            };
            this.#eventListeners.add(listener);
        });
    }

    /** Closes the WebSocket. */
    close() {
        this.#socket.close();
    }

    /**
     * Routes one incoming message: a reply settles its command, an event is recorded and passed to the listeners.
     * @param {object} message The parsed message.
     */
    #handleMessage(message) {
        if (message.id !== undefined) {
            this.#settleReply(message);
            return;
        }
        this.#recordEvent(message);
        for (const listener of [...this.#eventListeners]) listener(message);
    }

    /**
     * Resolves or rejects the command a reply answers.
     * @param {{ id: number, result?: any, error?: { message: string, data?: string } }} message The reply.
     */
    #settleReply(message) {
        const pending = this.#pendingReplies.get(message.id);
        if (!pending) return;
        this.#pendingReplies.delete(message.id);
        if (message.error) {
            pending.reject(new Error(`${message.error.message} ${message.error.data ?? ""}`.trim()));
            return;
        }
        pending.resolve(message.result);
    }

    /**
     * Keeps console messages, exceptions, log entries and request URLs.
     * @param {{ method: string, params: any }} message The event.
     */
    #recordEvent({ method, params }) {
        if (method === "Runtime.consoleAPICalled") {
            const text = params.args.map((argument) => argument.value ?? argument.description ?? "").join(" ");
            this.consoleMessages.push({ type: params.type, text });
        } else if (method === "Runtime.exceptionThrown") {
            const details = params.exceptionDetails;
            this.consoleMessages.push({ type: "exception", text: details.exception?.description ?? details.text });
        } else if (method === "Log.entryAdded") {
            this.consoleMessages.push({ type: params.entry.level, text: params.entry.text });
        } else if (method === "Network.requestWillBeSent") {
            this.requests.push(params.request.url);
        }
    }
}

/**
 * Evaluates an expression in the page and returns its value (promises are awaited).
 * @param {DevToolsSession} session The page's session.
 * @param {string} expression JavaScript source.
 * @returns {Promise<any>}
 * @throws {Error} When the expression throws.
 */
async function evaluateExpression(session, expression) {
    const result = await session.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
}

/**
 * Polls an expression until it is truthy.
 * @param {DevToolsSession} session The page's session.
 * @param {string} expression JavaScript source.
 * @param {number} timeoutMilliseconds Give up after this long.
 * @returns {Promise<any>} The truthy value.
 * @throws {Error} On timeout.
 */
async function waitForExpression(session, expression, timeoutMilliseconds) {
    const deadline = Date.now() + timeoutMilliseconds;
    while (Date.now() < deadline) {
        const value = await evaluateExpression(session, expression).catch(() => undefined);
        if (value) return value;
        await delay(WAIT_FOR_POLL_MILLISECONDS);
    }
    throw new Error(`Timed out waiting for: ${expression}`);
}

/**
 * Navigates and waits for the load event.
 * @param {DevToolsSession} session The page's session.
 * @param {string} pageUrl Where to go.
 */
async function navigateTo(session, pageUrl) {
    const loaded = session.nextEvent("Page.loadEventFired");
    await session.send("Page.navigate", { url: pageUrl });
    await loaded;
}

/**
 * Saves a PNG screenshot of the viewport (or the whole page).
 * @param {DevToolsSession} session The page's session.
 * @param {string} outputPath Absolute file path; its folder is created.
 * @param {{ fullPage?: boolean }} options Capture beyond the viewport.
 * @returns {Promise<string>} The path written.
 */
async function captureScreenshot(session, outputPath, { fullPage = false }) {
    const capture = await session.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: fullPage });
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, Buffer.from(capture.data, "base64"));
    return outputPath;
}

/**
 * The DOM `code` for a key: "Space", "KeyW", "Digit1", or the key name itself ("Enter", "ArrowDown").
 * @param {string} keyName DOM `key`.
 * @returns {string}
 */
function domCodeForKey(keyName) {
    if (keyName === " ") return "Space";
    if (/^[0-9]$/.test(keyName)) return `Digit${keyName}`;
    if (keyName.length === 1) return `Key${keyName.toUpperCase()}`;
    return keyName;
}

/**
 * The text a key types: "\r" for Enter, the character for a printable key, none for the rest.
 * @param {string} keyName DOM `key`.
 * @returns {string | undefined}
 */
function textForKey(keyName) {
    if (keyName === "Enter") return "\r";
    if (keyName.length === 1) return keyName;
    return undefined;
}

/**
 * Presses and releases one key (keyDown + keyUp).
 * @param {DevToolsSession} session The page's session.
 * @param {string} keyName DOM `key`, e.g. "Enter", "Escape", "ArrowDown", "w".
 * @param {{ code?: string, holdMilliseconds?: number }} options DOM `code` (defaults from the key) and hold time.
 */
async function pressKey(session, keyName, { code, holdMilliseconds = KEY_HOLD_MILLISECONDS }) {
    const keyCode = KEY_CODES[keyName] ?? keyName.toUpperCase().charCodeAt(0);
    const keyFields = { key: keyName, code: code ?? domCodeForKey(keyName), windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
    await session.send("Input.dispatchKeyEvent", { type: "keyDown", ...keyFields, text: textForKey(keyName) });
    await delay(holdMilliseconds);
    await session.send("Input.dispatchKeyEvent", { type: "keyUp", ...keyFields });
}

/**
 * Clicks the left mouse button at a point.
 * @param {DevToolsSession} session The page's session.
 * @param {number} x CSS pixels.
 * @param {number} y CSS pixels.
 */
async function clickAt(session, x, y) {
    await session.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await session.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}

/**
 * Builds the simulated gamepad's driver (the page must have been opened with `gamepad: true`).
 * @param {(expression: string) => Promise<any>} evaluate Evaluates in the page.
 * @returns {object} `BUTTONS`, `connect()`, `press(button, holdMilliseconds?)`, `setButton(button, pressed)`, `setAxes(axes)`.
 */
function createGamepadDriver(evaluate) {
    return {
        BUTTONS,
        /** Dispatches `gamepadconnected` for the simulated pad. */
        connect: () => evaluate("window.__simulatedPad.connect()"),
        /**
         * Presses and releases a button, held long enough for the page's poll to see it.
         * @param {number} buttonIndex A `BUTTONS` value.
         * @param {number} [holdMilliseconds] How long to hold it.
         */
        press: async (buttonIndex, holdMilliseconds = PRESS_HOLD_MILLISECONDS) => {
            await evaluate(`window.__simulatedPad.setButton(${buttonIndex}, true)`);
            await delay(holdMilliseconds);
            await evaluate(`window.__simulatedPad.setButton(${buttonIndex}, false)`);
            await delay(PRESS_GAP_MILLISECONDS);
        },
        /**
         * Holds a button down (or releases it).
         * @param {number} buttonIndex A `BUTTONS` value.
         * @param {boolean} pressed Down or up.
         */
        setButton: (buttonIndex, pressed) => evaluate(`window.__simulatedPad.setButton(${buttonIndex}, ${pressed})`),
        /**
         * Sets the four axes: left stick x, y, right stick x, y (-1 to 1).
         * @param {number[]} axes The axis values.
         */
        setAxes: (axes) => evaluate(`window.__simulatedPad.setAxes(${JSON.stringify(axes)})`),
    };
}

/**
 * Opens a new tab and returns a small driver for it.
 * @param {{ port: number, url: string, width?: number, height?: number, mobile?: boolean, gamepad?: boolean, timeScale?: number }} options
 *   The DevTools port, the URL, the viewport (default 1920 × 1080, desktop), `gamepad: true` to install the simulated
 *   pad, and `timeScale` (default 1 = real time) to run the page's clock that many times faster. Both are installed
 *   before any page script runs.
 * @returns {Promise<object>} The page driver: send, evaluate, waitFor, navigate, screenshot, setViewport, key, mouseMove,
 *   click, gamepad, consoleMessages, consoleErrors(), requests, timeScale, close.
 * @throws {Error} When `timeScale` is not a finite number above 0.
 */
export async function openPage({ port, url, width = DEFAULT_VIEWPORT_WIDTH, height = DEFAULT_VIEWPORT_HEIGHT, mobile = false, gamepad = false, timeScale = 1 }) {
    if (!Number.isFinite(timeScale) || timeScale <= 0) throw new Error(`timeScale must be a finite number above 0, not ${timeScale}`);
    const targetResponse = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
    const target = await targetResponse.json();
    const session = await DevToolsSession.connect(target.webSocketDebuggerUrl);
    await Promise.all(["Page.enable", "Runtime.enable", "Network.enable", "Log.enable"].map((method) => session.send(method)));
    if (gamepad) await session.send("Page.addScriptToEvaluateOnNewDocument", { source: GAMEPAD_STUB_SOURCE });
    if (timeScale !== 1) await session.send("Page.addScriptToEvaluateOnNewDocument", { source: buildTimeScaleSource(timeScale) });

    /** @param {string} expression JavaScript source. @returns {Promise<any>} Its value. */
    const evaluate = (expression) => evaluateExpression(session, expression);
    /** @param {number} viewportWidth CSS pixels. @param {number} viewportHeight CSS pixels. @param {boolean} [isMobile] */
    const setViewport = (viewportWidth, viewportHeight, isMobile = false) => session.send("Emulation.setDeviceMetricsOverride", {
        width: viewportWidth, height: viewportHeight, deviceScaleFactor: 1, mobile: isMobile,
    });
    await setViewport(width, height, mobile);
    await navigateTo(session, url);
    return {
        send: (method, params) => session.send(method, params),
        evaluate,
        /** @param {string} expression JavaScript source. @param {number} [timeoutMilliseconds] Default 30 s. */
        waitFor: (expression, timeoutMilliseconds = DEFAULT_WAIT_FOR_TIMEOUT_MILLISECONDS) => waitForExpression(session, expression, timeoutMilliseconds),
        /** @param {string} pageUrl Where to go; resolves on the load event. */
        navigate: (pageUrl) => navigateTo(session, pageUrl),
        /** @param {string} outputPath Absolute PNG path. @param {{ fullPage?: boolean }} [options] */
        screenshot: (outputPath, options = {}) => captureScreenshot(session, outputPath, options),
        setViewport,
        /** @param {string} keyName DOM `key`. @param {{ code?: string, holdMilliseconds?: number }} [options] */
        key: (keyName, options = {}) => pressKey(session, keyName, options),
        /** @param {number} x CSS pixels. @param {number} y CSS pixels. */
        mouseMove: (x, y) => session.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }),
        /** @param {number} x CSS pixels. @param {number} y CSS pixels. */
        click: (x, y) => clickAt(session, x, y),
        gamepad: createGamepadDriver(evaluate),
        consoleMessages: session.consoleMessages,
        requests: session.requests,
        timeScale,
        /** @returns {object[]} Console errors and uncaught exceptions so far. */
        consoleErrors: () => session.consoleMessages.filter((message) => message.type === "error" || message.type === "exception"),
        /** Closes the tab. */
        close: async () => {
            session.close();
            await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => undefined);
        },
    };
}

/**
 * Reads a numeric `--name value` flag.
 * @param {string[]} flags The flags after the positional arguments.
 * @param {string} flagName The name without dashes.
 * @param {number} fallback The value when the flag is absent.
 * @returns {number}
 */
function readNumberFlag(flags, flagName, fallback) {
    const index = flags.indexOf(`--${flagName}`);
    if (index < 0) return fallback;
    return Number(flags[index + 1]);
}

/**
 * Prints the `shot` result: the file, then the console error count and each error.
 * @param {string} outputPath The screenshot.
 * @param {{ text: string }[]} errors The page's console errors.
 */
function reportShot(outputPath, errors) {
    const errorLines = errors.map((error) => `\n${error.text}`).join("");
    process.stdout.write(`${outputPath}\nconsole errors: ${errors.length}${errorLines}\n`);
}

/**
 * Command-line entry: `shot <url> <out.png>` captures one screenshot in a throwaway headless Chrome.
 * @param {string[]} argumentList The arguments after the script name.
 * @returns {Promise<number>} The exit code: 0, or 2 on bad arguments.
 */
async function runCommandLine(argumentList) {
    const [command, url, outputPath, ...flags] = argumentList;
    if (command !== "shot" || !url || !outputPath) {
        console.error(CLI_USAGE);
        return EXIT_CODE_USAGE;
    }
    const port = readNumberFlag(flags, "port", DEFAULT_CLI_PORT);
    const chrome = await launchChrome({ port });
    try {
        const page = await openPage({
            port, url,
            width: readNumberFlag(flags, "width", DEFAULT_VIEWPORT_WIDTH),
            height: readNumberFlag(flags, "height", DEFAULT_VIEWPORT_HEIGHT),
            timeScale: readNumberFlag(flags, "time-scale", 1),
        });
        await delay(readNumberFlag(flags, "wait", DEFAULT_CLI_SETTLE_MILLISECONDS));
        await page.screenshot(outputPath);
        reportShot(outputPath, page.consoleErrors());
        await page.close();
    } finally {
        chrome.kill();
    }
    return 0;
}

/**
 * Whether this module is the script Node was started with (and not an import).
 * @returns {boolean}
 */
function isRunAsScript() {
    if (!process.argv[1]) return false;
    try {
        return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
    } catch {
        return false;
    }
}

if (isRunAsScript()) {
    runCommandLine(process.argv.slice(2)).then((exitCode) => {
        process.exitCode = exitCode;
    }, (error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
