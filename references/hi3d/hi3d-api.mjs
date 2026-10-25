#!/usr/bin/env node
/**
 * hi3d-api.mjs — run one Hi3D API task with an API key and save every result file locally.
 *
 * Hi3D (https://www.hi3d.ai, API keys from the Hi3D Open Platform console, docs at https://docs.hi3d.ai) turns
 * images into high-fidelity 3D models with its Sparc3D / Ultra3D models. The API host is https://api.hitem3d.ai.
 * An API key is an AK/SK pair (client id + client secret). This script exchanges it for a Bearer token, submits a
 * multipart task, polls it with backoff, and downloads every output URL in the finished response. Result URLs are
 * valid for one hour only, so they are downloaded at once.
 *
 *   node hi3d-api.mjs <operation> --estimate [inputs]...                  # price + balance only, nothing is generated
 *   node hi3d-api.mjs <operation> --out <dir> [--name <base>] [inputs]... # generate and download
 *   node hi3d-api.mjs <operation> --task <task_id> --out <dir>            # resume polling a submitted task, no new charge
 *   node hi3d-api.mjs balance                                             # the account balance
 *
 * Operations:
 *   image-to-3d               single image or multi-view → 3D model (geometry, texture, PBR). Defaults:
 *                             request_type=3 (geometry + texture), model=hi3dv3.0, resolution=2048quality, format=glb.
 *   relief                    single image → 3D relief / depth map (the depth endpoint). Defaults: model_type=pro,
 *                             rmbg=1, format=glb.
 *   split                     3D model → separated parts. Default: format=glb (the API's own default model is character).
 *   multicolor                textured GLB → multicolor model. Defaults: model=multicolor, format=glb.
 *
 * Inputs:
 *   --set name=value          a form field, sent as text (request_type=3, face=200000, pbr=1, mesh_url=https://…).
 *   --file name=path          a local file sent as the form field `name` (images=prop.png, mesh=geometry.glb).
 *                             Repeat a name to send several files in order; `name[]=path` is accepted too.
 *   --view side=path          image-to-3d multi-view: side is front, back, left or right. Builds `multi_images` in
 *                             the API's order (front, back, left, right) and `multi_images_bit`. The front view is
 *                             required; a front view alone is sent as a single image.
 *   --format name             the output format by name (glb, fbx, obj, stl, usdz, 3mf; relief also exr, png, bmp).
 *
 * Options:
 *   --out <dir>               download folder. Files are saved as <base>.<ext> (the model), <base>_cover.<ext>, and the
 *                             final task response as <base>.json, so an unfamiliar output shape is never lost.
 *   --name <base>             the file name base (default: the first part of the task id).
 *   --timeout <minutes>       how long to wait for a terminal state (default 60, the API's own task timeout).
 *
 * Credentials: HI3D_ACCESS_KEY plus HI3D_SECRET_KEY (the AK and SK from the Hi3D console), or HI3D_API_KEY holding
 * "<access key>:<secret key>" (or that pair already Base64-encoded). When neither is in the environment, the nearest
 * `.env` from the current folder upward is read. The credentials and the access token are never printed.
 *
 * stdout: one JSON object { task_id, state, files, estimate }. Progress and errors go to stderr.
 * Exit codes: 0 ok · 1 usage, credential or HTTP error · 2 the task ended without succeeding · 3 download failed.
 * Requires Node 18+ (global fetch, FormData and Blob). Zero dependencies.
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";

/** The API host every request goes to. */
const API_BASE_URL = "https://api.hitem3d.ai";
/** Exchanges the Basic API key for a Bearer access token. */
const TOKEN_PATH = "open-api/v1/auth/token";
/** Returns the account balance. */
const BALANCE_PATH = "open-api/v1/balance";
/** The `code` every successful response carries in its JSON envelope (HTTP status is 200 even on errors). */
const SUCCESS_CODE = 200;
/** The envelope `code` (inside an HTTP 200) for a missing, wrong or expired access token. */
const UNAUTHORIZED_CODE = 401;
/** Envelope codes a task query returns when generation failed; the credits are refunded. */
const GENERATION_FAILED_CODES = new Set([50010001, 5001001]);
/** The environment variables that hold the access key (AK, the client id) and the secret key (SK, the client secret). */
const ACCESS_KEY_VARIABLE = "HI3D_ACCESS_KEY";
const SECRET_KEY_VARIABLE = "HI3D_SECRET_KEY";
/** The alternative single variable holding "<access key>:<secret key>". */
const COMBINED_CREDENTIAL_VARIABLE = "HI3D_API_KEY";
/** Task states that end polling, and the one that means the task produced results. */
const SUCCESS_STATE = "success";
const TERMINAL_STATES = new Set([SUCCESS_STATE, "failed"]);
/** First wait between status polls, in seconds; 3D tasks take minutes, so polling starts slower than for images. */
const INITIAL_POLL_SECONDS = 5;
/** Longest wait between status polls, in seconds. */
const MAXIMUM_POLL_SECONDS = 20;
/** Growth factor applied to the poll wait after every non-terminal state. */
const POLL_BACKOFF_FACTOR = 1.5;
/** Default wait budget, in minutes: the API fails and refunds a task after 60. */
const DEFAULT_TIMEOUT_MINUTES = 60;
/** Milliseconds per second and seconds per minute, for the timers. */
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
/** Bytes per megabyte, for the input size limits. */
const BYTES_PER_MEGABYTE = 1024 * 1024;
/** Price of one credit in US dollars (docs.hi3d.ai pricing page). */
const CREDIT_PRICE_USD = 0.02;
/** Exit codes, matching hf-api.mjs. */
const EXIT_USAGE = 1;
const EXIT_NOT_COMPLETED = 2;
const EXIT_DOWNLOAD_FAILED = 3;
/** Marks a --file field as an array, accepted for symmetry with hf-api.mjs: `multi_images[]=front.png`. */
const ARRAY_FIELD_SUFFIX = "[]";

