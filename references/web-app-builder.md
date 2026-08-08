## Babylon Toolkit App Builder — Cloning Starter Project Installations

**IMPORTANT. THIS DOCUMENT PROVIDES CRUCIAL BABYLON TOOLKIT APP BUILDER PLATFORM INSTRUCTIONS. ALWAYS READ THIS ENTIRE DOCUMENT TO THE END OF FILE**

This platform runs inside a WebContainer, but it is **not** Bolt.new and **not** a generic app builder. When the Platform Detection Table resolves to this row, this document wins over every other platform reference.

### There is nothing to clone (BLOCKING — this replaces Step 0.3)

* The project is **already scaffolded before you run**. The platform mounts an official Babylon Toolkit starter template for every project: `babylonjs` ES6 packages + React + Vite, with the ReactFramework submodule already mounted at `src/babylon`, and `strict mode` already removed.
* **Do NOT clone `StarterAssets.git` or any other starter repo. Do NOT scaffold a new project. Do NOT re-run the installer.** The cloning procedure in Step 0.3 does not apply to this platform. The starter is mounted out-of-band, before your first turn.
* **`git` is NOT available in this runtime.** Any instruction to clone, checkout, or add a submodule cannot be followed here. Prefer Node.js scripts over shell scripts.
* The default ES6 packages are **already installed**. Run `npm install <pkg>` only to add something the project genuinely lacks — never as part of scaffolding.

```bash
# ALREADY INSTALLED by the platform — do NOT re-run this as a scaffolding step
npm install @babylonjs/core @babylonjs/gui @babylonjs/loaders @babylonjs/materials @babylonjs/inspector @babylonjs/serializers @babylonjs/havok @babylonjs/addons @babylonjs-toolkit/next
```

### `load_reference` IS how you fetch a sub-document here

* The "fetch this URL" instructions in the Reference Index, in Step 0.2, and inside every sub-document
  are **real and you must follow them** — only the mechanism differs. Call **`load_reference(id)`**
  instead of going to the network.
* It accepts either the id from the **Babylon Toolkit Reference Library** index in your context, or the
  `raw.githubusercontent.com/…` URL exactly as a document quotes it. Both resolve to the same document.
  Every "always reference X at &lt;URL&gt;" line inside a sub-document works the same way.
* **The documents are LOCAL and pinned, so a fetch here cannot fail.** They are stored on this platform
  at a pinned commit — no network, no unpinned version, nothing to time out. Never announce that you are
  fetching a Reference URL over the network, and never stop to report a failed Reference fetch: that
  instruction describes a failure mode that does not exist here. If `load_reference` cannot serve a
  document it will tell you why and what to do.
* **Decide what you need and load it BEFORE you begin writing code, files or an artifact.** Loading is
  cheap; abandoning a half-written file to go and load something is not. There is a small per-response
  budget, so choose the documents your task actually needs.
* A document already in your context — inlined by the platform, or loaded on this turn or an earlier one
  — is authoritative. Re-loading it just returns a note saying you already have it.
* **Load the reference rather than guessing.** If the documents genuinely do not cover something, say so
  plainly. Do not reconstruct Toolkit API surface from generic Babylon, React, or web-dev knowledge.
  Inventing an API that does not exist is far worse than loading a document, and far worse again than
  telling the user the reference does not cover it.

### You CAN fetch other public URLs with `web_fetch`

* You **do** have network access for arbitrary public pages. When the user references a web page or doc and asks you to look at it, call the **`web_fetch(url)`** tool to pull its readable text into the generation. Public HTTP/HTTPS only — private and internal addresses are refused.
* **Do not claim you have no network access or no fetch capability.** You can fetch a public URL the user points you at.
* `web_fetch` is for URLs the user references — it is **not** the mechanism for the Agent Reference (those documents have their own tool, `load_reference`, per the section above), and it is not a substitute for the Toolkit knowledge already in your context. Use it only when a URL is genuinely relevant to the task.
* The user can also pull a page in for you with the **"Fetch URL content"** button. If web content appears inline in their message, it is context they deliberately provided — use it.

### Skills are pre-loaded, never installed

* Ignore `references/skills-repository.md` on this platform. Do **not** copy skills into `.claude/skills` or `.codex/skills`, and do not use a plugin marketplace — that is a different host's mechanism.
* The skills you need are **pre-loaded into your context by the platform**, or fetched with `load_skill`.
* **Never scaffold a skills folder into the user's game.**

### The platform's own system prompt takes precedence

Project file zones, the play contract, landing-page rules, and the action protocol are supplied by this platform's system prompt and are authoritative. Where they conflict with any reference document, the platform's system prompt wins.
