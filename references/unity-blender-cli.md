## Blender — Headless Command Line Interface

**IMPORTANT. THIS DOCUMENT PROVIDES CRUCIAL BLENDER INSTRUCTIONS. ALWAYS READ THIS ENTIRE DOCUMENT TO THE END OF FILE**

This document covers **driving Blender entirely from the command line, with no GUI**.

**The default workflow is Unity → Blender → Unity.** Unity is the project director; the FBX files live in the
Unity project; Blender does maintenance on them and they go straight back — see **§8**, which covers both
editing a model **in place** (Unity GUID and importer settings preserved, every scene reference survives) and
producing a **new model** (new GUID, importer settings reset).

**But that is the default, not a limit.** Blender here is a general-purpose headless tool: rendering,
geometry, procedural generation with Geometry Nodes, materials and baking, animation, simulation, format
conversion, batch processing — on files anywhere on disk, in or out of a Unity project. If it can be
expressed in `bpy`, it is in scope (**§8.4**).

### YOU drive Blender. The user does not.

**No GUI step in this document is ever handed back to the user.** Blender headless is the full application —
`bpy` in `--background` is the *same* API the GUI calls — so anything a modeller could do by clicking, you do
by scripting it:

| You can, entirely headless | Where |
|---|---|
| **Create models from nothing** — primitives, modifiers, booleans, curves, procedural Geometry Nodes | §5, §8.4 |
| Repair and prepare meshes — cleanup, decimate, LODs, normals, origins, scale, naming | §5 |
| UV unwrap, pack, and bake maps (AO, normal, curvature, lighting) | §8.4 |
| Rig, skin, re-weight, transfer weights, normalize influences, fix vertex groups | §4 |
| Retarget, bake, trim and split animation | §5, §8.4 |
| Author materials and node trees; bake them to textures | §8.4 |
| Simulate cloth, rigidbodies and particles, then bake to geometry/animation | §8.4 |
| Convert and batch-process FBX / glTF / GLB / OBJ / USD / Alembic in any direction | §3, §5, §8.4 |
| **Render** with Cycles/EEVEE — turntables, thumbnails, look-dev frames you then open and judge | §8.4 |
| Round-trip a model in place inside a Unity project, GUID and importer settings intact | §8 |

**"There is no model for that" is not a blocker — build one.** Model it in Blender, or generate the textures
it needs with the generation MCP servers (`web-kie-servers.md`), then bring it into Unity and compose the
level. Placeholder geometry you authored beats a question that stops the job.

**You can see your own output.** Render a frame or a turntable, open the PNG, judge it, and iterate — the same
closed loop as `unity command screenshot` on the Unity side. Decide for yourself whether the asset is right.

> **Yes, Blender is fully headless.** `blender --background --python script.py` is a first-class, long-stable
> workflow — considerably better supported than Unity's equivalent. Every command and operator in §2–§7 was
> executed headless against Blender 5.1.2; measured results are inline.

**Verified against:** Blender **5.1.2** (macOS arm64, build `ec6e62d40fa9`, 2026-05-19). Headless startup
measured at **~1.0 s**.

---

## 0. The mental model

| | Blender | Unity + Babylon Toolkit |
|---|---|---|
| Role | Anything `bpy` can do — most often fixing/preparing **assets**: meshes, skinning, materials, animation | Compose **scenes/levels**, add interactive components, export interactive glTF |
| Headless | `--background` (mature, no workarounds needed) | `-batchmode -nographics` + the bootstrap in `unity-exporter-cli.md` §4B |
| Scripting | `bpy` Python API — the *same* API the GUI uses | C# via `unity command eval` |
| Typical input | `.blend`, `.fbx`, `.glb`, `.obj`, `.usd` | a Unity project |
| Typical output | a repaired `.fbx` / `.glb` / `.blend` | `.gltf` / `.glb` game level or asset container |

**The default pipeline:** a model **already in the Unity project** → **Blender headless** (maintenance) →
back into the Unity project → compose the level → Babylon Toolkit export → BabylonJS.

Blender can equally be pointed at any file on disk with output anywhere — a downloaded asset, a scratch
`.blend`, a folder of FBXs, straight to `.glb` for the web (§8.4).

Two important properties:

- **No licence of any kind.** Blender is GPL. There is no seat, no activation, no `license.json`, nothing to
  gate features — unlike the Toolkit's Pro gate (`unity-exporter-cli.md` §0).
- **The API is not a reduced "batch" API.** `bpy` in `--background` is the same API the GUI runs. What differs
  is *context*: some operators need an explicit context, and anything that depends on a window/screen is
  unavailable (see §6).

---

## 1. Install

### Check first

```bash
# macOS
/Applications/Blender.app/Contents/MacOS/Blender --version
# Linux / Windows (if on PATH)
"$BLENDER" --version
```

### Where the executable lives

