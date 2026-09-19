# Babylon Toolkit Higgsfield CLI

**IMPORTANT. THIS DOCUMENT PROVIDES CRUCIAL HIGGSFIELD CLI INSTRUCTIONS. ALWAYS READ THIS ENTIRE DOCUMENT TO THE END OF FILE**

> **DEFAULT INSTALL RULE:** Install the CLI **locally in the project**
> (`npm install --save-dev @higgsfield/cli`) and call it through `node_modules/.bin/higgsfield`.
> **NEVER install globally unless the user explicitly instructs it.**

> **SPENDING RULE:** Every Higgsfield generation spends the user's **credits**, which is real money.
> Always run `--cost` first and pick the cheapest model that meets the quality bar. For batches, state the
> total before submitting. Never run billing, publishing or deploy commands without an explicit user request.

The Higgsfield CLI is a terminal tool for Higgsfield's image, video, speech and 3D models. You drive it
yourself, exactly like the Unity CLI (`unity-exporter-cli.md`) and headless Blender (`unity-blender-cli.md`).
It is the **only** supported way to use Higgsfield in a Babylon Toolkit project. Do not use a Higgsfield MCP server.

**kie is still the default generator** (`web-kie-servers.md`). Use Higgsfield when the user asks for it, when
kie is not configured and Higgsfield is, or for the things only Higgsfield does:

| Need | Use |
|---|---|
| Default image / texture / video generation | kie (`web-kie-servers.md`) |
| The user asked for Higgsfield, or only Higgsfield is set up | Higgsfield CLI, this document |
| **Image → 3D GLB mesh** (optionally textured, PBR, rigged, animated) | Higgsfield `tripo_h3_1_image_to_3d`, `image_to_3d`, `multi_image_to_3d`, `meshy_v7_image_to_3d`, … |
| Background removal, image/video upscale, outpaint, reframe, dubbing, voice change | Higgsfield models and workflows (catalog below) |
| **Music, sound effects, ambience** | **kie** `generate_sound`. Higgsfield's `sonilo_music` / `mirelo_text_to_audio` exist but are reserved for Higgsfield's own game pipeline |
| Speech / voiceover / NPC dialogue | Either. Higgsfield `seed_audio` with a voice from `higgsfield voices list` |

## Install

```
npm install --save-dev @higgsfield/cli
```

The package's postinstall downloads the prebuilt `hf` binary for the platform from Higgsfield's GitHub release
and verifies its SHA-256 before extracting it. It supports macOS, Linux and Windows (x64, arm64). The commands
are `higgsfield`, `higgs` and `hf`; this document always writes `higgsfield`. Verify the install:

```
node_modules/.bin/higgsfield version
# higgsfield 1.1.26 (…) built 2026-09-18T…
```

Then install the **download wrapper** (next section) into the project:

```
mkdir -p scripts
curl -fsSL https://raw.githubusercontent.com/babylontoolkit/agent/main/references/higgsfield/hf-generate.mjs -o scripts/hf-generate.mjs
```

## Sign-In And Workspace (one time per machine)

Auth is browser OAuth (PKCE). There is **no API key** and nothing goes in `.env`. Credentials live in
`~/.config/higgsfield/credentials.json` and the selected workspace in `~/.config/higgsfield/config.json`. Both
are shared by every project and every install on the machine.

1. **You start the login; the user finishes it.** Run it in the background, because it waits for the browser:
   ```
   node_modules/.bin/higgsfield auth login
   # Opening browser for authentication...
   # If browser does not open, open this file in your browser: file:///…/sign-in.html
   # Waiting for approval...
   # Successfully authenticated.
   ```
   Give the user the `sign-in.html` path in case the browser did not open. This is the one legitimate stop:
   only the user can approve the sign-in.
