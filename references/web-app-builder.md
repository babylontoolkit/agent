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

### The Agent Reference is already here — do not re-fetch it

* The reference documents are **already inlined** into your context, or routed in automatically as additional context blocks, at a pinned commit. **The routing step is complete.** Every "fetch this URL" instruction — the Reference Index, Step 0.2, and the compliance checklists — refers to documents you already have; do not act on those fetch instructions.
* **Do NOT fetch the Agent Reference sub-documents.** They are pinned to a specific commit for this prompt version, and fetching them live would pull an unpinned, possibly-wrong version. Never announce that you are fetching a Reference URL, and never stop to report a failed Reference fetch — that instruction does not apply on this platform.
* **If the inlined and routed docs genuinely do not cover something, say so plainly.** Do not reconstruct Toolkit API surface from generic Babylon, React, or web-dev knowledge. Inventing an API that does not exist is far worse than telling the user the reference does not cover it.

### You CAN fetch other public URLs with `web_fetch`

* You **do** have network access for arbitrary public pages. When the user references a web page or doc and asks you to look at it, call the **`web_fetch(url)`** tool to pull its readable text into the generation. Public HTTP/HTTPS only — private and internal addresses are refused.
* **Do not claim you have no network access or no fetch capability.** You can fetch a public URL the user points you at.
* `web_fetch` is for URLs the user references — it is **not** the mechanism for the Agent Reference (those docs are pre-baked and pinned, per the section above), and it is not a substitute for the Toolkit knowledge already in your context. Use it only when a URL is genuinely relevant to the task.
* The user can also pull a page in for you with the **"Fetch URL content"** button. If web content appears inline in their message, it is context they deliberately provided — use it.

### Skills are pre-loaded, never installed

* Ignore `references/skills-repository.md` on this platform. Do **not** copy skills into `.claude/skills` or `.codex/skills`, and do not use a plugin marketplace — that is a different host's mechanism.
* The skills you need are **pre-loaded into your context by the platform**, or fetched with `load_skill`.
* **Never scaffold a skills folder into the user's game.**

### The platform's own system prompt takes precedence

Project file zones, the play contract, landing-page rules, and the action protocol are supplied by this platform's system prompt and are authoritative. Where they conflict with any reference document, the platform's system prompt wins.