| Platform | Path |
|---|---|
| macOS | `/Applications/Blender.app/Contents/MacOS/Blender` |
| Windows | `C:\Program Files\Blender Foundation\Blender <ver>\blender.exe` |
| Linux (tar.xz) | `<extracted>/blender` |
| Linux (snap/apt/flatpak) | `blender` on `PATH` |

> **macOS: the `.app` is not the binary.** `open -a Blender` will not accept `--background`. You must call the
> executable inside the bundle. Name it once and use `"$BLENDER"` in every command:
> ```bash
> BLENDER=/Applications/Blender.app/Contents/MacOS/Blender   # macOS; Windows/Linux keep their install path
> ```

### Install methods

| Platform | Command |
|---|---|
| macOS | `brew install --cask blender`, or the `.dmg` from blender.org |
| Windows | `winget install BlenderFoundation.Blender`, or `choco install blender` |
| Linux | `sudo snap install blender --classic`, `sudo apt install blender`, or the official `tar.xz` (**preferred** — distro packages lag badly) |
| Docker/CI | official `tar.xz` extracted into the image — no display server needed |

**Pick a specific version rather than "latest".** Add-on operator names and enum values do change between
major versions (§7 has a real example). Pin the version in CI.

### Option B — `bpy` as a pip module (no Blender app at all)

Blender publishes itself to PyPI as a Python module — ideal for CI containers:

```bash
python3 -m pip install "bpy==5.1.*"   # the line this document was verified on; each bpy wheel needs one exact CPython version
python3 -c "import bpy; print(bpy.app.version_string)"
```

Then write plain Python instead of `blender --background --python`:

```python
import bpy
bpy.ops.wm.open_mainfile(filepath="asset.blend")
# ... same bpy API as everything below ...
bpy.ops.wm.save_as_mainfile(filepath="out.blend")
```

> **Caveats:** the wheel is pinned to one exact CPython minor version (3.13 today), it is a large download,
> and a few GUI-adjacent modules are absent. For most agent work the real binary is simpler and matches what
> artists run. Use `bpy` when you cannot install an application into the image.

---

## 2. The command line

```bash
blender [blender-args] [file.blend] [more-args] -- [your script's argv]
```

### The flags that matter for headless work

| Flag | Does |
|---|---|
| `-b`, `--background` | **Run with no GUI.** The core flag |
| `-P <file>`, `--python <file>` | Run a Python script file |
| `--python-expr "<code>"` | Run an inline expression — may be a complete multi-line script |
| `--python-exit-code <n>` | **Exit with `<n>` if the script raises.** `0` disables. Without this a crashed script still exits 0 |
| `--factory-startup` | Ignore user prefs, startup file and enabled add-ons — **use in CI for reproducibility** |
| `--addons a,b,c` | Enable extra add-ons (comma separated, no spaces) |
| `--python-use-system-env` | Allow `PYTHONPATH` etc. (isolated by default) |
| `--python-use-user-env` | Allow the user's `site-packages` |
| `-y` / `-Y` | Enable / disable automatic script execution (**disabled by default**) |
| `--offline-mode` / `--online-mode` | Force network policy, overriding preferences |
| `--log "<match>"`, `--debug` | Diagnostics |
| `--` | **Everything after this is ignored by Blender** and handed to your script via `sys.argv` |
| `-t <n>`, `--threads <n>` | Thread count; `0` = auto |

### The canonical invocation

```bash
"$BLENDER" --background --factory-startup --python-exit-code 1 \
        --python /path/to/script.py -- arg1 arg2
```

**Use all four every time.** `--factory-startup` stops a user's prefs from changing behaviour;
`--python-exit-code 1` is what makes failures detectable at all.

### Reading your own arguments

```python
import sys
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
```

*Verified: `-- hello world` → `['hello', 'world']`.*

### Exit codes — the trap

**A Python exception does not fail the process by default.** Blender prints the traceback and exits `0`.
Always pass `--python-exit-code`:

```bash
"$BLENDER" -b --factory-startup --python-exit-code 1 --python fix.py -- in.fbx out.fbx
echo "exit=$?"      # non-zero only because of --python-exit-code
```

### Opening a file

```bash
"$BLENDER" -b asset.blend --factory-startup --python-exit-code 1 --python script.py
```

…or open it *inside* the script, which is more explicit. `open_mainfile` opens `.blend` files only; use the
import operators for FBX/glTF (§3):

```python
bpy.ops.wm.open_mainfile(filepath="asset.blend")
```

---

## 3. Import / export — what this build actually has

Enumerate rather than assume; operator names moved in 5.x:

```python
print(sorted(n for n in dir(bpy.ops.import_scene) if not n.startswith('_')))
print(sorted(n for n in dir(bpy.ops.export_scene) if not n.startswith('_')))
print(sorted(n for n in dir(bpy.ops.wm) if 'import' in n or 'export' in n))
```

*Verified on 5.1.2:*