2. **Select a workspace.** Every command fails with `Error: No workspace selected.` until you do:
   ```
   node_modules/.bin/higgsfield workspace list --json     # [{ "id", "plan_type", "credits", "is_selected", "user_role" }]
   node_modules/.bin/higgsfield workspace set <id>
   ```
   With exactly one workspace, select it yourself. With several, ask the user which one to bill: this is a
   money question.
3. Check: `node_modules/.bin/higgsfield account status --json` → `{ "credits", "email", "subscription_plan_type" }`.

Set `HIGGSFIELD_DISABLE_TELEMETRY=1` in the environment of every CLI call. Telemetry is **on by default**.
The wrapper sets it for you.

## The Wrapper: `scripts/hf-generate.mjs` (use this for every generation)

The CLI returns **CDN URLs, not files**. `higgsfield generate create … --wait --json` prints an array of
finished jobs, and nothing is written to disk. The wrapper gives Higgsfield the same contract as kie's
`out_path`: it creates the job, waits for it, and downloads the result to the path you name. It is a
zero-dependency Node 18+ script.

```
node scripts/hf-generate.mjs <model> --out <file> [--param value]...   # generate + save
node scripts/hf-generate.mjs <model> --cost [--param value]...         # credit estimate only
```

| Option | Meaning |
|---|---|
| `--out <file>` | Save the result here. Parent folders are created. Several results → `name_1.ext`, `name_2.ext`, … |
| `--out-dir <dir>` | Save as `<dir>/<job_id>.<ext>` instead |
| `--min` | Download the compressed preview (`min_result_url`: a WebP for images) instead of the full result |
| `--timeout <dur>` | Wait budget (default `20m`), passed to the CLI as `--wait-timeout` |
| `--cost` | Print `{ "credits": N }` from `generate cost`, create nothing |
| anything else | Passed straight through to `higgsfield generate create`: model params and media flags |

- **stdout:** `[{ "job_id", "status", "file", "url" }]`. Read `file` for the saved path.
- **Exit codes:** `0` ok · `1` usage or CLI error · `2` a job did not complete · `3` download failed.
- **File types:** if `--out` names the wrong type, the file keeps its real type and the actual path is
  reported. Image results are PNG, so `--out hero.jpg` is saved as `hero.png` with a warning on stderr. Use the
  reported `file`, or convert the file yourself (`sips -s format jpeg` / ffmpeg) when a JPEG is required.
- **CLI lookup:** `$HIGGSFIELD_BIN`, then `./node_modules/.bin/higgsfield`, then `higgsfield` on `PATH`.

## Passing Parameters

- **Model params** are `--<name> <value>`, spelled **exactly as `model get` prints them, with underscores**:
  `--aspect_ratio 16:9`, `--resolution 2k`, `--generate_audio false`. Booleans are `true`/`false`.
- **Media flags:** `--image-references` (`--image`), `--video-references` (`--video`), `--audio-references`
  (`--audio`), `--start-image`, `--end-image`. Each takes a **local file path**, which is uploaded
  automatically, or a UUID: an upload ID or a previous job's ID. **Repeat the flag** for several files
  (`--image-references a.png --image-references b.png`). A comma-separated list is rejected.
- **Reuse uploads.** Every call that names a local path uploads it again. When one file feeds several calls
  (a base texture for 6 variants, an anchor image for 4 clips), upload once and pass the ID:
  ```
  node_modules/.bin/higgsfield upload create ./base.png --json      # { "id", "type": "image", "url" }
  ```
- **A previous result feeds the next call by job ID.** Pass the finished job's `job_id` (from the wrapper's
  stdout) as a media flag value, with no re-upload.
- **Always check a model's params before first use:** `higgsfield model get <model> --json` lists `params`
  (name, type, default, required, enum) and `rules` (conditions the CLI checks locally).

## Verified Test Runs (2026-09-19)

