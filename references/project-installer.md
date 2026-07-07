# Project Generation Instructions (1.1.0)

**IMPORTANT. THIS DOCUMENT PROVIDES CRUCIAL PROJECT INSTALLATION INFORMATION. READ TO THE END BEFORE TAKING ANY ACTION.**

Your goal is to set up and install Babylon Toolkit workspace projects.

## Global Rules (apply to every platform)

- Prefer **TypeScript** over JavaScript.
- Prefer **WebGPU** over WebGL.
- Note the project architecture: **ES6** or **UMD**.
- Always use the **ES6** versions of BabylonJS, Babylon Toolkit, the Babylon Toolkit React Framework, and the Babylon Toolkit Starter Projects, unless the user explicitly asks for UMD.

---

## STEP 0 — Mandatory Platform Procedure (BLOCKING)

You **MUST** complete these three steps **in order** before cloning anything, writing code, or answering the user. Do not skip, reorder, or merge them.

### Step 0.1 — Identify the host platform (BLOCKING)

Run the **Platform Detection Table** below. Match on **any one** signal in the row. Resolve to **exactly one** platform.

| # | Platform           | Detection signals (any one is sufficient)                                                                                                        | Reference doc (filename)   |
|---|--------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------|
| 1 | **Lovable**        | System prompt identifies you as "Lovable"; tool names like `code--exec`, `code--view`, `lovable-*`; host `lovable.dev` / `lovable.app`; `.lovable/` directory in project | `lovable.md`               |
| 2 | **Replit**         | `REPL_ID`, `REPL_SLUG`, or `REPLIT_*` env vars; `.replit` or `replit.nix` file; system prompt mentions "Replit Agent" / "Replit Assistant"        | `web-app-replit.md`        |
| 3 | **Bolt.new**       | Running in a StackBlitz WebContainer; host `bolt.new`; system prompt identifies you as "Bolt"                                                     | `web-app-bolt.md`          |
| 4 | **Wix Base44**     | System prompt identifies you as "Base44"; host `base44.app` / `base44.com`; Wix Base44 runtime tooling                                            | `web-app-base44.md`        |
| 5 | **V0 (Vercel)**    | System prompt identifies you as "v0" / "Vercel v0"; host `v0.dev` / `v0.app`; Vercel-specific tool surface                                        | `vercel-app-builder.md`    |
| 6 | **Generic**        | Any other AI app-building platform not matched by rows 1–6 above                                                                                  | `web-app-generic.md`       |

**Ambiguity rules — fail closed:**

- **Zero matches** → fall back to **Generic** (row 7) and use `web-app-generic.md`.
- **Multiple matches** → prefer the row with the most specific signal (e.g. an env var or a `.lovable/` directory beats a generic hostname). If still tied → STOP and ask.
- **Never** assume Lovable (or any other named platform) as a fallback.

### Step 0.2 — Fetch and read the reference doc (BLOCKING)

Fetch the matching `.md` from the **Reference Index** below and **read it in full** before acting.

- If the fetch fails (network error, 404, redirect to login), **STOP** and report the exact URL and error to the user. Do **not** improvise the cloning procedure from memory.
- The reference doc is authoritative. If it contradicts anything in this document, the reference doc wins for that platform.

### Step 0.3 — Execute the procedure

Follow the fetched reference **verbatim** to clone the starter repo:

- Platforms 1–4, 6–7 clone `StarterAssets.git`.
- Platform 5 (V0/Vercel) clones `VercelAssets.git`.

### Compliance checklist (tick mentally before you write any code)

- [ ] Platform detected from the table using a concrete signal (not a guess)?
- [ ] Reference `.md` fetched successfully?
- [ ] Reference `.md` read in full?
- [ ] Cloning procedure followed verbatim from that reference?

If any box is unchecked, go back to Step 0.1.

---

## Reference Index (authoritative URLs)

Always fetch from these URLs — do not rely on cached copies.