| Format | Import | Export |
|---|---|---|
| **FBX** | `bpy.ops.wm.fbx_import` (native, new in 5.x) **or** `bpy.ops.import_scene.fbx` (add-on) | `bpy.ops.export_scene.fbx` |
| **glTF / GLB** | `bpy.ops.import_scene.gltf` | `bpy.ops.export_scene.gltf` |
| OBJ | `bpy.ops.wm.obj_import` | `bpy.ops.wm.obj_export` |
| STL | `bpy.ops.wm.stl_import` | `bpy.ops.wm.stl_export` |
| PLY | `bpy.ops.wm.ply_import` | `bpy.ops.wm.ply_export` |
| USD | `bpy.ops.wm.usd_import` | `bpy.ops.wm.usd_export` |
| Alembic | `bpy.ops.wm.alembic_import` | `bpy.ops.wm.alembic_export` |
| `.blend` | `bpy.ops.wm.open_mainfile` | `bpy.ops.wm.save_as_mainfile` |

> **Blender 5.x has two FBX importers.** The native `bpy.ops.wm.fbx_import` is faster; the legacy
> `bpy.ops.import_scene.fbx` has more options and is what most existing scripts use. They take **different
> keyword arguments** — do not swap one for the other without checking. `import_scene.fbx` is verified working
> in this document.

```python
bpy.ops.export_scene.fbx(filepath=out, use_selection=False, add_leaf_bones=False)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB')
```

`add_leaf_bones=False` matters for a Unity/Toolkit round trip — leaf bones show up as extra junk bones.

---

## 4. Skin weights headless — the main event

**All of this is verified working in `--background`.** Weight *painting* in the GUI sense is a brush over a
viewport, which does not exist headless — but every operation that painting produces is available as data
manipulation or an operator, which is what you actually want for automation because it is deterministic.

### 4.1 The four ways to (re)build weights

| Approach | API | Use when |
|---|---|---|
| **Automatic weights** | `bpy.ops.object.parent_set(type='ARMATURE_AUTO')` | Rebuilding skinning from scratch against an armature — the closest thing to "re-paint this model" |
| **Direct assignment** | `vgroup.add(indices, weight, 'REPLACE'/'ADD'/'SUBTRACT')` | Precise, scriptable edits. **No operator context needed — most reliable headless** |
| **Weight transfer** | `bpy.ops.object.data_transfer(data_type='VGROUP_WEIGHTS', …)` | Copying good weights onto a retopo/LOD/variant mesh |
| **Cleanup operators** | `vertex_group_clean`, `vertex_group_limit_total`, `vertex_group_normalize_all`, `vertex_group_mirror` | Making weights engine-legal (see §4.4) |

### 4.2 Re-paint an FBX or .blend — verified end to end

Saved as `reweight.py`:

```python
import bpy, sys, os

argv = sys.argv[sys.argv.index("--") + 1:]
src, dst = argv[0], argv[1]
only = argv[2] if len(argv) > 2 else None      # optional: re-paint just this mesh name

# --- load (any supported format) ---
bpy.ops.wm.read_factory_settings(use_empty=True)
ext = os.path.splitext(src)[1].lower()
if   ext == ".blend": bpy.ops.wm.open_mainfile(filepath=src)
elif ext == ".fbx":   bpy.ops.import_scene.fbx(filepath=src)
elif ext in (".glb", ".gltf"): bpy.ops.import_scene.gltf(filepath=src)
else: raise SystemExit("unsupported input: " + ext)

arm = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
if arm is None: raise SystemExit("no armature found - nothing to skin to")
meshes = [o for o in bpy.data.objects if o.type == 'MESH' and (only is None or o.name == only)]
if not meshes: raise SystemExit("no mesh to re-paint" + (f" named {only}" if only else ""))

def world_bounds(o):
    pts = [o.matrix_world @ v.co for v in o.data.vertices]
    if not pts: return [0.0] * 6
    return [min(p[i] for p in pts) for i in range(3)] + [max(p[i] for p in pts) for i in range(3)]

def run(op, obj, **kw):
    # Operators never raise when cancelled - they return {'CANCELLED'}. Check every one.
    with bpy.context.temp_override(active_object=obj, object=obj, selected_objects=[obj], selected_editable_objects=[obj]):
        result = op(**kw)
    if 'FINISHED' not in result: raise SystemExit(f"{op.idname()} was cancelled on {obj.name}")

for mesh in meshes:
    before = world_bounds(mesh)
    # --- RE-PAINT: drop weights AND the old skin, detach keeping the world transform ---
    for g in list(mesh.vertex_groups): mesh.vertex_groups.remove(g)
    for m in [m for m in mesh.modifiers if m.type == 'ARMATURE']: mesh.modifiers.remove(m)
    run(bpy.ops.object.parent_clear, mesh, type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.select_all(action='DESELECT')
    mesh.select_set(True); arm.select_set(True)
    bpy.context.view_layer.objects.active = arm      # armature must be ACTIVE
    if 'FINISHED' not in bpy.ops.object.parent_set(type='ARMATURE_AUTO', keep_transform=True):
        raise SystemExit(f"parent_set was cancelled on {mesh.name}")
    # --- make them engine-legal ---
    run(bpy.ops.object.vertex_group_clean, mesh, limit=0.01, group_select_mode='ALL')
    run(bpy.ops.object.vertex_group_limit_total, mesh, limit=4, group_select_mode='ALL')
    run(bpy.ops.object.vertex_group_normalize_all, mesh, lock_active=False)
    # --- verify BEFORE writing ---
    bad = sum(1 for v in mesh.data.vertices if abs(sum(g.weight for g in v.groups) - 1.0) > 1e-4)
    moved = max(abs(x - y) for x, y in zip(before, world_bounds(mesh)))
    print(f"{mesh.name}: groups={len(mesh.vertex_groups)} not-normalised={bad} bounds-shift={moved:.6f}")
    if bad: raise SystemExit(f"weights failed to normalise on {mesh.name}")
    if moved > 1e-4: raise SystemExit(f"world bounds changed on {mesh.name} - refusing to write")

# --- save (an unknown extension is an error, never a silent no-op) ---
e = os.path.splitext(dst)[1].lower()
if   e == ".blend": bpy.ops.wm.save_as_mainfile(filepath=dst)
elif e == ".fbx":   bpy.ops.export_scene.fbx(filepath=dst, add_leaf_bones=False)
elif e == ".glb":   bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB')
elif e == ".gltf":  bpy.ops.export_scene.gltf(filepath=dst, export_format='GLTF_SEPARATE')
else: raise SystemExit("unsupported output: " + e)
if not os.path.exists(dst): raise SystemExit("nothing was written to " + dst)
print("wrote", dst)
```

