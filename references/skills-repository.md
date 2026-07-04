# Babylon Toolkit Agent Skills

**IMPORTANT. THIS DOCUMENT PROVIDES CRUCIAL BABYLON TOOLKIT SKILLS INSTRUCTIONS. ALWAYS READ THIS ENTIRE DOCUMENT TO THE END OF FILE**

## Repo

You can download and install the skills from the repo at: https://github.com/babylontoolkit/skills.git. Please use the `raw github url` when downloading content.

## Skills

A skill is a **folder**, not a single file. Every skill folder contains at minimum a `SKILL.md`,
and some skills ship **additional required asset files** (scripts, requirements, data) alongside it.

| Skill | Command | What it does | Folder contents |
|-------|---------|--------------|-----------------|
| [`bt-spec`](skills/bt-spec/SKILL.md) | `/bt-spec` | Turn a short idea into a feature spec file on a new git branch. | `SKILL.md` |
| [`bt-plan`](skills/bt-plan/SKILL.md) | `/bt-plan` | Produce a detailed, task-checklist technical plan from a spec. | `SKILL.md` |
| [`bt-execute`](skills/bt-execute/SKILL.md) | `/bt-execute` | Implement one task (or all remaining tasks) from a plan/spec. | `SKILL.md` |
| [`bt-convert`](skills/bt-convert/SKILL.md) | `/bt-convert` | Convert Unity C# scripts to Babylon Toolkit TypeScript. | `SKILL.md` |
| [`bt-design`](skills/bt-design/SKILL.md) | `/bt-design` | Implement high quality frontend and in-game designs. | `SKILL.md` |
| [`bt-atlas`](skills/bt-atlas/SKILL.md) | `/bt-atlas` | Generate texture atlas skin variations. | `SKILL.md` **+ `scripts/` (required Python)** |

Every tool derives the slash-command from the **folder name** (`bt-spec/` → `/bt-spec`) and reads
the frontmatter `name` + `description` to decide when the skill applies. The `allowed-tools`
line is honored by Claude Code (auto-approves those tools) and safely ignored by Codex and
Copilot.

## ⚠️ CRITICAL: Skills Are Folders — Copy Them Whole

**When installing, you MUST copy each skill's ENTIRE folder — never just its `SKILL.md`.**
Some skills fail at runtime if their supporting assets are missing.

- ❌ **DO NOT** do `cp .../SKILL.md ...` or glob only `*/SKILL.md`. This silently drops assets
  and leaves `bt-atlas` broken.
- ✅ **DO** copy the whole skill directory (`SKILL.md` **and** every subfolder such as `scripts/`).

### Exact repository layout (this is the source of truth — do not guess)

```
skills/
├── bt-spec/
│   └── SKILL.md
├── bt-plan/
│   └── SKILL.md
├── bt-execute/
│   └── SKILL.md
├── bt-convert/
│   └── SKILL.md
├── bt-design/
│   └── SKILL.md
└── bt-atlas/
    ├── SKILL.md
    └── scripts/
        ├── composite_skin.py
        ├── preview.py
        ├── uv_island_mask.py
        └── requirements.txt
```

### Required-asset manifest (verify EVERY file below exists after install)

`bt-atlas` **will not run** unless all of these are present in the installed folder:

- `bt-atlas/SKILL.md`
- `bt-atlas/scripts/composite_skin.py`
- `bt-atlas/scripts/preview.py`
- `bt-atlas/scripts/uv_island_mask.py`
- `bt-atlas/scripts/requirements.txt`

> `bt-atlas` runs Python. Its scripts depend on the packages in `scripts/requirements.txt`.
> Do not attempt to satisfy them by hand — the skill installs them itself when first run.

All other skills (`bt-spec`, `bt-plan`, `bt-execute`, `bt-convert`, `bt-design`) are `SKILL.md`-only.

## Installation

