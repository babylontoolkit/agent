# Babylon Toolkit React Framework (1.0.0)

**IMPORTANT. THIS DOCUMENT PROVIDES CRUCIAL REACT FRAMEWORK INFORMATION. ALWAYS READ THIS ENTIRE DOCUMENT TO THE END OF FILE**

This `agentic react framework submodule` allows easy intergration of the interactive scene content. The framework supports using the <BabylonSceneViewer> html tag directly or unified router navigation. The scene view is driven by the game mode. Every scene has a game mode, if you dont specify a game mode, the `DefaultGameMode` will be used. Consult the `React Game Builder Reference` at https://raw.githubusercontent.com/babylontoolkit/agent/main/training/react/README.md for detailed usage information.

* Always reference the `Babylon Toolkit React Training Reference` at https://raw.githubusercontent.com/babylontoolkit/agent/main/training/react/README.md for details regarding the agentic react game builder system.

* Always use the `src/srcipts` folder as the root folder for creating new scripts, unless otherwise instructed. Use whatever script sub folder layout you see fit to best organize script file locations, unless otherwise instructed.

* Important: Always use the default ES6 versions of BabylonJS, Babylon Toolkit, Babylon Toolkit React Framework and Babylon Toolkit Starter Projects, unless otherwise instructed to use the UMD versions.

### Node Package Installation Requirements

These packages are `REQUIRED` by the react framework submodule. If they are NOT installed in project `package.json`, please install them. Esbuild 0.28.0 or greater is required.

* Default Installation (ES6)
```bash
npm install @babylonjs/core @babylonjs/gui @babylonjs/loaders @babylonjs/materials @babylonjs/inspector @babylonjs/serializers @babylonjs/havok @babylonjs/addons @babylonjs-toolkit/next
```

### Babylon Toolkit React Framework Submodule (ES6)

To add submodule:
```
git submodule add https://github.com/babylontoolkit/ReactFramework.git src
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

## React Framework Submodule Project Installation Config

* Always copy the `src/babylon/assets/babylon.png` and `src/babylon/assets/spinner.png` images to the project `public` folder. They must exist in the application root folder.

* Apply recommended vite.config and eslint.config suggestions

* When installing the `Babylon Toolkit React Framework Submodule` only, you can get any missing files need from the `Starter Assets Repo` at https://github.com/babylontoolkit/StarterAssets.git. 

* The **public scripts** folder is `REQUIRED` in the host application. The **public scripts** folder contains the `havok.wasm` and other **required** script libraries and web assemblies. You can get any missing script files from the `public/scripts` folder in the `Starter Assets Repo` at https://github.com/babylontoolkit/StarterAssets.git. 

## React Framework Platform Router Navigation Performance

To help on unwanted page delays DO NOT using `GameManager` in react ui components to prevent the DOM from having to load babylon runtime libraries that get loaded as side effects from importing the `GameManger`. The `GameManager.NavigateTo` is safe to use from game code like game mode controllers and other script components. Use the native useUnifiedNavigation from react ui framework code.

Example `Play Demo` button handler:
```
const handlePlayDemo = () => {
  navigate('/play', {
    gameMode: 'PlayerControllerDemo',
    sceneUrl: 'https://repo.babylontoolkit.com/playground/samplescene.gltf',
  });
};
```

* Important: Remember to always use the native useUnifiedNavigation from babylon react framework and `GameManager.NavigateTo` is to be used from the game code script component classes and use the above `Play Demo` and is `handlePlayDemo` function as a reference for how to wire up navigation int the react ui framework ui context as well as the default `Play Demo` scenario. Session storage is used to secure from application state.

## Project React Framework Update Script

Please create this script and command to package.json scripts:
```
"update-babylon": "node tools/update-babylon.cjs"
```

tools/update-babylon.cjs
```
#!/usr/bin/env node

const { spawnSync } = require("child_process");
const readline = require("readline");
const fs = require("fs");
const path = require("path");

const SUBMODULE_URL = "https://github.com/babylontoolkit/ReactFramework.git";
const SUBMODULE_PATH = "src";

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

function run(command, args, allowFailure = false) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0 && !allowFailure) {
    process.exit(result.status || 1);
  }

  return result.status === 0;
}

