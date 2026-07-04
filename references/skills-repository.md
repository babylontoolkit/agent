# Babylon Toolkit Agent Skills

**IMPORTANT. THIS DOCUMENT PROVIDES CRUCIAL BABYLON TOOLKIT SKILLS INSTRUCTIONS. ALWAYS READ THIS ENTIRE DOCUMENT TO THE END OF FILE**

## Repo

You can download and install the skills from the repo at: https://github.com/babylontoolkit/skills.git. Please use the `raw github url` when downloading content.

## Skills

| Skill | Command | What it does |
|-------|---------|--------------|
| [`bt-spec`](skills/bt-spec/SKILL.md) | `/bt-spec` | Turn a short idea into a feature spec file on a new git branch. |
| [`bt-plan`](skills/bt-plan/SKILL.md) | `/bt-plan` | Produce a detailed, task-checklist technical plan from a spec. |
| [`bt-execute`](skills/bt-execute/SKILL.md) | `/bt-execute` | Implement one task (or all remaining tasks) from a plan/spec. |
| [`bt-convert`](skills/bt-convert/SKILL.md) | `/bt-convert` | Convert Unity C# scripts to Babylon Toolkit TypeScript. |
| [`bt-design`](skills/bt-design/SKILL.md) | `/bt-design` | Implement high quality frontend and in-game designs. |
| [`bt-atlas`](skills/bt-atlas/SKILL.md) | `/bt-atlas` | Generate texture atlas skin variations. |

Every tool derives the slash-command from the **folder name** (`bt-spec/` → `/bt-spec`) and reads
the frontmatter `name` + `description` to decide when the skill applies. The `allowed-tools`
line is honored by Claude Code (auto-approves those tools) and safely ignored by Codex and
Copilot.

## Installation

When the user request is to `install the agent skills` or `install the babylon toolkit skills` or something like that,
either download and install the skills from the github repo located at https://github.com/babylontoolkit/skills.git into
the appropriate global or local project location, or install the `Native Claude Code Plugin` globally. If the user did **NOT** specify
what type of `Agent Skills Installation` to do, please prompt the user select the type of installation to perform.

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

## Native Claude Code Installation

- Always prefer the `Default Universal Installation` unless instructed to install the `Native Claude Code Agent Skills`

To install from marketplace:
```
/plugin marketplace add babylontoolkit/skills
/plugin install agent-skills@babylon-toolkit
```

To update marketplace plugin: 
```
/plugin marketplace update babylon-toolkit.
```