/** Input files the API accepts, by extension: content type and the per-file size limit in megabytes. */
const INPUT_FILE_TYPES = {
  ".png": { contentType: "image/png", maximumMegabytes: 20 },
  ".jpg": { contentType: "image/jpeg", maximumMegabytes: 20 },
  ".jpeg": { contentType: "image/jpeg", maximumMegabytes: 20 },
  ".webp": { contentType: "image/webp", maximumMegabytes: 20 },
  ".glb": { contentType: "model/gltf-binary", maximumMegabytes: 200 },
  ".stl": { contentType: "model/stl", maximumMegabytes: 200 },
  ".obj": { contentType: "model/obj", maximumMegabytes: 200 },
};

/** Output format codes shared by image-to-3d and split. */
const MODEL_FORMAT_CODES = { obj: 1, glb: 2, stl: 3, fbx: 4, usdz: 5, "3mf": 6 };

/**
 * Every operation the script drives: its endpoints, the defaults it sends, its format codes and its flat price.
 * The multicolor create endpoint really is spelled `muilticolor`; the docs say to keep that spelling.
 */
const OPERATIONS = {
  "image-to-3d": {
    createPath: "open-api/v1/submit-task",
    queryPath: "open-api/v1/query-task",
    defaults: { request_type: "3", model: "hi3dv3.0", format: "2" },
    formatCodes: MODEL_FORMAT_CODES,
    flatCredits: null,
  },
  relief: {
    createPath: "open-api/v1/depth/create-task",
    queryPath: "open-api/v1/depth/query-task",
    defaults: { model_type: "pro", rmbg: "1", format: "4" },
    formatCodes: { exr: 1, png: 2, stl: 3, glb: 4, "3mf": 5, bmp: 6 },
    flatCredits: 10,
  },
  split: {
    createPath: "open-api/v1/split/create-task",
    queryPath: "open-api/v1/split/query-task",
    defaults: { format: "2" },
    formatCodes: MODEL_FORMAT_CODES,
    flatCredits: 20,
  },
  multicolor: {
    createPath: "open-api/v1/muilticolor/create-task",
    queryPath: "open-api/v1/multicolor/query-task",
    defaults: { model: "multicolor", format: "2" },
    formatCodes: { obj: 1, glb: 2, fbx: 4, "3mf": 6 },
    flatCredits: 20,
  },
};