- **React Framework Reference** (read for any React-based project, in addition to the platform doc):
  `https://raw.githubusercontent.com/babylontoolkit/agent/main/references/react-framework.md`
- **Lovable** → `https://raw.githubusercontent.com/babylontoolkit/agent/main/references/lovable.md`
- **Replit** → `https://raw.githubusercontent.com/babylontoolkit/agent/main/references/web-app-replit.md`
- **Bolt.new** → `https://raw.githubusercontent.com/babylontoolkit/agent/main/references/web-app-bolt.md`
- **Wix Base44** → `https://raw.githubusercontent.com/babylontoolkit/agent/main/references/web-app-base44.md`
- **V0 (Vercel)** → `https://raw.githubusercontent.com/babylontoolkit/agent/main/references/vercel-app-builder.md`
- **Generic** → `https://raw.githubusercontent.com/babylontoolkit/agent/main/references/web-app-generic.md`


## 📦 External Dependencies

Use Babylon Toolkit and Babylon.js as follows:

### Babylon.js (WEB/CDN)

Include:

```html
<script src="https://cdn.babylonjs.com/babylon.js"></script>
<script src="https://cdn.babylonjs.com/gui/babylon.gui.min.js"></script>
<script src="https://cdn.babylonjs.com/loaders/babylonjs.loaders.min.js"></script>
<script src="https://cdn.babylonjs.com/materialsLibrary/babylonjs.materials.min.js"></script>
```

### Babylon Toolkit Runtime (WEB/CDN)

```html
<script src="https://cdn.jsdelivr.net/gh/BabylonJS/BabylonToolkit@master/Runtime/babylon.toolkit.js"></script>
```

### Babylon Toolkit Declarations (WEB/CDN)

- `https://cdn.babylonjs.com/babylon.d.ts`
- `https://cdn.babylonjs.com/gui/babylon.gui.d.ts`
- `https://cdn.babylonjs.com/loaders/babylonjs.loaders.d.ts`
- `https://cdn.babylonjs.com/materialsLibrary/babylonjs.materials.d.ts`
- `https://cdn.jsdelivr.net/gh/BabylonJS/BabylonToolkit@master/Runtime/babylon.toolkit.d.ts`

### Node.js Package Guidance

## Default Installation (UMD)
```bash
npm install babylonjs babylonjs-gui babylonjs-addons babylonjs-loaders babylonjs-materials babylonjs-inspector babylonjs-toolkit
```

* Globals Side Effects (globals.ts)
```javascript
import "babylonjs";
import "babylonjs-gui";
import "babylonjs-addons";
import "babylonjs-loaders";
import "babylonjs-materials";
import "babylonjs-inspector";
import "babylonjs-toolkit";
```

* TypeScript Configuration Settings (tsconfig.json)
```json
"types": [
      "babylonjs",
      "babylonjs-gui",
      "babylonjs-addons",
      "babylonjs-loaders",
      "babylonjs-gltf2interface",
      "babylonjs-materials",
      "babylonjs-toolkit"
]
```

### Vite Configuration (UMD)

The Vite bundle services behave differently in devmode than production. To preserve some required classes during devmode, these `exclude` and `include` settings are strongly recommended in your vite.config.js settings file.

```json
  optimizeDeps: {
    exclude: ["babylonjs-inspector"],
    include: mode === 'development' ? [
      "babylonjs",
      "babylonjs-gui",
      "babylonjs-addons",
      "babylonjs-loaders",
      "babylonjs-materials",
      "babylonjs-toolkit",
    ] : [],
  },
  assetsInclude: ["**/*.wasm"],  
```

* Default Installation (ES6)
```bash
npm install @babylonjs/core @babylonjs/gui @babylonjs/loaders @babylonjs/materials @babylonjs/inspector @babylonjs/serializers @babylonjs/havok @babylonjs/addons @babylonjs-toolkit/next
```

