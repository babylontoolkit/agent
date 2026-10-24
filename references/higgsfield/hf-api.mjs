#!/usr/bin/env node
/**
 * hf-api.mjs — run one Higgsfield API generation with an API key and save every result file locally.
 *
 * The Higgsfield API (https://api.higgsfield.ai, keys from https://console.higgsfield.ai) is a separate,
 * separately billed product from the Higgsfield CLI and web app. It authenticates with a key ID and secret
 * (`Authorization: Key <id>:<secret>`), not with the CLI's browser sign-in. This script submits a request,
 * polls it with backoff, and downloads every output URL in the finished response.
 *
 *   node scripts/hf-api.mjs <model-path> --estimate [inputs]...      # price only, nothing is generated
 *   node scripts/hf-api.mjs <model-path> --out <dir> [inputs]...     # generate and download
 *
 * Inputs:
 *   --set name=value          a request field. The value is parsed as JSON when it can be
 *                             (true, 42, "text", [..]); otherwise it is sent as a string.
 *   --file name=path          upload a local image, audio or video file and send its public URL as `name`.
 *   --file name[]=path        the same, appended to the array field `name` (repeat it, in order).
 *   --body request.json       start from a JSON file of fields; --set and --file are applied on top.
 *
 * Options:
 *   --out <dir>               download folder. Each file is saved as <request_id>_<field>[_<n>].<ext>, and the
 *                             final status response as <request_id>.json, so an unfamiliar output shape is never lost.
 *   --timeout <minutes>       how long to wait for a terminal status (default 30).
 *
 * Credentials: HIGGSFIELD_API_KEY, HF_CREDENTIALS or HF_KEY ("<key id>:<key secret>"), or HF_API_KEY plus
 * HF_API_SECRET. When none is in the environment, the nearest `.env` from the current folder upward is read.
 * The credentials are never printed.
 *
 * stdout: one JSON object { request_id, status, files, estimate }. Progress and errors go to stderr.
 * Exit codes: 0 ok · 1 usage, credential or HTTP error · 2 the request ended without completing · 3 download failed.
 * Requires Node 18+ (global fetch). Zero dependencies.
 */

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";

/** The API host every request goes to. */
const API_BASE_URL = "https://api.higgsfield.ai";
/** Environment variables that hold "<key id>:<key secret>", in the order they are tried. */
const COMBINED_CREDENTIAL_VARIABLES = ["HIGGSFIELD_API_KEY", "HF_CREDENTIALS", "HF_KEY"];
/** Request states after which polling stops. */
const TERMINAL_STATUSES = new Set(["completed", "failed", "nsfw", "canceled"]);
/** First wait between status polls, in seconds; the API docs recommend starting at two. */
const INITIAL_POLL_SECONDS = 2;
/** Longest wait between status polls, in seconds. */
const MAXIMUM_POLL_SECONDS = 10;
/** Growth factor applied to the poll wait after every non-terminal status. */
const POLL_BACKOFF_FACTOR = 1.5;
/** Default wait budget for a request to finish, in minutes. */
const DEFAULT_TIMEOUT_MINUTES = 30;
/** Milliseconds per second and seconds per minute, for the timers. */
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
/** Content types the presigned upload accepts, by file extension. */
const UPLOAD_CONTENT_TYPES = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".wav": "audio/wav", ".mp4": "video/mp4",
};
/** Exit codes, matching hf-generate.mjs. */
const EXIT_USAGE = 1;
const EXIT_NOT_COMPLETED = 2;
const EXIT_DOWNLOAD_FAILED = 3;
/** Marks a --file field as an array: `image_urls[]=front.png`. */
const ARRAY_FIELD_SUFFIX = "[]";

/**
 * Prints a message to stderr and exits.
 * @param {number} exitCode - The process exit code.
 * @param {string} message - What went wrong.
 * @returns {never}
 */
function fail(exitCode, message) {
  process.stderr.write(`hf-api: ${message}\n`);
  process.exit(exitCode);
}

/**
 * Logs one progress line to stderr.
 * @param {string} message - The progress note.
 */