```bash
"$BLENDER" -b --factory-startup --python-exit-code 1 --python reweight.py -- in.fbx out.glb
```

*Verified run (Blender 5.1.2):* the KayKit Adventurers `Knight.fbx` (9 meshes, 1 rig) — every mesh re-painted, every `bounds-shift=0.000000`, 0 vertices failed to normalise. The previous version of this script re-painted only the first mesh and rotated it 90° by re-parenting it without clearing the old parent; the `parent_clear(CLEAR_KEEP_TRANSFORM)` + removed Armature modifier + bounds check are what prevent that.

### 4.3 Direct weight editing — no operator, no context

The most reliable headless primitive. Nothing about it needs a window:

```python
vg  = mesh.vertex_groups["Bone_Upper"]          # or mesh.vertex_groups.new(name="Bone_Upper")
idx = [v.index for v in mesh.data.vertices if v.co.z > 0.5]
vg.add(idx, 1.0, 'REPLACE')                     # also 'ADD', 'SUBTRACT'
vg.remove([v.index for v in mesh.data.vertices if v.co.z < -0.9])

# read a single weight (raises if the vertex is not in the group)
try:    w = vg.weight(vertex_index)
except RuntimeError: w = 0.0
```

Falloff by distance — a scripted equivalent of a soft brush:

```python
import mathutils
centre, radius = mathutils.Vector((0,0,0.5)), 0.4
for v in mesh.data.vertices:
    d = (v.co - centre).length
    if d < radius:
        vg.add([v.index], 1.0 - (d / radius), 'REPLACE')   # linear falloff
```

### 4.4 Making weights engine-legal for BabylonJS

glTF and most runtimes cap influences at **4 per vertex** and expect normalised weights.

| Operator | Effect |
|---|---|
| `bpy.ops.object.vertex_group_clean(limit=0.01, group_select_mode='ALL')` | Drop near-zero weights that waste influence slots |
| `bpy.ops.object.vertex_group_limit_total(limit=4, group_select_mode='ALL')` | Cap influences per vertex at 4 |
| `bpy.ops.object.vertex_group_normalize_all(lock_active=False)` | Make each vertex sum to 1.0 |
| `bpy.ops.object.vertex_group_mirror(use_topology=False)` | Mirror `.L` ↔ `.R` groups |
| `bpy.ops.object.vertex_group_smooth(factor=0.5, repeat=1)` | Smooth harsh transitions |

**Order matters:** `clean` → `limit_total` → `normalize_all`. Normalising first then limiting leaves the sums
wrong again.

Always verify before writing the file:

```python
bad  = sum(1 for v in mesh.data.vertices if abs(sum(g.weight for g in v.groups) - 1.0) > 1e-4)
over = sum(1 for v in mesh.data.vertices if len(v.groups) > 4)
assert bad == 0 and over == 0, f"not engine-legal: {bad} unnormalised, {over} over-influenced"
```

### 4.5 Weight transfer between meshes

For retopo, LODs, or outfit variants:

```python
bpy.ops.object.select_all(action='DESELECT')
dst.select_set(True)
src.select_set(True)
bpy.context.view_layer.objects.active = src        # ACTIVE = SOURCE
bpy.ops.object.data_transfer(
    data_type='VGROUP_WEIGHTS',
    vert_mapping='POLYINTERP_NEAREST',
    layers_select_src='ALL',
    layers_select_dst='NAME')
```

> **Gotcha, hit and verified.** `use_reverse_transfer=True` **swaps which enum set each argument is validated
> against**, so a correct-looking call fails with
> `enum "ALL" not found in ('ACTIVE','NAME','INDEX')`. Prefer the forward form above — active object is the
> **source**, selected objects are destinations.

Enum values on 5.1.2 (introspected, not remembered):

| Property | Values |
|---|---|
| `data_type` | `VGROUP_WEIGHTS`, `COLOR_VERTEX`, `COLOR_CORNER`, `UV`, `CUSTOM_NORMAL`, `SHARP_EDGE`, `SEAM`, `CREASE`, `BEVEL_WEIGHT_VERT/EDGE`, `SMOOTH`, `FREESTYLE_EDGE/FACE` |
| `vert_mapping` | `TOPOLOGY`, `NEAREST`, `EDGE_NEAREST`, `EDGEINTERP_NEAREST`, `POLY_NEAREST`, `POLYINTERP_NEAREST`, `POLYINTERP_VNORPROJ` |
| `layers_select_src` | `ACTIVE`, `ALL`, `BONE_SELECT`, `BONE_DEFORM` |
| `layers_select_dst` | `ACTIVE`, `NAME`, `INDEX` |
| `mix_mode` | `REPLACE`, `ABOVE_THRESHOLD`, `BELOW_THRESHOLD`, `MIX`, `ADD`, `SUB`, `MUL` |

Use `POLYINTERP_NEAREST` for differing topology, `TOPOLOGY` only when vertex counts match exactly.

### 4.6 Inspecting weights (report before you change anything)

```python
def report(o):
    per_group, over = {}, 0
    for v in o.data.vertices:
        if len(v.groups) > 4: over += 1
        for g in v.groups:
            n = o.vertex_groups[g.group].name
            per_group.setdefault(n, []).append(g.weight)
    for n, w in sorted(per_group.items()):
        print(f"  {n:24} verts={len(w):5} min={min(w):.3f} max={max(w):.3f} avg={sum(w)/len(w):.3f}")
    print(f"  vertices with >4 influences: {over}")
report(mesh)
```

---

## 5. Other headless asset work

```python
# --- Transform / scale fixes (FBX unit mismatches) ---
obj.scale = (0.01, 0.01, 0.01)
with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
    assert 'FINISHED' in bpy.ops.object.transform_apply(location=False, rotation=True, scale=True), 'transform_apply was cancelled'

# --- Mesh cleanup ---
import bmesh
bm = bmesh.new(); bm.from_mesh(mesh.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
bm.to_mesh(mesh.data); bm.free()
mesh.data.update()

# --- Decimate for an LOD ---
m = mesh.modifiers.new("Decimate", 'DECIMATE'); m.ratio = 0.5
with bpy.context.temp_override(object=mesh, active_object=mesh, selected_objects=[mesh]):
    assert 'FINISHED' in bpy.ops.object.modifier_apply(modifier=m.name), 'modifier_apply was cancelled'

# --- Recalculate normals ---
bpy.context.view_layer.objects.active = mesh
with bpy.context.temp_override(object=mesh, active_object=mesh, selected_objects=[mesh]):
    assert 'FINISHED' in bpy.ops.object.mode_set(mode='EDIT'), 'mode_set was cancelled'
    assert 'FINISHED' in bpy.ops.mesh.select_all(action='SELECT'), 'select_all was cancelled'
    assert 'FINISHED' in bpy.ops.mesh.normals_make_consistent(inside=False), 'normals_make_consistent was cancelled'
    assert 'FINISHED' in bpy.ops.object.mode_set(mode='OBJECT'), 'mode_set was cancelled'

# --- Animation: list actions ---
for a in bpy.data.actions:
    print(a.name, a.frame_range)

# --- Format conversion one-liner ---
# blender -b in.fbx is NOT valid; import inside the script instead.
```

**Batch a whole folder:**

```bash
for f in assets/*.fbx; do
  "$BLENDER" -b --factory-startup --python-exit-code 1 --python reweight.py \
    -- "$f" "out/$(basename "${f%.fbx}").glb" || echo "FAILED: $f"
done
```

---

## 6. Headless gotchas