/** The only image-to-3d model whose default resolution the docs state. */
const DEFAULT_IMAGE_TO_3D_MODEL = "hi3dv3.0";
const DEFAULT_IMAGE_TO_3D_RESOLUTION = "2048quality";
/** Geometry credits per image-to-3d model and resolution (docs.hi3d.ai pricing, 2026-10-24). */
const GEOMETRY_CREDITS = {
  "hi3dv3.0": { "2048quality": 30, "2048master": 130 },
  "hitem3dv2.1": { "1536fast": 10, "1536pro": 30 },
  "hitem3dv2.0": { "1536": 20, "1536pro": 30 },
  "hitem3dv1.5": { "512": 5, "1024": 10, "1536": 20, "1536pro": 30 },
  "scene-portraitv2.1": { "1536profast": 10, "1536pro": 30 },
  "scene-portraitv2.0": { "1536pro": 30 },
  "scene-portraitv1.5": { "1536": 20 },
};
/** Credits added for texturing, and for PBR maps on top of the texture. */
const TEXTURE_CREDITS = 10;
const PBR_CREDITS = 5;
/** The v1.5 models have no PBR option. */
const MODELS_WITHOUT_PBR = new Set(["hitem3dv1.5", "scene-portraitv1.5"]);
/** image-to-3d request types: geometry only, texture onto an existing mesh, or both in one go. */
const REQUEST_TYPE_GEOMETRY = "1";
const REQUEST_TYPE_TEXTURE = "2";
/** The multi-view slots, in the order the API expects them in `multi_images` and `multi_images_bit`. */
const VIEW_ORDER = ["front", "back", "left", "right"];

/**
 * Prints a message to stderr and exits.
 * @param {number} exitCode - The process exit code.
 * @param {string} message - What went wrong.
 * @returns {never}
 */
function fail(exitCode, message) {
  process.stderr.write(`hi3d-api: ${message}\n`);
  process.exit(exitCode);
}

/**
 * Logs one progress line to stderr.
 * @param {string} message - The progress note.
 */
