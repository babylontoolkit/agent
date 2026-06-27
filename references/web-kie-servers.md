# Babylon Toolkit Image And Video MCP Servers

**IMPORTANT. THIS DOCUMENT PROVIDES CRUCIAL MCP SERVER INSTRUCTIONS. ALWAYS READ THIS ENTIRE DOCUMENT TO THE END OF FILE**

* When asked to create or install `Babylon Toolkit MCP Servers` or `KIE MCP Servers` or `Image MCP Servers` or something like that, create or append to `.mcp.json` the following `KIE MCP Servers`: 
```
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
    }
  }
}
```

## Node Package Dependencies 

Make sure the `kie-image-mcp` node package is installed in your project:
```
npm install @babylonjs-toolkit/mcp@latest
```

* If using the globally installed version of the MCP Servers, update the `.mcp.json` to use the global commands. For example:
```
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
    }
  }
}
```

# kie-image-mcp

Tiny, **zero-runtime-dependency** [MCP](https://modelcontextprotocol.io) servers for
[kie.ai](https://kie.ai) generation — **one npm package, three servers**, selected by a
subcommand:

| Subcommand | Server | Tool | Models |
|---|---|---|---|
| `image` (default) | kie-image | `generate_image` | Nano Banana 2, Imagen 4, Seedream, Flux-2, Qwen, … |
| `video` | kie-video | `generate_video` | Kling, Bytedance Seedance, Grok Imagine |
| `google` | kie-google | `generate_google_video` | Google Veo 3.1 (`veo3` / `veo3_fast` / `veo3_lite`) |

Because MCP is an open protocol, the same package works from **Claude Code, GitHub
Copilot Chat (VS Code), Cursor, Windsurf, Zed**, and any other MCP client — one package,
every AI. Built with only Node built-ins (`fetch`, `fs`, `readline`), so it pulls no
transitive packages. Requires **Node 18+**.

The command takes one subcommand to pick the server (defaults to `image`):
```
kie-image-mcp image     # or: video | google   (no arg = image)
```

## Get an API key
Set your kie.ai key as `KIE_KEY` (or `KIE_AI_API_KEY`), or put `KIE_KEY=...` in a `.env`
file in your working directory. See `.env.example`. All three servers share the one key.

## Configure (any MCP client)

Register one entry per server you want; the subcommand goes in `args`. `KIE_KEY` is read
from your environment or a `.env` file (add `"env": { "KIE_KEY": "..." }` to an entry to
set it inline).

### Claude Code
Add to your project `.mcp.json` (or user `~/.claude.json`):
```json
{
  "mcpServers": {
    "kie-image":  { "command": "kie-image-mcp", "args": ["image"] },
    "kie-video":  { "command": "kie-image-mcp", "args": ["video"] },
    "kie-google": { "command": "kie-image-mcp", "args": ["google"] }
  }
}
```
GUI-PATH fallback — use the absolute bin path from `which kie-image-mcp`:
```json
{ "mcpServers": { "kie-image": { "command": "/Users/you/.nvm/versions/node/v24.11.0/bin/kie-image-mcp", "args": ["image"] } } }
```

### GitHub Copilot Chat (VS Code)
`.vscode/mcp.json`:
```json
{
  "servers": {
    "kie-image":  { "command": "kie-image-mcp", "args": ["image"] },
    "kie-video":  { "command": "kie-image-mcp", "args": ["video"] },
    "kie-google": { "command": "kie-image-mcp", "args": ["google"] }
  }
}
```

### Cursor / Windsurf / Zed / generic
Same shape under the client's `mcpServers` key, using the `kie-image-mcp` command.

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
| `reference_paths` | – | Local image files to use as references / edit from (up to 14). |
| `model` | `nano-banana-2` | See model list below. |
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
| `model` | `kling-3.0/video` | See model list below. |
| `image_paths` | – | Local images for image-to-video. |
| `aspect_ratio` | `16:9` | `16:9` \| `9:16` \| `1:1`. |
| `duration` | `5` | Seconds. Valid range varies by model. |
| `sound` | `false` | Generate audio (Kling / Bytedance). |
| `resolution` | – | `480p` \| `720p` \| `1080p` (Bytedance / Grok). |
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
| `model` | `veo3_fast` | See model list below. |
| `image_paths` | – | Local images for image-to-video: 1 = animate around it, 2 = first + last frame, up to 3 = reference (veo3_lite only). |
| `aspect_ratio` | `16:9` | `16:9` \| `9:16` \| `Auto`. |
| `resolution` | `720p` | `720p` \| `1080p` \| `4k` (4k costs extra credits). |
| `duration` | `8` | `4` \| `6` \| `8` seconds. |
| `generation_type` | auto | `TEXT_2_VIDEO` \| `FIRST_AND_LAST_FRAMES_2_VIDEO` \| `REFERENCE_2_VIDEO`. |
| `watermark` | – | Text to burn into the video. |
| `enable_translation` | `true` | Translate prompt to English before generating. |
