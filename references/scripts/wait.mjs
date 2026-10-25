#!/usr/bin/env node
/**
 * wait.mjs — waits for a condition without a shell sleep: a port that opens, a URL that answers, a file that appears,
 * a log line that appears, or a command whose output reaches a state. It polls inside Node with timers, so an agent
 * never writes a shell sleep loop. Zero dependencies, Node 18+. Run it in place from the installed Agent Reference.
 *
 * Usage:
 *   node wait.mjs port <n> [--host 127.0.0.1]
 *   node wait.mjs url <url> [--status 200]
 *   node wait.mjs file <path>
 *   node wait.mjs log <path> <regex>
 *   node wait.mjs cmd "<command>" [--match <regex>] [--fail <regex>] [--running <regex> --stopped <regex>]
 *   Every mode also takes --timeout <seconds> (default 120) and --interval <seconds> (default 0.25; 2 for cmd).
 *
 * `cmd` re-runs the command in a shell (/bin/sh; cmd.exe on Windows) until its stdout + stderr matches `--match` —
 * or, without `--match`, until it exits 0. `--match` is checked first, then `--fail`, which fails at once on a match.
 * `--stopped` fails on a match only after an earlier output matched `--running` (a job that went back to idle without
 * completing). A command that cannot connect yet just prints nothing useful, so it counts as "not yet".
 * Regexes are JavaScript regular expression source, case-sensitive. `url` accepts a self-signed certificate on
 * localhost (the exporter's dev server is https://localhost:4444).
 *
 * Exit codes: 0 — the condition holds (one line on stdout); 1 — timed out, or a fail pattern matched (one line on
 * stderr); 2 — bad arguments (usage on stderr).
 *
 * The wait functions are exported too, each resolving `{ ok, message }`:
 *   import { waitForPort } from "<reference>/references/scripts/wait.mjs";
 *   const { ok, message } = await waitForPort(4444, { timeoutSeconds: 60 });
 */