| Gotcha | Detail |
|---|---|
| **Exceptions exit 0** | Always pass `--python-exit-code 1`, or CI will treat a crash as success |
| **Operators need context** | Many `bpy.ops` read `bpy.context`. Select objects and set `view_layer.objects.active` first, or use `with bpy.context.temp_override(...)` |
| **Prefer data over operators** | `vgroup.add(...)`, `mesh.data.vertices[...]` need no context and never fail on it. Reach for operators only when there is no data equivalent |
| **`--factory-startup` changes behaviour** | It disables non-default add-ons. If a script needs one, add `--addons <name>` |
| **Auto-exec is off by default** | Drivers and startup scripts embedded in a `.blend` do not run unless you pass `-y` |
| **macOS `.app` is not the binary** | `open -a Blender` cannot take `--background` |
| **Operator names/enums move between versions** | Pin the version; introspect with `get_rna_type().properties[...].enum_items` rather than trusting memory |
| **Modes are global** | `bpy.ops.object.mode_set(mode='OBJECT')` before switching objects, or operators fail confusingly |
| **No viewport-dependent ops** | Brush painting, viewport render, screen operators are unavailable. Every *result* is reachable through data or non-viewport operators |
| **`bpy.context.active_object` can be `None`** | After `read_factory_settings(use_empty=True)` nothing is active |

Operators do not raise when they are cancelled — they return {'CANCELLED'} and the script carries on. Check the return value of every bpy.ops call.

**Context override pattern** for an operator that insists on one:

```python
with bpy.context.temp_override(object=mesh, active_object=mesh, selected_objects=[mesh],
                               selected_editable_objects=[mesh]):
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
```

---

## 7. Verify the API before you rely on it

Names and enums change between Blender majors. Introspect, do not guess:

```python
# does this operator exist in this build?
print(hasattr(bpy.ops.object, "vertex_group_limit_total"))

# what enum values does this argument actually accept?
rna = bpy.ops.object.data_transfer.get_rna_type()
print([e.identifier for e in rna.properties["vert_mapping"].enum_items])

# full signature and docstring
print(bpy.ops.object.data_transfer.__doc__)
```

*This is how the §4.5 enum table was produced — and how the `use_reverse_transfer` gotcha was found.*

---

## 8. The Unity ↔ Blender round trip — the default workflow

**Unity is the project director.** The FBX files live in the Unity project, Blender does maintenance on them,
and they go straight back. Blender is not a separate pipeline stage with a hand-off — it is a tool you point
at files that already belong to Unity.

> **This is the default, not a limit.** See §8.4 — you can prompt for anything Blender can do.

### 8.1 Two modes, and they behave very differently

Decide this first, because the consequences are not symmetrical:

| | **Edit in place** (overwrite the FBX) | **Create a new model** (write a new path) |
|---|---|---|
| Unity GUID | ✅ **preserved** | ❌ new GUID |
| Existing scene / prefab references | ✅ **all survive and pick up the change** | ➖ untouched; the new asset is referenced by nothing |
| Importer settings — rig, avatar, clips, scale | ✅ **preserved** (the `.meta` is never touched) | ❌ **reset to defaults** — must be re-applied |
| Sub-assets (meshes, materials, clips) | ✅ re-linked | new set |
| Risk | ⚠️ destructive — **back up first** | none to existing assets |
| Use for | fixing/maintaining an asset already in scenes | variants, LODs, derived or experimental models |

**Verified, both directions:**

```
IN PLACE   before: GUID=ab9c00de936e54d2f9a10efc9e10097a  rig=Generic  subassets=12
           after : GUID=ab9c00de936e54d2f9a10efc9e10097a  rig=Generic  subassets=12   <- identical

NEW FILE   original: guid=ab9c00de…  scale=0.42  importCameras=False   <- artist-configured
           new     : guid=acf572d2…  scale=1     importCameras=True    <- DEFAULTS, not inherited
```

That second line is the trap: a new model silently loses every importer setting on the source.

### 8.2 In-place maintenance (the common case)

Unity may stay running throughout — it re-imports on refresh.

```bash
PROJ=/path/to/UnityProject
FBX="$PROJ/Assets/Models/character.fbx"

cp "$FBX" "$FBX~"                     # ALWAYS - the write is destructive

"$BLENDER" -b --factory-startup --python-exit-code 1         --python reweight.py -- "$FBX" "$FBX"      # same path in and out

unity command bt_refresh --project-path "$PROJ"
```

(Unity ignores files whose names end in `~`; a backup with any other name inside `Assets/` is imported and ends up committed.)

**Look at the result in a browser.** Re-export the level, then load it off the Toolkit development web server
(`unity-exporter-cli.md` §12) — that is how you verify a Blender edit actually survived the round trip:

```bash
open "http://localhost:8888/index.html"                      # the default scene
open "http://localhost:8888/index.html?scene=Level01.gltf"    # one specific scene, by file name
curl -sS -o /dev/null -w "%{http_code}\n" "http://localhost:8888/scenes/Level01.gltf"   # the raw asset
```

Confirm the GUID really did survive:

```bash
unity command eval 'string p="Assets/Models/character.fbx";
var i=(UnityEditor.ModelImporter)UnityEditor.AssetImporter.GetAtPath(p);
return UnityEditor.AssetDatabase.AssetPathToGUID(p) + " rig=" + i.animationType + " scale=" + i.globalScale;'   --project-path "$PROJ"
```

> **Never delete-then-recreate the FBX.** Removing the file removes its `.meta`, which destroys the GUID and
> breaks every scene and prefab that referenced it. Overwrite the bytes; leave the `.meta` alone.

### 8.2a Unity axis and scale

Unity is Y-up, left-handed and metre-scaled; Blender is Z-up. Export every FBX that goes back into a Unity
project with this preset:

```python
bpy.ops.export_scene.fbx(filepath=dst, axis_forward='-Z', axis_up='Y',
                         apply_scale_options='FBX_SCALE_UNITS', bake_space_transform=True,
                         add_leaf_bones=False)
```

| Symptom in Unity | Cause |
|---|---|
| Model rotated −90° on X | Axis settings (`axis_forward` / `axis_up` / `bake_space_transform`) |
| Model 100× too big or too small | Scale settings (`apply_scale_options`) |

Import with `bpy.ops.import_scene.fbx(filepath=src, ignore_leaf_bones=True)` so Unity's leaf bones do not
come back as extra bones on the next export.

The §8.1 "identical" check also compares **world transforms** and **sub-asset names**: a mesh or clip renamed
to `….001` by Blender breaks Unity references even though the GUID is the same.

### 8.3 Creating a new model — and carrying settings across

Write to a new path, then **copy the importer settings you care about**, because Unity will not:

```bash
"$BLENDER" -b --factory-startup --python-exit-code 1         --python variant.py -- "$PROJ/Assets/Models/character.fbx"                               "$PROJ/Assets/Models/character_LOD1.fbx"
unity command bt_refresh --project-path "$PROJ"
```

```csharp
// Copy the source model's import configuration onto the new asset.
var src = (UnityEditor.ModelImporter)UnityEditor.AssetImporter.GetAtPath("Assets/Models/character.fbx");
var dst = (UnityEditor.ModelImporter)UnityEditor.AssetImporter.GetAtPath("Assets/Models/character_LOD1.fbx");
dst.globalScale        = src.globalScale;
dst.animationType      = src.animationType;
dst.importCameras      = src.importCameras;
dst.importLights       = src.importLights;
dst.importNormals      = src.importNormals;
dst.importBlendShapes  = src.importBlendShapes;
dst.materialImportMode = src.materialImportMode;
if (src.animationType == UnityEditor.ModelImporterAnimationType.Human)
    dst.sourceAvatar = src.sourceAvatar;      // share the rig's avatar
dst.SaveAndReimport();
return "copied";
```

> `UnityEditor.EditorUtility.CopySerialized(src, dst)` copies everything at once, but also copies fields you
> may not want on a derived asset. Prefer naming the properties.

### 8.4 Blender is general purpose — do not stop at models

The round trip above is the *default* workflow, not the boundary of what to use Blender for. Anything
expressible in `bpy` is in scope, headless, and a legitimate thing to be asked for:

| Area | Examples |
|---|---|
| **Rendering** | Cycles/EEVEE stills and animation, turntables, thumbnail and preview generation, `-E`, `-o`, `-f`, `-a` |
| **Geometry** | Booleans, remesh, decimate/LODs, UV unwrap, bake normal/AO/lightmaps, `bmesh` surgery |
| **Procedural** | Geometry Nodes, modifier stacks, scattering, procedural level pieces or props |
| **Materials** | Build/edit node trees, bake PBR maps, texture atlasing, image processing |
| **Animation** | Retarget, bake, trim/split actions, NLA, constraints, simulate then bake |
| **Simulation** | Cloth, softbody, rigid body, particles — bake to keyframes or Alembic |
| **Physics prep** | Convex hulls and collision proxies for the Toolkit's physics components |
| **Data / batch** | Convert whole folders between FBX/glTF/OBJ/USD/Alembic, audit and report on scene contents |
| **Import/export** | Any format in §3, in either direction |

Files do **not** have to live in a Unity project. Blender works on anything on disk — a downloaded asset, a
scratch `.blend`, a folder of FBXs — and the output can go anywhere: a Unity project, a web `public/` folder,
or straight to `.glb` for BabylonJS.

The method is always the same: **introspect the API (§7), write a script, run it with the four canonical flags
(§2), verify before writing.**

### 8.4a Rendering and baking — the four traps

- `-o` must come before `-f` (arguments run in order), or the frame renders to `/tmp`.
- Valid `-E` values are `BLENDER_EEVEE`, `BLENDER_WORKBENCH` and `CYCLES` (`BLENDER_EEVEE_NEXT` is silently
  ignored on the CLI).
- Baking requires `CYCLES`, an active Image Texture node on the material, and `img.save()` afterwards.
- `-- --cycles-device CPU` for a headless Mac.