function runText(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    return null;
  }

  return result.stdout.trim();
}

function getGitCommonDir() {
  return runText("git", ["rev-parse", "--git-common-dir"]) || ".git";
}

async function main() {
  const answer = await ask(
    "Overwrite Babylon Toolkit React Framework submodule at src/babylon? [y/N] "
  );

  if (answer !== "y" && answer !== "yes") {
    console.log("Cancelled.");
    return;
  }

  const gitCommonDir = getGitCommonDir();
  const gitModulePath = path.join(gitCommonDir, "modules", "src", "babylon");

  console.log("\nRemoving existing Babylon Toolkit React Framework submodule...\n");

  // These cleanup steps intentionally continue even if any individual command fails.
  run("git", ["submodule", "deinit", "-f", SUBMODULE_PATH], true);
  run("git", ["rm", "-r", "-f", SUBMODULE_PATH], true);

  fs.rmSync(gitModulePath, { recursive: true, force: true });
  fs.rmSync(SUBMODULE_PATH, { recursive: true, force: true });

  console.log("\nInstalling clean Babylon Toolkit React Framework submodule...\n");

  run("git", ["submodule", "add", SUBMODULE_URL, SUBMODULE_PATH]);
  run("git", ["add", ".gitmodules", SUBMODULE_PATH]);
  run("git", ["commit", "-m", "Update Babylon Toolkit React Framework submodule"]);

  console.log("\nBabylon Toolkit React Framework submodule updated.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

NEXT.JS - Please create this script and command to package.json scripts:
```
"update-babylon": "node tools/update-babylon.cjs"
```

tools/open-browser.cjs
```
#!/usr/bin/env node
// Dev launcher: starts Next.js on port 8080 and auto-opens the browser,
// equivalent to Vite's server.open + server.port options.

const { spawn } = require("child_process");
const http = require("http");

const PORT = 8080;
const URL = `http://localhost:${PORT}`;

// Start Next.js dev server
const proc = spawn(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "dev"],
  { stdio: "inherit", shell: false }
);

proc.on("error", (err) => {
  console.error("Failed to start dev server:", err);
  process.exit(1);
});

// Poll until the server responds, then open the browser once
function waitAndOpen(retries = 40) {
  http
    .get(URL, () => {
      const cmd =
        process.platform === "darwin"
          ? "open"
          : process.platform === "win32"
          ? "start"
          : "xdg-open";
      spawn(cmd, [URL], { shell: process.platform === "win32", detached: true, stdio: "ignore" }).unref();
      console.log(`\nOpened browser at ${URL}\n`);
    })
    .on("error", () => {
      if (retries > 0) {
        setTimeout(() => waitAndOpen(retries - 1), 500);
      }
    });
}

// Give the server a moment to start before polling
setTimeout(() => waitAndOpen(), 1500);
```

## Vite + React + Typescript Template

Template was created using standard npm command. Then updated for `Babylon Toolkit React Framework` support
```
npm create vite@latest my-app -- --template react-ts
```

src/app.tsx
```
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DefaultBabylonPreloader, babylonLogo } from './babylon/custom/loading';
import { useUnifiedNavigation } from "./babylon/system/platform";
import { ReactRouterNavAdapter } from './routing/adpter';
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './app.css'

// Note: All babylon imports stay inside the PlayRoute lazy load chunk
const PlayRoute = lazy(() => import('./routing/router'));

