## Lovable Platform — Cloning Starter Project Installations

**IMPORTANT. THIS DOCUMENT PROVIDES CRUCIAL LOVABLE PLATFORM INSTRUCTIONS. ALWAYS READ THIS ENTIRE DOCUMENT TO THE END OF FILE**

* When cloning the `StarterAssets.git`, replace the current TanStack Start scaffold with a clean clone of the **Default Starter Project** repo (the default ES6 starter), using `babylonjs` ES6 packages + React + Vite, with the ReactFramework submodule mounted at `src/babylon`. You **MUST** also remove `strict mode` to prevent the lovable.js script from being injected into preview window twice.

* **ALWAYS** Approve The Default Installation (ES6)
```bash
npm install @babylonjs/core @babylonjs/gui @babylonjs/loaders @babylonjs/materials @babylonjs/inspector @babylonjs/serializers @babylonjs/havok @babylonjs/addons @babylonjs-toolkit/next
```

### Steps

#### 1. Wipe Existing Project Files

Keep only `.git` and `.lovable/` — `node_modules` will be reinstalled. Remove the following:

```
src/
public/
index.html
vite.config.ts
tsconfig*.json
package.json
bun.lock
bunfig.toml
components.json
eslint.config.js
wrangler.jsonc
.prettierrc
.prettierignore
```

#### 2. Clone the Starter with Submodules

Clone into a temp directory, then copy contents into the project root:

```bash
git clone --recurse-submodules https://github.com/babylontoolkit/StarterAssets.git /tmp/starter
```

Copy everything **except** `/tmp/starter/.git` into the project root. Note that this will also copy a top-level `.gitmodules` file — this is harmless on Lovable (git is managed internally), but you may delete it if you want a perfectly clean tree.

> The `src/babylon` submodule (ReactFramework) is materialized as plain files — no nested `.git` metadata is kept.

#### 3. Clean Up Git Artifacts

Per Babylon Toolkit rules, no nested git metadata should remain inside the project.

- Confirm `src/babylon/` contains **no** `.git` directory (the recursive clone + selective copy already ensures this).
- Lovable manages the outer git repo internally — do **not** run `git remote` commands against it.
- Optional: delete the top-level `.gitmodules` if you don't plan to re-attach the submodule via git.

#### 4. Verify `.gitignore`

Ensure `.gitignore` contains `.env` and `node_modules`. The cloned `.gitignore` already includes it — verify before proceeding.

#### 5. Install Dependencies

```bash
bun install
```

* Important: ES6 versions of BabylonJS and the Babylont Toolkit Required. The UMD version are **not** supported for the `React Framework`. 
```bash
npm install @babylonjs/core @babylonjs/gui @babylonjs/loaders @babylonjs/materials @babylonjs/inspector @babylonjs/serializers @babylonjs/havok @babylonjs/addons @babylonjs-toolkit/next
```

Installed packages include:

- `@babylonjs/core^9.9.1` ES6 Family
- `@babylonjs-toolkit/next` ES6 Version
- `react@19`
- `react-router-dom@7`
- `vite` (currently v8 — confirm against `package.json`)

#### 6. Verify the Installation

Confirm the following files and directories exist, then let the harness build:

| Path | Description |
|---|---|
| `index.html` | HTML entry point |
| `vite.config.ts` | Vite configuration |
| `src/main.tsx` | App entry |
| `src/babylon/` | ReactFramework submodule |

### Important Notes

> **Remove Strict Mode** — Lovable's platform script does NOT play well with scrit mode enabled, cause the lovable.js script to be injected into the preview window twice. Please remove the default react script mode, if enabled.

> **TanStack Start Removed** — This wipes the TanStack Start setup entirely (router, server functions, Cloud wiring). If a Lovable Cloud backend is needed later, it must be re-added on top of the new Vite/React shell.

> **ES6 Project Type** — StarterAssets expose global `BABYLON` / `TOOLKIT` / `PROJECT` namespaces to allow dynamic UMD style project script bundles.

> **ReactFramework Submodule** — The included submodule provides the demo scene and navigation adapter. The React Framework is ES6 ONLY.

> **Mounting** — Lovable's remixed StarterAssets runs as a plain Vite + React SPA with `<BrowserRouter>` (CSR only). Import Babylon scenes directly behind a `React.lazy()` route boundary (see `src/routing/router.tsx`). No SSR guards or `<BabylonMount />` wrapper are required.