| Call | Result |
|---|---|
| `generate cost z_image --prompt … --aspect_ratio 1:1` | `{"credits": 0.15}` |
| `generate create z_image … --wait --json` | Returned `[{ id, status: "completed", job_type, display_name, created_at, params{width:2048,height:2048,…}, result_url (.png), min_result_url (_min.webp) }]` in one call |
| `node scripts/hf-generate.mjs z_image … --out assets/generated/lantern.jpg` | Saved `assets/generated/lantern.png` (2048×2048 PNG, 5.9 MB) and warned about the extension. Balance 9.70 → 9.55 |
| `generate cost nano_banana_2 --prompt … --image-references ./well_small.png` | `{"credits": 2}`, with the local file auto-uploaded |
| `generate cost kling3_0 --start-image ./a.png --end-image ./a.png --sound off --mode std --duration 5` | `{"credits": 7.5}` |
| `generate cost tripo_h3_1_image_to_3d --image-references <upload_id>` | `{"credits": 9}` |
| `upload create ./well_small.png --json` | `{"id","type":"image","url"}` |

**Known limits:**
- `image_to_3d` and `meshy_v7_image_to_3d` **cannot be cost-estimated** by the CLI (`does not support alpha v2
  cost estimation`). Prefer `tripo_h3_1_image_to_3d`, which can. If you must use one of the others, read
  `account status` before and after one job and log the difference.
- `image_to_3d` checks its rules locally and fails with `Unsupported validation rules` unless every
  rule field is passed explicitly: `--enable_animation false --enable_rigging false --should_texture <bool> --enable_pbr <bool>`.
- **`model list` is not exhaustive.** `nano_banana_2` works (`model get` and `cost` succeed) but is not listed.
  When a model id from this document is missing from the list, try `model get <id>` before concluding it's gone.
- There is **no sprite-sheet model** (`autosprite`) in the CLI.

## Recipes

**Texture / concept image**
```
node scripts/hf-generate.mjs z_image --cost --prompt "…"                                   # 0.15 credits, text-only draft
node scripts/hf-generate.mjs gpt_image_2_5 --prompt "…" --aspect_ratio 1:1 --resolution 2k \
     --quality medium --out assets/textures/crate_albedo.png
```
`z_image` is the cheapest (0.15) but takes no references. `gpt_image_2_5` is the default general model
(`--background transparent` supported). `nano_banana_2` takes references + 4k. `seedream_v4_5` does 4K. For
seamless tiling, say "seamless tileable" in the prompt and **verify** it yourself: offset the image by half
with ImageMagick and look at it. The model does not guarantee tiling.

**Edit with references** (the base image first)
```
node scripts/hf-generate.mjs nano_banana_2 --prompt "same crate, painted red, same layout" \
     --image-references ./base.png --image-references ./uv_layout.png --resolution 2k --out raw/skin_01.png
```

**Chained video clips** (first/last frame pinned)
```
node scripts/hf-generate.mjs kling3_0 --cost --prompt "…" --start-image media/clip1-last.jpg --end-image <anchor_job_id> --sound off --mode pro --duration 8
node scripts/hf-generate.mjs kling3_0 --prompt "…" --start-image media/clip1-last.jpg --end-image <anchor_job_id> \
     --sound off --mode pro --duration 8 --aspect_ratio 16:9 --out media/clip2.mp4
```
`kling3_0` takes `mode std|pro|4k`, `duration` (default 5), `sound on|off` and `aspect_ratio 16:9|9:16|1:1`. `seedance_2_5`
takes `duration`, `resolution 480p|720p|1080p`, `generate_audio` and `mode t2v|omni_reference|video_edit|video_extension`.
Turn audio **off** for anything that gets muted or re-encoded without sound. It costs less.

