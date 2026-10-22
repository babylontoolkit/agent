# Prewarming Content — No First-Visit Freeze (1.0.0)

**IMPORTANT. READ THIS DOCUMENT BEFORE WRITING CODE THAT CREATES OR SWITCHES CONTENT AFTER THE SPLASH LIFTS** — prefabs or
containers instantiated during play, object pools, post processes toggled during play, animated scales or texture
transforms.

**Minimal by default.** Most content needs **no warm-up code**: whatever is in the scene when the splash lifts —
enabled, hidden or disabled meshes, every camera's post chain, toolkit particle systems — is warmed automatically (§3).
Register only what PREWARM cannot see (§4): content created after the reveal (one `WarmPrefab` per container, never per
instance), a post process attached later, a scale that changes shape. Let the development-build detector (§7) decide —
every registration answers a late-compile record it logged, never a guess. A finished game shows no late compile after
the splash lifts, with as few registrations as that takes.

The short version lives in `scene-components.md` › *Pre-warm behind the splash*; this document is the full guide and API.

---

## 1. The problem

The first time Babylon draws a material/mesh combination it compiles a **shader effect**, and on WebGPU it also builds a
**GPU render pipeline** for each render pass that draws it (the main pass, every shadow map, every render target). Each
takes tens to hundreds of milliseconds, and the page is frozen while it happens. During play that is a visible hitch:
the first item thrown, a camera switch, a particle burst. The toolkit's answer is to do that work **before the player
can see anything**, while the splash still covers the canvas.

## 2. Vocabulary

