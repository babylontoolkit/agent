# Babylon Toolkit Higgsfield MCP Server

**IMPORTANT. THIS DOCUMENT PROVIDES CRUCIAL MCP SERVER INSTRUCTIONS. ALWAYS READ THIS ENTIRE DOCUMENT TO THE END OF FILE**

> **SPENDING RULE, READ FIRST:** Every Higgsfield generation spends the user's **credits**, which is real money.
> Always preflight with `get_cost: true` when the tool supports it. Pick the cheapest model that meets the
> quality bar. **Never** pass `use_unlim: true` unless the user explicitly asks. **Never** call
> `confirm_billing_purchase` or `confirm_trial_cancel`: they are widget-internal and charge or cancel real
> payments. On a transport timeout, **do not resubmit**. Check the returned job id first.

Higgsfield is a **remote, hosted** MCP server (Streamable HTTP, OAuth sign-in) that exposes **98 tools**:
image, video, speech and 3D generation, image/video post-processing, a hosted Blender scene builder,
a website/app/game host, TikTok publishing, and account/billing. It is an **alternative and complement** to the
project-local kie.ai servers in `web-kie-servers.md`.

## When To Use Higgsfield vs. kie.ai

| Need | Use | Why |
|---|---|---|
| Default image / texture / video generation in a Babylon Toolkit project | `web-kie-servers.md` (kie) | Project-local, key lives in the project `.env`, same setup for every contributor |
| User already has Higgsfield connected, or asks for Higgsfield | Higgsfield `generate_image` / `generate_video` | Same job, billed to their Higgsfield credits |
| **Image → 3D GLB mesh** (with optional PBR, rigging, animation clips) | Higgsfield `generate_3d` | kie has no 3D. Result is a GLB that goes straight into Unity or Blender |
| **Character → game sprite sheet** (idle/walk/run/attack/jump, isometric 8-dir) | Higgsfield `generate_image` with `model: "autosprite"` | Purpose-built sprite sheet + atlas output |
| Background removal, image/video upscale, outpaint, video reframe | Higgsfield `remove_background`, `upscale_*`, `outpaint_image`, `reframe` | Single-purpose tools, no prompt needed |
| **Music, sound effects, ambience** | kie `generate_sound` (`web-kie-servers.md`) | Higgsfield `generate_audio` is **speech only**. Its music/SFX models are reserved for its own game pipeline and must not be used standalone |
| Speech / voiceover / NPC dialogue | Either. Higgsfield `generate_audio` (`seed_audio`) or kie `generate_sound` | Higgsfield also clones voices (`create_voice*`) |
| Authoring 3D models and levels for a Babylon Toolkit game | Headless Blender (`unity-blender-cli.md`) and Unity (`unity-exporter-cli.md`) | Higgsfield's `scene_builder_3d_*` is a hosted Blender 5.2 useful for quick concept scenes. It is **not** the Toolkit pipeline and cannot produce interactive components |
| Hosting a Babylon Toolkit web game | The project installer flow (`project-installer.md`) | Higgsfield `create_website` hosts React 19 + TanStack Start on Cloudflare. It is not the Toolkit stack. Use it only when the user explicitly asks for a Higgsfield-hosted site |

## Install / Connect

Higgsfield is a **remote** server. There is no npm package to install.

**Claude Code** (user scope, so it works in every project):
```
claude mcp add --transport http --scope user higgsfield https://mcp.higgsfield.ai/mcp
```
Then run `/mcp` once in an interactive session and complete the Higgsfield OAuth sign-in in the browser.
Verify:
```
claude mcp get higgsfield
# higgsfield:
#   Scope: User config (available in all your projects)
#   Status: ✔ Connected
#   Type: http
#   URL: https://mcp.higgsfield.ai/mcp
```

**Project `.mcp.json`** (any MCP client that supports remote HTTP servers):
```json
{
  "mcpServers": {
    "higgsfield": {
      "type": "http",
      "url": "https://mcp.higgsfield.ai/mcp"
    }
  }
}
```
There is **no API key** and nothing goes in `.env`. Auth is per-user OAuth. Sign-in is a **legitimate stop**:
if the server reports it needs authentication, tell the user to authorize it via `/mcp` (Claude Code) or their
client's MCP settings. Never ask for tokens or callback URLs.

In Claude Code the tools are **deferred**: they appear by name only (`mcp__higgsfield__*`). Load their schemas
before calling them, e.g. `ToolSearch` with `select:mcp__higgsfield__generate_image,mcp__higgsfield__job_status`.

## Hard Rules

1. **Preflight cost.** `generate_image`, `generate_video`, `generate_audio`, `generate_3d`, `outpaint_image`,
   `reframe`, `upscale_image` and `shorts_studio_create` accept `get_cost: true`, which returns
   `{"cost":{"credits":N}}` and submits nothing. Batch tools do **not** support it: preflight one item with the
   single-shot tool first.
2. **Check the balance** with `balance` before a large run. A free plan starts with **10 credits**.
3. **`use_unlim`**: pass `false` explicitly for agent-driven work. If omitted and the user holds a free-trial
   unlimited allowance, the tool submits **nothing** and returns an `unlim_choice` question instead.