**Image → GLB**
```
node scripts/hf-generate.mjs tripo_h3_1_image_to_3d --cost --image-references ./prop.png     # 9 credits verified
node scripts/hf-generate.mjs tripo_h3_1_image_to_3d --image-references ./prop.png --out models/prop.glb
```
Start from a clean single-subject image on a plain background (run `image_background_remover` first if
needed). Animation clips for rigged meshes: `higgsfield preset list animation-action --query walk --json`,
then pass the id as `--animation_action_id` with `--enable_rigging true --enable_animation true` (`image_to_3d`).
The GLB is a **starting mesh**: repair, retopo, UV, LOD and weight it in headless Blender
(`unity-blender-cli.md`), then import it into Unity and add interactive components there (`unity-exporter-cli.md`).
Before the first job, check what the result actually is: `file models/prop.glb` must say `glTF binary`.

**NPC voice line**
```
node_modules/.bin/higgsfield voices list --json                 # pick voice id + voice type
node scripts/hf-generate.mjs seed_audio --prompt "Halt! Who goes there?" --voice_type preset --voice_id <id> \
     --format mp3 --out assets/audio/vo/guard_halt.mp3
```

**Many assets at once:** run independent wrapper calls in parallel from the shell (`… & … & wait`), each
with its own `--out`. State the total `--cost` first.

## Model Catalog (`higgsfield model list`, 2026-09-19)

Inspect any entry with `higgsfield model get <id> --json`. Costs are only listed where verified above.

| Type | Models |
|---|---|
| image | `z_image`, `gpt_image_2_5`, `gpt_image_2`, `nano_banana`, `nano_banana_flash`, `nano_banana_2_lite`, `nano_banana_pro`, `nano_banana_2` (unlisted), `nano_banana_2_ai_stylist`, `nano_banana_2_relight`, `nano_banana_2_skin_enhancer`, `nano_banana_2_shots`, `seedream_v4_5`, `seedream_v5_lite`, `seedream_v5_pro`, `flux_2`, `flux_kontext`, `flux_2_pro_outpaint`, `outpaint`, `kling_omni_image`, `grok_image`, `grok_image_2_0`, `openai_hazel`, `recraft_v4_1`, `text2image_soul_v2`, `soul_cinematic`, `soul_cast`, `soul_location`, `image_auto`, `image_background_remover`, `bytedance_image_upscale`, `topaz_image`, `topaz_image_generative` |
| video | `seedance_2_5`, `seedance_2_0`, `seedance_2_0_mini`, `seedance1_5`, `kling3_0`, `kling3_0_turbo`, `kling2_6`, `kling_video_edit`, `minimax_h3`, `minimax_h3_max`, `minimax_hailuo`, `veo3`, `veo3_1`, `veo3_1_lite`, `wan2_6`, `wan2_7`, `wan3_0`, `wan3_0_prime`, `grok_video`, `grok_video_v15`, `gemini_omni`, `gemini_omni_flash_1_1`, `flux_3_video`, `flux_3_video_edit`, `happy_horse_video`, `hf_mult_motion_control`, `hf_mult_replace_object`, `sam_3_video`, `ad_multiplier`, `clipify`, `video_background_remover`, `video_deflicker`, `video_upscale`, `bytedance_video_upscale`, `topaz_video` |
| 3d | `tripo_h3_1_image_to_3d`, `tripo_h3_1_multiview_to_3d`, `tripo_3d`, `image_to_3d`, `multi_image_to_3d`, `meshy_v7_image_to_3d`, `meshy_v6_text_to_3d`, `meshy_v5_remesh`, `meshy_v5_retexture`, `hunyuan3d_v3_image_to_3d`, `hunyuan3d_v3_1_text_to_3d`, `sam_3_3d`, `sam_3_3d_body`, `3d_rigging` |
| audio | `seed_audio`, `text2speech_v2`, `qwen_audio_tts`, `inworld_text_to_speech`; `sonilo_music` and `mirelo_text_to_audio` are reserved for Higgsfield's own game pipeline, so use kie for music and SFX |
| data / text | `speech2text`, `clip_transcriber`, `image_text_detection`, `brain_activity` |