| Term | Meaning |
|---|---|
| **Splash** | The loading screen (engine.html's loader or a React splash). `TOOLKIT.SplashNarrator` is the only toolkit writer to it. |
| **Reveal** | The moment the splash starts to fade and the scene becomes visible. `SceneShaderWarmup.MarkSceneRevealed(scene)` records it; `SceneManager.OnSceneRevealedObservable` fires. |
| **PREWARM** | The reveal-time pass, `SceneShaderWarmup.PrepareGameAsync(scene)` — the splash's last stage, shown as **Optimizing Graphics** (80–99 %). Nothing skips it. |
| **Behind the splash** | Anything done before the reveal. It costs time, but the player is looking at a loading bar, not a frozen game. |
| **Late compile** | A shader effect, WebGPU pipeline or WebGL program created **after** the reveal — a potential hitch. |
| **Variant** | The same material compiled with a different set of `#define`s: instanced or not, non-uniform scale or not, a texture transform or not, a different light count. Each variant is a separate compile. |

## 3. What PREWARM does automatically

Content that **already exists in the scene** when PREWARM runs needs no registration. The pass:

1. **Waits for every toolkit scene load in flight** (step `loading`). The toolkit's glTF loader counts each load of a
   file carrying the toolkit's scene metadata (`SceneManager.IsSceneLoadComplete`), so an asset container still
   downloading holds PREWARM until it lands. There is no special tag in the export — the count comes from the ordinary
   loader.
2. **Raises `OnBeforePrewarmObservable`** — the game's chance to put later content in place (§5.3).
3. **Compiles every shader the scene needs now** (step `materials`): every enabled mesh, every disabled or invisible
   mesh (compiled, never enabled — `WarmHiddenMeshesOnReveal`), every post process on every screen camera
   (`WarmAllCamerasOnReveal`).
4. **Render passes** (step `renderPasses`): effect layers (glow, highlight), mirrors, reflection probes, custom render
   targets and render-target cameras (`WarmRenderPassesOnReveal`).
5. **Registered prefabs** (step `prefabs`): a hidden copy of each container registered with `WarmPrefab` is drawn and
   disposed (§5.1).
6. **GPU pipelines** (step `pipelines`, WebGPU, `BuildScenePipelinesOnReveal`): the whole scene is drawn once with
   frustum culling off, from every screen camera, so each draw's pipeline is built — including hidden meshes, drawn
   without being enabled (`DrawHiddenMeshesOnReveal`; one mesh per pipeline group — same material, effects, vertex layout,
   bone count and facing — since the others would build the same pipelines), and the other non-uniform-scale variant of
   registered nodes (`WarmScaleVariantsOnReveal`). A mesh with `renderOverlay` / `renderOutline` set also has the outline
   renderer's shader compiled.
7. **Idle particle systems** (step `particles`): every idle system (plain, GPU, `ShurikenParticles`, `VisualEffect`) is
   drawn for a few frames with one invisible particle and returned exactly to its state (`AutoWarmIdleParticles`).
8. **Settling, exposure, ready** — the splash shows **Ready** at 100 % and fades.

When a scene load finished during a round, PREWARM runs another round for what it added (up to `PREWARM_MAX_ROUNDS`).
Optional units (hidden meshes, render passes) are given up `OPTIONAL_UNIT_GRACE_MS` after every required unit is ready.

**Hidden content is prepared too:** a mesh holding a thin-instance buffer with **no instance yet** (a particle mesh
renderer between bursts, a pool drawn later) gets one zero-scale placeholder instance for the round, so its *instanced*
variant compiles (`WarmEmptyThinInstancesOnReveal`). Hidden meshes are drawn in the WebGPU pipeline stage through a
temporary `isEnabled` override, never `setEnabled`, so no script, particle system or `onEnabledStateChanged` observer
fires.

## 4. What PREWARM cannot see

| Late source | Example |
|---|---|
| Content code creates after the reveal | An item clone made on first use; an explosion instantiated on impact; a model mounted after a container loads. |
| A post process attached only later | An underwater colour filter attached when the camera dives. |
| A state change that makes a new variant | A light enabled mid-game, fog toggled, a texture offset moved off zero, an Animator scaling a node non-uniformly. |

The first two are fixed by **registering** (§5), the third by the **authoring rules** (§6).

## 5. Registering content created at runtime

Registration is always **a call made by the code that owns the content, before the reveal**. Nothing is flagged in the
exported data, and the exporter does not know about it.

### 5.1 Prefabs and asset containers — `WarmPrefab`

```ts
const propellerContainer: BABYLON.AssetContainer = await TOOLKIT.SceneManager.LoadAssetContainerAsync(sceneBaseUrl, "kartpropeller.gltf", scene);
TOOLKIT.SceneShaderWarmup.WarmPrefab(propellerContainer, "KartPropeller");   // or WarmPrefab(container) for every root
```

At the next PREWARM a hidden copy is instantiated **without script components** (no `awake()` / `start()`, audio or
network work), drawn (shaders, pipelines, its shadow pass) and disposed. Copies are named with
`PREFAB_WARM_COPY_PREFIX` (`__warmup__`). Registered once; a registration after the reveal is warmed at the next
reveal.

**The load must be finished, or in flight, before PREWARM.** Start it in the scene's setup without awaiting it: PREWARM
waits for toolkit loads in flight. Awaiting it inside a game mode's `createScene` delays the reveal by the load time,
because the splash's minimum display time counts from the end of `createScene`.

### 5.2 Idle particle systems — `WarmParticleSystem`

```ts
const tireSmoke: BABYLON.ParticleSystem = new BABYLON.ParticleSystem("TireSmoke", 200, scene);   // started on the first skid
TOOLKIT.SceneShaderWarmup.WarmParticleSystem(tireSmoke);
```

For a system created after a PREWARM pass, or any system when `AutoWarmIdleParticles` is false. `TOOLKIT.ShurikenParticles`
and `TOOLKIT.VisualEffect` register themselves as participants when they are created (`RegisterParticleParticipant`) —
they only have to exist before PREWARM.

### 5.3 Anything shown only later — `OnBeforePrewarmObservable`

Each PREWARM round raises `SceneShaderWarmup.OnBeforePrewarmObservable(scene)` after the scene's loads finished (volumes
and camera post chains exist) and **before** the round collects what to compile. Put the content in place there, as it
will look in play, and put it back at the reveal:

```ts
const prewarmObserver: BABYLON.Observer<BABYLON.Scene> = TOOLKIT.SceneShaderWarmup.OnBeforePrewarmObservable.add((preparedScene: BABYLON.Scene) => {
    if (preparedScene !== scene) return;
    for (const camera of gameCameras) TOOLKIT.PostProcessor.AttachPass(camera, filterPassFor(camera), imageProcessingIndex);
});
TOOLKIT.SceneManager.WhenSceneRevealed(scene).then(() => {
    TOOLKIT.SceneShaderWarmup.OnBeforePrewarmObservable.remove(prewarmObserver);
    for (const camera of gameCameras) TOOLKIT.PostProcessor.DetachPass(camera, filterPassFor(camera));
});
```

An observer that throws is reported once and the pass goes on. Use it for:
- **post processes** shown only later (an underwater or damage filter);
- **object pools**: create the first pooled instance of each kind here, hidden, and keep it — it is then an ordinary
  hidden mesh that PREWARM compiles and (WebGPU) draws. Register its root with `WarmScaleVariants` when it rests at another
  scale than it shows, and turn an overlay it flashes later on (alpha 0) until the reveal.

### 5.4 Switching a post process during play — `PostProcessor.AttachPass` / `DetachPass`

```ts
TOOLKIT.PostProcessor.AttachPass(camera, filterPass, insertAt);   // returns the pass's index in the chain, or -1
TOOLKIT.PostProcessor.DetachPass(camera, filterPass);
```

Babylon's own `camera.attachPostProcess` / `detachPostProcess` rebuild the prepass renderer, which re-checks every
material of the scene on the next frame — about **0.35–0.5 s for ~700 materials**, on WebGPU and WebGL2, on **every**
switch (warming cannot fix it). `AttachPass` / `DetachPass` splice the pass into the chain directly when it has no
prepass effect configuration and is not an image-processing pass; any other pass falls back to Babylon's attach. Create
the pass detached (camera `null`). Never use Babylon's attach/detach to toggle a pass during play.

### 5.5 Nodes whose scale changes shape — `WarmScaleVariants`

```ts
TOOLKIT.SceneShaderWarmup.WarmScaleVariants(gliderNode);
```

Babylon compiles `NONUNIFORMSCALING` into a mesh's shader from its **world scale**, so a node that goes between uniform
and non-uniform scale during play recompiles then (a canopy an Animator unfolds from a uniform 0.01, a squash animation,
a pooled copy resting at a non-uniform scale that shows uniform). Registered, every mesh on and below the node gets its
other variant compiled (and on WebGPU drawn) at each reveal (`WarmScaleVariantsOnReveal`). The toolkit Animator registers
the nodes its clips scale that way when it binds; call it for scales your own code animates. Only registered nodes are
covered — warming every mesh both ways costs seconds of splash.

### 5.6 Choosing the call

| You create… | Before the reveal |
|---|---|
| Copies of a prefab or container later | `WarmPrefab(container, "Name")` |
| An idle particle system | `WarmParticleSystem(system)` — nothing for `ShurikenParticles` / `VisualEffect` |
| A pool of objects | First instance created at `OnBeforePrewarmObservable`, hidden, kept; `WarmScaleVariants(root)` when it rests at another scale |
| A post process shown later | Attached at `OnBeforePrewarmObservable`, detached at the reveal, switched with `AttachPass` / `DetachPass` |
| A node whose scale goes non-uniform | `WarmScaleVariants(node)` (the Animator does this for its clips) |
| A camera switched to later | Nothing — every screen camera's pass is warmed (`WarmAllCamerasOnReveal`) |
| A hidden or disabled mesh | Nothing — compiled and (WebGPU) drawn |

## 6. Authoring rules — variants code cannot find

New variants come from state changes during play. Avoid the change rather than warming it:

1. **Create every light at load**; dim, re-colour or move it instead of adding or enabling one during play — the light
   count is part of every lit material's shader.
