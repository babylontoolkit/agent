# Babylon Toolkit Image, Video And Sound MCP Servers

> **DEFAULT INSTALL RULE — READ FIRST:** Install the MCP package **locally in the
> project** (`npm install --save-dev @babylonjs-toolkit/kie@latest`) and reference
> `node_modules/.bin/kie-image-mcp` in `.mcp.json`. **NEVER install globally unless
> the user explicitly instructs it.** Any example elsewhere in this document (or in
> the npm package README) that shows the bare `kie-image-mcp` command is the
> global-install variant — do not use it by default.

**IMPORTANT. THIS DOCUMENT PROVIDES CRUCIAL MCP SERVER INSTRUCTIONS. ALWAYS READ THIS ENTIRE DOCUMENT TO THE END OF FILE**

* When asked to create or install `Babylon Toolkit MCP Servers` or `KIE MCP Servers` or `Image MCP Servers` or something like that, create or append to `.mcp.json` the following `KIE MCP Servers`:
```json
{
  "mcpServers": {
    "kie-image": {
      "command": "node_modules/.bin/kie-image-mcp",
      "args": ["image"]
    },
    "kie-video": {
      "command": "node_modules/.bin/kie-image-mcp",
      "args": ["video"]
    },
    "kie-google": {
      "command": "node_modules/.bin/kie-image-mcp",
      "args": ["google"]
    },
    "kie-sound": {
      "command": "node_modules/.bin/kie-image-mcp",
      "args": ["sound"]
    }
  }
}
```

IMPORTANT: **Always** install the local project node module package unless instructed to install globally.

## Default Node Package Installation (Local)

To install the default `kie-image-mcp` node module package in your project:
```
npm install --save-dev @babylonjs-toolkit/kie@latest
```

This is the **default** installation. It pairs with the `node_modules/.bin/kie-image-mcp` commands in the `.mcp.json` shown above — no changes needed.

**Note:** Do not create a duplicate `.vscode/mcp.json` file.

## Global Node Package Installation (Only When Explicitly Instructed)

To install the `kie-image-mcp` node module package `globally`:
```
npm install -g @babylonjs-toolkit/kie@latest
```

* If (and only if) using the globally installed version of the MCP Servers, update the `.mcp.json` to use the global commands. For example:
```json
{
  "mcpServers": {
    "kie-image": {
      "command": "kie-image-mcp",
      "args": ["image"]
    },
    "kie-video": {
      "command": "kie-image-mcp",
      "args": ["video"]
    },
    "kie-google": {
      "command": "kie-image-mcp",
      "args": ["google"]
    },
    "kie-sound": {
      "command": "kie-image-mcp",
      "args": ["sound"]
    }
  }
}
```
**Note:** Do not create a duplicate `.vscode/mcp.json` file.

## Environment Settings

Make sure to create or update an example `.env` file called `.env.example`:
```
# =========================
# Rename to .env to enable
# =========================
KIE_KEY=your-key-goes-here

# Required only for generate_sound kind=music. Use an HTTP(S) webhook you control.
# Can also be supplied per call as callback_url. Effects and speech do not need it.
# KIE_CALLBACK_URL=https://your-domain.com/api/kie-callback
```

# kie-image-mcp