**Workflows** (`higgsfield generate workflow <name> … --wait`, params from `higgsfield workflow get <name> --json`):
`reframe`, `dubbing`, `voice_change`, `draw_to_video`, `kling3_0_motion_control`, `image_decompose`, the
`cinematic_studio_*` family and the `marketing_studio_*` family. The wrapper only drives `generate create`. For a
workflow, run it with `--wait --json`, take `result_url` from the JSON, and `curl -fL -o <file> '<url>'`.

## Complete Command Reference (`higgsfield` 1.1.26)

Global flags on every command: `--json` (raw JSON output), `--no-color`, `-h/--help`. Aliases in parentheses.

### Account, auth, workspace
| Command | Flags / args |
|---|---|
| `account status` (`acc`) | Email, plan, credits |
| `account transactions` | `--size` (≤100, default 20), `--cursor` |
| `auth login` | `--port` (loopback callback port) |
| `auth logout` | Deletes the stored token |
| `auth token` | Prints the access token. **Never** echo it into logs, files or chat |
| `workspace list` / `status` / `set <id>` / `unset` (`ws`) | `set` **persists** for every later command on the machine |
| `version` | Build info |

### Generation
| Command | Flags / args |
|---|---|
| `generate create <model>` (`gen`) | `--<param> <value>`…; media flags `--image-references/--image`, `--video-references/--video`, `--audio-references/--audio`, `--start-image`, `--end-image` (path or UUID); `--wait`, `--wait-timeout <dur>`, `--wait-interval <dur>`. Without `--wait`: prints job IDs. With `--wait --json`: the finished job array |
| `generate cost <model>` \| `generate cost workflow <name>` | Same params and media flags. Creates nothing. Local paths are still uploaded |
| `generate get <job_id>` | One job |
| `generate list` | `--image` / `--video` / `--audio` / `--text`, `--size` (default 20) |
| `generate wait <job_id>` | `--timeout` (default 10m), `--interval` (default 3s), `-q/--quiet` |
| `generate workflow <name>` | `--<param> <value>`…; media flags accept paths or UUIDs; `--wait` |
| `model list` | `--image` / `--video` / `--audio` / `--text` |
| `model get <model>` | Params, enums, defaults, rules |
| `workflow list` / `workflow get <name>` | Workflow params |
| `preset list <type>` (`presets`) | Types `marketing-studio-v2`, `soul-v2`, `video-explainer`, `animation-action`; `--query`, `--type`, `--group`, `--category`, `--limit` (1–100), `--after` |
| `preset resolve video-explainer <preset_id>` | Style media input for explainer scenes |
| `voices list` / `voices get <id>` | `--size` (1–100), `--cursor`. Use `id` as `--voice_id`, type as `--voice_type` |

### Media
| Command | Flags / args |
|---|---|
| `upload create <file>` | Image, video, audio or document → `{ id, type, url }` |
| `upload list` | `--image` / `--video` / `--audio`, `--size`, `--cursor` |

### Characters
| Command | Flags / args |
|---|---|
| `soul-id create` | `--name` (required), `--soul-2` \| `--soul-cinematic`, `--image` (path or UUID, repeat 5–20). **Paid** training |
| `soul-id list` / `get <id>` / `wait <id>` | `list`: `--size`, `--soul-2`, `--soul-cinematic`; `wait`: `--timeout` (30m), `--interval` (10s), `-q` |