4. **`medias[].value` takes a `media_id` or a prior `job_id`, never an https URL.** Bring web files in with
   `media_import_url`. Bring local files in with `media_upload` → `curl -X PUT` → `media_confirm`. In a UI
   client, use `media_upload_widget`.
5. **Apply `adjustments`** the server returns (clamped durations, capped counts). If a response contains
   `recovery_tool`, call it immediately.
6. **Timeouts:** the submission outcome is unknown, so never blindly resubmit. Reuse returned job ids.
7. **Outward-facing tools need an explicit user request** (the asking rule, category 4): `tiktok_publish`,
   `deploy_website`, `publish_website`, `participate_in_contest`, `rename_website`, and `sync_agents`
   (which uploads the user's skills and a personality summary to Higgsfield).
8. **Billing tools:** only `show_plans_and_credits` and `cancel_trial_auto_renewal` (without `confirm`) are
   callable by the agent. `confirm_billing_purchase` and `confirm_trial_cancel` are **widget-only**. Never
   call them.
9. **Always download results into the project.** Result URLs are CloudFront links on Higgsfield's CDN.
   Never ship a hot-linked URL in a game build.

## Verified Test Run (2026-09-18)

A single cheap image generation, recorded end to end so you know the exact request and response shapes.

**1. Balance**
```json
// balance {}
{"credits":10,"subscription_plan_type":"free"}
```

**2. Cost preflight** (same prompt, `get_cost: true`, nothing submitted)

| Model | Params | Credits |
|---|---|---|
| `z_image` | default | **0.15** (cheapest) |
| `nano_banana` | default | 1 |
| `nano_banana_2_lite` | `thinking: "MINIMAL"` | 1 |
| `gpt_image_2_5` | `quality: "low"`, `resolution: "1k"` | 1 |

**3. Submit**
```json
// generate_image
{"params":{
  "model":"z_image",
  "prompt":"a small weathered wooden crate with iron corner brackets, stylized game prop, isolated on plain grey background, soft studio lighting",
  "aspect_ratio":"1:1",
  "use_unlim":false
}}
// → returns immediately, status pending
{"results":[{"id":"dac57f21-efbd-48a3-b039-04cd7e45afc6","type":"image","status":"pending","model":"z_image",
  "params":{"prompt":"…","aspect_ratio":"1:1"}}]}
```

**4. Poll** (`sync: true` makes the server wait up to ~25 s; this image finished within one call)
```json
// job_status {"jobId":"dac57f21-…","sync":true}
{"generation":{
  "id":"dac57f21-efbd-48a3-b039-04cd7e45afc6","type":"image","status":"completed","model":"z_image",
  "params":{"prompt":"…","aspect_ratio":"1:1","width":2048,"height":2048,"batch_size":1},
  "results":{
    "rawUrl":"https://d8j0ntlcm91z4.cloudfront.net/user_<id>/hf_20260919_043654_<jobId>.png",
    "minUrl":"https://d8j0ntlcm91z4.cloudfront.net/user_<id>/hf_20260919_043654_<jobId>_min.webp"
  },
  "createdAt":1789792614.26}}
```
The response is also preceded by a resource link to the PNG. `job_status` with `raw_data: true` returns the
backend payload instead: `result_url`, `min_result_url`, `h264_url` (video), `thumbnail_url`, `result_json`,
`job_set_type`, `display_name`.

**5. What came back**
- `rawUrl`: **2048×2048 RGB PNG, 5.8 MB**, a clean, well-lit crate on grey. It is usable as concept art or
  as an input to `generate_3d` or `remove_background`.
- `minUrl`: **2048×2048 WebP, 163 KB**, the same image compressed. Prefer this for UI and web delivery.
- Balance after: **9.85** credits (exactly 0.15 spent).

**6. Pull it into the project**
```
curl -fL -o src/assets/textures/crate_concept.png "<rawUrl>"
```

## Game-Asset Recipes

**Texture / concept image.** Use `generate_image`. `z_image` is the cheapest draft model (text-only, no reference
inputs). Use `gpt_image_2_5` (default general model, supports `background: "transparent"`), `nano_banana_2`
(supports `image_references` + `mask` inpaint), or `seedream_v4_5` for 4K. For seamless tiling textures, say
"seamless tileable" in the prompt and **verify** the tiling yourself (offset the image by half in the
Higgsfield sandbox or locally with ImageMagick). The model does not guarantee it.

**Prop / character → GLB.**
1. Generate or upload a clean, single-subject image on a plain background. `remove_background` helps.
2. `models_explore {"action":"list","type":"3d"}` → pick a model (`image_to_3d` general, `multi_image_to_3d`
   for 2–4 views, `sam_3_3d` single object with a disambiguating `prompt`, `3d_rigging` to rig an existing GLB).
3. `generate_3d {"params":{"model":"image_to_3d","medias":[{"role":"<from model roles>","value":"<image job_id>"}],"get_cost":true}}`,
   then submit without `get_cost`.
4. For animated rigs, find a clip with `animation_actions {"query":"walk"}` (678-clip library, each with a
   preview GIF) and pass `enable_animation: true` + `animation_action_id`.
5. Download the GLB → repair, retopologize, UV or LOD it in headless Blender (`unity-blender-cli.md`) → import into Unity
   and add interactive components there (`unity-exporter-cli.md`).

**2D sprite sheet.** `generate_image` with `model: "autosprite"`, one character image in `medias`
(`role: "image"`), `kind` (`idle|walk|run|attack|jump|custom|iso_<action>_<dir>`), `frame_count` (2–64,
default 25), `frame_size` (32–512, default 256), `video_tier` (`turbo` is cheapest).

**NPC voice lines.** `list_voices` → `generate_audio {"params":{"model":"seed_audio","prompt":"<line>","voice_type":"preset","voice_id":"<id>"}}`.
For many lines, use `generate_audio_batch` (≤12) → `jobs_wait` → download each result.

**Many assets at once.** `generate_image_batch` (1–12 requests, each `count: 1`, caller-supplied `index`) →
`jobs_wait` in groups of ≤12 (15 s long-poll, repeat until `all_terminal`) → download. `show_generation_by_ids`
only matters in UI clients.

## Image Model Catalog (from `models_explore`, 2026-09-18)

Costs are only listed where verified above. Preflight everything else.

| id | Name | Key params | Reference media roles | Aspect ratios |
|---|---|---|---|---|
| `z_image` | Z Image (fast, budget, stylized) | none | none (text-only) | 1:1 4:3 3:4 16:9 9:16 |
| `nano_banana` | Nano Banana | none | `image_references` | 1:1 3:2 2:3 4:3 3:4 4:5 5:4 9:16 16:9 21:9 |
| `nano_banana_2` | Nano Banana 2 | `resolution` 1k/2k/4k, `is_inpaint` | `image_references`, `mask` | + auto |
| `nano_banana_2_lite` | Nano Banana 2 Lite | `resolution` 1k, `thinking` MINIMAL/HIGH, `is_inpaint` | `image_references`, `mask` | + auto |
| `nano_banana_pro` | Nano Banana Pro | `resolution` 1k/2k/4k (default 2k) | `image_references` | 10 ratios |
| `gpt_image_2_5` | GPT Image 2.5 (**default general model**) | `variant` flare/sunburst, `quality` low…max, `resolution` 1k/2k/4k, `background` auto/opaque/transparent | `image_references` | 15 ratios incl. auto |
| `gpt_image_2` | GPT Image 2 | `resolution`, `quality` low/medium/high | `image` | 8 ratios |
| `openai_hazel` | OpenAI Hazel (best text rendering) | `quality` | `image_references` | 1:1 3:2 2:3 auto |
| `seedream_v4_5` | Seedream 4.5 (4K) | `quality` basic/high | `image_references` | 8 ratios |
| `seedream_v5_lite` / `seedream_v5_pro` | Seedream 5.0 | lite: `quality`; pro: `resolution`, `width`, `height`, `remove_bg`, `is_inpaint` | `image_references` | 6–8 ratios |
| `flux_2` | FLUX.2 | `resolution` 1k/2k, `variant` pro/flex/max | `image_references` | 5 ratios |
| `flux_kontext` | Flux Kontext (editing / style transfer) | none | `image_references` | 5 ratios |
| `flux_2_pro_outpaint` | FLUX.2 Pro Outpaint | `expand_top/bottom/left/right` (−8192…2048 px) | `image_references` | n/a |
| `kling_omni_image` | Kling O1 Image | `resolution` 1k/2k | `image_references` | 9 ratios |
| `grok_image` / `grok_image_2_0` | Grok Image | `resolution`, `mode` std/quality (or `quality` low/medium) | `image_references` | 10 ratios |
| `recraft_v4_1` | Recraft V4.1 (vector, icons, logos) | `resolution`, `model_type` standard/vector/utility/utility_vector, `colors[]`, `background_color` | none | 9 ratios |
| `cinematic_studio_2_5` | Cinema Studio Image 2.5 | `resolution` | `image` | 10 ratios |
| `soul_2` / `soul_v2` | Higgsfield Soul 2.0 (people, UGC) | `quality` 1.5k/2k, `soul_id` | `image` ×1 | 7 ratios |
| `soul_cinematic` | Soul Cinema | `quality`, `soul_id` | `image` ×1 | 8 ratios |
| `soul_cast` | Soul Cast (character identity) | `budget` 10–500 | none | 16:9 |
| `soul_location` | Soul Location (environments) | none | none | 9 ratios |
| `autosprite` | AutoSprite Animation (sprite sheets) | `kind`, `name`, `video_tier`, `frame_count`, `frame_size`, `remove_bg`, `with_sound`, `is_humanoid` | `image` ×1 (required) | n/a |
| `marketing_studio_image`, `ms_image` | Marketing / DTC ads | `ms_image` **requires** `style_id` | `image` | many |
| `image_auto` | Auto-routes by prompt | none | `image` | 5 ratios |
| `image_background_remover`, `outpaint`, `topaz_image`, `topaz_image_generative`, `bytedance_image_upscale` | Utility backends (prefer the dedicated tools) | see `models_explore get` | `image_references` | n/a |

Use `models_explore {"action":"get","model_id":"<id>"}` for exact constraints, `{"action":"list","type":"video"|"audio"|"3d"}`
for the other catalogs, and `{"action":"recommend","query":"…","type":"…"}` to have the server pick.

---

# Complete Tool Reference (98 tools)

Notation: **req** = required. `uuid` = standard UUID string. Many generation tools wrap their arguments in a single
`params` object. Those are shown as `params.<field>`. For `generate_image`, `generate_video`, `generate_audio`
and `generate_3d`, `params` may alternatively be a bare string, but always send the object form.
The `medias` item shape shared by generation tools is `{ role: string (req), value: string (req) }`, where
`value` is a `media_id` or `job_id` and role comes from the model's `medias[].roles`.

## 1. Core Generation

### `generate_image`
Generate one image request (1–4 variants of the **same** prompt). Default model `gpt_image_2_5`.
| Param | Type | Notes |
|---|---|---|
| `params.model` | string, **req** | Model id from the catalog |
| `params.prompt` | string | Text description |
| `params.aspect_ratio` | string | Must be one the model lists |
| `params.count` | integer 1–4, default 1 | Variants. Capped to 1 with `use_unlim` |
| `params.medias` | `[{role, value}]` | Reference inputs |
| `params.get_cost` | boolean | Preflight only, submits nothing |
| `params.use_unlim` | boolean | Pay with trial unlimited (true) or credits (false). Omit → may return `unlim_choice` |
| `params.*` | any | Model-specific params go top-level inside `params` (e.g. `quality`, `resolution`) |

### `generate_image_batch`
1–12 **independent** image jobs, no widget.
| Param | Type | Notes |
|---|---|---|
| `requests` | array 1–12, **req** | Items `{ index: int ≥0 (req), params (req) }` |
| `requests[].params` | object | Same as `generate_image` params except `count` const 1 and **no `get_cost`** |

### `generate_video`
Generate one video request (1–4 variants). Defaults: `seedance_2_5` general, `kling3_0` multi-shot/audio/motion,
`minimax_h3` 2K keyframes, `marketing_studio_video` ads. Genjutsu routes: `hf_mult_motion_control` (copy motion from a
driving video), `hf_mult_replace_object` (swap an object in a video). Both take images with role `image` + exactly one video with role `video`.
| Param | Type | Notes |
|---|---|---|
| `params.model` | string, **req** | |
| `params.prompt` | string | Optional for Marketing Studio |
| `params.aspect_ratio` | string | `16:9` landscape, `9:16` vertical. Or pass `width`/`height` |
| `params.duration` | integer | Seconds. Unsupported values clamp to the nearest allowed |
| `params.count` | integer 1–4, default 1 | |
| `params.medias` | `[{role, value}]` | |
| `params.preset_id` | string | From `presets_show`. Only with `model: "higgsfield_preset"` |
| `params.declined_preset_id` | string | Suppress a declined preset recommendation |
| `params.get_cost` | boolean | |
| `params.use_unlim` | boolean | |

### `generate_video_batch`
1–12 independent video jobs. `requests[]: { index (req), params (req) }`. Params match `generate_video`, with
`count` const 1 and no `get_cost`.

### `generate_audio`
One **speech** request. Default model `seed_audio`. Alternative: `text2speech_v2` + `variant`
(`elevenlabs|minimax|seed_speech|vibe_voice|cozy_voice`). **No standalone music or SFX.**
| Param | Type | Notes |
|---|---|---|
| `params.model` | string, **req** | |
| `params.prompt` | string, **req**, min 1 | The text to speak |
| `params.voice_type` | `preset` \| `element` | |
| `params.voice_id` | string | From `list_voices` |
| `params.voice` | string | `inworld_text_to_speech` only (game pipeline) |
| `params.duration` | number > 0 | Only for the game-pipeline music/SFX models. Omit for TTS |
| `params.count` | const 1 | |
| `params.medias` | `[{role, value}]` | e.g. `audio_references` for cloning, `image_references` cue |
| `params.get_cost` | boolean | |
| `params.use_unlim` | boolean | |
| `params.*` | any | seed_audio tuning: `format`, `sample_rate`, `speech_rate`, `loudness_rate`, `pitch_rate` |

### `generate_audio_batch`
1–12 independent audio jobs. `requests[]: { index (req), params (req) }`. Params match `generate_audio`, with
`count` const 1 and no `get_cost`.

### `generate_3d`
Generate a **GLB** mesh. Models: `image_to_3d`, `multi_image_to_3d`, `sam_3_3d`, `3d_rigging` (takes a prior 3D
`job_id` or https GLB URL as `model_url`).
| Param | Type | Notes |
|---|---|---|
| `params.model` | string, **req** | `models_explore(type:'3d')` |
| `params.medias` | `[{role, value}]` | Roles per model |
| `params.prompt` | string | Only `sam_3_3d` uses it |
| `params.count` | integer 1–4, default 1 | |
| `params.get_cost` | boolean | |
| `params.*` | any | e.g. `enable_animation`, `animation_action_id`, texturing/PBR/rig flags per model |

### `animation_actions`
Read-only catalog of 678 rig animation clips for `generate_3d` with `enable_animation`.
| Param | Type | Notes |
|---|---|---|
| `query` | string | e.g. `walk`, `backflip`, `sword attack` |
| `group` | string | `WalkAndRun`, `BodyMovements`, `DailyActions`, `Dancing`, `Fighting` |
| `category` | string | e.g. `Walking`, `Running`, `Idle`, `Punching` |
| `limit` | integer 1–100, default 20 | |
| `after` | string | Pagination token |

### `models_explore`
Discover models and constraints.
| Param | Type | Notes |
|---|---|---|
| `action` | `list` \| `search` \| `get` \| `recommend`, **req** | |
| `type` | `image` \| `video` \| `audio` \| `3d` | Output filter |
| `input` | `text` \| `image` | Text-only vs accepts reference media |
| `query` | string | For search/recommend |
| `model_id` | string | Required for `get` |
| `limit` | integer 1–100 | Default 20 (list/search), 5 (recommend) |
| `after` | string | Pagination |
| `unlim` | boolean | Only models that accept trial unlimited |

### `presets_show`
No params. Lists image-to-video presets (ids, names, previews) for `model: "higgsfield_preset"`.

## 2. Jobs and Results

### `job_status`
| Param | Type | Notes |
|---|---|---|
| `jobId` | uuid, **req** | |
| `sync` | boolean, default false | Server polls up to ~25 s |
| `raw_data` | boolean | Raw backend payload |
| `source` | const `widget` | Widget-internal. Do not set |

Typical times: image ~10–20 s, video ~60–180 s. Non-terminal responses include `poll_after_seconds`.

### `jobs_wait`
Long-poll 1–12 jobs together.
| Param | Type | Notes |
|---|---|---|
| `jobs` | `[{index: int (req), job_id: uuid (req)}]` 1–12, **req** | |
| `timeout_seconds` | integer 0–15, default 15 | 0 = snapshot |

### `job_display`
`id` (uuid, **req**). Shows one job in the single-result widget.

### `show_generation_by_ids`
`jobs` (`[{index, job_id}]` 1–60, **req**). Shows a completed batch in the gallery widget.

### `show_generations`
Browse regular generation history. `cursor` (number or numeric string), `size` (1–100, default 24), `type` (`image|video|audio|3d`).

### `reveal_generation`
`jobId` (uuid, **req**). Flips an `ip_detected` Seedance-family job to `completed` after the user confirms rights. Only call it after explicit user confirmation.

## 3. Media Input

### `media_upload`
Presigned upload URLs. Media extensions become generation inputs. Other whitelisted files (pdf, zip, code…) return a permanent URL.
| Param | Type | Notes |
|---|---|---|
| `filename` | string | Single file |
| `content_type` | string | MIME. Inferred when omitted |
| `files` | `[{filename (req), content_type}]` 1–20 | Batch |
| `method` | const `upload_url` | Only method |

Flow: `media_upload` → `curl -f -X PUT --upload-file <file> '<upload_url>'` → `media_confirm` (only after HTTP 200).

### `media_confirm`
| Param | Type | Notes |
|---|---|---|
| `type` | `image` \| `video` \| `audio` \| `file`, **req** | |
| `media_id` | string | Single |
| `media_ids` | string[] 1–20 | Batch |

### `media_import_url`
`url` (string, **req**, https, ≤50 MB), `type` (`auto|image|video|audio`). Returns a confirmed `media_id`.

### `media_upload_widget`
UI-client upload surface for the user's local media. `type` (`auto|image|video|audio`), `multiple` (boolean), `min_files`, `max_files` (1–20), `label` (string).
In Claude Code, prefer `media_upload` + `curl` for files already on disk.

### `show_medias`
List uploads. `type` (`image|video|audio`, default image), `size` (1–100, default 24), `cursor` (number).

## 4. Image and Video Post-Processing

### `remove_background`
`params` (**req**): `media_id` (uuid, **req**), `media_type` (`image|video`, **req**).

### `upscale_image`
`params` (**req**): `image_id` (uuid, **req**), `width` (int ≥1, **req**, source px), `height` (int ≥1, **req**), `resolution` (`2k|4k`, default 4k), `provider` (`bytedance`, default), `get_cost` (boolean).

### `upscale_video`
`params` (**req**) is one of:
- **bytedance**: `provider: "bytedance"` (**req**), `video_id` (**req**), `width` (**req**), `height` (**req**), `resolution` (`1080p|2k|4k`, default 2k), `preset` (`common|aigc|short_series|ugc|old_film`), `fps` (24|30|60, >30 doubles cost).
- **topaz**: `provider: "topaz"` (**req**), `video_id` (**req**), `resolution` (`1080p|2160p`), `aspect_ratio` (`auto|21:9|16:9|4:3|1:1|3:4|9:16`).

No `get_cost`.

### `outpaint_image`
`params` (**req**): `image_id` (uuid, **req**), `aspect_ratio` (`auto|1:1|3:2|2:3|4:3|3:4|4:5|5:4|9:16|16:9|21:9`, default 21:9), `width` + `height` (set both or neither), `get_cost`.

### `reframe`
Video to a new aspect ratio. `params` (**req**):
| Field | Notes |
|---|---|
| `aspect_ratio` | `16:9|9:16|4:3|3:4|1:1|21:9`. Required unless `get_cost` |
| `medias` | 1–4 items: exactly one `{role:"video"}`, optional one `{role:"start_image"}`, optional 1–2 `{role:"image"}` |
| `duration_seconds` | ≤60. Required with `resolution` when the source is >15 s |
| `resolution` | `480p|720p|1080p`. Required for `get_cost` |
| `get_cost` | boolean |

### `motion_control`
Legacy Kling 3.0 motion transfer. `params` (**req**): `image_id` (**req**), `motion_video_id` (**req**), `resolution` (`720p|1080p`, default 720p), `scene_control` (`image|video`, default image).
Prefer `generate_video` with `hf_mult_motion_control`.

### `dubbing`
`params` (**req**): `video_id` (uuid, **req**), `target_language` (**req**): `eng|cmn|fra|hin|ita|jpn|kor|por|rus|tur|spa|deu|ara|pol|ind|fil|swe|fin`.

### `voice_change`
`params` (**req**): `video_id` (**req**), `voice_id` (string, **req**), `voice_type` (`preset|element`, default preset).

## 5. Voices

### `list_voices`
`size` (1–100, default 20), `cursor` (string). Returns `voice_id` + `voice_type` + `preview_url`.

### `create_voice`
Opens the Create Voice widget (UI clients). `initial_tab` (`record|upload`), `name` (≤128).

### `create_voice_from_confirmed_audio`
`audio_media_id` (uuid, **req**, confirmed `type='audio'`), `name` (1–128, **req**), `description`. Charges the clone cost.
The clone is usable only when `status='completed'` and `is_audio_eligible=true`. Re-check with `list_voices`.

## 6. Characters, Elements and Workflows

### `show_characters`
Soul Characters (trained identities, usable only with `soul_2` / `soul_cinematic`).
| Param | Type | Notes |
|---|---|---|
| `action` | string | `list`, `train`/`create`, `status`/`get` |
| `name` | string | Required for train |
| `images` | string[] | media_ids / image job ids / https URLs (5–20 total with `medias`) |
| `medias` | `[{role: const "image", value (req)}]` | |
| `soul_id` | string | For status |
| `status` | `ready|training|failed` | List filter |
| `type` | `soul|soul_2|soul_cinematic`, default soul_2 | |
| `size` | 1–100, default 20 | |
| `cursor` | number | |

### `show_reference_elements`
Reusable characters/environments/props. Use them in prompts as `<<<element_id>>>` placeholders (multiple allowed).
| Param | Type | Notes |
|---|---|---|
| `action` | `list|get|create` | |
| `element_id` | uuid | For get |
| `medias` | `[{id (req), url (req, https), type: media_input|image_job}]` | For create |
| `category` | `auto|character|environment|prop`, default auto | |
| `name` | ≤32 chars | |
| `description` | string | |
| `size` | 1–100, default 27 | |
| `cursor` | number | |

Supported image models include `nano_banana_pro`, `nano_banana_2`, `gpt_image_2`, `seedream_v4_5`, `seedream_v5_lite`, `cinematic_studio_2_5`.

### `get_workflow_instructions`
`workflow` (string, min 1). Omit it to list all bundled workflows. Load the matching workflow **before** multi-step made-to-brief
video (explainer, ad, UGC, podcast), character sheets (`character-sheet`), branding (`brand-asset-creation`), ad
multiplication (`ad-multiplier`), or website work (`website-builder-flow`).

### `get_workflow_bundle_file`
`workflow` (**req**), `path` (**req**, whitelisted path inside the workflow folder), `include_contents` (boolean, for directories).

### `get_explainer_presets`
No params. Explainer video style presets.

### `resolve_explainer_preset`
`preset_id` (uuid, **req**). Imports the style image and returns a `media_id` to use as the style reference in every scene.

## 7. Hosted Blender Scene Builder (3D Jutsu)

A hosted **Blender 5.2** worker. Use it for quick concept scenes; the Toolkit pipeline stays in local Blender + Unity.
Engines: `BLENDER_EEVEE`, `BLENDER_WORKBENCH`, `CYCLES` (not `BLENDER_EEVEE_NEXT`). Coordinates: editor/glTF Y-up, bpy Z-up.
Mutations are guarded by the exact `revision` + `expectedSceneSequence` you inspected. Finish every edit task with `scene_builder_3d_show_scene`.
Shared fields: `projectId` (uuid), `operationId` (string `^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`, reuse only for an identical retry),
`revision` (int ≥0), `waitSeconds`.

| Tool | Params |
|---|---|
| `scene_builder_3d_list_projects` | `limit` (1–50, default 24), `cursor` (numeric string) |
| `scene_builder_3d_create_project` | `name` (1–255, **req**). Not idempotent |
| `scene_builder_3d_get_project` | `projectId` (**req**) |
| `scene_builder_3d_query_python` | `projectId`, `operationId`, `code` (**all req**), `waitSeconds` (0–8, default 8). Read-only. Assign findings to `result`. Publish renders via `artifacts.file(name, media_type)` → write `target.path` → `target.publish()` |
| `scene_builder_3d_run_python` | `projectId`, `operationId`, `code`, `revision`, `expectedSceneSequence` (**all req**), `waitSeconds` (0–8). Commits one edit. Code ≤256 KiB. ≤8 PNG/JPEG/MP4 artifacts |
| `scene_builder_3d_get_operation` | `projectId`, `operationId` (**req**), `waitSeconds` (0–30, default 20). Terminal: `succeeded|failed|timed_out|expired` |
| `scene_builder_3d_search_assets` | `projectId` (**req**), `search` (≤128), `limit` (1–100, default 100) |
| `scene_builder_3d_import_asset` | `projectId`, `operationId`, `assetId` (**req**), `catalogSearch` (copy from search `importArguments`), `name`, `transform {position[3], rotation[4] XYZW, scale[3]}`, `waitSeconds` (0–8) |
| `scene_builder_3d_get_artifact` | `projectId`, `artifactId` (32 hex) (**req**), `operationId`, `revision` |
| `scene_builder_3d_get_glb` | `projectId` (**req**), `revision`. Short-lived GLB download |
| `scene_builder_3d_get_blend` | `projectId` (**req**), `revision`. Short-lived .blend download |
| `scene_builder_3d_show_scene` | `projectId` (**req**), `revision`. Interactive preview widget / `projectUrl` |

## 8. Remote Sandbox

### `sandbox_exec`
A remote Higgsfield Linux sandbox, **not** the local machine. Preinstalled: ffmpeg/ffprobe, ImageMagick, sox, python3 + Pillow +
faster-whisper, node/npm, sharp-cli, Playwright + Chromium, git, curl, jq. Discarded ~10 s after each call, so chain steps with `&&`.
| Param | Type | Notes |
|---|---|---|
| `command` | string 1–16000, **req** | bash, runs in `/home/user` |
| `timeout_seconds` | 1–120, default 60 | Ignored with background |
| `background` | boolean | Returns pid/log/status paths. 15-min lease |
| `restart` | boolean | Fresh sandbox |

To keep an output, call `media_upload` first and append `curl -f -X PUT --upload-file <f> '<upload_url>'` to the **same** command.
For local processing in a Babylon Toolkit project, prefer the local shell.

## 9. Websites, Apps and Games (Higgsfield-hosted)

React 19 + TanStack Start on one Cloudflare Worker (D1/R2/KV/DO/Containers off by default). **Not** the Babylon Toolkit stack.
Load `get_workflow_instructions {"workflow":"website-builder-flow"}` first.

| Tool | Params |
|---|---|
| `list_website_categories` | none |
| `create_website` | `type` (`website|app|game`, **req**, the user's choice), `category` (slug, **req**), `subdomain` (DNS-safe), `template` (`app-detail|preset|studio|custom|scroll-scrub`. Required for `app`, optional `scroll-scrub` for `website`, none for `game`) |
| `list_websites` | none |
| `website_repo_access` | `website_id` (**req**), `operation` (`checkout|push`, default checkout) |
| `deploy_website` | `website_id` (**req**). **Ships live** |
| `website_status` | `website_id` (**req**) |
| `publish_website` | `website_id` (**req**). Lists on the community feed. Needs filled `app/src/app-meta.json` |
| `rename_website` | `website_id`, `new_slug` (1–64) (**req**). The old URL stops working |
| `website_db` | `website_id`, `operation` (`tables|schema|rows|query`) (**req**), `table`, `sql` (SELECT/WITH only), `filters` (`col:op[:value]`), `order_by`, `order_dir`, `limit`, `offset`. Read-only |
| `website_secrets` | `website_id` (**req**). Names only |
| `participate_in_contest` | `website_id` (**req**), `urls` (1–10 YouTube/X/Instagram/TikTok links, **req**) |

## 10. Marketplace Apps

| Tool | Params |
|---|---|
| `apps_search` | `query`, `limit` (1–100, default 20), `cursor` |
| `apps_describe` | `app_id` (**req**), `action`. Returns the schema + `manifest_revision` |
| `apps_invoke` | `app_id`, `action`, `manifest_revision` (**req**), `arguments` (object, pass media as `media_id`) |

## 11. Marketing Studio and Shorts

| Tool | Params |
|---|---|
| `show_marketing_studio_v2` | `category` (`all|ugc|product-shot|motion|ads|posters|marketplace`). Opens the widget |
| `show_marketing_studio_generations` | `cursor` (number), `size` (1–100, default 24) |
| `marketing_studio_v2_presets` | *widget-internal*. `category` (**req**), `cursor`, `size` |
| `marketing_studio_v2_avatars` | *widget-internal*. `preset_cursor`, `user_cursor`, `size` |
| `marketing_studio_v2_costs` | *widget-internal*. None |
| `marketing_studio_v2_create` | *widget-internal*. `preset_id` (**req**), `preset_type` (**req**: `ugc|product_shots_people|product_shots|2d_motion|hypermotion|mixed_media|saas_motion|poster|ads|marketplace`), `aspect_ratio`, `avatar {id, type: preset|custom}`, `avatar_media_id`, `product_media_id`, `brand_url`, `category_slug`, `duration`, `format_name`, `format_slug`, `group_name`, `preset_name`, `prompt` (≤5000), `required_inputs` |
| `marketing_studio_v2_status` | *widget-internal*. `job_ids` (uuid[] 1–8, **req**) |
| `shorts_studio_list_presets` | `cursor` |
| `shorts_studio_create_preset` | `name` (1–255, **req**), `prompt`, `thumbnail`, `image_medias[]` / `video_medias[]` (`{url (req, https), type, width, height, duration ≤30}`), ≤10 media total. Free |
| `shorts_studio_create` | **Paid.** `preset_id`, `preset_source` (`cms|user`), `source_video_id` (required unless `get_cost`), `aspect_ratio` (`9:16|16:9`), `resolution` (const `720p`), `duration_seconds` (≤120, required for `get_cost`), `get_cost` |
| `shorts_studio_list_sessions` | `cursor` (number), `size` (1–50) |
| `shorts_studio_status` | `session_id` (uuid, **req**) |

## 12. Video Analysis

| Tool | Params |
|---|---|
| `video_analysis_create` | Exactly one of `video_input_id` (uuid) or `youtube_url` (youtube.com / youtu.be). ~3–5 min |
| `video_analysis_status` | `video_analyze_id` (uuid, **req**). Poll every 30–60 s |
| `video_analysis_jobs` | `cursor` (number \| null), `size` (1–100) |
| `virality_predictor` | `action` (`create|preview`, **req**), `params` (**req**): `model` (const `virality_predictor`, **req**), `medias` (`[{role: "video", id: uuid}]`, for create), `job_id` (for preview) |

## 13. TikTok Publishing (outward-facing, explicit user request only)

| Tool | Params |
|---|---|
| `tiktok_accounts` | none. Returns `connector_id` + status |
| `tiktok_connect` | `name` (1–64, second account only). Returns `authorize_url` |
| `tiktok_reconnect` | `connector_id` (**req**) |
| `tiktok_music_trending` | `connector_id` (**req**), `country_code`, `date_range` (`1DAY|7DAY|30DAY|90DAY`), `genre`, `limit` (1–100), `offset` |
| `tiktok_music_tune` | `connector_id`, `music_sound_id` (**req**), `country_code`, `date_range`, `genre` |
| `tiktok_prepare_publish` | `connector_id`, `mode` (`DIRECT_POST|UPLOAD_TO_DRAFT`), `media_type` (`VIDEO|PHOTO`) (**req**), `video_url` / `photo_images[]` (Higgsfield-hosted, ≤35), `title` (≤150), `description` (≤4000), `privacy_level`, `allow_comment`, `allow_duet`, `allow_stitch`, `is_aigc`, `commercial_content_disclosure {enabled, your_brand, branded_content}`, `photo_cover_index` |
| `tiktok_publish` | `connector_id`, `publish_session_id`, `mode`, `media_type`, `user_confirmed`, `preview_confirmed` (**req**), plus `privacy_level`, `title`, `description`, `is_aigc`, `allow_*`, `auto_add_music`, `music_sound_id`, `music_sound_start/end` (ms), `music_sound_volume`, `video_original_sound_volume` (0–100), and the `*_selected_by_user` / `*_confirmed` / `processing_notice_acknowledged` consent flags. Quota 5/min, 13/24 h |
| `tiktok_publish_status` | `connector_id`, `publish_id` (**req**) |

Photos must be JPEG/WebP (Higgsfield emits PNG, so convert first), ≤20 MB, within 1920×1080. Videos MP4/WebM/MOV, 3–600 s, ≥360 px, 23–60 fps.

## 14. Account, Workspace and Billing

| Tool | Params | Agent may call? |
|---|---|---|
| `balance` | none. Returns `{credits, subscription_plan_type}` | Yes |
| `transactions` | `size` (1–100, default 10), `cursor` | Yes |
| `list_workspaces` | none. `is_selected` marks the active one | Yes |
| `select_workspace` | `workspace_id` or `clear: true`. **Persists** across sessions and changes which workspace is billed | Only on user request |
| `show_plans_and_credits` | `intent` (`upgrade|topup|auto_refill|trial|general`, default general). Relay the response verbatim | Yes, when the user is out of credits or asks |
| `cancel_trial_auto_renewal` | `confirm` (boolean, default false). Call without `confirm` first. `true` only after explicit user confirmation | On user request |
| `confirm_billing_purchase` | `action` (`upgrade_plan|auto_topup|topup`, **req**), `plan_id`, `billing_period`, `topup_id`, `enabled`, `top_up_amount_cents` | **NEVER.** Widget-only, charges a saved card |
| `confirm_trial_cancel` | none | **NEVER.** Widget-only |
| `sync_agents` | `message` (**req**: `/sync-agents` or the script summary JSON), `host` (**req**: `claude_ai|claude_code|codex|cursor|windsurf|hermes|openclaw|other`) | Only on explicit request. It uploads the user's skills and a personality summary |

## Final Check

- [ ] I preflighted cost (`get_cost: true`) and chose the cheapest model that meets the quality bar.
- [ ] I passed `use_unlim: false` unless the user explicitly asked to spend unlimited generations.
- [ ] Reference inputs are `media_id` / `job_id` values, never raw URLs.
- [ ] I downloaded every result into the project. Nothing hot-links the Higgsfield CDN.
- [ ] Music and SFX came from kie (`web-kie-servers.md`), not Higgsfield.
- [ ] I did not call a billing-confirm tool, publish, deploy, or sync without an explicit user request.