* Default Module Import Libraries
```javascript
import { Engine, Scene } from "@babylonjs/core";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import HavokPhysics from "@babylonjs/havok";
import { SceneManager, ScriptComponent } from "@babylonjs-toolkit/next";
```

* Granular File Level Import Libraries
```javascript
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import HavokPhysics from "@babylonjs/havok";
import { SceneManager } from "@babylonjs-toolkit/next/scenemanager";
import { ScriptComponent } from "@babylonjs-toolkit/next/scenemanager";
import { LocalMessageBus } from "@babylonjs-toolkit/next/localmessagebus";
import { CharacterController } from "@babylonjs-toolkit/next/charactercontroller";
```
* Starter Content Import Libraries
```javascript
import { DefaultCameraSystem } from "@babylonjs-toolkit/next/starter/DefaultCameraSystem";
import { DebugInformation } from "@babylonjs-toolkit/next/starter/DebugInformation";
import { StandardCarController } from "@babylonjs-toolkit/next/racing/StandardCarController";
```

* Legacy Global Namespace Import Libraries
```javascript
import * as BABYLON from "@babylonjs/core/Legacy/legacy";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import HavokPhysics from "@babylonjs/havok";
import * as TOOLKIT from "@babylonjs-toolkit/next";
import * as PROJECT from "@babylonjs-toolkit/next/project";
```

### Babylon Toolkit Starter Repositories (ES6)

* **Default Starter Project**: `https://github.com/babylontoolkit/StarterAssets.git`

* **Next.js Starter Project**: `https://github.com/babylontoolkit/VercelAssets.git`

#### IMPORTANT - GITHUB PROJECT CREATION AND CLONING RULES TO FOLLOW

* ALWAYS CLONE THE STARTER PROJECT REPOS WITH RECURSIVE SUB MODULE SUPPORT (--recurse-submodules)

* ALWAYS DISCONNECT FROM REMOTE ORIGIN AFTER CLONING. FOR EXAMPLE:
```
git remote remove origin
```

* AWLAYS MAKE SURE `node_modules` is `ignored`. Do not allow `node_modules` to be saved to repo when creating, cloning or setting up a project. Always add `.env` and `node_modules` to .gitignore. If .gitignore does not exist, then create one and add `.env` and `node_modules` to it.

### Babylon Toolkit React Framework Submodule (ES6)

The Babylon Toolkit React Framework can be installed to a project as a github submodule. Use the following instructions when asked to add or install the submodule into a project.

To add submodule:
```
git submodule add https://github.com/babylontoolkit/ReactFramework.git src/babylon
git commit -m "Add babylon toolkit react framework submodule"
```

To remove submodule:
```
git submodule deinit -f src/babylon
git rm -f src/babylon
rm -rf .git/modules/src/babylon
git commit -m "Remove babylon toolkit react framework submodule"
```

Note: Once the submodule has been added, to update, its best make sure any changes are backed up. Remove the submodule to clean then add the submodule again to get new updates.

#### Host Platform React Framework Navigation Adapter

When installing the `Babylon Toolkit React Framework Submodule`, always include or create a navigation adapter for the host platform and wire up the navigation adapter to the host platform routing system, if a host platform navigation adapter does not already exist in the project. Consult the `REACT UI Framework Documentation` for details on host platform router integrations and demo scene setup.

#### React Framework User Interface Documentation Link

Reference the `REACT UI Framework Documentation` at https://raw.githubusercontent.com/babylontoolkit/agent/main/references/react-framework.md

### Recommended `tsconfig.app.json` options

These settings prevent cross-package type declaration conflicts and allow the toolkit's patterns to work without `as any` casts:

```json
"compilerOptions": {
  "skipLibCheck": true,
  "strict": false,
  "noImplicitAny": false,
  "strictNullChecks": false
}
```

### Recommended `eslint.config` settings
```
  {
    rules: {
      "no-var": "off",
      "no-empty": "off",
      "no-unused-vars": "off",
      "no-useless-assignment": "off",
      "prefer-const": "off",
      "@typescript-eslint/triple-slash-reference": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/no-useless-assignment": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
```