Tiny, **zero-runtime-dependency** [MCP](https://modelcontextprotocol.io) servers for
[kie.ai](https://kie.ai) generation — **one npm package, four servers**, selected by a
subcommand:

| Subcommand | Server | Tool | Models |
|---|---|---|---|
| `image` (default) | kie-image | `generate_image` | Nano Banana 2, Imagen 4, Seedream, Flux-2, Qwen, … |
| `video` | kie-video | `generate_video` | Kling, Bytedance Seedance, Grok Imagine |
| `google` | kie-google | `generate_google_video` | Google Veo 3.1 (`veo3` / `veo3_fast` / `veo3_lite`) |
| `sound` | kie-sound | `generate_sound` | Suno effects/ambience/music, ElevenLabs speech |

Because MCP is an open protocol, the same package works from **Claude Code, GitHub
Copilot Chat (VS Code), Cursor, Windsurf, Zed**, and any other MCP client — one package,
every AI. Built with only Node built-ins (`fetch`, `fs`, `readline`), so it pulls no
transitive packages. Requires **Node 18+**.

The command takes one subcommand to pick the server (defaults to `image`):
```
kie-image-mcp image     # or: video | google | sound   (no arg = image)
```

## Get an API key
Set your kie.ai key as `KIE_KEY` (or `KIE_AI_API_KEY`), or put `KIE_KEY=...` in a `.env`
file in your working directory. See `.env.example`. All four servers share the one key.
Only `generate_sound` with `kind: music` needs the extra `KIE_CALLBACK_URL` setting.

## Configure (any MCP client)

Register one entry per server you want; the subcommand goes in `args`. `KIE_KEY` is read
from your environment or a `.env` file (add `"env": { "KIE_KEY": "..." }` to an entry to
set it inline).

> **Reminder:** the configs below use the default **local** install
> (`node_modules/.bin/kie-image-mcp`). Only substitute the bare `kie-image-mcp`
> command if the package was explicitly installed globally.

### MCP Configuration File
Add to your project `.mcp.json`:
```json
{
  "mcpServers": {
    "kie-image":  { "command": "node_modules/.bin/kie-image-mcp", "args": ["image"] },
    "kie-video":  { "command": "node_modules/.bin/kie-image-mcp", "args": ["video"] },
    "kie-google": { "command": "node_modules/.bin/kie-image-mcp", "args": ["google"] },
    "kie-sound":  { "command": "node_modules/.bin/kie-image-mcp", "args": ["sound"] }
  }
}
```
GUI-PATH fallback (global installs only) — use the absolute bin path from `which kie-image-mcp`:
```json
{ "mcpServers": { "kie-image": { "command": "/Users/you/.nvm/versions/node/v24.11.0/bin/kie-image-mcp", "args": ["image"] } } }
```

### Copilot / Cursor / Windsurf / Zed / Generic
Same shape under the client's `mcpServers` key, using the `node_modules/.bin/kie-image-mcp` command (or the bare `kie-image-mcp` command for global installs).

## Available image models

All models use the same `/api/v1/jobs/createTask` endpoint. Pass the exact slug as `model`.

### Google / Nano Banana

| Slug | Description |
|------|-------------|
| `nano-banana-2` | **Default.** Text-to-image, up to 14 reference images |
| `nano-banana-pro` | Pro image-to-image, up to 8 reference images |
| `google/nano-banana-edit` | Image editing with prompt + reference images |
| `google/imagen4-fast` | Google Imagen 4 Fast |
| `google/imagen4` | Google Imagen 4 |
| `google/imagen4-ultra` | Google Imagen 4 Ultra (highest quality) |

### Seedream (ByteDance)

| Slug | Description |
|------|-------------|
| `bytedance/seedream` | Seedream 3.0 |
| `bytedance/seedream-v4-text-to-image` | Seedream 4.0 |
| `seedream/4.5-text-to-image` | Seedream 4.5 |
| `seedream/5-lite-text-to-image` | Seedream 5.0 Lite |

### Flux-2

| Slug | Description |
|------|-------------|
| `flux-2/flex-text-to-image` | Flux-2 text-to-image |
| `flux-2/flex-image-to-image` | Flux-2 image-to-image |
| `flux-2/pro-text-to-image` | Flux-2 Pro text-to-image |
| `flux-2/pro-image-to-image` | Flux-2 Pro image-to-image (up to 8 reference images) |

### Other

| Slug | Description |
|------|-------------|
| `z-image` | Z-Image photorealistic |
| `grok-imagine/text-to-image` | Grok Imagine text-to-image |
| `grok-imagine/image-to-image` | Grok Imagine image-to-image |
| `qwen/text-to-image` | Qwen text-to-image |
| `qwen/image-to-image` | Qwen image-to-image |

> Some models have unique input parameters (e.g. `image_size`, `guidance_scale`)
> that are not exposed by this server — they will use model defaults.
> See [docs.kie.ai](https://docs.kie.ai/market/quickstart) for full schemas.

### Usage

Ask the assistant in plain language, e.g.:

> Use generate_image to make a daytime hero from `src/assets/PC1.webp` and
> `src/assets/hero-car.jpg`, save it to `src/assets/hero.jpg`.

Tool: `generate_image(prompt, out_path, reference_paths?, model?, aspect_ratio?, resolution?, output_format?)`.

| Param | Default | Notes |
|-------|---------|-------|
| `prompt` | required | Text description of the image to generate. |
| `out_path` | required | Where to save the image. |
| `reference_paths` | — | Local image files to use as references / edit from (up to 14). |
| `model` | `nano-banana-2` | See the image model list above. |
| `aspect_ratio` | `16:9` | e.g. `16:9` \| `1:1` \| `4:3` \| `9:16`. |
| `resolution` | `2K` | `1K` \| `2K` \| `4K`. |
| `output_format` | `jpg` | `jpg` \| `png`. |

## Available video models

### Kling

| Slug | Description |
|------|-------------|
| `kling-3.0/video` | **Default.** Multi-shot, std/pro/4K modes, 3–15 s, optional audio |
| `kling-2.6/text-to-video` | Kling 2.6 text-to-video (5 or 10 s) |
| `kling-2.6/image-to-video` | Kling 2.6 image-to-video (5 or 10 s) |
| `kling-2.5/turbo-text-to-video-pro` | Kling 2.5 Turbo text-to-video Pro |
| `kling-2.5/turbo-image-to-video-pro` | Kling 2.5 Turbo image-to-video Pro |
| `kling-v2.1/master-text-to-video` | Kling V2.1 Master text-to-video |
| `kling-v2.1/master-image-to-video` | Kling V2.1 Master image-to-video |

### Bytedance (Seedance)

| Slug | Description |
|------|-------------|
| `bytedance/seedance-2` | Seedance 2.0 — text/image-to-video, optional audio, 4–15 s, up to 1080p |
| `bytedance/seedance-2-fast` | Seedance 2.0 Fast — same as above, faster/cheaper |
| `bytedance/seedance-1.5-pro` | Seedance 1.5 Pro — 4/8/12 s durations, optional audio |
| `bytedance/v1-pro-text-to-video` | Bytedance V1 Pro text-to-video |
| `bytedance/v1-pro-image-to-video` | Bytedance V1 Pro image-to-video |
| `bytedance/v1-lite-text-to-video` | Bytedance V1 Lite text-to-video |
| `bytedance/v1-lite-image-to-video` | Bytedance V1 Lite image-to-video |

### Grok Imagine (Video)

| Slug | Description |
|------|-------------|
| `grok-imagine-video-1-5-preview` | Grok Imagine Video 1.5 Preview — 1–15 s, 480p/720p |

## Image-to-video behavior by model family

| Family | `image_paths[0]` | `image_paths[1]` |
|--------|-----------------|-----------------|
| Kling | first frame (`image_urls[0]`) | last frame (`image_urls[1]`) |
| Bytedance | `first_frame_url` | `last_frame_url` |
| Grok | `image_urls[0]` (first frame / reference) | — |

### Usage

Ask the assistant in plain language, e.g.:

> Use generate_video with model kling-3.0/video to animate `src/assets/hero.jpg` —
> slow cinematic push toward the car, headlights switching on. Save to `src/assets/hero.mp4`.

Tool: `generate_video(prompt, out_path, model?, image_paths?, aspect_ratio?, duration?, sound?, resolution?, mode?)`.

| Param | Default | Notes |
|-------|---------|-------|
| `prompt` | required | Text description of the video / motion. |
| `out_path` | required | Where to save the `.mp4`. |
| `model` | `kling-3.0/video` | See the video model list above. |
| `image_paths` | — | Local images for image-to-video. |
| `aspect_ratio` | `16:9` | `16:9` \| `9:16` \| `1:1`. |
| `duration` | `5` | Seconds. Valid range varies by model. |
| `sound` | `false` | Generate audio (Kling / Bytedance). |
| `resolution` | — | `480p` \| `720p` \| `1080p` (Bytedance / Grok). |
| `mode` | `pro` | `std` \| `pro` \| `4K` — Kling 3.0 only. |

## Available google video models

| Slug | Description |
|------|-------------|
| `veo3_fast` | **Default.** Good balance of quality and speed |
| `veo3` | Highest quality, most credits |
| `veo3_lite` | Fastest/cheapest; supports `REFERENCE_2_VIDEO` with up to 3 reference images |

> These are the **only** models compatible with this server's dedicated Veo 3.1 endpoint
> (`/api/v1/veo/generate`). For Kling, Bytedance, and Grok video models use `kie-video`.

### Usage

Ask the assistant in plain language, e.g.:

> Use generate_google_video to animate `src/assets/hero-car.jpg` — a slow cinematic
> dolly push toward the car as the headlights switch on. Save to `src/assets/hero.mp4`.

Tool: `generate_google_video(prompt, out_path, image_paths?, model?, aspect_ratio?, resolution?, duration?, generation_type?, watermark?, enable_translation?)`.

| Param | Default | Notes |
|-------|---------|-------|
| `prompt` | required | Text description of the video / motion. |
| `out_path` | required | Where to save the `.mp4`. |
| `model` | `veo3_fast` | See the google video model list above. |
| `image_paths` | — | Local images for image-to-video: 1 = animate around it, 2 = first + last frame, up to 3 = reference (veo3_lite only). |
| `aspect_ratio` | `16:9` | `16:9` \| `9:16` \| `Auto`. |
| `resolution` | `720p` | `720p` \| `1080p` \| `4k` (4k costs extra credits). |
| `duration` | `8` | `4` \| `6` \| `8` seconds. |
| `generation_type` | auto | `TEXT_2_VIDEO` \| `FIRST_AND_LAST_FRAMES_2_VIDEO` \| `REFERENCE_2_VIDEO`. |
| `watermark` | — | Text to burn into the video. |
| `enable_translation` | `true` | Translate prompt to English before generating. |

## Available sound models

The `sound` server exposes one tool, `generate_sound`, with three kinds. The `kind`
selects both the provider API and which extra parameters are legal — passing a parameter
that belongs to another kind is rejected before any paid task is submitted.

| `kind` | Default model | All models | API |
|---|---|---|---|
| `sound_effect` (default) | `V5` | `V5`, `V5_5` | Suno `/api/v1/generate/sounds` |
| `speech` | `elevenlabs/text-to-speech-multilingual-v2` | `elevenlabs/text-to-speech-multilingual-v2`, `elevenlabs/text-to-speech-turbo-2-5` | Market `/api/v1/jobs/createTask` |
| `music` | `V5` | `V4`, `V4_5`, `V4_5PLUS`, `V4_5ALL`, `V5`, `V5_5` | Suno `/api/v1/generate` |

> `out_path` **must end in `.mp3`** — the server downloads the provider's audio bytes
> and never transcodes. Parent directories are created; the file is only replaced on a
> successful download. The remote URLs expire, so always use the saved local file.

### Usage

Ask the assistant in plain language, e.g.:

> Use generate_sound to make loopable nighttime forest ambience and save it to
> `src/assets/audio/forest.mp3`.

Tool: `generate_sound(prompt, out_path, kind?, model?, callback_url?, track_index?, …kind-specific)`.

| Param (all kinds) | Default | Notes |
|-------|---------|-------|
| `prompt` | required | Effect description (max 500), exact spoken text (max 5000), or music description / lyrics. |
| `out_path` | required | Local `.mp3` path. |
| `kind` | `sound_effect` | `sound_effect` \| `speech` \| `music`. |
| `model` | per kind | Exact slug from the table above. |
| `callback_url` | — | HTTP(S) webhook you control. **Required for `music`** unless `KIE_CALLBACK_URL` is set; optional otherwise. |
| `track_index` | `0` | Zero-based variation to save; other track URLs are reported in the result. |

### Sound effects and ambience (`kind: sound_effect`)

| Param | Default | Notes |
|-------|---------|-------|
| `loop` | `false` | Request a loopable sound/ambience. A generation hint, not a guaranteed sample-perfect seam. |
| `tempo` | — | Integer BPM, 1–300. |
| `key` | — | Musical key: `C`…`B` or minor `Cm`…`Bm` (e.g. `F#`, `Am`, `D#m`). Omit for any key. |

```json
{
  "prompt": "Nighttime forest ambience with gentle wind, distant owls and soft crickets. No music or speech.",
  "out_path": "src/assets/audio/forest.mp3",
  "kind": "sound_effect",
  "loop": true
}
```

> The Sounds API has **no duration parameter** — `duration` is rejected for effects.
> [KIE Sounds API](https://docs.kie.ai/suno-api/generate-sounds)

### Speech (`kind: speech`)

| Param | Default | Notes |
|-------|---------|-------|
| `voice` | James (`EkK5I93UQWFDigLMpZcX`) | Supported ElevenLabs voice name or ID. |
| `stability` | model default | `0`–`1`. |
| `similarity_boost` | model default | `0`–`1`. |
| `speech_style` | model default | `0`–`1`. Maps to ElevenLabs numeric `style`; named separately from music's textual `style`. |
| `speed` | `1` | `0.7`–`1.2`. |
| `language_code` | — | Two-letter ISO 639-1 code. **Turbo 2.5 only.** |

```json
{
  "prompt": "Welcome back, pilot. Your ship is ready for launch.",
  "out_path": "src/assets/audio/welcome.mp3",
  "kind": "speech",
  "voice": "Rachel",
  "stability": 0.5,
  "speed": 1
}
```

[Multilingual v2](https://docs.kie.ai/market/elevenlabs/text-to-speech-multilingual-v2) ·
[Turbo 2.5](https://docs.kie.ai/market/elevenlabs/text-to-speech-turbo-2-5)

### Music (`kind: music`)

| Param | Default | Notes |
|-------|---------|-------|
| `instrumental` | `true` | `false` generates singing. |
| `custom_mode` | `false` | Exact lyrics/style mode. Requires `style` and `title`; the `prompt` becomes the lyrics. |
| `style` | — | Custom mode only. Max 200 for `V4`, 1000 otherwise. |
| `title` | — | Custom mode only, required, max 80. |
| `negative_tags` | — | Custom mode only: styles/traits to avoid. |
| `vocal_gender` | — | Custom mode only: `m` \| `f`; requires `instrumental: false`. |
| `duration` | — | Seconds, 10–360. **`V5_5` + `custom_mode: true` only.** |

**Music requires a callback URL.** KIE's Suno music schema requires `callBackUrl` even
though this server polls for the result. Supply `callback_url` per call or set
`KIE_CALLBACK_URL` in the environment / `.env` — it must be a webhook endpoint you
control. The stdio MCP server does **not** host a webhook listener, and the environment
default is applied only to music (never to effects or speech).

```json
{
  "prompt": "An orchestral exploration theme with warm strings, subtle percussion and a hopeful melody.",
  "out_path": "src/assets/audio/exploration.mp3",
  "kind": "music",
  "instrumental": true
}
```

Prompt limits: 3000 characters in simple mode; custom mode allows 3000 for `V4` and 5000
for the other models. [KIE Music API](https://docs.kie.ai/suno-api/generate-music)

### Sound output and limits

- Every call submits a **new paid task**; `track_index` picks an output of that new task.
  To fetch another variation of an existing result, use its reported URL — do not
  resubmit the same prompt.
- Waits for full completion, not streaming/first-track success. Speech polls every 6 s for
  up to 5 minutes; Suno polls every 30 s for up to 15 minutes. Individual HTTP requests
  and downloads time out after 60 s.
- Errors include the task ID so the paid remote job can be queried before retrying. The
  server never auto-resubmits, and a failed download does not overwrite the destination.
- No local transcoding, mixing or normalization. Voice cloning, audio isolation, music
  extension and WAV conversion are separate KIE APIs and are not parameters of this tool.

> **Restart your MCP client after adding the `kie-sound` server**, and keep a single MCP
> configuration location — do not create a duplicate `.vscode/mcp.json`.