### 8.5 What Blender cannot do for the Toolkit

Blender produces geometry, skinning, materials and animation. It **cannot** add Babylon Toolkit
`extras.metadata.components` — Rigidbody, Animator, AudioSource, NavMeshAgent and the rest come from **Unity**,
and only under a Pro licence (`unity-exporter-cli.md` §0). That licence must come from a valid
`Assets/[Config]/license.json`: the two service-based grant paths (`ToolkitManager.HasActiveSubscription()`
and `CanvasToolsExporter.GenerateDeveloperLicense()`) exist in the API but **do not work yet**. A community
export still writes your Blender geometry and skinning perfectly — it just silently drops every component.

So:

- **Needs interactive components** → Blender fixes the model → Unity composes the scene → Toolkit exports.
- **Geometry / animation only** (a prop, a clip, a static mesh) → export `.glb` straight from Blender and skip
  Unity entirely.

**Conventions to preserve for BabylonJS:** ≤ 4 influences per vertex, weights normalised to 1.0, bone names
matching the Unity Avatar/Animator rig, and `add_leaf_bones=False` on FBX export.

## 9. Quick reference

```bash
# Executable
/Applications/Blender.app/Contents/MacOS/Blender      # macOS - the .app is NOT the binary
"$BLENDER" --version

# Canonical headless invocation - use all four flags
"$BLENDER" --background --factory-startup --python-exit-code 1 --python script.py -- arg1 arg2

# Inline, no file
"$BLENDER" -b --factory-startup --python-exit-code 1 --python-expr "import bpy; print(bpy.app.version_string)"

# Open a file first
"$BLENDER" -b asset.blend --factory-startup --python-exit-code 1 --python script.py

# Blender as a pip module instead of an app
python3 -m pip install "bpy==5.1.*"   # the verified line; one exact CPython per wheel
```

```python
import bpy, sys
argv = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []

bpy.ops.wm.open_mainfile(filepath="a.blend")          # .blend
bpy.ops.import_scene.fbx(filepath="a.fbx")            # FBX  (or bpy.ops.wm.fbx_import)
bpy.ops.import_scene.gltf(filepath="a.glb")           # glTF

# re-paint skinning — full, verified version is §4.2 reweight.py; never re-parent without clearing first
ctx = dict(active_object=mesh, object=mesh, selected_objects=[mesh], selected_editable_objects=[mesh])
for g in list(mesh.vertex_groups): mesh.vertex_groups.remove(g)
for m in [m for m in mesh.modifiers if m.type == 'ARMATURE']: mesh.modifiers.remove(m)
with bpy.context.temp_override(**ctx):
    assert 'FINISHED' in bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True); arm.select_set(True)
bpy.context.view_layer.objects.active = arm           # armature ACTIVE
assert 'FINISHED' in bpy.ops.object.parent_set(type='ARMATURE_AUTO', keep_transform=True)

# engine-legal, in this order — on the MESH
with bpy.context.temp_override(**ctx):
    assert 'FINISHED' in bpy.ops.object.vertex_group_clean(limit=0.01, group_select_mode='ALL')
    assert 'FINISHED' in bpy.ops.object.vertex_group_limit_total(limit=4, group_select_mode='ALL')
    assert 'FINISHED' in bpy.ops.object.vertex_group_normalize_all(lock_active=False)

# direct edit - no context needed, most reliable headless
mesh.vertex_groups["Bone"].add([0,1,2], 1.0, 'REPLACE')

bpy.ops.wm.save_as_mainfile(filepath="out.blend")
bpy.ops.export_scene.fbx(filepath="out.fbx", add_leaf_bones=False)
bpy.ops.export_scene.gltf(filepath="out.glb", export_format='GLB')
```

**Round trip with a Unity project (§8):**

```bash
cp "$FBX" "$FBX~"                                      # in-place writes are destructive
"$BLENDER" -b --factory-startup --python-exit-code 1 --python fix.py -- "$FBX" "$FBX"
unity command bt_refresh --project-path "$PROJ"
# in place  -> GUID + importer settings preserved, all scene refs survive
# new path  -> new GUID, importer settings RESET - copy them across (8.3)

# preview the re-exported result (unity-exporter-cli.md §12)
http://localhost:8888/index.html                      # default scene
http://localhost:8888/index.html?scene=Level01.gltf   # a specific scene, by file name
http://localhost:8888/scenes/Level01.gltf             # the raw exported asset
```

**The five rules that break naive attempts:**

1. `--python-exit-code 1`, or a crashed script silently "succeeds".
2. `--factory-startup`, or the user's prefs and add-ons change behaviour.
3. Select objects **and** set `view_layer.objects.active` before any operator — for
   `ARMATURE_AUTO` the **armature** must be active.
4. Prefer data manipulation (`vgroup.add`) over operators; it never fails on context.
5. `clean` → `limit_total` → `normalize_all`, in that order, then **verify** before writing.