2. **Create mirrors, minimap and render-target cameras, reflection probes and glow / highlight layers at load**; stop
   their refresh instead of creating them later.
3. **Prefer one material per look**; look-alike variants each compile their own shader.
4. **Set fog, clip planes, morph targets and bone counts at load**; toggling them during play creates new variants.
5. **The first instance (or thin instance) of a mesh compiles an instanced variant**: create instanced content before
   the reveal or register its prefab.
6. **Give an animated texture its non-default offset, scale or rotation at load** (or animate it from its first frame):
   moving a texture transform away from identity during play compiles a texture-transform variant. The toolkit Animator
   turns `optimizeUVAllocation` off at bind on textures an `_ST` curve animates, so the clip moving the offset no longer
   flips `<MAP>DIRECTUV`.
7. **Clone a material with its plugins.** Babylon's `Material.clone` drops plugins it cannot rebuild; the toolkit's
   pipeline lighting (`PipelineLightingPlugin`) was lost on every Animator per-renderer clone — another lighting model and a
   new shader the first time the clone drew. The Animator now restores it (`PipelineLightingPlugin.CopyToClone(original,
   clone)`); call that for a material your own code clones.

## 7. Finding late compiles — the detector

In a **development build** (localhost, loopback or private LAN address, a `.local` name, or
`SceneManager.GlobalOptions.developmentMode = true`) every effect, pipeline or program created after the reveal is logged
with its cause, plus a summary `LATE_COMPILE_SUMMARY_DELAY_MS` (5 s) after the reveal.

```ts
const lateCompiles: TOOLKIT.ILateCompileRecord[] = TOOLKIT.SceneShaderWarmup.GetLateCompiles(scene);   // oldest first
TOOLKIT.SceneShaderWarmup.OnLateCompileObservable.add((record: TOOLKIT.ILateCompileRecord) => { /* … */ });
TOOLKIT.SceneShaderWarmup.LogLateCompileSummary(scene);
```

| `ILateCompileRecord` field | Meaning |
|---|---|
| `kind` / `causeKind` | What was created, and what asked for it (mesh, particles, post process …) |
| `cause` | Readable, e.g. `mesh "Kart_Body" material "KartPaint" in pass "main"` |
| `meshName` / `materialName` / `particleSystemName` / `postProcessName` | The owner |
| `renderPassName` | `"main"`, `"Camera <name>"`, `"<render target>#0"` … — which camera or shadow map missed it |
| `effectName` / `effectKey` | Shader base name and cache key (vertex + fragment @ defines) — diff the defines against the reveal-time effect to see which variant changed |
| `msSinceReveal` | When it happened |

`LateCompileReporting`: `true` / `false` forces the detector on / off; `null` (default) = development builds only.
**Drive the list to zero; never mute the detector as a fix.**

