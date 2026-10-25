# Babylon Toolkit Hi3D API

**IMPORTANT. THIS DOCUMENT PROVIDES CRUCIAL HI3D INSTRUCTIONS. ALWAYS READ THIS ENTIRE DOCUMENT TO THE END OF FILE**

## What Hi3D Is, And When To Use It

Hi3D (https://www.hi3d.ai, formerly Hitem3D, by Math Magic) turns images into 3D models with its own Sparc3D and
Ultra3D models. It is known for high structural fidelity, geometric accuracy and texture consistency. It is a
**mesh generator only**: image → 3D model, image → 3D relief, mesh → split parts, and mesh → multicolor. It does not
make images, video or audio, and it has no text-to-3D.

| Need | Use |
|---|---|
| **Image → 3D mesh** (single image or multi-view, textured, PBR) **and the project has `HI3D_ACCESS_KEY` + `HI3D_SECRET_KEY`** | **Hi3D**, this document. It is the preferred mesh generator whenever its keys are set |
| Image → 3D mesh without a Hi3D key, or a **rigged / animated** mesh | Higgsfield (`web-higgsfield-cli.md`: the API's `tripo3d/h3.1/*` with `HIGGSFIELD_API_KEY`, else the CLI) |
| Text → 3D | First generate a clean reference image (kie `web-kie-servers.md`, or Higgsfield), then Hi3D image → 3D |
| A model split into separate parts (character limbs and head, or a general prop) | Hi3D `split` |
| Images, textures, video, music, SFX, speech | kie (`web-kie-servers.md`) or Higgsfield, never Hi3D |
| Authoring, repairing, retopo, rigging, LODs | Headless Blender (`unity-blender-cli.md`) |

You drive Hi3D yourself through `hi3d-api.mjs`, exactly like the Unity CLI (`unity-exporter-cli.md`) and headless
Blender (`unity-blender-cli.md`). The script is the **only** supported way to use Hi3D in a Babylon Toolkit project.
Hi3D also runs an MCP server (`https://mcp.hitem3d.ai/mcp`). **Do not use it**: it returns one-hour CDN URLs rather
than project files, and it has no price check.

## Credentials

The API key is an **AK/SK pair**: an access key (the client id) plus a secret key (the client secret), created on
the Hi3D Open Platform's **API Key** page. It is the same account as the Hi3D web app. Put both halves in the
project's `.env`:

```
HI3D_ACCESS_KEY=<access key>
HI3D_SECRET_KEY=<secret key>
```

- Also accepted: one variable, `HI3D_API_KEY="<access key>:<secret key>"` (or that pair already Base64-encoded,
  the value Hi3D's MCP docs put after `Basic `). When both forms are set, the AK/SK pair wins.
- The script reads the environment first, then the nearest `.env` from the current folder upward. Empty values
  count as unset.
- **Read the keys' shape, never their values.** To check them, print only whether each is set and its length.
  Never echo them, log them, or write them into a file other than `.env`. The script never prints the keys or
  the token.
- The console shows a new key **once**. A key works only while its status is **Enabled**. There can be at most 10 per
  account.
- Calls need a **resource package** (credits) on the account. A trial package exists for testing. With no credits,
  a submission fails with `30010000 balance is not enough`. Buying a package is the user's step: **never buy or
  top up credits yourself.**
- When the keys are not set, say so and use Higgsfield for the mesh instead (`web-higgsfield-cli.md`). Do not ask the
  user to sign in anywhere: Hi3D has no browser sign-in path for agents.

> **SPENDING RULE:** Every Hi3D task spends the user's credits (1 credit = $0.02). Always run `--estimate` first: it
> prices the exact fields from Hi3D's published price table and reads the live balance, and it submits nothing.
> Pick the cheapest model and resolution that meet the quality bar. For batches, state the total before submitting.
> Failed tasks are refunded.

## How The API Works

**Base URL:** `https://api.hitem3d.ai`. Docs: https://docs.hi3d.ai/en/api/getting-started/quickstart.

1. **Token.** `POST /open-api/v1/auth/token` with `Authorization: Basic base64(client_id:client_secret)` returns
   `data.accessToken`. Every other call sends `Authorization: Bearer <accessToken>`.
2. **Submit.** `POST` a **multipart form**: text fields plus the image or mesh files themselves. There is no
   separate upload step. The reply is `data.task_id`.
3. **Poll.** `GET <query endpoint>?task_id=…` until `data.state` is `success` or `failed`. The states are
   `created` → `queueing` → `processing` → `success` / `failed`. You can use a `callback_url` instead; the script
   polls.
4. **Download at once.** On `success`, `data.url` is the model and `data.cover_url` is a preview image.
   **Both expire after one hour.**

Things that differ from Higgsfield:

- **Errors arrive as HTTP 200.** The real status is the JSON envelope's `code` (`200` = success). A bad key is
  `{"code":40010000,"msg":"client credentials are invalid"}`. An expired or wrong token is
  `{"code":401,"msg":"login expired"}` (both verified 2026-10-24). The script checks the envelope.
- **There is no estimate endpoint.** The script's `--estimate` computes the price from the published table (below)
  and reads `GET /open-api/v1/balance`. Both are free.
- **There is no idempotency key.** A resubmitted task is charged again. If the script times out, resume the same
  task with `--task <task_id>`. **Never submit it again.**
- **The API's default output format is OBJ.** The script defaults to **GLB** for every operation.
- Each call creates one task. The account runs up to 30 at once by default. Failures and the server's own 60-minute
  timeout are refunded.

## The Wrapper: `hi3d-api.mjs` (use it for every Hi3D task)

**Run the installed master copy directly. Never copy it into the project.** `bt-agent update` installs it with the
Reference and keeps it current, so every project uses the latest version. It finds the credentials by searching
upward from the folder you run it in, so run it from the project, or from any folder below the one that holds `.env`:

```
HI3D_API="https://raw.githubusercontent.com/babylontoolkit/agent/main/references/hi3d/hi3d-api.mjs"
```

Copy it into a project's `scripts/` only when someone without the Babylon Toolkit installed has to run it, such as a
teammate or a CI machine. Then say so, because that copy no longer updates. It is a zero-dependency Node 18+ script.

```
node "$HI3D_API" <operation> --estimate [inputs]...                     # price + balance, nothing submitted
node "$HI3D_API" <operation> --out <dir> [--name <base>] [inputs]...    # generate + download
node "$HI3D_API" <operation> --task <task_id> --out <dir>               # resume a submitted task (no new charge)
node "$HI3D_API" balance                                                # account balance
```

| Option | Meaning |
|---|---|
| `--set name=value` | A form field, sent as text: `--set face=200000`, `--set resolution=2048master`, `--set mesh_url=https://…` |
| `--file name=path` | A local file sent as the form field `name`: `images=prop.png`, `image=badge.png` (relief), `mesh=geometry.glb`. Repeat a name for several files, in order |
| `--view side=path` | image-to-3d multi-view, where side is `front`, `back`, `left` or `right`. The script sends `multi_images` in **Hi3D's order (front, back, left, right)** and builds `multi_images_bit`. `front` is required. A front view on its own is sent as a single image |
| `--format name` | The output format by name: `glb` (the default), `fbx`, `obj`, `stl`, `usdz`, `3mf`; relief also takes `exr`, `png` and `bmp`. The script maps the name to the operation's own code (they differ per endpoint) |
| `--out <dir>` | Where the results go: `<base>.<ext>` (the model), `<base>_cover.<ext>`, and `<base>.json` (the final task response, kept so an unexpected output shape is never lost) |
| `--name <base>` | The file name base. Without it, the first part of the task id is used |
| `--task <task_id>` | Poll and download an already-submitted task instead of submitting a new one |
| `--timeout <minutes>` | How long to wait (default 60, the server's own task timeout) |

- **stdout:** `{ task_id, state, files, estimate }`. `estimate` is `{ credits, usd, balance, fields }`, where
  `fields` are the exact text fields sent. `credits` is `null` when the combination is not in the price table.
- **Exit codes:** `0` ok · `1` usage, credential or HTTP error · `2` the task ended without succeeding (or timed
  out; the stderr line gives the `--task` command to resume) · `3` download failed.
- **Balance unit:** `balance` is `totalBalance` exactly as the API reports it. Compare it with the console the
  first time you use it, and report it to the user as "balance", not as dollars.

## Operations

| Operation | Endpoints (create / query) | Input | Price |
|---|---|---|---|
| `image-to-3d` | `/open-api/v1/submit-task` / `/open-api/v1/query-task` | `--file images=<image>` **or** `--view front=… [--view back=…] [--view left=…] [--view right=…]` | Per model and resolution, below |
| `relief` | `/open-api/v1/depth/create-task` / `/open-api/v1/depth/query-task` | `--file image=<image>` or `--set image_url=…` | 10 credits |
| `split` | `/open-api/v1/split/create-task` / `/open-api/v1/split/query-task` | `--file mesh=<glb/stl/obj>` or `--set mesh_url=…` | 20 credits |
| `multicolor` | `/open-api/v1/muilticolor/create-task` (spelled like that) / `/open-api/v1/multicolor/query-task` | `--file mesh=<textured glb>` or `--set mesh_url=…` | 20 credits |

Input limits: images are `png`, `jpg`/`jpeg` or `webp`, up to 20 MB each. Meshes are `glb`, `stl` or `obj`, up to
200 MB. The script checks both before it sends anything.

### `image-to-3d` fields

| Field | Values | Script default |
|---|---|---|
| `request_type` | `1` geometry only · `2` texture an existing mesh (`--file mesh=…glb` or `--set mesh_url=…`) · `3` geometry + texture | `3` |
| `model` | General: `hi3dv3.0`, `hitem3dv2.1`, `hitem3dv2.0`, `hitem3dv1.5`. Portrait (people, characters): `scene-portraitv2.1`, `scene-portraitv2.0`, `scene-portraitv1.5` | `hi3dv3.0` |
| `resolution` | v3.0: `2048quality`, `2048master` · v2.1: `1536fast`, `1536pro` · v2.0: `1536`, `1536pro` · v1.5: `512`, `1024`, `1536`, `1536pro` · portrait v2.1: `1536profast`, `1536pro` · portrait v2.0: `1536pro` · portrait v1.5: `1536` | `2048quality` (v3.0 only). **Always pass it for any other model**, or the price is unknown |
| `face` | Target face count, `100000` to `5000000`. Recommended: 512³ → 500k, 1024³ → 1M, 1536 → 2M, `2048quality` → 2M, `2048master` → 5M | API default |
| `pbr` | `1` on / `0` off (v2.0, v2.1, v3.0 only) | API default `1` |
| `rmbg` | Remove the input background: `1` / `0` | API default `1` |
| `shading` | De-shading strength `0.0` to `1.0`, in tenths (v2.0+) | API default `0.5` |
| `format` | `--format glb` · `fbx` · `obj` · `stl` · `usdz` · `3mf` | `glb` |

`request_type=2` (texture only) is **not** available on v2.0 or v2.1 models (error `10031017`). Use v3.0 or v1.5
for staged generation.

### Price table (docs.hi3d.ai pricing, 2026-10-24; 1 credit = $0.02)

| Model | Resolution | Geometry | + Texture | + PBR | Full task (credits / USD) |
|---|---|---|---|---|---|
| `hi3dv3.0` | `2048quality` | 30 | 10 | 5 | 45 / $0.90 |
| `hi3dv3.0` | `2048master` | 130 | 10 | 5 | 145 / $2.90 |
| `hitem3dv2.1` | `1536fast` | 10 | 10 | 5 | 25 / $0.50 |
| `hitem3dv2.1` | `1536pro` | 30 | 10 | 5 | 45 / $0.90 |
| `hitem3dv2.0` | `1536` / `1536pro` | 20 / 30 | 10 | 5 | 35 / 45 |
| `hitem3dv1.5` | `512` / `1024` / `1536` / `1536pro` | 5 / 10 / 20 / 30 | 10 | (no PBR) | 15 / 20 / 30 / 40 |
| `scene-portraitv2.1` | `1536profast` / `1536pro` | 10 / 30 | 10 | 5 | 25 / 45 |
| `scene-portraitv2.0` | `1536pro` | 30 | 10 | 5 | 45 |
| `scene-portraitv1.5` | `1536` | 20 | 10 | (no PBR) | 30 |

Geometry only (`request_type=1`) costs the geometry column. Texture only (`request_type=2`) costs texture + PBR.
`relief` is 10 credits; `split` and `multicolor` are 20. Hi3D changes prices (v3.0 dropped on 2026-10-20). When the
console disagrees with `--estimate`, the console is right: say so, and update this table and the script's
`GEOMETRY_CREDITS`.

## Choosing Settings For A Web Game

- **Default:** `hi3dv3.0` at `2048quality` (45 credits), textured, with PBR. Use `2048master` (145) only for a hero
  asset the camera studies up close. Use `hitem3dv2.1` at `1536fast` (25) for drafts and blockouts.
- **People and characters:** the portrait models (`scene-portraitv2.1`).
- **Face count:** Hi3D's minimum, 100,000 faces, is already far over a web prop's budget. Pass
  `--set face=100000` unless the asset is a print or a close-up hero, and plan to decimate (below). More faces cost
  nothing extra, but they make larger files and slower tasks.
- **Inputs:** one clean subject on a plain background, lit evenly, at full resolution. Background removal runs by
  default. More views give a more complete model: give front, back, left and right when you have them. **Always pass
  views with `--view`**, never as hand-ordered `multi_images`. Hi3D's order (front, back, left, right) differs from
  Tripo's (front, left, back, right), and a swapped view silently ruins the mesh.
- **Iterate the shape cheaply:** run `request_type=1` (geometry only) until the form is right, then texture the
  chosen mesh with `request_type=2 --file mesh=<geometry.glb>` on v3.0. Each iteration pays for geometry only.

## Recipes

**Single image → textured GLB**
```
node "$HI3D_API" image-to-3d --estimate --file images=refs/crate.png --set face=100000
node "$HI3D_API" image-to-3d --out generated/crate --name crate --file images=refs/crate.png --set face=100000
```

**Multi-view → textured GLB**
```
node "$HI3D_API" image-to-3d --out generated/kart --name kart --set face=100000 \
     --view front=refs/kart_front.png --view back=refs/kart_back.png \
     --view left=refs/kart_left.png --view right=refs/kart_right.png
```

**Staged: geometry first, texture the chosen mesh**
```
node "$HI3D_API" image-to-3d --out generated/statue --name statue_geo --set request_type=1 --file images=refs/statue.png
node "$HI3D_API" image-to-3d --out generated/statue --name statue --set request_type=2 \
     --file images=refs/statue.png --file mesh=generated/statue/statue_geo.glb
```

**Draft quality for a blockout**
```
node "$HI3D_API" image-to-3d --out generated/blockout --set model=hitem3dv2.1 --set resolution=1536fast \
     --set face=100000 --file images=refs/tower.png
```

**Character → separated parts** (`part`: `a` 6 parts · `b` 5 · `c` 4 without head · `d` 4 with head · `e` 3 · `f` 2;
`joint`: `none`, `ball`, `dovetail`, `pin`; `merge`: `yes` / `no`)
```
node "$HI3D_API" split --out generated/hero --name hero_parts --file mesh=generated/hero/hero.glb \
     --set model=character --set part=a --set joint=none
```
For a prop, use `--set model=general --set level=medium` (`low`, `medium` or `high`). The joints are physical
connectors for 3D printing; for a game, use `joint=none`.

**Image → relief** (badges, coins, carved panels; `model_type` `base` 1K or `pro` 2K, `height_relief` 0.1–50)
```
node "$HI3D_API" relief --out generated/crest --file image=refs/crest.png --set height_relief=2
```

**Textured GLB → multicolor** (`number_color` 1–8, or `0` for the most colors)
```
node "$HI3D_API" multicolor --out generated/toy --file mesh=generated/toy/toy.glb --set number_color=4
```

**Many assets at once:** run independent calls in parallel from the shell (`… & … & wait`), each with its own
`--name`. Run `--estimate` for each one first, and state the total.

## After Generation: The GLB Is A Starting Mesh

1. Check what you got: `file generated/crate/crate.glb` must say `glTF binary`. Look at `crate_cover.webp`.
2. Even at 100,000 faces, a generated mesh is far over a web budget, and its UVs and texture come from a generator.
   Run the **`bt-unwrap`** skill on it with the same reference views. It repairs the geometry, decimates to a face
   budget, orients and scales the mesh, gives it a clean UV layout, repaints the texture from the sharp references,
   and writes a web-ready GLB (2048 WebP, single-sided material). Keep every reference image at full resolution.
3. Rig, weight and split parts in headless Blender (`unity-blender-cli.md`). Then import the mesh into Unity and add
   interactive components there (`unity-exporter-cli.md`).
4. Never write a Hi3D result URL into game code, a scene, a material or a CSS file. The URLs expire after an hour.
   Results must be files in the project.

## Error Codes

| Code | Meaning | What to do |
|---|---|---|
| `40010000` | Client credentials are invalid | The keys are wrong, swapped, disabled or deleted. Check both are set (and their lengths), then tell the user to check the key in the console |
| `401` | Token expired or wrong | Run the script again (it gets a fresh token each run) |
| `30010000` | Balance is not enough | Stop and tell the user. Buying a resource package is theirs to do |
| `10031001` | A file is over 20 MB | Downscale the image |
| `10031002` | Invalid face count | Use 100,000 to 5,000,000 |
| `10031003` / `10031006` | Invalid resolution / model | Use a pair from the fields table |
| `10031005` | Image type | `png`, `jpg`, `jpeg` or `webp` only |
| `10031007` / `10031008` | Both or neither of `images` and `multi_images` | Pass one image, or `--view`s |
| `10031009` / `10031013`–`10031015` | Multi-view count or bitmap wrong | Use `--view`; it builds both |
| `10031011` / `10031016` | `request_type=2` needs a GLB `mesh` or `mesh_url` | Pass `--file mesh=<geometry.glb>` |
| `10031017` | The model cannot texture an existing mesh | Use v3.0 or v1.5 for `request_type=2` |
| `50010001` / `5001001` | Generation failed (timeout, or the image could not be read) | Refunded. Improve the input image (clean subject, plain background) before you try again |
| `10000000` | System error | Wait and try once more; if it repeats, report it |

## Hard Rules

1. **Hi3D first for image → 3D when `HI3D_ACCESS_KEY` and `HI3D_SECRET_KEY` are set.** Use the installed `hi3d-api.mjs` (run in place, never
   copied), never Hi3D's MCP server or hand-written `curl`. Without the keys, use Higgsfield (`web-higgsfield-cli.md`).
2. **Estimate first.** Run `--estimate` for every new model or setting, and log credits per asset in long-running
   loops. State a batch's total before you submit it.
3. **Never resubmit a task that may still be running.** There is no idempotency key. After a timeout, or an exit `1`
   after `submitted …` was logged, resume with `--task <task_id>`.
4. **Never print the keys or the token.** Check only whether each is set, and its length.
5. **Results become project files at once.** The script downloads them. Their URLs expire after an hour, and none
   may appear in the project.
6. **Buying credits, creating or deleting keys, and changing concurrency are the user's.** Everything else here you
   run yourself.

## Final Check

- [ ] I checked for `HI3D_ACCESS_KEY` + `HI3D_SECRET_KEY` (or `HI3D_API_KEY`) by shape only. With them, image → 3D went through Hi3D.
- [ ] Every task ran through the installed `hi3d-api.mjs`, with `--estimate` first.
- [ ] Multi-view inputs were passed with `--view` (Hi3D's order is front, back, left, right).
- [ ] Every result was saved into the project, and `file <model>.glb` says `glTF binary`. No result URL is
      referenced anywhere.
- [ ] The mesh went through `bt-unwrap` (or Blender) to a web face budget before it was used in a scene.
- [ ] No task was resubmitted while an earlier one could still be running.
