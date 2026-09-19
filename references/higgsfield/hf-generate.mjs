#!/usr/bin/env node
// hf-generate.mjs — run a Higgsfield CLI generation and save the result to a local file.
//
// The Higgsfield CLI returns CDN URLs, not files. This wrapper gives it the same
// "write to out_path" contract as the kie MCP servers:
//
//   node scripts/hf-generate.mjs <job_type> --out <file> [--param value]... [options]
//   node scripts/hf-generate.mjs <job_type> --cost [--param value]...
//
// Every --param is passed straight through to `higgsfield generate create`, so
// media flags (--image-references, --start-image, --end-image, --image, --video,
// --audio) accept local file paths (auto-uploaded) or upload/job UUIDs.
//
// Options handled here (not passed to the CLI):
//   --out <file>      where to save the result. Parent dirs are created.
//                     With several results: name_1.ext, name_2.ext, ...
//                     If the extension differs from the real file type, the real
//                     extension is used and the actual path is reported.
//   --out-dir <dir>   save as <dir>/<job_id>.<ext> instead of --out
//   --min             download the compressed preview (min_result_url, .webp for
//                     images) instead of the full result
//   --timeout <dur>   wait budget passed as --wait-timeout (default 20m)
//   --cost            print the credit estimate (`generate cost`) and exit; no job
//
// stdout: JSON array [{ job_id, status, file, url }]. Progress and errors go to stderr.
// Exit codes: 0 ok · 1 usage / CLI error · 2 a job did not complete · 3 download failed.
//
// CLI resolution: $HIGGSFIELD_BIN, then ./node_modules/.bin/higgsfield, then `higgsfield` on PATH.
// Telemetry is disabled unless HIGGSFIELD_DISABLE_TELEMETRY is already set.
// Requires Node 18+ (global fetch). Zero dependencies.

import { spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const fail = (code, msg) => { process.stderr.write(`hf-generate: ${msg}\n`); process.exit(code); };

const argv = process.argv.slice(2);
const jobType = argv[0];
if (!jobType || jobType.startsWith("-")) {
  fail(1, "usage: hf-generate.mjs <job_type> (--out <file> | --out-dir <dir> | --cost) [--param value]...");
}

let out = null, outDir = null, useMin = false, cost = false, timeout = "20m";
const pass = [];
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  const next = () => { if (i + 1 >= argv.length) fail(1, `${a} needs a value`); return argv[++i]; };
  if (a === "--out") out = next();
  else if (a === "--out-dir") outDir = next();
  else if (a === "--timeout") timeout = next();
  else if (a === "--min") useMin = true;
  else if (a === "--cost") cost = true;
  else if (a === "--json" || a === "--wait") { /* always added by the wrapper */ }
  else pass.push(a);
}
if (!cost && !out && !outDir) fail(1, "pass --out <file> or --out-dir <dir> (or --cost for an estimate)");

function resolveCli() {
  if (process.env.HIGGSFIELD_BIN) return process.env.HIGGSFIELD_BIN;
  const local = resolve("node_modules/.bin", process.platform === "win32" ? "higgsfield.cmd" : "higgsfield");
  return existsSync(local) ? local : "higgsfield";
}

function runCli(args) {
  const r = spawnSync(resolveCli(), args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
    shell: process.platform === "win32",
    env: { HIGGSFIELD_DISABLE_TELEMETRY: "1", ...process.env },
  });
  if (r.error) fail(1, `could not run the Higgsfield CLI (${r.error.message}). Install it: npm i -D @higgsfield/cli`);
  if (r.status !== 0) {
    process.stderr.write(r.stdout || "");
    fail(1, `higgsfield ${args.slice(0, 3).join(" ")} exited ${r.status}`);
  }
  try { return JSON.parse(r.stdout); }
  catch { fail(1, `unexpected CLI output:\n${r.stdout}`); }
}

if (cost) {
  process.stdout.write(JSON.stringify(runCli(["generate", "cost", jobType, ...pass, "--json"]), null, 2) + "\n");
  process.exit(0);
}

const created = runCli(["generate", "create", jobType, ...pass, "--wait", "--wait-timeout", timeout, "--json"]);
const jobs = Array.isArray(created) ? created : [created];

const urlExt = (u) => extname(new URL(u).pathname) || "";
function targetPath(job, url, index, total) {
  const ext = urlExt(url);
  if (outDir) return join(outDir, `${job.id}${ext}`);
  const wanted = extname(out);
  const stem = wanted ? out.slice(0, -wanted.length) : out;
  const suffix = total > 1 ? `_${index + 1}` : "";
  if (wanted && ext && wanted.toLowerCase() !== ext.toLowerCase()) {
    process.stderr.write(`hf-generate: result is ${ext}, not ${wanted}; saving as ${stem}${suffix}${ext}\n`);
  }
  return `${stem}${suffix}${ext || wanted}`;
}

const report = [];
let exitCode = 0;
for (const [i, job] of jobs.entries()) {
  const url = useMin ? (job.min_result_url || job.result_url) : job.result_url;
  if (job.status !== "completed" || !url) {
    process.stderr.write(`hf-generate: job ${job.id} ended with status "${job.status}"${url ? "" : " and no result url"}\n`);
    report.push({ job_id: job.id, status: job.status, file: null, url: url || null });
    exitCode = 2;
    continue;
  }
  const file = targetPath(job, url, i, jobs.length);
  try {
    mkdirSync(dirname(resolve(file)), { recursive: true });
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(file));
    report.push({ job_id: job.id, status: job.status, file, url });
  } catch (e) {
    process.stderr.write(`hf-generate: download of job ${job.id} failed: ${e.message}\n`);
    report.push({ job_id: job.id, status: job.status, file: null, url });
    exitCode = 3;
  }
}

process.stdout.write(JSON.stringify(report, null, 2) + "\n");
process.exit(exitCode);