import { exec } from "node:child_process";
import { closeSync, existsSync, openSync, readSync, realpathSync, statSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { StringDecoder } from "node:string_decoder";
import { fileURLToPath } from "node:url";

/** How long a wait lasts before it gives up, in seconds. */
const DEFAULT_TIMEOUT_SECONDS = 120;
/** How often `port`, `url`, `file` and `log` check again, in seconds. */
const DEFAULT_INTERVAL_SECONDS = 0.25;
/** How often `cmd` re-runs its command, in seconds (commands such as `unity command` are slow and costly). */
const DEFAULT_COMMAND_INTERVAL_SECONDS = 2;
/** The host `port` connects to. */
const DEFAULT_HOST = "127.0.0.1";
/** The HTTP status `url` waits for. */
const DEFAULT_STATUS = 200;
/** Milliseconds in one second. */
const MILLISECONDS_PER_SECOND = 1000;
/** The longest one connection or request attempt may take, in milliseconds. */
const MAX_ATTEMPT_MILLISECONDS = 10000;
/** The shortest time one command run is allowed, in milliseconds, even when the wait is about to time out. */
const MIN_COMMAND_RUN_MILLISECONDS = 1000;
/** The most output one command run may print before it is cut off, in bytes. */
const COMMAND_OUTPUT_LIMIT_BYTES = 16 * 1024 * 1024;
/** How much of a command's last output a reason line quotes, in characters. */
const OUTPUT_EXCERPT_LENGTH = 160;
/** The highest TCP port number. */
const MAX_PORT = 65535;
/** Hostnames whose self-signed HTTPS certificates `url` accepts. */
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
/** Options every mode accepts. */
const COMMON_OPTIONS = ["timeout", "interval"];
/** The options each mode accepts besides the common ones. */
const MODE_OPTIONS = Object.freeze({
    port: ["host"],
    url: ["status"],
    file: [],
    log: [],
    cmd: ["match", "fail", "running", "stopped"],
});
/** Process exit codes. */
const EXIT_CODES = Object.freeze({ satisfied: 0, failed: 1, usage: 2 });
/** The usage text printed on bad arguments. */
const USAGE = `usage:
  node wait.mjs port <n> [--host 127.0.0.1]
  node wait.mjs url <url> [--status 200]
  node wait.mjs file <path>
  node wait.mjs log <path> <regex>
  node wait.mjs cmd "<command>" [--match <regex>] [--fail <regex>] [--running <regex> --stopped <regex>]
  every mode: [--timeout <seconds>] (default ${DEFAULT_TIMEOUT_SECONDS}) [--interval <seconds>] (default ${DEFAULT_INTERVAL_SECONDS}; ${DEFAULT_COMMAND_INTERVAL_SECONDS} for cmd)
exit: 0 condition holds · 1 timed out or a fail pattern matched · 2 bad arguments`;

/** A bad command line: the CLI prints the message and the usage text and exits 2. */
class UsageError extends Error {}

/**
 * The result of one check.
 * @typedef {{ state: "pending" | "satisfied" | "failed", detail?: string }} ProbeOutcome
 */

/**
 * What a wait settles to.
 * @typedef {{ ok: boolean, message: string }} WaitResult
 */

/**
 * Timing options every wait takes.
 * @typedef {{ timeoutSeconds?: number, intervalSeconds?: number }} TimingOptions
 */

/**
 * Waits with a Node timer.
 * @param {number} milliseconds How long to wait.
 * @returns {Promise<void>}
 */
function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Formats the time since a start as seconds with one decimal, e.g. "0.5 s".
 * @param {number} startTime A `Date.now()` value.
 * @returns {string}
 */
function elapsedSince(startTime) {
    const elapsedSeconds = (Date.now() - startTime) / MILLISECONDS_PER_SECOND;
    return `${elapsedSeconds.toFixed(1)} s`;
}

/**
 * Shortens command output to one line for a reason message: whitespace collapsed, the last characters kept.
 * @param {string} output The output.
 * @returns {string} The excerpt, or "(no output)".
 */
function excerpt(output) {
    const singleLine = output.replace(/\s+/g, " ").trim();
    if (singleLine === "") return "(no output)";
    if (singleLine.length <= OUTPUT_EXCERPT_LENGTH) return singleLine;
    return `…${singleLine.slice(-OUTPUT_EXCERPT_LENGTH)}`;
}

/**
 * Turns a pattern into a RegExp.
 * @param {RegExp | string} pattern A RegExp or JavaScript regex source.
 * @returns {RegExp}
 * @throws {UsageError} When the source is not a valid regex.
 */
function toRegExp(pattern) {
    if (pattern instanceof RegExp) return pattern;
    try {
        return new RegExp(pattern);
    } catch (error) {
        throw new UsageError(`invalid regex ${JSON.stringify(pattern)}: ${error.message}`);
    }
}

/**
 * Calls a probe until it is satisfied, fails, or the timeout passes. Waits between calls with a Node timer.
 * @param {(remainingMilliseconds: number) => Promise<ProbeOutcome> | ProbeOutcome} probe One check; it gets the time
 *   left so it can bound its own attempt.
 * @param {{ description: string, pendingDescription: string } & TimingOptions} options What is awaited (for the
 *   success line), what is still missing (for the timeout line), the timeout and the poll interval.
 * @returns {Promise<WaitResult>}
 */
export async function pollUntil(probe, { description, pendingDescription, timeoutSeconds = DEFAULT_TIMEOUT_SECONDS, intervalSeconds = DEFAULT_INTERVAL_SECONDS }) {
    const startTime = Date.now();
    const deadline = startTime + timeoutSeconds * MILLISECONDS_PER_SECOND;
    const intervalMilliseconds = intervalSeconds * MILLISECONDS_PER_SECOND;
    for (;;) {
        const outcome = await probe(Math.max(deadline - Date.now(), 0));
        if (outcome.state === "satisfied") return { ok: true, message: `wait: ${description} (${elapsedSince(startTime)})` };
        if (outcome.state === "failed") return { ok: false, message: `wait: ${outcome.detail} (${elapsedSince(startTime)})` };
        const remainingMilliseconds = deadline - Date.now();
        if (remainingMilliseconds <= 0) {
            const missing = outcome.detail ?? pendingDescription;
            return { ok: false, message: `wait: timed out after ${timeoutSeconds} s — ${missing}` };
        }
        await delay(Math.min(intervalMilliseconds, remainingMilliseconds));
    }
}

/**
 * Tries one TCP connection.
 * @param {string} host The host.
 * @param {number} port The port.
 * @param {number} attemptMilliseconds How long the attempt may take.
 * @returns {Promise<boolean>} Whether the port accepted the connection.
 */
function isPortOpen(host, port, attemptMilliseconds) {
    return new Promise((resolve) => {
        const socket = net.connect({ host, port });
        const finish = (isOpen) => {
            socket.destroy();
            resolve(isOpen);
        };
        socket.setTimeout(attemptMilliseconds, () => finish(false));
        socket.once("connect", () => finish(true));
        socket.once("error", () => finish(false));
    });
}

/**
 * Sends one GET request.
 * @param {URL} target The URL; a self-signed certificate is accepted only on a local host.
 * @param {number} attemptMilliseconds How long the request may take.
 * @returns {Promise<number | null>} The response status, or null when nothing answered.
 */
function requestStatus(target, attemptMilliseconds) {
    const client = target.protocol === "https:" ? https : http;
    const acceptSelfSigned = LOCAL_HOSTNAMES.has(target.hostname);
    return new Promise((resolve) => {
        const request = client.request(target, { method: "GET", rejectUnauthorized: !acceptSelfSigned, timeout: attemptMilliseconds }, (response) => {
            response.resume();
            resolve(response.statusCode ?? null);
        });
        request.on("timeout", () => request.destroy());
        request.on("error", () => resolve(null));
        request.end();
    });
}

/**
 * Builds a check that reads only what a log file gained since the last check and tests each line against a pattern.
 * Lines already in the file when the wait starts count too. A file that shrank (truncated or replaced) is read again
 * from the start.
 * @param {string} filePath The log file.
 * @param {RegExp} pattern The line pattern.
 * @returns {() => boolean} The check: whether a matching line has appeared.
 */
function createLogScanner(filePath, pattern) {
    let readOffset = 0;
    let partialLine = "";
    let decoder = new StringDecoder("utf8");
    return () => {
        if (!existsSync(filePath)) return false;
        const fileSize = statSync(filePath).size;
        if (fileSize < readOffset) {
            readOffset = 0;
            partialLine = "";
            decoder = new StringDecoder("utf8");
        }
        if (fileSize === readOffset) return false;
        const newBytes = Buffer.alloc(fileSize - readOffset);
        const fileDescriptor = openSync(filePath, "r");
        try {
            readSync(fileDescriptor, newBytes, 0, newBytes.length, readOffset);
        } finally {
            closeSync(fileDescriptor);
        }
        readOffset = fileSize;
        const lines = `${partialLine}${decoder.write(newBytes)}`.split(/\r?\n/);
        partialLine = lines.pop() ?? "";
        return lines.some((line) => pattern.test(line)) || pattern.test(partialLine);
    };
}

/**
 * Runs a shell command once and collects everything it printed.
 * @param {string} command The shell command.
 * @param {number} timeoutMilliseconds Kill it after this long.
 * @returns {Promise<{ output: string, succeeded: boolean }>} stdout + stderr, and whether it exited 0.
 */
function runShellCommand(command, timeoutMilliseconds) {
    return new Promise((resolve) => {
        const execOptions = { timeout: timeoutMilliseconds, maxBuffer: COMMAND_OUTPUT_LIMIT_BYTES, windowsHide: true };
        exec(command, execOptions, (error, standardOutput, standardError) => {
            resolve({ output: `${standardOutput}${standardError}`, succeeded: error == null });
        });
    });
}

/**
 * Waits until a TCP port accepts connections.
 * @param {number} port The port.
 * @param {{ host?: string } & TimingOptions} [options] The host (default 127.0.0.1), timeout and interval.
 * @returns {Promise<WaitResult>}
 */
export function waitForPort(port, { host = DEFAULT_HOST, ...timing } = {}) {
    const address = `${host}:${port}`;
    const probe = async (remainingMilliseconds) => {
        const attemptMilliseconds = Math.min(Math.max(remainingMilliseconds, 1), MAX_ATTEMPT_MILLISECONDS);
        const isOpen = await isPortOpen(host, port, attemptMilliseconds);
        return { state: isOpen ? "satisfied" : "pending" };
    };
    return pollUntil(probe, { description: `port ${address} is open`, pendingDescription: `port ${address} never opened`, ...timing });
}

/**
 * Waits until a URL answers with a status (http or https; a self-signed certificate is accepted on localhost).
 * @param {string} url The URL.
 * @param {{ status?: number } & TimingOptions} [options] The status to wait for (default 200), timeout and interval.
 * @returns {Promise<WaitResult>}
 */
export function waitForUrl(url, { status = DEFAULT_STATUS, ...timing } = {}) {
    const target = new URL(url);
    let lastStatus = null;
    const probe = async (remainingMilliseconds) => {
        const attemptMilliseconds = Math.min(Math.max(remainingMilliseconds, 1), MAX_ATTEMPT_MILLISECONDS);
        lastStatus = await requestStatus(target, attemptMilliseconds);
        if (lastStatus === status) return { state: "satisfied" };
        const lastAnswer = lastStatus === null ? "no answer" : `last status ${lastStatus}`;
        return { state: "pending", detail: `${url} never answered ${status} (${lastAnswer})` };
    };
    return pollUntil(probe, { description: `${url} answered ${status}`, pendingDescription: `${url} never answered ${status}`, ...timing });
}

/**
 * Waits until a file exists.
 * @param {string} filePath The file.
 * @param {TimingOptions} [timing] Timeout and interval.
 * @returns {Promise<WaitResult>}
 */
export function waitForFile(filePath, timing = {}) {
    const probe = () => ({ state: existsSync(filePath) ? "satisfied" : "pending" });
    return pollUntil(probe, { description: `${filePath} exists`, pendingDescription: `${filePath} never appeared`, ...timing });
}

/**
 * Waits until a log file has a line that matches a pattern.
 * @param {string} filePath The log file (it may not exist yet).
 * @param {RegExp | string} pattern A RegExp or regex source.
 * @param {TimingOptions} [timing] Timeout and interval.
 * @returns {Promise<WaitResult>}
 */
export function waitForLog(filePath, pattern, timing = {}) {
    const linePattern = toRegExp(pattern);
    const hasMatchingLine = createLogScanner(filePath, linePattern);
    const probe = () => ({ state: hasMatchingLine() ? "satisfied" : "pending" });
    const patternText = `/${linePattern.source}/`;
    return pollUntil(probe, {
        description: `${filePath} has a line matching ${patternText}`,
        pendingDescription: `no line in ${filePath} matched ${patternText}`,
        ...timing,
    });
}

/**
 * Re-runs a shell command until its output matches (or, without `match`, until it exits 0).
 * @param {string} command The shell command; its stdout and stderr are tested together.
 * @param {{ match?: RegExp | string, fail?: RegExp | string, running?: RegExp | string, stopped?: RegExp | string } & TimingOptions} [options]
 *   `match` succeeds (checked first); `fail` fails at once; `stopped` fails only after an earlier output matched
 *   `running`; the interval defaults to 2 s.
 * @returns {Promise<WaitResult>}
 */
export function waitForCommand(command, { match, fail, running, stopped, intervalSeconds = DEFAULT_COMMAND_INTERVAL_SECONDS, ...timing } = {}) {
    const matchPattern = match === undefined ? null : toRegExp(match);
    const failPattern = fail === undefined ? null : toRegExp(fail);
    const runningPattern = running === undefined ? null : toRegExp(running);
    const stoppedPattern = stopped === undefined ? null : toRegExp(stopped);
    const goal = matchPattern ? `output matched /${matchPattern.source}/` : "command exited 0";
    const missingGoal = matchPattern ? `output never matched /${matchPattern.source}/` : "command never exited 0";
    let hasSeenRunning = false;
    const probe = async (remainingMilliseconds) => {
        const { output, succeeded } = await runShellCommand(command, Math.max(remainingMilliseconds, MIN_COMMAND_RUN_MILLISECONDS));
        const isSatisfied = matchPattern ? matchPattern.test(output) : succeeded;
        if (isSatisfied) return { state: "satisfied" };
        if (failPattern?.test(output)) return { state: "failed", detail: `fail pattern /${failPattern.source}/ matched — ${excerpt(output)}` };
        if (runningPattern?.test(output)) {
            hasSeenRunning = true;
        } else if (hasSeenRunning && stoppedPattern?.test(output)) {
            return { state: "failed", detail: `stopped without completing — ${excerpt(output)}` };
        }
        return { state: "pending", detail: `${missingGoal} (last: ${excerpt(output)})` };
    };
    return pollUntil(probe, { description: goal, pendingDescription: missingGoal, intervalSeconds, ...timing });
}

/**
 * Splits a command line into the mode, its positional arguments and its `--name value` options.
 * @param {string[]} argumentList The arguments after the script name.
 * @returns {{ mode: string | undefined, positionals: string[], options: Record<string, string> }}
 * @throws {UsageError} When an option has no value.
 */
function parseArguments(argumentList) {
    const positionals = [];
    const options = {};
    for (let i = 0; i < argumentList.length; i += 1) {
        const argument = argumentList[i];
        if (!argument.startsWith("--")) {
            positionals.push(argument);
            continue;
        }
        const optionName = argument.slice(2);
        const optionValue = argumentList[i + 1];
        if (optionValue === undefined) throw new UsageError(`--${optionName} needs a value`);
        options[optionName] = optionValue;
        i += 1;
    }
    return { mode: positionals[0], positionals: positionals.slice(1), options };
}

/**
 * Reads a non-negative number option.
 * @param {Record<string, string>} options The parsed options.
 * @param {string} optionName The option.
 * @param {number | undefined} fallback The value when the option is absent.
 * @returns {number | undefined}
 * @throws {UsageError} When the value is not a non-negative number.
 */
function readNumberOption(options, optionName, fallback) {
    if (options[optionName] === undefined) return fallback;
    const value = Number(options[optionName]);
    if (!Number.isFinite(value) || value < 0) throw new UsageError(`--${optionName} must be a non-negative number`);
    return value;
}

/**
 * Checks the mode, its positional arguments and its options.
 * @param {string | undefined} mode The mode.
 * @param {string[]} positionals Its positional arguments.
 * @param {Record<string, string>} options Its options.
 * @throws {UsageError} When anything is missing, unknown or inconsistent.
 */
function validateArguments(mode, positionals, options) {
    if (mode === undefined) throw new UsageError("no mode given");
    if (!Object.hasOwn(MODE_OPTIONS, mode)) throw new UsageError(`unknown mode "${mode}"`);
    const requiredPositionals = mode === "log" ? 2 : 1;
    if (positionals.length !== requiredPositionals) throw new UsageError(`${mode} takes ${requiredPositionals} argument(s)`);
    const allowedOptions = [...COMMON_OPTIONS, ...MODE_OPTIONS[mode]];
    const unknownOption = Object.keys(options).find((optionName) => !allowedOptions.includes(optionName));
    if (unknownOption) throw new UsageError(`${mode} does not take --${unknownOption}`);
    if ((options.running === undefined) !== (options.stopped === undefined)) throw new UsageError("--running and --stopped go together");
}

/**
 * Reads and checks a port number.
 * @param {string} text The argument.
 * @returns {number}
 * @throws {UsageError} When it is not a port number.
 */
function parsePort(text) {
    const port = Number(text);
    if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) throw new UsageError(`"${text}" is not a port number`);
    return port;
}