function report(message) {
  process.stderr.write(`hf-api: ${message}\n`);
}

/**
 * Reads `NAME=value` lines from the nearest `.env` file, from the current folder upward.
 * @returns {Record<string, string>} The variables found, or an empty object.
 */
function readNearestEnvironmentFile() {
  let folder = process.cwd();
  while (true) {
    const candidate = join(folder, ".env");
    if (existsSync(candidate)) return parseEnvironmentFile(readFileSync(candidate, "utf8"));
    const parent = dirname(folder);
    if (parent === folder) return {};
    folder = parent;
  }
}

/**
 * Parses the text of a `.env` file into variables; quotes around a value are removed.
 * @param {string} text - The file contents.
 * @returns {Record<string, string>} The variables.
 */
function parseEnvironmentFile(text) {
  const variables = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    variables[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return variables;
}

/**
 * Finds the API credentials, from the environment first and then the nearest `.env`.
 * @returns {string} "<key id>:<key secret>".
 */
function resolveCredentials() {
  const sources = [process.env, readNearestEnvironmentFile()];
  for (const variables of sources) {
    for (const name of COMBINED_CREDENTIAL_VARIABLES) {
      if (variables[name]?.includes(":")) return variables[name];
    }
    if (variables.HF_API_KEY && variables.HF_API_SECRET) return `${variables.HF_API_KEY}:${variables.HF_API_SECRET}`;
  }
  return fail(EXIT_USAGE, `no API credentials: set ${COMBINED_CREDENTIAL_VARIABLES[0]}="<key id>:<key secret>" (console.higgsfield.ai)`);
}

/**
 * Parses the command line into the model path, the options and the field edits.
 * @param {string[]} argumentsList - process.argv without node and the script path.
 * @returns {{ modelPath: string, estimateOnly: boolean, outputFolder: string | null, timeoutMinutes: number,
 *   bodyFile: string | null, fieldValues: Array<[string, string]>, fileFields: Array<[string, string]> }}
 */
function parseCommandLine(argumentsList) {
  const modelPath = argumentsList[0];
  if (!modelPath || modelPath.startsWith("-")) {
    fail(EXIT_USAGE, "usage: hf-api.mjs <model-path> (--estimate | --out <dir>) [--set name=value] [--file name=path] [--body file.json]");
  }
  const options = { modelPath: modelPath.replace(/^\/+/, ""), estimateOnly: false, outputFolder: null,
    timeoutMinutes: DEFAULT_TIMEOUT_MINUTES, bodyFile: null, fieldValues: [], fileFields: [] };
  for (let index = 1; index < argumentsList.length; index++) {
    const flag = argumentsList[index];
    const takeValue = () => {
      if (index + 1 >= argumentsList.length) fail(EXIT_USAGE, `${flag} needs a value`);
      index += 1;
      return argumentsList[index];
    };
    if (flag === "--estimate") options.estimateOnly = true;
    else if (flag === "--out") options.outputFolder = takeValue();
    else if (flag === "--timeout") options.timeoutMinutes = Number(takeValue());
    else if (flag === "--body") options.bodyFile = takeValue();
    else if (flag === "--set") options.fieldValues.push(splitAssignment(takeValue(), flag));
    else if (flag === "--file") options.fileFields.push(splitAssignment(takeValue(), flag));
    else fail(EXIT_USAGE, `unknown option ${flag}`);
  }
  if (!options.estimateOnly && !options.outputFolder) fail(EXIT_USAGE, "pass --out <dir> (or --estimate for a price only)");
  return options;
}

/**
 * Splits a `name=value` argument.
 * @param {string} assignment - The raw argument.
 * @param {string} flag - The flag it came with, for the error message.
 * @returns {[string, string]} The name and the value.
 */
function splitAssignment(assignment, flag) {
  const separator = assignment.indexOf("=");
  if (separator <= 0) fail(EXIT_USAGE, `${flag} expects name=value, got "${assignment}"`);
  return [assignment.slice(0, separator), assignment.slice(separator + 1)];
}

/**
 * Parses a --set value as JSON when possible, so booleans, numbers and arrays keep their types.
 * @param {string} text - The raw value.
 * @returns {unknown} The parsed value, or the text itself.
 */
function parseFieldValue(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Calls the API with the credentials and returns the parsed JSON body.
 * @param {string} credentials - "<key id>:<key secret>".
 * @param {string} method - The HTTP method.
 * @param {string} url - An absolute URL or a path on the API host.
 * @param {object} [body] - A JSON body to send.
 * @param {Record<string, string>} [extraHeaders] - More request headers.
 * @returns {Promise<any>} The response JSON.
 */
async function callApi(credentials, method, url, body, extraHeaders = {}) {
  const absoluteUrl = url.startsWith("http") ? url : `${API_BASE_URL}/${url.replace(/^\/+/, "")}`;
  const response = await fetch(absoluteUrl, {
    method,
    headers: { Authorization: `Key ${credentials}`, "Content-Type": "application/json", ...extraHeaders },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) fail(EXIT_USAGE, `${method} ${absoluteUrl} → ${response.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

/**
 * Uploads a local file through a presigned URL and returns its public URL. Credentials never reach the storage host.
 * @param {string} credentials - "<key id>:<key secret>".
 * @param {string} filePath - The local file.
 * @returns {Promise<string>} The public URL to pass as a model input.
 */
async function uploadFile(credentials, filePath) {
  const contentType = UPLOAD_CONTENT_TYPES[extname(filePath).toLowerCase()];
  if (!contentType) fail(EXIT_USAGE, `cannot upload ${filePath}: supported types are ${Object.keys(UPLOAD_CONTENT_TYPES).join(" ")}`);
  const upload = await callApi(credentials, "POST", "files/generate-upload-url", { content_type: contentType });
  const response = await fetch(upload.upload_url, { method: "PUT", headers: upload.upload_headers, body: readFileSync(filePath) });
  if (!response.ok) fail(EXIT_USAGE, `upload of ${filePath} failed: ${response.status}`);
  report(`uploaded ${filePath}`);
  return upload.public_url;
}

/**
 * Builds the request body from --body, --set and --file, uploading files in argument order.
 * @param {string} credentials - "<key id>:<key secret>".
 * @param {ReturnType<typeof parseCommandLine>} options - The parsed command line.
 * @returns {Promise<Record<string, unknown>>} The request fields.
 */
async function buildRequestBody(credentials, options) {
  const fields = options.bodyFile ? JSON.parse(readFileSync(options.bodyFile, "utf8")) : {};
  for (const [name, value] of options.fieldValues) fields[name] = parseFieldValue(value);
  for (const [rawName, filePath] of options.fileFields) {
    const publicUrl = await uploadFile(credentials, filePath);
    if (!rawName.endsWith(ARRAY_FIELD_SUFFIX)) {
      fields[rawName] = publicUrl;
      continue;
    }
    const arrayName = rawName.slice(0, -ARRAY_FIELD_SUFFIX.length);
    fields[arrayName] = [...(Array.isArray(fields[arrayName]) ? fields[arrayName] : []), publicUrl];
  }
  return fields;
}

/**
 * Waits for the given number of seconds.
 * @param {number} seconds - How long to wait.
 * @returns {Promise<void>}
 */
function wait(seconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, seconds * MILLISECONDS_PER_SECOND));
}

/**
 * Polls a request's status URL with backoff until it reaches a terminal state or the timeout passes.
 * @param {string} credentials - "<key id>:<key secret>".
 * @param {string} statusUrl - The `status_url` from the submission.
 * @param {number} timeoutMinutes - The wait budget.
 * @returns {Promise<any>} The last status response.
 */
async function pollUntilFinished(credentials, statusUrl, timeoutMinutes) {
  const deadline = Date.now() + timeoutMinutes * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
  let delaySeconds = INITIAL_POLL_SECONDS;
  let lastStatus = "";
  while (true) {
    const result = await callApi(credentials, "GET", statusUrl);
    if (result.status !== lastStatus) report(`status ${result.status}`);
    lastStatus = result.status;
    if (TERMINAL_STATUSES.has(result.status)) return result;
    if (Date.now() > deadline) return result;
    await wait(delaySeconds);
    delaySeconds = Math.min(delaySeconds * POLL_BACKOFF_FACTOR, MAXIMUM_POLL_SECONDS);
  }
}

/**
 * Collects every downloadable URL in a finished response, with the field path it came from.
 * Images, video, audio and 3D artefacts (glb, fbx, ply, zip …) appear under different keys per model.
 * @param {unknown} value - The response or a part of it.
 * @param {string} fieldPath - Where `value` sits in the response.
 * @param {Array<{ field: string, url: string }>} found - Accumulates the results.
 * @returns {Array<{ field: string, url: string }>} Every `url` field found.
 */
function collectOutputUrls(value, fieldPath, found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectOutputUrls(item, `${fieldPath}_${index + 1}`, found));
    return found;
  }
  if (value === null || typeof value !== "object") return found;
  for (const [key, child] of Object.entries(value)) {
    const childPath = fieldPath ? `${fieldPath}_${key}` : key;
    const isUrl = typeof child === "string" && /^https?:\/\//.test(child) && !/status_url|cancel_url/.test(key);
    if (isUrl) found.push({ field: childPath, url: child });
    else collectOutputUrls(child, childPath, found);
  }
  return found;
}

/**
 * Downloads every output URL into the output folder.
 * @param {Array<{ field: string, url: string }>} outputs - The URLs to fetch.
 * @param {string} outputFolder - Where to save them.
 * @param {string} requestId - Used to name the files.
 * @returns {Promise<string[]>} The saved file paths.
 */
async function downloadOutputs(outputs, outputFolder, requestId) {
  const savedFiles = [];
  for (const output of outputs) {
    const extension = extname(new URL(output.url).pathname) || ".bin";
    const fileName = `${requestId}_${output.field.replace(/_url$/, "").replace(/[^A-Za-z0-9_.-]/g, "_")}${extension}`;
    const filePath = join(outputFolder, fileName);
    const response = await fetch(output.url);
    if (!response.ok) fail(EXIT_DOWNLOAD_FAILED, `download of ${output.url} failed: ${response.status}`);
    writeFileSync(filePath, Buffer.from(await response.arrayBuffer()));
    report(`saved ${filePath}`);
    savedFiles.push(filePath);
  }
  return savedFiles;
}

/**
 * Runs the estimate or the full generation, then prints the result as JSON on stdout.
 */
async function main() {
  const options = parseCommandLine(process.argv.slice(2));
  const credentials = resolveCredentials();
  const body = await buildRequestBody(credentials, options);
  const estimate = await callApi(credentials, "POST", `estimate/${options.modelPath}`, body);
  report(`estimate ${JSON.stringify(estimate)}`);
  if (options.estimateOnly) {
    process.stdout.write(`${JSON.stringify({ estimate }, null, 2)}\n`);
    return;
  }
  const submission = await callApi(credentials, "POST", options.modelPath, body, { "Idempotency-Key": randomUUID() });
  report(`submitted ${submission.request_id}`);
  const finished = await pollUntilFinished(credentials, submission.status_url, options.timeoutMinutes);
  const outputFolder = resolve(options.outputFolder);
  mkdirSync(outputFolder, { recursive: true });
  writeFileSync(join(outputFolder, `${submission.request_id}.json`), JSON.stringify(finished, null, 2));
  if (finished.status !== "completed") {
    process.stdout.write(`${JSON.stringify({ request_id: submission.request_id, status: finished.status, files: [], estimate }, null, 2)}\n`);
    process.exit(EXIT_NOT_COMPLETED);
  }
  const files = await downloadOutputs(collectOutputUrls(finished, ""), outputFolder, submission.request_id);
  process.stdout.write(`${JSON.stringify({ request_id: submission.request_id, status: finished.status, files, estimate }, null, 2)}\n`);
}

main().catch((error) => fail(EXIT_USAGE, error?.stack ?? String(error)));