When the user request is to `install the agent skills` or `install the babylon toolkit skills` or something like that,
either download and install the skills from the github repo located at https://github.com/babylontoolkit/skills.git into
the appropriate global or local project location, or install the `Native Claude Code Plugin` globally. If the user did **NOT** specify
what type of `Agent Skills Installation` to do, please prompt the user select the type of installation to perform.

**However you install, you MUST end with the [Post-Install Verification](#post-install-verification) step below.**
An install that reports success but is missing `bt-atlas/scripts/` is a FAILED install — go back and copy the missing files.

### Recommended install method: clone the whole repo, copy whole folders

Cloning guarantees every asset comes along. Copy folders recursively (`-R` / `-r`), never file-by-file:

```bash
# 1. Clone the full repo (brings ALL skill assets, including bt-atlas/scripts/)
git clone --depth 1 https://github.com/babylontoolkit/skills.git /tmp/bt-skills

# 2. Copy the ENTIRE set of skill folders into each target location.
#    The skill folders live under the repo's top-level `skills/` directory.
mkdir -p .claude/skills .codex/skills
cp -R /tmp/bt-skills/skills/. .claude/skills/    # Claude Code (also read by Copilot)
cp -R /tmp/bt-skills/skills/. .codex/skills/     # Codex CLI
```

### If you download via raw GitHub URLs instead of cloning

You are responsible for fetching **every file in the manifest above**, preserving the folder
structure. For `bt-atlas` that means the `SKILL.md` **and** all four files under `scripts/`.
Raw URL pattern:

```
https://raw.githubusercontent.com/babylontoolkit/skills/main/skills/<skill>/<path>
```

Examples for `bt-atlas` (note the `scripts/` files — do not skip them):

```
https://raw.githubusercontent.com/babylontoolkit/skills/main/skills/bt-atlas/SKILL.md
https://raw.githubusercontent.com/babylontoolkit/skills/main/skills/bt-atlas/scripts/composite_skin.py
https://raw.githubusercontent.com/babylontoolkit/skills/main/skills/bt-atlas/scripts/preview.py
https://raw.githubusercontent.com/babylontoolkit/skills/main/skills/bt-atlas/scripts/uv_island_mask.py
https://raw.githubusercontent.com/babylontoolkit/skills/main/skills/bt-atlas/scripts/requirements.txt
```

## Post-Install Verification

After copying, **confirm the asset-bearing skills are complete**. Run this and confirm the
`scripts/` files are listed for `bt-atlas` in every location you installed to:

```bash
for dir in .claude/skills .codex/skills; do
  echo "== $dir =="
  ls "$dir"/bt-atlas/scripts/composite_skin.py \
     "$dir"/bt-atlas/scripts/preview.py \
     "$dir"/bt-atlas/scripts/uv_island_mask.py \
     "$dir"/bt-atlas/scripts/requirements.txt 2>&1
done
```

If any `bt-atlas/scripts/*` file is missing, the install is INCOMPLETE — re-copy the full
`bt-atlas` folder before telling the user the install succeeded.

## Universal Installations

Where each tool looks for local project skills (Default Installation):

| Tool | Skills directory |
|------|------------------|
| Claude Code | `.claude/skills/` *(also read by Copilot)* |
| Codex CLI | `.codex/skills/` |

Where each tool looks for all global project skills:

| Tool | Skills directory |
|------|------------------|
| Claude Code | `~/.claude/skills/` *(also read by Copilot)* |
| Codex CLI | `~/.codex/skills/` |

> **Note:** Install skills into **BOTH** Claude Code and Codex locations for maximum coverage.
> Copy **whole folders** into each — the `bt-atlas/scripts/` assets must be present in every location.

## Native Claude Code Installation

- Always prefer the `Default Universal Installation` unless instructed to install the `Native Claude Code Agent Skills`
- The marketplace plugin install bundles all skill assets (including `bt-atlas/scripts/`) automatically.

To install from marketplace:
```
/plugin marketplace add babylontoolkit/skills
/plugin install agent-skills@babylon-toolkit
```

To update marketplace plugin: 
```
/plugin marketplace update babylon-toolkit.
```