/**
 * Reads and checks a URL.
 * @param {string} text The argument.
 * @returns {string} The URL.
 * @throws {UsageError} When it is not an http or https URL.
 */
function parseUrl(text) {
    let protocol = "";
    try {
        protocol = new URL(text).protocol;
    } catch {
        // Not a URL at all; reported below.
    }
    if (protocol !== "http:" && protocol !== "https:") throw new UsageError(`"${text}" is not an http(s) URL`);
    return text;
}

/**
 * Starts the wait a parsed command line asks for (an absent `--interval` passes undefined, so each wait's own
 * default applies).
 * @param {string} mode The mode.
 * @param {string[]} positionals Its positional arguments.
 * @param {Record<string, string>} options Its options.
 * @returns {Promise<WaitResult>}
 */
function startWait(mode, positionals, options) {
    const timing = {
        timeoutSeconds: readNumberOption(options, "timeout", DEFAULT_TIMEOUT_SECONDS),
        intervalSeconds: readNumberOption(options, "interval", undefined),
    };
    const [target, pattern] = positionals;
    switch (mode) {
        case "port":
            return waitForPort(parsePort(target), { host: options.host, ...timing });
        case "url":
            return waitForUrl(parseUrl(target), { status: readNumberOption(options, "status", DEFAULT_STATUS), ...timing });
        case "file":
            return waitForFile(target, timing);
        case "log":
            return waitForLog(target, pattern, timing);
        default:
            return waitForCommand(target, { match: options.match, fail: options.fail, running: options.running, stopped: options.stopped, ...timing });
    }
}

/**
 * Runs the command line: prints one line and returns the exit code.
 * @param {string[]} argumentList The arguments after the script name.
 * @returns {Promise<number>} 0 when the condition holds, 1 on a timeout or a fail match, 2 on bad arguments.
 */
export async function runCommandLine(argumentList) {
    try {
        const { mode, positionals, options } = parseArguments(argumentList);
        validateArguments(mode, positionals, options);
        const { ok, message } = await startWait(mode, positionals, options);
        if (!ok) {
            process.stderr.write(`${message}\n`);
            return EXIT_CODES.failed;
        }
        process.stdout.write(`${message}\n`);
        return EXIT_CODES.satisfied;
    } catch (error) {
        if (!(error instanceof UsageError)) throw error;
        process.stderr.write(`wait: ${error.message}\n${USAGE}\n`);
        return EXIT_CODES.usage;
    }
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
    process.exitCode = await runCommandLine(process.argv.slice(2));
}