### Marketing (`marketing-studio` / `ms`, `product-photoshoot`, `marketplace-cards` / `cards`)
Not part of the game pipeline. Use them only when the user asks for marketing assets.
| Command | Key flags |
|---|---|
| `ms avatars list` / `create` | `create`: `--name` (required), `--image`, `--image-url`, `--pinned` |
| `ms products list` / `create` / `fetch` | `create`: `--title` (required), `--image` (repeat), `--description`; `fetch`: `--url`, `--wait`, `--timeout` |
| `ms webproducts list` / `create` / `fetch` | `--url`, `--title`, `--description`, `--wait` |
| `ms brand-kits list` / `get` / `fetch` (`bk`) | `fetch`: `--url` (required), `--wait`, `--timeout` |
| `ms ad-references list` / `get` / `create` | `create`: `--video-input` or `--job`, `--avatar`, `--product` |
| `ms ad-formats list` | `--type` |
| `ms hooks list`, `ms settings list` | `--search`, `--size`, `--cursor` |
| `ms dtc-ads generate` | `--prompt`, `--format-id` (required), `--brand-kit-id`, `--aspect-ratio`, `--avatar`, `--product`, `--media` (≤14), `--batch-size` (1–20), `--quality`, `--resolution`, `--cost-only`, `--from-file`, `--wait`, `--timeout` |
| `product-photoshoot create` | `--mode`, `--prompt` (required), `--image` (repeat), `--count` (1–10), `--aspect_ratio`, `--brand_context`, `--product_context`, `--enhance-only`, `--timeout`, `--interval` |
| `marketplace-cards create` | `--prompt` (required), `--scope main|product-images|aplus|full-set`, `--image`, `--asset`, `--category`, `--main-job`, `--product_url`, `--brand_context`, `--product_context`, `--visual_style`, `--enhance-only` |

### Websites (Higgsfield-hosted, **not** the Babylon Toolkit stack)
React 19 + TanStack Start on Cloudflare. Use these only when the user explicitly asks for a Higgsfield-hosted site.
A Babylon Toolkit game is built and served through `project-installer.md`.
| Command | Flags / args |
|---|---|
| `website categories` / `list` | |
| `website create` | `--type website|app|game` (required, **the user's choice**), `--category` (required), `--subdomain`, `--template` (`scroll-scrub` for website; `app-detail|preset|studio|custom` for app) |
| `website repo-access <id>` | Git clone URL, branch, scoped token |
| `website deploy <id>` | **Ships live.** User request only |
| `website publish <id>` | Lists on the community feed. User request only |
| `website rename <id>` | `--subdomain` (required). The old URL stops working |
| `website contest <id>` | `--url` (repeat 1–10). User request only |
| `website status <id>` | |
| `website db tables|schema|rows|query <id>` | Read-only: `--table`, `--sql`, `--filter col:op[:value]`, `--limit`, `--offset`, `--order-by`, `--order-dir` |
| `website secrets list|set|delete <id>` | `--name`; `set` reads a hidden prompt or `--value-stdin` |

## Hard Rules

1. **Local install, wrapper for every generation.** `node_modules/.bin/higgsfield` + `scripts/hf-generate.mjs`.
   Never write a result URL into game code, a scene, a material or a CSS file. Results live on Higgsfield's CDN
   and must be files in the project.
2. **Cost first.** Run `--cost` for every new model or setting, and log credits per asset in long-running loops.
   Check `account status` before a batch and state the total. On a free plan (10 credits) one 5 s Kling clip
   is 7.5 credits.
3. **Don't blindly retry.** If the wrapper exits `1` after `generate create` started, or the wait times out, the
   job may still be running: check `higgsfield generate list --json` / `generate get <id>` before submitting
   again.
4. **Sign-in is the user's**, and so is the choice of which workspace to bill when there is more than one.
   Everything else here you run yourself.
5. **Never run without an explicit user request:** `website deploy`, `website publish`, `website contest`,
   `website rename`, `website secrets set/delete`, `soul-id create`, or any marketing command.
6. **Never print** `auth token` output, or the contents of `~/.config/higgsfield/credentials.json`.

## Final Check

- [ ] The CLI is a local dev dependency, and `scripts/hf-generate.mjs` exists in the project.
- [ ] Signed in, with a workspace selected (`account status --json` works).
- [ ] I ran `--cost` first and chose the cheapest model that meets the bar.
- [ ] Every result was saved by the wrapper into the project. No CDN URL is referenced anywhere.
- [ ] Music and SFX came from kie, not Higgsfield.
- [ ] No deploy, publish, contest, secret, Soul training or marketing command ran without an explicit request.