function Home() {
  const { navigate } = useUnifiedNavigation();
  const handlePlayerDemo = () => {
    /* Use Native Navigation API to prevent ANY BABYLON CODE from being included in the main bundle.
     * This ensures that Babylon and all related dependencies are only loaded when the user clicks "Player Demo", optimizing initial load performance.
     * Game code should use game manager, for example:
     * GameManager.NavigateTo("/play", {
     *     gameMode: "PlayerControllerDemo",
     *     sceneUrl: GameManager.PlaygroundRepo + "samplescene.gltf",
     * });
     */
    navigate('/play', {
      gameMode: 'PlayerControllerDemo',
      sceneUrl: 'https://repo.babylontoolkit.com/playground/samplescene.gltf',
    });
  };
  const handleVehicleDemo = () => {
    /* Use Native Navigation API to prevent ANY BABYLON CODE from being included in the main bundle.
     * This ensures that Babylon and all related dependencies are only loaded when the user clicks "Vehicle Demo", optimizing initial load performance.
     * Game code should use game manager, for example:
     * GameManager.NavigateTo("/play", {
     *     gameMode: "VehicleControllerDemo",
     *     sceneUrl: GameManager.PlaygroundRepo + "openterrain.gltf",
     * });
     */
    navigate('/play', {
      gameMode: 'VehicleControllerDemo',
      sceneUrl: 'https://repo.babylontoolkit.com/playground/openterrain.gltf',
    });
  };

  return (
    <div id="vite">
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
          <div>
            <a href="https://babylonjs.com" target="_blank">
              <img src={babylonLogo} className="logo babylon" alt="Babylon logo" />
            </a>
          </div>
        </div>
        <div>
          <h1>React + Vite + BabylonJS</h1>
        </div>
        <div>
          <button type="button" className="counter" onClick={handlePlayerDemo}>Player Demo</button>&nbsp;&nbsp;<button type="button" className="counter" onClick={handleVehicleDemo}>Vehicle Demo</button>
        </div>
      </section>

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2>Documentation</h2>
          <p>Your questions, answered</p>
          <ul>
            <li>
              <a href="https://babylontoolkit.github.io/agent/references/react-framework.md" target="_blank">
                <img className="logo" src={babylonLogo} alt="" />
                Babylon Toolkit
              </a>
            </li>
            <li>
              <a href="https://vite.dev/" target="_blank">
                <img className="logo" src={viteLogo} alt="" />
                Explore Vite
              </a>
            </li>
            <li>
              <a href="https://react.dev/" target="_blank">
                <img className="button-icon" src={reactLogo} alt="" />
                Learn More
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2>Connect with us</h2>
          <p>Join the Vite community</p>
          <ul>
            <li>
              <a href="https://github.com/vitejs/vite" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
            <li>
              <a href="https://chat.vite.dev/" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#discord-icon"></use>
                </svg>
                Discord
              </a>
            </li>
            <li>
              <a href="https://x.com/vite_js" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#x-icon"></use>
                </svg>
                X.com
              </a>
            </li>
            <li>
              <a href="https://bsky.app/profile/vite.dev" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#bluesky-icon"></use>
                </svg>
                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
      <div>
        <small><a href="https://www.babylontoolkit.com" target="_blank">Babylon Toolkit Game Development</a></small>
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
     <ReactRouterNavAdapter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/play" element={
          <Suspense fallback={<DefaultBabylonPreloader />}>
            <PlayRoute />
          </Suspense>
        } />
      </Routes>
     </ReactRouterNavAdapter>
    </BrowserRouter>
  )
}

export default App
```

## React Router Navigation Adapter

src/rounting/router.tsx
```
'use client';

import BabylonSceneViewer from '../babylon/system/babylon';

export default function PlayRoute() {
  return (
    <BabylonSceneViewer
      fullPage={true}
      allowQueryParams={true}
      enableCustomOverlay={false}
    />
  );
}
```

src/rounting/adapter.tsx
```
'use client';

/*
 * =================================================================
 * Host Navigation Adapter - React Router DOM
 * =================================================================
 * Bridges react router hooks into the babylon toolkit's
 * UnifiedNavigation context. Replace this file (or pick a different
 * adapter) when porting to TanStack Router, Next.js, etc.
 * =================================================================
 */