### Vite Configuration (ES6)

The Vite bundle services behave differently in devmode than production. To preserve some required classes during devmode, these `exclude` and `include` settings are strongly recommended in your `vite.config` settings file.

* Important: The `dedupe` section of the `vite.config` is required for symlink dual-instance hazard prevention.

```json
import type { Connect } from "vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// MIME type map for all common web game / media asset extensions.
// Strips query strings before matching so ?v=123 cache-busters don't break lookups.
const MEDIA_MIME_TYPES: Record<string, string> = {
  // 3D models
  ".gltf":   "model/gltf+json",
  ".glb":    "model/gltf-binary",
  ".bin":    "application/octet-stream",
  // Images — raster
  ".png":    "image/png",
  ".jpg":    "image/jpeg",
  ".jpeg":   "image/jpeg",
  ".webp":   "image/webp",
  ".gif":    "image/gif",
  ".bmp":    "image/bmp",
  ".tiff":   "image/tiff",
  ".tif":    "image/tiff",
  ".avif":   "image/avif",
  ".ico":    "image/x-icon",
  ".svg":    "image/svg+xml",
  // Images — HDR / compressed textures (Babylon)
  ".hdr":    "application/octet-stream",
  ".exr":    "application/octet-stream",
  ".ktx":    "image/ktx",
  ".ktx2":   "image/ktx2",
  ".basis":  "application/octet-stream",
  ".dds":    "application/octet-stream",
  // Audio
  ".mp3":    "audio/mpeg",
  ".ogg":    "audio/ogg",
  ".wav":    "audio/wav",
  ".aac":    "audio/aac",
  ".flac":   "audio/flac",
  ".m4a":    "audio/mp4",
  ".opus":   "audio/opus",
  ".weba":   "audio/webm",
  // Video
  ".mp4":    "video/mp4",
  ".m4v":    "video/mp4",
  ".webm":   "video/webm",
  ".ogv":    "video/ogg",
  ".mov":    "video/quicktime",
  ".avi":    "video/x-msvideo",
};

// Extensions that also need CORS + method headers (3D model fetches from BabylonJS loaders)
const CORS_FULL_EXTS = new Set([".gltf", ".glb"]);

function applyMediaContentType(req: Connect.IncomingMessage, res: { setHeader: (k: string, v: string) => void }) {
  if (!req.originalUrl) return;
  const path = req.originalUrl.split("?")[0].toLowerCase();
  // Handle double-extension gzip variants e.g. scene.gz.gltf
  const normalized = path.endsWith(".gz.gltf") ? ".gltf"
    : path.endsWith(".gz.glb") ? ".glb"
    : path.endsWith(".gz.bin") ? ".bin"
    : "";
  const ext = normalized || path.substring(path.lastIndexOf("."));
  const mime = MEDIA_MIME_TYPES[ext];
  if (mime) {
    res.setHeader("Content-Type", mime);
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (CORS_FULL_EXTS.has(ext)) {
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/", // Ensures assets are correctly referenced
  build: {
    emptyOutDir: true,
    copyPublicDir: true,
    minify: "esbuild",
    target: "esnext",
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
        inlineDynamicImports: false,
        manualChunks(id) {
          // IMPORTANT: Keep all Babylon code in one chunk to ensure the library files are correctly referenced 
          if (id.includes("babylonjs")) {
            return "babylon";
          }
        },
      }
    }
  },
  resolve: {
    dedupe: [
      "@babylonjs/core",
      "@babylonjs/loaders",
      "@babylonjs/gui",
      "@babylonjs/materials",
      "@babylonjs/serializers",
      "@babylonjs/addons",
      "@babylonjs/havok",
    ],
  },
  optimizeDeps: {
    exclude: [
      "@babylonjs/core",
      "@babylonjs/loaders",
      "@babylonjs/gui",
      "@babylonjs/materials",
      "@babylonjs/serializers",
      "@babylonjs/addons",
      "@babylonjs/havok",
      "@babylonjs/inspector",
      "@babylonjs-toolkit/next",
      "@babylonjs-toolkit/next/project",
    ],
    include: mode === 'development' ? [
      "scheduler",
      "use-sync-external-store/shim"
    ] : [],
  },
  assetsInclude: ["**/*.wasm"],  
  server: {
    headers: {
      "Cross-Origin-Embedder-Policy": "credentialless",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
    fs: {
      allow: [".."]
    },
    middlewareMode: false,
    allowedHosts: true,    // allow the .replit.dev domain through without whitelisting it
    strictPort: true,      // fail loudly if the port is taken — never silently fall back
    host: "0.0.0.0",       // bind all interfaces — required for the Replit proxy to reach it
    port: parseInt(process.env.PORT || "5173"),  // read PORT from the workflow env var
    open: true, // Automatically open the browser
    // Pre-transform the entire babylon entry chain so the first /play click
    // doesn't have to crawl + optimize a half-dozen UMD packages mid-navigation.
    // Globs auto-pick up any new files you add under src/babylon/.
    warmup: {
      clientFiles: [
        "./src/routing/router.tsx",
        "./src/babylon/**/*.{ts,tsx}",
        "./src/scripts/**/*.{ts,tsx}",
      ],
    },

  },
  plugins: [
    react(),
    {
      name: "configure-response-headers",
      configureServer: (server) => {
        server.middlewares.use((_req, res, next) => {
          res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
          res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
          next();
        });
      },
      configurePreviewServer: (server) => {
        server.middlewares.use((_req, res, next) => {
          res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
          res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
          next();
        });
      }
    },
    {
      name: "wasm-content-type-plugin",
      configureServer(server) {
        server.middlewares.use((req: Connect.IncomingMessage, res, next) => {
          if (req.originalUrl && req.originalUrl.endsWith(".wasm")) {
            res.setHeader("Content-Type", "application/wasm");
          }
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req: Connect.IncomingMessage, res, next) => {
          if (req.originalUrl && req.originalUrl.endsWith(".wasm")) {
            res.setHeader("Content-Type", "application/wasm");
          }
          next();
        });
      }
    },
    {
      name: "gzip-response-headers",
      configureServer(server) {
        server.middlewares.use((req: Connect.IncomingMessage, res, next) => {
          if (req.originalUrl && req.originalUrl.includes(".gz.")) {
            res.setHeader("Content-Encoding", "gzip");
          }
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req: Connect.IncomingMessage, res, next) => {
          if (req.originalUrl && req.originalUrl.includes(".gz.")) {
            res.setHeader("Content-Encoding", "gzip");
          }
          next();
        });
      }
    },
    {
      name: "media-content-type-plugin",
      configureServer(server) {
        server.middlewares.use((req: Connect.IncomingMessage, res, next) => {
          applyMediaContentType(req, res);
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req: Connect.IncomingMessage, res, next) => {
          applyMediaContentType(req, res);
          next();
        });
      }
    }
  ]
}))
```