function report(message) {
  process.stderr.write(`hi3d-api: ${message}\n`);
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
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    variables[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return variables;
}

/**
 * Turns a combined key value into the Base64 `access_key:secret_key` pair the token endpoint expects.
 * Accepts the plain pair, or a pair that is already Base64-encoded.
 * @param {string} keyValue - The value of the combined credential variable.
 * @returns {string | null} The Base64 pair, or null when the value is neither form.
 */
function encodeCombinedCredential(keyValue) {
  if (keyValue.includes(":")) return Buffer.from(keyValue, "utf8").toString("base64");
  const decoded = Buffer.from(keyValue, "base64").toString("utf8");
  const isPrintablePair = decoded.includes(":") && /^[\x20-\x7e]+$/.test(decoded);
  return isPrintablePair ? keyValue : null;
}

/**
 * Finds the API credentials, from the environment first and then the nearest `.env`. In each source the
 * access key / secret key pair wins over the combined variable.
 * @returns {string | null} The Base64 `access_key:secret_key` pair, or null when no credential variable is set.
 */
function findBasicCredential() {
  const sources = [process.env, readNearestEnvironmentFile()];
  for (const variables of sources) {
    const accessKey = variables[ACCESS_KEY_VARIABLE];
    const secretKey = variables[SECRET_KEY_VARIABLE];
    if (accessKey && secretKey) return Buffer.from(`${accessKey}:${secretKey}`, "utf8").toString("base64");
    if (accessKey || secretKey) fail(EXIT_USAGE, `set both ${ACCESS_KEY_VARIABLE} and ${SECRET_KEY_VARIABLE}; only one of them has a value`);
    const combinedValue = variables[COMBINED_CREDENTIAL_VARIABLE];
    if (!combinedValue) continue;
    const basicCredential = encodeCombinedCredential(combinedValue);
    if (!basicCredential) fail(EXIT_USAGE, `${COMBINED_CREDENTIAL_VARIABLE} must be "<access key>:<secret key>"`);
    return basicCredential;
  }
  return null;
}

/**
 * Finds the API credentials or exits with the variables to set.
 * @returns {string} The Base64 `access_key:secret_key` pair.
 */
function requireBasicCredential() {
  return findBasicCredential()
    ?? fail(EXIT_USAGE, `no API credentials: set ${ACCESS_KEY_VARIABLE} and ${SECRET_KEY_VARIABLE} in the project's .env (Hi3D console → API Key)`);
}

/**
 * Parses the command line into the operation, the options and the field edits.
 * @param {string[]} argumentsList - process.argv without node and the script path.
 * @returns {{ operationName: string, estimateOnly: boolean, outputFolder: string | null, outputName: string | null,
 *   taskId: string | null, timeoutMinutes: number, formatName: string | null, fieldValues: Array<[string, string]>,
 *   fileFields: Array<[string, string]>, views: Map<string, string> }}
 */
function parseCommandLine(argumentsList) {
  const operationName = argumentsList[0];
  const knownOperations = [...Object.keys(OPERATIONS), "balance"];
  if (!knownOperations.includes(operationName)) {
    fail(EXIT_USAGE, `usage: hi3d-api.mjs <${knownOperations.join("|")}> (--estimate | --out <dir>) [--set name=value] [--file name=path] [--view side=path] [--format glb]`);
  }
  const options = { operationName, estimateOnly: false, outputFolder: null, outputName: null, taskId: null,
    timeoutMinutes: DEFAULT_TIMEOUT_MINUTES, formatName: null, fieldValues: [], fileFields: [], views: new Map() };
  for (let index = 1; index < argumentsList.length; index++) {
    const flag = argumentsList[index];
    const takeValue = () => {
      if (index + 1 >= argumentsList.length) fail(EXIT_USAGE, `${flag} needs a value`);
      index += 1;
      return argumentsList[index];
    };
    if (flag === "--estimate") options.estimateOnly = true;
    else if (flag === "--out") options.outputFolder = takeValue();
    else if (flag === "--name") options.outputName = takeValue();
    else if (flag === "--task") options.taskId = takeValue();
    else if (flag === "--timeout") options.timeoutMinutes = Number(takeValue());
    else if (flag === "--format") options.formatName = takeValue().toLowerCase();
    else if (flag === "--set") options.fieldValues.push(splitAssignment(takeValue(), flag));
    else if (flag === "--file") options.fileFields.push(splitAssignment(takeValue(), flag));
    else if (flag === "--view") addView(options.views, splitAssignment(takeValue(), flag));
    else fail(EXIT_USAGE, `unknown option ${flag}`);
  }
  const needsOutputFolder = operationName !== "balance" && !options.estimateOnly;
  if (needsOutputFolder && !options.outputFolder) fail(EXIT_USAGE, "pass --out <dir> (or --estimate for a price only)");
  if (options.taskId && options.estimateOnly) fail(EXIT_USAGE, "--task resumes a submitted task; it cannot be combined with --estimate");
  if (!Number.isFinite(options.timeoutMinutes) || options.timeoutMinutes <= 0) fail(EXIT_USAGE, "--timeout must be a positive number of minutes");
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
 * Records one multi-view image under its side.
 * @param {Map<string, string>} views - The views collected so far.
 * @param {[string, string]} assignment - The side and the image path.
 */
function addView(views, [side, imagePath]) {
  const normalizedSide = side.toLowerCase();
  if (!VIEW_ORDER.includes(normalizedSide)) fail(EXIT_USAGE, `--view side must be one of ${VIEW_ORDER.join(", ")}, got "${side}"`);
  if (views.has(normalizedSide)) fail(EXIT_USAGE, `--view ${normalizedSide} was given twice`);
  views.set(normalizedSide, imagePath);
}

/**
 * Builds the text fields: the operation's defaults, then --format, then --set (the last word wins).
 * @param {typeof OPERATIONS[keyof typeof OPERATIONS]} operation - The operation being run.
 * @param {ReturnType<typeof parseCommandLine>} options - The parsed command line.
 * @returns {Record<string, string>} The form's text fields.
 */
function buildTextFields(operation, options) {
  const fields = { ...operation.defaults };
  if (options.formatName) {
    const formatCode = operation.formatCodes[options.formatName];
    if (formatCode === undefined) fail(EXIT_USAGE, `${options.operationName} formats are ${Object.keys(operation.formatCodes).join(", ")}`);
    fields.format = String(formatCode);
  }
  for (const [name, value] of options.fieldValues) fields[name] = value;
  const usesDefaultModel = options.operationName === "image-to-3d" && fields.model === DEFAULT_IMAGE_TO_3D_MODEL;
  if (usesDefaultModel && fields.resolution === undefined) fields.resolution = DEFAULT_IMAGE_TO_3D_RESOLUTION;
  return fields;
}

/**
 * Lists the files to send, in order: --view images as `multi_images` (or `images` for a front view alone), then --file.
 * Adds `multi_images_bit` to the text fields when views were given.
 * @param {ReturnType<typeof parseCommandLine>} options - The parsed command line.
 * @param {Record<string, string>} textFields - The text fields, updated in place.
 * @returns {Array<{ fieldName: string, filePath: string }>} The files and the form field each one goes in.
 */
function collectFileFields(options, textFields) {
  const files = [];
  if (options.views.size > 0) {
    if (options.operationName !== "image-to-3d") fail(EXIT_USAGE, "--view is only for image-to-3d");
    if (!options.views.has("front")) fail(EXIT_USAGE, "multi-view needs a --view front=<image>; back, left and right are optional");
    if (options.views.size === 1) {
      files.push({ fieldName: "images", filePath: options.views.get("front") });
    } else {
      const presentViews = VIEW_ORDER.filter((side) => options.views.has(side));
      for (const side of presentViews) files.push({ fieldName: "multi_images", filePath: options.views.get(side) });
      textFields.multi_images_bit = VIEW_ORDER.map((side) => (options.views.has(side) ? "1" : "0")).join("");
    }
  }
  for (const [rawName, filePath] of options.fileFields) {
    const fieldName = rawName.endsWith(ARRAY_FIELD_SUFFIX) ? rawName.slice(0, -ARRAY_FIELD_SUFFIX.length) : rawName;
    files.push({ fieldName, filePath });
  }
  return files;
}

/**
 * Checks an input file exists and is a type and size the API accepts.
 * @param {string} filePath - The local file.
 * @returns {{ contentType: string, maximumMegabytes: number }} Its type entry.
 */
function validateInputFile(filePath) {
  if (!existsSync(filePath)) fail(EXIT_USAGE, `input file not found: ${filePath}`);
  const fileType = INPUT_FILE_TYPES[extname(filePath).toLowerCase()];
  if (!fileType) fail(EXIT_USAGE, `cannot send ${filePath}: supported types are ${Object.keys(INPUT_FILE_TYPES).join(" ")}`);
  const sizeInMegabytes = statSync(filePath).size / BYTES_PER_MEGABYTE;
  if (sizeInMegabytes > fileType.maximumMegabytes) {
    fail(EXIT_USAGE, `${filePath} is ${sizeInMegabytes.toFixed(1)} MB; the limit for this type is ${fileType.maximumMegabytes} MB`);
  }
  return fileType;
}

/**
 * Builds the multipart form from the text fields and the files.
 * @param {Record<string, string>} textFields - The text fields.
 * @param {Array<{ fieldName: string, filePath: string }>} files - The files, in order.
 * @returns {FormData} The request body.
 */
function buildForm(textFields, files) {
  const form = new FormData();
  for (const [name, value] of Object.entries(textFields)) form.append(name, value);
  for (const { fieldName, filePath } of files) {
    const { contentType } = validateInputFile(filePath);
    form.append(fieldName, new Blob([readFileSync(filePath)], { type: contentType }), basename(filePath));
  }
  return form;
}

/**
 * Works out the task's price in credits from the published price table.
 * @param {string} operationName - The operation being run.
 * @param {typeof OPERATIONS[keyof typeof OPERATIONS]} operation - Its definition.
 * @param {Record<string, string>} textFields - The fields that will be sent.
 * @returns {number | null} The credits, or null when the combination is not in the table.
 */
function estimateCredits(operationName, operation, textFields) {
  if (operation.flatCredits !== null) return operation.flatCredits;
  if (operationName !== "image-to-3d") return null;
  const geometryCredits = GEOMETRY_CREDITS[textFields.model]?.[textFields.resolution];
  if (geometryCredits === undefined) return null;
  const requestType = textFields.request_type;
  const pbrEnabled = !MODELS_WITHOUT_PBR.has(textFields.model) && textFields.pbr !== "0";
  const textureCredits = TEXTURE_CREDITS + (pbrEnabled ? PBR_CREDITS : 0);
  if (requestType === REQUEST_TYPE_GEOMETRY) return geometryCredits;
  if (requestType === REQUEST_TYPE_TEXTURE) return textureCredits;
  return geometryCredits + textureCredits;
}

/**
 * Reads a response's JSON envelope ({ code, data, msg }). The API answers HTTP 200 even for errors and puts the real
 * status in `code`, so callers check both.
 * @param {Response} response - The fetch response.
 * @param {string} description - The request, for the error message.
 * @returns {Promise<{ httpStatus: number, envelope: any }>} The HTTP status and the parsed envelope.
 */
async function readEnvelope(response, description) {
  const text = await response.text();
  try {
    return { httpStatus: response.status, envelope: text ? JSON.parse(text) : {} };
  } catch {
    return fail(EXIT_USAGE, `${description} → HTTP ${response.status} ${text.slice(0, 400)}`);
  }
}

/**
 * Tells whether a reply is a success: HTTP 2xx and envelope `code` 200.
 * @param {{ httpStatus: number, envelope: any }} reply - The reply from readEnvelope.
 * @returns {boolean} True on success.
 */
function isSuccessReply(reply) {
  const isHttpOk = reply.httpStatus >= 200 && reply.httpStatus < 300;
  return isHttpOk && Number(reply.envelope.code) === SUCCESS_CODE;
}

/**
 * Returns a reply's envelope, or exits with its error code and message.
 * @param {{ httpStatus: number, envelope: any }} reply - The reply from readEnvelope.
 * @param {string} description - The request, for the error message.
 * @returns {any} The envelope.
 */
function requireSuccess(reply, description) {
  if (isSuccessReply(reply)) return reply.envelope;
  const message = reply.envelope.msg ?? reply.envelope.message ?? "";
  return fail(EXIT_USAGE, `${description} → HTTP ${reply.httpStatus}, code ${reply.envelope.code}: ${message}`);
}

/**
 * Exchanges the API key for an access token. The key and the token are never printed.
 * @param {string} basicCredential - The Base64 `client_id:client_secret` pair.
 * @returns {Promise<string>} The Bearer access token.
 */
async function requestAccessToken(basicCredential) {
  const description = `POST /${TOKEN_PATH}`;
  const response = await fetch(`${API_BASE_URL}/${TOKEN_PATH}`, {
    method: "POST",
    headers: { Authorization: `Basic ${basicCredential}`, "Content-Type": "application/json" },
  });
  const envelope = requireSuccess(await readEnvelope(response, description), description);
  const accessToken = envelope.data?.accessToken;
  if (!accessToken) fail(EXIT_USAGE, `${description} returned no accessToken`);
  return accessToken;
}

/**
 * Sends an authenticated request and reads its envelope. The docs show `Authorization: Token …` for the split and
 * multicolor queries and `Bearer …` everywhere else, so an unauthorized reply under Bearer (HTTP 401, or `code` 401
 * inside an HTTP 200) is retried once with the Token scheme.
 * @param {string} accessToken - The access token.
 * @param {string} method - The HTTP method.
 * @param {string} path - The path on the API host, with any query string.
 * @param {FormData} [form] - A multipart body to send.
 * @returns {Promise<{ httpStatus: number, envelope: any }>} The reply.
 */
async function callAuthorized(accessToken, method, path, form) {
  const description = `${method} /${path.split("?")[0]}`;
  const send = async (scheme) => {
    const response = await fetch(`${API_BASE_URL}/${path}`, {
      method,
      headers: { Authorization: `${scheme} ${accessToken}` },
      body: form,
    });
    return readEnvelope(response, description);
  };
  const bearerReply = await send("Bearer");
  const isUnauthorized = bearerReply.httpStatus === UNAUTHORIZED_CODE || Number(bearerReply.envelope.code) === UNAUTHORIZED_CODE;
  return isUnauthorized ? send("Token") : bearerReply;
}

/**
 * Reads the account balance.
 * @param {string} accessToken - The access token.
 * @returns {Promise<number | null>} The balance as the API reports it.
 */
async function queryBalance(accessToken) {
  const envelope = requireSuccess(await callAuthorized(accessToken, "GET", BALANCE_PATH), `GET /${BALANCE_PATH}`);
  return envelope.data?.totalBalance ?? null;
}

/**
 * Submits the task.
 * @param {string} accessToken - The access token.
 * @param {typeof OPERATIONS[keyof typeof OPERATIONS]} operation - The operation being run.
 * @param {FormData} form - The multipart body.
 * @returns {Promise<string>} The task id.
 */
async function submitTask(accessToken, operation, form) {
  const description = `POST /${operation.createPath}`;
  const envelope = requireSuccess(await callAuthorized(accessToken, "POST", operation.createPath, form), description);
  const taskId = envelope.data?.task_id;
  if (!taskId) fail(EXIT_USAGE, `POST /${operation.createPath} returned no task_id`);
  return taskId;
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
 * Polls a task with backoff until it reaches a terminal state or the timeout passes. A failed task comes back as
 * an error envelope (code 50010001 / 5001001, "generate failed", credits refunded), which is returned as `failed`.
 * @param {string} accessToken - The access token.
 * @param {typeof OPERATIONS[keyof typeof OPERATIONS]} operation - The operation being run.
 * @param {string} taskId - The task to poll.
 * @param {number} timeoutMinutes - The wait budget.
 * @returns {Promise<any>} The last response envelope, with `data.state` set.
 */
async function pollUntilFinished(accessToken, operation, taskId, timeoutMinutes) {
  const deadline = Date.now() + timeoutMinutes * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
  const queryPath = `${operation.queryPath}?task_id=${encodeURIComponent(taskId)}`;
  let delaySeconds = INITIAL_POLL_SECONDS;
  let lastState = "";
  while (true) {
    const reply = await callAuthorized(accessToken, "GET", queryPath);
    const isTaskFailure = GENERATION_FAILED_CODES.has(Number(reply.envelope.code));
    if (isTaskFailure) return { ...reply.envelope, data: { ...reply.envelope.data, task_id: taskId, state: "failed" } };
    const envelope = requireSuccess(reply, `GET /${operation.queryPath}`);
    const state = envelope.data?.state ?? "unknown";
    if (state !== lastState) report(`state ${state}`);
    lastState = state;
    if (TERMINAL_STATES.has(state)) return envelope;
    if (Date.now() > deadline) return envelope;
    await wait(delaySeconds);
    delaySeconds = Math.min(delaySeconds * POLL_BACKOFF_FACTOR, MAXIMUM_POLL_SECONDS);
  }
}

/**
 * Collects every downloadable URL in a finished task: the model (`url`), the preview (`cover_url`) and any other.
 * @param {Record<string, unknown>} data - The `data` object of the finished task.
 * @returns {Array<{ suffix: string, url: string }>} Each URL with the file-name suffix it is saved under.
 */
function collectOutputUrls(data) {
  const outputs = [];
  for (const [key, value] of Object.entries(data ?? {})) {
    const isUrl = typeof value === "string" && /^https?:\/\//.test(value);
    if (!isUrl) continue;
    const suffix = key === "url" ? "" : `_${key.replace(/_url$/, "").replace(/[^A-Za-z0-9_.-]/g, "_")}`;
    outputs.push({ suffix, url: value });
  }
  return outputs;
}

/**
 * Downloads every output URL into the output folder.
 * @param {Array<{ suffix: string, url: string }>} outputs - The URLs to fetch.
 * @param {string} outputFolder - Where to save them.
 * @param {string} baseName - The file name base.
 * @returns {Promise<string[]>} The saved file paths.
 */
async function downloadOutputs(outputs, outputFolder, baseName) {
  const savedFiles = [];
  for (const output of outputs) {
    const extension = extname(new URL(output.url).pathname) || ".bin";
    const filePath = join(outputFolder, `${baseName}${output.suffix}${extension}`);
    const response = await fetch(output.url);
    if (!response.ok) fail(EXIT_DOWNLOAD_FAILED, `download of ${output.url} failed: ${response.status}`);
    writeFileSync(filePath, Buffer.from(await response.arrayBuffer()));
    report(`saved ${filePath}`);
    savedFiles.push(filePath);
  }
  return savedFiles;
}

/**
 * The default file name base: the task id's first segment (a 32-character hex id), made safe for a file name.
 * @param {string} taskId - The task id.
 * @returns {string} The base name.
 */
function defaultBaseName(taskId) {
  return taskId.split(".")[0].replace(/[^A-Za-z0-9_-]/g, "_");
}

/**
 * Prints the script's result object on stdout.
 * @param {object} result - The result to print.
 */
function printResult(result) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

/**
 * Prints the balance and exits.
 */
async function runBalance() {
  const accessToken = await requestAccessToken(requireBasicCredential());
  printResult({ balance: await queryBalance(accessToken) });
}

/**
 * Runs the estimate, the full task, or the resume of a submitted task, then prints the result on stdout.
 * @param {ReturnType<typeof parseCommandLine>} options - The parsed command line.
 */
async function runTask(options) {
  const operation = OPERATIONS[options.operationName];
  let estimate = null;
  let taskId = options.taskId;
  const basicCredential = options.estimateOnly ? findBasicCredential() : requireBasicCredential();
  const accessToken = basicCredential ? await requestAccessToken(basicCredential) : null;

  if (!taskId) {
    const textFields = buildTextFields(operation, options);
    const files = collectFileFields(options, textFields);
    const form = buildForm(textFields, files);
    const credits = estimateCredits(options.operationName, operation, textFields);
    const balance = accessToken ? await queryBalance(accessToken) : null;
    estimate = { credits, usd: credits === null ? null : Number((credits * CREDIT_PRICE_USD).toFixed(2)), balance, fields: textFields };
    if (credits === null) report("price unknown: this model / resolution is not in the published price table");
    if (!accessToken) report("no credentials found, so the balance was not read");
    report(`estimate ${JSON.stringify({ credits: estimate.credits, usd: estimate.usd, balance })}`);
    if (options.estimateOnly) {
      printResult({ estimate });
      return;
    }
    taskId = await submitTask(accessToken, operation, form);
    report(`submitted ${taskId}`);
  }

  const finished = await pollUntilFinished(accessToken, operation, taskId, options.timeoutMinutes);
  const outputFolder = resolve(options.outputFolder);
  const baseName = options.outputName ?? defaultBaseName(taskId);
  mkdirSync(outputFolder, { recursive: true });
  writeFileSync(join(outputFolder, `${baseName}.json`), JSON.stringify(finished, null, 2));
  const state = finished.data?.state;
  if (state !== SUCCESS_STATE) {
    const reason = finished.msg ?? finished.message;
    if (TERMINAL_STATES.has(state)) report(`task ended as ${state}${reason ? `: ${reason}` : ""}`);
    else report(`timed out while ${state}; resume without a new charge: --task ${taskId} --out ${options.outputFolder}`);
    printResult({ task_id: taskId, state, files: [], estimate });
    process.exit(EXIT_NOT_COMPLETED);
  }
  const files = await downloadOutputs(collectOutputUrls(finished.data), outputFolder, baseName);
  printResult({ task_id: taskId, state, files, estimate });
}

/**
 * Parses the command line and runs the requested operation.
 */
async function main() {
  const options = parseCommandLine(process.argv.slice(2));
  if (options.operationName === "balance") await runBalance();
  else await runTask(options);
}

main().catch((error) => fail(EXIT_USAGE, error?.stack ?? String(error)));