**Not every hitch is a compile.** Two spikes with no compile behind them: Babylon's prepass rebuild on attach/detach
(§5.4), and the browser's first raster of a large DOM HUD (a ~200 ms GPU-process raster when it first appears — lay it out
once, at full opacity, for about a second under the opaque splash; opacity 0 does not raster). Measure frame times around a hitch (frames far above the run's median), not only the
detector.

## 8. The WebGPU safety net

After the reveal on WebGPU, a draw whose pipeline is not built yet is **skipped for a frame or two** while it builds
asynchronously, instead of freezing every tab. On by default (`SafetyNetEnabled`); per engine with
`SetSafetyNetEnabled(engine, enabled)` / `IsSafetyNetEnabled(engine)`. It hides a freeze by making the object **pop in
late** — a net, never a substitute for warming.

## 9. Scene loads — draw hold and non-blocking compile

Every toolkit glTF load calls `BeginSceneLoad(scene)`:

- **Draw hold** (only a load into a scene never shown, `ShouldHoldDraws`): the scene draws no mesh, so no frame prepares
  every material at once on the page thread; `RunAsync` compiles them a few milliseconds per poll (`POLL_MS`,
  `POLL_BUDGET_MS`) and lifts the hold when done (`IsHoldingDraws`).
- **Asynchronous pipeline mode** (WebGPU): `PendingPipelineCount(scene)` reports pipelines still compiling.
- **A later load into a live scene** (a container mid-game) keeps the view drawing.

Use `SceneShaderWarmup.ExecuteWhenReady(scene, action)` instead of `scene.executeWhenReady`: it waits out a toolkit load
instead of preparing every material in one blocking call.

## 10. API reference — `TOOLKIT.SceneShaderWarmup`

### Registration and hooks

| Member | Purpose |
|---|---|
| `WarmPrefab(container, prefabName = null)` | Draw a hidden, script-less copy of a prefab (or every container root) at the next PREWARM |
| `WarmParticleSystem(system)` | Draw an idle particle system once, invisibly, at the next PREWARM |
| `WarmScaleVariants(node)` | Compile (and on WebGPU draw) the other `NONUNIFORMSCALING` variant of every mesh under the node |
| `RegisterParticleParticipant(scene, participant)` / `UnregisterParticleParticipant(scene, participant)` | Components that warm their own particle systems |
| `OnBeforePrewarmObservable` | Raised at the start of every PREWARM round with the scene |
| `OnLateCompileObservable` | Every late compile, once its cause is resolved |

### Passes

| Member | Purpose |
|---|---|
| `PrepareGameAsync(scene)` | PREWARM, the reveal-time pass (both reveal paths run it; a second caller shares the running pass; never rejects) |
| `RunAsync(scene, onProgress, options)` | The two-stage warm-up (effects, then pipelines) used by scene loads and PREWARM |
| `PostPrewarmStatus(scene, step, fraction)` | Reports a PREWARM step to the splash; `"ready"` ends PREWARM |
| `MarkSceneRevealed(scene)` / `IsSceneRevealed(scene)` | Record / query the reveal (starts the detector and the safety net) |
| `BeginSceneLoad(scene)`, `ShouldHoldDraws`, `IsHoldingDraws`, `PendingPipelineCount` | Scene-load mode (§9) |
| `ExecuteWhenReady(scene, action)` | `executeWhenReady` that waits out a toolkit load |
| `TexturesLoaded(material)` | True when every bound texture has loaded or failed (warm-ups wait for it, avoiding a recompile and pop-in) |

### Switches (all `true` by default)

| Switch | `false` means |
|---|---|
| `WarmHiddenMeshesOnReveal` | Disabled and invisible meshes are left out of PREWARM |
| `WarmRenderPassesOnReveal` | Effect layers, mirrors, probes and render targets are left out |
| `WarmAllCamerasOnReveal` | Only the active camera(s) are warmed (on: every screen camera, at a cost of about a second of splash on a large scene) |
| `BuildScenePipelinesOnReveal` | The WebGPU whole-scene pipeline stage is skipped |
| `DrawHiddenMeshesOnReveal` | Hidden meshes compile, but their WebGPU pipelines are built on first show |
| `WarmEmptyThinInstancesOnReveal` | Empty thin-instance meshes compile their plain variant only |
| `WarmScaleVariantsOnReveal` | Registered nodes' other scale variant is not warmed |
| `AutoWarmIdleParticles` | Only registered particle systems are warmed |
| `SafetyNetEnabled` | WebGPU builds a missing pipeline synchronously after the reveal |
| `LateCompileReporting` | `null` (default) = development builds only; `true` / `false` forces it |

### Tuning constants

| Constant | Default | Meaning |
|---|---|---|
| `TIMEOUT_MS` | 30000 | Upper bound of one warm-up |
| `POLL_MS` / `POLL_BUDGET_MS` | 8 / 16 | Pause between polls / work per poll (ms) |
| `PREWARM_MAX_ROUNDS` | 4 | Rounds of one PREWARM when loads finish during it |
| `PREWARM_LOAD_POLL_MS` | 50 | Wait between checks for loads in flight |
| `OPTIONAL_UNIT_GRACE_MS` | 3000 | Optional units given up after the required ones are ready |
| `PARTICLE_WARM_FRAMES` | 3 | Frames each warmed particle system stays drawn |
| `PARTICLE_WARM_TIMEOUT_MS` | 5000 | Upper bound of the particle stage |
| `PARTICLE_WARM_GIVE_UP_FRAMES` | 30 | Frames before a system that shows no particle is given up |
| `PIPELINE_SETTLE_FRAMES` / `PIPELINE_QUIET_FRAMES` | 2 / 10 | Quiet frames that end the pipeline stage / async mode |
| `EFFECT_STAGE_SHARE` | 0.6 | Share of the bar the effect stage fills |
| `LOAD_MODE_TIMEOUT_MS` | 120000 | Upper bound of a load's draw hold |
| `LATE_COMPILE_SUMMARY_DELAY_MS` | 5000 | Detector summary delay after the reveal |
| `PREFAB_WARM_COPY_PREFIX` | `"__warmup__"` | Name prefix of warmed prefab copies |

### Related APIs

| Member | Purpose |
|---|---|
| `TOOLKIT.PostProcessor.AttachPass(camera, pass, insertAt)` / `DetachPass(camera, pass)` | Switch a pass without the prepass-rebuild freeze (§5.4) |
| `TOOLKIT.SceneManager.OnSceneRevealedObservable` | Fires when a scene is shown |
| `TOOLKIT.SceneManager.WhenSceneRevealed(scene)` | Promise: `true` once shown, `false` if disposed first |
| `TOOLKIT.SceneManager.IsSceneLoadComplete(scene)` | True when no toolkit load is in flight |
| `TOOLKIT.SplashNarrator.STATUS_TEXT` / `SUBTITLE_TEXT` | Reword the splash — never post your own loader status during the splash |

PREWARM step names (`TOOLKIT.PrewarmStep`): `loading`, `materials`, `renderPasses`, `prefabs`, `pipelines`, `particles`,
`settling`, `exposure`, `ready`.

## 11. Worked example — an underwater view

A racing game's underwater view (a colour filter on every race camera, a propeller on every kart, bubbles on the
player's kart) hitched 430–500 ms (15–18× the median frame) on every dive and surfacing, on WebGPU and WebGL2.
Measured first, **not one late compile** belonged to it: the whole spike was Babylon's prepass rebuild on
`attachPostProcess` / `detachPostProcess` (muted, the frame fell from 391 ms to 23 ms). After the fix every transition
ran at 1.1–1.3× the median, and the splash grew 0.1 s.

| Piece | Mechanism |
|---|---|
| Colour filter, one pass per race camera + the intro camera (only on a track with water) | Created and attached in its underwater slot at `OnBeforePrewarmObservable`; detached at `WhenSceneRevealed`; switched in play with `AttachPass` / `DetachPass` |
| Propellers | `WarmPrefab(container, "KartPropeller")` right after the container loads; the game still shows and hides the real ones |
| Bubbles | Nothing extra — `ShurikenParticles` register themselves when created, before PREWARM |
| Container timing | Both loads started in the scene setup, not awaited — PREWARM waits for toolkit loads in flight |

**Lesson: measure the hitch before choosing the fix.** A late-compile record says *warm it*; a spike without one says
*find what else runs on that frame*.

## 12. Checklist for any code that shows content during play

- [ ] Everything it draws exists before the reveal, or is registered (§5.6).
- [ ] Containers are loaded or in flight before PREWARM (started in the scene setup, not awaited in `createScene`).
- [ ] Post processes switched in play use `AttachPass` / `DetachPass`.
- [ ] No light, fog, clip-plane or texture-transform change during play that §6 forbids.
- [ ] A cold run (fresh browser profile, cache off) on WebGPU **and** WebGL2 shows no late-compile record for it, and no
      frame round its moments above 2× the run's median.
- [ ] The splash still ends at **Ready 100 %**, and its time grew by no more than the feature can justify.