### Next Configuration (ES6)

The Next bundle services behave differently in devmode than production. These settings are strongly recommended in your `next.config` settings file.

* Important: You must to set `config simlink` to false.

```json
import type { NextConfig } from "next";
import path from "path";

// ---------------------------------------------------------------------------
// MIME type map for static assets served from /public.
// Strips query strings before matching so ?v=123 cache-busters don't break lookups.
// Mirrors the Vite media-content-type-plugin.
// ---------------------------------------------------------------------------
const MEDIA_MIME_TYPES: Record<string, string> = {
  // 3D models
  ".gltf":   "model/gltf+json",
  ".glb":    "model/gltf-binary",
  ".bin":    "application/octet-stream",
  // Images — raster
  ".png":    "image/png",
  ".jpg":    "image/jpeg",
  ".jpeg":   "image/jpeg",
  ".webp":   "image/webp",
  ".gif":    "image/gif",
  ".bmp":    "image/bmp",
  ".tiff":   "image/tiff",
  ".tif":    "image/tiff",
  ".avif":   "image/avif",
  ".ico":    "image/x-icon",
  ".svg":    "image/svg+xml",
  // Images — HDR / compressed textures (Babylon)
  ".hdr":    "application/octet-stream",
  ".exr":    "application/octet-stream",
  ".ktx":    "image/ktx",
  ".ktx2":   "image/ktx2",
  ".basis":  "application/octet-stream",
  ".dds":    "application/octet-stream",
  // Audio
  ".mp3":    "audio/mpeg",
  ".ogg":    "audio/ogg",
  ".wav":    "audio/wav",
  ".aac":    "audio/aac",
  ".flac":   "audio/flac",
  ".m4a":    "audio/mp4",
  ".opus":   "audio/opus",
  ".weba":   "audio/webm",
  // Video
  ".mp4":    "video/mp4",
  ".m4v":    "video/mp4",
  ".webm":   "video/webm",
  ".ogv":    "video/ogg",
  ".mov":    "video/quicktime",
  ".avi":    "video/x-msvideo",
};

// Extensions that also need CORS method/header headers (3D model fetches from BabylonJS loaders)
const CORS_FULL_EXTS = new Set([".gltf", ".glb"]);

// ---------------------------------------------------------------------------
// Build Next.js header entries from the MIME map.
// /(.*)\\.ext naturally matches both /model.ext and /model.gz.ext, so each
// entry covers both plain and gzip-compressed variants without duplication.
// The separate gzip catch-all below adds Content-Encoding for .gz. files.
// ---------------------------------------------------------------------------
type HeaderEntry = { source: string; headers: Array<{ key: string; value: string }> };

function buildMediaHeaderEntries(): HeaderEntry[] {
  const corsExtra = [
    { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
    { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
  ];

  return Object.entries(MEDIA_MIME_TYPES).map(([ext, mime]) => {
    const e = ext.slice(1); // ".gltf" → "gltf"
    return {
      source: `/(.*)\\.${e}`,
      headers: [
        { key: "Content-Type", value: mime },
        { key: "Access-Control-Allow-Origin", value: "*" },
        ...(CORS_FULL_EXTS.has(ext) ? corsExtra : []),
      ],
    };
  });
}

// All @babylonjs/* packages are pure ESM ("type": "module").
// Same list used for serverExternalPackages, transpilePackages, and resolve.alias.
const BABYLON_PACKAGES = [
  "@babylonjs/core",
  "@babylonjs/loaders",
  "@babylonjs/gui",
  "@babylonjs/materials",
  "@babylonjs/serializers",
  "@babylonjs/addons",
  "@babylonjs/havok",
  "@babylonjs/inspector",
  "@babylonjs-toolkit/next",
] as const;

const nextConfig: NextConfig = {
  turbopack: {},
  // reactStrictMode: true, // Enable Strict Mode
  // output: "export",      // Enable Static Export

  async headers() {
    return [
      // Required for BabylonJS Havok physics (SharedArrayBuffer support)
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      // Mirrors wasm-content-type-plugin
      {
        source: "/(.*)\\.wasm",
        headers: [{ key: "Content-Type", value: "application/wasm" }],
      },
      // Mirrors gzip-response-headers plugin — catch-all for any .gz.<ext> asset
      {
        source: "/(.*)\\.gz\\.(.*)",
        headers: [{ key: "Content-Encoding", value: "gzip" }],
      },
      // Mirrors media-content-type-plugin — per-extension MIME types + CORS
      ...buildMediaHeaderEntries(),
    ];
  },

  // Disable static image imports so PNG imports resolve as plain string URLs
  images: {
    disableStaticImages: true,
  },

  // The src/babylon git submodule imports PNGs with plain <img src={logo}>, expecting
  // a string URL. Next.js's next-image-loader would return a StaticImageData object
  // instead, causing <img src="[object Object]">.  The fix: intercept those two imports
  // before any loader runs and replace them with inline data-URI modules that export
  // the public path strings. webpack: true is set in server-classic.ts so this runs.
  webpack(config, { webpack }) {
    config.resolve.symlinks = false; // resolve from symlink path, not real path

    // WASM support required for @babylonjs/havok.
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Deduplicate Babylon packages — same role as Vite's resolve.dedupe.
    // Forces all imports of @babylonjs/* to resolve to the project root's
    // node_modules directory, preventing duplicate class instances in monorepos
    // or when packages carry nested peer copies.
    config.resolve.alias = {
      ...config.resolve.alias,
      ...Object.fromEntries(
        BABYLON_PACKAGES
          .filter(pkg => pkg !== "@babylonjs-toolkit/next")
          .map(pkg => [pkg, path.resolve(process.cwd(), `node_modules/${pkg}`)])
      ),
    };
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /assets[\/\\]babylon\.png$/,
        (res: { request: string }) => {
          res.request = "data:text/javascript,export default '/babylon.png'";
        }
      ),
      new webpack.NormalModuleReplacementPlugin(
        /assets[\/\\]spinner\.png$/,
        (res: { request: string }) => {
          res.request = "data:text/javascript,export default '/spinner.png'";
        }
      )
    );

    // Keep all Babylon packages in a single chunk — mirrors Vite manualChunks({ id }) { if (id.includes("babylonjs")) return "babylon" }
    const splitChunks = config.optimization?.splitChunks as
      | { cacheGroups?: Record<string, unknown> }
      | false
      | undefined;
    if (splitChunks !== false) {
      config.optimization ??= {};
      config.optimization.splitChunks = {
        ...splitChunks,
        cacheGroups: {
          ...(splitChunks?.cacheGroups ?? {}),
          babylon: {
            test: /[\/]node_modules[\/]@?babylonjs/,
            name: "babylon",
            chunks: "all" as const,
            priority: 30,
            enforce: true,
          },
        },
      };
    }

    // babylonjs-inspector references Babylon internals as 'package::BABYLON.*' module IDs
    // (a Rolldown/Rollup convention). Webpack 5 processes UMD bundles differently and may
    // not encounter these specifiers — but if it does, intercept them and redirect to
    // data-URI virtual modules that proxy the matching namespace from the global BABYLON
    // object at runtime. Mirrors resolve-babylon-inspector-internals Vite plugin.
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /.*::.*/,
        (resource: { request: string }) => {
          const namespacePath = resource.request.split("::")[1] ?? "BABYLON";
          const access = namespacePath.split(".").join("?.");
          const code = `module.exports=(typeof globalThis!=="undefined"?globalThis:window).${access}??{};`;
          resource.request = `data:text/javascript,${encodeURIComponent(code)}`;
        }
      )
    );

    return config;
  },
};
export default nextConfig;
```

---

### Babylon Toolkit Content Creation Tools 

The **Babylon Toolkit Unity Exporter** (https://github.com/BabylonJS/BabylonToolkit/tree/master/Editors/Unity) is a **Content Creation Tool** used to export interactive
scene files with extra UnityGLTF metadata to instantiate **Babylon Toolkit Script Components** classes that have be encoded as **extras**.

Reference the `Interactive Scene Content` at https://raw.githubusercontent.com/babylontoolkit/agent/main/references/scene-components.md

### Babylon Toolkit Project Installation

* Always include the `babylon toolkit` dependency for Babylon.js projects
* Always install the @latest version of Babylon.js and Babylon Toolkit for **new** projects.
* Use **ES6** as the default platform unless otherwise specified.
* Do **not** write WEB/CDN html script tags for node.js projects
* Never **overwrite** the `.github/copilot-instructions.md` or `CLAUDE.md` or `AGENTS.md`

---

After installing or cloning a new project, always include `after action questions` like `Craete a new game mode ?` or `Design a user interface ?` etc.

---

**Follow these generating projects and installing packages**