import { createElement, ReactNode, useCallback, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { NavigationProvider, UnifiedNavigateFunction, LocationState, NavigationState, NAV_STATE_STORE_KEY } from "../babylon/system/platform";
import GameManager from "../babylon/globals";

export function ReactRouterNavAdapter({ children }: { children: ReactNode }) {
  const rrNavigate = useNavigate();
  const rrLocation = useLocation();

  const navigate: UnifiedNavigateFunction = useCallback(
    (path, state) => {
      // Bridge: persist state to sessionStorage so it survives iframe reloads.
      // This is intentionally NOT in the URL — users cannot craft a shareable link
      // with a spoofed gameMode/sceneUrl. sessionStorage is origin-scoped and
      // session-scoped; modifying it only affects the user's own browser tab.
      if (state) {
        // Strip reload flag from stored state so it doesn't re-trigger on restore.
        const { reloadPage, ...storedState } = state;
        try { sessionStorage.setItem(NAV_STATE_STORE_KEY, JSON.stringify(storedState)); } catch { /* ignore */ }
        // Force a full DOM reload to release all resources from the previous page
        // and give the new scene a fresh slate.
        if (reloadPage === undefined || reloadPage === true) {
          window.location.href = path;
          return;
        }
      }
      rrNavigate(path, { state });
    },
    [rrNavigate]
  );

  // Note: Register the navigation hook globally so GameManager.NavigateTo works on
  // every page, even before the Babylon runtime has initialized. ReactRouterNavAdapter
  // wraps the whole app (inside BrowserRouter) and already owns the navigate function.
  useEffect(() => {
    GameManager.SetReactNavigationHook(navigate);
    return () => GameManager.DeleteReactNavigationHook();
  }, [navigate]);

  const location: LocationState = useMemo(
    () => ({
      pathname: rrLocation.pathname,
      search: rrLocation.search,
      state: rrLocation.state as NavigationState | undefined,
    }),
    [rrLocation]
  );

  const value = useMemo(() => ({ navigate, location }), [navigate, location]);

  return createElement(NavigationProvider, { value }, children);
}
```

# Full Stack Server React Framework (NEXT.JS)

Template was created using standard npx command. Then updated for `Babylon Toolkit React Framework` support. Always prefer NEXT.JS Version 16 or greater.
```
npx create-next-app@latest my-next-app --typescript
```

## Next.js + Babylon Toolkit React Framework — Required Patches

When installing the Babylon Toolkit React Framework submodule into a Next.js project,
apply ALL THREE patches below BEFORE running the build.

### Patch 1 — Disable Next.js static image imports (`next.config.ts`)

Next.js injects `/// <reference types="next/image-types/global" />` into `next-env.d.ts`,
typing all `*.png` imports as `StaticImageData`. The babylon submodule uses plain
`<img src={logo}>` which expects `string`. This causes a TypeScript build failure.

```ts
// next.config.ts
images: {
  disableStaticImages: true,
},
```

### Patch 2 — Create `png.d.ts` at the project root

With `disableStaticImages: true`, no ambient `*.png` type exists. Create `png.d.ts`
so PNG imports are typed as `string`, matching what the `NormalModuleReplacementPlugin`
produces at bundle time.

```ts
// png.d.ts  (create at project root)
declare module "*.png" {
  const src: string;
  export default src;
}
```

> IMPORTANT: Patch 2 only works AFTER Patch 1. Without `disableStaticImages: true`,
> the Next.js `StaticImageData` declaration is loaded before `png.d.ts` and wins.

### Patch 3 - Adding missing `Play Demo` button next to documentation button

When installing the `Babylon Toolkit React Framework` into a Next.js starter template that has a `Documentation` button, add an additional button by `duplicating` the documentation button with the same style to the right and label the new button `Play Demo` that plays the following `PlayerControllerDemo` onclick handler:
```
const handlePlayDemo = () => {
  navigate('/play', {
    gameMode: 'PlayerControllerDemo',
    sceneUrl: 'https://repo.babylontoolkit.com/playground/samplescene.gltf',
  });
};
```

## Application Layout

app/layout.tsx
```
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { NextNavAdapter } from "./adapter";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Suspense fallback={null}>
          <NextNavAdapter>{children}</NextNavAdapter>
        </Suspense>
      </body>
    </html>
  );
}

```

## React Router Navigation Adapter

app/adapter.tsx
```
'use client';

/*
 * =================================================================
 * Host Navigation Adapter - Next.js (App Router)
 * =================================================================
 * Bridges next/navigation hooks into the babylon toolkit's
 * UnifiedNavigation context.
 *
 * Note: Next.js App Router does not support history state natively
 * the way react-router-dom does. To preserve the NavigationState shape,
 * this adapter writes state to sessionStorage via the shared NAV_STATE_STORE_KEY
 * (defined in platform.tsx) so that BabylonSceneViewer can read it with
 * readNavStateStore() regardless of which adapter is in use.
 * =================================================================
 */

import { createElement, ReactNode, useCallback, useEffect, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { NavigationProvider, UnifiedNavigateFunction, LocationState, NAV_STATE_STORE_KEY, readNavStateStore } from "../babylon/system/platform";
import GameManager from "../babylon/globals";

export function NextNavAdapter({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();

  const navigate: UnifiedNavigateFunction = useCallback(
    (path, state) => {
      // Bridge: persist state to sessionStorage so it survives Next.js
      // App Router transitions (which don't support history state natively).
      // Uses the shared NAV_STATE_STORE_KEY so BabylonSceneViewer can read it with readNavStateStore().
      if (state) {
        // Strip reload flag from stored state so it doesn't re-trigger on restore.
        const { reloadPage, ...storedState } = state;
        try { sessionStorage.setItem(NAV_STATE_STORE_KEY, JSON.stringify(storedState)); } catch { /* ignore */ }
        // Force a full DOM reload to release all resources from the previous page
        // and give the new scene a fresh slate.
        if (reloadPage === undefined || reloadPage === true) {
          window.location.href = path;
          return;
        }
      }
      router.push(path);
    },
    [router]
  );

  // Note: Register the navigation hook globally so GameManager.NavigateTo works on
  // every page, even before the Babylon runtime has initialized. NextNavAdapter
  // wraps the whole app (in app/layout) and already owns the navigate function.
  useEffect(() => {
    GameManager.SetReactNavigationHook(navigate);
    return () => GameManager.DeleteReactNavigationHook();
  }, [navigate]);

  const search = useMemo(() => {
    const s = searchParams?.toString() ?? "";
    return s ? `?${s}` : "";
  }, [searchParams]);

  const location: LocationState = useMemo(
    () => ({
      pathname,
      search,
      state: readNavStateStore(),
    }),
    [pathname, search]
  );

  const value = useMemo(() => ({ navigate, location }), [navigate, location]);

  return createElement(NavigationProvider, { value }, children);
}
```

## Application Play Route

app/play/page.tsx
```
import { Suspense } from "react";
import { DefaultBabylonPreloader } from "@/src/babylon/custom/loading";
import BabylonSceneViewer from "@/src/babylon/system/babylon";

export default function Play() {
  return (
    <Suspense fallback={<DefaultBabylonPreloader />}>
      <BabylonSceneViewer fullPage={true} allowQueryParams={true} enableCustomOverlay={false} />
    </Suspense>
  );
}
```

## Next Configuration File

* Always prefer NEXT.JS 16 or greater which uses webpack by default. You MUST always force the use of webpack instead of turbopack for the react framework submodule to work properly.

package.json example
```
"scripts": {
  "dev": "next dev --webpack",
  "build": "next build --webpack"
}
```

next-config.js
```
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  /* config options here */
  // reactStrictMode: true, // Enable Strict Mode
  // output: "export",      // Enable Static Export

  // The src/babylon git submodule imports PNGs with plain <img src={logo}>, expecting
  // a string URL. Next.js's next-image-loader would return a StaticImageData object
  // instead, causing <img src="[object Object]">. The fix: intercept those two imports
  // before any loader runs and replace them with inline data-URI modules that export
  // the public path strings. webpack: true is set in server-classic.ts so this runs.
  webpack(config, { webpack }) {
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /assets[/\\]babylon\.png$/,
        (res: { request: string }) => {
          res.request = "data:text/javascript,export default '/babylon.png'";
        }
      ),
      new webpack.NormalModuleReplacementPlugin(
        /assets[/\\]spinner\.png$/,
        (res: { request: string }) => {
          res.request = "data:text/javascript,export default '/spinner.png'";
        }
      )
    );
    return config;
  },
};

export default nextConfig;
```

## NEXT.JS Configuration Patches

* Recommended next.config settings
```
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  /* config options here */
  // reactStrictMode: true, // Enable Strict Mode
  // output: "export",      // Enable Static Export

  // Required for BabylonJS Havok physics (SharedArrayBuffer support)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },

  // The src/babylon git submodule imports PNGs with plain <img src={logo}>, expecting
  // a string URL. Next.js's next-image-loader would return a StaticImageData object
  // instead, causing <img src="[object Object]">. The fix: intercept those two imports
  // before any loader runs and replace them with inline data-URI modules that export
  // the public path strings. webpack: true is set in server-classic.ts so this runs.
  webpack(config, { webpack }) {
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /assets[/\\]babylon\.png$/,
        (res: { request: string }) => {
          res.request = "data:text/javascript,export default '/babylon.png'";
        }
      ),
      new webpack.NormalModuleReplacementPlugin(
        /assets[/\\]spinner\.png$/,
        (res: { request: string }) => {
          res.request = "data:text/javascript,export default '/spinner.png'";
        }
      )
    );
    return config;
  },
};

export default nextConfig;
```

* Configure project webpack not turbopack

```
// Force webpack bundler (not Turbopack) so next.config webpack() runs and
// NormalModuleReplacementPlugin can redirect PNG imports in the babylon submodule
// to plain URL string modules. Turbopack doesn't support image file loaders.
const nextApp = next({ dev, webpack: true });
```

* Apply turbopack configuration patch to next.config (`turbopack: {}`)

```
TIP: Many applications work fine under Turbopack with no configuration,
if that is the case for you, you can silence this error by passing the
`--turbopack` or `--webpack` flag explicitly or simply setting an 
empty turbopack config in your Next config file (e.g. `turbopack: {}`).
```

* Configure project to auto open browser when starting server

# Lovable TanStack Adapter

Lovable rounter configuration example

src/routes/__root.tsx
```
import { TanStackNavAdapter } from "../adapter";
// ...
component: () => (
  <TanStackNavAdapter>
    <Outlet />
  </TanStackNavAdapter>
),
```

src/adapter.tsx
```
'use client';

/*
 * =================================================================
 * Host Navigation Adapter - TanStack Router (Lovable default)
 * =================================================================
 * Bridges @tanstack/react-router hooks into the babylon toolkit's
 * UnifiedNavigation context.
 *
 * Note: TanStack Router has no first-class history state API.
 * This adapter uses the shared NAV_STATE_STORE_KEY sessionStorage
 * bridge (defined in platform.tsx) so that BabylonSceneViewer can read it with readNavStateStore() regardless
 * of which adapter is in use. sessionStorage survives iframe reloads
 * and is never exposed in the URL.
 * =================================================================
 */

import { createElement, ReactNode, useCallback, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import {
  NavigationProvider,
  UnifiedNavigateFunction,
  LocationState,
  NAV_STATE_STORE_KEY,
  readNavStateStore,
} from "../babylon/system/platform";
import GameManager from "../babylon/globals";

export function TanStackNavAdapter({ children }: { children: ReactNode }) {
  const tsNavigate = useNavigate();
  const tsLocation = useLocation();

  const navigate: UnifiedNavigateFunction = useCallback(
    (path, state) => {
      // Bridge: persist state to sessionStorage so it survives iframe
      // reloads (e.g. Lovable preview). TanStack has no native history state
      // API, and window.history.replaceState is unreliable after async nav.
      // sessionStorage is origin-scoped and never exposed in the URL.
      if (state) {
        // Strip reloadPage flag from stored state so it doesn't re-trigger on restore.
        const { reloadPage, ...storedState } = state;
        try { sessionStorage.setItem(NAV_STATE_STORE_KEY, JSON.stringify(storedState)); } catch { /* ignore */ }
        // Force a full DOM reload to release all resources from the previous page
        // and give the new scene a fresh slate.
        if (reloadPage === undefined || reloadPage === true) {
          window.location.href = path;
          return;
        }
      }
      tsNavigate({ to: path });
    },
    [tsNavigate]
  );

  // Note: Register the navigation hook globally so GameManager.NavigateTo works
  // on every page, even before the Babylon runtime has initialized.
  // TanStackNavAdapter wraps the whole app and already owns the navigate function.
  useEffect(() => {
    GameManager.SetReactNavigationHook(navigate);
    return () => GameManager.DeleteReactNavigationHook();
  }, [navigate]);

  const location: LocationState = useMemo(
    () => ({
      pathname: tsLocation.pathname,
      search: tsLocation.searchStr ?? "",
      state: readNavStateStore(),
    }),
    [tsLocation]
  );

  const value = useMemo(() => ({ navigate, location }), [navigate, location]);

  return createElement(NavigationProvider, { value }, children);
}
```

---

**Follow these rules exactly for react framework integration**