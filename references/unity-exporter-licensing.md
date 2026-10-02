## Unity Exporter — Licensing

> Section numbers (§N) refer to [`unity-exporter-cli.md`](https://raw.githubusercontent.com/babylontoolkit/agent/main/references/unity-exporter-cli.md) unless the section is in this document.

### ⚠️ The Babylon Toolkit licence decides whether your export is interactive at all

**This is the single most consequential thing in this document, and it fails silently.**

The exporter checks `ToolkitManager.IsPro()` **per component**. Without a Pro licence the export still
succeeds, still writes a `.gltf`, still emits all the scene-level metadata — and **silently omits the native
Unity-system components and all physics**. No error. One line in the Editor log:

```
Pro Tools Disabled: Exporting standard community edition content
```

| | Community (no `license.json`) | Pro |
|---|---|---|
| Geometry, materials, textures, lightmaps, probes | ✅ | ✅ |
| Scene metadata (skybox, IBL, fog, gravity, navigation) | ✅ | ✅ |
| `camera`, `light` components | ✅ | ✅ |
| Animation clips, skins, morph targets | ✅ | ✅ |
| **Script components** (`EditorScriptComponent`) | ✅ | ✅ |
| **Every `physics` and `collision` block** (Rigidbody, static colliders, CharacterController) | ❌ dropped | ✅ |
| **Animator state machine** (`AnimationState`) | ❌ dropped | ✅ |
| **AudioSource** | ❌ dropped | ✅ |
| **NavMeshAgent** | ❌ dropped | ✅ |
| **CharacterController** | ❌ dropped | ✅ |
| **ParticleSystem** | ❌ dropped | ✅ |
| **LineRenderer / TrailRenderer / SpriteRenderer / TilemapRenderer** | ❌ dropped | ✅ |
| **Canvas / UIDocument** (UI) | ❌ dropped | ✅ |
| **Terrain** | ❌ dropped | ✅ |
| **VideoPlayer** | ❌ dropped | ✅ |
| **PostProcess volumes** (and URP default volumes) | ❌ dropped | ✅ |
| **LOD groups** | ❌ dropped | ✅ |
| **Camera anti-aliasing** (FXAA / SMAA / TAA, and MSAA on a post chain) | ❌ dropped | ✅ |

*(Gates in `CVTools.cs`, toolkit source 9.27.1: 3807 LOD, 4222 camera AA, 4231 default volumes, 4518, 4553,
4608, 4647, 4683, 4738, 4773, 4808, 5028, 5043, 5132, and 5250–5254, which nulls physics + collision.)*

**Measured proof — the same scene exported both ways.** 4 crates, each with a Rigidbody and a BoxCollider:

| | Community (no `license.json`) | Pro (`EnterprisePartner`) |
|---|---|---|
| `metadata.license` | `"community"` | `"professional"` |
| `Main Camera` / `Directional Light` | `['camera']` / `['light']` | `['camera']` / `['light']` |
| `Crate_0` … `Crate_3` | **`NONE`** | `['script']` **+ full `physics` + `collision` blocks** |

Under Pro each crate carries `extras.metadata.physics` (`type: "rigidbody"`, `mass`, `ldrag`, `adrag`,
`freeze` constraints, `gravity`, `kinematic`, …) and `extras.metadata.collision` (`BoxCollider`, `boxsize`,
`restitution`, `dynamicfriction`, `staticfriction`, …). Under community **none of it is written** — the Unity
scene file had 4 `Rigidbody` entries and the community glTF contained zero. Same scene, same command, same
exporter; only the licence differed.

#### Always check the licence BEFORE trusting an export

```bash
unity command eval 'return "pro=" + ToolkitManager.IsPro() + " type=" + ToolkitManager.GetLicenseType() + " name=" + ToolkitManager.GetLicenseName();' --project-path "$PROJ"
```

Or read it back out of the exported file — the tier is baked in as `scenes[0].extras.metadata.license`:

```bash
python3 -c "import json;print(json.load(open('Export/scenes/Level01.gltf'))['scenes'][0]['extras']['metadata']['license'])"
# -> "community"  or  "professional"
```

**If it says `community` and you expected interactive content, the export is incomplete — stop and fix the
licence rather than shipping it.**

#### How `license.json` is validated — the exact rules

`Assets/[Config]/license.json` holds `{ secret, key, s1, s2 }`. `secret` decrypts to a pipe-delimited
`plan|licensee|organization|product|project|expires`. The file is then accepted only if `key` matches
`hash(plan + "-" + seed)` — and **the seed is what binds a licence to a machine or project**:

| Plan | Decryption seed | Consequence |
|---|---|---|
| `EnterprisePartner` | **`PlayerSettings.companyName`** | Project Settings ▸ **Company Name** must match the licence exactly, character for character |
| `Indie`, `SmallBusiness`, `PremiumContent` | **`PlayerSettings.productGUID`** | Bound to **that one Unity project**. A `license.json` copied into a different project will not validate |

If the hash fails you get `Invalid Pro Tools License Hash Key` and fall back to community.

Once decrypted, `BuildProject` applies a **second, per-plan** gate — and these read Unity **sign-in** state,
not `companyName`:

| Plan | Additional requirement | Field actually compared |
|---|---|---|
| `Indie` | Signed into Unity, and the licensee is you | `CloudProjectSettings.userName` (your Unity **email**) == licence `licensee` |
| `SmallBusiness`, `PremiumContent` | Signed in, and you are the licensee **or** hold a seat | `userName` == `licensee`, or == seat 1 / seat 2 |
| `EnterprisePartner` (org ≠ `*`) | Project linked to the cloud org | `CloudProjectSettings.projectId` non-empty **and** `CloudProjectSettings.organizationName` == licence `organization` |

> **`PlayerSettings.companyName` is only a *seed*, and only for EnterprisePartner.** It is never compared for
> the other plans. It *is* written into every export as `scenes[0].extras.metadata.licensee` — which is a
> record, not a check. (A community export shows whatever `companyName` happens to be, e.g. `DefaultCompany`.)

> **Worked example (verified).** An `EnterprisePartner` licence with `org = "*"`:
> `pro=True type=EnterprisePartner name='<Licensee Name>' org=* expires=never isLicensee=False isOrganization=False
> hasDeveloperSeat=True`. It passes headless for two independent reasons — the wildcard org skips the
> `projectId`/`organizationName` gate entirely, and the developer holds a seat. Note `isLicensee` and
> `isOrganization` are both **False** and it still works: those are not required when a seat or wildcard covers
> you. Making it validate required setting Project Settings ▸ **Company Name** to the licence's `name` (`<Licensee Name>`) — the
> EnterprisePartner seed — exactly as the seed table above requires.

#### Headless licensing — what works and what does not

**Verified in a resident `-batchmode` Editor:**

```
CloudProjectSettings.userName         : 'you@example.com'       <- POPULATED
CloudProjectSettings.organizationName : ''                      <- EMPTY
CloudProjectSettings.projectId        : ''                      <- EMPTY
```

| Plan | Headless verdict |
|---|---|
| `Indie`, `SmallBusiness`, `PremiumContent` | ✅ **Works** — `userName` is available, so the email gate passes |
| `EnterprisePartner` with a specific org | ❌ **Blocked** — `projectId` and `organizationName` are both empty, so the org gate fails |
| `EnterprisePartner` with org `"*"` | ✅ Works — a wildcard org is never org-checked |

So for headless CI, prefer a seat-based plan, or a wildcard-org Enterprise licence. Note also that
`HasDeveloperSeat()` short-circuits on `IsPro()`, so the built-in owners list only helps **after** a valid
licence file is already loading.

#### The subscription path — coming, and much simpler (NOT LIVE YET)

> ⚠️ **Not usable today.** The App Builder endpoint is not deployed and `SUBSCRIPTION_API_KEY` ships empty.
> **Until it is live, `license.json` is the only way to get Pro.** This subsection describes the intended
> behaviour so agent tooling can be written to prefer it once it ships.

When the service is up the check becomes a single question — **does the signed-in Unity user's email have an
active subscription?** If yes, that developer has full access. There is:

- **no `license.json`** — a subscriber legitimately has no licence file at all;
- **no Project Settings ▸ Company Name match** — the EnterprisePartner `companyName` seed is irrelevant;
- **no `productGUID` binding** — so nothing ties access to one specific Unity project;
- **no expiry date check** — entitlement is checked live.

That removes every seed/binding rule in the table above, and with it the main reason a licence cannot be moved
between projects or machines. For CI it means: sign in, and export.

**How it behaves in code** (already implemented in `ToolkitManager`, just waiting on the endpoint):

```csharp
// Blocking HTTP. Defaults to CloudProjectSettings.userName — the signed-in Unity account email.
bool ok = ToolkitManager.HasActiveSubscription();          // or (email), or (email, force: true)
```

A success registers the caller as the **authorized developer for the Editor session**, after which
`IsPro()` → `true`, `GetLicenseType()` → `"PremiumContent"`, `GetLicenseOrg()` → `"*"`,
`GetExpirationDate()` → `"never"`, and both `IsLicensee()` and `HasDeveloperSeat()` → `true`. Those values are
chosen so every per-plan gate in `BuildProject` passes cleanly.

Two properties worth building around:

- **It only ever GRANTS — it can never revoke.** A failed check (no network, service down, key unset) leaves
  any local `license.json` working exactly as before. Calling it is therefore always safe.
- **It is never called from `IsPro()`.** `IsPro()` runs *per component* during an export, so a lazy check
  inside it would fire HTTP inside the export loop. **Your pipeline must call `HasActiveSubscription()`
  explicitly, once, before exporting.** The result is cached for the session; pass `force: true` to re-ask.

**Recommended agent pattern once the service is live** — try the subscription, fall back to the licence file:

```bash
unity command eval 'bool sub = ToolkitManager.HasActiveSubscription();
return "subscription=" + sub + " pro=" + ToolkitManager.IsPro() + " as=" + ToolkitManager.GetAuthorizedDeveloper();' \
  --project-path "$PROJ"
# then gate the export on IsPro() being true, whichever path granted it
```

#### `GenerateDeveloperLicense()` — the one-call request path (ALSO NOT LIVE YET)

Alongside `HasActiveSubscription()`, the exporter exposes a method that *asks the service to issue a licence*
for the signed-in Unity user, rather than checking an existing entitlement:

```csharp
// CanvasTools.CanvasToolsExporter - Professional Edition
public static int GenerateDeveloperLicense()
{
    string devid = "3D-APP-BUILDER";
    string email = CloudProjectSettings.userName;   // the signed-in Unity account email
    return ExporterLicenser.PostLicenseWebRequest(devid, email);
}
```

> ⚠️ **Present in the API, but it does not work yet** — it posts to the same undeployed App Builder endpoint
> as `HasActiveSubscription()`. **Do not build a pipeline that depends on it.** `license.json` remains the
> only working way to get Pro today. It is documented here so tooling can prefer it once the service ships.

What to know when it does go live:

- **No arguments, no seeds, no file.** The developer id is the fixed constant `"3D-APP-BUILDER"` and the
  identity is `CloudProjectSettings.userName`, so there is nothing to configure — none of the
  `companyName` / `productGUID` seed rules above apply.
- **The Editor must be signed in.** `CloudProjectSettings.userName` is the one cloud field that *is*
  populated in `-batchmode` (see the table above), which is what makes this viable headless — but it is
  empty if the seat is not signed in, and the request will then carry no identity.
- **It returns an `int`** — the web-request result, not a bool and not the licence itself. Never treat a
  return value as proof of anything: re-check `ToolkitManager.IsPro()` afterwards to find out whether the
  Editor session actually gained Pro.

Probe before calling, exactly as with the dev server in §12.4 — older Toolkit builds do not have it:

```bash
unity command eval 'var mi = typeof(CanvasTools.CanvasToolsExporter).GetMethod("GenerateDeveloperLicense",
  System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
return mi != null ? "present" : "absent";' --project-path "$PROJ"
```

#### Where the licence lives

`Assets/[Config]/license.json` — an encrypted file, generated in-Editor by
`Tools ▸ Babylon Toolkit ▸ Developer Options ▸ Generate Project License`. It is **per project**, so a newly
created project has none and defaults to community. There are also two session-level `App Builder` paths
that can *grant* Pro without a file — `ToolkitManager.HasActiveSubscription()` (check an entitlement) and
`CanvasToolsExporter.GenerateDeveloperLicense()` (request one for the signed-in user). Both must be invoked
explicitly, neither is called from `IsPro()`, neither ever revokes — and **neither works yet**: the endpoint
they share is not deployed.

**For agent and CI work:** copy a valid `license.json` into `Assets/[Config]/` as part of project setup, and
gate the pipeline on `IsPro()` returning true before exporting anything you intend to ship.
